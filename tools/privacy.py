#!/usr/bin/env python3
"""Scan the Git index and every reachable commit before publishing.

Only paths and finding categories are printed; suspected values are never printed.
An optional private deny file has one literal value per line and must stay outside Git.
"""
import argparse
import ipaddress
from pathlib import Path
import re
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]
ALLOWED_IPS = {'10.0.0.0', '172.16.0.0', '192.168.0.0', '169.254.0.0',
               '127.0.0.0', '127.0.0.1', '224.0.0.0', '255.255.255.255',
               '239.255.255.250', '1.1.1.1'}
ALLOWED_EMAILS = {'noreply@users.noreply.github.com'}
TEXT_SUFFIXES = {'.md', '.py', '.js', '.sh', '.json', '.yml', '.yaml'}
PATTERNS = {
    'private home path': re.compile(rb'/(?:Users|home)/[A-Za-z0-9_.-]+/(?!root\b)'),
    'MAC address': re.compile(rb'(?i)(?<![0-9a-f])(?:[0-9a-f]{2}:){5}[0-9a-f]{2}(?![0-9a-f])'),
    'private key': re.compile(rb'-----BEGIN [A-Z ]*PRIVATE KEY-----'),
    'access token': re.compile(rb'(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{30,}|sk-[A-Za-z0-9_-]{24,})'),
    'unique device/session identifier': re.compile(rb'(?i)\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b'),
    'device key assignment': re.compile(rb'(?i)[\"\x27]?(?:client[-_]?key|serial(?:Number)?|device[-_]?id|ssid)[\"\x27]?\s*[:=]\s*[\"\x27][^\"\x27\n]{5,}[\"\x27]'),
}


def git(*args):
    return subprocess.check_output(['git', '-C', str(ROOT), *args])


def findings(path, data, deny=()):
    result = []
    p = Path(path)
    if (any(part in {'.private', 'work', 'backups', 'outputs', 'node_modules'} for part in p.parts)
            or re.search(r'(?i)(pairing|known_hosts|rollback|_results\.|\.env(?:\.|$))', p.name)):
        result.append('private/generated filename')
    if p.suffix not in TEXT_SUFFIXES and p.name not in {'.gitignore', 'LICENSE', 'Makefile'}:
        result.append('unapproved file type')
    if b'\x00' in data:
        result.append('binary content')
    for label, pattern in PATTERNS.items():
        if pattern.search(data):
            result.append(label)
    for candidate in re.findall(rb'(?<![\w.])(?:\d{1,3}\.){3}\d{1,3}(?![\w.])', data):
        value = candidate.decode()
        try:
            ipaddress.ip_address(value)
        except ValueError:
            continue
        if value not in ALLOWED_IPS:
            result.append('unapproved IP address')
            break
    for candidate in re.findall(rb'[A-Za-z0-9_.+%-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}', data):
        if candidate.decode() not in ALLOWED_EMAILS:
            result.append('personal email address')
            break
    for candidate in re.findall(rb'(?<![0-9A-Za-z])(?:[0-9A-Fa-f]{0,4}:){2,}[0-9A-Fa-f]{0,4}(?![0-9A-Za-z])', data):
        try:
            address = ipaddress.IPv6Address(candidate.decode())
        except ValueError:
            continue
        if not (address.is_unspecified or address.is_loopback):
            result.append('unapproved IPv6 address')
            break
    if any(value and value in data for value in deny):
        result.append('private deny-list match')
    return sorted(set(result))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--deny-file', type=Path)
    parser.add_argument('--index-only', action='store_true')
    args = parser.parse_args()
    deny = args.deny_file.read_bytes().splitlines() if args.deny_file else []
    items = []
    for entry in git('ls-files', '--stage', '-z').split(b'\0'):
        if not entry:
            continue
        metadata, raw_path = entry.split(b'\t', 1)
        mode, sha, stage = metadata.decode().split()
        path = raw_path.decode('utf8')
        if mode not in {'100644', '100755'} or stage != '0':
            items.append((path, b'', ['non-regular or unmerged index entry']))
        else:
            items.append((path, git('cat-file', 'blob', sha), []))
    has_head = subprocess.run(['git', '-C', str(ROOT), 'rev-parse', '--verify', '--quiet', 'HEAD'],
                              stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL).returncode == 0
    if not args.index_only and has_head:
        for commit in git('rev-list', '--all').decode().splitlines():
            for item in git('ls-tree', '-r', '-z', commit).split(b'\0'):
                if not item:
                    continue
                meta, raw_path = item.split(b'\t', 1)
                mode, kind, sha = meta.decode().split()
                extra = [] if mode in {'100644', '100755'} and kind == 'blob' else ['non-regular history entry']
                data = git('cat-file', 'blob', sha) if kind == 'blob' else b''
                items.append((raw_path.decode(), data, extra))
            # Also inspect author/committer identities and commit messages.
            data = git('cat-file', 'commit', commit)
            items.append(('commit-metadata', data, []))
    if not items:
        raise ValueError('No staged source files to inspect')
    count, seen = 0, set()
    for path, data, extra in items:
        labels = extra + findings(path if path != 'commit-metadata' else 'metadata.md', data, deny)
        for label in labels:
            item = (path, label)
            if item not in seen:
                print(path + ': ' + label, file=sys.stderr)
                seen.add(item)
        count += 1
    if seen:
        print('Privacy check failed; no suspect values were printed.', file=sys.stderr)
        return 1
    print('Privacy check passed for index and requested history (' + str(count) + ' entries).')
    return 0


if __name__ == '__main__':
    try:
        sys.exit(main())
    except (ValueError, OSError, subprocess.CalledProcessError) as error:
        print('Privacy scan could not finish: ' + type(error).__name__, file=sys.stderr)
        sys.exit(1)
