/**
 * This utility contains functions to workaround VS Code's limitations with 
 * programmatically expanding and collapsing tree view nodes
 */
const vscode = require('vscode');

/**
 * Force expands all tree nodes using a simplified approach for reliability
 * @param {vscode.TreeView} treeView The tree view to operate on
 * @param {vscode.TreeDataProvider} provider The tree data provider
 */
async function forceExpandAll(treeView, provider) {
    if (!treeView || !provider) return;
    
    try {
        console.log('[TreeForceUpdate] Starting expand operation with simplified approach');
        
        // 1. Update provider flags
        provider.forceExpandAll = true;
        provider.forceCollapseAll = false;
        provider.lastOperation = 'expand';
        
        // 2. Mark all nodes as expanded
        if (provider.treeItems && provider.expandedNodes) {
            provider.treeItems.forEach(item => {
                if (item.metadata?.filePath && item.metadata?.line) {
                    const nodeId = `${item.metadata.filePath}${item.metadata.line}`;
                    provider.expandedNodes.add(nodeId);
                }
            });
        }
        
        // 3. Force refresh
        provider._onDidChangeTreeData.fire();
        
        // 4. Wait for UI update
        await new Promise(resolve => setTimeout(resolve, 150));
        
        // 5. Try VS Code's built-in command
        try {
            await vscode.commands.executeCommand('list.expandAll');
        } catch (e) {
            console.log('[TreeForceUpdate] Native command failed, trying alternate approach', e);
            
            // 6. If that fails, try simpler approach
            try {
                const rootItems = await provider.getChildren();
                if (rootItems && rootItems.length > 0 && treeView.visible) {
                    for (const item of rootItems) {
                        await treeView.reveal(item, { expand: true });
                    }
                }
            } catch (innerErr) {
                console.log('[TreeForceUpdate] Alternative approach failed', innerErr);
            }
        }
        
        console.log('[TreeForceUpdate] Expansion operation completed');
    } catch (error) {
        console.error('[TreeForceUpdate] Error in forceExpandAll:', error);
    }
}

/**
 * Simplified collapse approach that tends to be more reliable
 * @param {vscode.TreeView} treeView The tree view
 * @param {vscode.TreeDataProvider} provider The data provider
 */
async function forceCollapseAll(treeView, provider) {
    if (!treeView || !provider) return;
    
    try {
        // 1. Set provider state
        provider.forceExpandAll = false;
        provider.forceCollapseAll = true;
        provider.lastOperation = 'collapse';
        
        // 2. Clear expanded nodes tracking
        if (provider.expandedNodes) {
            provider.expandedNodes.clear();
        }
        
        // 3. Force refresh
        provider._onDidChangeTreeData.fire();
        
        // 4. Use built-in command - which typically works better for collapse
        try {
            await vscode.commands.executeCommand('list.collapseAll');
        } catch (e) {
            console.log('[TreeForceUpdate] Collapse command error:', e);
        }
        
        // 5. Final refresh
        provider._onDidChangeTreeData.fire();
    } catch (error) {
        console.error('[TreeForceUpdate] Error in forceCollapseAll:', error);
    }
}

module.exports = {
    forceExpandAll,
    forceCollapseAll
};
