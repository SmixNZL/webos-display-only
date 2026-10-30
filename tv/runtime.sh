#!/bin/sh
set -eu
base=/var/lib/webos-display-only
exec 9>/tmp/webos-display-only.lock
flock -n 9 || exit 0
[ -f "$base/enabled" ] || exit 0
node "$base/controller/engine.js" boot-check >/dev/null
while IFS= read -r unit; do
    [ -n "$unit" ] || continue
    mkdir -p /run/systemd/transient
    ln -sf /dev/null "/run/systemd/transient/$unit.service"
done < "$base/units.txt"
systemctl daemon-reload
while IFS= read -r unit; do
    systemctl --no-block stop "$unit.service" 2>/dev/null || true
done < "$base/units.txt"
changed=0
while IFS= read -r target; do
    [ -n "$target" ] || continue
    if ! mountpoint -q "$target"; then
        mount --bind "$base/overrides$target" "$target"
        case "$target" in */appinfo.json) changed=1;; esac
    fi
done < "$base/targets.txt"
/usr/sbin/ls-control scan-services
sleep 2
while IFS= read -r unit; do
    systemctl kill --kill-who=all --signal=SIGKILL "$unit.service" 2>/dev/null || true
done < "$base/units.txt"
for proc in /proc/[0-9]*; do
    exe=$(readlink "$proc/exe" 2>/dev/null) || continue
    if grep -Fxq "${exe##*/}" "$base/processes.txt"; then
        kill -KILL "${proc##*/}" 2>/dev/null || true
    fi
done
while IFS= read -r payload; do
    [ -n "$payload" ] || continue
    luna-send -w 4000 -n 1 luna://com.webos.service.preloadmanager/setPreloadPolicy "$payload" >/dev/null
done < "$base/preloads.jsonl"
if [ "$changed" -eq 1 ]; then
    systemctl restart sam.service
    sleep 3
    luna-send -w 5000 -n 1 luna://com.webos.applicationManager/launch "$(cat "$base/resume-input.json")" >/dev/null
fi
# Only Full Home's derived snapshots are removed. Other apps retain their caches.
rm -rf /tmp/checkpoint/com.webos.app.fullhome /mnt/lg/cmn_data/checkpoint/com.webos.app.fullhome
for proc in /proc/[0-9]*; do
    exe=$(readlink "$proc/exe" 2>/dev/null) || continue
    if [ "$exe" = /usr/bin/com.webos.app.fullhome ]; then
        kill -KILL "${proc##*/}" 2>/dev/null || true
    fi
done
luna-send -w 4000 -n 1 luna://com.webos.settingsservice/setSystemSettings '{"category":"general","settings":{"adCookie":"off"}}' >/dev/null
printf 'DISPLAY_ONLY_RUNTIME_APPLIED\n'
