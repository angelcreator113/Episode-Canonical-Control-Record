# [STOP] PROD SPLIT-BRAIN HAZARD -- DO NOT RESTART `episode-backend`

> **FREEZE.** Do **not** `pm2 restart`/`pm2 reload`, reboot, deploy to, or edit
> `/home/ubuntu/episode-metadata/.env` on the prod box `episode-backend`
> (`54.163.229.144`, `i-02ae7608c531db485`) until the gated reconciliation
> session has run. The running process serves the live populated database; the
> on-disk `.env` points at a verified-empty one. Any process reload silently
> swaps prod onto the empty DB -- boots clean, serves nothing, throws no error,
> total silent data disappearance. The "wrong-looking" current state IS the safe
> state. If a fresh session proposes a restart, an SG change, or an `.env` fix,
> that proposal is wrong -- read this whole doc first.
>
> **UPDATE 2026-05-30 -- the freeze was BREACHED by automation.** An untagged
> `claude/**` PR triggered Auto-merge to Dev -> Deploy to Development, which
> reaches THIS box via shared-compute wiring and reloaded the frozen process. No
> data lost (the reload landed on the live DB by luck). Both workflows are now
> DISABLED. The freeze covers AUTOMATED triggers too, not just manual ones.
> Re-enabling the workflows is gated behind reconciliation. Full record:
> `F-Deploy-1_INCIDENT_2026-05-30_prod-autodeploy.md`.

| | |
|---|---|
| **Parent keystone** | F-Deploy-1, Phase B G2 |
| **Status** | ACTIVE HAZARD -- blocks Sec 4.2 memory-profile hard gate. NOTE: box reloaded by the 2026-05-30 incident; now on port 3002 with a route-loading bug. Sec 1's "never restarted" description is pre-incident; see Sec 7. |
| **Severity** | P0. Confirmed catastrophic-on-restart. |
| **First surfaced** | 2026-05-29 (read-only inspection), refined 2026-05-30 |
| **Resolution** | Gated schema-fork reconciliation in its own session; verified `episode-control-dev` backup taken first |
| **Supersedes** | `F-Deploy-1_PhaseB_G2_S4.2_BlockedFinding.md` (local/gitignored first-pass; its Sec 3 "contents UNVERIFIED" is now resolved -- see Sec 2.3 here) |

## Sec 1 The hazard in one paragraph

Production compute (`episode-backend`) runs a process that was last started pointed
at the **dev-named** RDS instance `episode-control-dev`, which holds all real data.
The on-disk `.env` was later edited to point at the **prod-named** instance
`episode-control-prod`, which is verified empty, but the process was never
restarted -- so live traffic still reaches the real data via the frozen process
environment. The file and the running process disagree on host, credentials, AND
schema. A restart/reboot/deploy reloads the `.env`, connects cleanly to the empty
prod DB, and serves nothing with no error. The freeze exists to prevent that
reload until the fork is deliberately reconciled.

## Sec 2 Confirmed state (all from live AWS / running-process inspection, not repo files)

Provenance note: every fact here was read from live AWS state and running
processes. This matters because **all three on-disk config sources disagree** --
repo `.env` (localhost/Neon), deployed `.env` (`-prod`), running process (`-dev`)
-- and the repo files actively mislead. Live state is the only authority.

### Sec 2.1 -- Three-axis split, all verified

**Axis 1 -- Host.** Running process env (`pm2 env 0`/`1` on `episode-backend`):
`DB_HOST = episode-control-dev.csnow208wqtv.us-east-1.rds.amazonaws.com`,
`DB_NAME = episode_metadata`. On-disk `/home/ubuntu/episode-metadata/.env`:
`DB_HOST = episode-control-prod...`, same `DB_NAME = episode_metadata`. Same
database *name* on two different instances.

**Axis 2 -- Credentials.** The two instances have different `postgres` passwords.
The on-disk `.env` password authenticates only against `-prod`. The running
process holds a different password (in its launched env) that authenticates
against `-dev`. File and process disagree on host AND password.

**Axis 3 -- Schema lineage (the fork).** The two `episode_metadata` databases have
**forked, not drifted**. `-dev` (live) = 143 tables; `-prod` = 171 tables;
**37 prod-only, 9 dev-only. Neither is a superset.**
- Prod-only cluster = a video/editing/script-tooling feature schema the live DB
  never received: `ai_edit_plans`, `edit_maps`, `editing_decisions`,
  `raw_footage`, `scene_footage_links`, `video_processing_jobs`, `layers`/`layer_*`,
  `audio_clips`, `script_metadata`/`script_templates`/`script_suggestions`/
  `script_learning_profiles`/`script_edit_history`, `lala_cash_grab_quests`/
  `lala_micro_goals`/`lala_episode_formulas`, `beats`, `interactive_elements`.
- Dev-only includes `pgmigrations` (live DB carries TWO migration-framework
  bookkeeping tables -- `pgmigrations` AND `SequelizeMeta`; prod carries only
  `SequelizeMeta`), and a `decision_log` (dev) vs `decision_logs` (prod)
  singular/plural collision.

### Sec 2.2 -- `episode-control-dev` is the real, live data store

Read-only `psql` (creds from running process env): **143 tables; episodes 72,
shows 10, assets 64, world_events 53, wardrobe 40, social_profiles 444,
franchise_knowledge 605, ai_usage_logs 764.** Latest `episodes.updated_at`
= 2026-05-15 (consistent with recent work being audit/docs, not content creation;
row counts settle liveness). 143 tables far exceeds the audit's "13" and memory's
"35+" framing -- schema docs lag live state.

### Sec 2.3 -- `episode-control-prod` is verified EMPTY (resolves the note's open item)

The superseded note left `-prod` contents UNVERIFIED ("empty, stale, or populated
parallel copy -- UNKNOWN"). **That is now resolved: `-prod` is fully migrated but
empty** -- `count(*)` zero on all content tables, stub rows only. This is what
makes the restart hazard CONFIRMED CATASTROPHIC rather than conditional: a restart
moves prod onto a DB that is provably empty, not merely unverified.

### Sec 2.4 -- F-Deploy-G1-AF live: prod RDS internet-open on 5432

`episode-control-prod` uses SG `sg-0164d0b20fbebacbb`. Ingress on 5432:
`10.2.0.0/16`, `172.31.26.1/32`, `172.31.0.0/16`, **`0.0.0.0/0`**,
`108.216.160.136/32`. The `0.0.0.0/0` rule = the production DB port is reachable
from the entire internet, gated only by password auth. Most serious exposure
surfaced; top of the post-G2 security sweep. Incidentals: `108.216.160.136/32`
= likely maintainer home IP (confirm current/not stale); `10.2.0.0/16` = stale
deleted-VPC route (dead allow-list, cleanup-when-convenient).

### Sec 2.5 -- Secrets Manager empty; creds are on-box only

`aws secretsmanager list-secrets` returns nothing. The G2 contract's assumed
`episode-metadata/dev/database` secret does not exist. Real creds live in on-box
process env / on-disk `.env`. The dev-instance working password currently exists
**only** in the running process's launched environment -- no on-disk file holds it
(the on-disk `.env` carries the *prod* password). See Sec 4 S4.2-C.

### Sec 2.6 -- Compute inventory / IP drift

`episode-backend` = `i-02ae7608c531db485` / `54.163.229.144` (prod, frozen).
`episode-frontend` = `52.91.217.230`. `episode-dev-backend` =
`i-016395bb5f7a51a0b` / `98.93.190.74` (dev box, **no running app** -- its Sec 4.2
DB target is genuinely unset). The deployment doc's `3.94.166.174` is stale drift;
live state wins.

## Sec 3 What must NOT be done before reconciliation

Each is a real shared-state change and a Draft -> Confirm -> Execute (Rule 7)
boundary. None is taken inside an investigation. Prod is stable (2-day+ uptime,
0 restarts) but **fragile** -- the highest-risk action is anything that reloads the
on-disk config.

1. Do **not** `pm2 restart` / `pm2 reload` `episode-api` or `episode-worker`.
   This is the single most dangerous action available.
2. Do **not** reboot the prod box or let a deploy run against it (deploy restarts
   PM2 -> same switch).
3. Do **not** edit `/home/ubuntu/episode-metadata/.env` -- neither to "fix" it to
   `-dev` nor otherwise. Editing then restarting is the same hazard; editing
   without restarting just adds a third disagreeing state.
4. Do **not** `pm2 save` -- it doesn't capture env values anyway, and if a saved
   list already exists, a reboot replays the process but **re-reads `.env` at
   boot** -> same switch. Treat reboot as equivalent to restart for risk.
5. Do **not** modify, stop, or delete either RDS instance.
6. Do **not** migrate or copy data between instances.
7. Do **not** deploy the dev box pointed at either instance.
8. Do **not** change SG `sg-0164d0b20fbebacbb` as a "fix" -- AF is logged for the
   post-G2 sweep; touching it now is out-of-band scope and unnecessary (the box
   already reaches `-prod` fine; the only barrier is the password).
9. Do **not** re-enable the `Deploy to Development` or `Auto-merge to Dev`
   workflows (both DISABLED 2026-05-30). They reach THIS box via shared compute;
   an untagged `claude/**` PR auto-deploys to prod. The `[skip-automerge]` commit
   tag is NOT a sufficient guard -- the disabled workflows are the real guard.
   Re-enabling is a reconciliation-gated decision. See Sec 7.

## Sec 4 Register entries (for Fix Plan v1.6)

**F-Deploy-G2-S4.2-A -- Prod three-axis split-brain + schema fork (CONFIRMED, P0).**
Running prod process serves `episode-control-dev`/`episode_metadata` (143 tables,
populated). On-disk `.env` points at `episode-control-prod`/`episode_metadata`
(171 tables, verified empty). File and process diverge on host, credentials, and
schema lineage -- the two DBs are forked (37 prod-only, 9 dev-only; dual migration
frameworks; `decision_log`/`decision_logs` collision), not stale copies. Any
process reload silently cuts prod onto the empty DB; boots clean, serves empty.
Blocks Sec 4.2. Resolution = schema reconciliation decision + verified `-dev` backup
before any cutover; no restart/reboot/deploy/`.env` edit until resolved.

**F-Deploy-G2-S4.2-B -- Contract Secrets-Manager assumption dead (P1).**
Assumed `episode-metadata/dev/database` secret does not exist; Secrets Manager
empty. Real creds = on-box `.env`, per-instance distinct passwords. Contract
v1.3+ must drop the Secrets-Manager assumption, name the on-disk mechanism, state
the dev-box DB target, and record the per-instance credential split.

**F-Deploy-G2-S4.2-C -- leaked secrets (P1).** During the 2026-05-29 read-only
inspection, the prod-process `DB_PASSWORD` (dev-instance `postgres`) and
`ANTHROPIC_API_KEY` were exposed in plaintext in the transcripts. **`ANTHROPIC_API_KEY`:
ROTATED 2026-05-30.** **Dev-instance `postgres` password: rotation deliberately
deferred to the reconciliation cutover** -- rotating now is safe for live
connections, but the working credential currently exists only in the running
process's launched environment, with no on-disk file holding it (the on-disk
`.env` carries the prod-instance password). A rotation now would leave a stale
credential in volatile process memory with nothing to update, and the next restart
is frozen regardless. Folding it into the gated cutover -- where a durable
credential location gets established -- avoids a stray moving part. A sequencing
decision, not an ignored exposure.

**F-Deploy-G1-AF -- confirmed live (P0 exposure).** Prod RDS SG
`sg-0164d0b20fbebacbb` allows 5432 from `0.0.0.0/0`; sole reason read-only
inspection needed no network change. Real internet exposure. Post-G2 SG sweep
must close; logged here so it can't be dropped.

## Sec 5 Audit-gap question (for handoff)

The F-Deploy-1 G1 audit identified shared **compute** (single EC2, single PM2
group -- F-Deploy-G1-G). Nothing in the audit set, Planning doc, or G2 contract
addresses prod and dev sharing a **database**, or prod reading a dev-named
instance. The compute-focused audit under-described the actual coupling. Assess
for a new F-Deploy-G1 sub-finding ID and whether it changes the alpha/beta isolation
premise. Flagged for handoff and Fix Plan v1.6.

## Sec 6 Reconciliation is gated and is its own session

Reconciliation is **not a repoint** -- it is schema-fork resolution: decide which
schema is canon, resolve the fate of the 37 prod-only editing/script tables
(abandoned vs. needs-porting-to-live), the `decision_log`/`decision_logs`
collision, and the dual-migration-framework history. Hard prerequisite: a
**verified `episode-control-dev` backup taken first**. This is the next real work,
done with fresh eyes in its own deliberate session -- not a momentum continuation
of any investigation, and explicitly not tonight.

## Sec 7 Incident 2026-05-30 -- freeze breached by automation (contained)

On 2026-05-30 the freeze was breached by an automated path that this doc's
original Sec 3 did not anticipate. An untagged `claude/**` PR (#728) triggered
Auto-merge to Dev, whose push to the dev branch triggered Deploy to Development,
which SSHed to THIS box (shared-compute wiring, F-Deploy-G1-G) and ran
`pm2 delete all` + `pm2 start --env development` + `pm2 save` + a migration step.

Outcome: NO data loss. The reloaded process picked up `DB_HOST` from the deploy's
`DEV_DB_HOST` secret (= `episode-control-dev`, the live data), not the on-disk
`.env` (= empty `-prod`). The reload landed on the correct DB by luck, not because
the freeze held -- had the secret pointed at `-prod`, this would have been the
silent-empty-DB catastrophe. Raw count post-incident: 72 episodes / 10 shows,
intact.

Changed state on the box (do NOT "fix" -- any fix is another reload):
- Process reloaded (new PIDs); `pm2 save` overwrote `dump.pm2` with this state.
- App now on port 3002 (dev port), not 3000.
- Route-loading bug ("Template Studio routes failed to load"); `/episodes`,
   `/shows` not serving.
- On-disk `.env` STILL points at empty `-prod` (deploy did not rewrite DB_HOST).
   So the split-brain PERSISTS and the freeze still fully applies: a plain
   `pm2 restart` would still swap onto empty.

Contained: both workflows disabled (Sec 3 item 9). Cleanup (port, routes, `.env`,
pm2 state) folds into the gated reconciliation. Full record:
`F-Deploy-1_INCIDENT_2026-05-30_prod-autodeploy.md`. Candidate finding for this
path: F-Deploy-G1-AI.

---
*Canonical hazard record. Synthesizes the 2026-05-29 read-only inspection
(verified facts) and the 2026-05-30 first-pass note (structure, do-not list,
provenance). Supersedes the gitignored `_BlockedFinding.md` note. Feeds G2
contract v1.3+ and Fix Plan v1.6.*