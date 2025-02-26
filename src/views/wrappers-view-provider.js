const vscode = require('vscode');

class WrappersViewProvider {
    constructor(widgetWrappers) {
        this.widgetWrappers = widgetWrappers;
        this._onDidChangeTreeData = new vscode.EventEmitter();
        this.onDidChangeTreeData = this._onDidChangeTreeData.event;
    }

    refresh() {
        this._onDidChangeTreeData.fire(undefined);
    }

    getTreeItem(element) {
        const treeItem = new vscode.TreeItem(element.title);
        treeItem.tooltip = element.fullTitle;
        treeItem.command = {
            command: element.id,
            title: element.fullTitle
        };
        // Add an icon to each tree item
        treeItem.iconPath = new vscode.ThemeIcon('symbol-class');
        return treeItem;
    }

    getChildren() {
        return this.widgetWrappers;
    }
}

module.exports = { WrappersViewProvider };
