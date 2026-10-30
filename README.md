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

## Paste into ChatGPT

Copy the whole prompt below into a new ChatGPT conversation. It includes the repository link; you do not need to put your TV's address, credentials or other private details in the prompt.

Direct control requires tools running on a computer that can reach your TV, with the necessary permissions. Pasting a prompt does not grant local access. The prompt asks the assistant to check what access it actually has and guide you when direct control is unavailable. See [OpenAI's access and approval documentation](https://learn.chatgpt.com/docs/agent-approvals-security).

```text
Help me use this project to clean up my own LG webOS TV:
https://github.com/SmixNZL/webos-display-only

My goal is to use the TV mainly as a screen for external HDMI devices, such as an Apple TV or games console. I want less LG advertising, tracking, unwanted apps and background activity while preserving picture, sound, HDMI switching, CEC/ARC, local maintenance access and the full-screen LG Home layout. I understand this is an early project and changes are at my own risk.

Read the current README, compatibility, rooting, setup, recovery, privacy and validation guides, plus the relevant scripts, before proposing commands. If you cannot read the repository, say so and ask for the needed files instead of guessing their contents.

First check what tools and local network access this session actually has. If you can operate on my computer, use authorized tools to do the work. If you cannot reach my TV or run local commands, explain that and guide me through the necessary steps. Never claim to have connected, paired, changed a setting or verified a result without evidence.

Start with read-only discovery scoped to my TV. Identify its exact model, firmware, webOS/SDK version and existing root/Homebrew status. Ask which HDMI devices, TV apps, casting, voice and other features I use. Do not assume my setup matches the reference TV.

Compare my TV with the current supported profiles and source-file checks. If it is unsupported or the checks fail, keep the work read-only and explain what independent investigation and validation would be needed. Do not force installation, edit identifiers to bypass checks, or assume rootability means cleanup compatibility.

Show me a concrete cleanup plan and explain any features I would lose. Get explicit approval for rooting/persistent root, app deletion, firmware-update blocking and internet blocking before doing those things. Ask whether I want the TV's internet blocked while keeping local access. Do not change my router or unrelated devices. Once I approve a specific scope, complete that work without repeatedly asking for the same approval; ask again only for new scope or required permissions.

Save originals and prepare a recovery route before changes. Use the project's audit, plan, apply, backup and status workflow for a supported TV. Explain the difference between hiding apps and uninstalling them. Keep the documented firmware, Home and core-service safeguards in place.

Keep addresses, pairing/SSH keys, device/account identifiers, logs and backups in ignored private local storage. Do not ask me to paste secrets into chat or publish them in GitHub issues. Preserve SSH host-key verification and HTTPS verification. Use the rooting guide if needed, and do not leave default-password or unauthenticated remote access exposed.

Verify settings and services, then check again after a full reboot. Test Home navigation, HDMI inputs, picture, sound, local control and any CEC/ARC features I use. If internet blocking was approved, verify public connections are blocked, local access remains available and the early startup guard ran. Report exactly what changed, what passed, what still needs checking and how to undo the cleanup. If a check fails, investigate and use the recovery path rather than stacking more changes.
```

The reference work was completed with ChatGPT. Claude or any other LLM may interpret this prompt differently, and another ChatGPT session may also produce different results. The prompt cannot expand the toolkit's compatibility or guarantee a successful cleanup.

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
