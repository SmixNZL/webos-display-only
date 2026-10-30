# Validation record

Reference date: **2026-10-30**. Hardware/version details are in the compatibility guide; individual TV identifiers and raw reports are deliberately excluded.

The reference recipe was verified after a cold restart:

- Full-screen Home, the four requested LG cards absent, and the offline prompt absent.
- HDMI input cards and sound control retained; selecting the external player opened HDMI 2.
- All three Home overlays matched their expected modified hashes.
- Core display, video, audio, app manager, input integration, ARC and network manager services active.
- Optional services disabled, updater disabled, local control retained, public IPv4 connections blocked and IPv6 disabled.
- The early network guard ran before ConnMan; SSH and Telnet were disabled in the final reference setup.

After packaging the public code, the Home patch generator was executed on the reference TV's **Node 8.12.0** runtime. Its three generated files matched the already installed, cold-boot-tested overlays byte for byte. Its Home-card retention, ambiguous-anchor rejection and plan-scope tests also passed on that runtime. This was a read-only verification with temporary test files; the packaged installer was not applied over the existing cleanup.

Local automated tests cover the client plan/transport boundaries, unsupported-firmware rejection, source-integrity rejection, privacy scanning, network-policy behavior and repeat application, card retention, settings preservation, private backup permissions and isolated staging. Shell and TV JavaScript syntax are checked as well.

**Not yet verified:** a fresh stock-TV end-to-end installation of this packaged installer, automated restore on real hardware, any second TV, or any other model/firmware. The original hand-applied changes and the packaged automation have different validation levels. Passing local tests does not change those limits.
