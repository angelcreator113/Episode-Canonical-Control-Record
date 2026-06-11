# F-Deploy-1 — [3] ENTRY-GATE READINESS (2026-06-11, DRAFT v0.1)

> **READ-ONLY SYNTHESIS. AUTHORIZES NO BOX ACTION. PRIMES NOTHING. CHOOSES NO STRATEGY.**
> Consolidates a read-only cross-check of [3]'s entry-gate readiness across live
> origin/main sources. Its novel contribution is single-place synthesis — no single
> existing doc states the comparator-readiness + reparenting-resolution + critical-path
> next step together. No fingerprint numbers inlined (per standing discipline; sources
> cited). Box FROZEN; FD-31 OPEN; [3] not primed.

## Why this note exists
A fresh session reading Handoff v15's "abort comparator = Fix Plan v1.9" pointer gets a
correct comparator but would miss two things the live series has moved on: the Fix Plan
is now at v1.11, and [3] Phase 2 has been reparented behind a box↔repo reconciliation
that postdates v1.9. This note walks the live chain once so the next session doesn't
have to re-walk all four source docs.

## 1. Abort comparator — READY, consistent across three live sources
The FD-38 seven-table unfiltered `count(*)` fingerprint + identity asserts
(`current_database()`, `inet_server_addr()`), with `ai_usage_logs` excluded (volatile)
and `/health` demoted to liveness-only, is **consistent** across:
- **Fix Plan v1.9, FD-38** — the inline authority (certified 2026-06-03).
- **Master Runbook Sec 5** — faithful mirror.
- **Combined Restart Session Brief Sec 2** — mirror + explicit refutation of Handoff
  v14's stale eight-number string (the eighth number was `ai_usage_logs`, a false-abort
  trap).
No drift among the three. Numbers not reprinted here — read from FD-38 (v1.9) at [3]'s
session start. **v15's "v1.9" pointer is correct-by-content, incomplete-by-name** (the
runbook and Brief also carry it; the series is now at v1.11).

Resolves an open question in the Session Brief: its open-question #2 asked whether the
runbook carries the FD-38 comparator or still shows v14's eight-number list. Confirmed
this session — the runbook **does** carry FD-38 correctly.

## 2. Phase 1 abort re-verify — reusable, still a valid entry gate
v1.11 Sec 3 #2 states the runbook's Phase 0 / Phase 1 GREENs "still hold and are
reusable." Phase 1 (the live abort re-verify) is **untouched** by the reparenting below.
It remains a valid entry gate — but per all sources it must be run **fresh at [3]'s own
session start**, untrusted from any prior session. It is not the most-blocking item on
the critical path (see Sec 3).

## 3. Phase 2 / [3] is REPARENTED behind box↔repo reconciliation — real but lighter
- **v1.11 (Sec 2/3/4)** reparents [3] Phase 2 behind a box↔repo reconciliation, listed
  OPEN, "new prerequisite to [3]." FD-31's schema-fork/degraded-state legs are now
  *downstream* of this reconciliation.
- **Session1_Results v1.0** (the correction authority v1.11 Sec 4 cites) corrects FD-39's
  *nature*: the divergence was a **stale git pointer + cleaner box encoding drift**, not
  unique uncommitted prod-only work. All seven tracked box changes — including both
  keystones (sequelize split-brain fix, CharacterState wiring) — are **already in
  origin/main**. (Note: two near-identically-named Session 1 files exist —
  `..._Session1_Result.md` (granular delta) and `..._Session1_Results.md` (reviewed v1.0
  conclusion, the cited authority). They are a pair, not a dupe.)
- **Strategy Revisit (2026-06-08)** connects the two: Session 1's zero-box-unique finding
  trips the Reconciliation Plan's own selection rule → reconciliation becomes "lighter
  alignment," not the month-of-divergence crisis v1.11's finding-body described. The
  prerequisite still binds; it is lighter.

## 4. Critical-path next step — the dev-box boot test (Plan Sec 2 #3)
Reconciliation is blocked on **B-vs-C strategy selection**, which is blocked on **Plan
Sec 2 #3: does a clean origin/main checkout boot on the box?** — **untested** (Session 1
was file-delta only). Per Strategy Revisit:
- Strategy A withdrawn (commit-first spine de-justified — nothing box-unique to commit).
- The live fork is B vs C, **not ripe**, turning entirely on #3.
- Plan Session 2 ("commit box-unique work") **collapsed to empty**; its natural repurpose
  is to **answer #3 by testing clean origin/main on the DEV box `i-016395bb5f7a51a0b`** —
  a read-only/dev task, explicitly NOT a prod-box mutation.

**Scope boundary:** this boot test is **not within [3] scope** — it is a prerequisite to
*choosing* the reconciliation strategy that gates [3]. A passing dev-box boot test does
**not** begin [3]; it unblocks the B-vs-C choice, which must then be made before [3] can
even be sequenced. Do not conflate the two.

**The "nothing to lose" trap (standing hazard, restated):** Session 1 retired
*content-loss* risk only. Strategy C's real hazards are **intact** — destructive op on a
live-*serving* box, untested boot, untracked `.env.bak*` credential files, and an
encoding regression where a naive `git reset --hard origin/main` would regress the box's
cleaner text to canon's mojibake+BOM. "Nothing to lose" is not "safe to reset."

**Identity discipline:** the boot test is on DEV `i-016395bb5f7a51a0b` (98.93.190.74) —
NOT prod `i-02ae7608c531db485` (`54.163.229.144`). Assert identity by IP/VPC +
`current_database()`/`inet_server_addr()`, never by an instance-ID string propagated from
a doc (naming-inversion / split-brain standing hazard).

## Readiness verdict
- **Comparator:** READY, consistent, v15-correct.
- **Phase 1 abort re-verify:** reusable; run fresh at [3]'s session start.
- **[3] / Phase 2:** reparented behind a real-but-lighter reconciliation; **blocked on
  B-vs-C, which is blocked on the dev-box boot test (#3).** That boot test is
  **identified as the prerequisite for the B-vs-C strategy selection** — read-only,
  dev-box, not prod.
- Nothing here is authorized. Box FROZEN; FD-31 OPEN; [3] not primed; Session 3 still
  requires its own deliberate backup-first window with a fresh abort re-verify at its
  start.

## Sources (live origin/main, read 2026-06-11)
F-Deploy-1_Fix_Plan_v1.9.md (FD-38) · F-Deploy-1_Fix_Plan_v1.11.md (Sec 2/3/4) ·
F-Deploy-1_[3]_Master_Runbook_DRAFT.md (Sec 0/5) ·
F-Deploy-1_Combined_Restart_Session_Brief.md (Sec 2) ·
F-Deploy-1_Box_Repo_Reconciliation_Session1_Results.md (v1.0) ·
F-Deploy-1_Reconciliation_Strategy_Revisit_2026-06-08_DRAFT.md ·
F-Deploy-1_Box_Repo_Reconciliation_Plan_DRAFT.md (Sec 2 #3, Sec 3, Sec 4)

---
*[3] entry-gate readiness synthesis, 2026-06-11. Abort comparator confirmed consistent
and v15-correct across v1.9 FD-38 / Master Runbook Sec 5 / Session Brief Sec 2 (numbers
not inlined). Phase 1 abort re-verify reusable, run fresh at [3] start. [3] Phase 2
reparented behind a real-but-lighter box↔repo reconciliation; blocked on B-vs-C, blocked
on the dev-box boot test (Plan Sec 2 #3) — a prerequisite to choosing B-vs-C, NOT a step
within [3]; dev box i-016395bb5f7a51a0b, read-only. "Nothing to lose" does not equal
"safe to reset" — C's live-server/boot/.env.bak/encoding hazards intact. No box action
authorized; box FROZEN; FD-31 OPEN; [3] not primed.*