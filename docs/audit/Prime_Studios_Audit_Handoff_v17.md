# Prime Studios Audit Handoff v17

**Authored 2026-06-12. Session-state handoff (prerequisites-only; no prod-box action). Additive on v16. v16/v15/v14/v13/v12/v10 remain canonical for anything v17 does not supersede — in particular, v16 (`931526af`, dated 2026-06-08) remains canonical for the FD-39 carry, which this session did not touch and the v17 author did not re-read.**

## Sec 0 — What changed v16 -> v17 (2026-06-12)

This was a **prerequisites-only session**. No box mutations, no `[3]` progress, no FD-39 changes. Four things were established, in order:

1. **`[3]` was NOT primed this session.** The session opened as a wake-up sequence and stayed on the read-only side of the `[3]` fence by design.
2. **The `[3]` Master Runbook is FROZEN at `5889f795`** — frozen *specifically because* it was still being edited same-day in this session context (`48daf250` -> `5889f795`, the Block-A supersession-date reconcile then the Step 8 AE re-route to SG-closure). A runbook that moved today is not a settled procedure for a deliberate `[3]` window. That same-day edit history is the reason this session was prerequisites-only by discipline, not an attempt at `[3]`.
3. **B-vs-C lean provenance is CLEARED on disk.** `F-Deploy-1_BvC_SelectionLean_Consolidated_2026-06-10_DRAFT.md` shows H1 = `RECORDED v1.0`, confirmed by reading the file (not the commit message). The prior "chat-upload-only / never committed" provenance blocker is closed. The runbook-stitch coupling that hung on it is no longer gated by provenance.
4. **`#752` (AK-3/AK-4 deploy-script fix) remains OPEN** (~10 days) and is treated as **parked-not-killed**: not a hard `[3]` blocker, lands as post-cutover cleanup (AK path (b)), not before. Live containment remains **path (a): `Deploy to Production` disabled**.

**Main HEAD at this writing:** `5889f795` (the runbook tip; doc-only `[skip-automerge]` work above it). Committing v17 will advance HEAD past this — the v18 author re-confirms tip via `git log`, never trusts this string.

**Supersedes v16 on:** nothing in the FD-39 carry. v17 *adds* the `[3]`-readiness / freeze-marker layer that v16 predates. v16 governs FD-39.

## Sec 1 — How to use this document (carry-forward from v15 Sec 1 + the v17 trap warning)

**Wake-up sequence, live state FIRST:** `git log --oneline -5` and `gh pr list --state open`.

**The coherent-but-stale trap this handoff exists to break:** as of v17 the runbook *looks* complete, the lean reads `RECORDED v1.0`, both pre-`[3]` loops are long closed, and the open-PR list is short. A fresh read can mistake that surface for "`[3]` is ready — just go." **It is not.** `[3]` still requires its own deliberately-primed session and a **fresh FD-31/FD-38 abort re-verify at that session's start, untrusted from any prior run including this one and including the run that produced the runbook now on main.** Surface readiness is not priming. If you find yourself reasoning "everything looks done, let's execute," that is precisely the read v17 was written to stop.

**Confirm at next session start:** (1) did v17 (this handoff) merge? (2) is `#752` still open, or did it land? (3) has `[3]` happened — if so, prod topology + credentials changed and the freeze marker below is stale.

## Sec 2 — `[3]` readiness state (the freeze marker)

- **Runbook:** FROZEN at `5889f795`. Next runbook touch happens ONLY inside a primed `[3]` session, and only if Step 0 re-verify forces a change. Do not edit it in any session that could drift toward execution.
- **Lean:** provenance cleared (`RECORDED v1.0`, on-disk confirmed). Not a blocker.
- **Restart vehicle:** LOCKED = A2 (direct pm2/ecosystem; `Deploy to Production` stays disabled through `[3]`; AK path (b) is post-`[3]` cleanup). Carry-forward from v15 Sec 4 — confirm v16 did not move this before relying on it.
- **AE remediation:** re-routed to SG-closure in `[3]` runbook Step 8 (`5889f795`). This changes *how* the box SG `0.0.0.0/0` gets closed in the post-cutover sweep, not *whether*.
- **`[3]` Step 0 comparator (do NOT inline numbers here):** FD-38 seven-table unfiltered `count(*)` fingerprint + identity asserts. `ai_usage_logs` EXCLUDED (volatile append-only — inlining courts a false abort). `/health` is liveness-only (`deleted_at IS NULL`), NOT the counts comparator. Read the live comparator from the Master Runbook Step 0 / Fix Plan v1.9 / Combined Restart Session Brief Sec 2 at `[3]` time. Any mismatch = ABORT; abort is a success condition.

## Sec 3 — `#752` park decision

- **Status:** OPEN, parked-not-killed. Gated behind the `[3]` window; lands as AK path (b) post-cutover cleanup, not before. No edits to the branch until `[3]` is primed.
- **Containment meanwhile:** path (a), `Deploy to Production` disabled, in force.
- **If a park comment was posted to the PR this session, note its presence; if not, the park is a recorded decision here regardless.**

## Sec 4 — Trust-the-prior-session checklist (for the v18 author)

- [ ] `git log --oneline -5` + `gh pr list --state open`. Did **v17** merge? Is **`#752`** still open (if landed, flip its disposition in Sec 3)?
- [ ] **Has `[3]` happened?** If yes: Sec 2 is stale, prod topology + credentials changed, and a fresh FD-31/FD-38 abort re-verify *was* required at its start — confirm it was run, untrusted from any prior.
- [ ] **Do NOT read Sec 2's "runbook frozen / lean RECORDED" as `[3]`-ready.** Surface readiness is not priming. `[3]` is its own deliberate session with a fresh abort re-verify at start (Sec 1 trap warning).
- [ ] Runbook still frozen at `5889f795` (or a later primed-`[3]`-session tip)? Confirm it was not edited outside a primed window.
- [ ] Carry-forward open from v15/v16: G2 §4.2 memory gate (≤820 MiB, 7-day burn-in, dev EC2); S4.2-B/S4.2-C disposition; AJ synthetic canary + target-health alarm (post-`[3]`); `-prod` teardown post-cutover; F-Stats-1 Phase B behind F-Deploy-1 close; `world_events` backfill migration `20260807000000` (reconciliation-gated, do NOT run/commit until cutover); Episode 1 status (still "Honey Table deprecated, replacement TBD"). Read v16 for the FD-39 carry — v17 did not re-verify it.

---
*Prime Studios Audit Handoff v17. Authored 2026-06-12. Additive on v16. Headline: prerequisites-only session — `[3]` NOT primed. The `[3]` Master Runbook is FROZEN at `5889f795` precisely because it was edited same-day here (`48daf250` -> `5889f795`); a runbook that moved today is not a settled procedure for a deliberate window. B-vs-C lean provenance cleared on disk (`RECORDED v1.0`). `#752` parked-not-killed under path (a). `[3]` remains its own deliberate session requiring a fresh FD-31/FD-38 abort re-verify at start, untrusted from any prior including the run that produced the on-main runbook. Surface readiness is not priming — Sec 1 trap warning. v16/v15/v14/v13/v12/v10 canonical for anything v17 does not supersede; v16 governs FD-39.*
