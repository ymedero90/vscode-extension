const { getAllWidgets, getWidgetById } = require('./widget-registry');
const { showWidgetsMenu, wrapWidget } = require('./wrapper-service');

module.exports = {
    getAllWidgets,
    getWidgetById,
    showWidgetsMenu,
    wrapWidget
};