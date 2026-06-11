# F-Deploy-1 -- B-vs-C Reconciliation Strategy: SELECTION LEAN (CONSOLIDATED, DRAFT v0.2)

> **RECORDS A SELECTION DIRECTION. AUTHORIZES NO BOX ACTION. PRIMES NOTHING.**
> Consolidates and supersedes `F-Deploy-1_BvC_SelectionLean_2026-06-10_DRAFT.md` (v0.1).
> The fork -- priced on both halves (pricing note), measured on its open axis (headroom
> note), and with B's one open execution constraint now resolved by method (install-method
> note) -- resolves toward **Strategy B (off-box build + stream-extract + cutover)** as a
> *lean*, not a firm close. The lean is recorded as a lean because [3] has not executed,
> NOT because any selection-blocking input remains open: all three selection inputs are
> now closed in canon. C is parked, not killed: its hazard analysis stays on record and it
> remains recoverable under the restated reopen trigger (Sec 2). Selects a direction only.
> Does NOT prime [3], does NOT spec B's [3]-window operation, changes nothing operationally.
> Box stays FROZEN; FD-31 OPEN; [3] not primed.

| | |
|---|---|
| **Supersedes** | `F-Deploy-1_BvC_SelectionLean_2026-06-10_DRAFT.md` (v0.1) -- carried Sec 1 disk-peak as the open selection constraint and framed the lean's "not firm" on that openness. Both are now stale: the constraint is resolved by method (install-method note), and the lean is "not firm" on [3]-non-execution, not on an open input. v0.1 retained as at-filing record. |
| **Trigger** | The install-method note (2026-06-10) closed v0.1's Sec 1 open constraint by designing out the on-box transient disk peak. With pricing (both halves), headroom (open axis measured), and install-method (execution constraint resolved) all landed in canon, the fork has no open selection input -- it is resolvable on Evoni's deliberate call. |
| **Inputs (all on main)** | Pricing note (`F-Deploy-1_Strategy_Pricing_BvC_2026-06-09_DRAFT.md`; both halves on common terms, A withdrawn). Headroom note (`F-Deploy-1_ProdBox_HeadroomCheck_2026-06-10_DRAFT.md`; sufficient, disk-bound; holds the fingerprint numbers). Install-method note (`F-Deploy-1_B_Install_Method_2026-06-10_DRAFT.md`; disk-peak designed out, preconditions named). Strategy-revisit note (`F-Deploy-1_Reconciliation_Strategy_Revisit_2026-06-08_DRAFT.md`; named trap). |
| **Method** | Decision record only. Workstation. No SSH, no box, no mutation. (The disk-write + supersede-banner + commit of this note are themselves Rule 7 execute steps, gated on review.) |
| **Status** | RECORDED v1.0 -- consolidated selection lean reviewed and recorded as canon: Strategy B is the selected direction (lean, not firm close -- [3] not executed). C parked, not killed (Sec 2 reopen trigger). Selection recorded only; primes nothing, authorizes no box action. |

---

## Sec 0 -- The lean, and why a lean and not a firm close

**Direction: Strategy B.** On the measured evidence, the resolved execution method, and B's structural advantages, B is the better path for the project.

**What changed from v0.1.** v0.1 recorded the same direction but rested its "lean, not firm" on an *open* input -- the Sec 1 disk-peak question. That input is now closed in canon (install-method note). The direction is unchanged; the *reason it is a lean rather than a firm close* is corrected below.

**Why B (the case, condensed -- authorities hold the detail):**
- **C's lightness is illusory once made safe.** Two of C's four hazards sit at precondition level (H2 credential rotation; H4 encoding direction-of-truth forcing C off a blind reset). Made-safe C acquires most of B's properties (verify, preserve, reversible) while keeping its one irreducible disadvantage: it operates destructively on the only live-serving tree.
- **B carries two advantages C structurally cannot match.** It absorbs the Track B topology realignment [3] needs regardless (not pure added cost), and its rollback is free and standing (old tree keeps serving; cutover is a reversible traffic switch). The free standing rollback is the abort-as-success posture the forensic culture is built on -- B's abort is inherent; C's must be manufactured and is only as good as its backup.
- **B's one concentrated cost is now paid down on both axes.** The headroom read paid down the unverified-headroom half (memory comfortable, disk thin-but-fits). The install-method note paid down the disk-peak half -- not by measuring a transient (shown intractable) but by designing it out (off-box build, stream only the finished tree, peak collapses to steady state). C's disadvantage is structural and permanent; B's costs have been retired or designed around.

**Why a lean, not firm:** **not because any selection input is open** -- all three are now closed in canon. It is a lean because **[3] has not executed.** B remains a lean pending its [3]-window execution; the install-method note states the same ("B remains a lean, not a firm close, pending [3] execution"). Closing C now would discard the only off-ramp before B has been executed against its preconditions (Sec 2).

---

## Sec 1 -- B's execution constraint: RESOLVED BY METHOD

v0.1 carried one open execution constraint here -- whether B's checkout reuses `node_modules` or installs fresh, and the transient disk peak against a thin residual margin. **That constraint is resolved**, with the install-method note as the authority:

- The on-box install transient was shown **intractable to bound in advance** (lockfile v3 carries no unpacked-size fields; peak is a property of method not lockfile; the only faithful measurement is an inadmissible on-box write against the frozen box).
- Rather than measure it, the method **designs it out**: build dependencies off-box from the pinned commit/lockfile on a runtime-parity-matched host, produce a ready-to-run app+node_modules tree, and **stream-extract only the finished tree into a fresh parallel path on prod** -- no on-box install, no cache growth, no persisted tar. The only bytes landing on the constrained volume are the steady-state tree. Transient peak collapses to steady state; the residual margin becomes a static fit already known from the headroom read.

**What remains open is not a selection input -- it is [3]-window / [3]-spec work**, namely the method's hard preconditions (carried by the install-method note, not re-decided here):
- **P1 -- runtime parity (four-tuple):** Node major, npm major, CPU arch, libc family. Verified read-only at [3]-window open with clean pre-write abort on mismatch. Its sequencing dependency (build-host pre-pin vs window-open read) is discharged by the P1 parity sequencing note (`F-Deploy-1_P1_Parity_Sequencing_2026-06-10_DRAFT.md`, PR #767).
- **C1 -- fresh target path** (never extract over an existing tree).
- **C2 -- mandatory cleanup-on-failure** (a partial streamed tree must be removed before retry, or it strands disk and eats the slack).

These are execution preconditions for the [3] window, satisfiable by design. They are **not** open questions blocking the *selection* of B.

---

## Sec 2 -- C: parked, not killed (reopen trigger RESTATED)

C is not closed. Its full hazard analysis (H1 manufactured rollback, H2 credential precondition, H3 split-brain neutral, H4 encoding precondition) stays on record in the pricing note.

**The reopen trigger is restated** (per install-method note Sec 5). v0.1 set C to reopen "if B's disk-peak constraint fails to clear." Under design-first, **there is no peak measurement to fail** -- the transient was designed out, not measured. The trigger is now:

- **B remains preferred so long as the method's prerequisites are satisfiable.**
- **C reopens only if prerequisite feasibility fails** -- specifically, if runtime parity (P1) cannot be achieved (build host cannot be matched to prod's four-tuple), **or** if the safe stream-extract / cleanup controls (C1, C2) cannot be guaranteed.

**Guard for future sessions (load-bearing):** C is **not** reopened by a transient-peak number, because no such measurement is taken under the chosen method. A future session reading the older framing must **not go looking for a disk-peak figure that was deliberately designed out.** If a future reader finds themselves hunting a transient-install peak, they are working from the superseded v0.1 framing -- stop and read the install-method note.

A withdrawn remains withdrawn.

---

## Sec 3 -- What this does NOT change

- Prod box stays **FROZEN.** This is a decision record; it authorizes no box action and primes nothing.
- **FD-31** schema-fork and degraded-state legs remain **OPEN.**
- **[3]** is **not primed.** The box-mutating session executing B (off-box build's box-side stream-extract + cutover) still requires its own deliberate, backup-first window with a fresh Phase 1 abort re-verify at its start.
- The split-brain hazard (AG / H3) is untouched -- B's cutover must still prove it landed on canon **by IP/VPC + row counts, never by name string** (the naming inversion remains a standing hazard).
- B's [3]-window operation is **not spec'd here.** Selecting B is choosing direction; the install-method note defines the install *method*, not the full [3] operation.
- C's hazard analysis stays on record; C remains recoverable under the restated trigger (Sec 2).
- No fingerprint numbers are inlined here. The headroom note holds the disk/memory figures; the install-method note holds the method.

---

## Sec 4 -- Recommended register / handoff updates (DRAFTS -- for Rule 7 execution separately)

- **Reconciliation Plan Sec 3 / fork:** record B as the selected direction (lean), citing the headroom note (numbers) and install-method note (execution method) as authorities; A withdrawn; C parked-not-killed with the **restated** reopen trigger (prerequisite feasibility, not disk-peak).
- **Reconciliation Plan Sec 4:** mark B's former open execution constraint as **RESOLVED BY METHOD** (off-box build + stream-extract), pointing to the install-method note; mark the box-capacity read-only check DONE (headroom note).
- **[3] register / runbook:** record P1 parity read as a [3]-window-open read-only check inside the abort envelope; record C1/C2 as box-side controls; record the P1 build-host pre-pin sequencing per PR #767.
- **Runbook-stitch BLOCK-A bindings:** re-aim from the (non-canonical) `Selection_Lean` name to this file's name once committed.
- **No fingerprint numbers re-inlined.** Authorities: headroom note (numbers), install-method note (method).
- **Standing hazards restated** so the lean is not misread as authorization: FROZEN / FD-31 OPEN / [3] not primed / prove-by-IP-VPC.

---
*B-vs-C reconciliation fork resolves toward Strategy B as a consolidated selection lean, not a firm close. Consolidates and supersedes the v0.1 selection-lean note: the direction (B) is unchanged, but the lean is now "not firm" because [3] has not executed, NOT because any selection input remains open. All three selection inputs are closed in canon -- pricing (both halves, A withdrawn), headroom (sufficient, disk-bound), and install-method (B's disk-peak execution constraint designed out via off-box build + stream-extract, peak collapsed to steady state). B chosen on measured evidence plus two structural advantages C cannot match (absorbs Track B topology; free standing rollback) against C's irreducible disadvantage (destructive on the live serving tree). C is parked, not killed, recoverable only if B's method prerequisites fail (parity P1 unachievable, or controls C1/C2 unguaranteeable) -- NOT on a disk-peak measurement that no longer happens. Selects direction only: primes nothing, specs no [3] operation, authorizes no box action. Box stays FROZEN; FD-31 OPEN; [3] not primed; prove-by-IP/VPC stands.*
