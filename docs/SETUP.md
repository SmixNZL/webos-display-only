# Setup

**Use at your own risk.** Read the compatibility and recovery guides before changing your TV.

## 1. Establish root and local access

Check the model and software version in LG Settings. This toolkit currently supports only the exact combination in `profiles/lg-un81-webos5.json`.

Follow the official [webOSbrew guidance](https://www.webosbrew.org/rooting/) for a rooting method compatible with your firmware. Install persistent Homebrew Channel from its official project. The reference setup used Homebrew Channel 0.7.3 and Node 8.12.0. Developer Mode by itself is insufficient.

Set up root SSH access on a network you trust, using your own key. Verify the TV's host fingerprint through a trusted channel before saving it. Configure an SSH alias named `my-tv` (or another name) with user `root`, your own private IPv4 hostname/address and your private identity file. Check that `ssh my-tv id` returns UID 0. Do not disable host-key verification or publish the SSH configuration.

SSH/root access exposes powerful control. Use a trusted private network; do not forward TV ports to the internet. You can turn off Homebrew Channel's SSH server after the final checks, and turn it on locally when maintenance is needed. This toolkit does not enable SSH or Telnet and does not replace SSH keys. HBC's own recovery behavior depends on its version; verify its Telnet setting separately.

## 2. Remove optional user-installed apps

In LG Home, open the app editor (pencil or a long press on an app). Delete the apps you do not use, using LG's own confirmation prompts. For an HDMI-only setup, this may include LG Gaming Portal, LG Sports Playbook, LG Streaming Week and the TV's streaming apps. This is optional; the toolkit never uninstalls anything.

Keep Homebrew Channel for local recovery. Leave system components for Settings, inputs, picture, audio, power and the native launcher installed. Do not delete directories by hand.

## 3. Audit and plan

Run the commands in the README. Auditing only reads the TV; local audit files are private. Planning makes no TV changes. `--resume-hdmi` specifies the input to reopen if the app manager must restart.

Without `--local-network-only`, TV internet remains available; the offline banner is still hidden when the TV is offline. Without `--block-updates`, the updater is retained. Omit either flag from the plan if you need those functions. The full reference setup uses both flags.

The local-network option permits private IPv4 ranges, loopback, IPv4 link-local, DHCP broadcast, link-local multicast and SSDP. It disables all IPv6 on this tested profile. It preserves DHCP rather than assigning a static address. It blocks direct public connections; a reachable local proxy or other LAN host could still relay internet traffic. It is not LAN isolation or a substitute for managing the shared network.

Review the plan before running apply. No compatibility override is available: a mismatch needs a new reviewed and tested profile, not a forced installation.

## 4. Apply, back up and cold-boot check

Apply only to your own authorized TV. The client binds the plan to the SSH target and rechecks the audited state. Before applying new settings, the TV saves originals under `/var/lib/webos-display-only/backup` and records a private recovery state. The command may briefly interrupt the display.

Download a private rollback archive using `backup`. Keep the computer's SSH access until verification is finished. Power the TV down fully and restart it; normal standby can retain processes and is not the same test. Do not interrupt firmware installation or OLED panel maintenance. A full reboot from the Homebrew tools is preferable to removing power.

Run status after the reboot. If local-only is selected, require both `ok: true` and `earlyGuardObservedThisBoot: true`. Also confirm that remote control, Home, picture and sound work. Test both connected devices and any CEC/ARC functions you use. The PS5 card can be grey while the console is off.

If checks fail, use restore and reboot before attempting another installation. Do not repeatedly apply over a failed or modified state. Keep failure reports private.
