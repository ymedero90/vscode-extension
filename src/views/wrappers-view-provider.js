const vscode = require('vscode');

class WrappersViewProvider {
    constructor(widgetWrappers, context) {
        this.widgetWrappers = widgetWrappers;
        this.context = context;
        this._onDidChangeTreeData = new vscode.EventEmitter();
        this.onDidChangeTreeData = this._onDidChangeTreeData.event;
        
        // Get categories from the wrapper registry
        this.categories = require('../wrappers/widget-registry').getAllWidgetCategories();
    }

    refresh() {
        this._onDidChangeTreeData.fire(undefined);
    }

    getTreeItem(element) {
        // Handle category items
        if (element.isCategory) {
            const categoryItem = new vscode.TreeItem(
                element.name,
                element.wrappers && element.wrappers.length > 0
                    ? vscode.TreeItemCollapsibleState.Expanded
                    : vscode.TreeItemCollapsibleState.None
            );
            
            categoryItem.contextValue = 'category';
            categoryItem.iconPath = new vscode.ThemeIcon('package');
            categoryItem.id = `category_${element.id}`;
            
            return categoryItem;
        }
        
        // Handle wrapper items
        const treeItem = new vscode.TreeItem(
            element.title,
            vscode.TreeItemCollapsibleState.None
        );

        // Set tooltip including status
        treeItem.tooltip = `${element.fullTitle} (${element.enabled ? 'Enabled' : 'Disabled'})`;

        // Keep the description
        treeItem.description = element.enabled ? "Enabled" : "Disabled";

        // Store properties needed for command access
        treeItem.id = element.id;
        treeItem.title = element.title;
        treeItem.contextValue = 'wrapper';

        // Use check for enabled and x-symbol for disabled
        treeItem.iconPath = new vscode.ThemeIcon(element.enabled ? 'check' : 'x');

        // Add command for toggling when clicked
        treeItem.command = {
            title: "Toggle wrapper state",
            command: "flutterWrappers.toggleWrapperState",
            arguments: [element]
        };

        return treeItem;
    }

    getChildren(element) {
        // Root level - return categories
        if (!element) {
            return this.categories.map(category => ({
                ...category,
                isCategory: true
            }));
        }
        
        // If element is a category, return its wrappers
        if (element.isCategory) {
            return element.wrappers;
        }
        
        // No children for wrapper items
        return [];
    }

    getParent(element) {
        if (!element || element.isCategory) {
            return null;
        }
        
        // Find parent category for this wrapper
        const category = this.categories.find(cat => 
            cat.wrappers.some(wrapper => wrapper.id === element.id)
        );
        
        if (category) {
            return {
                ...category,
                isCategory: true
            };
        }
        
        return null;
    }
}

module.exports = { WrappersViewProvider };
