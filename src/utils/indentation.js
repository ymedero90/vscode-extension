/**
 * Gets the indentation from a text
 * @param {string} text The widget text
 * @returns {string} The indentation (spaces/tabs)
 */
function getIndentation(text) {
    // Detect the indentation from the original widget
    const match = text.match(/^(\s*)/);
    return match ? match[1] : '';
}

module.exports = {
    getIndentation
};
