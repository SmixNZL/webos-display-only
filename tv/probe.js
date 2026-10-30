'use strict';
// This read-only probe intentionally omits serial numbers, addresses and account data.
var fs = require('fs'), cp = require('child_process'), crypto = require('crypto');
function run(file, args) {
    try { return cp.execFileSync(file, args || [], {encoding: 'utf8', timeout: 15000, stdio: ['ignore', 'pipe', 'pipe']}).trim(); }
    catch (e) { return null; }
}
function luna(uri, data) {
    var result = run('luna-send', ['-w', '6000', '-n', '1', uri, JSON.stringify(data || {})]);
    if (!result) throw new Error('No response: ' + uri);
    var value = JSON.parse(result);
    if (!value.returnValue) throw new Error('TV rejected ' + uri);
    return value;
}
function hashFile(p) {
    try { return crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex'); }
    catch (e) { return null; }
}
function collect(profile) {
    var info = luna('luna://com.webos.service.tv.systemproperty/getSystemInfo', {keys: ['modelName', 'firmwareVersion', 'sdkVersion']});
    var identity = {};
    Object.keys(profile.identity).forEach(function(k) { identity[k] = info[k]; });
    var fingerprints = {};
    profile.qml.forEach(function(e) { fingerprints[e.target] = hashFile(e.target); });
    Object.keys(profile.startupHashes).forEach(function(p) { fingerprints[p] = hashFile(p); });
    var settings = {};
    Object.keys(profile.settings).forEach(function(category) {
        settings[category] = luna('luna://com.webos.settingsservice/getSystemSettings', {category: category, keys: Object.keys(profile.settings[category])}).settings;
    });
    var config = luna('luna://com.webos.service.config/getConfigs', {configNames: ['com.webos.service.preloadmanager.supportAppList']});
    var hbc;
    try { hbc = luna('luna://org.webosbrew.hbchannel.service/getConfiguration'); } catch (e) { hbc = {}; }
    return {schema: 1, identity: identity, uid: process.getuid(), node: process.version,
        fingerprints: fingerprints, settings: settings,
        preloads: (config.configs || {})['com.webos.service.preloadmanager.supportAppList'],
        homebrew: {root: hbc.root === true, telnetDisabled: hbc.telnetDisabled === true, sshdEnabled: hbc.sshdEnabled === true},
        startupAvailable: fs.existsSync('/var/lib/webosbrew/init.d'),
        updater: luna('luna://com.webos.service.update/getCurStatus').status,
        ip4Rules: run('ip', ['-4', 'rule', 'show']),
        connectionEnvironmentHash: hashFile('/var/systemd/system/env/connman.env'),
        legacyCleanupPresent: fs.existsSync('/var/lib/tv-debloat') || fs.existsSync('/var/lib/own-your-glass'),
        installed: fs.existsSync('/var/lib/webos-display-only/state.json')};
}
module.exports = {run: run, luna: luna, hashFile: hashFile, collect: collect};
