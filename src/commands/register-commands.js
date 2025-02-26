const vscode = require('vscode');
const { wrapWidget, showWidgetsMenu } = require('../wrappers');
const { getAllWidgets, getEnabledWidgets } = require('../wrappers');

/**
 * Registers all widget wrapping commands
 * @param {vscode.ExtensionContext} context 
 */
function registerCommands(context) {
    // Get all available widgets
    const widgetWrappers = getAllWidgets();

    // Register command to show widgets menu
    const showWidgetsMenuCommand = vscode.commands.registerCommand(
        'wrapping.showWidgetsMenu',
        () => showWidgetsMenu()
    );
    context.subscriptions.push(showWidgetsMenuCommand);

    // Register each command to wrap widgets
    for (const wrapper of widgetWrappers) {
        const command = vscode.commands.registerCommand(wrapper.id, () => {
            // Only execute if the wrapper is enabled
            if (wrapper.enabled !== false) {
                wrapWidget(wrapper.snippet, `Wrap with ${wrapper.title}`);
            } else {
                vscode.window.showWarningMessage(`The ${wrapper.title} wrapper is currently disabled. Enable it in the Flutter Wrappers panel.`);
            }
        });
        context.subscriptions.push(command);
    }
}

module.exports = {
    registerCommands
};
