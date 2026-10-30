# Rooting your TV

**Use at your own risk. Rooting installs privileged code and can change boot behavior, expose remote access or leave the TV needing recovery. Do this only on a TV you own or are authorized to administer.**

Rooting is separate from debloating. The cleanup commands require an existing persistent root setup; they do not run an exploit for you. If Homebrew Channel already has working persistent root and you can connect as root, skip to [verify access](#verify-access-before-debloating).

## Check the model and firmware first

Find the model and full software version in LG Settings, usually under General → About This TV or Support → TV Information. Check [CanI.RootMy.TV](https://cani.rootmy.tv/) and the [webOSbrew rooting guide](https://www.webosbrew.org/rooting/) for a method appropriate to that exact firmware. Rootability can change with updates. Do not flash an older firmware or overwrite system partitions to follow this guide.

The reference TV was **65UN8160PVA / firmware 04.63.25 / SDK 5.6.1**. Root access was established through [SlopBro](https://github.com/throwaway96/slopbro), using source at commit `21023d56ca424607bb03d2939609cc658c655fc7`, then persistent Homebrew Channel **0.7.3**. The reference installation used a locally controlled administration payload; the unmodified upstream autoroot flow below was not separately tested end to end on that TV. It is an upstream starting point, not a promise of one-command success.

Rooting another model successfully does **not** make this toolkit's cleanup profile compatible. The debloater still refuses every other model/firmware combination.

## Prepare the local connection

Use Python **3.12** for the example below, matching the reference computer runtime, plus Git. The debloat client itself supports Python 3.9+. Keep the TV on and nearby so you can approve its pairing prompt.

The TV and computer need to reach each other on the local network. A guest/managed network may isolate devices even when both show the same Wi-Fi name. Allow the rooting tool's temporary local server through the computer firewall only on a trusted network. Do not forward ports on a router. Complete rooting and Homebrew installation **before** applying this project's internet block; the normal upstream installer downloads its package from GitHub.

Keep the rooting checkout inside this repository's ignored `.private/` directory. Its pairing key filenames, logs and other local files can reveal credentials and network details. Do not commit or post them.

## SlopBro example for the reference firmware

First clone this project and enter its folder, as shown in the README. Then download the upstream tool without executing it:

```sh
umask 077
mkdir -p .private/rooting
git clone https://github.com/throwaway96/slopbro.git .private/rooting/slopbro
git -C .private/rooting/slopbro checkout --detach 21023d56ca424607bb03d2939609cc658c655fc7
cd .private/rooting/slopbro
python3.12 slopbro.py --help
```

Review the pinned upstream README and the files it will run, especially `wwwroot/main.js` and `wwwroot/autoroot.sh`. The [upstream running instructions](https://github.com/throwaway96/slopbro/tree/21023d56ca424607bb03d2939609cc658c655fc7#running) explain the options. After deciding to proceed, enter **your own** TV's private IPv4 address at the prompt:

```sh
printf 'TV IPv4 address: '
IFS= read -r TV_ADDR
python3.12 slopbro.py --webos-version 5 --asset-source dir "$TV_ADDR"
```

Select Allow on the TV when its remote-app pairing prompt appears. Watch both the TV and computer for the result. SlopBro's normal autoroot payload installs Homebrew Channel and sets up persistence. Follow its Developer Mode app warning: if that app is installed, remove it before the instructed reboot, and do not reinstall it while rooted. A launch message or disappearing debug screen alone does not prove rooting succeeded.

If the wrong computer interface is selected, upstream supports `--local-ip` with your computer's own LAN address. Keep that value private. If pairing, local-server access or installation fails, stop and use upstream troubleshooting; do not repeatedly run additional exploits or bypass firmware checks. Leave HTTPS verification enabled; do not add `--curl-insecure` as a routine fix.

The reference Homebrew package is available from the official [0.7.3 release](https://github.com/webosbrew/webos-homebrew-channel/releases/tag/v0.7.3). Its SHA-256 was `d10bf3c753551d7c72fb7a92b20fcd2317e502a220ac668ba8e76f6ea78b363c`. A different release needs its own verification. Do not download a package or exploit from an untrusted mirror.

## Verify access before debloating

Open Homebrew Channel and confirm root functionality, then perform the instructed reboot and check that it still works. Developer Mode access as `prisoner`, including its usual port 9922, is not root.

For the SSH-based cleanup client, follow the official [Homebrew Channel rooted-TV SSH setup](https://github.com/webosbrew/webos-homebrew-channel#configuring-webososeares-cli-with-rooted-tv): enable SSH temporarily on a trusted LAN, generate a dedicated computer-side key, and install **only the public key** in the TV's `/home/root/.ssh/authorized_keys`. Keep the private key on your computer. Do not leave the initial default-password or unauthenticated Telnet access exposed.

Verify the TV's SSH host fingerprint through an independent trusted route before accepting it. Configure your own SSH alias `my-tv` with user `root`, port 22, the TV's private IPv4 address and the private key path. Keep those details in your local SSH configuration; no real addresses or keys belong in a public issue. Do not disable host-key checking.

```sh
ssh my-tv id -u
```

The output must be `0`. Repeat after a full reboot to check persistence. Then return to the project root and continue with [setup](SETUP.md) and the README's audit → plan → apply flow. Install or test no cleanup hook until root recovery and the SSH connection work.

After backing up and verifying the debloat setup, you can disable Homebrew Channel's SSH server locally and re-enable it only for maintenance. Telnet should remain disabled. Homebrew Channel 0.7.3's failsafe path can open Telnet even when its normal Telnet option is off; disabling the normal option alone is not a guarantee. Check the installed helper's behavior and upstream guidance before changing its recovery script. This toolkit's restore command leaves root/Homebrew installed; it does not unroot the TV.
