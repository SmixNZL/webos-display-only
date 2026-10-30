#!/usr/bin/env python3
"""Local audit/plan/apply client. Python 3.9+, OpenSSH; no third-party packages."""
import argparse
import hashlib
import io
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import tarfile

ROOT = Path(__file__).resolve().parents[1]
PRIVATE = ROOT / '.private'
BASE = '/var/lib/webos-display-only'
PROFILE = ROOT / 'profiles/lg-un81-webos5.json'


def digest(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True, separators=(',', ':')).encode()).hexdigest()


def save_private(name, value):
    PRIVATE.mkdir(mode=0o700, exist_ok=True)
    PRIVATE.chmod(0o700)
    p = PRIVATE / name
    # Reject a planted symlink instead of overwriting a different file.
    fd = os.open(p, os.O_WRONLY | os.O_CREAT | os.O_TRUNC | os.O_NOFOLLOW, 0o600)
    with os.fdopen(fd, 'w') as f:
        json.dump(value, f, indent=2)
        f.write('\n')
    p.chmod(0o600)


def target(value):
    if not re.fullmatch(r'[A-Za-z0-9_][A-Za-z0-9_.@-]*', value):
        raise argparse.ArgumentTypeError('Use an SSH config alias or an IPv4 host, optionally root@host; no SSH options')
    return value


def ssh(destination, command, data=b''):
    # Never accept an unknown/replaced SSH host key automatically.
    result = subprocess.run([
        'ssh', '-o', 'BatchMode=yes', '-o', 'StrictHostKeyChecking=yes',
        '-o', 'ConnectTimeout=10', destination, command,
    ], input=data, stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=240)
    if result.returncode:
        save_private('last-error.json', {'command': command, 'returncode': result.returncode,
                                      'stderr': result.stderr.decode(errors='replace')})
        raise RuntimeError('TV command failed. Details are in ignored .private/last-error.json; do not post it publicly.')
    return result.stdout


def audit(destination, profile):
    source = (ROOT / 'tv/probe.js').read_text()
    script = ('var profile=' + json.dumps(profile) + ';\n' +
              'var probe=(function(){var module={exports:{}};\n' + source +
              '\nreturn module.exports;})();\n' +
              'try{console.log(JSON.stringify(probe.collect(profile)));}' +
              'catch(e){console.error(e.message);process.exitCode=1;}\n')
    return json.loads(ssh(destination, 'node -', script.encode()))


def validate_audit(data, profile):
    if data.get('identity') != profile['identity']:
        raise ValueError('Unsupported model/firmware. Only the documented profile is supported.')
    if data.get('uid') != 0 or not data.get('homebrew', {}).get('root') or not data.get('startupAvailable'):
        raise ValueError('An existing persistent Homebrew root is required.')
    if data.get('legacyCleanupPresent') or data.get('installed'):
        raise ValueError('A cleanup is already installed. Do not stack toolkits; use its own restore first.')
    expected = {e['target']: e['originalSha256'] for e in profile['qml']}
    expected.update(profile['startupHashes'])
    if data.get('fingerprints') != expected:
        raise ValueError('TV files differ from the tested originals. No force override is provided.')
    if data.get('updater') != 'idle' or not isinstance(data.get('preloads'), list):
        raise ValueError('Updater is busy or preload configuration is unavailable.')
    rules = data.get('ip4Rules')
    if not isinstance(rules, str) or not rules.strip():
        raise ValueError('IPv4 routing state is unavailable.')
    for line in rules.splitlines():
        if not re.fullmatch(r'(0|32766|32767):\s+from all lookup (local|main|default)\s*', line):
            raise ValueError('Existing custom routing rules need manual review.')
    for category, values in profile['settings'].items():
        if not set(values).issubset(data.get('settings', {}).get(category, {})):
            raise ValueError('A required TV setting is missing.')


def bundle(profile, plan):
    members = {}
    for name in ('engine.js', 'probe.js', 'fullhome.js', 'runtime.sh', 'local-only.sh'):
        f = ROOT / 'tv' / name
        if f.is_symlink():
            raise ValueError('Refusing a symbolic-link bundle member')
        members[name] = f.read_bytes()
    members['profile.json'] = (json.dumps(profile, indent=2) + '\n').encode()
    members['plan.json'] = (json.dumps(plan, indent=2) + '\n').encode()
    output = io.BytesIO()
    with tarfile.open(fileobj=output, mode='w:gz') as archive:
        for name, content in sorted(members.items()):
            if not re.fullmatch(r'[a-z0-9.-]+', name):
                raise ValueError('Unexpected bundle filename')
            info = tarfile.TarInfo(name)
            info.size = len(content)
            info.mode = 0o600
            info.mtime = 1767225600  # Fixed 2026-01-01 timestamp, no host metadata.
            archive.addfile(info, io.BytesIO(content))
    return output.getvalue()


def plan_for(data, profile, args):
    validate_audit(data, profile)
    return {'schema': 1, 'profile': profile['id'], 'profileDigest': digest(profile),
            'localNetworkOnly': args.local_network_only, 'blockUpdates': args.block_updates,
            'resumeInput': 'com.webos.app.hdmi' + str(args.resume_hdmi), 'audit': data}


def main(argv=None):
    parser = argparse.ArgumentParser(description='Make a supported rooted LG TV a display for external devices. Use at your own risk.')
    commands = parser.add_subparsers(dest='command', required=True)
    for name in ('audit', 'apply', 'status', 'restore', 'backup'):
        p = commands.add_parser(name)
        p.add_argument('--target', required=True, type=target, help='Existing root SSH config alias; host key must already be trusted')
        if name in ('apply', 'restore'):
            p.add_argument('--confirm', action='store_true', help='Apply the reviewed changes to your own TV')
    p = commands.add_parser('plan')
    p.add_argument('--local-network-only', action='store_true', help='Block direct public internet access, keep private/local IPv4 access, disable IPv6')
    p.add_argument('--block-updates', action='store_true', help='Disable firmware updates and clear the cached update prompt')
    p.add_argument('--resume-hdmi', type=int, choices=range(1, 5), required=True)
    args = parser.parse_args(argv)
    profile = json.loads(PROFILE.read_text())
    if args.command in ('apply', 'restore') and not args.confirm:
        parser.error('Review your plan/recovery instructions, then pass --confirm to authorize this operation')
    if args.command == 'audit':
        data = audit(args.target, profile)
        save_private('audit.json', {'target': args.target, 'data': data})
        print('Read-only audit saved privately. Next: plan. Compatibility is checked before a plan is created.')
    elif args.command == 'plan':
        saved = json.loads((PRIVATE / 'audit.json').read_text())
        plan = plan_for(saved['data'], profile, args)
        plan['target'] = saved['target']
        save_private('plan.json', plan)
        print('Plan: retain full-screen Home; hide four LG cards and the offline banner; hide eight built-in app tiles; disable optional services and preloads; disable promotions/ACR settings.')
        print('Public internet blocked:', plan['localNetworkOnly'], '| Firmware updates blocked:', plan['blockUpdates'], '| Resume HDMI:', args.resume_hdmi)
        print('Backups stay on the TV. Download them after applying. No apps will be uninstalled.')
    elif args.command == 'apply':
        plan = json.loads((PRIVATE / 'plan.json').read_text())
        if plan.get('target') != args.target:
            raise ValueError('SSH target differs from the audited target; audit and plan again.')
        if plan.get('profileDigest') != digest(profile):
            raise ValueError('Profile changed; audit and plan again.')
        if audit(args.target, profile) != plan['audit']:
            raise ValueError('TV state changed since the plan; audit and plan again.')
        data = bundle(profile, plan)
        release = BASE + '/releases/' + hashlib.sha256(data).hexdigest()[:20]
        # Generated path contains a fixed prefix and only a hex suffix.
        command = ('umask 077; mkdir -p ' + release + ' && tar -xzf - -C ' + release +
                   ' && node ' + release + '/engine.js apply')
        result = json.loads(ssh(args.target, command, data))
        save_private('last-result.json', result)
        print(json.dumps(result, indent=2))
    elif args.command == 'backup':
        # Do not include releases/plan copies or unrelated system/account files.
        data = ssh(args.target, 'tar -czf - -C ' + BASE + ' state.json backup')
        PRIVATE.mkdir(mode=0o700, exist_ok=True)
        fd = os.open(PRIVATE / 'rollback.tgz', os.O_WRONLY | os.O_CREAT | os.O_TRUNC | os.O_NOFOLLOW, 0o600)
        with os.fdopen(fd, 'wb') as f:
            f.write(data)
        print('Private rollback archive saved to .private/rollback.tgz. Never upload it.')
    else:
        # Use the controller from this installation, not an arbitrary release.
        result = json.loads(ssh(args.target, 'node ' + BASE + '/controller/engine.js ' + args.command))
        save_private('last-result.json', result)
        print(json.dumps(result, indent=2))


if __name__ == '__main__':
    try:
        main()
    except (RuntimeError, ValueError, OSError, subprocess.TimeoutExpired) as error:
        print(str(error), file=sys.stderr)
        sys.exit(1)
