# F-Deploy-1 Fix Plan v1.8

**Records FD-31 Track A on-disk verification: the on-disk `.env` `DB_HOST` is confirmed = canon (`episode-control-dev`) by direct read, so the empty-`-prod` data-swap landmine is DEFUSED ON DISK. Logs a developer-initiated `pm2 restart 0` + `pm2 resurrect` sequence on the frozen prod box as a two-step freeze deviation: the restart produced a healthy-on-canon process; an immediate probe failed once (cause unproven, no contemporaneous logs); the resurrect was a no-op (PID unchanged). The FD-31 data-swap leg is MITIGATED, not closed -- a clean-restart path is not robustly demonstrated and the full-host-reboot/resurrect path is unverified. Schema-fork and degraded-state legs remain OPEN and reconciliation-gated. Supersedes incident-doc Sec 4 line 48 for the on-disk-`.env` fact only. No Phase B gate moves; no prod-box action authorized by this revision.**

| | |
|---|---|
| **Predecessor revision** | Fix Plan v1.7 (FD-35 / F-Deploy-G1-AI, auto-deploy containment; merged via PR #731) |
| **Verification evidence** | Live SSH verification sequence on prod box `episode-backend` (54.163.229.144), 2026-06-01 ~01:10 UTC. Predominantly read-only checks, plus one developer-initiated `pm2 restart 0` and one `pm2 resurrect`, already executed (see Sec 3). Not a pure read-only inspection. |
| **Incident reference** | `F-Deploy-1_INCIDENT_2026-05-30_prod-autodeploy.md` (repo root, PR #729) |
| **Hazard record reference** | `F-Deploy-1_PROD_SplitBrain_HAZARD.md` (repo root) |
| **Author date** | 2026-06-01 (work session 2026-05-31 / 06-01 UTC boundary) |
| **Status** | DRAFT v1.8 |
| **Gate transition** | FD-31 data-swap leg: DEFUSED ON DISK (verified), MITIGATED -- NOT closed. The clean-restart path is not robustly demonstrated; the reboot/resurrect path is NOT verified. FD-31 OVERALL remains OPEN (schema-fork + degraded-state legs). Sec 4.2 remains BLOCKED -- its blocker is not cleared. No Phase B gate closes. The prod box remains FROZEN; the reboot path is in force as do-not. |

## Sec 1 Purpose

v1.8 records a verification established this session and corrects the canonical record, which currently disagrees with the live box.

The motivating gap: as of v1.7 and the incident doc, the canonical record states the split-brain is live on disk (incident Sec 4 line 48: "`.env` still points at `episode-control-prod` (empty) ... the split-brain PERSISTS"). A direct read of the on-disk `.env` this session shows `DB_HOST=episode-control-dev` (canon). The FD-31 Track A `.env` fix persisted and survived the 2026-05-30 auto-deploy incident (which never wrote `DB_HOST` -- incident line 48). A future reader trusting the docs would treat the box with catastrophe-caution or, worse, "correct" an `.env` that is already correct. v1.8 closes that doc-vs-reality gap for the on-disk fact.

What v1.8 does NOT claim:
- Does NOT close FD-31. Two legs (schema-fork, degraded-state) remain open and reconciliation-gated.
- Does NOT unblock Sec 4.2.
- Does NOT claim a clean-restart path is proven. One uninstrumented manual restart, with a transient probe failure of unproven cause, is supporting evidence, not a demonstration.
- Does NOT verify the reboot/resurrect path under full host reboot.
- Does NOT authorize any prod-box action.

## Sec 2 Reference documents

| Document | Section reference | Role in v1.8 |
|---|---|---|
| `F-Deploy-1_INCIDENT_2026-05-30_prod-autodeploy.md` (PR #729) | Sec 3 line 36 (post-incident pm2/PID state); Sec 4 line 48 (`.env` claim) | The line-48 on-disk-`.env` claim is SUPERSEDED by Sec 3 live evidence. Worker-PID provenance corroborated (Sec 3). |
| `F-Deploy-1_PROD_SplitBrain_HAZARD.md` (repo root) | Freeze; do-not list | Freeze inherited and reaffirmed for the reboot/resurrect path. v1.8 logs two gated deviations against it (Sec 3, FD-36). |
| `docs/audit/F-Deploy-1_Fix_Plan_v1.7.md` (PR #731) | Sec 6 state-of-play (Sec 4.2 BLOCKED on FD-31) | Immediate predecessor. v1.8 refines the Sec 4.2 blocker characterization; inherits register through FD-35. |
| `docs/audit/Prime_Studios_Audit_Handoff_v11.md` (PR #726) | Sec 3.8 (data-layer split-brain); Sec 9 (confirm-reconciliation branch) | v11 Sec 9 anticipated this "confirm whether reconciliation has happened -> Sec 2/4 stale" branch. v1.8 is its partial trigger (one leg, mitigated). |

## Sec 3 What was established (live SSH sequence)

All actions 2026-06-01 ~01:10 UTC over SSH. The sequence was predominantly read-only but INCLUDED two developer-initiated state-changing actions against the frozen prod box (`pm2 restart 0`, then `pm2 resurrect`); both are logged as freeze deviations (FD-36). The actions are themselves part of the evidence.

**Observed state (read-only):**

1. `pm2 list`: `episode-api` (id 0, PID 1380150, ~77m uptime, restart count ↺=1, online); `episode-worker` (id 1, PID 1371604, ~28h uptime, online). The worker PID matches the incident doc's recorded post-incident worker (Sec 3 line 36) -- the worker is the 2026-05-30 incident process, untouched since.
2. `pm2 env 0`: `DB_HOST=episode-control-dev...`, `DB_NAME=episode_metadata`, `NODE_ENV=production`, `PORT=3002`.
3. `/health` (port 3002): `status: healthy`, `environment: production`, `DB_HOST: episode-control-dev`, `database: connected`, `currentDatabase: episode_metadata`. (`showCount:1 / episodeCount:18` is the known scoped metric, not a table count -- incident Sec 3 line 38; raw count remains 72 episodes / 10 shows.) Port 3000: nothing listening (F-Deploy-G1-H port drift, expected).
4. `pm2 describe 0`: cwd `/home/ubuntu/episode-metadata`, script `src/server.js`.
5. **On-disk `.env` (`/home/ubuntu/episode-metadata/.env`): `DB_HOST=episode-control-dev`, `DB_NAME=episode_metadata`, `NODE_ENV=production`, `PORT=3002`.** Direct file read.

**Deviation sequence (state-changing, developer-initiated, logged):**

6. `pm2 restart 0` executed on prod. `episode-api` came up online as PID 1380150.
7. An immediate health probe to `localhost:3002/health` returned `curl: (7) Failed to connect to localhost port 3002 after 0 ms: Connection refused`.
8. `pm2 resurrect` executed as an intended rollback. `episode-api` remained PID 1380150 -- UNCHANGED across the resurrect.
9. A subsequent direct health check on `127.0.0.1:3002/health` returned `200 OK`, DB connected to `episode-control-dev`, on the same process (PID 1380150).

**Forensic reading of the deviation sequence:**

- The on-disk `.env` `DB_HOST` = canon (step 5) is established by direct file read and is independent of restart mechanics. This alone defuses the FD-31 landmine ("a restart reads `.env` and swaps prod onto the empty `-prod`"): the file does not point at `-prod`. This is the authoritative evidence; the restart behavior is corroborating, not primary. (A plain `pm2 restart` without `--update-env` may reuse the captured environment rather than re-read `.env`; v1.8 does not rely on the restart to prove `.env` is read.)
- PID continuity (1380150 unchanged across steps 6->9) plus restart count ↺=1 indicate the process spawned exactly once and never crash-respawned. There was no crash loop.
- Because the process was already online when `pm2 resurrect` ran, the resurrect did not replace it (PID unchanged): the resurrect was effectively a NO-OP for `episode-api`. The eventual healthy state therefore traces to the restarted process completing startup, NOT to the resurrect "rolling back" to a prior good state. (The same mechanism explains the worker keeping PID 1371604 through the resurrect -- resurrect did not cycle an already-online process. Loose thread from prior analysis: resolved.)
- The transient `connection refused after 0 ms` (step 7) is, given no crash and ↺=1, most consistent with the Express server not yet having bound port 3002 when the probe raced in -- a startup-timing race on a still-booting process. **This is the most likely cause but is NOT proven: no contemporaneous logs were captured.** Root cause of the failed probe remains open.

**Net:** the data-swap landmine is defused on disk (proven). A single manual restart recovered healthy on canon. A clean-restart path is supported but NOT robustly demonstrated (one uninstrumented sample, one transient unexplained probe failure). The full-host-reboot path is unverified.

## Sec 4 Decisions log -- additions FD-36, FD-37

v1.7 ended at FD-35. v1.8 adds FD-36 and FD-37.

- **Decision FD-36: FD-31 Track A `.env` fix verified persisted on disk; the data-swap leg is MITIGATED, not closed.** The on-disk `.env` `DB_HOST` is confirmed = `episode-control-dev` (canon) by direct read (Sec 3 step 5); the running process is on canon and healthy (steps 2-3, 9). The Track A fix persisted and survived the 2026-05-30 auto-deploy incident. Incident-doc Sec 4 line 48 ("`.env` still points at empty `-prod`; split-brain persists") is SUPERSEDED for the on-disk-`.env` fact. A developer-initiated `pm2 restart 0` and a subsequent `pm2 resurrect` were executed against the frozen prod box this session (Sec 3 steps 6-9) and are logged as freeze deviations: ungated actions against the frozen box. The restart produced a healthy-on-canon process; an immediate probe failed once with connection-refused (cause unproven, no logs captured); the resurrect was a no-op (PID unchanged). Had the on-disk `.env` still pointed at empty `-prod`, the restart could have produced the FD-31 catastrophe; it did not. The data-swap leg is therefore mitigated (the on-disk landmine is gone), NOT closed (a clean-restart path is not robustly demonstrated; reboot is unverified). Follow-up owed: if any future restart is contemplated, capture contemporaneous app logs to resolve the step-7 probe-failure cause.

- **Decision FD-37: FD-31 remains OPEN on schema-fork and degraded-state legs; scope and closure criteria to be finalized in the reconciliation session. Sec 4.2 stays BLOCKED; reboot/resurrect path NOT verified.** With canon fixed to `episode-control-dev` on disk and verified, FD-31's data-loss coupling is removed from the on-disk-`.env` path. What remains, scope and closure criteria TBD at reconciliation: (a) **schema-fork** -- the dual `episode_metadata` databases / dual migration frameworks (v11 Sec 3.8). (b) **degraded-state cleanup** -- prod on port 3002 not 3000, the Template Studio route-loading bug (`/episodes`, `/shows` reported non-200 by the incident doc; not re-verified this session -- only `/health` was checked), and the `pm2 save` / dump state. The reboot/resurrect path is NOT verified safe under full host reboot: `pm2 resurrect` reads `/home/ubuntu/.pm2/dump.pm2`; that dump was refreshed post-fix via `pm2 save` to the 2-app canon set (2026-05-31), so it is not the incident-overwritten dump -- but cold-boot recovery behavior is unverified in this cycle. "Do not reboot the prod box" remains in force. Sec 4.2 (memory-profile hard gate) stays BLOCKED -- it requires running the app under load on a box that is currently degraded; the blocker is not cleared.

## Sec 5 Supersede notes

- **Incident doc Sec 4 line 48** -- the "`.env` still points at `-prod` / split-brain persists" claim is superseded by Sec 3 step 5 (direct read shows canon) for the on-disk-`.env` fact ONLY. The incident doc's account of the 2026-05-30 event remains accurate as a historical record. Recommend a one-line forward-pointer note added to the incident doc at lockdown ("on-disk `.env` later verified = canon; see Fix Plan v1.8 Sec 3") rather than editing the historical record.
- **v1.7 Sec 6 state-of-play** -- the "Sec 4.2 BLOCKED on FD-31" row is refined by Sec 6 below: still blocked; the FD-31 data-swap leg is now mitigated-on-disk while schema-fork and degraded-state legs remain the live blockers.
- **v11 Sec 2 / Sec 4** -- the "true next gate = reconciliation, blocked on a live split-brain" framing is PARTIALLY superseded: the data-swap leg is defused on disk (mitigated). Reconciliation's remaining scope is the schema-fork and degraded-state legs. v12 should carry this.

## Sec 6 State of play at v1.8 close

| Tier | Item | Status |
|---|---|---|
| Phase A | Overall | CLOSED (inherited) |
| Phase B G1 | Gate close | CLOSED (inherited) |
| Phase B G2 | Sec 4.2 memory profile (hard gate) | BLOCKED -- box degraded + reconciliation owed; NOT cleared |
| Phase B G2 | alpha implementation overall | BLOCKED behind reconciliation |
| Reconciliation | FD-31 data-swap leg (on-disk `.env` -> canon) | MITIGATED -- landmine defused on disk, verified 2026-06-01 (FD-36); clean-restart path NOT robustly demonstrated; NOT closed |
| Reconciliation | FD-31 schema-fork leg | OPEN, gated -- scope + closure criteria TBD at reconciliation |
| Reconciliation | FD-31 degraded-state leg | OPEN -- port 3002->3000, route-loading bug (not re-verified this session), `pm2 save` / dump state |
| Prod box | `episode-backend` | FROZEN + DEGRADED, on canon live data (on-disk `.env` + running proc both `episode-control-dev`). `episode-api` PID 1380150 = a developer-initiated `pm2 restart 0` this session (gated deviation; transient probe failure, recovered healthy). `pm2 resurrect` run same session was a no-op (PID unchanged). `episode-worker` PID 1371604 = 2026-05-30 incident process, untouched. Dump refreshed post-fix via `pm2 save` to 2-app canon set (2026-05-31); cold-boot recovery UNVERIFIED -- do not reboot. |
| Deploy workflows | Deploy to Development / Auto-merge to Dev | DISABLED (FD-35); reconciliation-gated |
| Deploy workflows | Deploy to Production | ACTIVE -- third potential prod path; assess at freeze hardening |
| Register | FD entries | FD-1 through FD-37 (v1.8 adds FD-36, FD-37) |
| G1 sub-findings | live set | AB-AG + AI live; AH = void slip; audit doc tails at AA (v12 reconcile) -- unchanged |

**Path A discipline note:** v1.8 adds no scope to the fix cycle. It records a verification of prior Track A work, logs two developer-initiated freeze deviations honestly, and refines an existing blocker's characterization on live evidence; it originates no fix and authorizes no prod-box action. The restart and resurrect it logs were developer-initiated and are recorded with the recording-not-originating discipline.

## Sec 7 Ship plan

1. **v1.8 PR** on branch `claude/f-deploy-1-fix-plan-v1-8`, new file `docs/audit/F-Deploy-1_Fix_Plan_v1.8.md` alongside v1.0-v1.7 (versioned retention), commit tagged `[skip-automerge]` (belt-and-suspenders; the deploy workflows are disabled), FD-21-checked message (no `close` / `fix` / `resolve` + `#N`).
2. Required checks green (Cost Exposure Audit, Tests, Route Validation) -> confirm -> squash-merge.
3. Lockdown follow-ups owed (not this PR): incident-doc forward-pointer note (Sec 5); fold FD-36 / FD-37 into v12; reconciliation session scope = schema-fork + degraded-state legs; capture app logs if any future restart is contemplated (resolve the step-7 probe-failure cause).

---
*Fix Plan revision v1.8. Records FD-31 Track A on-disk verification (`.env` = canon, data-swap landmine defused on disk), logs a `pm2 restart 0` + `pm2 resurrect` freeze-deviation sequence with PID-continuity forensics (restart produced the healthy process; one transient unexplained probe failure; resurrect was a no-op), and supersedes the incident-doc on-disk-`.env` claim. The data-swap leg is MITIGATED, not closed -- clean-restart unproven, reboot unverified. Schema-fork and degraded-state legs remain OPEN and reconciliation-gated. Advances no Phase B gate; authorizes no prod-box action; the freeze stands.*
