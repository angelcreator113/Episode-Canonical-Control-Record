# F-Deploy-1 Fix Plan v1.10

**Records the ratification of decision (a) — the [3] restart vehicle = A2 (direct pm2/ecosystem; `Deploy to Production` stays disabled through [3]). Recorded as RECOMMENDED-not-ratified in Handoff v14 (Sec 0/Sec 4 Loop 2/Sec 9); now formally ratified 2026-06-03. This is a desk decision: it advances NO Phase 2 gate, authorizes NO prod-box action, schedules NO [3] session, and the FROZEN + DEGRADED box state and FD-31 open legs stand unchanged.**

| | |
|---|---|
| **Predecessor revision** | Fix Plan v1.9 (FD-38 integrity-gate counting method; register through FD-38) |
| **Gate transition** | NONE. FD-31 remains OPEN (schema-fork + degraded-state legs). Sec 4.2 stays BLOCKED. Box remains FROZEN; "do not reboot" stands. v1.10 records a decision ratification only. |

## Sec 1 Purpose

Handoff v14 Loop 2 recommended decision (a) = A2 and instructed "ratify explicitly at [3] scoping, not during it." This revision records that ratification. No new investigation; no live action; the recommendation's reasoning (v14 Sec 4 Loop 2) is adopted as-is.

## Sec 2 Decision ratified — decision (a) = A2

- **The [3] restart vehicle is A2: direct pm2/ecosystem.** When [3] runs, prod is re-launched against the corrected #746 `ecosystem.config.js` with `--env production` (PM2 reads the prod block, port 3000). The GitHub Actions `Deploy to Production` workflow stays DISABLED through [3]. AK five-point path (b) becomes post-[3] cleanup.
- **Reasoning (adopted from v14 Sec 4 Loop 2):** AK-1/AK-2 (the workflow's `.env`/secret hazards) resolve only at cutover — no safe blind pre-write — so routing [3] through the workflow buys nothing and re-arms the FD-36 data-swap risk. The #746 ecosystem is corrected and live-verified, making direct `--env production` the known-good path.
- **Supersedes** the "RECOMMENDED, not yet ratified" status in Handoff v14 Sec 0 (line 10), Sec 4 Loop 2 (line 45), and Sec 9 checklist (line 64). Those three v14 lines are now READ as ratified per this revision; v14 is not edited (additive-supersede convention).

## Sec 3 Companion correction — PreFlight 6.3 post-restart check

PreFlight Plan Sec 6.3 step (post-restart) still reads "verify `/health` shows DB_HOST=canon and counts match Sec 3.1." FD-38 (Fix Plan v1.9) demoted `/health` to liveness-only and moved the integrity comparison to unfiltered `count(*)` via direct read-only psql. The Combined Restart Master Runbook was patched to FD-38 (#757); PreFlight 6.3's wording was not. **For any future [3] session, the integrity gate follows the runbook's FD-38 block (unfiltered count(*) + db/server identity asserts), NOT PreFlight 6.3's `/health` wording.** Recorded here as a known stale instruction; a one-line PreFlight 6.3 edit may fold it in at the next doc pass.

## Sec 4 State of play at v1.10 close

| Area | Item | Status |
|---|---|---|
| Decision | (a) [3] restart vehicle | RATIFIED A2 (2026-06-03) — was RECOMMENDED in v14 |
| Reconciliation | FD-31 data-swap leg | MITIGATED on disk (FD-36); not closed — unchanged |
| Reconciliation | FD-31 schema-fork leg | OPEN, decided (not ported, preserved); physical close at [3] — unchanged |
| Reconciliation | FD-31 degraded-state leg | OPEN; characterized; resolves at [3] — unchanged |
| Prod box | `episode-backend` | FROZEN + DEGRADED — unchanged. No v1.10 action. "Do not reboot" stands. |
| Register | FD entries | FD-1 through FD-38 — unchanged (v1.10 ratifies a decision, mints no FD) |

**Path A discipline note:** v1.10 adds no scope and authorizes no prod-box action. It records a desk ratification and one companion doc-correction note. The freeze stands; FD-31 remains open; [3] is not scheduled.

---
*Fix Plan revision v1.10. Ratifies decision (a) = A2 (direct pm2; `Deploy to Production` disabled through [3]). Notes PreFlight 6.3 ↔ FD-38 staleness. Advances no Phase B gate; authorizes no prod-box action; the freeze stands; [3] is not primed.*
