const vscode = require('vscode');
const path = require('path');

class WidgetTreeProvider {
    constructor() {
        this._onDidChangeTreeData = new vscode.EventEmitter();
        this.onDidChangeTreeData = this._onDidChangeTreeData.event;

        // Track display mode - compact or detailed
        this.compactMode = true;

        // Track max depth for initial expansion
        this.maxInitialDepth = 2;

        // Agregar un estado global para el modo de expansión
        this.forceExpandAll = false;
        this.forceCollapseAll = false;

        // Mantener una caché de elementos para operaciones de expansión/colapso
        this.treeItems = [];

        // Nuevo: Mantener una referencia al TreeView
        this.treeView = null;

        // Nuevo: Mantener un registro de los estados de expansión
        this.expandedItems = new Set();

        // Mejorado: Estado de expansión persistente
        this.expandedNodes = new Set();
        this.lastOperation = null;

        // Watch for active editor changes
        vscode.window.onDidChangeActiveTextEditor(editor => {
            console.log('Active editor changed, refreshing widget tree');
            this.refresh();
        });

        // Watch for document changes
        vscode.workspace.onDidChangeTextDocument(e => {
            if (vscode.window.activeTextEditor &&
                e.document === vscode.window.activeTextEditor.document) {
                console.log('Document changed, refreshing widget tree');
                this.refresh();
            }
        });

        // Initial refresh
        console.log('Widget Tree Provider initialized');
        setTimeout(() => this.refresh(), 1000);

        // Add memory management
        this.maxCachedItems = 1000;
        this.treeItemsCache = new Map();

        // Add cleanup interval
        setInterval(() => this.cleanupCache(), 300000); // Clean every 5 minutes
    }

    // Add cache cleanup method
    cleanupCache() {
        if (this.treeItemsCache.size > this.maxCachedItems) {
            const entriesToRemove = [...this.treeItemsCache.entries()]
                .sort((a, b) => a[1].lastAccessed - b[1].lastAccessed)
                .slice(0, Math.floor(this.maxCachedItems * 0.2)); // Remove oldest 20%

            entriesToRemove.forEach(([key]) => this.treeItemsCache.delete(key));
        }
    }

    refresh() {
        console.log(`Refreshing widget tree view (Expand: ${this.forceExpandAll}, Collapse: ${this.forceCollapseAll})`);
        this._onDidChangeTreeData.fire(undefined);
    }

    getTreeItem(element) {
        return element;
    }

    getChildren(element) {
        if (!element) {
            // Ya no añadimos los controles como elemento del árbol
            return this.getWidgetTreeFromActiveEditor();
        }

        return element.children || [];
    }

    /**
     * Parses the active editor content and builds a widget tree
     */
    getWidgetTreeFromActiveEditor() {
        const editor = vscode.window.activeTextEditor;

        if (!editor) {
            console.log('No active editor found');
            return [this.createMessageItem('Open a Flutter file to view its widget tree')];
        }

        if (editor.document.languageId !== 'dart') {
            console.log('Active document is not a Dart file');
            return [this.createMessageItem('Open a Flutter file to view its widget tree')];
        }

        console.log(`Parsing Dart file: ${editor.document.fileName}`);

        // Get document text
        const text = editor.document.getText();

        // Parse the widget tree
        try {
            const tree = this.parseFlutterWidgetTree(text, editor.document.fileName);

            if (!tree.length) {
                console.log('No widgets detected in this file');
                return [this.createMessageItem('No widgets detected in this file')];
            }

            console.log(`Found ${tree.length} top-level widgets`);
            return tree;
        } catch (error) {
            console.error('Error parsing widget tree:', error);
            return [this.createMessageItem(`Error: ${error.message}`)];
        }
    }

    /**
     * Creates an item that displays a message in the tree
     */
    createMessageItem(message) {
        const item = new vscode.TreeItem(message);
        item.iconPath = new vscode.ThemeIcon('info');
        return item;
    }

    /**
     * Get the collapsible state for a node based on depth and global settings
     * @param {number} depth The depth of the node
     * @returns {vscode.TreeItemCollapsibleState} The collapsible state
     */
    getCollapsibleState(depth) {
        const nodeId = `${this.treeItems[depth]?.metadata?.filePath}${this.treeItems[depth]?.metadata?.line}`;

        if (this.lastOperation === 'expand') {
            return vscode.TreeItemCollapsibleState.Expanded;
        }

        if (this.lastOperation === 'collapse') {
            return vscode.TreeItemCollapsibleState.Collapsed;
        }

        if (this.expandedNodes.has(nodeId)) {
            return vscode.TreeItemCollapsibleState.Expanded;
        }

        return depth <= this.maxInitialDepth
            ? vscode.TreeItemCollapsibleState.Expanded
            : vscode.TreeItemCollapsibleState.Collapsed;
    }

    /**
     * Parse Flutter widget tree from document text
     */
    parseFlutterWidgetTree(text, filePath) {
        try {
            // Add error boundary
            if (!text || !filePath) {
                throw new Error('Invalid input for widget tree parsing');
            }

            // Add performance optimization for large files
            if (text.length > 100000) { // 100KB
                console.warn('Large file detected, using chunked parsing');
                return this.parseFlutterWidgetTreeChunked(text, filePath);
            }

            // Simple regex-based approach to identify widgets
            // This is a simplified approach and won't handle all cases perfectly
            const widgetRegex = /(\s*)(?:(?:return|=>|child:|children:)\s*)?([A-Z][a-zA-Z0-9_]*)(\s*\()/g;
            const widgets = [];
            const lineOffsets = this.getLineOffsets(text);
            const fileName = path.basename(filePath);

            // A stack to keep track of widget nesting
            const widgetStack = [{ depth: -1, children: [] }];
            let match;
            let matchCount = 0;

            // Limpiar la caché de elementos antes de construir el nuevo árbol
            this.treeItems = [];

            while ((match = widgetRegex.exec(text)) !== null) {
                matchCount++;
                const indentation = match[1].length;
                const widgetName = match[2];
                const position = match.index;

                // Calculate the exact widget position - this is crucial for correct navigation
                const widgetNameStart = position + match[1].length + (match[0].indexOf(widgetName) - match[1].length);
                const line = this.getLineFromOffset(lineOffsets, widgetNameStart);

                console.log(`Found potential widget: ${widgetName} at line ${line + 1}, indentation ${indentation}, position: ${widgetNameStart}`);

                // Skip if this doesn't look like a Flutter widget
                if (!this.isLikelyFlutterWidget(widgetName)) {
                    console.log(`Skipping ${widgetName} - doesn't look like a Flutter widget`);
                    continue;
                }

                // Calculate nesting level from indentation or code structure
                const nestingLevel = indentation;

                // Get widget details for enhanced display
                const widgetDetails = this.extractWidgetDetails(text, match.index, widgetName);

                // Pop widgets from the stack if we're moving to a shallower level
                while (widgetStack.length > 1 && widgetStack[widgetStack.length - 1].depth >= nestingLevel) {
                    widgetStack.pop();
                }

                // Determine if this widget should be initially expanded
                const currentDepth = widgetStack.length;

                // Use our new method to get the collapsible state
                const collapsibleState = this.getCollapsibleState(currentDepth);

                // Create a tree item for this widget with compact or detailed display
                const treeItem = this.createWidgetTreeItem(widgetName, line, fileName, filePath, widgetDetails, widgetNameStart);
                treeItem.collapsibleState = collapsibleState;

                // Agregar a nuestra caché de elementos
                this.treeItems.push(treeItem);

                // Add to the parent widget's children
                const parent = widgetStack[widgetStack.length - 1];
                parent.children.push(treeItem);

                // Create a unique id for this item
                const nodeId = filePath + line;
                treeItem.metadata.id = nodeId;

                // Set the parentId to the parent's id (if the parent has one)
                if (widgetStack[widgetStack.length - 1].item?.metadata?.id) {
                    treeItem.metadata.parentId = widgetStack[widgetStack.length - 1].item.metadata.id;
                }

                // Push this widget to the stack
                widgetStack.push({
                    depth: nestingLevel,
                    children: treeItem.children,
                    item: treeItem
                });
            }

            console.log(`Parse complete: Found ${matchCount} potential widgets in the file`);

            // Importante: No resetear las banderas inmediatamente
            // para permitir que VS Code tenga tiempo de aplicar los cambios visuales
            if (!this.forceExpandAll && !this.forceCollapseAll) {
                // Solo resetear en operaciones normales, no en expansión/colapso forzado
                this.maxInitialDepth = 2;  // Restaurar el valor predeterminado
            }

            // Return the top-level widgets
            return widgetStack[0].children;
        } catch (error) {
            console.error('Error parsing widget tree:', error);
            return [this.createMessageItem(`Error parsing widget tree: ${error.message}`)];
        }
    }

    // Add chunked parsing for large files
    parseFlutterWidgetTreeChunked(text, filePath) {
        const chunkSize = 50000; // 50KB chunks
        const chunks = [];

        for (let i = 0; i < text.length; i += chunkSize) {
            chunks.push(text.slice(i, i + chunkSize));
        }

        const widgets = [];
        chunks.forEach((chunk, index) => {
            const partialWidgets = this.parseChunk(chunk, index * chunkSize, filePath);
            widgets.push(...partialWidgets);
        });

        return this.mergeWidgets(widgets);
    }

    parseChunk(chunk, offset, filePath) {
        // Similar to parseFlutterWidgetTree but for a chunk
        // ...implementation...
        return [];
    }

    mergeWidgets(widgets) {
        // Merge widgets from different chunks
        // ...implementation...
        return widgets;
    }

    /**
     * Create a tree item for a widget with appropriate formatting
     */
    createWidgetTreeItem(widgetName, line, fileName, filePath, details, widgetOffset) {
        // Format the label based on mode
        let label = widgetName;
        let description = `Line ${line + 1}`;

        if (!this.compactMode && details) {
            // In detailed mode, show more info
            if (details.key) {
                label = `${widgetName} (key: ${details.key})`;
            }

            if (details.props) {
                // Show key properties in the description
                description = details.props;
            }
        }

        const treeItem = new vscode.TreeItem(label);
        treeItem.description = description;
        treeItem.tooltip = this.formatWidgetTooltip(widgetName, fileName, line, details);
        treeItem.iconPath = this.getWidgetIcon(widgetName);
        // Set contextValue for context menu enablement
        treeItem.contextValue = 'widget';

        // Store metadata for remove/wrap operations
        treeItem.metadata = {
            widgetName,
            line,
            fileName,
            filePath,
            details,
            widgetOffset: widgetOffset // Store the exact character offset
        };

        // This is the crucial part - make sure we navigate to the exact widget position
        const widgetStartPos = new vscode.Position(line, 0);
        const lineText = vscode.window.activeTextEditor?.document.lineAt(line).text || '';
        const widgetNameInLine = lineText.indexOf(widgetName);

        // Calculate the character position of the widget name in the line
        const charPosition = widgetNameInLine >= 0 ? widgetNameInLine : 0;

        treeItem.command = {
            command: 'vscode.open',
            arguments: [
                vscode.Uri.file(filePath),
                {
                    selection: new vscode.Range(
                        new vscode.Position(line, charPosition),
                        new vscode.Position(line, charPosition + widgetName.length)
                    )
                }
            ],
            title: 'Go to widget'
        };
        treeItem.children = [];

        // Determinar estado de expansión basado en nuestro registro
        const nodeId = filePath + line;
        const hasChildren = this.treeItems.some(item =>
            item.metadata?.parentId === nodeId
        );

        if (hasChildren) {
            treeItem.collapsibleState = this.getCollapsibleState(this.treeItems.length);
        } else {
            treeItem.collapsibleState = vscode.TreeItemCollapsibleState.None;
        }

        return treeItem;
    }

    /**
     * Format a detailed tooltip for the widget
     */
    formatWidgetTooltip(widgetName, fileName, line, details) {
        let tooltip = `${widgetName} (${fileName}:${line + 1})`;

        if (details) {
            if (details.props) {
                tooltip += `\n\nProperties:\n${details.props}`;
            }
            if (details.key) {
                tooltip += `\nKey: ${details.key}`;
            }
        }

        return tooltip;
    }

    /**
     * Extract detailed information about a widget
     */
    extractWidgetDetails(text, position, widgetName) {
        try {
            // Find opening parenthesis after widget name
            const widgetStartPos = position + widgetName.length;
            const nextSectionEnd = text.indexOf(')', position + widgetName.length + 1);

            if (nextSectionEnd === -1) return null;

            // Extract the constructor parameters section
            const constructorSection = text.substring(widgetStartPos, nextSectionEnd + 1);

            // Extract key property if present
            const keyMatch = constructorSection.match(/key:[\s\n]*([^,}\n]+)/);
            const key = keyMatch ? keyMatch[1].trim() : null;

            // Extract some common properties for different widget types
            let props = this.extractCommonProperties(constructorSection, widgetName);

            return { key, props };
        } catch (error) {
            console.warn(`Failed to extract details for widget ${widgetName}:`, error);
            return { key: null, props: 'Error extracting properties' };
        }
    }

    /**
     * Extract common properties for specific widget types
     */
    extractCommonProperties(constructorSection, widgetName) {
        let props = '';

        switch (widgetName) {
            case 'Container':
                // Extract width, height, color
                const widthMatch = constructorSection.match(/width:[\s\n]*([^,}\n]+)/);
                const heightMatch = constructorSection.match(/height:[\s\n]*([^,}\n]+)/);
                const colorMatch = constructorSection.match(/color:[\s\n]*([^,}\n]+)/);  // Define colorMatch

                if (widthMatch) props += `w:${widthMatch[1].trim()} `;
                if (heightMatch) props += `h:${heightMatch[1].trim()} `;
                if (colorMatch) props += `color:${colorMatch[1].trim()}`;
                break;

            case 'Text':
                // Extract the text content
                const textMatch = constructorSection.match(/['"]([^'"]*)['"]/);
                if (textMatch) props = `"${textMatch[1].substring(0, 20)}${textMatch[1].length > 20 ? '...' : ''}"`;
                break;

            case 'Padding':
                const paddingMatch = constructorSection.match(/padding:[\s\n]*([^,}\n]+)/);
                if (paddingMatch) props = paddingMatch[1].trim();
                break;

            // Add more widget-specific extractors as needed
        }

        return props;
    }

    /**
     * Get an appropriate icon for a widget type
     */
    getWidgetIcon(widgetName) {
        // Map common widget types to appropriate VS Code icons
        const iconMap = {
            'Container': 'symbol-namespace',
            'Row': 'symbol-array',
            'Column': 'symbol-array',
            'Stack': 'layers',
            'Text': 'symbol-string',
            'Padding': 'layout',
            'SizedBox': 'symbol-ruler',
            'Expanded': 'expand-all',
            'Flexible': 'symbol-value',
            'Center': 'symbol-enum',
            'ListView': 'list-ordered',
            'GridView': 'layout-grid',
            'Card': 'notebook',
            'InkWell': 'symbol-event',
            'GestureDetector': 'symbol-event',
        };

        return new vscode.ThemeIcon(iconMap[widgetName] || 'symbol-class');
    }

    /**
     * Toggle between compact and detailed view modes
     */
    toggleViewMode() {
        this.compactMode = !this.compactMode;
        this.refresh();
        return this.compactMode;
    }

    /**
     * Set the maximum initial depth for expansion
     */
    setMaxInitialDepth(depth) {
        this.maxInitialDepth = depth;

        // Hacer un refresh completo del árbol
        this._onDidChangeTreeData.fire(undefined);
    }

    /**
     * Expande todos los nodos del árbol
     */
    async expandAll() {
        console.log('Expanding all nodes...');
        this.lastOperation = 'expand';
        this.expandedNodes.clear(); // Reiniciar el estado

        // Forzar estado expandido para cada ítem
        this.treeItems.forEach(item => {
            this.expandedNodes.add(item.metadata?.filePath + item.metadata?.line);
        });

        // Notificar cambios
        this._onDidChangeTreeData.fire();

        // Esperar un momento y refrescar de nuevo para asegurar la expansión
        await new Promise(resolve => setTimeout(resolve, 100));
        this._onDidChangeTreeData.fire();
    }

    /**
     * Colapsa todos los nodos del árbol
     */
    async collapseAll() {
        console.log('Collapsing all nodes...');
        this.lastOperation = 'collapse';
        this.expandedNodes.clear();

        // Notificar cambios
        this._onDidChangeTreeData.fire();

        // Esperar un momento y refrescar de nuevo para asegurar el colapso
        await new Promise(resolve => setTimeout(resolve, 100));
        this._onDidChangeTreeData.fire();
    }

    /**
     * Técnica para abrir un nodo del árbol simulando navegación al archivo
     */
    async abrirNodoDelÁrbol(item) {
        if (item.metadata?.filePath) {
            // Conseguir que VS Code expanda el nodo usando un truco:
            // 1. Abrir el archivo en el editor
            const document = await vscode.workspace.openTextDocument(item.metadata.filePath);
            const editor = await vscode.window.showTextDocument(document, { preserveFocus: true, preview: false });

            // 2. Mover el cursor a la línea del widget (esto hace que VS Code expanda el nodo en el árbol)
            editor.selection = new vscode.Selection(
                new vscode.Position(item.metadata.line, 0),
                new vscode.Position(item.metadata.line, 0)
            );

            // 3. Volver a posicionar la vista en el árbol
            await vscode.commands.executeCommand('workbench.view.extension.flutter-wrappers');
            await vscode.commands.executeCommand('flutterWidgetTree.focus');
        }
    }

    /**
     * Desplaza la vista hacia la parte superior del árbol
     * Útil después de expandir todos los nodos
     */
    scrollToTop() {
        try {
            // Si hay elementos en la raíz, revelar el primero llevará
            // la vista a la parte superior
            const rootItems = this.getChildren();
            if (rootItems && rootItems.length > 0) {
                // Intentar revelar el primer elemento, lo que debería posicionar
                // la vista en la parte superior
                vscode.commands.executeCommand('list.scrollTop');
            }
        } catch (error) {
            console.error("Error al intentar desplazar a la parte superior:", error);
        }
    }

    /**
     * Check if a name looks like a Flutter widget
     */
    isLikelyFlutterWidget(name) {
        const commonWidgets = [
            'Container', 'Row', 'Column', 'Stack', 'Expanded', 'Flexible', 'Text',
            'Padding', 'Center', 'SizedBox', 'Card', 'Align', 'AspectRatio',
            'Icon', 'Image', 'Material', 'Scaffold', 'AppBar', 'TabBar', 'Drawer',
            'FloatingActionButton', 'InkWell', 'GestureDetector', 'ListView', 'GridView',
            'Builder', 'FutureBuilder', 'StreamBuilder', 'Scrollbar', 'TextFormField',
            'Form', 'Navigator'
        ];

        if (commonWidgets.includes(name)) {
            return true;
        }

        // Check naming pattern (starts with capital letter)
        return /^[A-Z][a-zA-Z0-9_]*$/.test(name);
    }

    /**
     * Get character offset for the start of each line
     */
    getLineOffsets(text) {
        const offsets = [0];
        for (let i = 0; i < text.length; i++) {
            if (text[i] === '\n') {
                offsets.push(i + 1);
            }
        }
        return offsets;
    }

    /**
     * Convert character offset to line number
     */
    getLineFromOffset(lineOffsets, offset) {
        let low = 0;
        let high = lineOffsets.length - 1;

        while (low <= high) {
            const mid = Math.floor((low + high) / 2);
            if (lineOffsets[mid] > offset) {
                high = mid - 1;
            } else {
                low = mid + 1;
            }
        }

        return Math.max(0, low - 1);
    }

    /**
     * Establece la referencia al TreeView
     * @param {vscode.TreeView} treeView 
     */
    setTreeView(treeView) {
        this.treeView = treeView;
    }

    /**
     * Get the parent of an element
     * @param {any} element - The element to get the parent for
     * @returns {any} The parent element
     */
    getParent(element) {
        // Buscar el elemento padre usando el árbol de elementos
        for (const item of this.treeItems) {
            if (item.children && item.children.includes(element)) {
                return item;
            }
        }
        return null;
    }

    // Add dispose method for cleanup
    dispose() {
        this.treeItemsCache.clear();
        this._onDidChangeTreeData.dispose();
    }
}

module.exports = { WidgetTreeProvider };
