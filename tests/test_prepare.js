'use strict';
// Exercise staging/backups in an isolated filesystem, never on real TV paths.
var assert = require('assert'), fs = require('fs'), os = require('os'), path = require('path'), vm = require('vm');
var patcher = require('../tv/fullhome');
var tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'display-only-test-'));
function mapped(p) { return path.join(tmp, p); }
var fakeFs = {};
['existsSync', 'mkdirSync', 'readFileSync', 'writeFileSync', 'chmodSync', 'statSync', 'lstatSync', 'readdirSync', 'readlinkSync', 'unlinkSync'].forEach(function(name) {
    fakeFs[name] = function() { var args = Array.from(arguments); args[0] = mapped(args[0]); return fs[name].apply(fs, args); };
});
function put(p, text) { fs.mkdirSync(path.dirname(mapped(p)), {recursive: true}); fs.writeFileSync(mapped(p), text); }
var target = '/usr/palm/applications/com.webos.app.fullhome/qml/Test.qml';
var original = 'private original';
var profile = {id: 'test', identity: {modelName: 'test', firmwareVersion: 'test'}, qml: [{target: target, originalSha256: patcher.hash(original)}],
    startupHashes: {}, units: ['update', 'nudge'], dynamicBinaries: ['update'], processBinaries: ['update'],
    hiddenAppManifests: [], disabledPreloads: [], settings: {general: {defaultApps: {home: 'com.webos.app.fullhome'}}}};
var audit = {identity: profile.identity, fingerprints: {}, uid: 0, homebrew: {root: true}, startupAvailable: true,
    preloads: [], settings: {general: {defaultApps: {home: 'old.home', other: 'preserve'}}}, updater: 'idle',
    ip4Rules: '0: from all lookup local\n32766: from all lookup main\n32767: from all lookup default', connectionEnvironmentHash: null};
audit.fingerprints[target] = profile.qml[0].originalSha256;
put(target, original);
['engine.js', 'probe.js', 'fullhome.js', 'runtime.sh', 'profile.json'].forEach(function(f) { put('/bundle/' + f, 'fixture'); });
var context = {require: function(name) {
    if (name === 'fs') return fakeFs;
    if (name === './probe') return {hashFile: function(p) { return patcher.hash(fakeFs.readFileSync(p)); }};
    if (name === './fullhome') return {hash: patcher.hash, patch: function() { return 'overlay'; }};
    return require(name);
}, module: {exports: {}}, __dirname: '/bundle', console: console};
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../tv/engine.js'), 'utf8'), context);
var plan = {schema: 1, profile: 'test', localNetworkOnly: false, blockUpdates: false, resumeInput: 'com.webos.app.hdmi2'};
var state = context.module.exports.prepare(profile, plan, audit);
assert.strictEqual(state.phase, 'prepared');
assert.strictEqual(fs.readFileSync(mapped(target), 'utf8'), original);
assert.strictEqual(fs.readFileSync(mapped('/var/lib/webos-display-only/backup/files' + target), 'utf8'), original);
assert.strictEqual(fs.readFileSync(mapped('/var/lib/webos-display-only/overrides' + target), 'utf8'), 'overlay');
assert.strictEqual(state.desiredSettings.general.defaultApps.other, 'preserve');
assert(!state.units.includes('update'));
assert(!fs.existsSync(mapped('/var/lib/webosbrew/init.d/15-webos-display-only')));
assert.strictEqual(fs.statSync(mapped('/var/lib/webos-display-only/state.json')).mode & 511, 384);
assert.throws(function() { context.module.exports.supported(Object.assign({}, audit, {legacyCleanupPresent: true}), profile); });
put('/bundle/local-only.sh', 'fixture network policy');
put('/sbin/sysctl', 'fixture original sysctl');
put('/proc/sys/net/ipv6/conf/all/disable_ipv6', '0\n');
put('/proc/sys/net/ipv6/conf/default/disable_ipv6', '0\n');
var networkPlan = Object.assign({}, plan, {localNetworkOnly: true});
state = context.module.exports.prepare(profile, networkPlan, audit);
assert.strictEqual(state.environmentHash, patcher.hash(state.newEnvironment));
assert.strictEqual(fs.readFileSync(mapped('/proc/sys/net/ipv6/conf/all/disable_ipv6'), 'utf8'), '0\n');
assert.strictEqual(fs.statSync(mapped('/var/lib/webos-display-only/network')).mode & 511, 493);
assert.strictEqual(fs.statSync(mapped('/var/lib/webos-display-only/backup')).mode & 511, 448);
assert.strictEqual(fs.statSync(mapped('/var/lib/webos-display-only/state.json')).mode & 511, 384);
assert(!fs.existsSync(mapped('/var/systemd/system/env/connman.env')));
fs.rmSync(tmp, {recursive: true, force: true});
console.log('Isolated staging preserves originals, backups, permissions, settings and opt-in scope.');
