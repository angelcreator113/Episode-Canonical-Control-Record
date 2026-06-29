# F-Deploy-1 — [3] Cold-Entry Live Abort Re-Verify — Evidence Note (2026-06-29)

> Additive evidence record. Captures the live re-verify run at this cold session's
> start per the Cold-Entry Allow-List (NON-PRIMING) and Master Runbook Sec 5 /
> FD-31 §7. Read-only throughout. Frozen prod box NOT touched. This note records
> measured values + provenance; it carries NO cutover, abort-window, or rollback
> conclusions and does NOT itself authorize the [3] window.

## Provenance
- Session entry: cold. Wake-up trio run; live HEAD `691aea06` (origin/main,
  merge of PR #877 Phase2A construction spec). PR #876 open, unmerged.
- Permitted reads completed: Master Runbook Sec 5 (scoped), FD-31 §7 (abort conditions).
- Connection: direct workstation→canon RDS, no proxy/tunnel. Read-only enforced
  (`PGOPTIONS=-c default_transaction_read_only=on`).

## Identity gate — PASS (canon by identity chain)
- current_database = episode_metadata
- current_user = postgres
- inet_server_addr = 10.0.20.224 (in-VPC, private)
- inet_server_port = 5432
- version = PostgreSQL 17.9
- Note: "names mislead" rule fired and cleared by identity chain, not by label trust.

## Content-count parity vs catalog — PASS (zero drift)
| table | live | catalog |
|---|---|---|
| episodes | 72 | 72 |
| shows | 10 | 10 |
| assets | 64 | 64 |
| world_events | 53 | 53 |
| wardrobe | 40 | 40 |
| social_profiles | 444 | 444 |
| franchise_knowledge | 605 | 605 |
| _table_total | 143 | 143 |
- No stray tables (total exact). ai_usage_logs not checked — not a fingerprint by design.

## Backup artifacts — PASS
- Snapshot episode-control-dev-prefreeze-insurance-20260530: status=available,
  created 2026-05-30T22:28:53Z.
- Verified dump episode-control-dev-verified-20260530.dump: present, 2.7 MB,
  LastWrite 2026-05-31. Structural integrity confirmed via pg_restore (PostgreSQL 18.1)
  --list → 2010 TOC entries, no error. (Local 16.13 client cannot parse format 1.16;
  17.9-written archive read with 18.1 client. Size 2.7MB vs catalog ~2.83MB = MB
  rounding convention, resolved by successful TOC enumeration, not inference.)

## Result
Live abort re-verify: 5/5 PASS. No abort condition fired. Cold-entry re-verify
satisfied for [3] as of 2026-06-29 @ HEAD 691aea06.

## Open items carried forward (NOT resolved by this note)
**This note is a point-in-time snapshot (2026-06-29). It does NOT substitute for
the execution-window re-verify. A later session opening the [3] window must run
its own live Sec 5 / FD-31 §7 re-verify before any cutover step — this evidence
records today's state only.**

- Box-IP discrepancy: memory `.164` vs Allow-List `.144` (prod EC2, different
  system). Untouched today. Resolve LIVE at box-touching window, not from doc/memory.
- This note does not prime the [3] execution window. Cutover (Sec 7/7A), abort
  conditions (Sec 8), rollback (Sec 9) NOT read this session by design — the
  execution window requires its own session per session-boundary discipline.
