import ipaddress
import json
import os
from pathlib import Path
import subprocess
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]


class NetworkTests(unittest.TestCase):
    def test_policy_keeps_local_access_and_blocks_public_destinations(self):
        # Run the real shell logic with a fake `ip` command and private fake sysctls.
        with tempfile.TemporaryDirectory(prefix='display-policy-') as directory:
            base = Path(directory)
            bin_dir = base / 'bin'; bin_dir.mkdir()
            fake = bin_dir / 'ip'
            fake.write_text('''#!/usr/bin/env python3
import json, os, sys
from pathlib import Path
p=Path(os.environ['POLICY_TEST_STATE'])
rules=json.loads(p.read_text()) if p.exists() else {}
a=sys.argv[1:]
if a==['-4','rule','show']:
    print(''.join(k+': '+v+'\\n' for k,v in sorted(rules.items(),key=lambda e:int(e[0]))),end='')
elif a[:3]==['-4','rule','del']:
    rules.pop(a[4],None)
elif a[:3]==['-4','rule','add']:
    rules[a[4]]=' '.join(a[5:])
elif a!=['-4','route','flush','cache']:
    sys.exit(2)
p.write_text(json.dumps(rules))
''')
            fake.chmod(0o700)
            for label in ('all', 'default'):
                p = base / 'sysctl' / label / 'disable_ipv6'
                p.parent.mkdir(parents=True); p.write_text('0')
            script = (ROOT / 'tv/local-only.sh').read_text().replace('/proc/sys/net/ipv6/conf/', str(base / 'sysctl') + '/')
            env = dict(os.environ, PATH=str(bin_dir) + os.pathsep + os.environ['PATH'], POLICY_TEST_STATE=str(base / 'rules.json'))
            for _ in range(2):
                subprocess.run(['sh', '-s'], input=script, text=True, env=env, check=True, stdout=subprocess.PIPE)
            rules = json.loads((base / 'rules.json').read_text())
            self.assertEqual(len(rules), 9)
            self.assertEqual(rules['129'], 'unreachable')
            allowed = [ipaddress.ip_network(value.split()[1]) for key, value in rules.items() if key != '129']
            def permits(parts):
                address = ipaddress.ip_address('.'.join(str(p) for p in parts))
                return any(address in network for network in allowed)
            self.assertTrue(permits((10, 3, 4, 5)))
            self.assertTrue(permits((172, 20, 0, 7)))
            self.assertTrue(permits((192, 168, 2, 8)))
            self.assertTrue(permits((239, 255, 255, 250)))
            self.assertFalse(permits((1, 1, 1, 1)))
            self.assertFalse(permits((8, 8, 8, 8)))
            self.assertFalse(permits((224, 1, 1, 1)))
            self.assertFalse(permits((172, 15, 0, 7)))
            for label in ('all', 'default'):
                self.assertEqual((base / 'sysctl' / label / 'disable_ipv6').read_text(), '1')


if __name__ == '__main__':
    unittest.main()
