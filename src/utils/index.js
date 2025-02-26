const { getIndentation } = require('./indentation');
const { findMatchingBracket } = require('./bracket-matching');
const { detectCompleteWidget } = require('./widget-detection');

module.exports = {
    getIndentation,
    findMatchingBracket,
    detectCompleteWidget
};
