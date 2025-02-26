const vscode = require('vscode');

/**
 * Finds the closing bracket that matches the opening bracket at the given position
 * @param {vscode.TextDocument} document The document
 * @param {vscode.Position} position Position of the opening bracket
 * @returns {vscode.Position|null} Position of the closing bracket or null if not found
 */
function findMatchingBracket(document, position) {
    let depth = 1;
    let line = position.line;
    let character = position.character + 1; // Start after the opening bracket

    while (line < document.lineCount) {
        const lineText = document.lineAt(line).text;

        while (character < lineText.length) {
            const char = lineText.charAt(character);

            if (char === '(') {
                depth++;
            } else if (char === ')') {
                depth--;
                if (depth === 0) {
                    // Found the matching closing bracket
                    return new vscode.Position(line, character);
                }
            }

            character++;
        }

        // Move to next line
        line++;
        character = 0;

        // Safety limit to avoid infinite loops
        if (line - position.line > 100) {
            break;
        }
    }

    return null; // Closing bracket not found
}

module.exports = {
    findMatchingBracket
};
