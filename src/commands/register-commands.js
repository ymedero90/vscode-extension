const vscode = require('vscode');
const { wrapWidget, showWidgetsMenu } = require('../wrappers');
const { getAllWidgets } = require('../wrappers');

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
        () => showWidgetsMenu(widgetWrappers)
    );
    context.subscriptions.push(showWidgetsMenuCommand);

    // Register each command to wrap widgets
    for (const wrapper of widgetWrappers) {
        const command = vscode.commands.registerCommand(wrapper.id, () => {
            wrapWidget(wrapper.snippet, `Wrap with ${wrapper.title}`);
        });
        context.subscriptions.push(command);
    }
}

module.exports = {
    registerCommands
};
