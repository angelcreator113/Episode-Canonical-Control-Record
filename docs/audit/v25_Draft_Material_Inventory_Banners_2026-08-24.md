# v25 Draft Material — Exposure Inventory Banners, and a Contingency Under XK-1's Admission Question

| | |
|---|---|
| **Purpose** | Reads `Paranoid_Exposure_Inventory_2026-08-07.md` banners newest-first; records a contingency that an already-filed finding on this branch does not carry; narrows a class filed earlier today. |
| **Created** | 2026-08-24 |
| **Basis** | `origin/main` at `7c508189c369a5a384d55cc2bea371d9ebec56f3`. |
| **Absorption condition** | **Draft material, not a chain link.** v25 absorbs this; on v25 landing it is VOID and should be deleted or marked superseded in the same commit that lands v25. |
| **Qualifies** | `v25_Draft_Material_Item4_Banners_2026-08-24.md` §5, which records XK-1's admission as an open status question **without recording what that question is contingent on.** See §3. That document is **not edited** — the constraint every recent file on this branch exists under. |
| **Notation** | This document contains no numeric hash references. The wrap check therefore returns zero of zero and is **inert, not passing** — it would report identically whether the wrapping convention were applied or absent. |
| **Authority note** | Mints nothing. No FD, no XK, no PE. **Does not rule on XK-1's admission, and does not rule on whether measurement corrections require ratification.** No live database contact. No scratch-database measurement was run. |

---

## §1 What was read

`Paranoid_Exposure_Inventory_2026-08-07.md` at basis — 12068 bytes, 187 lines —
carrying two correction banners, at 2026-08-19 and 2026-08-18, both prepended
above the body. **Banners read first, bodies after**, per v24 Sec 6 item 4.

Selected for three reasons at once: it is the source of XK-1's first admitted
entry; it is one of item 2's three aged rows; and XK-1's own banner makes a claim
about it that had never been verified against it.

---

## §2 FINDING — the cross-reference is accurate to the row and stale to the sentence below it

XK-1's Correction Banner 2 states the inventory *"carries a matching second
banner deriving 37 → 13."*

The inventory's Banner 2 table:

| | as published | 2026-08-18 banner | this banner |
|---|---:|---:|---:|
| exposed | 48 | 37 | **13** |

**The citation is accurate to that row.** One sentence below it, the same banner
adds: *"13 at the basis preceding `956697c0`; **12 as of `main` at `803b0265`**."*

**A reader following XK-1's pointer arrives at 13. The source document's own
latest figure is 12.**

Both bases are on `main` and both are dated 2026-08-18. `803b0265` — the basis
carrying the 12 — is **65 commits behind the current head.** Neither figure has
been re-derived since.

This is the additive-supersede reading hazard operating **inside a single
document**: the qualifier sits below the value a citing party quotes, and quoting
the value without the qualifier is the whole failure. The citing banner is not
wrong. It is one sentence short.

---

## §3 FINDING — XK-1's admission question is contingent on an unratified premise

**This is the finding this document exists to land.**

`v25_Draft_Material_Item4_Banners_2026-08-24.md` §5 records XK-1's admission as
an open status question, correctly and in neither direction. **It does not record
what that question depends on.**

The dependency chain:

1. XK-1's admission is in question **because reach reduced to `F-Stats-1` alone**,
   below §2.1 limb 1's two-keystone threshold.
2. Reach reduced **because both F-Ward-3 tables fall among the 24 that cannot
   exhibit the stated mechanism** — a result of the 48 → 37 → 13 correction chain.
3. That chain is corrected **on a reading of its own authority**, stated by
   Inventory Banner 1:

> *"corrected here on the reading that **correcting a measurement needs no
> ratification** — the same reading applied to XK-1's entry. **If a ratifying
> revision disagrees, this is an unratified correction that announced itself as
> one.**"*

**So: if a ratifying revision disagrees with the premise that measurement
corrections need no ratification, the correction chain unwinds, reach does not
reduce, and XK-1's admission was never in question.**

R57 as filed is unconditional. **It is not unconditional.** It is downstream of a
premise its own source flags as a reading rather than a settled rule.

**Recorded, not resolved.** Whether measurement corrections require ratification
is a register question belonging to a ratifying revision — the same place the
admission question was referred. This document has no standing on either and
takes none.

**Credit where the practice is better than the register average:** a document that
announces its own correction as possibly unratified is doing something almost
nothing else here does. The defect is not in the inventory. It is that the
contingency did not travel to the finding that inherited it.

---

## §4 FINDING — deliberate absence of routing, and a narrowing to the class filed earlier today

Both documents state, independently, that they do not cite each other:

> Inventory Banner 2: *"`Cross_Keystone_Register.md` XK-1 carries a matching
> second banner; **neither cites the other as authority**."*
>
> Inventory Banner 1: *"the two are **independent derivations of the same
> measurement**, not one citing the other."*

**The absence is intentional and reasoned.** A citation chain would let one
derivation's error propagate into the other; two independent derivations
agreeing carries evidential weight that one citing the other does not.

### §4.1 The class filed earlier today needs narrowing or it collects a false positive

`v25_Draft_Material_Perennials_2026-08-24.md` §4 files a class: **a fact closes
correctly and the artifact that would route a reader to it never learns.** Every
instance in that filing is a defect.

**This is not an instance, and a class stated as "missing routing is a defect"
would wrongly collect it.**

The narrowing: the class requires **a checklist or successor artifact that expects
to find the fact.** That is what makes the missing route a failure — something
was looking and could not arrive. **Independent derivations of the same
measurement have no such expectant party.** The pointer's absence is not a
failure to route; it is the condition that makes their agreement evidential.

**Carry the narrowing whenever that class is next stated**, or it acquires a false
positive it cannot shed.

---

## §5 Item 2's aged row — advanced, and the fraction does not move

v24 Sec 1's row for this document reads: *"Banner-governed; read newest-first and
**re-derive before using any count**."*

| | |
|---|---|
| **Advanced** | The row's characterization is confirmed accurate. Banners read newest-first. Current face established: exposed 13 at the basis preceding `956697c0` and 12 as of `803b0265`; reach reduced to `F-Stats-1` alone; §4's prod carve-out standing; both `§12.11` variants intact and neither retired; corrections self-flagged as possibly unratified. |
| **Not done** | **The count was not re-derived.** v24's instruction requires re-running the scratch-database measurement. That was not performed and cannot be performed from here. |

**Item 2's discharge remains PARTIALLY RUN at six rows of nine.** The fraction is
unchanged.

Reading a banner is not re-deriving a count. Advancing the fraction on this read
would be precisely the failure Audit Handoff v23's banner names — *"a successor
must not read this banner's existence as the item having been satisfied"* —
committed against the standard one block after filing it.

---

## §6 Open, carried

| Item | Status |
|---|---|
| Whether measurement corrections require ratification | Register question; belongs to a ratifying revision. Both the inventory and XK-1 refer it. §3. |
| XK-1's admission under §2.1 limb 2 | Open, and now recorded as contingent. §3. |
| Exposure count at current `main` | Last derived 2026-08-18 at `803b0265`, 65 commits back. Not re-derived. §2. |
| Item 2's remaining aged rows | `Session_PE_Roster.md` and the Cognito topology decision. Untouched. §5. |
| The eight uninspected August amendments | Unread. |

---

## §7 What this document does not do

- Does not mint. No FD, no XK, no PE.
- **Does not rule on XK-1's admission**, in either direction.
- **Does not rule on whether measurement corrections require ratification.**
- Does not re-derive any exposure count, and ran no scratch-database measurement.
- Does not advance item 2's discharge fraction. §5.
- Does not edit `v25_Draft_Material_Item4_Banners_2026-08-24.md` or any filed document.
- Does not resolve the 13-versus-12 divergence; it records it.
- Does not confer authority on itself. Draft material, void on v25 landing.
- No live database contact. Prod untouched.

---

## Version block

| Version | Date | Contents |
|---|---|---|
| 1.0 | 2026-08-24 | §1 what was read and why three payoffs justified one read. §2 XK-1's cross-reference is accurate to the table row and stale to the qualifier one sentence below it — 13 cited, 12 current, both 2026-08-18, latest basis 65 commits behind head. §3 XK-1's admission question is contingent on the premise that correcting a measurement needs no ratification, which its own source flags as a reading; the finding filed earlier today records the question as unconditional and it is not. §4 both documents deliberately decline to cite each other so that independent agreement carries weight a citation chain would destroy. §4.1 narrowing to the routing class filed earlier today: it requires an expectant party, and independent derivations have none, so the class must not be stated as "missing routing is a defect." §5 item 2's aged row advanced from unread to face-read with counts not re-derived; discharge remains PARTIALLY RUN at six of nine and the fraction does not move. §6 five carried items. §7 non-actions. |

---

*Author: Claude, with JustAWomanInHerPrime (JAWIHP) / Evoni.*
*Date: 2026-08-24. `origin/main` at `7c508189`.*
*v25 draft material. Void on v25 landing. Mints nothing. Evaluates no fix. No live database contact.*
