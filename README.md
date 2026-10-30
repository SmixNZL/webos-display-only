# webOS Display Only

Make a rooted LG TV quieter and simpler when an Apple TV, PlayStation, Xbox or other HDMI device does the work. Keep LG's full-screen Home, with just the useful input and sound cards.

**Use at your own risk. Root-level changes can break TV features, interrupt networking or leave the TV needing recovery. No warranty is provided.**

**Completed with ChatGPT.** The reference TV cleanup and this toolkit were completed with ChatGPT. Claude or any other LLM may recommend different steps or produce different results, even from the same prompt. Review generated instructions and follow the documented compatibility checks, backups and verification steps. Using ChatGPT again does not guarantee the same outcome either.

This is an early toolkit based on changes tested on **LG 65UN8160PVA, firmware 04.63.25, webOS/SDK 5.6.1**. The reference changes survived cold restarts and retained HDMI picture, audio and local control. The packaged installer has local automated tests; it has not yet been installed on a second, stock TV. Other models and firmware are unsupported. There is no force-compatibility switch.

## What it does

- Keeps the original full-screen Home layout and background. Removes **Home Dashboard, Mobile, Live TV and User Guide** cards, retaining HDMI inputs and sound controls.
- Hides Home's offline connection banner without pretending the TV is online.
- Hides eight built-in LG app tiles, disables ten optional app preloads, and disables the optional services listed in the [profile](profiles/lg-un81-webos5.json).
- Turns off supported promotions, Live Plus viewing recognition, viewing-list collection and selected advertising/voice settings.
- With `--block-updates`, clears the cached update reminder and disables the firmware updater. **This also prevents security updates.**
- With `--local-network-only`, blocks direct public IPv4 connections and disables IPv6. Private/local IPv4, DHCP and limited local discovery remain available. The block is installed before ConnMan starts, with a Homebrew startup fallback. No router changes are needed.
- Saves originals privately on the TV and provides a restore command.

It does not change picture calibration, HDMI/CEC/ARC configuration, audio settings or the root filesystem on disk. Changes to LG app/service files use temporary bind mounts, reapplied at boot. It does disable voice assistants, casting/AirPlay/HomeKit, ThinQ/IoT, sports prompts and other optional features. Read the [compatibility notes](docs/COMPATIBILITY.md) before applying it.

The toolkit **does not uninstall apps**. Remove unwanted streaming apps through LG's native app editor first if you want the same minimal app row; see [setup](docs/SETUP.md). Homebrew Channel and LG's app-edit control remain available.

## Rooting your TV

Start with the [rooting guide](docs/ROOTING.md) if your TV is not rooted. It covers firmware checks, the SlopBro entry point used on the reference TV, Homebrew Channel, local pairing and private SSH access. Rooting changes the TV's boot/security behavior and is a separate decision from cleanup. Other firmware needs its own compatible method.

## Quick start

Requirements: an already rooted, supported TV with persistent **Homebrew Channel**, an owner-authorized root SSH connection, Python 3.9+ and OpenSSH on macOS or Linux (Windows users can use WSL). You must already have verified the TV's SSH host key. Follow the [rooting guide](docs/ROOTING.md) to establish these prerequisites; the cleanup client does not acquire root or enable remote shells.

Use an SSH config alias such as `my-tv` for your own TV. Keep addresses and keys in your private SSH configuration. The full process is in [setup](docs/SETUP.md).

```sh
git clone https://github.com/SmixNZL/webos-display-only.git
cd webos-display-only
python3 tools/tv.py audit --target my-tv
python3 tools/tv.py plan --resume-hdmi 2 --local-network-only --block-updates
```

Review the summary and ignored `.private/plan.json`. Select the HDMI port connected to your external player; `2` is only an example. The two optional flags explicitly opt into losing TV internet access and firmware updates.

```sh
python3 tools/tv.py apply --target my-tv --confirm
python3 tools/tv.py backup --target my-tv
python3 tools/tv.py status --target my-tv
```

The installer rechecks model, firmware, source hashes and the complete audited state before changes. Unknown or already modified firmware is rejected. Do not stack this with another debloat tool. Applying may briefly restart LG's Home/app manager and interrupt the picture.

Cold reboot the TV, wait for local connectivity to return, then run `status` again. With internet blocking enabled, check `earlyGuardObservedThisBoot` as well as `ok`. Verify HDMI picture, sound, CEC/ARC if used, both device cards, and Home navigation. A successful status report is not a guarantee about every TV function.

## Undo

```sh
python3 tools/tv.py restore --target my-tv --confirm
```

Reboot the TV after restoring. The command removes this toolkit's boot hook/overlays, restores saved settings and preloads, and removes its routing rules. Root and Homebrew Channel remain installed. Apps you manually uninstalled need reinstalling separately. See [recovery](docs/RECOVERY.md), including recovery without the computer-side client. A factory reset is not a substitute for removing persistent root hooks.

## Privacy

Public source contains no pairing keys, real network addresses, device serials, account data, screenshots, logs or rollback archives. Model/firmware identifiers and firmware-file hashes describe compatibility, not an individual TV. GitHub necessarily displays the repository owner's public handle.

Your audit, plan, errors and downloaded backups are ignored under `.private/`, with restrictive permissions. Backups on the TV include original configuration and are private. **Never attach these files to a public issue.** The tool does not send data to this project or add any telemetry.

Before publishing changes:

```sh
git add README.md CONTRIBUTING.md docs profiles tools tv tests .github .gitignore LICENSE Makefile
python3 tools/privacy.py
make check
```

The privacy check scans staged contents and all reachable Git history, including commit metadata. It rejects suspicious credentials, email addresses, network/device identifiers, binary assets and private filenames. It supports an additional private literal deny list. Automated checks cannot identify every kind of personal information; review the diff and commit identities too. See [privacy](docs/PRIVACY.md).

## Development and credits

No Python or npm dependencies are required. Tests use Python, Node.js and a POSIX shell; they do not connect to or change a TV.

The project uses existing [webOS Homebrew Channel](https://github.com/webosbrew/webos-homebrew-channel) root/startup facilities. [Glasshouse](https://github.com/rorygallagher2024/glasshouse) and its [TV research](https://rorygallagher2024.github.io/glasshouse/development/TV-RESEARCH/) helped establish the QML and launch-checkpoint approach. [SlopBro](https://github.com/throwaway96/slopbro) was used separately to establish root on the reference TV; exploit code and third-party binaries are not bundled. Related projects include [lg-webos-ad-killer](https://github.com/nurikk/lg-webos-ad-killer) and [own-your-glass](https://github.com/JulioFerrero/own-your-glass).

Original toolkit code is MIT licensed. LG software and trademarks belong to their respective owners. Complete LG source files, artwork and firmware images are not distributed. The patch generator contains only the small matching expressions and transformations needed to operate on the owner's installed files. This project is independent of LG, Apple and Sony.
