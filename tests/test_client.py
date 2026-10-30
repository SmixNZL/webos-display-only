import argparse
import copy
import importlib.util
import io
import json
from pathlib import Path
import tarfile
import unittest

ROOT = Path(__file__).resolve().parents[1]


def load(name):
    spec = importlib.util.spec_from_file_location(name, ROOT / 'tools' / (name + '.py'))
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


client = load('tv')
privacy = load('privacy')
PROFILE = json.loads(client.PROFILE.read_text())


def sample_audit():
    fingerprints = {e['target']: e['originalSha256'] for e in PROFILE['qml']}
    fingerprints.update(PROFILE['startupHashes'])
    return {'identity': copy.deepcopy(PROFILE['identity']), 'uid': 0, 'homebrew': {'root': True},
            'startupAvailable': True, 'legacyCleanupPresent': False, 'installed': False,
            'fingerprints': fingerprints, 'updater': 'idle', 'preloads': [],
            'settings': copy.deepcopy(PROFILE['settings']),
            'ip4Rules': '0: from all lookup local\n32766: from all lookup main\n32767: from all lookup default'}


class ClientTests(unittest.TestCase):
    def test_supported_plan_has_explicit_opt_ins(self):
        args = argparse.Namespace(local_network_only=False, block_updates=False, resume_hdmi=3)
        plan = client.plan_for(sample_audit(), PROFILE, args)
        self.assertFalse(plan['localNetworkOnly'])
        self.assertFalse(plan['blockUpdates'])
        self.assertEqual(plan['resumeInput'], 'com.webos.app.hdmi3')

    def test_rejects_changed_firmware_source_root_and_conflicts(self):
        cases = []
        value = sample_audit(); value['identity']['firmwareVersion'] = 'unknown'; cases.append(value)
        value = sample_audit(); value['fingerprints'][PROFILE['qml'][0]['target']] = '0' * 64; cases.append(value)
        value = sample_audit(); value['uid'] = 1000; cases.append(value)
        value = sample_audit(); value['legacyCleanupPresent'] = True; cases.append(value)
        value = sample_audit(); value['installed'] = True; cases.append(value)
        value = sample_audit(); value['updater'] = 'installing'; cases.append(value)
        value = sample_audit(); value['ip4Rules'] += '\n120: from all lookup custom'; cases.append(value)
        value = sample_audit(); value['settings']['general'].pop('homeAutoLaunch'); cases.append(value)
        for data in cases:
            with self.subTest(data=data):
                with self.assertRaises(ValueError):
                    client.validate_audit(data, PROFILE)

    def test_ssh_options_and_shell_input_are_rejected(self):
        for value in ('-oProxyCommand=bad', 'tv;id', 'tv\ncommand', 'root@host/other', 'tv $(id)'):
            with self.assertRaises(argparse.ArgumentTypeError):
                client.target(value)
        self.assertEqual(client.target('my-tv'), 'my-tv')

    def test_bundle_has_only_known_files_and_private_plan(self):
        data = client.bundle(PROFILE, {'schema': 1})
        with tarfile.open(fileobj=io.BytesIO(data), mode='r:gz') as archive:
            self.assertEqual(set(archive.getnames()), {'engine.js', 'probe.js', 'fullhome.js', 'runtime.sh',
                                                      'local-only.sh', 'profile.json', 'plan.json'})
            self.assertTrue(all(e.mode == 0o600 and e.isfile() for e in archive))


class PrivacyTests(unittest.TestCase):
    def test_sensitive_values_and_binary_assets_fail(self):
        # Construct artificial canaries; no real device/user data is needed.
        samples = [b'client' + b'Key="canary-value"', b'ghp_' + b'x' * 32,
                   b'\x00binary', b'/Users/' + b'canary/private.txt',
                   b'canary' + b'@example.invalid', b'aa:' * 5 + b'aa',
                   b'192.168.' + b'50.77']
        for sample in samples:
            self.assertTrue(privacy.findings('example.md', sample))
        self.assertTrue(privacy.findings('.private/settings.json', b'{}'))
        self.assertTrue(privacy.findings('photo.png', b'pixels'))

    def test_known_private_literals_are_checked_without_echo(self):
        self.assertEqual(privacy.findings('example.md', b'a canary value', [b'canary']), ['private deny-list match'])

    def test_required_network_constants_and_generic_identity_pass(self):
        data = (' '.join(sorted(privacy.ALLOWED_IPS)) + ' noreply@users.noreply.github.com').encode()
        self.assertEqual(privacy.findings('example.md', data), [])


if __name__ == '__main__':
    unittest.main()
