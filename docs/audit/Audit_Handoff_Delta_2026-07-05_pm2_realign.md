# Audit Handoff Delta — 2026-07-05 — id-3/[3] Window, Session 2 (pm2 realign attempt)

Supplements the 07-04(b) id3_Window delta and v15. Supersedes nothing.
Records live reads from the 2026-07-05 session. Cold sessions verify against main.
Entry state: origin/main `1b295c4c` (#901), 0 open PRs, deploy-dev trigger disabled (verified empty).

## id-4 (episode-api-parallel) — CLASSIFIED and QUARANTINED

- `pm2 describe`: script `/home/ubuntu/episode-metadata-parallel/src/server.js`; own cwd; own
  `ecosystem.config.js` (find returned TWO config files on the box). fork, ↺0 (never cycled),
  created 2026-06-27 11:35Z.
- NOT defined in either `ecosystem.config.js` — started ad-hoc, not from config.
- Its `.env` (routing keys only, masked grep — non-printing, did NOT connect the process):
  `PORT=3002`, `DB_HOST=episode-control-dev…rds` (CANON per standing rule: canon is the
  misleadingly-named `episode-control-dev`; identity inferred from hostname, not by running a
  query against id-4), `DB_NAME=episode_metadata`, `NODE_ENV=production`.
  → A production-mode ad-hoc process targeting canon on dev-port-3002. Contamination +
  port-collision risk if resurrected by a future `pm2 save` + reboot.
- **CORRECTION to 07-04 drafts:** id-4 was NOT in `dump.pm2`. dump mtime 2026-06-24 03:14
  predates id-4's 2026-06-27 creation by 3 days. The "delete-4-leaves-it-in-the-dump"
  framing is false; the real risk was a *future* save freezing it. Action taken: `pm2 delete 4`.
  Registry no longer holds id-4.

## dump.pm2 verified (masked, pre-any-save)

- 34,266 bytes, 2026-06-24 03:14:31Z, 3 procs: `episode-api` (cluster_mode, 3002),
  `episode-worker` (fork), `episode-api-prod-hotfix` (fork, 3000). Freeze integrity intact
  (nothing saved during the window). NOT overwritten this session — no `pm2 save` executed.

## id-0/dev realign — ATTEMPTED, NOT COMPLETED, deferred

- **CONFIG BUG (root cause):** `episode-api` block has `instances: 1`, NO `exec_mode`. `pm2
  start ecosystem.config.js --only episode-api` yields CLUSTER (reproduced twice: ids 5, 7).
  This is why id-0 drifted to cluster despite the config looking like a single-fork entry.
  Prod block (id-3, `episode-api-prod-hotfix`) runs fork by accident of an earlier explicit
  start, not because the config specifies it.
- **Direct-script start** (`pm2 start src/server.js --name episode-api`) yields FORK but
  loads `env(0)` — wrong cwd, dotenv finds no vars → `DB_HOST NOT SET` → `ECONNREFUSED
  127.0.0.1:5432` (no local Postgres; canon is remote), app falls back to `PORT=3000` (prod's
  port), `EADDRINUSE` loop to ↺117 (ids 6, 8). Prod (id-3) held the port throughout; prod
  never disrupted.
- Neither method yields fork + env. **RESOLUTION for next window:** add `exec_mode: 'fork'` to
  the `episode-api` block in `ecosystem.config.js` (gated live edit, Rule 7), then start from
  config → fork + full env (32 vars). Deferred to next cold window.

## Window close state

- Prod (id-3, `episode-api-prod-hotfix`): fork, online, 3000, 3D uptime — UNTOUCHED throughout.
- id-4: quarantined (`pm2 delete 4`). Worker (id-1): stopped, unchanged.
- dev/`episode-api`: ABSENT (deleted after crash-loop). NOT realigned. NOT saved.
- `dump.pm2`: still the 2026-06-24 file. No `pm2 save` executed. Nothing bad frozen.
- **RESTART-TO-ALIGN and `pm2 save`: still OPEN, carried to next cold window. First action
  there: the gated config `exec_mode: 'fork'` edit.** FD-31/42/43/44/45 remain OPEN.
  Freeze holds.

## Deviations (Rule 7)

Six restart cycles (ids 5–8) to diagnose the config/env interaction; each failed loudly,
none saved, no bad state persisted. The save gate held every time — this is the discipline
functioning, not a failure. Logged for the record.

*Mints/closes nothing. A Fix Plan revision does that. [skip-automerge]*
