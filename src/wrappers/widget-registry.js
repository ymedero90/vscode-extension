const { getIndentation } = require('../utils');

/**
 * Registry of all available widgets to wrap with
 */
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

/**
 * Obtiene todos los widgets registrados
 * @returns {Array} Lista de widgets
 */
function getAllWidgets() {
    return [...widgetWrappers];
}

/**
 * Obtiene un widget por su ID
 * @param {string} id ID del widget
 * @returns {Object|undefined} Widget encontrado o undefined
 */
function getWidgetById(id) {
    return widgetWrappers.find(wrapper => wrapper.id === id);
}

module.exports = {
    getAllWidgets,
    getWidgetById
};
