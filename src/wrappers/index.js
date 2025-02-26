const {
    getAllWidgets,
    getWidgetById,
    getEnabledWidgets,
    toggleWrapperState,
    initializeWrapperStates,
    getAllWidgetCategories
} = require('./widget-registry');
const { showWidgetsMenu, wrapWidget } = require('./wrapper-service');

module.exports = {
    getAllWidgets,
    getEnabledWidgets,
    getWidgetById,
    toggleWrapperState,
    initializeWrapperStates,
    getAllWidgetCategories,
    showWidgetsMenu,
    wrapWidget
};