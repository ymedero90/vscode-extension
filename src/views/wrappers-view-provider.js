const vscode = require('vscode');

class WrappersViewProvider {
    constructor(widgetWrappers, context) {
        this.widgetWrappers = widgetWrappers;
        this.context = context;
        this._onDidChangeTreeData = new vscode.EventEmitter();
        this.onDidChangeTreeData = this._onDidChangeTreeData.event;

        // Get widget registry
        const registry = require('../wrappers/widget-registry');
        this.getEnabledWidgets = registry.getEnabledWidgets;
        this.getAllWidgetCategories = registry.getAllWidgetCategories;
    }

    refresh() {
        this._onDidChangeTreeData.fire(undefined);
    }

    getTreeItem(element) {
        // Handle category items
        if (element.isCategory) {
            const categoryItem = new vscode.TreeItem(
                element.name,
                vscode.TreeItemCollapsibleState.Expanded
            );

            categoryItem.contextValue = 'category';
            categoryItem.iconPath = new vscode.ThemeIcon('folder');
            categoryItem.id = `category_${element.id}`;

            return categoryItem;
        }

        // Handle wrapper items
        const treeItem = new vscode.TreeItem(
            element.title,
            vscode.TreeItemCollapsibleState.None
        );

        treeItem.tooltip = element.fullTitle;
        treeItem.id = element.id;
        treeItem.contextValue = 'wrapperItem';

        // Command to execute when clicked
        treeItem.command = {
            title: "Execute wrapper",
            command: element.id,
            arguments: []
        };

        return treeItem;
    }

    getChildren(element) {
        if (!element) {
            // Root level - return categories that have enabled wrappers
            const enabledWrappers = this.getEnabledWidgets();
            const categories = this.getAllWidgetCategories();

            return categories
                .map(category => {
                    // Check if category has any enabled wrappers
                    const enabledCategoryWrappers = enabledWrappers.filter(
                        w => w.category === category.id
                    );

                    if (enabledCategoryWrappers.length > 0) {
                        return {
                            ...category,
                            isCategory: true,
                            enabledWrappers: enabledCategoryWrappers
                        };
                    }
                    return null;
                })
                .filter(Boolean); // Remove null entries
        }

        // If element is a category, return its enabled wrappers
        if (element.isCategory) {
            return element.enabledWrappers || [];
        }

        return [];
    }

    getParent(element) {
        if (!element || element.isCategory) {
            return null;
        }

        // Find parent category
        const categories = this.getAllWidgetCategories();
        const category = categories.find(cat =>
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
