const vscode = require('vscode');
const { registerCommands } = require('./src/commands/register-commands');
const { CodeActionWrapProvider } = require('./src/code-actions/wrapper-provider');
const { WrappersViewProvider } = require('./src/views/wrappers-view-provider');
const { WidgetTreeProvider } = require('./src/views/widget-tree-provider');
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

    // Create and register view provider for the widget tree
    const widgetTreeProvider = new WidgetTreeProvider();

    // Registrar el TreeView y guardar la referencia
    const treeView = vscode.window.createTreeView('flutterWidgetTree', {
        treeDataProvider: widgetTreeProvider,
        showCollapseAll: true
    });

    // Establecer la referencia al TreeView en el provider
    widgetTreeProvider.setTreeView(treeView);

    console.log('Widget tree view provider registered');

    // Add a command to focus the widget tree panel
    context.subscriptions.push(
        vscode.commands.registerCommand('flutterWrappers.focusWidgetTree', () => {
            vscode.commands.executeCommand('flutterWidgetTree.focus');
            widgetTreeProvider.refresh();
        })
    );

    // Register widget tree specific commands
    context.subscriptions.push(
        vscode.commands.registerCommand('flutterWrappers.widgetTree.toggleViewMode', () => {
            const isCompact = widgetTreeProvider.toggleViewMode();
            vscode.window.showInformationMessage(`Widget tree view switched to ${isCompact ? 'compact' : 'detailed'} mode`);
        })
    );

    // Reemplazar los comandos de expandAll y collapseAll
    context.subscriptions.push(
        vscode.commands.registerCommand('flutterWrappers.widgetTree.expandAll', async () => {
            vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: "Expandiendo árbol...",
                cancellable: false
            }, async (progress) => {
                try {
                    await widgetTreeProvider.expandAll();
                    vscode.window.showInformationMessage('Árbol expandido');
                } catch (error) {
                    console.error('Error expandiendo árbol:', error);
                    vscode.window.showErrorMessage('Error al expandir el árbol');
                }
            });
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('flutterWrappers.widgetTree.collapseAll', async () => {
            vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: "Colapsando árbol...",
                cancellable: false
            }, async (progress) => {
                try {
                    await widgetTreeProvider.collapseAll();
                    vscode.window.showInformationMessage('Árbol colapsado');
                } catch (error) {
                    console.error('Error colapsando árbol:', error);
                    vscode.window.showErrorMessage('Error al colapsar el árbol');
                }
            });
        })
    );

    // Add command to remove a widget
    context.subscriptions.push(
        vscode.commands.registerCommand('flutterWrappers.widgetTree.removeWidget', async (item) => {
            if (!item || !item.metadata) {
                vscode.window.showErrorMessage('Widget information is not available');
                return;
            }

            try {
                const { filePath, line, widgetOffset, widgetName } = item.metadata;
                const document = await vscode.workspace.openTextDocument(filePath);
                const editor = await vscode.window.showTextDocument(document);

                // Try to locate the widget more precisely using the stored offset if available
                let lineToUse = line;

                // If we have the exact character position, use it for better accuracy
                // Highlight the widget first so user can see what's being unwrapped
                if (widgetOffset) {
                    // Position to the exact widget start
                    const widgetStartPos = document.positionAt(widgetOffset);
                    // Find the end of the widget name
                    const nameEndPos = new vscode.Position(
                        widgetStartPos.line,
                        widgetStartPos.character + widgetName.length
                    );

                    // Select the widget name to show what's being unwrapped
                    editor.selection = new vscode.Selection(widgetStartPos, nameEndPos);

                    // Use the more accurate line number
                    lineToUse = widgetStartPos.line;
                }

                // Find the widget's start and end positions
                const widgetInfo = await analyzeWidgetForRemoval(document, lineToUse);
                if (!widgetInfo) {
                    vscode.window.showErrorMessage('Could not locate the widget in the document');
                    return;
                }

                // Determine if this is a widget with children
                if (widgetInfo.childContent) {
                    // Replace the widget with its child content
                    await editor.edit(editBuilder => {
                        editBuilder.replace(widgetInfo.widgetRange, widgetInfo.childContent);
                    });
                    vscode.window.showInformationMessage(`Removed ${item.metadata.widgetName} wrapper, preserving child content`);
                } else {
                    // No child content found, remove the entire widget
                    await editor.edit(editBuilder => {
                        editBuilder.delete(widgetInfo.widgetRange);
                    });
                    vscode.window.showInformationMessage(`Removed ${item.metadata.widgetName} widget completely`);
                }

                // Format document after removal
                await vscode.commands.executeCommand('editor.action.formatDocument');

                // Refresh the tree view
                widgetTreeProvider.refresh();
            } catch (error) {
                console.error('Error removing widget:', error);
                vscode.window.showErrorMessage(`Error removing widget: ${error.message}`);
            }
        })
    );

    // Add command to wrap a selected widget
    context.subscriptions.push(
        vscode.commands.registerCommand('flutterWrappers.widgetTree.wrapSelectedWidget', async (item) => {
            if (!item || !item.metadata) {
                vscode.window.showErrorMessage('Widget information is not available');
                return;
            }

            try {
                const { filePath, line, widgetName } = item.metadata;

                // Open the document and get editor
                const document = await vscode.workspace.openTextDocument(filePath);
                await vscode.window.showTextDocument(document);

                // Find the widget in the document
                const widgetRange = await findWidgetRangeInDocument(document, line);
                if (!widgetRange) {
                    vscode.window.showErrorMessage('Could not locate the widget in the document');
                    return;
                }

                // Position cursor at the widget
                vscode.window.activeTextEditor.selection = new vscode.Selection(
                    widgetRange.start,
                    widgetRange.start
                );

                // Show the wrap widget quick pick menu
                vscode.commands.executeCommand('wrapping.showWidgetsMenu');

                // Refresh the tree view after a delay to let the wrap command complete
                setTimeout(() => widgetTreeProvider.refresh(), 1000);
            } catch (error) {
                console.error('Error preparing to wrap widget:', error);
                vscode.window.showErrorMessage(`Error preparing to wrap widget: ${error.message}`);
            }
        })
    );

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

    // Register refresh command with both views
    context.subscriptions.push(
        vscode.commands.registerCommand('flutterWrappers.refresh', () => {
            console.log('Refresh command executed');
            wrappersViewProvider.refresh();
            widgetTreeProvider.refresh();
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

/**
 * Finds the full range of a widget in a document starting from a specific line
 * @param {vscode.TextDocument} document The document
 * @param {number} line The line where the widget starts
 * @returns {Promise<vscode.Range|null>} The range of the widget or null if not found
 */
async function findWidgetRangeInDocument(document, line) {
    try {
        // Get the line text where the widget starts
        const lineText = document.lineAt(line).text;

        // Find the widget name pattern (capitalized identifier followed by opening parenthesis)
        const match = lineText.match(/([A-Z][a-zA-Z0-9_]*)\s*\(/);
        if (!match) return null;

        const widgetName = match[1];
        const startPos = lineText.indexOf(widgetName);
        if (startPos === -1) return null;

        // Create a position at the start of the widget name
        const startPosition = new vscode.Position(line, startPos);

        // Use bracket matching from the utility module
        const utils = require('./src/utils/bracket-matching');
        const openBracketPos = new vscode.Position(line, lineText.indexOf('(', startPos));
        const closeBracketPos = utils.findMatchingBracket(document, openBracketPos);

        if (!closeBracketPos) return null;

        // Create a range for the complete widget
        return new vscode.Range(startPosition, new vscode.Position(closeBracketPos.line, closeBracketPos.character + 1));
    } catch (error) {
        console.error('Error finding widget range:', error);
        return null;
    }
}

/**
 * Analyzes a widget to determine its range and child content for removal
 * @param {vscode.TextDocument} document The document
 * @param {number} line The line where the widget starts
 * @returns {Promise<Object|null>} Object with widget range and child content
 */
async function analyzeWidgetForRemoval(document, line) {
    try {
        // Get the line text where the widget starts
        const lineText = document.lineAt(line).text;

        // Find the widget name pattern (capitalized identifier followed by opening parenthesis)
        const match = lineText.match(/([A-Z][a-zA-Z0-9_]*)\s*\(/);
        if (!match) return null;

        const widgetName = match[1];
        const startPos = lineText.indexOf(widgetName);
        if (startPos === -1) return null;

        // Create a position at the start of the widget name
        const startPosition = new vscode.Position(line, startPos);

        // Use bracket matching to find the closing parenthesis
        const utils = require('./src/utils/bracket-matching');
        const openBracketPos = new vscode.Position(line, lineText.indexOf('(', startPos));
        const closeBracketPos = utils.findMatchingBracket(document, openBracketPos);

        if (!closeBracketPos) return null;

        // Create a range for the complete widget
        const widgetRange = new vscode.Range(startPosition, new vscode.Position(closeBracketPos.line, closeBracketPos.character + 1));

        // Get the full widget text to analyze
        const fullWidgetText = document.getText(widgetRange);

        // Use a completely different approach to extract inner content
        const childContent = extractWidgetChildren(fullWidgetText, widgetName);

        console.log(`Analyzed widget ${widgetName}. Found child content: ${!!childContent}`);

        return {
            widgetRange,
            childContent
        };
    } catch (error) {
        console.error('Error analyzing widget for removal:', error);
        return null;
    }
}

/**
 * Extracts the inner content of a widget, handling both single child and multi-child widgets
 * @param {string} widgetText The complete widget text
 * @param {string} widgetName The name of the widget
 * @returns {string|null} The extracted inner content or null if not found
 */
function extractWidgetChildren(widgetText, widgetName) {
    console.log(`Unwrapping widget: ${widgetName}`);

    // First check if this is a multi-child widget
    if (isMultiChildWidget(widgetName)) {
        return unwrapMultiChildWidget(widgetText);
    } else {
        // It's a single-child widget
        return unwrapSingleChildWidget(widgetText);
    }
}

/**
 * Checks if a widget is a multi-child widget
 * @param {string} widgetName The name of the widget
 * @returns {boolean} True if it's a multi-child widget
 */
function isMultiChildWidget(widgetName) {
    const multiChildWidgets = ['Row', 'Column', 'Stack', 'Wrap', 'ListView', 'GridView', 'Flow'];
    return multiChildWidgets.includes(widgetName);
}

/**
 * Unwraps a single-child widget by extracting its child content
 * @param {string} widgetText The complete widget text
 * @returns {string|null} The extracted child content or null
 */
function unwrapSingleChildWidget(widgetText) {
    // We need to locate the "child:" parameter and extract its value
    const childPos = widgetText.indexOf('child:');
    if (childPos === -1) {
        console.log(`No 'child:' parameter found`);
        return null;
    }

    // From the 'child:' position, we need to extract the complete child widget
    let pos = childPos + 6; // Skip 'child:'

    // Skip whitespace
    while (pos < widgetText.length && /\s/.test(widgetText[pos])) pos++;

    // We should now be at the start of the child widget
    if (pos >= widgetText.length) {
        console.log('Reached end of text looking for child');
        return null;
    }

    // Extract the child by tracking brackets and commas
    // This is a critical part to fix
    let depth = 0;
    let childStart = pos;
    let childEnd = widgetText.length - 1;
    let inString = false;
    let stringChar = '';

    for (let i = pos; i < widgetText.length; i++) {
        const char = widgetText[i];

        // Handle string literals
        if ((char === '"' || char === "'") && (i === 0 || widgetText[i - 1] !== '\\')) {
            if (!inString) {
                inString = true;
                stringChar = char;
            } else if (char === stringChar) {
                inString = false;
            }
            continue;
        }

        // Skip contents of strings
        if (inString) continue;

        // Track nesting level
        if (char === '(') {
            depth++;
        } else if (char === ')') {
            depth--;
            // End of widget when we go below starting depth
            if (depth < 0) {
                childEnd = i;
                break;
            }
        } else if (depth === 0 && (char === ',' || char === '}')) {
            // End of parameter at same depth
            childEnd = i;
            break;
        }
    }

    if (childEnd <= childStart) {
        console.log(`Invalid child range: ${childStart} to ${childEnd}`);
        return null;
    }

    // Extract and return the child content
    return widgetText.substring(childStart, childEnd).trim();
}

/**
 * Unwraps a multi-child widget by extracting its children array
 * @param {string} widgetText The complete widget text
 * @returns {string|null} The extracted children content or null
 */
function unwrapMultiChildWidget(widgetText) {
    // For multi-child widgets, we need to find the 'children:' parameter
    const childrenPos = widgetText.indexOf('children:');
    if (childrenPos === -1) {
        console.log(`No 'children:' parameter found`);
        return null;
    }

    // Find the opening bracket of the array
    let pos = childrenPos + 9; // Skip 'children:'
    while (pos < widgetText.length && widgetText[pos] !== '[') pos++;

    if (pos >= widgetText.length) {
        console.log('Reached end of text looking for children array');
        return null;
    }

    // Find the closing bracket of the array with proper nesting
    let depth = 1; // Start at 1 since we're already past the opening '['
    let arrayStart = pos + 1; // Skip the opening '['
    let arrayEnd = widgetText.length - 1;
    let inString = false;
    let stringChar = '';

    for (let i = arrayStart; i < widgetText.length; i++) {
        const char = widgetText[i];

        // Handle string literals
        if ((char === '"' || char === "'") && (i === 0 || widgetText[i - 1] !== '\\')) {
            if (!inString) {
                inString = true;
                stringChar = char;
            } else if (char === stringChar) {
                inString = false;
            }
            continue;
        }

        // Skip contents of strings
        if (inString) continue;

        // Track bracket nesting
        if (char === '[') {
            depth++;
        } else if (char === ']') {
            depth--;
            if (depth === 0) {
                arrayEnd = i;
                break;
            }
        }
    }

    if (arrayEnd <= arrayStart) {
        console.log(`Invalid array range: ${arrayStart} to ${arrayEnd}`);
        return null;
    }

    // Extract the content of the children array
    const childrenContent = widgetText.substring(arrayStart, arrayEnd).trim();

    // If it's empty, return null
    if (!childrenContent) {
        return null;
    }

    // For multi-child widgets, we should join all children or take the first one
    // Here we'll just take the first child as a reasonable compromise
    const firstChildContent = extractFirstChild(childrenContent);
    if (!firstChildContent) {
        return null;
    }

    return firstChildContent + "\n// Note: Other children were removed when unwrapping";
}

/**
 * Extracts the first child from a children array content
 * @param {string} childrenContent The content of the children array
 * @returns {string|null} The first child or null
 */
function extractFirstChild(childrenContent) {
    // Parse the content to extract individual children with proper bracket balancing
    let depth = 0;
    let currentChild = '';
    let inString = false;
    let stringChar = '';

    for (let i = 0; i < childrenContent.length; i++) {
        const char = childrenContent[i];

        // Handle string literals
        if ((char === '"' || char === "'") && (i === 0 || childrenContent[i - 1] !== '\\')) {
            if (!inString) {
                inString = true;
                stringChar = char;
            } else if (char === stringChar) {
                inString = false;
            }
        }

        // Add character to currentChild
        currentChild += char;

        // Track nesting level outside strings
        if (!inString) {
            if (char === '(' || char === '[' || char === '{') {
                depth++;
            } else if (char === ')' || char === ']' || char === '}') {
                depth--;
            } else if (char === ',' && depth === 0) {
                // End of a child at root level
                return currentChild.substring(0, currentChild.length - 1).trim();
            }
        }
    }

    // If we get here, there was only one child
    return currentChild.trim();
}

function deactivate() { }

module.exports = {
    activate,
    deactivate
};