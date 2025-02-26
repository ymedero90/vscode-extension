const vscode = require('vscode');
const { findMatchingBracket } = require('./bracket-matching');

/**
 * Detects a complete Flutter widget around the given position
 * @param {vscode.TextDocument} document The document
 * @param {vscode.Position} position The cursor position
 * @returns {Object|null} An object with the range and text of the widget, or null if not found
 */
function detectCompleteWidget(document, position) {
    // If not a Dart file, do nothing
    if (document.languageId !== 'dart') {
        return null;
    }

    const line = document.lineAt(position.line);
    const lineText = line.text;

    // Find the start of the widget
    let widgetStartIndex = position.character;
    for (; widgetStartIndex > 0; widgetStartIndex--) {
        const currentChar = lineText.charAt(widgetStartIndex);
        const isBeginningOfWidget =
            currentChar === '(' ||
            (currentChar === " " &&
                lineText.charAt(widgetStartIndex - 1) !== "," &&
                lineText.substring(widgetStartIndex - 5, widgetStartIndex) !== "const");
        if (isBeginningOfWidget) break;
    }
    widgetStartIndex++;

    // Look for opening bracket
    const openBracketIndex = lineText.indexOf('(', widgetStartIndex);
    if (openBracketIndex < 0) {
        // No opening bracket, search until comma or closing bracket
        const commaIndex = lineText.indexOf(",", widgetStartIndex);
        const bracketIndex = lineText.indexOf(")", widgetStartIndex);
        const endIndex =
            commaIndex >= 0
                ? commaIndex
                : bracketIndex >= 0
                    ? bracketIndex
                    : lineText.length;

        return {
            range: new vscode.Range(
                new vscode.Position(line.lineNumber, widgetStartIndex),
                new vscode.Position(line.lineNumber, endIndex)
            ),
            text: lineText.substring(widgetStartIndex, endIndex)
        };
    }

    // Find the corresponding closing bracket
    const openBracketPos = new vscode.Position(line.lineNumber, openBracketIndex);
    const closeBracketPos = findMatchingBracket(document, openBracketPos);

    if (!closeBracketPos) {
        return null;
    }

    // Extract the complete widget
    const widgetRange = new vscode.Range(line.lineNumber, widgetStartIndex, closeBracketPos.line, closeBracketPos.character + 1);
    const widgetText = document.getText(widgetRange);

    return { range: widgetRange, text: widgetText };
}

module.exports = {
    detectCompleteWidget
};
