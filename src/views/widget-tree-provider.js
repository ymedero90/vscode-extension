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

        // Track the current editor positions to sync with tree 
        this.editorCursorListeners = [];

        // Watch for cursor position changes - fix by using a more direct approach
        this.registerCursorPositionListener();

        // Fix: Add a direct event listener for cursor movements that's more reliable
        vscode.window.onDidChangeActiveTextEditor(editor => {
            if (editor) {
                this.syncEditorWithTree(editor);
            }
        });
        
        // Flag to track if we're currently processing a sync (prevent loops)
        this.isSyncing = false;
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
        
        // Force a complete refresh by not passing any element
        this._onDidChangeTreeData.fire(undefined);
        
        // Reset expansion flags after a short delay to prevent them from affecting
        // subsequent refreshes unintentionally
        if (this.forceExpandAll || this.forceCollapseAll || this.lastOperation) {
            setTimeout(() => {
                if (this.lastOperation === 'expand') {
                    // Keep expanded nodes in state
                } else if (this.lastOperation === 'collapse') {
                    // Keep collapsed state
                } else {
                    // Reset if it's a normal refresh
                    this.forceExpandAll = false;
                    this.forceCollapseAll = false;
                }
            }, 300);
        }
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
    getCollapsibleState(depth, item) {
        // Enhanced logging for deeper debugging on specific items
        if (item && item.metadata && (this.forceExpandAll || this.forceCollapseAll)) {
            const nodeId = item && item.metadata ? 
                `${item.metadata.filePath}${item.metadata.line}` : 'unknown';
            
            console.log(`[Tree] State for ${item.metadata.widgetName} (${nodeId}): ` + 
                        `expand=${this.forceExpandAll}, collapse=${this.forceCollapseAll}, ` +
                        `in expandedNodes=${this.expandedNodes.has(nodeId)}`);
        }
        
        // Always prioritize expansion during expandAll operation
        if (this.forceExpandAll) {
            console.log(`[Tree] Forcing EXPANDED state for item`);
            return vscode.TreeItemCollapsibleState.Expanded;
        }
        
        // Force collapse has second highest priority
        if (this.forceCollapseAll) {
            return vscode.TreeItemCollapsibleState.Collapsed;
        }
        
        // Use item-specific node ID if available
        const nodeId = item && item.metadata ? 
            `${item.metadata.filePath}${item.metadata.line}` : 
            `${this.treeItems[depth]?.metadata?.filePath}${this.treeItems[depth]?.metadata?.line}`;

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

                // Create a tree item for this widget with compact or detailed display
                const treeItem = this.createWidgetTreeItem(widgetName, line, fileName, filePath, widgetDetails, widgetNameStart);
                
                // During forced expand state, always set to expanded directly
                if (this.forceExpandAll) {
                    treeItem.collapsibleState = vscode.TreeItemCollapsibleState.Expanded;
                } else {
                    // Pass the actual item to getCollapsibleState for more accurate state determination
                    treeItem.collapsibleState = this.getCollapsibleState(currentDepth, treeItem);
                }

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

        // Determinar estado de expansión basado en nuestro registro y los flags forzados
        const nodeId = filePath + line;
        const hasChildren = this.treeItems.some(item =>
            item.metadata?.parentId === nodeId
        );

        // Make sure collapsible state is applied directly based on our forced settings
        if (this.forceExpandAll && treeItem.children && treeItem.children.length > 0) {
            treeItem.collapsibleState = vscode.TreeItemCollapsibleState.Expanded;
        } else if (this.forceCollapseAll && treeItem.children && treeItem.children.length > 0) {
            treeItem.collapsibleState = vscode.TreeItemCollapsibleState.Collapsed;
        } else if (hasChildren) {
            // Pass the actual item to getCollapsibleState
            treeItem.collapsibleState = this.getCollapsibleState(this.treeItems.length, treeItem);
        } else {
            treeItem.collapsibleState = vscode.TreeItemCollapsibleState.None;
        }

        // Enhanced tooltip with horizontal scrolling hint
        let tooltip = this.formatWidgetTooltip(widgetName, fileName, line, details);
        tooltip += "\n\nTip: Hover at tree edges to reveal horizontal scrolling";
        treeItem.tooltip = tooltip;

        // Add more details to the label for better horizontal content
        if (this.compactMode && details && details.props) {
            // Add some key properties to make horizontal scrolling more useful
            const shortProps = details.props.substring(0, 20) + (details.props.length > 20 ? '...' : '');
            treeItem.description = `${treeItem.description} - ${shortProps}`;
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
     * Expande todos los nodos del árbol - COMPLETELY REWRITTEN FOR RELIABILITY
     */
    async expandAll() {
        console.log('[Widget Tree] Expanding all nodes - SIMPLIFIED VERSION');
        
        try {
            // Clear tracking state and set flags
            this.lastOperation = 'expand';
            this.forceExpandAll = true;
            this.forceCollapseAll = false;
            
            // Simplified approach: pre-mark all possible nodes as expanded
            this.expandedNodes.clear();
            this.treeItems.forEach(item => {
                if (item.metadata?.id) {
                    this.expandedNodes.add(item.metadata.id);
                }
            });
            
            // Force the tree to refresh with new expansion state
            this._onDidChangeTreeData.fire();
            
            // Give time for the UI to update
            await new Promise(resolve => setTimeout(resolve, 100));
            
            // Use VS Code's built-in command as a backup
            try {
                await vscode.commands.executeCommand('list.expandAll');
            } catch (err) {
                console.log('[Widget Tree] Native expand all command failed, using fallback', err);
                
                // If that fails, try revealing root items with expand option
                if (this.treeView) {
                    const rootItems = await this.getChildren();
                    if (rootItems && rootItems.length > 0) {
                        for (const rootItem of rootItems) {
                            await this.treeView.reveal(rootItem, { expand: true });
                            // Short delay between reveals to avoid UI freezes
                            await new Promise(r => setTimeout(r, 10));
                        }
                    }
                }
            }
            
            // Send a final refresh to ensure UI is up to date
            this._onDidChangeTreeData.fire();
        } catch (error) {
            console.error('[Widget Tree] Error in expandAll:', error);
            // Reset flags in case of error
            this.forceExpandAll = false;
        }
    }

    /**
     * Colapsa todos los nodos del árbol
     */
    async collapseAll() {
        console.log('Collapsing all nodes - OPTIMIZED VERSION');
        
        // Set states
        this.lastOperation = 'collapse';
        this.forceExpandAll = false;
        this.forceCollapseAll = true;
        this.expandedNodes.clear();
        
        // Single refresh
        this._onDidChangeTreeData.fire();
        
        try {
            // Execute VS Code's command
            if (this.treeView) {
                await vscode.commands.executeCommand('list.collapseAll');
            }
        } catch (err) {
            console.log('Could not use list.collapseAll command');
        }
        
        // Reset the flags after operation completes
        setTimeout(() => {
            this.forceCollapseAll = false;
        }, 300);
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
        
        // Add reveal listener to track expanded state
        if (treeView) {
            // Track when nodes are expanded or collapsed by user
            treeView.onDidExpandElement(e => {
                if (e.element.metadata?.id) {
                    // Add to our expanded nodes set
                    this.expandedNodes.add(e.element.metadata.id);
                    console.log(`[Tree] User expanded: ${e.element.metadata.widgetName}`);
                }
            });
            
            treeView.onDidCollapseElement(e => {
                if (e.element.metadata?.id) {
                    // Remove from our expanded nodes set
                    this.expandedNodes.delete(e.element.metadata.id);
                    console.log(`[Tree] User collapsed: ${e.element.metadata.widgetName}`);
                }
            });
        }
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
        this.editorCursorListeners.forEach(d => d.dispose());
    }

    /**
     * Debug helper to log the tree state
     */
    logTreeState() {
        console.log('--- TREE STATE DEBUG ---');
        console.log('forceExpandAll:', this.forceExpandAll);
        console.log('forceCollapseAll:', this.forceCollapseAll);
        console.log('lastOperation:', this.lastOperation);
        console.log('expandedNodes count:', this.expandedNodes.size);
        console.log('Tree items count:', this.treeItems.length);
        
        // Sample of expansion states
        if (this.treeItems.length > 0) {
            console.log('First 3 items expansion states:');
            this.treeItems.slice(0, 3).forEach(item => {
                console.log(`- ${item.metadata?.widgetName}: ${
                    item.collapsibleState === 1 ? 'Expanded' :
                    item.collapsibleState === 2 ? 'Collapsed' : 'None'
                }`);
            });
        }
        console.log('----------------------');
    }

    /**
     * Register a listener for cursor position changes in the editor - FIXED
     */
    registerCursorPositionListener() {
        // Dispose any existing listeners
        this.editorCursorListeners.forEach(d => d.dispose());
        this.editorCursorListeners = [];

        console.log('[Widget Tree] Registering cursor position listener');
        
        // Watch for selection changes in the editor with improved reliability
        const selectionListener = vscode.window.onDidChangeTextEditorSelection(event => {
            if (!this.isSyncing && event.textEditor === vscode.window.activeTextEditor) {
                // Use throttling instead of debouncing for more responsive updates
                clearTimeout(this.cursorSyncTimeout);
                this.cursorSyncTimeout = setTimeout(() => {
                    try {
                        console.log('[Widget Tree] Cursor position changed, syncing tree');
                        this.syncCursorPositionWithTree(event.textEditor);
                    } catch (error) {
                        console.error('[Widget Tree] Error syncing with cursor:', error);
                    }
                }, 200); // Slightly faster throttle time
            }
        });

        this.editorCursorListeners.push(selectionListener);
    }

    /**
     * Synchronize the editor cursor position with the tree view - FIXED
     * @param {vscode.TextEditor} editor The active text editor
     */
    async syncCursorPositionWithTree(editor) {
        if (!this.treeView || !editor || !this.treeItems || this.treeItems.length === 0) {
            console.log('[Widget Tree] Cannot sync: Missing tree view, editor, or tree items');
            return;
        }

        try {
            // Set syncing flag to prevent recursive calls
            this.isSyncing = true;
            
            const cursorLine = editor.selection.active.line;
            const filePath = editor.document.uri.fsPath;
            
            console.log(`[Widget Tree] Syncing cursor at line ${cursorLine} in ${path.basename(filePath)}`);
            
            // Find the closest widget to the cursor position with improved debug logging
            const closestWidget = this.findClosestWidgetToCursor(cursorLine, filePath);
            
            if (closestWidget) {
                console.log(`[Widget Tree] Found widget: ${closestWidget.metadata?.widgetName} at line ${closestWidget.metadata?.line}`);
                
                // Make sure parent nodes are expanded
                await this.ensureParentNodesExpanded(closestWidget);
                
                // Reveal the item in the tree - use a direct reveal with less options for reliability
                if (this.treeView.visible) {
                    await this.treeView.reveal(closestWidget, {
                        select: true,
                        focus: false
                    });
                    console.log('[Widget Tree] Item revealed in tree');
                } else {
                    console.log('[Widget Tree] Tree view not visible, skipping reveal');
                }
            } else {
                console.log('[Widget Tree] No matching widget found for current cursor position');
            }
        } catch (error) {
            console.error('[Widget Tree] Error syncing cursor with tree:', error);
        } finally {
            // Reset syncing flag
            this.isSyncing = false;
        }
    }

    /**
     * Find the closest widget in the tree to the current cursor position - FIXED
     */
    findClosestWidgetToCursor(cursorLine, filePath) {
        if (!this.treeItems || this.treeItems.length === 0) {
            console.log('[Widget Tree] No tree items available');
            return null;
        }

        // Debug info
        console.log(`[Widget Tree] Finding widget near line ${cursorLine} in ${path.basename(filePath)}`);
        console.log(`[Widget Tree] Total tree items: ${this.treeItems.length}`);

        // Filter items from the same file
        const fileItems = this.treeItems.filter(item => 
            item.metadata?.filePath === filePath);
        
        console.log(`[Widget Tree] Found ${fileItems.length} items from the same file`);
        
        if (!fileItems.length) {
            return null;
        }
        
        // First try: exact match
        let match = fileItems.find(item => item.metadata.line === cursorLine);
        
        if (match) {
            console.log(`[Widget Tree] Found exact match: ${match.metadata.widgetName}`);
            return match;
        }
        
        // Second try: find nearest item above cursor (preferred)
        let closestItem = null;
        let minDistance = Number.MAX_VALUE;
        
        for (const item of fileItems) {
            // Prefer items that are before the cursor
            if (item.metadata.line <= cursorLine) {
                const distance = cursorLine - item.metadata.line;
                if (distance < minDistance) {
                    minDistance = distance;
                    closestItem = item;
                }
            }
        }
        
        // If found an item above cursor
        if (closestItem) {
            console.log(`[Widget Tree] Found closest widget above: ${closestItem.metadata.widgetName} (${minDistance} lines away)`);
            return closestItem;
        }
        
        // If nothing found above, take the nearest item
        minDistance = Number.MAX_VALUE;
        for (const item of fileItems) {
            const distance = Math.abs(item.metadata.line - cursorLine);
            if (distance < minDistance) {
                minDistance = distance;
                closestItem = item;
            }
        }
        
        if (closestItem) {
            console.log(`[Widget Tree] Found nearest widget: ${closestItem.metadata.widgetName} (${minDistance} lines away)`);
        } else {
            console.log('[Widget Tree] No suitable widget found');
        }
        
        return closestItem;
    }

    /**
     * Ensure that all parent nodes of an item are expanded - FIXED
     */
    async ensureParentNodesExpanded(item) {
        if (!item || !item.metadata) {
            return;
        }
        
        try {
            // Track all parent IDs that need to be expanded
            const parentsToExpand = [];
            let currentParentId = item.metadata.parentId;
            
            // Collect all parent IDs
            while (currentParentId) {
                parentsToExpand.push(currentParentId);
                
                // Find the parent item
                const parentItem = this.treeItems.find(i => i.metadata?.id === currentParentId);
                if (!parentItem) break;
                
                // Move up to the next parent
                currentParentId = parentItem.metadata.parentId;
            }
            
            if (parentsToExpand.length > 0) {
                console.log(`[Widget Tree] Expanding ${parentsToExpand.length} parent nodes`);
                
                // Add all parents to expanded nodes set
                parentsToExpand.forEach(id => {
                    this.expandedNodes.add(id);
                });
                
                // Refresh to apply expanded states
                this._onDidChangeTreeData.fire();
                
                // Short delay to let the UI catch up
                await new Promise(resolve => setTimeout(resolve, 50));
            }
        } catch (error) {
            console.error('[Widget Tree] Error ensuring parents expanded:', error);
        }
    }

    /**
     * Helper to directly sync an editor with the tree without waiting for cursor events
     */
    syncEditorWithTree(editor) {
        if (!editor) return;
        
        // Small delay to let any document load
        setTimeout(() => {
            // Only sync if not already syncing and editor still active
            if (!this.isSyncing && editor === vscode.window.activeTextEditor) {
                this.syncCursorPositionWithTree(editor);
            }
        }, 300);
    }

    /**
     * Scroll to a specific item in the tree
     * @param {vscode.TreeItem} item The item to scroll to
     */
    async scrollToItem(item) {
        if (!this.treeView || !item) return;
        
        try {
            await this.treeView.reveal(item, { 
                select: true,
                focus: false
            });
        } catch (error) {
            console.error('Error scrolling to item:', error);
        }
    }

    // Add method to scroll to an item by line number and file path
    async scrollToPosition(filePath, line) {
        const item = this.findClosestWidgetToCursor(line, filePath);
        if (item) {
            await this.ensureParentNodesExpanded(item);
            await this.scrollToItem(item);
        }
    }
}

module.exports = { WidgetTreeProvider };
