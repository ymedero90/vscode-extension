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
    }

    refresh() {
        console.log('Refreshing widget tree view');
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element) {
        return element;
    }

    getChildren(element) {
        if (!element) {
            // Add mode toggle and controls as synthetic items
            const widgetsFromEditor = this.getWidgetTreeFromActiveEditor();

            // If we have widgets, prepend controls
            if (widgetsFromEditor.length > 0 && !(widgetsFromEditor[0] instanceof vscode.TreeItem && widgetsFromEditor[0].contextValue === 'message')) {
                return [
                    this.createControlItem(),
                    ...widgetsFromEditor
                ];
            }

            return widgetsFromEditor;
        }

        // Special handling for control items
        if (element.contextValue === 'controls') {
            return element.children || [];
        }

        return element.children || [];
    }

    /**
     * Creates a control panel item for the tree view
     */
    createControlItem() {
        const item = new vscode.TreeItem('Widget Tree Controls', vscode.TreeItemCollapsibleState.Collapsed);
        item.contextValue = 'controls';
        item.iconPath = new vscode.ThemeIcon('gear');
        item.tooltip = 'Expand to access widget tree controls';

        // Create child items for the controls
        const toggleModeItem = new vscode.TreeItem(
            this.compactMode ? 'Switch to Detailed View' : 'Switch to Compact View'
        );
        toggleModeItem.command = {
            command: 'flutterWrappers.widgetTree.toggleViewMode',
            title: 'Toggle View Mode'
        };
        toggleModeItem.contextValue = 'control';
        toggleModeItem.iconPath = new vscode.ThemeIcon('list-tree');

        const expandAllItem = new vscode.TreeItem('Expand All');
        expandAllItem.command = {
            command: 'flutterWrappers.widgetTree.expandAll',
            title: 'Expand All'
        };
        expandAllItem.contextValue = 'control';
        expandAllItem.iconPath = new vscode.ThemeIcon('expand-all');

        const collapseAllItem = new vscode.TreeItem('Collapse All');
        collapseAllItem.command = {
            command: 'flutterWrappers.widgetTree.collapseAll',
            title: 'Collapse All'
        };
        collapseAllItem.contextValue = 'control';
        collapseAllItem.iconPath = new vscode.ThemeIcon('collapse-all');

        item.children = [toggleModeItem, expandAllItem, collapseAllItem];
        return item;
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
     * Parse Flutter widget tree from document text
     */
    parseFlutterWidgetTree(text, filePath) {
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
            const shouldExpand = currentDepth <= this.maxInitialDepth;

            // Create a tree item for this widget with compact or detailed display
            const treeItem = this.createWidgetTreeItem(widgetName, line, fileName, filePath, widgetDetails, widgetNameStart);
            treeItem.collapsibleState = shouldExpand
                ? vscode.TreeItemCollapsibleState.Expanded
                : vscode.TreeItemCollapsibleState.Collapsed;

            // Add to the parent widget's children
            const parent = widgetStack[widgetStack.length - 1];
            parent.children.push(treeItem);

            // Push this widget to the stack
            widgetStack.push({
                depth: nestingLevel,
                children: treeItem.children
            });
        }

        console.log(`Parse complete: Found ${matchCount} potential widgets in the file`);

        // Return the top-level widgets
        return widgetStack[0].children;
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
                const colorMatch = constructorSection.match(/color:[\s\n]*([^,}\n]+)/);

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
        this.refresh();
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
}

module.exports = { WidgetTreeProvider };
