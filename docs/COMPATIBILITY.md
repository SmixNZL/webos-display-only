# Compatibility and scope

| Item | Reference setup |
|---|---|
| TV model | LG 65UN8160PVA |
| Firmware | 04.63.25 |
| webOS / SDK | 5.6.1 |
| TV Node.js | 8.12.0 |
| Persistent helper | Homebrew Channel 0.7.3 |
| Date of reference cold-boot verification | 2026-10-30 |
| Home | `com.webos.app.fullhome`, full-screen mode |

The reference recipe was applied and verified directly on one TV. The reusable installer was subsequently written from that recipe and checked locally. A fresh-TV end-to-end installation of the packaged installer and additional models remain unverified. Treat this as an early release.

Model/firmware checks and SHA-256 fingerprints of all three Home source files and both ConnMan startup files must match before installation. This is intentionally narrower than “all webOS 5 TVs.” There is no `--force` option.

## Preserved

- LG's full-screen Home and built-in background artwork, Settings and app editor.
- HDMI inputs and sound-output controls. All HDMI cards supplied by LG remain; only connected/named devices may appear.
- Core app manager, display composition, video, audio, input integration, ARC and network manager services.
- Existing picture and audio configuration, HDMI/CEC/ARC settings and DHCP.
- Root/Homebrew recovery access. No root password, pairing key or remote-shell setting is changed.

## Disabled or unavailable

The exact lists are in the profile. They include optional ad/recommendation, log-upload, voice/NLP, casting/AirPlay/HomeKit, IoT/ThinQ and sports components. LG phone-remote features that depend on those services may stop working. Local SSAP remote control was retained in the reference setup.

When local-only is selected, all TV internet features stop working: Content Store, online streaming, online guides, sign-in, online time services and downloads. An Apple TV or console uses its own independent network connection. Local IPv4 devices remain reachable; this is not a firewall around the household LAN.

Firmware blocking also blocks security patches. Restore this toolkit before installing a firmware update. Restoring updater access does not guarantee that an update will preserve root, the toolkit or any future exploit compatibility. The runtime refuses to mount stale overlays when the model/version or underlying target files have changed.

`tvdataexchanger`, `alwaysready`, core system applications, the service gateway and native Settings are not targets. Disabling broad/shared services can break video, aspect ratio, settings or other core behavior. A similar name on another firmware is not sufficient evidence that a service is safe to disable.

## Implementation limits

The Home card and offline-banner patches generate three bind overlays from the owner's original files. Boot reapplication invalidates only Full Home's derived launch snapshots so the changed QML is actually loaded. The underlying read-only partition is not flashed or rewritten.

Selected systemd units receive temporary masks; selected dynamic Luna definitions receive inert `Exec=/bin/false` overlays to prevent respawn. Eight app manifests receive `visible: false`. These changes survive reboot only through the Homebrew boot hook.

The reference kernel lacked usable iptables/IPv6 policy-routing support. IPv4 policy routing blocks public destinations; IPv6 is disabled. The early guard uses the existing ConnMan `sysctl` call through its environment PATH. The guard preserves the real sysctl invocation and falls through if applying the policy fails so a networking failure does not intentionally strand recovery access. The startup hook retries the policy later. A failed early guard can leave an internet-access window: inspect the cold-boot marker and rules, not just an offline icon.

Legacy optional agreement flags can be restored by firmware. This project does not claim permanent revocation of all LG consents. Its privacy measures are the actual settings/service changes and, when selected, the verified connection block.

## Adding a model

Do not edit identity values just to bypass the checks. On a separate authorized TV, inspect the APIs, settings, QML, launch snapshots, service definitions and network startup/capabilities. Test an independent rollback before installing persistent changes. Submit a sanitized profile and a short compatibility report; never submit the original TV files, raw inventories, keys or backups. Shared support requires real cold-boot, input, sound and recovery tests.
