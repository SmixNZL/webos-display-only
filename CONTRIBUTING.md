# Contributing

Start with the documented compatibility limits. New model support needs an independently tested profile and recovery path. Do not relax source-hash checks or add a global force switch.

Keep credentials, addresses, device/account identifiers, original LG files, captures and backups outside tracked source. Use synthetic fixtures in tests. Never submit the reference TV's private working directory.

Run `make check`, inspect your staged diff, then run `python3 tools/privacy.py`. The scanner checks history as well as the index. To avoid publishing a personal identity, use a project identity for commits in this repository:

```sh
git config user.name 'webOS Display Only contributors'
git config user.email 'noreply@users.noreply.github.com'
```

Review authorship requirements with any collaborators before publishing their work. Public GitHub account handles and pull-request activity remain visible even with a generic commit identity.

Keep installation local and dependency-free. Never download and execute firmware/rooting code automatically. Tests must not connect to or mutate a real TV. Firmware blocking, public-network blocking and app deletion must never become silent defaults.

The current toolkit performs no automatic app deletion. Describe manual native-menu removal separately from reversible hiding. Do not claim complete consent revocation or universal telemetry prevention.
