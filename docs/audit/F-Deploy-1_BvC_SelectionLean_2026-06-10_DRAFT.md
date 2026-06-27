> **[SUPERSEDED 2026-06-10 -- AT-FILING RECORD ONLY]**
> This v0.1 selection-lean is superseded by
> `F-Deploy-1_BvC_SelectionLean_Consolidated_2026-06-10_DRAFT.md` (v0.2).
> Its Sec 1 carries the disk-peak execution constraint as OPEN and frames the lean's
> "not firm" on that openness. Both are stale: the constraint was resolved by method
> (off-box build + stream-extract) in `F-Deploy-1_B_Install_Method_2026-06-10_DRAFT.md`,
> and the lean is "not firm" on [3]-non-execution, not on an open input. The body below
> is retained unaltered as the at-filing record. For current state, read the consolidated note.
> Box stays FROZEN; FD-31 OPEN; [3] not primed.
# F-Deploy-1 -- B-vs-C Reconciliation Strategy: SELECTION LEAN (DRAFT v0.1)

> **RECORDS A SELECTION DIRECTION. AUTHORIZES NO BOX ACTION. PRIMES NOTHING.**
> This note records that the B-vs-C reconciliation fork -- priced on both halves
> (`F-Deploy-1_Strategy_Pricing_BvC_2026-06-09_DRAFT.md`) and measured on its one
> open axis (`F-Deploy-1_ProdBox_HeadroomCheck_2026-06-10_DRAFT.md`) -- resolves
> toward **Strategy B (parallel checkout + cutover)** as a *lean*, not a firm close.
> C is parked, not killed: its hazard analysis stays on record and it remains
> recoverable if B's one open execution constraint (disk peak) fails to clear.
> This selects a direction only. It does NOT prime [3], does NOT spec B's
> execution, and changes nothing operationally. Box stays FROZEN; FD-31 OPEN;
> [3] not primed.

| | |
|---|---|
| **Trigger** | The headroom check (2026-06-10) removed the single measurable blocker the pricing note named, landing the fork in the "headroom verified sufficient" branch. With both halves priced and the open axis measured, the fork is resolvable -- Evoni's deliberate call. |
| **Inputs** | Pricing note (both halves on common cost terms; A withdrawn); headroom note (sufficient, disk-bound); strategy-revisit note (named trap). |
| **Method** | Decision record only. Workstation. No SSH, no box, no mutation, no commit. |
| **Status** | DRAFT v0.1 -- lean recorded; write-up pending review. Not canon. C parked, not closed. |

---

## Sec 0 -- The lean, and why a lean and not a firm close

**Direction: Strategy B.** On the measured evidence plus B's structural advantages, B is the better path for the project. Recorded as a *lean* rather than a firm close because one open execution constraint can still move the answer, and closing C now would discard the only off-ramp if it does.

**Why B (the case, condensed -- authorities hold the detail):**
- **C's lightness is illusory once made safe.** Two of C's four hazards sit at precondition level (H2 credential rotation; H4 encoding direction-of-truth forcing C off a blind reset). Made-safe C acquires most of B's properties (verify, preserve, reversible) while keeping its one irreducible disadvantage: it operates destructively on the only live-serving tree.
- **B carries two advantages C structurally cannot match.** It absorbs the Track B topology realignment [3] needs regardless (not pure added cost), and its rollback is free and standing (old tree keeps serving; cutover is a reversible traffic switch). The free standing rollback is the abort-as-success posture the forensic culture is built on -- B's abort is inherent; C's must be manufactured and is only as good as its backup.
- **The measurement paid down B's one concentrated cost.** Headroom sufficient (memory comfortable; disk fits). B's cost came down; C's disadvantage is structural and permanent.

**Why a lean, not firm:** the headroom result is *sufficient but disk-bound* -- thin residual on a single 68%-used volume, zero swap. B's binding open constraint (Sec 1) could, if it fails, break the disk fit. Until it clears, C stays recoverable.

---

## Sec 1 -- B's one open execution constraint (must resolve BEFORE priming)

Selecting B is choosing the direction, not approving the operation. Before B moves from *chosen* to *primed*, one question must be pinned:

**Does B's checkout-and-process flow reuse the existing `node_modules`, or install fresh -- and what is the transient install/checkout peak against the residual disk margin?**

This is the single number that could turn the headroom note's "thin but fits" into "does not fit." It is the live constraint on B and the specific condition under which C would be reconsidered. It is NOT resolved here; it is carried forward as a must-resolve-before-priming item.

---

## Sec 2 -- C: parked, not killed

C is not closed. Its full hazard analysis (H1 manufactured rollback, H2 credential precondition, H3 split-brain neutral, H4 encoding precondition) stays on record in the pricing note. C is recoverable as the selected strategy if and only if B's disk-peak constraint (Sec 1) fails to clear. Recording B as a lean rather than a firm close is precisely what keeps this off-ramp open.

A withdrawn remains withdrawn.

---

## Sec 3 -- What this does NOT change

- Prod box stays **FROZEN.** This is a decision record; it authorizes no box action and primes nothing.
- **FD-31** schema-fork and degraded-state legs remain **OPEN.**
- **[3]** is **not primed.** The box-mutating session (executing B) still requires its own deliberate, backup-first window with a fresh Phase 1 abort re-verify at its start.
- The split-brain hazard (AG / H3) is untouched -- B's cutover must still prove it landed on canon by IP/VPC + row counts, never by name string.
- B is **not yet spec'd.** The disk-peak constraint (Sec 1) is open. Selecting B is choosing direction, not approving operation.
- C's hazard analysis stays on record; C remains recoverable per Sec 2.

---

## Sec 4 -- Recommended register / handoff updates (DRAFTS -- for Rule 7 execution separately)

- **Reconciliation Plan Sec 3 / fork:** record B as the selected direction (lean), citing the headroom note (authority for the numbers) and B's two structural advantages; A withdrawn; C parked-not-killed with hazard analysis retained.
- **Reconciliation Plan Sec 4:** record the `node_modules` reuse-vs-install / transient-peak question as B's must-resolve-before-priming execution constraint, and as the specific condition that reopens C.
- **No fingerprint numbers inlined.** Point to the headroom note and pricing note as authorities.
- **Standing hazards restated** so the lean is not misread as authorization: FROZEN / FD-31 OPEN / [3] not primed.

---
*B-vs-C reconciliation fork resolved toward Strategy B as a selection lean, not a firm close, after the 2026-06-10 headroom check landed the fork in the "headroom verified sufficient" branch. B chosen on measured evidence (headroom sufficient, disk-bound) plus two structural advantages C cannot match (absorbs Track B topology; free standing rollback) against C's irreducible disadvantage (destructive on the live serving tree). Recorded as a lean because one open execution constraint -- B's `node_modules` reuse-vs-install behavior and transient disk peak against a thin residual margin -- can still move the answer; C is parked, not killed, recoverable if that constraint fails. Selects direction only: primes nothing, specs nothing, authorizes no box action. Box stays FROZEN; FD-31 OPEN; [3] not primed.*
