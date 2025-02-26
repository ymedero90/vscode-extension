const vscode = require('vscode');

/**
 * Code action provider for widget wrapping
 */
class CodeActionWrapProvider {
    provideCodeActions(document) {
        if (document.languageId !== 'dart') {
            return [];
        }

        const editor = vscode.window.activeTextEditor;
        if (!editor) return [];

        // Just one code action that opens the widgets menu
        const action = new vscode.CodeAction('Flutter Wrappers...', vscode.CodeActionKind.RefactorRewrite);
        action.command = {
            command: 'wrapping.showWidgetsMenu',
            title: 'Flutter Wrappers...'
        };

        return [action];
    }
}

module.exports = {
    CodeActionWrapProvider
};
