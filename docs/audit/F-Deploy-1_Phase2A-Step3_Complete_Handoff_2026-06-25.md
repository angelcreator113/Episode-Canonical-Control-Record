# F-Deploy-1 -- Phase 2A Step 3 COMPLETE / Cutover Handoff (2026-06-25)

> **WARMING DOCUMENT -- NOT A COLD-ENTRY READ.**
> This is a fuller record: it carries conclusions and reasoning. Reading it WARMS
> a session. A session that intends to cold-prime the cutover window (Phase 2,
> Sec 7) must NOT read this file -- doing so is binary, non-recoverable
> disqualification, exactly as the [3] cold-entry allow-list warned about its own
> permitted reads. If the cutover window needs cold entry, author a separate
> pointer-only allow-list that points AT this record for a warm prep pass; the
> cold session inherits nothing from it.

## What this is

Conclusion-bearing handoff from the session that executed Phase 2A step 3
(parallel-path node_modules staging). Authored against live HEAD 13002465.
Provenance only -- the cutover session runs its own wake-up trio.

## What was completed this session

Phase 2A step 3: the verified, parity-checked node_modules artifact was staged to
a PARALLEL path on the box. No cutover. No restart. Serving tree and all pm2
processes untouched.

## Live-verified facts (re-derived cold this session, not inherited)

- Box identity: instance-id `i-02ae7608c531db485`, hostname `ip-172-31-26-1`,
  self-reported via instance metadata. Confirmed the intended frozen prod box.
- Canon RDS identity: `current_database()` = `episode_metadata`,
  `inet_server_addr()` = `10.0.20.224`, `transaction_read_only` = `on`.
  Confirmed by DATA, not name string (naming inversion holds).
- Phase 1 abort set, all GREEN:
  - Content counts: episodes 72, shows 10, assets 64, world_events 53,
    wardrobe 40, social_profiles 444, franchise_knowledge 605.
  - public table count = 143 (canon carries no non-public tables; public-scoped
    count equals the all-schema 143 here).
  - Snapshot `episode-control-dev-prefreeze-insurance-20260530` = `available`.
  - Verified dump `episode-control-dev-verified-20260530.dump` present,
    exactly 2,828,246 bytes.
  - Canon credential authenticated live (durable-credential gate satisfied by
    demonstration).
- Artifact parity (re-confirmed by CONTENTS, not filename):
  - Source artifact: `episode-node_modules-...-node20.20.2-npm10.8.2.tar.gz`,
    114,955,066 bytes, gzip integrity verified on the box (`gzip -t` RC=0,
    byte count matched workstation source).
  - All native `.node` binaries are linux-x64 (zero foreign-arch).
  - msgpackr tagged `abi115` = Node 20 ABI, corroborating Node-major from inside
    the tree.
  - glibc variants present; sharp / @napi-rs/canvas / msgpackr-extract also ship
    musl variants (runtime picks the host-matching variant).
  - npm NOT vendored in the tree -- box's own npm governs; the filename's npm
    claim is label-asserted, not content-verified, and does not affect a
    pre-built tree.

## Staging end-state

- Staged tree: `/home/ubuntu/episode-nodemodules-staging-20260625/node_modules/`
  -- 629 top-level packages, extract RC=0.
- Sibling of the serving tree `/home/ubuntu/episode-metadata`; no path overlap.
- Persisted tar removed (no-persisted-tar end-state restored).
- Disk after: root fs 78% used, 1.8 G free (7.6 G total). (Live df -h / read at commit time 2026-06-25; at-extract reading was 76% / 1.9 G -- minor post-session log drift.)
- FULLY REVERSIBLE: `rm -rf /home/ubuntu/episode-nodemodules-staging-20260625`
  erases the entire box-side footprint of this window.

## Serving state (untouched)

- pm2 id 3 `episode-api-prod-hotfix`: online, fork, serving
  `/home/ubuntu/episode-metadata/src/server.js`, exec cwd
  `/home/ubuntu/episode-metadata`. Still running on its CURRENT node_modules.
- pm2 id 0 `episode-api` (cluster) and id 1 `episode-worker` (fork): online,
  untouched.

## THREE FLAGS THE CUTOVER WINDOW MUST CARRY

1. NODE PATCH DIVERGENCE. Artifact built on Node 20.20.2; the box runs
   **20.20.1** (read live from the pm2 error trace). ABI-115-compatible. Passes
   the A1 engines-range gate (`>=20.0.0`). Does NOT pass exact-patch -- and
   exact-patch matching is deliberately NOT the gate (precedent: false abort
   #812). Recorded so cutover does not re-litigate this as a surprise.

2. canvas IS THE LOAD-BEARING NATIVE MODULE. `node_modules/canvas/build/Release/
   canvas.node` is the one single-variant compiled addon (no musl/glibc fallback,
   unlike sharp / @napi-rs/canvas). Its ABI is what the post-restart integrity
   gate will test hardest. Check canvas explicitly post-restart.

3. A2-cfg ITEMS STILL DEFERRED TO CUTOVER. The `ecosystem.config.js` mechanism
   change AND the live box-read of the Node bin path
   (`/home/ubuntu/.nvm/versions/node/v20.20.X/bin`) were deferred to the cutover
   window, not resolved here. Still OPEN for cutover. (Note the box's live Node is
   20.20.1 per flag 1 -- confirm the actual bin path live; do not inherit a patch
   number.)

## What is NOT done (the irreversible step)

Cutover -- pointing id-3 at the staged tree and restarting -- is the single
irreversible action of F-Deploy-1. It belongs to its own window (Phase 2,
Sec 7) with its own gate sequence: pre-restart runtime-bind gate (A2-cfg),
G2A-1 / G2A-2 live confirmation (G2A-2 disk precheck is a live `df -h /` read),
post-restart FD-38 integrity gate (identity + unfiltered fingerprints), and
rollback-in-hand (snapshot + verified dump, both confirmed available this
session). Entered fresh. Velocity pressure is the named hazard; pausing here is a
valid success condition.
