| **PRIME STUDIOS** **F-AUTH-1 FIX-PLANNING DOCUMENT** *Rules limb 1's four definitional questions. Withdraws the ~700 work estimate.* |
| --- |

**Document version**

v2.68 — **RULES ALL FIVE QUESTIONS RAISED AT `F-AUTH-1_Limb1_Scope_2026-08-22_DRAFT.md` §11.**
Limb 1 now has a unit, a population, a judgment definition, and a decomposition.
**The `~700` work estimate is WITHDRAWN**; its sweep-metric ancestor stands.

**Limb 1 remains OPEN.** This revision defines it; it does not perform it, and
it deliberately does not size it — see §6.

**Closes no finding. Reopens no finding. Ships no code.** FD tail remains
**FD-69** (spent on a duplicate, retired at PR #1102); XK tail **XK-3**; PE tail
**PE #67**. Dimension 3 remains **NOT PERFORMED**; limb 3 open; G4 not
enterable; **ASSESSMENT NOT COMPLETED**. Prod **FROZEN**.

**Basis:** `origin/main` at `29cee698`, 2026-08-22.

**Depends on `a4460f25` (F-Deploy-1 v1.49), which is on a separate branch and
not on `main` at this basis.** §7 applies the carriage rule minted there. **That
PR should merge first**; if this one lands ahead of it, §7 cites a rule the
register does not yet hold.

**Author**

JAWIHP / Evoni — Prime Studios

**Status**

Ruling. Five dispositions, all definitional. No measurement is taken.

---

# §1. What was open

The scope document established that limb 1 could not be sized until four things
were ruled, and that a fifth followed from the first. It ruled none of them by
design. **Its substantive result was that limb 1 has been the item that could
not move even with every gate open, and that the obstruction was definitional
rather than one of authorization or access.**

All five are ruled here.

---

# §2. Ruling 1 — the unit is one recorded CP disposition

**Not one handler.**

The relabel at v2.42→v2.43 asserted that one handler equals one disposition
judgment. **That assertion is rejected.** No revision stated it and no revision
derived it.

**Limb 1 audits the sweep's rulings — each place a CP recorded a disposition.**

The scope document's §4 already showed why a per-handler denominator cannot be
right: several judgments in §5.71's own list are not per-handler at all.

| judgment class | its actual unit |
|---|---|
| A batch of Tier 4 catalog GETs sharing one rationale comment | **one judgment**, across many handlers |
| The 13 §5.21 mixed-tier calls | **per file** |
| The D20 `authenticateJWT` exclusions | **per mount** |

**The denominator is non-uniform by construction.** That is why no single count
was ever derivable from the record, and why every attempt to state one had to
pick a unit the record does not use.

**This takes neither side of the expensive-versus-cheap fork at its extremes.**
Auditing recorded dispositions is bounded by what the CPs actually wrote down.
A per-handler re-derivation is unbounded, and is what Ruling 3 declines.

---

# §3. Ruling 2 — the population is the historical CP1–CP12 swept set

**Not the present surface.**

§5.71 admits both readings and chooses neither. **The present-surface reading is
rejected because it is only finishable against a frozen surface, and nothing is
frozen.** `main` has moved substantially past the CP12 merge-base, by
development limb 1's clause does not mention.

The two readings are different programs with different completion conditions:

| reading | population | can it finish? |
|---|---|---|
| **Historical (RULED)** | fixed; recoverable from the CP commit range; does not grow | **yes** |
| Present surface | grows with development | only against a freeze |

**Deriving the historical population is bounded, mechanical, and remains
unperformed.** It requires git history rather than the working tree — enumerate
the declarations touched across the CP1–CP12 commit range. **This revision does
not perform it.**

---

# §4. Ruling 3 — one judgment is a confirmation, not a re-derivation

**Read what the CP ruled. Read the code it ruled about, at that CP's own basis.
Record `agree` / `disagree` / `cannot-tell`.**

The scope document's §7 set out two readings differing widely in cost per unit,
and noted that **v2.61 §4.3's procedure language implies the second** — inspect
the effective middleware of every write declaration and tie each to its Tier
disposition.

**The second reading is rejected, and the reason is what limb 1 is for.** §5.71
specifies an *adjudicator-driven audit pass over CP1–CP12 cumulative work.*
**Re-deriving every disposition from scratch is redoing the sweep, not auditing
it.** An audit asks whether the recorded rulings were correct. It does not
re-run the program that produced them.

**`cannot-tell` is a first-class outcome, not a failure to complete a judgment.**
It is the disposition owed wherever the CP's basis or rationale is not
recoverable, and it must be recorded as such rather than resolved by
re-derivation.

## §4.1 The quality signal on limb 1's output is inverted

**At an unrecoverable CP basis the pressure is to re-derive in order to resolve
it, and that drift produces *cleaner* output** — fewer unknowns, more definite
results. A pass that has quietly become a re-derivation does not look degraded.
**It looks better than the pass that stayed within its ruling.**

So the ordinary reading of the output must be inverted:

> **A limb 1 pass reporting no `cannot-tell` results is MORE suspect than one
> reporting several.**

**This is #1106 §5 applied one level down.** There, the rule is that where
attribution is unavailable the register must report that it cannot tell and must
not report that nothing happened — because *"we checked and cannot tell"* and
*"no evidence"* are indistinguishable in the output and only one of them is
true. **Here the same substitution is available to limb 1's own auditor**, and
the substituted result is the more presentable one.

**It is the only defense against a drift that looks like rigor.** No count, no
review of the output, and no comparison against a forecast will separate a
disciplined pass from a re-derived one — both terminate, and the re-derived one
terminates with better-looking numbers. **The `cannot-tell` rate is the
discriminator, and a suspiciously low one is the signal.**

**Consequence for v2.61 §4.3.** Its per-handler language describes the
expensive reading and is not limb 1's deliverable. It is not amended here; it is
scoped — §4.3 governs the *corrected FD-63 procedure*, which is a separate
obligation, and does not govern limb 1's unit.

---

# §5. Ruling 4 — decomposable per CP, and partial results hold

§5.71 says *"cumulative work."* **That describes scope, not atomicity.**

**The CPs closed separately.** A completed CP1 audit is a real result whether or
not CP2 follows.

- Limb 1 decomposes **per CP**.
- **Partial results are durable** and are not invalidated by later CPs.
- **Limb 1 discharges when all twelve are done**, and not before.

Limb 1 can therefore be started without being finished, which is the practical
difference this ruling makes.

---

# §6. Ruling 5 — the `~700` work estimate is WITHDRAWN

**It does not survive.**

| form | where | disposition |
|---|---|---|
| *"~95–100 route files / **~700–750 handlers**"* — cumulative sweep scope | v2.37, v2.39, v2.57 | **STANDS.** True about what it measured: handlers touched by the sweep. |
| *"~700 **disposition judgments**"* — work estimate | v2.42 §2.3, v2.43, v2.56, v2.58, v2.59 | **WITHDRAWN.** Rests on the handler-equals-judgment substitution rejected at §2. |

**This is PE #63's shape.** A metric true about what it measured and false about
what it was used for, retired rather than re-measured.

**Withdrawal does not leave limb 1 unsized.** Limb 1 has been unsized since the
relabel at v2.43. **The figure only made it look sized.** What withdrawal
removes is the appearance, not a measurement.

## §6.1 The measurement this implies, and why it is not taken here

Sizing limb 1 now means **counting recorded dispositions across the CP1–CP12
set** — Ruling 1 applied to Ruling 2. It is bounded and it is available.

**It is deliberately not performed by this revision, and must not be performed
until this revision is on `main`.**

> **A survey run against definitions that are not yet landed is how a
> measurement becomes the definition.** If the count is taken first, the unit
> is retro-fitted to whatever the count found, and the ruling above becomes a
> description of a measurement rather than a constraint on one.

Recorded as a standing sequencing rule, not as a remark about this instance.

## §6.2 The roll-up in the scope document's §3 is not quoted here

The scope document derives a crude per-CP roll-up and states that it **must not
be quoted as a derivation, including in any summary of that document.** It is
the arithmetic residue of an unreconciled record, not a rival estimate.

**That instruction is honored: the figure does not appear in this revision.**
Recorded so that its absence reads as compliance rather than oversight.

---

# §7. How this withdrawal is carried

**The revisions carrying the withdrawn form are not edited.**

v2.42, v2.43, v2.56, v2.58 and v2.59 are merged numbered revisions. Under the
rule minted at `a4460f25` (F-Deploy-1 v1.49):

> A substantive amendment to a merged numbered revision **mints the next
> number.** A correction banner is the only permitted in-place addition, and
> **it may point but may not carry.**

**This revision is that next number, and it governs.** Where v2.42–v2.59 carry
*"~700 disposition judgments"* and this revision withdraws it, **v2.68 wins.**

**This is the rule's first application, and it is load-bearing rather than
ceremonial.** Editing five merged revisions to strike a figure would have been
five in-place amendments invisible to the numeric sort — the precise defect the
rule was minted to prevent, committed at five times the scale, in service of a
correction.

**The case is worth keeping attached to the rule, because violating it here
would have felt obviously right.** Striking a figure already ruled unsound
reads as *cleanup*, not as amendment — and cleanup is exactly the framing under
which an in-place edit gets made without anyone experiencing it as one. **A
rule that only bites when the edit feels wrong would not have caught this.**

**Merge order.** The rule this section applies is minted at `a4460f25` and is
not on `main` at this basis. **That revision should land first.**

---

# §8. What this revision does not do

- **Does not perform limb 1**, or adjudicate any Tier disposition.
- **Does not size limb 1**, and forbids sizing it before this revision lands
  (§6.1).
- **Does not derive the historical CP1–CP12 population** (§3). It remains
  bounded, mechanical, and unperformed.
- **Does not amend v2.37, v2.39 or v2.57.** Their sweep-metric form stands.
- **Does not edit v2.42, v2.43, v2.56, v2.58 or v2.59.** The withdrawal is
  carried here and governs from here (§7).
- **Does not amend v2.61 §4.3.** It is scoped, not corrected (§4).
- **Does not set a threshold for §4.1's `cannot-tell` rate.** The signal is
  stated as a direction, not a number; no rate is derivable before the first CP
  is audited.
- Does not advance Dimension 3, discharge limb 3, enter G4, or alter the freeze.
- **Mints nothing.** Closes and reopens nothing. Changes no gate, severity,
  owner or disposition.

---

*Type: ruling, definitional only. No host, AWS, database, or Cognito contact.
No endpoint exercised. Prod FROZEN. Not merged — v24 Sec 4.6.*
