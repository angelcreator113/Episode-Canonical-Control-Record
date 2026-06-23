# F-Deploy-1 — P-4/P-5 Parity-Confirm Build: Evidence Note

**Type:** Evidence note (hash-anchored). Raw transcript retained out-of-band; this note is the tracked artifact.
**No FD minted.** FD numbers are minted by Fix Plan revisions, not by artifact drops or evidence notes.
**Date (UTC):** 2026-06-23

## Purpose
The 06-18 build was real but was never transcript-captured, leaving the [3] precondition unmet. This note anchors the missing parity-confirm build evidence by recording the build environment, the deterministic install result, and the sha256 of the captured transcript.

## Session scope
Phases 1, 2, 4 only:
- Phase 1 — parity capture
- Phase 2 — deterministic clean-tree install
- Phase 4 — integrity gate

**Start-verify (detached boot) is explicitly DEFERRED** to a Sec 7A-authorized session. The readiness criterion and the canon-isolation mechanism both live in Sec 7A and were intentionally not consulted in this build-and-capture session. This note therefore does NOT assert that the tree boots; it asserts only that parity holds and the committed lockfile installs cleanly.

## Build host
Local Docker container, pinned `ubuntu:22.04`, single bash session. No SSH to prod. Prod box remains FROZEN. No pm2, no restart, no boot.

## Parity (all HIGH items exact-match)
- arch: `x86_64`
- libc: `glibc 2.35` / Ubuntu 22.04.5 LTS (Jammy)
- Node: `v20.20.2` (major 20; A1 engines-range `>=20.0.0`, patch-irrelevant)
- npm: `10.8.2` (`>=9.0.0`)

## Repo ref
- HEAD pinned: `13002465749116a316c2600c9f42a068539a97e7`
- working tree: clean (`git status --porcelain` empty)
- `package-lock.json`: tracked

## Install
- command: `npm ci --no-fund --no-audit --no-progress --ignore-scripts`
- clean-tree install (node_modules wiped first), 946 packages, exit 0
- `--ignore-scripts`: no repo-owned postinstall script defined; install is hermetic and representative

## Transcript (out-of-band, hash-anchored)
- filename: `p4p5-parity-20260623T175805Z.log`
- absolute path at capture: `C:\Users\12483\p4p5-out\p4p5-parity-20260623T175805Z.log`
- sha256: `ddbb0766b1300ef9fb3d2cfa11cc15117c135c18e89f3f48299cc44981cc2447`
- 55 lines; control-char scan count 0
- egress verified byte-faithful (docker cp -> Windows copy, hash re-checked at each hop)

## Why out-of-band
Repo convention ignores `p4p5-*.log` build transcripts (see prior 06-18/06-19 logs, all untracked). Rather than force a one-off `.gitignore` override, the transcript is retained out-of-band and made tamper-evident by the sha256 recorded above. Verify the raw log with: sha256sum equals the value above.

[skip-automerge]