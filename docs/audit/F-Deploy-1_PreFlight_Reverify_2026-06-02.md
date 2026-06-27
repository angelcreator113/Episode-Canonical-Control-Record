# F-Deploy-1 -- [3] Pre-Flight Live Re-Verify, Session 2026-06-02 (FINDINGS)

> **PREP / FINDINGS DOCUMENT. AUTHORIZES NO PROD-BOX ACTION.**
> This records a live re-verification of the FD-31 / [3] pre-flight performed
> 2026-06-02, ahead of attempting the combined-restart window ([3]). The re-verify
> found two gate drifts since the 06-01 pre-flight was marked complete. One is
> benign (catalog); one is a real open finding (credential / gate 2.5). [3] did NOT
> execute. No mutable action was taken -- all steps were read-only.

| | |
|---|---|
| **Session** | 2026-06-02, fresh start. Goal was to execute [3]; outcome is a pre-flight re-verify that caught two drifts. |
| **Parent** | FD-31 Reconciliation Pre-Flight v1.4; the [3] combined-restart window (v13 handoff Sec 4). |
| **Authorities** | FD-31 Pre-Flight v1.4 (Sec 2 gates, Sec 3.1 catalog, Sec 7 abort conditions), Track B v0.2, v13 handoff Sec 4. |
| **Status** | [3] NOT executed. Phase 0 (live abort re-verify) ran; one check explained-benign, one gate found NOT green. [3] remains gated, now with an added hard prerequisite (credential reconcile, box-side). |
| **Main HEAD at session** | `359b6d4e` (#748, v13). Unchanged overnight. Prod `200` at session start. |

---

## Sec 0 -- One-line

Live re-verification of [3]'s pre-flight found that two FD-31 gates, marked
GREEN/DONE on 05-31--06-01, no longer hold as of 2026-06-02: the catalog drifted +1
(benign -- a live AI-usage log row) and the on-disk `.env` credential does NOT
authenticate against canon (real -- gate 2.5 is not green). [3] must not run until the
credential is reconciled box-side. The re-verify did its job: it caught, before the
irreversible restart, a condition that would have crashed prod on that restart.

## Sec 1 -- What was re-verified (FD-31 Sec 7 abort checks, live)

Read-only, 2026-06-02. Rollback net + canon-unchanged, per the plan's requirement to
re-verify live and not trust a prior session.

| Check | Result |
|---|---|
| Snapshot `episode-control-dev-prefreeze-insurance-20260530` | ✅ `available` (created 05-30) |
| Verified dump `episode-control-dev-verified-20260530.dump` on disk | ✅ present, 2,828,246 bytes (2.83 MB), dated 05-31 -- matches Pre-Flight gate 2.1b |
| Content tables vs catalog | ✅ episodes 72, shows 10, assets 64, world_events 53, wardrobe 40, social_profiles 444, franchise_knowledge 605 -- all exact |
| Table total | ✅ 143 |
| `ai_usage_logs` | ⚠️ 765, catalog says 764 -- drift, see Sec 2 (benign) |

Connection method: psql direct from workstation to the canon RDS endpoint, read-only
(`PGOPTIONS=-c default_transaction_read_only=on`). The on-box psql path (Pre-Flight
Sec 3.3) was deliberately avoided -- it puts the operator one keystroke from a pm2
mutation on the live prod host during the [3] session. Workstation-direct is read-only-safe
and reaches canon (RDS SG currently admits the workstation IP -- itself F-Deploy-G1-AF,
the open `0.0.0.0/0` finding, to be closed in [3]'s security sweep).

## Sec 2 -- Drift #1: `ai_usage_logs` 764 -> 765 (BENIGN -- re-baseline catalog)

The three newest rows by `created_at`:
- id 765 -- 2026-06-01 18:25:32 UTC  (NEW -- stamped during the 06-01 session)
- id 764 -- 2026-05-15 23:04:22 UTC
- id 763 -- 2026-05-15 21:46:32 UTC

A single new row, timestamped during yesterday's live session, on an append-only
AI-usage log table, while prod was up and serving. This is normal logging from a live
system, not a canon mutation. The seven content tables and the 143 table total are all
unchanged. **Action: re-baseline the Pre-Flight Sec 3.1 catalog `ai_usage_logs` to 765**
(and note that this count is expected to keep climbing with live AI traffic -- it is a
poor abort-fingerprint table; the content tables are the meaningful ones).

## Sec 3 -- Drift #2: `.env` credential does NOT authenticate (REAL -- gate 2.5 NOT green)

### Sec 3.1 -- What was found
- The on-disk **workstation** `.env` `DB_PASSWORD` is a clean 40-char value (verified
  extraction: correct prefix stripped, no quotes, no trailing whitespace/CR).
- That value **fails** auth against canon: `FATAL: password authentication failed for
  user "postgres"`.
- A **different** 40-char password authenticates successfully (held separately during
  the session; canon accepted it -- the row-count checks above ran under it).
- Length comparison: both 40 chars, **not equal** (`match: False`). Genuinely different
  strings -- not a formatting artifact.

### Sec 3.2 -- Why this matters
- The 06-01 incident doc (Sec 3) recorded that the on-disk `.env` password
  authenticated against canon ("auth-ok") ~18h earlier. It no longer does.
- FD-31 Pre-Flight **gate 2.5** ("durable credential location = the canon-only on-disk
  `.env`, verified present/working") was marked GREEN. It is **no longer green** on the
  evidence here.
- **[3] consequence (the sharp one):** [3] Phase 3 is a prod restart. A restart reads
  `.env`. If the credential `.env` holds is stale, the restarted prod process fails canon
  auth and comes up DB-disconnected -- a fresh outage. **The credential divergence would
  have CAUSED the exact outage [3] exists to prevent.** This is the second time in two
  sessions the live re-verify caught something that would have bitten during the
  irreversible step (the first being FD-36's data-swap, caught earlier).

### Sec 3.3 -- IMPORTANT scoping correction (do not skip at next session)
All credential checks this session read the **workstation** `.env`. The file that
actually governs a prod restart is the **box's** `/home/ubuntu/episode-metadata/.env`,
which was **NOT inspected** this session (it requires SSH to the prod host -- deferred
deliberately, not done at the tail of a long session). Therefore:
- It is **unknown** what password the box's `.env` currently holds, i.e. what a restart
  would actually use.
- The workstation `.env` is NOT a confirmed proxy for the box's `.env`.
- Gate 2.5's true status is **UNVERIFIED** (not "failed") -- pending a read-only
  inspection of the box's `.env` (`pm2 env 3` shows the running process's working
  credential; the box's `.env` on disk shows what a restart would read; compare the two).

### Sec 3.4 -- Cause unconfirmed
`aws rds describe-db-instances` for `episode-control-dev` showed `available`,
`PendingModifiedValues: {}` -- no password change in flight. This does not rule out a
*completed* server-side rotation. Whether (a) the canon password was rotated after 06-01
and `.env` not updated, or (b) `.env` was edited to a wrong value while the running
process kept the correct one in memory, is **undetermined**. Investigate box-side next
session.

## Sec 4 -- Credential sprawl (cleanup done; reinforce FD-31 Sec 6.5)
During the session the working canon password was placed in a Downloads `.txt` and
briefly written into a workstation `.env.production`. Both cleaned up (`.env.production`
reverted -- confirmed untracked/gitignored, never staged; Downloads file deleted). No
credential reached git. Reinforces the FD-31 Sec 6.5 rotate-at-cutover list: the canon
`-dev` password has now been handled in multiple plaintext locations across sessions --
rotation at [3] cutover is well justified.

## Sec 5 -- What [3] now requires (added prerequisite)
[3] (combined-restart window) entry gate, updated:
1. Re-verify FD-31 Sec 7 abort checks LIVE (per v13 Sec 4) -- catalog now 765 for
   `ai_usage_logs`, content tables 72/10/64/53/40/444/605, total 143.
2. **NEW HARD PREREQUISITE -- credential reconcile, BOX-SIDE.** Before any restart:
   read-only inspect the box's `/home/ubuntu/episode-metadata/.env` and the running
   process's credential (`pm2 env 3`); establish which password canon accepts; ensure the
   box's `.env` holds a working canon credential (write it if stale). Only then is a
   restart safe. This folds into / supersedes the assumption behind FD-31 Pre-Flight
   gate 2.5 -- which can be re-marked green only after this box-side verification.
3. AK five-point audit (from v13 Sec 4 / finding AK) -- unchanged, still required.
4. Then: FD-31 cred rotation + Track B restart-to-align + route fix + security sweep, one
   window; post-restart `/health` must show canon host + matching counts or ABORT+restore.

## Sec 6 -- What this session did NOT do
- Did NOT execute [3] or any part of the restart.
- Did NOT touch, restart, or SSH to the prod box (all checks workstation-side, read-only).
- Did NOT write to canon (read-only transaction throughout).
- Did NOT inspect the box's `.env` (deferred -- Sec 3.3).
- Did NOT rotate any credential.
- Did NOT resolve the cause of the credential divergence (Sec 3.4).

---
*Session 2026-06-02 pre-flight live re-verify for [3]. Two gate drifts found since the
06-01 pre-flight-complete: `ai_usage_logs` +1 (benign, re-baseline catalog to 765) and a
real credential divergence -- the workstation `.env` password does not authenticate
against canon, gate 2.5 no longer green. The box's `.env` (the one a restart reads) was
not inspected and is the unverified unknown. [3] gains a hard prerequisite: a box-side
credential reconcile before any restart, or the restart-to-align would crash prod on canon
auth. No mutable action taken. The live re-verify worked as designed -- it caught a
restart-breaking condition before the irreversible step.*
