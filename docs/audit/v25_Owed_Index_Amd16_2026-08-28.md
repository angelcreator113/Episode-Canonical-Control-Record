| **PRIME STUDIOS** **V25 OWED INDEX — AMENDMENT 16** *Sec 6 item 12 closes. This amendment points; it does not carry.* |
| --- |

# v25 Owed Index — Amendment 16

**FILED 2026-08-28 on Evoni's authorization.**

**AMENDMENT 16 to `v25_Owed_Index_2026-08-22.md`.** Adds §Q1–§Q3.

**Basis:** `origin/main` at `17978f96529509a5a459274816b92821f6ea5d67`, 2026-08-28.

**Author**

Claude, with JustAWomanInHerPrime (JAWIHP) / Evoni — Prime Studios.

**Status**

**This amendment points; it does not carry.** It rules nothing, re-costs
nothing, specifies nothing, and mints nothing. **The substance is at
`F-AUTH-1_PE65_Resolution_BranchB_2026-08-28.md`.** Ships no code.
Prod **FROZEN**.

**Tails re-derived at this basis, not carried. Instruments and outputs pasted,
per H1:**

```
grep -ro 'FD-70' docs/audit/ | wc -l     25
grep -r  'XK-4'  docs/audit/ | wc -l      5
grep -r  'PE #69' docs/audit/ | wc -l     5
Session_PE_Roster.md highest entry       PE #68

excluding the chain's own grep records (Amd13, Amd14, Amd15):
grep -r 'XK-4'   --exclude='v25_Owed_Index_Amd1[345]*'    0
grep -r 'PE #69' --exclude='v25_Owed_Index_Amd1[345]*'    0
```

**Measured at the basis `17978f96` before this filing, never predicted from a
prior amendment's status line.** **Every `XK-4` and `PE #69` hit is a chain
document's own pasted record of a grep that returned zero — none is a mint.**
**XK tail is XK-3; PE tail is PE #68; FD-70 remains next-available and
unminted.** **`Amd14` §N6 governs: filing this document moves these counts
again without moving any tail.**

---

# §Q1. `v25` Sec 6 item 12 — CLOSED

**Item 12, at `Prime_Studios_Audit_Handoff_v25.md:669`, as filed:**

> **12. PE #65.** Class: **one-time, Evoni-gated.**
> Has Evoni selected a topology branch? **A decision specification is not a
> decision.** No code should infer one.

**Answer: YES. Evoni selected Branch B on 2026-08-28.** The item asks whether a
branch has been selected. One has. **Item 12 is CLOSED.**

**This is the first of `v25` Sec 6's four Evoni-gated items to close.** Items
**8, 9 and 11 remain gated and NOT PERFORMED**, none inferred, and **no search
for credentials was made.**

**The item's own warning is honoured rather than tripped.** *"A decision
specification is not a decision"* — `F-AUTH-1_Decision_CognitoPoolTopology_2026-08-22.md`
laid out the branches and ended in a question. **What closes item 12 is Evoni's
selection, not the existence of that specification.**

---

# §Q2. Pointer — the ruling, the re-costing and the re-specification

**All substance is at:**

> **`F-AUTH-1_PE65_Resolution_BranchB_2026-08-28.md`**

Read that document for the branch ruling and its provenance, the Branch A
re-costing, the §9.10 re-specification, the pointer decision, and the surviving
bounds. **This amendment points; it does not carry.** Pattern per
`Session_PE_Roster.md` PE #64 **Amendment 3** (2026-08-25), which points at
`F-AUTH-1_PE64_Identity_Ownership_Resolution_2026-08-25.md` in the same form and
for the same reason.

**Named here only so the chain tail names them; every one is stated and bounded
in the ruling, not here:**

- **Branch B ruled**, and **re-affirmed after the premise it was first ruled on
  was withdrawn.** Both rulings are recorded there; a ruling taken on a
  withdrawn premise and one re-taken on the corrected picture are different
  objects.
- **Branch A re-costed** on Evoni's ruling, per
  `F-AUTH-1_PE64_Identity_Ownership_Resolution_2026-08-25.md` §7, which flagged
  the costing as overstated and declined to amend it.
- **§9.10 re-specified**, resolving PE #65's three defects. §9.10's trigger is
  **void as written**, not satisfied.
- **Pointer decision ruled (d), and the filename ruled by Evoni.** Standalone
  document plus this pointer-only amendment. **A second same-basis draft existed
  under another name and is superseded, not filed** — see the ruling's §5B.
  **This amendment's pointer string is verified byte-exact against the filed
  path with `git cat-file -e` before commit, not by eye.**
- **No banner is placed** on the decision document, the roster, or any Fix Plan
  revision. `358262c569ddc665ff3978b5ae713c272efe2e39` does not move.

**What did NOT close, stated here because a chain tail that names a closure
without naming its limits invites the closure to be read wider than it is:**

- **PE #65 does not close.** It closes when a branch is chosen **and costed
  against real config and sequencing**. A branch is chosen and the remedy is
  specified; the costing is not performed.
- **PE #64 does not close** and its severity is not re-ruled.
- **§9.10's P1 remains unrecorded in the current Fix Plan authority.** It occurs
  **zero times in `F-AUTH-1_Fix_Plan_v2.68.md`** and lives at
  `F-AUTH-1_Fix_Plan_v1.5.md:605`. **Re-recording is a Fix Plan revision — the
  only instrument that mints FD numbers — and is owed separately.**
- **Nothing is authorized for execution.** No pool created, renamed, repurposed
  or configured; no migration scheduled; **pool existence at this basis is NOT
  ESTABLISHED** and rests on a 2026-08-21 read the source file itself instructs
  a reader to re-resolve.

---

# §Q3. What this amendment does not do

- **Does not carry the ruling.** §Q2 points. A reader who acts on this amendment
  without opening the ruling has the closure and none of its bounds.
- **Does not amend `Prime_Studios_Audit_Handoff_v25.md`, `Session_PE_Roster.md`,
  `F-AUTH-1_Decision_CognitoPoolTopology_2026-08-22.md`, or any Fix Plan
  revision in place.** Per ruling (d) and the additive-supersede convention.
  **`d8beaca0…`, `b94848f8…` and `358262c5…` do not move.**
- **Does not mint.** No FD, XK, or PE number. FD-70 remains next-available and
  unminted.
- **Does not close PE #64 or PE #65**, and does not re-rule any severity.
- **Does not develop the non-split isolation class** the decision document names
  and declines to develop. It remains undeveloped and unforeclosed.
- **Does not revive PE #64's closed enumeration read**, and authorizes no
  identity read. Per-record triage remains a separate question with its own
  scoping and authorization, and the ruling states that the current set does not
  produce a need for it.
- **Does not contact a host, issue a token, dispatch a workflow, or perform any
  AWS read or write.** No Cognito identifier, account attribute, or credential
  value read, printed, or sought.
- **Items 8, 9 and 11 remain Evoni-gated and NOT PERFORMED.** None is inferred.

---

**Owed on filing, per the chain convention.** This amendment owes `Amd15` a
forward-pointer banner. Placing it **moves `Amd15`'s blob**, currently
`af8acdab9bdec4dd56be43a24a8bb38085a41573` -> **`ec164456853d29eb7de93947f2b3137bc9c48292`**, measured with `git hash-object` after placement, under an unchanged filename — `v25`
Sec 4.1 defeater 3 occurring again, disclosed banner-forwarding in Sec 5.5's
sense. **The forward value must be measured with `git hash-object` after the
banner is placed, and never predicted before it.**

---

*Type: pointer amendment. Records one closure and points at its authority.
Edits no file outside `docs/audit/`. No host, AWS, database, or Cognito contact.
No endpoint exercised. Prod FROZEN.*
