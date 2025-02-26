const vscode = require('vscode');
const path = require('path');

// Import modules from our organized structure
const { DART_MODE, DART_CODE_EXTENSION, FLUTTER_EXTENSION } = require('./src/constants');
const { registerCommands } = require('./src/commands');
const { CodeActionWrapProvider } = require('./src/code-actions');
const { getAllWidgets, initializeWrapperStates, getEnabledWidgets } = require('./src/wrappers');
const { WrappersViewProvider } = require('./src/views');

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
    console.log('Flutter Widget Wrapper extension is now active!');

    // Check if required extensions are installed
    checkDependencies();

    try {
        // Initialize wrapper states
        initializeWrapperStates(context);

        // Get all available widgets
        const widgetWrappers = getAllWidgets();

        // Register commands first so they're available
        registerCommands(context);

        // Register view for the activity bar
        const wrappersViewProvider = new WrappersViewProvider(widgetWrappers, context);

        // Create tree view WITHOUT checkboxes - use simple clickable items instead
        const treeView = vscode.window.createTreeView('flutterWrappers', {
            treeDataProvider: wrappersViewProvider
        });

        context.subscriptions.push(treeView);

        // Register code action provider
        context.subscriptions.push(
            vscode.languages.registerCodeActionsProvider(DART_MODE, new CodeActionWrapProvider())
        );

        // Register refresh command
        context.subscriptions.push(
            vscode.commands.registerCommand('flutterWrappers.refresh', () => {
                wrappersViewProvider.refresh();
            })
        );

        // Register a direct toggle command
        context.subscriptions.push(
            vscode.commands.registerCommand('flutterWrappers.toggleWrapperState', (item) => {
                console.log('Toggle for item:', item);

                // Direct call to toggleWrapperState
                const { toggleWrapperState } = require('./src/wrappers');
                const newState = toggleWrapperState(item.id, context);

                // Refresh
                wrappersViewProvider.refresh();

                // Update context menus
                updateMenuVisibility();

                vscode.window.showInformationMessage(
                    `${item.title} is now ${newState ? 'enabled' : 'disabled'}`
                );
            })
        );

        // Initialize all context values
        for (const wrapper of widgetWrappers) {
            vscode.commands.executeCommand(
                'setContext',
                `flutterWrapper.${wrapper.id}.enabled`,
                wrapper.enabled !== false
            );
        }

        // Show the view
        vscode.commands.executeCommand('flutterWrappers.focus');

    } catch (error) {
        console.error('Error during activation:', error);
        vscode.window.showErrorMessage(`Flutter Widget Wrapper activation failed: ${error.message}`);
    }
}

/**
 * Updates the context menu visibility based on enabled wrappers
 */
function updateMenuVisibility() {
    const allWrappers = getAllWidgets();

    // For each wrapper, set a context value to control visibility
    for (const wrapper of allWrappers) {
        const contextKey = `flutterWrapper.${wrapper.id}.enabled`;
        const isEnabled = wrapper.enabled !== false;
        vscode.commands.executeCommand('setContext', contextKey, isEnabled);
    }
}

/**
 * Verify that Dart and Flutter extensions are installed
 */
function checkDependencies() {
    const dartExt = vscode.extensions.getExtension(DART_CODE_EXTENSION);
    const flutterExt = vscode.extensions.getExtension(FLUTTER_EXTENSION);

    if (!dartExt) {
        vscode.window.showWarningMessage("The Dart extension is not installed. Some features might not work correctly.");
    }

    if (!flutterExt) {
        vscode.window.showWarningMessage("The Flutter extension is not installed. Some features might not work correctly.");
    }
}

function deactivate() { }

module.exports = {
    activate,
    deactivate
}