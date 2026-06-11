# F-Deploy-1 — CORRECTION to EntryGate Readiness synthesis (#779): boot test #3 is GREEN, not untested (2026-06-11, DRAFT v0.1)

> **READ-ONLY CORRECTION RECORD. AUTHORIZES NO BOX ACTION. CHOOSES NO STRATEGY.**
> Corrects a stale-but-coherent claim in `F-Deploy-1_EntryGate_Readiness_2026-06-11_DRAFT.md`
> (landed via #779). That synthesis names the dev-box boot test (Plan Sec 2 #3) as the
> critical-path NEXT step and states it "untested" / the B-vs-C fork "not ripe." Both are
> incorrect against live origin/main: #3 was answered **GREEN on 2026-06-09**, recorded in
> a result doc that was already on main when #779 was written. The boot test is **done**;
> the real next step is the **B-vs-C selection**, which is **ripe but unselected**.
> Box FROZEN; FD-31 OPEN; [3] not primed. This note edits no other file and selects no strategy.

## What #779 says (the stale framing, left intact as at-filing record)
Per the additive-supersede convention, #779's body is NOT edited. The specific claims this
note supersedes, quoted from `F-Deploy-1_EntryGate_Readiness_2026-06-11_DRAFT.md`:
- Sec 4 heading: "Critical-path next step — the dev-box boot test (Plan Sec 2 #3)."
- "Plan Sec 2 #3 … — untested (Session 1 was file-delta only)."
- "The live fork is B vs C, not ripe, turning entirely on #3."
- Readiness verdict: "[3] / Phase 2 … blocked on B-vs-C, which is blocked on the dev-box boot test (#3)."

## What live origin/main actually shows
**Authority:** `docs/audit/F-Deploy-1_DevBox_BootTest_Sec2-3_2026-06-09_DRAFT.md` — on main,
tracked, dated 2026-06-09 (i.e. two days BEFORE #779 was authored). It records:
- **#3 is GREEN.** Clean origin/main (HEAD `931526af`, hash-verified) booted successfully
  against canon on dev box `i-016395bb5f7a51a0b`, node-direct foreground, port 3002, ready
  state reached, stopped clean.
- **No schema mutation, proven in-log** (not assumed): both sync flags undefined; app
  emitted "Skipping model sync (database already initialized)."
- **Fork status (that doc, Sec 5):** the B-vs-C fork is now **RIPE but UNSELECTED** — its
  gating input is satisfied. It is NOT "not ripe," and it is NOT blocked on a boot test.

The Reconciliation Plan's own Sec 2 STATUS banner corroborates: "#3 … ANSWERED GREEN —
dev-box boot test 2026-06-09."

## Net correction
- **Boot test #3:** DONE / GREEN (2026-06-09). NOT the next step. Do not re-run it.
- **B-vs-C fork:** RIPE, gating input satisfied, **UNSELECTED.** This is the real next
  decision — deliberate, Evoni's, not yet made.
- **#3-GREEN retires bootability-unknown ONLY.** Strategy C's other hazards stand intact
  (live-serving destructive transition, untracked `.env.bak*`, AG split-brain check,
  encoding direction-of-truth regression). Per the boot-result doc, "nothing to lose" +
  "now it boots" does NOT mean "safe to reset."

## How this happened (recorded so the next session doesn't re-walk it)
#779 synthesized four sources but did not incorporate the 06-09 boot-result doc that had
already answered #3. A fresh-session brief carried the same "untested" framing, and the
#779 review checked against that brief rather than against the boot-result doc on main.
This is the project's primary failure mode — a coherent synthesis stale against a source
that was already live. Caught by reading the live Plan banner + boot-result doc instead of
trusting the synthesis. Live state beats docs beats memory; a confident, well-formed doc is
not authority.

## Scope
Doc-only, additive. No edit to #779's file. No edit to the Plan, the boot-result doc, or
any register. No finding-code change. No strategy selected. Box FROZEN; FD-31 OPEN; [3] not primed.

## Sources (live origin/main, read 2026-06-11)
`F-Deploy-1_DevBox_BootTest_Sec2-3_2026-06-09_DRAFT.md` (the authority — #3 GREEN, fork ripe-unselected) ·
`F-Deploy-1_Box_Repo_Reconciliation_Plan_DRAFT.md` (Sec 2 STATUS banner: #3 ANSWERED GREEN) ·
`F-Deploy-1_EntryGate_Readiness_2026-06-11_DRAFT.md` (#779 — the corrected synthesis)

---
*Correction to #779's entry-gate readiness synthesis. #779 names the dev-box boot test (Plan
Sec 2 #3) as the untested critical-path next step and the B-vs-C fork as not-ripe; both are
wrong against live origin/main. #3 was answered GREEN 2026-06-09 (boot-result doc on main,
HEAD 931526af, in-log no-sync proof). Real next step: the B-vs-C selection — ripe, gating
input satisfied, unselected, deliberate, Evoni's. C's non-boot hazards intact. Doc-only,
additive, no strategy chosen; box FROZEN; FD-31 OPEN; [3] not primed.*