# Prime Studios Audit Handoff v15

**Authored 2026-06-03. Additive on v14; v14/v13/v12/v11/v10 remain canonical for anything v15 does not supersede.**

## Sec 0 — Front matter

**What changed v14 -> v15 (2026-06-03):**
- **Merge-state refresh completed from live repo state.** The v14 pending-merge framing is now stale by progression. `origin/main` is at `2799344d`; #751, #753, #755, #757, #758, and #759 are on main. **Only #752 remains open.**
- **Decision (a) is no longer recommended-only; it is ratified in Fix Plan v1.10.** [3] restart vehicle is A2 (direct pm2/ecosystem), and `Deploy to Production` stays disabled through [3].
- **FD-38 (Fix Plan v1.9) is now carried into handoff narrative.** Integrity gate comparator for [3] is unfiltered `count(*)` + DB/server identity asserts via direct read-only psql; `/health` is liveness-only.
- **SAL launch housekeeping from v1.9 backlog is now explicitly carried in handoff scope.** Non-gating, but tracked so it does not go silent: SAL placeholder description, stale denormalized `episode_count=0`, and 8 soft-deleted `franchise_knowledge` rows.
- **No gate movement. No prod-box action. No [3] scheduling.** FD-31 remains OPEN; Sec 4.2 remains BLOCKED; freeze/degraded state unchanged.

**Main HEAD at this writing:** `2799344d`.

**Supersedes v14 on:** merge-status framing in Sec 0/Sec 1/Sec 3/Sec 8/Sec 9/Sec 10; decision-(a) status language (recommended -> ratified); and integrity-gate wording references now aligned to FD-38 + #759.

## Sec 1 — How to use this document

Carry-forward from v14 Sec 1 with the following updates.

- **Wake-up sequence still applies:** run `git log --oneline -5` and `gh pr list --state open` at session start. At v15 close, only **#752** is open.
- **The next BIG step remains [3]** (combined prod-restart window), but this handoff does not prime or schedule it.
- **Prod state unchanged:** FROZEN + DEGRADED; up via additive hotfix lineage; no v15 box mutation.
- **Authorities (current-state):** FD-31 Pre-Flight plan (+ #749 re-verify lineage), Combined Restart Master Runbook (+ #759 FD-38 alignment), Fix Plan v1.9 (FD-38), Fix Plan v1.10 (decision-(a) ratified), hazard docs for split-brain and AK workflow path.

## Sec 2 — Keystone status (additive on v14 Sec 2 for F-Deploy-1)

- **F-AUTH-1 / F-App-1 / F-Stats-1 / F-Reg-2 / F-Ward-1 / F-Ward-3 / F-Franchise-1 / F-Sec-3** — unchanged from v14.
- **F-Deploy-1** — unchanged on gates: Phase A CLOSED; Phase B G1 CLOSED; Phase B G2 Sec 4.2 BLOCKED on FD-31.
- **Register status:** FD-1 through FD-38. v1.10 ratifies decision (a) and mints no new FD.

## Sec 3 — What moved since v14

### Sec 3.16 (NEW) — v14 pending-merge assumptions resolved by progression

v14 was authored while several items were pending. Those are now resolved on main:
- #755 (registry reconcile) landed on main.
- #751 (box-credential reconcile outcome) landed on main.
- #753 (AK five-point gate status addendum) landed on main.
- #757 (FD-38 fix-plan entry) landed on main.
- #758 (Fix Plan v1.10 ratification of decision (a)) landed on main.
- #759 (PreFlight/runbook wording alignment to FD-38) landed on main.

Open PR set at v15 close:
- #752 only (AK-3/AK-4 workflow corrections path).

### Sec 3.17 (NEW) — FD-38 enters handoff narrative layer

FD-38 (Fix Plan v1.9) is now a handoff-level authority, not only a fix-plan-local note:
- Hard integrity comparator at [3]: unfiltered `count(*)` on the 7-table fingerprint, plus `current_database()` and `inet_server_addr()` identity asserts, via read-only psql.
- `/health` is liveness-only (200 + DB connected), not the hard integrity gate comparator.
- `ai_usage_logs` remains informational and excluded from the hard fingerprint gate.

## Sec 4 — The next big step ([3]) and current constraints

[3] remains the gating production action and its own deliberate session. v15 adds no authorization, no schedule, and no topology change.

Current constraints (unchanged):
- FD-31 remains OPEN (schema-fork + degraded-state legs).
- Sec 4.2 remains BLOCKED.
- Prod box remains FROZEN + DEGRADED; do-not-reboot posture stands.
- Decision (a) for restart vehicle is now pre-ratified (A2 via v1.10), but that ratification does not itself advance gates.

## Sec 8 — Findings registry (v15 status pass)

- Registry reconcile status: no longer pending merge; #755 is on main.
- Shared-DB-coupling decision remains unchanged: no new G1 letter.
- AK five-point gate remains NOT fully satisfied while #752 is open; containment posture remains workflow disabled through [3].
- FD-38 is now cross-referenced in handoff layer as the integrity-gate counting authority.

## Sec 9 — Trust-the-prior-session checklist (UPDATE)

For the v16 author:
- [ ] Re-run live-state commands (`git log --oneline -5`, `gh pr list --state open`) and verify whether #752 merged.
- [ ] If #752 merged, update AK-3/AK-4 status from open-PR to on-main in registry/handoff references.
- [ ] Confirm no unrecorded action has moved [3], FD-31, or freeze state.
- [ ] Reconfirm G2 Sec 4.2 memory-gate status and any S4.2-B/S4.2-C disposition changes.
- [ ] Confirm Episode 1 status remains unchanged unless independently updated.

## Sec 10 — Outstanding housekeeping (UPDATE)

- **Primary live-doc housekeeping:** disposition #752.
- **[3] preparation remains gated:** fresh FD-31 abort re-verify at [3] session start; no trust-on-prior-run.
- **Carry non-gating SAL launch blockers from FD-38 backlog:**
  - Replace SAL placeholder description before user-facing launch.
  - Reconcile stale denormalized `shows.episode_count=0`.
  - Review/resolve 8 soft-deleted `franchise_knowledge` rows before Director Brain consolidation.
- **Carry-forward items from v14 not changed by progression:** AK-5 cleanup is parallel-safe; post-[3] AJ synthetic canary + target-health alarm; downstream keystones remain sequenced behind F-Deploy-1 closure.

## Sec 11 — Director Brain / Sec 12 — Episode 1 / Sec 13 — C2C (status-quo, unchanged)

All unchanged from v14/v13/v12 unless and until separate artifacts explicitly move them.

---
*Prime Studios Audit Handoff v15. Authored 2026-06-03. Additive on v14. Purpose: progression refresh only (v14 pending-merge assumptions replaced with live state), plus two additive narrative carries: FD-38 integrity-gate authority and SAL non-gating housekeeping blockers from v1.9 backlog. No gate transition, no prod-box action, no [3] scheduling; freeze and FD-31-open posture unchanged.*
