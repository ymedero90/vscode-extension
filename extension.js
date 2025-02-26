const vscode = require('vscode');

const DART_MODE = { language: "dart", scheme: "file" };
const DART_CODE_EXTENSION = "Dart-Code.dart-code";
const FLUTTER_EXTENSION = "Dart-Code.flutter";

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
    console.log('La extensión "wrapping" ahora está activa!');

    // Verificar que las extensiones requeridas estén instaladas
    checkDependencies();

    // Definir los widgets disponibles para envolver
    const widgetWrappers = [
        {
            id: 'wrapping.wrapWithExpanded',
            title: 'Expanded',
            fullTitle: 'Wrap with Expanded',
            snippet: (widget) => `Expanded(\n${getIndentation(widget)}  child: ${widget},\n${getIndentation(widget)})`
        },
        {
            id: 'wrapping.wrapWithContainer',
            title: 'Container',
            fullTitle: 'Wrap with Container',
            snippet: (widget) => `Container(\n${getIndentation(widget)}  child: ${widget},\n${getIndentation(widget)})`
        },
        {
            id: 'wrapping.wrapWithCenter',
            title: 'Center',
            fullTitle: 'Wrap with Center',
            snippet: (widget) => `Center(\n${getIndentation(widget)}  child: ${widget},\n${getIndentation(widget)})`
        },
        {
            id: 'wrapping.wrapWithPadding',
            title: 'Padding',
            fullTitle: 'Wrap with Padding',
            snippet: (widget) => `Padding(\n${getIndentation(widget)}  padding: const EdgeInsets.all(8.0),\n${getIndentation(widget)}  child: ${widget},\n${getIndentation(widget)})`
        },
        {
            id: 'wrapping.wrapWithStack',
            title: 'Stack',
            fullTitle: 'Wrap with Stack',
            snippet: (widget) => `Stack(\n${getIndentation(widget)}  children: [\n${getIndentation(widget)}    ${widget},\n${getIndentation(widget)}  ],\n${getIndentation(widget)})`
        },
        {
            id: 'wrapping.wrapWithFlexible',
            title: 'Flexible',
            fullTitle: 'Wrap with Flexible',
            snippet: (widget) => `Flexible(\n${getIndentation(widget)}  child: ${widget},\n${getIndentation(widget)})`
        }
    ];

    // Registrar comandos para envolver widgets
    registerWidgetWrappers(context, widgetWrappers);

    // Registrar comando para mostrar el menú de widgets
    const showWidgetsMenuCommand = vscode.commands.registerCommand('wrapping.showWidgetsMenu', () => {
        showWidgetsMenu(widgetWrappers);
    });
    context.subscriptions.push(showWidgetsMenuCommand);

    // Registrar proveedor de acciones de código
    context.subscriptions.push(
        vscode.languages.registerCodeActionsProvider(DART_MODE, new CodeActionWrapProvider())
    );
}

/**
 * Verifica que las extensiones de Dart y Flutter estén instaladas
 */
function checkDependencies() {
    const dartExt = vscode.extensions.getExtension(DART_CODE_EXTENSION);
    const flutterExt = vscode.extensions.getExtension(FLUTTER_EXTENSION);

    if (!dartExt) {
        vscode.window.showWarningMessage("La extensión Dart no está instalada. Algunas funcionalidades podrían no funcionar correctamente.");
    }

    if (!flutterExt) {
        vscode.window.showWarningMessage("La extensión Flutter no está instalada. Algunas funcionalidades podrían no funcionar correctamente.");
    }
}

/**
 * Registra los comandos para envolver widgets
 * @param {vscode.ExtensionContext} context 
 * @param {Array} widgetWrappers
 */
function registerWidgetWrappers(context, widgetWrappers) {
    // Registrar cada comando
    for (const wrapper of widgetWrappers) {
        const command = vscode.commands.registerCommand(wrapper.id, () => {
            wrapWidget(wrapper.snippet, `Envolver con ${wrapper.title}`);
        });
        context.subscriptions.push(command);
    }
}

/**
 * Muestra un menú con todas las opciones de wrapping disponibles
 * @param {Array} widgetWrappers Lista de widgets disponibles
 */
async function showWidgetsMenu(widgetWrappers) {
    const items = widgetWrappers.map(wrapper => ({
        label: wrapper.title,
        description: `Envolver con ${wrapper.title}`,
        wrapper: wrapper
    }));

    const selected = await vscode.window.showQuickPick(items, {
        placeHolder: 'Selecciona un widget para envolver',
    });

    if (selected) {
        // Ejecutar el comando seleccionado
        await vscode.commands.executeCommand(selected.wrapper.id);
    }
}

/**
 * Función principal para envolver un widget
 * @param {Function} snippetGenerator Función que genera el snippet con el widget envuelto
 * @param {string} widgetName Nombre del widget para mensajes
 */
function wrapWidget(snippetGenerator, widgetName) {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        vscode.window.showErrorMessage('No hay editor activo');
        return;
    }

    const selection = editor.selection;
    let widgetText;
    let widgetRange;

    // Si hay texto seleccionado, usamos esa selección
    if (!selection.isEmpty) {
        widgetRange = selection;
        widgetText = editor.document.getText(widgetRange);
    } else {
        // Si solo hay un cursor, intentamos detectar el widget completo
        const position = selection.active;
        const result = detectCompleteWidget(editor.document, position);

        if (!result) {
            vscode.window.showErrorMessage('No se pudo detectar un widget en la posición del cursor');
            return;
        }

        widgetRange = result.range;
        widgetText = result.text;
    }

    if (!widgetText || widgetText.trim().length === 0) {
        vscode.window.showErrorMessage('No se encontró un widget para envolver');
        return;
    }

    // Insertar el widget envuelto
    const wrappedWidget = snippetGenerator(widgetText);

    // Reemplazar el texto original con el widget envuelto
    editor.edit(editBuilder => {
        editBuilder.replace(widgetRange, wrappedWidget);
    }).then(success => {
        if (success) {
            vscode.window.showInformationMessage(`Widget envuelto con ${widgetName}`);
            // Intentar formatear el documento después de envolver
            vscode.commands.executeCommand('editor.action.formatDocument');
        } else {
            vscode.window.showErrorMessage('No se pudo envolver el widget');
        }
    });
}

/**
 * Detecta un widget completo Flutter alrededor de la posición dada
 * Mejora basada en el método getSelectedText de la otra extensión
 * @param {vscode.TextDocument} document El documento
 * @param {vscode.Position} position La posición del cursor
 * @returns {Object|null} Un objeto con el rango y texto del widget, o null si no se encuentra
 */
function detectCompleteWidget(document, position) {
    // Si no es un archivo Dart, no hacer nada
    if (document.languageId !== 'dart') {
        return null;
    }

    const line = document.lineAt(position.line);
    const lineText = line.text;

    // Encontrar el inicio del widget
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

    // Buscar el paréntesis de apertura
    const openBracketIndex = lineText.indexOf('(', widgetStartIndex);
    if (openBracketIndex < 0) {
        // No hay paréntesis de apertura, buscar hasta la coma o paréntesis de cierre
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

    // Encontrar el paréntesis de cierre correspondiente
    const openBracketPos = new vscode.Position(line.lineNumber, openBracketIndex);
    const closeBracketPos = findMatchingBracket(document, openBracketPos);

    if (!closeBracketPos) {
        return null;
    }

    // Extraer el widget completo
    const widgetRange = new vscode.Range(line.lineNumber, widgetStartIndex, closeBracketPos.line, closeBracketPos.character + 1);
    const widgetText = document.getText(widgetRange);

    return { range: widgetRange, text: widgetText };
}

/**
 * Encuentra el paréntesis de cierre que coincide con el de apertura en la posición dada
 * @param {vscode.TextDocument} document El documento
 * @param {vscode.Position} position La posición del paréntesis de apertura
 * @returns {vscode.Position|null} La posición del paréntesis de cierre o null si no se encuentra
 */
function findMatchingBracket(document, position) {
    let depth = 1;
    let line = position.line;
    let character = position.character + 1; // Empezamos después del paréntesis de apertura

    while (line < document.lineCount) {
        const lineText = document.lineAt(line).text;

        while (character < lineText.length) {
            const char = lineText.charAt(character);

            if (char === '(') {
                depth++;
            } else if (char === ')') {
                depth--;
                if (depth === 0) {
                    // Encontramos el paréntesis de cierre correspondiente
                    return new vscode.Position(line, character);
                }
            }

            character++;
        }

        // Pasamos a la siguiente línea
        line++;
        character = 0;

        // Límite de seguridad para evitar bucles infinitos
        if (line - position.line > 100) {
            break;
        }
    }

    return null; // No encontramos el paréntesis de cierre
}

/**
 * Obtiene la indentación de un texto
 * @param {string} text El texto del widget
 * @returns {string} La indentación (espacios/tabs)
 */
function getIndentation(text) {
    // Detectar la indentación del widget original
    const match = text.match(/^(\s*)/);
    return match ? match[1] : '';
}

/**
 * Proveedor de acciones de código para envolver widgets
 */
class CodeActionWrapProvider {
    provideCodeActions(document) {
        if (document.languageId !== 'dart') {
            return [];
        }

        const editor = vscode.window.activeTextEditor;
        if (!editor) return [];

        // Solo una acción de código que abre el menú de wrappers
        const action = new vscode.CodeAction('Flutter Wrappers...', vscode.CodeActionKind.RefactorRewrite);
        action.command = {
            command: 'wrapping.showWidgetsMenu',
            title: 'Flutter Wrappers...'
        };

        return [action];
    }
}

function deactivate() { }

module.exports = {
    activate,
    deactivate
}