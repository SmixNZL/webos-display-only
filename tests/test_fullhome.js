'use strict';
var assert = require('assert'), vm = require('vm'), patcher = require('../tv/fullhome');
var engine = require('../tv/engine'), profile = require('../profiles/lg-un81-webos5.json');
assert(engine.same({a: 1, b: {x: true, y: 2}}, {b: {y: 2, x: true}, a: 1}));
var source = '\n        tempArray.map(function(item){ item.id = "kept"; });';
var patched = patcher.transform('Interfaces/ConnectionsInterfaces/ConnectionsInterfaces.qml', source);
var cards = [
    {name: 'Console', type: 'hdmi', onClick: {targetAppId: 'com.webos.app.hdmi1'}},
    {name: 'Player', type: 'hdmi', onClick: {targetAppId: 'com.webos.app.hdmi2'}},
    {name: 'Sound', type: 'soundOut'},
    {name: 'Phone', type: 'mobile'},
    {name: 'Phone guide', type: 'mobile_guide'},
    {name: 'Dashboard', onClick: {targetAppId: 'com.webos.app.homeconnect'}},
    {name: 'TV', onClick: {targetAppId: 'com.webos.app.livetv'}},
    {name: 'Guide', onClick: {targetAppId: 'com.webos.app.tvuserguide'}}, null
];
var context = {tempArray: cards};
vm.runInNewContext(patched, context);
assert.deepStrictEqual(Array.from(context.tempArray, function(c) { return c.name; }), ['Console', 'Player', 'Sound']);
assert(context.tempArray.every(function(c) { return c.id === 'kept'; }));
assert.throws(function() { patcher.transform('Interfaces/ConnectionsInterfaces/ConnectionsInterfaces.qml', source + source); });
assert.throws(function() { patcher.patch(profile.qml[0], Buffer.from('unknown TV source')); });
assert.throws(function() { patcher.transform('unexpected.qml', ''); });
assert.throws(function() { engine.validatePlan({schema: 1, profile: profile.id, localNetworkOnly: true, blockUpdates: true, resumeInput: 'shell;command'}, profile); });
engine.validatePlan({schema: 1, profile: profile.id, localNetworkOnly: false, blockUpdates: false, resumeInput: 'com.webos.app.hdmi4'}, profile);
console.log('Home card retention, unknown-source rejection, ambiguous anchors and plan scope passed.');
