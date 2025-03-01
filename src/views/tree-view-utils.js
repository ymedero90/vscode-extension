const vscode = require('vscode');

/**
 * Utility class to help with TreeView operations 
 * that may be inconsistent across VS Code versions
 */
class TreeViewUtils {
    /**
     * Forces a TreeView to refresh its data
     * @param {vscode.TreeView} treeView The TreeView to refresh
     * @param {vscode.TreeDataProvider} provider The data provider
     * @returns {Promise<void>}
     */
    static async forceRefresh(treeView, provider) {
        if (!treeView || !provider) return;

        try {
            // Force a complete rebuild of the tree
            provider._onDidChangeTreeData.fire();
            
            // Use reveal to ensure the tree is updated
            if (treeView.visible) {
                const children = await provider.getChildren();
                if (children && children.length > 0) {
                    // Try to reveal the first item to force update
                    await treeView.reveal(children[0], {select: false, focus: false});
                }
            }
        } catch (error) {
            console.error('Error forcing tree refresh:', error);
        }
    }

    /**
     * Ensures the TreeView is visible and ready to receive updates
     * @param {string} viewId The ID of the view to make visible
     * @returns {Promise<void>}
     */
    static async ensureTreeViewVisible(viewId) {
        try {
            await vscode.commands.executeCommand(`${viewId}.focus`);
            // Give VS Code a moment to update the UI
            await new Promise(resolve => setTimeout(resolve, 100));
        } catch (error) {
            console.error(`Error making tree view ${viewId} visible:`, error);
        }
    }
    
    /**
     * Force expands all nodes in the TreeView using multiple strategies
     * @param {vscode.TreeView} treeView The TreeView to operate on
     * @returns {Promise<void>}
     */
    static async forceExpandAll(treeView) {
        if (!treeView) return;
        
        try {
            // Try direct VS Code command first
            await vscode.commands.executeCommand('list.expandAll');
            
            // Use private APIs as fallback if available
            if (treeView._tree && typeof treeView._tree.expandAll === 'function') {
                treeView._tree.expandAll();
            }
            
            // Wait a moment for the UI to update
            await new Promise(resolve => setTimeout(resolve, 100));
        } catch (error) {
            console.log('Non-critical error in forceExpandAll:', error);
        }
    }
    
    /**
     * Force collapses all nodes in the TreeView using multiple strategies
     * @param {vscode.TreeView} treeView The TreeView to operate on
     * @returns {Promise<void>}
     */
    static async forceCollapseAll(treeView) {
        if (!treeView) return;
        
        try {
            // Try direct VS Code command first
            await vscode.commands.executeCommand('list.collapseAll');
            
            // Wait a moment for the UI to update
            await new Promise(resolve => setTimeout(resolve, 100));
        } catch (error) {
            console.log('Non-critical error in forceCollapseAll:', error);
        }
    }

    /**
     * Ensures the tree view has proper horizontal scrolling capabilities
     * Note: This is a workaround since VS Code's TreeView doesn't expose scrolling APIs
     * @param {vscode.TreeView} treeView The tree view to configure
     */
    static configureTreeViewScrolling(treeView) {
        // This is a placeholder for when we need to add custom scrolling logic
        // VS Code handles basic scrolling internally, but we might need to enhance it
        
        // Currently, horizontal scrolling works best with:
        // 1. Descriptive enough tree item labels/descriptions
        // 2. Hovering near tree view edges (VS Code behavior)
    }

    /**
     * Tries to reveal an item in the tree view and scroll to it
     * @param {vscode.TreeView} treeView The tree view
     * @param {any} item The item to reveal
     * @param {Object} options Reveal options
     * @returns {Promise<boolean>} Success status
     */
    static async revealTreeItem(treeView, item, options = {}) {
        if (!treeView || !item) return false;
        
        try {
            // Apply default options
            const revealOptions = {
                select: options.select !== undefined ? options.select : true,
                focus: options.focus !== undefined ? options.focus : false,
                expand: options.expand !== undefined ? options.expand : true
            };
            
            // Attempt to reveal the item
            await treeView.reveal(item, revealOptions);
            return true;
        } catch (error) {
            console.error('Error revealing tree item:', error);
            return false;
        }
    }
}

module.exports = TreeViewUtils;
