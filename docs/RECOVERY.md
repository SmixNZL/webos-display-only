# Recovery

**Use at your own risk. Backups improve recovery options; they do not guarantee recovery.** A factory reset may leave persistent root hooks behind.

## Normal restore

Keep root SSH available until final testing is done:

```sh
python3 tools/tv.py restore --target my-tv --confirm
```

Then reboot through Homebrew Channel. Restore does not reboot automatically. It disables this project's hook first, unmounts its overlays, restores the saved settings/preloads and ConnMan environment, removes its IPv4 policy rules, and restores the prior IPv6 flags. Temporary unit masks and process state are fully reset by the reboot.

Restore retains the backup and installed controller. It does not uninstall Homebrew Channel, undo root, reinstall apps you manually deleted or undo unrelated changes. If another program changed the same ConnMan environment or replaced one of our overlays, restore stops and requires manual review rather than overwriting it.

## Without the computer-side client

Using an existing authorized root shell on the TV:

```sh
node /var/lib/webos-display-only/controller/engine.js restore
```

Reboot afterward. This uses the saved state and requires no TV internet access or GitHub download.

## If the TV cannot be reached

Open Homebrew Channel locally with the TV remote and use its existing maintenance/recovery facilities to regain your authorized root shell. Do not factory-reset or update firmware as a first attempt. Homebrew root access and its recovery facilities must already work before installing this toolkit.

The hook is `/var/lib/webosbrew/init.d/15-webos-display-only`. Removing `/var/lib/webos-display-only/enabled` stops the Homebrew hook/runtime, but **does not remove the early network guard**. That guard is introduced by the saved PATH in `/var/systemd/system/env/connman.env`. Use the saved original under `/var/lib/webos-display-only/backup/files/var/systemd/system/env/connman.env`, or remove the environment file if state records it as originally absent. Do not discard other programs' later changes to that file.

Prefer the controller's restore, which does these steps and removes the live policy rules. If you perform manual recovery, disable both startup paths before rebooting. Originals of overlaid app/service/QML files are under `backup/files`; the underlying read-only originals were never replaced on disk, so the bind mounts disappear at reboot once the hook is disabled.

The downloaded `.private/rollback.tgz` contains the private state and originals for inspection/recovery. It is not a firmware image and should not be blindly extracted over `/`. Keep it off public issues and repositories.

After restore and reboot, test Home, settings, picture, sound, inputs and local networking before making further changes. To reinstall, first archive the old `/var/lib/webos-display-only` folder privately after confirming recovery; a leftover state file intentionally prevents accidental reinstallation.
