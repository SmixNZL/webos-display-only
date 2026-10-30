'use strict';
// Generate overlays on the owner's TV; do not distribute LG's QML files.
var crypto = require('crypto');
function hash(text) { return crypto.createHash('sha256').update(text).digest('hex'); }
function once(text, oldText, newText) {
    if (text.split(oldText).length !== 2) throw new Error('QML anchor is absent or ambiguous');
    return text.replace(oldText, newText);
}
function transform(relativePath, text) {
    if (relativePath === 'Interfaces/ConnectionsInterfaces/ConnectionsInterfaces.qml') {
        return once(text, '\n        tempArray.map(function(item){',
            '\n        // Display-only setup: keep inputs and sound controls, omit unused LG shortcuts.\n' +
            '        tempArray = tempArray.filter(function(item) {\n' +
            '            if (!item) return false;\n' +
            '            var target = item.onClick ? item.onClick.targetAppId : "";\n' +
            '            return item.type !== "mobile" && item.type !== "mobile_guide" &&\n' +
            '                   target !== "com.webos.app.homeconnect" &&\n' +
            '                   target !== "com.webos.app.livetv" &&\n' +
            '                   target !== "com.webos.app.tvuserguide";\n' +
            '        });\n\n        tempArray.map(function(item){');
    }
    if (relativePath === 'UserInterfaceLayer/Containers/Main/TopShelf.qml') {
        text = once(text, 'if(systemProperties.isTopShelfGuide && !uiController.isEditMode) {', 'if(topShelfGuide.visible) {');
        text = once(text, '            } else {\n                if (topShelfContainer.lastFocusItem !== undefined)',
            '            } else if (!systemProperties.networkConnected) {\n                topGlobalAction.forceActiveFocus();\n            } else {\n                if (topShelfContainer.lastFocusItem !== undefined)');
        text = once(text, 'visible: (systemProperties.isTopShelfGuide && !uiController.isEditMode)',
            'visible: (systemProperties.isTopShelfGuide && !uiController.isEditMode) && !systemProperties.isTopShelfGuideNetwork');
        text = once(text, 'visible: !topShelfGuide.visible && hero.noAdvertisement',
            'visible: !topShelfGuide.visible && hero.noAdvertisement && systemProperties.networkConnected');
        text = once(text, '        Keys.onDownPressed: {\n            if(hero.noAdvertisement) {',
            '        Keys.onDownPressed: {\n            if (!systemProperties.networkConnected) {\n                uiController.mainView.appListArea.forceActiveFocus();\n            } else if(hero.noAdvertisement) {');
        return once(text, '        visible: !topShelfGuide.visible\n',
            '        visible: !topShelfGuide.visible && systemProperties.networkConnected\n');
    }
    if (relativePath === 'Model/ShelfList.js') {
        return once(text, 'this._shelfData = this._filterShelfItem();',
            'this._shelfData = this._filterShelfItem().filter(function (item) {\n' +
            '                return item.shelfId !== "HOME_SH_LIVETV";\n            });');
    }
    throw new Error('Unapproved QML path');
}
function patch(entry, original) {
    if (hash(original) !== entry.originalSha256) throw new Error('Unknown original Home source: ' + entry.relativePath);
    var result = transform(entry.relativePath, original.toString('utf8'));
    if (hash(result) !== entry.modifiedSha256) throw new Error('Generated Home overlay failed integrity check');
    return result;
}
module.exports = {hash: hash, once: once, transform: transform, patch: patch};
