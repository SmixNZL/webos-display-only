#!/bin/sh
# Direct public IPv4 destinations are denied; IPv6 is disabled on this profile.
set -eu
for spec in '120 10.0.0.0/8' '121 172.16.0.0/12' '122 192.168.0.0/16' '123 169.254.0.0/16' '124 127.0.0.0/8' '125 224.0.0.0/24' '126 255.255.255.255/32' '127 239.255.255.250/32'; do
    set -- $spec
    ip -4 rule del priority "$1" 2>/dev/null || true
    ip -4 rule add priority "$1" to "$2" lookup main
done
ip -4 rule show | grep -q '^129:.*unreachable' || ip -4 rule add priority 129 unreachable
ip -4 route flush cache 2>/dev/null || true
printf 1 > /proc/sys/net/ipv6/conf/all/disable_ipv6
printf 1 > /proc/sys/net/ipv6/conf/default/disable_ipv6
printf 'LOCAL_NETWORK_ONLY_APPLIED\n'
