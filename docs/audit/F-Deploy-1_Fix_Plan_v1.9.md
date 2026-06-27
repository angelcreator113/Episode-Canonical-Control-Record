# F-Deploy-1 Fix Plan v1.9

**Records FD-38: the [3] integrity gate must count unfiltered physical rows, not /health's soft-delete-filtered live counts. Certifies the 7-table fingerprint baseline as unfiltered. This is a reconciliation-gate design correction discovered during a read-only confirm-live pass; it advances NO Phase 2 gate, authorizes NO prod-box action, and the FROZEN + DEGRADED box state and FD-31 open legs stand unchanged.**

| | |
|---|---|
| **Predecessor revision** | Fix Plan v1.8 (FD-36 / FD-37, FD-31 Track A on-disk verification; register through FD-37) |
| **Verification evidence** | Read-only confirm-live sequence, 2026-06-03, over SSH to prod box `episode-backend` and read-only psql to canon `episode-control-dev`. No state-changing actions taken. |
| **Gate transition** | NONE. FD-31 remains OPEN (schema-fork + degraded-state legs). Sec 4.2 stays BLOCKED. Box remains FROZEN; "do not reboot" stands. v1.9 records a finding only. |

## Sec 1 Purpose

During a 2026-06-03 read-only confirm-live pass, `/health` reported showCount 1 / episodeCount 18 while a direct unfiltered `count(*)` against canon returned shows 10 / episodes 72. Investigation (all read-only) established this is NOT a split-brain, data loss, or wrong-host condition: `/health` (`app.js:313-316`) filters `WHERE deleted_at IS NULL` (live catalog), while the Phase 1 integrity baseline counts unfiltered physical rows. The apparent 1/18-vs-10/72 contradiction is a counting-convention difference on a single intact dataset. v1.9 records this as FD-38 and corrects the reconciliation integrity-gate design so it cannot false-abort on this distinction.

What v1.9 does NOT do:
- Does NOT close or advance FD-31 (schema-fork + degraded-state legs remain open, reconciliation-gated).
- Does NOT unblock Sec 4.2.
- Does NOT authorize any prod-box action. No restart, rotation, pm2, or reboot. The freeze stands.

## Sec 2 Decisions log -- addition FD-38

v1.8 ended at FD-37. v1.9 adds FD-38.

- **Decision FD-38: Health counts are soft-delete-filtered; the reconciliation integrity gate uses unfiltered counts. Phase 1 baseline certified unfiltered across all 7 fingerprint tables.**

  Context: `/health` (`app.js:313-316`) reports showCount/episodeCount as `COUNT(*) ... WHERE deleted_at IS NULL` (live catalog). The Phase 1 integrity baseline uses unfiltered `count(*)` (physical rows). All 7 fingerprint tables carry `deleted_at`, so all are subject to the filtered/unfiltered distinction.

  Certified figures (canon `episode_metadata`, server 10.0.20.224, 2026-06-03), total (unfiltered) / live (deleted_at IS NULL):
  - shows 10 / 1
  - episodes 72 / 18
  - assets 64 / 24
  - world_events 53 / 53
  - wardrobe 40 / 40
  - social_profiles 444 / 444
  - franchise_knowledge 605 / 597

  All `total` values match the Phase 1 handoff baseline -> baseline confirmed unfiltered and internally consistent.

  (a) Live catalog of 1 show / 18 episodes is INTENTIONAL. Sole active show is SAL (id 9bd0655f-0426-4da4-95b8-44cdfd608b2b, name "Styling Adventures with Lala", status active), verified 06-03. Other 9 shows / 54 episodes / 40 assets are intentionally soft-deleted scratch/test data.

  (b) Integrity baseline remains UNFILTERED count(*): shows 10, episodes 72, assets 64, world_events 53, wardrobe 40, social_profiles 444, franchise_knowledge 605.

  (c) The reconciliation post-restart integrity check must compare unfiltered count(*) against canon via direct read-only psql -- NOT /health. /health is a LIVENESS signal only (200 + database:connected); its filtered counts are NOT the integrity comparator.

  (d) The integrity-gate query also asserts current_database() + inet_server_addr() so identity and integrity are verified in one read.

  (e) ai_usage_logs is a volatile append-only counter: TRACKED but EXCLUDED from the hard fingerprint gate (weak as an abort fingerprint). Informational only; see PreFlight Plan Sec 3.1.

  Scope note: FD-38 is a gate-DESIGN correction for the future reconciliation session. It does not itself run, authorize, or schedule any restart. The box is frozen; this entry changes only how a later, separately-authorized integrity check should count.

  Open backlog (non-blocking, recorded for reconciliation):
  - franchise_knowledge has 8 soft-deleted entries -- review before Director Brain / franchise_brain consolidation.
  - SAL show row has placeholder description ("ffff...") and stale denormalized episode_count=0 -- fix before user-facing launch.

## Sec 3 State of play at v1.9 close

| Area | Item | Status |
|---|---|---|
| Reconciliation | FD-31 data-swap leg | MITIGATED on disk (FD-36); NOT closed -- unchanged by v1.9 |
| Reconciliation | FD-31 schema-fork leg | OPEN, gated -- unchanged |
| Reconciliation | FD-31 degraded-state leg | OPEN -- port 3002->3000, route-loading bug, pm2 save/dump -- unchanged |
| Reconciliation | Integrity-gate counting method | CORRECTED (FD-38): unfiltered count(*) + identity asserts; /health demoted to liveness |
| Prod box | `episode-backend` | FROZEN + DEGRADED -- unchanged. No v1.9 action. "Do not reboot" stands. |
| Register | FD entries | FD-1 through FD-38 (v1.9 adds FD-38) |

**Path A discipline note:** v1.9 adds no scope to the fix cycle and authorizes no prod-box action. It records a read-only finding and corrects a gate-design detail for the future reconciliation session. The freeze stands; FD-31 remains open.

---
*Fix Plan revision v1.9. Records FD-38 (soft-delete-aware integrity gate; 7-table baseline certified unfiltered; /health reclassified liveness-only). Advances no Phase B gate; authorizes no prod-box action; the freeze stands.*
