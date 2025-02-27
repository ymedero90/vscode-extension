const vscode = require('vscode');
const { registerCommands } = require('./src/commands/register-commands');
const { CodeActionWrapProvider } = require('./src/code-actions/wrapper-provider');
const { WrappersViewProvider } = require('./src/views/wrappers-view-provider');
const {
    initializeWrapperStates,
    toggleWrapperState,
    syncWrappersWithConfig
} = require('./src/wrappers/widget-registry');

/**
 * Extension activation point
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
    console.log('Flutter Widget Wrapper extension is now active.');

    // Initialize widget states
    initializeWrapperStates(context);

    // Register code action provider
    context.subscriptions.push(
        vscode.languages.registerCodeActionsProvider(
            { language: 'dart', scheme: 'file' },
            new CodeActionWrapProvider()
        )
    );

    // Register commands
    registerCommands(context);

    // Create and register view provider for the main wrappers list
    const wrappersViewProvider = new WrappersViewProvider([], context);
    vscode.window.registerTreeDataProvider('flutterWrappers', wrappersViewProvider);

    // Register configuration change listener
    context.subscriptions.push(
        vscode.workspace.onDidChangeConfiguration(event => {
            // Check if our configuration section was affected
            if (isFlutterWrapperSettingChanged(event)) {
                console.log('Flutter Wrapper configuration changed');

                // Sync wrapper states with configuration
                syncWrappersWithConfig();

                // Refresh the view
                wrappersViewProvider.refresh();
            }
        })
    );

    // Register refresh command
    context.subscriptions.push(
        vscode.commands.registerCommand('flutterWrappers.refresh', () => {
            wrappersViewProvider.refresh();
        })
    );

    // Register open settings command
    context.subscriptions.push(
        vscode.commands.registerCommand('flutterWrappers.openSettings', () => {
            vscode.commands.executeCommand('workbench.action.openSettings', 'flutterWidgetWrapper');
        })
    );

    // Register toggle wrapper state command
    context.subscriptions.push(
        vscode.commands.registerCommand('flutterWrappers.toggleWrapperState', (wrapper) => {
            if (!wrapper || !wrapper.id) {
                vscode.window.showErrorMessage('Invalid wrapper selected');
                return;
            }

            console.log(`Toggling wrapper: ${wrapper.id}`);

            const newState = toggleWrapperState(wrapper.id, context);
            vscode.window.showInformationMessage(
                `${wrapper.title} wrapper is now ${newState ? 'enabled' : 'disabled'}`
            );

            // Refresh the view to show the updated state
            wrappersViewProvider.refresh();
        })
    );
}

/**
 * Checks if the configuration change event affects our extension's settings
 * @param {vscode.ConfigurationChangeEvent} event The configuration change event
 * @returns {boolean} True if our settings were affected
 */
function isFlutterWrapperSettingChanged(event) {
    // Check for any section that starts with flutterWidgetWrapper
    return event.affectsConfiguration('flutterWidgetWrapper');
}

function deactivate() { }

module.exports = {
    activate,
    deactivate
};