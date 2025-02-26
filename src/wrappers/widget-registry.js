const vscode = require('vscode');
const { getIndentation } = require('../utils');

// Store enabled state in workspace state
let enabledWrappers = {};

/**
 * Registry of all available widgets to wrap with, organized by categories
 */
const widgetCategories = [
    {
        id: 'layout',
        name: 'Layout Widgets',
        wrappers: [
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
                id: 'wrapping.wrapWithAlign',
                title: 'Align',
                fullTitle: 'Wrap with Align',
                snippet: (widget) => `Align(\n${getIndentation(widget)}  alignment: Alignment.center,\n${getIndentation(widget)}  child: ${widget},\n${getIndentation(widget)})`
            },
            {
                id: 'wrapping.wrapWithSizedBox',
                title: 'SizedBox',
                fullTitle: 'Wrap with SizedBox',
                snippet: (widget) => `SizedBox(\n${getIndentation(widget)}  width: 100,\n${getIndentation(widget)}  height: 100,\n${getIndentation(widget)}  child: ${widget},\n${getIndentation(widget)})`
            },
            {
                id: 'wrapping.wrapWithAspectRatio',
                title: 'AspectRatio',
                fullTitle: 'Wrap with AspectRatio',
                snippet: (widget) => `AspectRatio(\n${getIndentation(widget)}  aspectRatio: 16 / 9,\n${getIndentation(widget)}  child: ${widget},\n${getIndentation(widget)})`
            },
            {
                id: 'wrapping.wrapWithFittedBox',
                title: 'FittedBox',
                fullTitle: 'Wrap with FittedBox',
                snippet: (widget) => `FittedBox(\n${getIndentation(widget)}  fit: BoxFit.contain,\n${getIndentation(widget)}  child: ${widget},\n${getIndentation(widget)})`
            },
        ]
    },
    {
        id: 'flex',
        name: 'Flex Widgets',
        wrappers: [
            {
                id: 'wrapping.wrapWithExpanded',
                title: 'Expanded',
                fullTitle: 'Wrap with Expanded',
                snippet: (widget) => `Expanded(\n${getIndentation(widget)}  child: ${widget},\n${getIndentation(widget)})`
            },
            {
                id: 'wrapping.wrapWithFlexible',
                title: 'Flexible',
                fullTitle: 'Wrap with Flexible',
                snippet: (widget) => `Flexible(\n${getIndentation(widget)}  child: ${widget},\n${getIndentation(widget)})`
            },
            {
                id: 'wrapping.wrapWithRow',
                title: 'Row',
                fullTitle: 'Wrap with Row',
                snippet: (widget) => `Row(\n${getIndentation(widget)}  children: [\n${getIndentation(widget)}    ${widget},\n${getIndentation(widget)}  ],\n${getIndentation(widget)})`
            },
            {
                id: 'wrapping.wrapWithColumn',
                title: 'Column',
                fullTitle: 'Wrap with Column',
                snippet: (widget) => `Column(\n${getIndentation(widget)}  children: [\n${getIndentation(widget)}    ${widget},\n${getIndentation(widget)}  ],\n${getIndentation(widget)})`
            },
            {
                id: 'wrapping.wrapWithWrap',
                title: 'Wrap',
                fullTitle: 'Wrap with Wrap',
                snippet: (widget) => `Wrap(\n${getIndentation(widget)}  children: [\n${getIndentation(widget)}    ${widget},\n${getIndentation(widget)}  ],\n${getIndentation(widget)})`
            },
        ]
    },
    {
        id: 'multi-child',
        name: 'Multi-Child Layouts',
        wrappers: [
            {
                id: 'wrapping.wrapWithStack',
                title: 'Stack',
                fullTitle: 'Wrap with Stack',
                snippet: (widget) => `Stack(\n${getIndentation(widget)}  children: [\n${getIndentation(widget)}    ${widget},\n${getIndentation(widget)}  ],\n${getIndentation(widget)})`
            },
            {
                id: 'wrapping.wrapWithListView',
                title: 'ListView',
                fullTitle: 'Wrap with ListView',
                snippet: (widget) => `ListView(\n${getIndentation(widget)}  children: [\n${getIndentation(widget)}    ${widget},\n${getIndentation(widget)}  ],\n${getIndentation(widget)})`
            },
            {
                id: 'wrapping.wrapWithGridView',
                title: 'GridView',
                fullTitle: 'Wrap with GridView',
                snippet: (widget) => `GridView.count(\n${getIndentation(widget)}  crossAxisCount: 2,\n${getIndentation(widget)}  children: [\n${getIndentation(widget)}    ${widget},\n${getIndentation(widget)}  ],\n${getIndentation(widget)})`
            },
        ]
    },
    {
        id: 'material',
        name: 'Material Widgets',
        wrappers: [
            {
                id: 'wrapping.wrapWithCard',
                title: 'Card',
                fullTitle: 'Wrap with Card',
                snippet: (widget) => `Card(\n${getIndentation(widget)}  child: ${widget},\n${getIndentation(widget)})`
            },
            {
                id: 'wrapping.wrapWithInkWell',
                title: 'InkWell',
                fullTitle: 'Wrap with InkWell',
                snippet: (widget) => `InkWell(\n${getIndentation(widget)}  onTap: () {},\n${getIndentation(widget)}  child: ${widget},\n${getIndentation(widget)})`
            },
            {
                id: 'wrapping.wrapWithMaterial',
                title: 'Material',
                fullTitle: 'Wrap with Material',
                snippet: (widget) => `Material(\n${getIndentation(widget)}  elevation: 4.0,\n${getIndentation(widget)}  child: ${widget},\n${getIndentation(widget)})`
            },
        ]
    },
    {
        id: 'interaction',
        name: 'Interaction Widgets',
        wrappers: [
            {
                id: 'wrapping.wrapWithGestureDetector',
                title: 'GestureDetector',
                fullTitle: 'Wrap with GestureDetector',
                snippet: (widget) => `GestureDetector(\n${getIndentation(widget)}  onTap: () {},\n${getIndentation(widget)}  child: ${widget},\n${getIndentation(widget)})`
            },
            {
                id: 'wrapping.wrapWithMouseRegion',
                title: 'MouseRegion',
                fullTitle: 'Wrap with MouseRegion',
                snippet: (widget) => `MouseRegion(\n${getIndentation(widget)}  cursor: SystemMouseCursors.click,\n${getIndentation(widget)}  child: ${widget},\n${getIndentation(widget)})`
            },
            {
                id: 'wrapping.wrapWithDismissible',
                title: 'Dismissible',
                fullTitle: 'Wrap with Dismissible',
                snippet: (widget) => `Dismissible(\n${getIndentation(widget)}  key: UniqueKey(),\n${getIndentation(widget)}  onDismissed: (direction) {},\n${getIndentation(widget)}  child: ${widget},\n${getIndentation(widget)})`
            },
        ]
    },
    {
        id: 'scrolling',
        name: 'Scrolling Widgets',
        wrappers: [
            {
                id: 'wrapping.wrapWithSingleChildScrollView',
                title: 'SingleChildScrollView',
                fullTitle: 'Wrap with SingleChildScrollView',
                snippet: (widget) => `SingleChildScrollView(\n${getIndentation(widget)}  child: ${widget},\n${getIndentation(widget)})`
            },
            {
                id: 'wrapping.wrapWithScrollbar',
                title: 'Scrollbar',
                fullTitle: 'Wrap with Scrollbar',
                snippet: (widget) => `Scrollbar(\n${getIndentation(widget)}  child: ${widget},\n${getIndentation(widget)})`
            },
        ]
    },
    {
        id: 'styling',
        name: 'Styling & Effects',
        wrappers: [
            {
                id: 'wrapping.wrapWithOpacity',
                title: 'Opacity',
                fullTitle: 'Wrap with Opacity',
                snippet: (widget) => `Opacity(\n${getIndentation(widget)}  opacity: 0.8,\n${getIndentation(widget)}  child: ${widget},\n${getIndentation(widget)})`
            },
            {
                id: 'wrapping.wrapWithClipRRect',
                title: 'ClipRRect',
                fullTitle: 'Wrap with ClipRRect',
                snippet: (widget) => `ClipRRect(\n${getIndentation(widget)}  borderRadius: BorderRadius.circular(8.0),\n${getIndentation(widget)}  child: ${widget},\n${getIndentation(widget)})`
            },
            {
                id: 'wrapping.wrapWithClipOval',
                title: 'ClipOval',
                fullTitle: 'Wrap with ClipOval',
                snippet: (widget) => `ClipOval(\n${getIndentation(widget)}  child: ${widget},\n${getIndentation(widget)})`
            },
            {
                id: 'wrapping.wrapWithAnimatedContainer',
                title: 'AnimatedContainer',
                fullTitle: 'Wrap with AnimatedContainer',
                snippet: (widget) => `AnimatedContainer(\n${getIndentation(widget)}  duration: const Duration(milliseconds: 300),\n${getIndentation(widget)}  child: ${widget},\n${getIndentation(widget)})`
            },
        ]
    },
];

// Flatten all wrappers for use in existing functions
const widgetWrappers = widgetCategories.flatMap(category =>
    category.wrappers.map(wrapper => ({
        ...wrapper,
        category: category.id
    }))
);

/**
 * Initializes wrapper states from the workspace state
 * @param {vscode.ExtensionContext} context The extension context
 */
function initializeWrapperStates(context) {
    try {
        // Load the state from workspaceState (persisted between sessions)
        enabledWrappers = context.workspaceState.get('enabledWrappers', {});
        console.log('Loaded wrapper states:', enabledWrappers);

        // If no state saved yet, initialize all to enabled
        if (Object.keys(enabledWrappers).length === 0) {
            console.log('No saved states found. Initializing all wrappers as enabled.');
            widgetWrappers.forEach(wrapper => {
                enabledWrappers[wrapper.id] = true;
            });
            context.workspaceState.update('enabledWrappers', enabledWrappers);
        }

        // Apply saved states to widgets - use STRICT BOOLEAN values for better compatibility
        widgetWrappers.forEach(wrapper => {
            // Get the saved state or default to true
            wrapper.enabled = enabledWrappers[wrapper.id] === false ? false : true;
            console.log(`Wrapper ${wrapper.id} initialized as ${wrapper.enabled ? 'enabled' : 'disabled'}`);
        });
    } catch (error) {
        console.error('Error initializing wrapper states:', error);
        widgetWrappers.forEach(wrapper => wrapper.enabled = true);
    }
}

/**
 * Gets all registered wrappers (with enabled state)
 * @returns {Array} List of wrappers
 */
function getAllWidgets() {
    return [...widgetWrappers];
}

/**
 * Gets all widget categories
 * @returns {Array} List of categories with their wrappers
 */
function getAllWidgetCategories() {
    return widgetCategories.map(category => ({
        ...category,
        wrappers: category.wrappers.map(wrapper => {
            const fullWrapper = widgetWrappers.find(w => w.id === wrapper.id);
            return fullWrapper;
        })
    }));
}

/**
 * Gets all enabled wrappers
 * @returns {Array} List of enabled wrappers
 */
function getEnabledWidgets() {
    // Use strict boolean comparison
    return widgetWrappers.filter(wrapper => wrapper.enabled === true);
}

/**
 * Gets a wrapper by its ID
 * @param {string} id ID of the wrapper
 * @returns {Object|undefined} Found wrapper or undefined
 */
function getWidgetById(id) {
    return widgetWrappers.find(wrapper => wrapper.id === id);
}

/**
 * Toggles a wrapper's enabled state
 * @param {string} id Wrapper ID to toggle
 * @param {vscode.ExtensionContext} context Extension context for saving state
 * @returns {boolean} New enabled state
 */
function toggleWrapperState(id, context) {
    const wrapper = getWidgetById(id);
    if (!wrapper) return false;

    // Toggle the state - make sure we're using boolean values
    wrapper.enabled = !(wrapper.enabled === true);

    // Log the state change
    console.log(`[Registry] Toggled ${id} to ${wrapper.enabled}`);

    // Update in-memory storage using the actual boolean value
    enabledWrappers[id] = wrapper.enabled;

    // Save to workspace state - THIS IS WHAT PERSISTS THE STATES
    try {
        context.workspaceState.update('enabledWrappers', enabledWrappers);
    } catch (error) {
        console.error('Error saving wrapper state:', error);
    }

    // Update VS Code context directly
    try {
        vscode.commands.executeCommand('setContext', `flutterWrapper.${id}.enabled`, wrapper.enabled);
    } catch (error) {
        console.error('Error updating context:', error);
    }

    return wrapper.enabled;
}

module.exports = {
    getAllWidgets,
    getAllWidgetCategories,
    getEnabledWidgets,
    getWidgetById,
    toggleWrapperState,
    initializeWrapperStates
};
