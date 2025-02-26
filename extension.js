const vscode = require('vscode');

// Import modules from our organized structure
const { DART_MODE, DART_CODE_EXTENSION, FLUTTER_EXTENSION } = require('./src/constants');
const { registerCommands } = require('./src/commands');
const { CodeActionWrapProvider } = require('./src/code-actions');

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
    console.log('Flutter Widget Wrapper extension is now active!');

    // Check if required extensions are installed
    checkDependencies();

    // Register commands and providers
    registerCommands(context);

    // Register code action provider
    context.subscriptions.push(
        vscode.languages.registerCodeActionsProvider(DART_MODE, new CodeActionWrapProvider())
    );
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