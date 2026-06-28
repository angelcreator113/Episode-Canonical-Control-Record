# F-Deploy-1 -- Sec 5 Re-Verify Evidence (2026-06-26)

> ⚠️ **COLD-SESSION CONTAMINATION WARNING:** This document contains live-derived
> identity and fingerprint values (RDS address, table counts, PM2 process state,
> instance ID, git HEAD) that a cold [3] session must re-derive independently.
> **Reading this file disqualifies a session from priming or closing the [3]
> combined-restart window.** Archive reference only — do not read in a [3] session.
> Filed as the underlying evidence for the 2026-06-26 zero-delta re-verify sample
> cited in the AG-gate write-quiescence finding (PR 871, on main).

> **Session scope:** Read-only. Zero box mutations. Box remains FROZEN.
> This note records the Sec 5 live abort re-verify (FD-31 §7 + runbook Sec 5).
> Executed fresh this session -- not inherited from any prior session.

## Execution metadata

- Date: 2026-06-26
- Method: workstation → canon RDS, `PGOPTIONS=-c default_transaction_read_only=on`
- RDS host resolved: `episode-control-dev.csnow208wqtv.us-east-1.rds.amazonaws.com`
- **No on-box psql used.**

## Step 1 — Freeze state (live, re-derived)

| Signal | Value | Match baseline |
|---|---|---|
| Instance ID | `i-02ae7608c531db485` | ✅ matches Phase 2A Step 3 |
| Hostname | `ip-172-31-26-1` | ✅ |
| Git HEAD on box | `13002465...` | ✅ matches Phase 2A Step 3 |
| DB_HOST on box `.env` | `episode-control-dev.csnow208wqtv.us-east-1.rds.amazonaws.com` | ✅ canon-only, no prod creds |
| PM2 id 0 `episode-api` | online | ✅ |
| PM2 id 1 `episode-worker` | online | ✅ |
| PM2 id 3 `episode-api-prod-hotfix` | online | ✅ |
| Staging tree `/home/ubuntu/episode-nodemodules-staging-20260625/` | present | ✅ unchanged from Phase 2A |
| Disk `/` | 78% / 1.8G free | ✅ matches Phase 2A Step 3 |

**Verdict: FROZEN. No mutations since Phase 2A Step 3 (2026-06-25).**

## Step 4 — Canon RDS identity (re-derived, not inherited)

Confirmed by DATA, not instance name string:

| Field | Value |
|---|---|
| `current_database()` | `episode_metadata` |
| `inet_server_addr()` | `10.0.20.224` |
| `current_setting('transaction_read_only')` | `on` |

Matches Phase 2A Step 3 baseline exactly. VPC-internal IP confirms same instance.

## Sec 5 / FD-31 §7 abort gate results

| Check | Expected | Live result | Gate |
|---|---|---|---|
| episodes | 72 | 72 | ✅ PASS |
| shows | 10 | 10 | ✅ PASS |
| assets | 64 | 64 | ✅ PASS |
| world_events | 53 | 53 | ✅ PASS |
| wardrobe | 40 | 40 | ✅ PASS |
| social_profiles | 444 | 444 | ✅ PASS |
| franchise_knowledge | 605 | 605 | ✅ PASS |
| Table total (public BASE TABLE) | 143 | 143 | ✅ PASS |
| `ai_usage_logs` | ~765+ (not abort-fingerprint) | 767 | ✅ nominal, climbs as expected |
| Snapshot `episode-control-dev-prefreeze-insurance-20260530` | `available` | `available` (100%, 2026-05-30) | ✅ PASS |
| Verified dump `episode-control-dev-verified-20260530.dump` | present ~2.83 MB | present, 2,828,246 bytes (2.83 MB decimal) | ✅ PASS |

**All abort-gate checks: PASS. No STOP conditions triggered.**

## Durable credential gate (FD-31 §7)

Canon credential authenticated live this session (used for the above queries). Gate satisfied.

## Uncertainty gate (FD-31 §7)

RDS instance confirmed by `current_database()` + `inet_server_addr()` + VPC-internal IP, not by name string. No ambiguity about which instance was targeted.

## Overall verdict

**Sec 5 re-verify: ALL GREEN. No abort conditions.**

The pre-flight state established in FD-31 PreFlight Plan Sec 2 (all six gates GREEN as of 2026-06-01) remains intact. Canon data is stable and matches the 2026-05-31 verified catalog exactly. Snapshot and dump confirmed present and unmodified.

Box stays FROZEN. FD-31 OPEN. [3] not yet primed for execution.

---
*Read-only session. All checks executed workstation→RDS. No box contact beyond freeze verification (read-only SSH). No canon writes.*
