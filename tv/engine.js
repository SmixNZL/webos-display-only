'use strict';
// Node 8 compatible. All original device files remain private on the TV.
var fs = require('fs'), path = require('path'), cp = require('child_process');
var probe = require('./probe'), home = require('./fullhome');
var BASE = '/var/lib/webos-display-only', HOOK = '/var/lib/webosbrew/init.d/15-webos-display-only';
var ENV = '/var/systemd/system/env/connman.env', GUARD = BASE + '/network';
var PRELOAD = 'com.webos.service.preloadmanager.supportAppList';
function must(ok, message) { if (!ok) throw new Error(message); }
function mkdir(p) {
    if (fs.existsSync(p)) return;
    mkdir(path.dirname(p)); fs.mkdirSync(p, 448);
}
function write(p, data, mode) {
    mkdir(path.dirname(p));
    fs.writeFileSync(p, data, {mode: mode || 384});
    fs.chmodSync(p, mode || 384);
}
function json(p, v) { write(p, JSON.stringify(v, null, 2) + '\n'); }
function read(p) { return JSON.parse(fs.readFileSync(p, 'utf8')); }
function exec(file, args) {
    return cp.execFileSync(file, args || [], {encoding: 'utf8', timeout: 60000, stdio: ['ignore', 'pipe', 'pipe']});
}
function canonical(value) {
    if (Array.isArray(value)) return value.map(canonical);
    if (value && typeof value === 'object') {
        var out = {};
        Object.keys(value).sort().forEach(function(k) { out[k] = canonical(value[k]); });
        return out;
    }
    return value;
}
function same(a, b) { return JSON.stringify(canonical(a)) === JSON.stringify(canonical(b)); }
function supported(audit, profile) {
    Object.keys(profile.identity).forEach(function(k) { must(audit.identity[k] === profile.identity[k], 'Unsupported ' + k); });
    must(audit.uid === 0 && audit.homebrew.root && audit.startupAvailable, 'An existing persistent Homebrew root is required');
    must(!audit.legacyCleanupPresent, 'Another cleanup toolkit is present; restore it before installing this one');
    must(!audit.installed, 'Already installed; use status or restore, not apply again');
    profile.qml.forEach(function(e) { must(audit.fingerprints[e.target] === e.originalSha256, 'Unknown or already modified Home source'); });
    Object.keys(profile.startupHashes).forEach(function(p) {
        must(audit.fingerprints[p] === profile.startupHashes[p], 'Unknown network startup file');
    });
    must(Array.isArray(audit.preloads), 'Preload configuration unavailable');
    Object.keys(profile.settings).forEach(function(c) {
        must(audit.settings[c], 'Settings category unavailable: ' + c);
        Object.keys(profile.settings[c]).forEach(function(k) { must(Object.prototype.hasOwnProperty.call(audit.settings[c], k), 'Missing setting: ' + c + '.' + k); });
    });
    must(audit.updater === 'idle', 'Updater must be idle');
    must(typeof audit.ip4Rules === 'string', 'IPv4 policy routing unavailable');
    must(audit.ip4Rules.trim().length > 0, 'Empty routing state');
    audit.ip4Rules.split('\n').filter(Boolean).forEach(function(line) {
        must(/^(0|32766|32767):\s+from all lookup (local|main|default)\s*$/.test(line), 'Existing custom policy-routing rules; manual review required');
    });
    return true;
}
function validatePlan(plan, profile) {
    must(plan.schema === 1 && plan.profile === profile.id, 'Wrong plan/profile');
    must(typeof plan.localNetworkOnly === 'boolean' && typeof plan.blockUpdates === 'boolean', 'Plan options must be explicit booleans');
    must(/^com\.webos\.app\.hdmi[1-4]$/.test(plan.resumeInput), 'Choose an HDMI resume input');
}
function backupFile(state, target) {
    var stat = null;
    try { stat = fs.lstatSync(target); } catch (e) { if (e.code !== 'ENOENT') throw e; }
    must(!stat || stat.isFile(), 'Refusing non-regular target: ' + target);
    var exists = fs.existsSync(target), dst = BASE + '/backup/files' + target;
    if (exists) write(dst, fs.readFileSync(target), fs.statSync(target).mode & 511);
    state.files.push({target: target, existed: exists, mode: exists ? fs.statSync(target).mode & 511 : null});
}
function override(state, target, content) {
    must(!state.targets.some(function(e) { return e.target === target; }), 'Duplicate overlay');
    backupFile(state, target);
    write(BASE + '/overrides' + target, content, 420);
    state.targets.push({target: target, hash: home.hash(content), originalHash: probe.hashFile(target)});
}
function bootCheck(profile) {
    var state = read(BASE + '/state.json');
    var info = probe.luna('luna://com.webos.service.tv.systemproperty/getSystemInfo', {keys: Object.keys(profile.identity)});
    Object.keys(profile.identity).forEach(function(k) { must(info[k] === profile.identity[k], 'Firmware changed; restore before further use'); });
    state.targets.forEach(function(e) {
        var mounted = probe.run('mountpoint', ['-q', e.target]) !== null;
        must(probe.hashFile(e.target) === (mounted ? e.hash : e.originalHash), 'A target changed; refusing stale overlays');
    });
    return {ok: true};
}
function prepare(profile, plan, audit) {
    supported(audit, profile); validatePlan(plan, profile);
    var settings = JSON.parse(JSON.stringify(profile.settings));
    if (!plan.blockUpdates) delete settings.support;
    if (!plan.localNetworkOnly) delete settings.network;
    settings.general.defaultApps = Object.assign({}, audit.settings.general.defaultApps, settings.general.defaultApps);
    var state = {schema: 1, profile: profile.id, identity: audit.identity, plan: plan, phase: 'preparing',
        files: [], targets: [], originalSettings: audit.settings, desiredSettings: settings,
        originalPreloads: audit.preloads, updateFlagExisted: fs.existsSync('/var/luna/preferences/webosbrew_block_updates')};
    mkdir(BASE + '/backup'); json(BASE + '/state.json', state);
    ['engine.js', 'probe.js', 'fullhome.js', 'profile.json'].forEach(function(f) {
        write(BASE + '/controller/' + f, fs.readFileSync(__dirname + '/' + f));
    });
    must(!fs.existsSync(HOOK), 'An existing boot hook uses this toolkit name');
    profile.units.forEach(function(u) {
        try { fs.lstatSync('/run/systemd/transient/' + u + '.service'); }
        catch (e) { if (e.code === 'ENOENT') return; throw e; }
        throw new Error('An optional service already has a transient definition; manual review required');
    });
    profile.qml.forEach(function(e) { override(state, e.target, home.patch(e, fs.readFileSync(e.target))); });
    profile.hiddenAppManifests.forEach(function(target) {
        if (!fs.existsSync(target)) return;
        var info = read(target); info.visible = false;
        override(state, target, JSON.stringify(info, null, 2));
    });
    var bins = profile.dynamicBinaries.filter(function(b) { return plan.blockUpdates || b !== 'update'; });
    ['/usr/share/luna-service2/services.d', '/usr/share/dbus-1/services', '/usr/share/dbus-1/system-services'].forEach(function(dir) {
        if (!fs.existsSync(dir)) return;
        fs.readdirSync(dir).filter(function(f) { return /\.service$/.test(f); }).forEach(function(f) {
            var target = dir + '/' + f, text = fs.readFileSync(target, 'utf8');
            var match = /^Exec=(\S+)/m.exec(text);
            if (!match || !/^Type=dynamic\s*$/m.test(text) || bins.indexOf(path.basename(match[1])) < 0) return;
            override(state, target, text.replace(/^Exec=.*$/m, 'Exec=/bin/false'));
        });
    });
    state.units = profile.units.filter(function(u) { return plan.blockUpdates || u !== 'update'; });
    write(BASE + '/units.txt', state.units.join('\n') + '\n');
    write(BASE + '/processes.txt', profile.processBinaries.filter(function(b) { return plan.blockUpdates || b !== 'update'; }).join('\n') + '\n');
    write(BASE + '/targets.txt', state.targets.map(function(e) { return e.target; }).join('\n') + '\n');
    write(BASE + '/preloads.jsonl', profile.disabledPreloads.map(function(id) { return JSON.stringify({application: {id: id, isEnabled: false}}); }).join('\n') + '\n');
    json(BASE + '/resume-input.json', {id: plan.resumeInput});
    state.newPreloads = audit.preloads.map(function(e) {
        e = Object.assign({}, e);
        if (profile.disabledPreloads.indexOf(e.id) >= 0) e.isEnabled = false;
        return e;
    });
    write(BASE + '/runtime.sh', fs.readFileSync(__dirname + '/runtime.sh'), 448);
    if (plan.localNetworkOnly) {
        backupFile(state, ENV);
        state.ipv6 = {};
        ['all', 'default'].forEach(function(n) { state.ipv6[n] = fs.readFileSync('/proc/sys/net/ipv6/conf/' + n + '/disable_ipv6', 'utf8').trim(); });
        write(GUARD + '/local-only.sh', fs.readFileSync(__dirname + '/local-only.sh'), 493);
        var real = ['/sbin/sysctl', '/usr/sbin/sysctl', '/bin/sysctl', '/usr/bin/sysctl'].filter(function(p) { return fs.existsSync(p); })[0];
        must(real, 'No original sysctl found');
        write(GUARD + '/bin/sysctl', '#!/bin/sh\n{\n printf "BEFORE_CONNMAND_UPTIME "; cat /proc/uptime\n ' + GUARD + '/local-only.sh\n} >> /tmp/webos-display-only-early.log 2>&1\nexec ' + real + ' "$@"\n', 493);
        // ConnMan runs as dbus with capabilities; its wrapper must be traversable.
        [BASE, GUARD, GUARD + '/bin'].forEach(function(p) { fs.chmodSync(p, 493); });
        var prior = fs.existsSync(ENV) ? fs.readFileSync(ENV, 'utf8') : '';
        state.newEnvironment = prior.split('\n').filter(function(line) { return !/^PATH=/.test(line); }).join('\n') +
            '\nPATH=' + GUARD + '/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin\n';
        state.environmentHash = home.hash(state.newEnvironment);
        state.environmentMode = state.files.filter(function(e) { return e.target === ENV; })[0].mode || 420;
    }
    state.phase = 'prepared'; json(BASE + '/state.json', state);
    return state;
}
function apply(profile, plan) {
    validatePlan(plan, profile);
    var audit = probe.collect(profile);
    // A stale plan cannot silently target another TV or changed settings.
    must(same(audit, plan.audit), 'TV state changed since the plan; audit and plan again');
    if (plan.localNetworkOnly) {
        var peer = (process.env.SSH_CONNECTION || '').split(' ')[0];
        must(/^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.|127\.)/.test(peer), 'Local-network-only requires an IPv4 private/local SSH connection');
    }
    var state = prepare(profile, plan, audit);
    try {
        state.phase = 'applying'; json(BASE + '/state.json', state);
        Object.keys(state.desiredSettings).forEach(function(category) {
            probe.luna('luna://com.webos.settingsservice/setSystemSettings', {category: category, settings: state.desiredSettings[category]});
        });
        var configs = {}; configs[PRELOAD] = state.newPreloads;
        probe.luna('luna://com.webos.service.config/setConfigs', {configs: configs});
        if (plan.blockUpdates) {
            // Only run this while the earlier idle-state preflight still holds.
            must(probe.luna('luna://com.webos.service.update/getCurStatus').status === 'idle', 'Updater became busy');
            probe.luna('luna://com.webos.service.update/deleteUpdateInfo');
            write('/var/luna/preferences/webosbrew_block_updates', '');
        }
        if (plan.localNetworkOnly) {
            exec('sh', [GUARD + '/local-only.sh']);
            write(ENV, state.newEnvironment, state.environmentMode);
            must(state.environmentHash === probe.hashFile(ENV), 'Network environment write failed');
        }
        write(HOOK, '#!/bin/sh\n[ -f ' + BASE + '/enabled ] || exit 0\n' +
            (plan.localNetworkOnly ? GUARD + '/local-only.sh > /tmp/webos-display-only-network.log 2>&1\n' : '') +
            BASE + '/runtime.sh > /tmp/webos-display-only-runtime.log 2>&1\n', 448);
        write(BASE + '/enabled', '');
        exec('sh', [BASE + '/runtime.sh']);
        state.phase = 'applied'; json(BASE + '/state.json', state);
        var checked = status(profile);
        must(checked.ok, 'Verification failed; use restore and inspect private state');
        return checked;
    } catch (e) {
        state.phase = 'failed'; state.error = e.message; json(BASE + '/state.json', state);
        throw new Error(e.message + '; backups retained. Run restore before retrying.');
    }
}
function status(profile) {
    var state = read(BASE + '/state.json'), checks = {};
    must(state.profile === profile.id, 'Installed profile mismatch');
    var identity = probe.luna('luna://com.webos.service.tv.systemproperty/getSystemInfo', {keys: Object.keys(profile.identity)});
    checks.identity = Object.keys(profile.identity).every(function(k) { return identity[k] === profile.identity[k]; });
    checks.applied = state.phase === 'applied' && fs.existsSync(BASE + '/enabled');
    checks.homeOverlays = state.targets.every(function(e) { return probe.hashFile(e.target) === e.hash && probe.run('mountpoint', ['-q', e.target]) !== null; });
    checks.coreServices = profile.coreUnits.every(function(u) { return probe.run('systemctl', ['is-active', u + '.service']) === 'active'; });
    checks.optionalServicesStopped = state.units.every(function(u) {
        return probe.run('systemctl', ['show', u + '.service', '--property=MainPID', '--value']) === '0' &&
            fs.existsSync('/run/systemd/transient/' + u + '.service') && fs.lstatSync('/run/systemd/transient/' + u + '.service').isSymbolicLink();
    });
    checks.settings = Object.keys(state.desiredSettings).every(function(c) {
        var got = probe.luna('luna://com.webos.settingsservice/getSystemSettings', {category: c, keys: Object.keys(state.desiredSettings[c])}).settings;
        return Object.keys(state.desiredSettings[c]).every(function(k) { return same(got[k], state.desiredSettings[c][k]); });
    });
    var preloads = probe.luna('luna://com.webos.service.config/getConfigs', {configNames: [PRELOAD]}).configs || {};
    checks.preloads = same(preloads[PRELOAD], state.newPreloads);
    if (state.plan.localNetworkOnly) {
        // Route failure alone is not proof: also check that the policy guard exists.
        var rules = probe.run('ip', ['-4', 'rule', 'show']) || '';
        checks.publicIpv4Blocked = /^129:.*unreachable/m.test(rules) && probe.run('ip', ['-4', 'route', 'get', '1.1.1.1']) === null;
        checks.ipv6Disabled = ['all', 'default'].every(function(n) { return fs.readFileSync('/proc/sys/net/ipv6/conf/' + n + '/disable_ipv6', 'utf8').trim() === '1'; });
        checks.earlyStartupConfigured = probe.hashFile(ENV) === state.environmentHash;
    }
    var earlyLog = fs.existsSync('/tmp/webos-display-only-early.log') ? fs.readFileSync('/tmp/webos-display-only-early.log', 'utf8') : '';
    return {ok: Object.keys(checks).every(function(k) { return checks[k]; }), checks: checks,
        earlyGuardObservedThisBoot: /BEFORE_CONNMAND_UPTIME/.test(earlyLog) && /LOCAL_NETWORK_ONLY_APPLIED/.test(earlyLog),
        note: 'After a cold reboot, rerun status, check earlyGuardObservedThisBoot when blocking internet, and verify local control and both HDMI inputs.'};
}
function restore(profile) {
    var state = read(BASE + '/state.json');
    must(state.profile === profile.id, 'Restore profile mismatch');
    must(state.phase !== 'restored', 'Already restored; reboot to finish');
    // Disable hooks before undoing runtime overlays; keep the private backups.
    if (fs.existsSync(BASE + '/enabled')) fs.unlinkSync(BASE + '/enabled');
    if (fs.existsSync(HOOK)) fs.unlinkSync(HOOK);
    if (state.plan.localNetworkOnly && state.environmentHash) {
        var oldEnvironmentHash = state.plan.audit.connectionEnvironmentHash;
        must(probe.hashFile(ENV) === state.environmentHash || probe.hashFile(ENV) === oldEnvironmentHash,
            'ConnMan environment changed after installation; restore its saved PATH manually');
        state.files.filter(function(e) { return e.target === ENV; }).forEach(function(e) {
            if (e.existed) write(e.target, fs.readFileSync(BASE + '/backup/files' + e.target), e.mode);
            else if (fs.existsSync(e.target)) fs.unlinkSync(e.target);
        });
    }
    state.targets.slice().reverse().forEach(function(e) {
        if (probe.run('mountpoint', ['-q', e.target]) !== null) {
            must(probe.hashFile(e.target) === e.hash, 'A different overlay replaced ours; manual recovery required');
            exec('umount', [e.target]);
        }
    });
    (state.units || []).forEach(function(u) {
        var p = '/run/systemd/transient/' + u + '.service';
        if (fs.existsSync(p) && fs.lstatSync(p).isSymbolicLink() && fs.readlinkSync(p) === '/dev/null') fs.unlinkSync(p);
    });
    Object.keys(state.desiredSettings).forEach(function(category) {
        probe.luna('luna://com.webos.settingsservice/setSystemSettings', {category: category, settings: state.originalSettings[category]});
    });
    var configs = {}; configs[PRELOAD] = state.originalPreloads;
    probe.luna('luna://com.webos.service.config/setConfigs', {configs: configs});
    if (state.plan.blockUpdates && !state.updateFlagExisted && fs.existsSync('/var/luna/preferences/webosbrew_block_updates')) fs.unlinkSync('/var/luna/preferences/webosbrew_block_updates');
    if (state.plan.localNetworkOnly && state.ipv6) {
        [120,121,122,123,124,125,126,127,129].forEach(function(priority) { probe.run('ip', ['-4','rule','del','priority',String(priority)]); });
        ['all', 'default'].forEach(function(n) { fs.writeFileSync('/proc/sys/net/ipv6/conf/' + n + '/disable_ipv6', state.ipv6[n]); });
    }
    exec('systemctl', ['daemon-reload']);
    exec('/usr/sbin/ls-control', ['scan-services']);
    exec('sh', ['-c', 'rm -rf /tmp/checkpoint/com.webos.app.fullhome /mnt/lg/cmn_data/checkpoint/com.webos.app.fullhome']);
    state.phase = 'restored'; json(BASE + '/state.json', state);
    return {ok: true, rebootRequired: true, note: 'Reboot manually to restore normal service startup; root/Homebrew remain installed.'};
}
module.exports = {supported: supported, validatePlan: validatePlan, prepare: prepare, same: same};
if (require.main === module) {
    try {
        must(process.getuid() === 0, 'Root is required');
        var command = process.argv[2], profile = read(__dirname + '/profile.json'), result;
        if (command === 'apply') result = apply(profile, read(__dirname + '/plan.json'));
        else if (command === 'status') result = status(profile);
        else if (command === 'restore') result = restore(profile);
        else if (command === 'boot-check') result = bootCheck(profile);
        else throw new Error('Unknown command');
        console.log(JSON.stringify(result));
        if (!result.ok) process.exitCode = 1;
    } catch (e) { console.error(e.message); process.exitCode = 1; }
}
