const { getIndentation } = require('../utils');

/**
 * Registro de todos los widgets disponibles para envolver
 */
const widgetWrappers = [
    {
        id: 'wrapping.wrapWithExpanded',
        title: 'Expanded',
        fullTitle: 'Wrapped with Expanded',
        snippet: (widget) => `Expanded(\n${getIndentation(widget)}  child: ${widget},\n${getIndentation(widget)})`
    },
    {
        id: 'wrapping.wrapWithContainer',
        title: 'Container',
        fullTitle: 'Wrapped with Container',
        snippet: (widget) => `Container(\n${getIndentation(widget)}  child: ${widget},\n${getIndentation(widget)})`
    },
    {
        id: 'wrapping.wrapWithCenter',
        title: 'Center',
        fullTitle: 'Wrapped with Center',
        snippet: (widget) => `Center(\n${getIndentation(widget)}  child: ${widget},\n${getIndentation(widget)})`
    },
    {
        id: 'wrapping.wrapWithPadding',
        title: 'Padding',
        fullTitle: 'Wrapped with Padding',
        snippet: (widget) => `Padding(\n${getIndentation(widget)}  padding: const EdgeInsets.all(8.0),\n${getIndentation(widget)}  child: ${widget},\n${getIndentation(widget)})`
    },
    {
        id: 'wrapping.wrapWithStack',
        title: 'Stack',
        fullTitle: 'Wrapped with Stack',
        snippet: (widget) => `Stack(\n${getIndentation(widget)}  children: [\n${getIndentation(widget)}    ${widget},\n${getIndentation(widget)}  ],\n${getIndentation(widget)})`
    },
    {
        id: 'wrapping.wrapWithFlexible',
        title: 'Flexible',
        fullTitle: 'Wrapped with Flexible',
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
