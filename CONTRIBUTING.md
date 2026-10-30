# Contributing

Start with the documented compatibility limits. New model support needs an independently tested profile and recovery path. Do not relax source-hash checks or add a global force switch.

Keep credentials, addresses, device/account identifiers, original LG files, captures and backups outside tracked source. Use synthetic fixtures in tests. Never submit the reference TV's private working directory.

Run `make check`, inspect your staged diff, then run `python3 tools/privacy.py`. The scanner checks history as well as the index. For correct attribution without revealing your personal name/email, use your public GitHub handle and copy your ID-based GitHub noreply address from Settings → Emails. Do not use another account's address or a shared generic identity.

```sh
printf 'Public GitHub handle: '
IFS= read -r GH_HANDLE
printf 'GitHub-provided ID-based noreply address: '
IFS= read -r GH_NOREPLY
git config user.name "$GH_HANDLE"
git config user.email "$GH_NOREPLY"
```

The scanner accepts ID-based GitHub noreply addresses while continuing to reject personal emails. Review authorship requirements with any collaborators before publishing their work. Public GitHub account handles and pull-request activity remain visible. See [GitHub's commit-email guidance](https://docs.github.com/en/account-and-profile/how-tos/email-preferences/setting-your-commit-email-address).

Keep installation local and dependency-free. Never download and execute firmware/rooting code automatically. Tests must not connect to or mutate a real TV. Firmware blocking, public-network blocking and app deletion must never become silent defaults.

The current toolkit performs no automatic app deletion. Describe manual native-menu removal separately from reversible hiding. Do not claim complete consent revocation or universal telemetry prevention.
