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

    // First try to get the widget directly at cursor position
    let result = tryDirectWidgetDetection(document, position);

    // If that fails, try more broadly around the position
    if (!result) {
        result = tryBroaderWidgetDetection(document, position);
    }

    return result;
}

/**
 * Tries to find a widget directly at the cursor position
 * @param {vscode.TextDocument} document Document
 * @param {vscode.Position} position Cursor position
 * @returns {Object|null} Widget info or null
 */
function tryDirectWidgetDetection(document, position) {
    const line = document.lineAt(position.line);
    const lineText = line.text;

    // Get the word at cursor position
    const wordRange = document.getWordRangeAtPosition(position);
    if (!wordRange) return null;

    const word = document.getText(wordRange);

    // Skip property names and keywords
    if (isPropertyOrKeyword(word)) return null;

    // Check if it looks like a widget name
    if (!looksLikeWidget(word)) return null;

    // Find widget range
    return findWidgetRangeFromName(document, position, word);
}

/**
 * Tries a broader approach to detect widgets around the position
 * @param {vscode.TextDocument} document Document
 * @param {vscode.Position} position Cursor position
 * @returns {Object|null} Widget info or null
 */
function tryBroaderWidgetDetection(document, position) {
    const line = document.lineAt(position.line);
    const lineText = line.text;

    // Get the current line text up to the cursor position
    const textBeforeCursor = lineText.substring(0, position.character);

    // Find common Flutter widget names on the current line
    const widgetMatches = [...textBeforeCursor.matchAll(/\b(Container|Flexible|Padding|Center|Row|Column|Stack|Expanded|Text|SizedBox|Card)(?=\s*\()/g)];

    if (widgetMatches.length === 0) return null;

    // Get the last widget match before the cursor
    const lastMatch = widgetMatches[widgetMatches.length - 1];
    const widgetName = lastMatch[1];
    const widgetStartPos = lastMatch.index;

    // Create a position at the widget name
    const widgetPosition = new vscode.Position(position.line, widgetStartPos);

    // Try to find the widget range from this name
    return findWidgetRangeFromName(document, widgetPosition, widgetName);
}

/**
 * Finds the full range of a widget based on its name and position
 * @param {vscode.TextDocument} document Document
 * @param {vscode.Position} position Position near the widget name
 * @param {string} widgetName The widget name
 * @returns {Object|null} Widget info or null
 */
function findWidgetRangeFromName(document, position, widgetName) {
    const line = document.lineAt(position.line);
    const lineText = line.text;

    // Find the position of the widget name on the line
    const widgetNameIndex = lineText.indexOf(widgetName, Math.max(0, position.character - widgetName.length - 10));

    if (widgetNameIndex < 0) return null;

    // Find opening bracket after widget name
    const openingBracketIndex = lineText.indexOf('(', widgetNameIndex + widgetName.length);
    if (openingBracketIndex < 0) return null;

    // Find matching closing bracket
    const openBracketPos = new vscode.Position(line.lineNumber, openingBracketIndex);
    const closeBracketPos = findMatchingBracket(document, openBracketPos);

    if (!closeBracketPos) return null;

    // Create range for the full widget
    const widgetRange = new vscode.Range(
        line.lineNumber,
        widgetNameIndex,
        closeBracketPos.line,
        closeBracketPos.character + 1
    );

    // Get the widget text
    const widgetText = document.getText(widgetRange);

    // Validate this is actually a widget
    if (!isValidWidgetText(widgetText)) {
        return null;
    }

    return { range: widgetRange, text: widgetText };
}

/**
 * Checks if text looks like a valid Flutter widget
 * @param {string} text The text to check
 * @returns {boolean} True if it looks like a valid widget
 */
function isValidWidgetText(text) {
    // Must start with a capital letter and contain opening and closing parentheses
    if (!/^[A-Z]/.test(text) || !text.includes('(') || !text.includes(')')) {
        return false;
    }

    // Make sure it's not just a property assignment
    if (/^[a-z][a-zA-Z0-9_]*\s*:/.test(text.trim())) {
        return false;
    }

    // Common Flutter widget indicators
    const commonPatterns = [
        'child:', 'children:', 'builder:', 'padding:', 'margin:',
        'alignment:', 'decoration:', 'color:', 'width:', 'height:'
    ];

    // Check if the constructor has widget-like parameters
    for (const pattern of commonPatterns) {
        if (text.includes(pattern)) {
            return true;
        }
    }

    // Check if it's a known Flutter widget type (essential for widgets without properties)
    const widgetName = text.trim().split(/[^\w]/)[0];
    const commonWidgets = [
        'Container', 'Row', 'Column', 'Stack', 'Expanded', 'Flexible',
        'Padding', 'Center', 'SizedBox', 'Text', 'Card', 'Align', 'AspectRatio',
        'Icon', 'Image', 'Material', 'Scaffold', 'AppBar', 'TabBar', 'Drawer',
        'FloatingActionButton', 'InkWell', 'GestureDetector', 'SingleChildScrollView',
        'ListView', 'GridView', 'Divider', 'Spacer', 'Wrap', 'Chip', 'Dialog'
    ];

    if (commonWidgets.includes(widgetName)) {
        return true;
    }

    // If we can't be sure, assume it's a widget if it looks like a constructor call
    return /^[A-Z][a-zA-Z0-9_]*\s*\(/.test(text.trim());
}

/**
 * Checks if a word is a property name or Dart keyword
 * @param {string} word The word to check
 * @returns {boolean} True if it's a property or keyword
 */
function isPropertyOrKeyword(word) {
    // Common property names
    const properties = [
        'child', 'children', 'builder', 'padding', 'margin', 'color',
        'width', 'height', 'decoration', 'alignment', 'style', 'key'
    ];

    // Dart keywords
    const keywords = [
        'if', 'else', 'for', 'while', 'return', 'break', 'continue',
        'switch', 'case', 'default', 'var', 'final', 'const', 'void',
        'true', 'false', 'null', 'this', 'super', 'new', 'class', 'enum'
    ];

    return properties.includes(word) || keywords.includes(word);
}

/**
 * Checks if the given text looks like a Flutter widget
 * @param {string} word The word to check
 * @returns {boolean} True if it looks like a widget
 */
function looksLikeWidget(word) {
    // Flutter widgets typically start with uppercase letter
    return /^[A-Z][a-zA-Z0-9_]*$/.test(word);
}

module.exports = {
    detectCompleteWidget
};
