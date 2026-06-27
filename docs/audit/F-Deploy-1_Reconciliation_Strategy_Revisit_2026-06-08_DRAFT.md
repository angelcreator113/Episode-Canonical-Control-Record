# F-Deploy-1 — Box↔Repo Reconciliation: STRATEGY REVISIT (Plan Sec 3) RESULT (DRAFT v0.1)

> **READ-ONLY ANALYSIS RESULT. AUTHORIZES NO BOX ACTION. CHOOSES NO STRATEGY.**
> This note re-scores the Reconciliation Plan's Sec 3 candidate strategies (A / B / C)
> against the Session 1 finding (zero box-unique tracked content). It produces a
> re-scored understanding, a narrowed fork, and a named trap — it does NOT select a
> strategy (that is Evoni's, and per Sec 2/#3 it is not yet ripe), authorizes no box
> action, and schedules no session. Box stays FROZEN; FD-31 legs stand; [3] not primed.

| | |
|---|---|
| **Trigger** | Open thread: "does a lighter reconciliation warrant revisiting strategy selection?" (its own deliberate session, per the parked-thread framing). |
| **Inputs** | `F-Deploy-1_Box_Repo_Reconciliation_Plan_DRAFT.md` Sec 2 (selection criteria) + Sec 3 (A/B/C definitions) + Sec 4 (sequencing); `..._Session1_Results_DRAFT.md` (zero box-unique; encoding direction; method caveats); F-Stats-1 verification (a)+(b) note (CharacterState Phase A canon; Phase B gated on full close/FD-31). |
| **Method** | Workstation analysis only. No SSH, no box, no working-tree mutation, no commit. |
| **Status** | DRAFT v0.1 — analysis complete; write-up pending review. No execution. Not canon. No strategy chosen. |

---

## Sec 0 — Headline

The Session 1 finding (zero box-unique tracked content) **trips Sec 3's own stated selection rule** and resolves the re-score along one axis: it selects the plan's "lighter alignment" branch (Sec 3 close: "If most box edits are already upstream → lighter alignment"). Concretely:

- **Strategy A withdraws as a distinct option.** Its commit-first spine is de-justified — there is no box-unique keystone work to commit. What remains of A is the shared back-half ("align the box to origin/main"), which is not distinctive.
- **The live fork is B vs C** — and it is **not ripe**, because it turns on Sec 2 **#3** (does clean origin/main *boot* on the box), which is **unanswered.** Session 1 was file-delta only; #3 was never tested.
- **C is re-opened by its own escape hatch but its real hazard is intact.** The finding retired *content-loss* risk; C's actual risk (a destructive operation on a live-serving box, untested boot, untracked credential files) is untouched and, on encoding, worsened.

The revisit's honest output is a **narrowed fork + a named trap**, not a selection.

---

## Sec 1 — Strategy A: withdrawn (commit-first spine de-justified)

A's distinctive front-half is the commit-first spine: turn captured box edits into PRs, land the keystone work (sequelize split-brain, CharacterState) into canon, *then* align the box. That spine's entire premise is **box-unique keystone work needing to enter canon.** Session 1 found none — both named keystones are already in canon (sequelize fix committed upstream; CharacterState is Phase A canon, PR #684, per the F-Stats-1 verification note). Strip the spine and A reduces to the shared back-half every strategy has.

The Plan DRAFT called A "likely the spine of the answer," but that judgment rests on the pre-Session-1 assumption the DRAFT carries throughout (Sec 1: "dirty tree carrying uncommitted keystone work"). Session 1 overturns the assumption; A's billing goes with it. **A is not selected and not a live contender as a distinct strategy.**

---

## Sec 2 — Strategy B: safety intact; only an unused justification removed

B's value is operational: never operate destructively on the live tree; stand up a parallel clean checkout; verify-before-cutover; instant rollback. **None of that depends on whether the box holds unique work**, so the finding does not lower B's safety case at all. What the finding removes is a *preservation* argument B was never primarily making.

Net: B is "higher infra cost, safety fully intact, expense now looks less necessary." One structural advantage the finding makes salient: **B answers Sec 2 #3 inside its own method** — standing up and verifying a parallel checkout *is* the boot test — so B is robust to #3 being currently unknown. It pays for that robustness in infra effort.

---

## Sec 3 — Strategy C: re-opened by its escape hatch; real hazard intact (the trap)

C's rejection text is conditional: "REJECTED as primary on its face … Documented only to be explicitly ruled out *unless Sec 2 shows the delta is trivial.*" Session 1 shows the tracked-content delta is trivial. So C is no longer rejected on its **stated** premise (Session 1 Sec 6.3).

**But the finding addressed the wrong axis for C's real risk.** C's original rejection reason was a destructive collision on a live server. Session 1 addressed *content-preservation*. C's hazard is the destructive operation on a live-**serving** box, and that is fully intact. "The destination is benign" (box already runs this content) is not "the transition is safe." Landmines the finding does **not** touch:

1. **Sec 2 #3 unanswered.** No one has tested whether a clean origin/main checkout *boots* against the live .env/RDS. The plan says test this on the **dev** box `i-016395bb5f7a51a0b`, NOT prod. A C-style reset assumes a bootable target that has not been verified.
2. **Untracked files sit outside the finding.** Plan Sec 0 lists untracked `CharacterState.js` and three `.env.bak*` on the box. Session 1's "tracked content identical" says nothing about these; a `clean`/`reset` interacts with untracked credential-bearing `.env.bak*` files dangerously.
3. **AG split-brain hazard untouched.** A box op landing wrong-host boots clean and serves nothing; the post-op `DB_HOST=canon AND counts-match` check stays mandatory.
4. **Worsened by the encoding finding (Session 1 Sec 4).** A naive `git reset --hard origin/main` would *regress* the box's cleaner encoding to canon's mojibake + BOM. Even the lightest-looking C move has a direction-of-truth defect.

**The trap, named:** "nothing box-unique to lose" + "trivial delta" → "just reset the box." The finding makes that *feel* safe by retiring the one risk it retired (content loss), while leaving C's real risk — destructive live-server transition, untested boot, untracked credential files — completely standing. C is re-opened for consideration; C is **not** thereby safer.

---

## Sec 4 — The fork, and why it is not ripe

The live choice is **B vs C**. It turns on Sec 2 **#3**: does clean origin/main boot on the box (dev-tested)?

- **#3 GREEN** → C becomes a genuine lighter-weight contender (still requiring untracked-file handling, encoding direction-of-truth, AG check, Rule 7 per step).
- **#3 RED / untested** → C is not selectable; B's verify-in-method safety dominates.

#3 is currently **untested.** Therefore the revisit re-scores the #1 axis (resolved → light; A withdrawn) but **cannot select** B vs C. Strategy selection remains Evoni's and is **blocked on #3.**

---

## Sec 5 — Sequencing consequence (observation, not authorization)

Plan Sec 4's **Session 2 ("commit box-unique work") is empty** (Session 1 Sec 6.1), and the F-Stats-1 verification note confirms its sole named justification is moot twice over (CharacterState already Phase A canon; F-Stats-1 Phase B gated on full close/FD-31 regardless). The Session 2 slot collapses.

The natural repurpose of that now-empty slot is to **answer Sec 2 #3** — test clean origin/main on the **dev** box `i-016395bb5f7a51a0b`. It is the gating input for the B-vs-C choice *and* a precondition for Session 3's safety, and it is a dev-box task, not a prod-box mutation. **This is a sequencing observation, not a strategy choice or an authorization.**

---

## Sec 6 — What this does NOT change

- Box stays **FROZEN.** "Do not reboot" stands.
- **FD-31** schema-fork and degraded-state legs remain **OPEN.**
- **[3]** is **not primed.** Session 3 (the one box-mutating session) still requires its own deliberate, backup-first window with a fresh abort re-verify at its start.
- The split-brain hazard (AG) is untouched.
- **No reconciliation strategy is chosen.** A is withdrawn; B vs C is narrowed but unresolved (blocked on #3).
- Read-only workstation analysis. Advances **understanding**, not **execution**; **not canon** until reviewed and placed under Rule 7.

---

## Sec 7 — Recommended register / handoff updates (DRAFTS — for Rule 7 execution separately)

- **Reconciliation Plan Sec 3:** record A as withdrawn under the Session 1 finding (commit-first spine de-justified); record the live fork as B vs C, blocked on Sec 2 #3.
- **Reconciliation Plan Sec 4:** record Session 2 as collapsed (empty per Session 1); note the repurpose-to-#3 sequencing observation (dev-box boot test) as the next read-only/dev step, NOT a prod-box action.
- **No fingerprint numbers inlined.** Point to the Plan, Session 1 Results, and the F-Stats-1 verification note as authorities.

---
*Strategy revisit for the prod box↔repo reconciliation, re-scoring Plan Sec 3 (A/B/C) against the Session 1 zero-box-unique finding. Result: Sec 3's own selection rule selects "lighter alignment"; Strategy A withdraws (commit-first spine de-justified); the live fork is B vs C and is NOT ripe — it turns on Sec 2 #3 (clean origin/main boot, dev-tested), which is untested. Strategy C is re-opened by its escape hatch but its real hazard (destructive live-server transition, untested boot, untracked .env.bak files, encoding regression) is intact — the trap is mistaking "nothing to lose" for "safe to reset." Sequencing observation: Plan Session 2 collapses (empty); repurpose to answer #3 on the dev box. No strategy chosen; box stays FROZEN; FD-31 open; [3] not primed; no box action authorized.*
