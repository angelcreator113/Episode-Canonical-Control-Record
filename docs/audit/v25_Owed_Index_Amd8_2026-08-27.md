| **PRIME STUDIOS** **V25 OWED INDEX — AMENDMENT 8** *A measurement failure with four expressions, its inheritor, and two attribution defects in the same table.* |
| --- |

> **POINTER BANNER — AMENDMENT 9, 2026-08-27. This banner points and carries
> nothing.**
>
> **Nothing in this document is amended, withdrawn, or superseded by this
> banner.** The at-filing record stands unedited below.
>
> **§H6's item — *"Does not read the four inventory commits… Named as runnable,
> not run"* — is DISCHARGED at `v25_Owed_Index_Amd9_2026-08-27.md` §I1–§I3.**
> **That statement is not corrected.** It is an accurate account of what this
> document did, and it remains accurate; Amendment 9 discharges the item it
> names without amending the naming.
>
> All of it lives at `v25_Owed_Index_Amd9_2026-08-27.md`. This banner points and
> carries nothing.


# v25 Owed Index — Amendment 8

**Document version**

**AMENDMENT 8 to `v25_Owed_Index_2026-08-22.md`.** Four items. Adds §H0–§H6.

**Minted rather than carried in place**, per `F-Deploy-1_Fix_Plan_v1.49.md`.
Amendment 7 receives a pointer banner that carries nothing. **That banner is
placed by this commit, not promised by it** — see §H6.

**Rules nothing about any finding. Mints nothing.** Ships no code. Changes no
gate, severity, owner, or disposition. Limb 1 **OPEN**; limb 3 open; G4 not
enterable; ASSESSMENT NOT COMPLETED. Prod **FROZEN**. **Gate states carried as
face reads; not re-derived here.**

**Basis:** `origin/main` at `9d4ea804`, 2026-08-27. `v25.md` at
`d8beaca0ad6b655ea560cf75d1cb02df3f52adc6`;
`v25_Owed_Index_Amd7_2026-08-26.md` at
`a3e02cb272f19c16c3afe17c9ce4f777b52e092b`.

**Author**

Claude, with JustAWomanInHerPrime (JAWIHP) / Evoni — Prime Studios.

**Status**

Derivation. Two documents corrected, one measurement failure and its inheritor,
two attribution defects, one instance recorded without a class.

---

# §H0. Why this amendment exists

**Derived while re-running Sec 6 item 2 at a new basis**, after the Amd7
correction marker landed at `9d4ea804`. The item-2 re-derivation is not the
subject; it is the occasion. Reading Amd7 in full for its carriage form is what
surfaced §H1.

**Two independent clones ran every check below.** Where they agree it is stated
plainly. Where only one ran a check, §H4 says so by name. **No claim here rests
on a transcript.**

**Sequenced after the marker deliberately.** Authoring at `782d3b48` would have
cited `v25.md` at `226be252…` and been stale on merge. This document cites
`d8beaca0…` at a basis where the marker is on `main`.

---

# §H1. Amd7 §G5.1 and §G6 — one measurement failure, four expressions

**`v25_Owed_Index_Amd7_2026-08-26.md` §G5.1 rests a paragraph on an ancestry
result that is wrong.** §G6 repeats it as a non-action.

`76a7f1ac8e975f5740fbea879ec7e8f4833782af` is a **two-parent merge commit** —
merge of PR #1054, 2026-08-18, parents `79f9bab1` and `afe13438`. **It was never
squashed**, and the squash-ancestry mechanism cannot have applied to it.

| assertion in §G5.1 | verdict at `9d4ea804` |
|---|---|
| *"That commit is not an ancestor of `origin/main`"* (repeated at §G6) | **FALSE.** Ancestor: yes, by `merge-base --is-ancestor`, by presence in `rev-list origin/main`, and by `branch -r --contains`. Also an ancestor of `fec15be6`. |
| *"The banner stacking therefore occurred off `main`"* | **FALSE.** `f3b1f3d9`, `2a744a92`, `470ad7a1` — each single-parent, each an ancestor of `origin/main`. The stacking is in `main`'s linear history. |
| *"`main` received the composed result in a single commit (`fec15be6`)"* | **FALSE.** `git show --name-only fec15be6 -- <path>` is empty. `fec15be6` does not touch that path. |
| *"the path shows one commit in `main`'s history"* | **FALSE.** Four: `470ad7a1`, `2a744a92`, `f3b1f3d9`, `95525f30`. |
| *"153 lines carrying one banner \[at `76a7f1ac`\], against 187 lines and two banners"* | **TRUE.** 153/1 and 187/2, exact. |

**These are four expressions of one measurement, not four independent errors.**
Each of the false clauses is downstream of the ancestry result; the surviving
true clause is a line count, taken by a different instrument.

## §H1.1 Direction — this defect caused understatement

**§G5.1's hedge is that unread context *"could establish that v1.49's citation
points at something this reading cannot see — in which case §G5's conclusion
does not hold."***

**The hedge is relocated, not discharged.** The context is still unread. What is
false is its stated location and character: not off-`main` and reachable only by
branch archaeology, but four commits in `main`'s linear history. **§G5's
conclusion is exactly as defeasible as Amd7 said it was.** What changed is the
cost of defeating or confirming it — four `git show`s rather than branch
archaeology.

**That converts a standing hedge into a runnable item.** Recorded as such. It is
not a claim that §G5's ground is firmer.

## §H1.2 The mechanism was on file first

**`v25_Owed_Index_2026-08-22.md`'s own correction banner**, 2026-08-22, records
that a position check *"passes on a shallow clone, and `git merge-base
--is-ancestor` then returns a clean `false` for any commit beyond the shallow
boundary — no error, no signal, just absence."*

Amd7 is **in that chain**, filed 2026-08-26, and its subject is instrument
unsoundness. **The chain's own instrument-unsoundness document exhibited the
defect the chain had named four days earlier.**

**This instances `F-AUTH-1_Fix_Plan_v2.56.md` §2.1's conclusion and nothing
more** — *"Documenting a hazard class does not retire it."* **No ordinal, no
ranking, no membership in §2.1's enumerated list.** That list's three instances
are each *one premise standing for the whole*, and `v2.59`'s banner adds a
fourth of the same shape. **A bad measurement is not that shape and is not a
fifth.**

## §H1.3 Cause

**Not established.** The shallow-clone signature above is the mechanism on file
and it matches, but **how Amd7's read was performed is not recoverable from the
tree and is not asserted in either direction.**

---

# §H2. `Prime_Studios_Audit_Handoff_v25.md` Sec 4.4 row 1 — the inheritance

**Sec 4.4 records two citation instances. Row 1 is `76a7f1ac` and is
incorrect**, per §H1, which is the source and is not re-derived here.

**Row 2 holds.** `a4460f2589804c6b65be46d8be63ad0bbf1511dc` is single-parent, is
not an ancestor of `origin/main`, and is absent from `rev-list origin/main`. It
is a genuine instance of the owned shape — a branch-side commit whose content
reached `main` by squash.

**The citation-instance count is one, not two.** Sec 4.4's own closing sentence
sets the threshold at two.

**The consequence is not ruled here.** Whether the class survives at one
instance against its own stated threshold belongs to whoever owns the class.
**Recorded for a ratifying revision.**

**`Finding_Squash_Merge_Ancestry_Filter_2026-08-25.md`** (blob
`aeb1f0c9e1cdd17d22951d0f8ea882ec2f6a10b1`) **is unaffected.** Neither SHA
appears in it; its instances are its own §2.1/§2.2, observed during its own
verification. **The finding stands unamended. What shrinks is v25's Sec 4.4
sub-claim.**

**Row 1 was false at v25's own basis, not aged into falsity.** `76a7f1ac` was
committed 2026-08-18 18:14 -0400; v25's basis `6aea0f73` is 2026-08-26 16:14
-0400. `76a7f1ac` is an ancestor of `6aea0f73` and of v24's `fec15be6`.
**Sec 4.1 defeater 2 — a correct derivation ages silently — does not excuse
it.**

---

# §H3. `Prime_Studios_Audit_Handoff_v25.md` Sec 3 — the five-dimension sentence

**Sec 3 states:** *"`v2.61` is the last revision carrying a five-dimension face
line, and it omits Dimension 1."*

**Both clauses fail, independently.**

Status-face carriage across the chain, by line:

| revision | dimensions on the **Status face** | line |
|---|---|---|
| `v2.59` | **none** | 159–163 |
| `v2.60` | **three** — D2 PASS; D3, D5 NOT PERFORMED | 32–36 |
| `v2.61` | **four** — D2, D3, D4, D5 | 32–36 |
| `v2.62`–`v2.68` | D3 only | — |

- *"the last revision carrying a five-dimension face line"* — **no Status face
  in the chain carries five.** `v2.61`'s four is the **maximum**, and it is
  unique. Not *last*: **most**.
- *"and it omits Dimension 1"* — true and trivial. **No Status face carries
  Dimension 1 at all**, so `v2.61` omits nothing that any other face includes.

**Consequence for Sec 6 item 5.** Its walk-back instruction — *"walk back to the
last revision carrying a five-dimension face line"* — **names a target that does
not exist.** Walking back from `v2.68` reaches `v2.61` at four; continuing back
yields **fewer**, three at `v2.60` and none at `v2.59`. **Past `v2.61` the walk
moves away from the answer.**

**Reach.** Face carriage was read at the Status blocks specifically. The marker
`**Status**` sits on its own line with the dimension text 2–4 lines below inside
an italic block; **a pattern keying the dimension line on the word `Status`
returns empty for all three revisions and is not evidence of absence.** That
pattern failure occurred in the drafting clone this sitting and is recorded
rather than omitted.

---

# §H4. `Prime_Studios_Audit_Handoff_v25.md` Sec 3 — supplier and restater in one column

**Sec 3's source column names where a disposition last appears, not what
supplied it.** For D3 and D5 those coincide. For D1, D2 and D4 they do not.

**The Dimension 4 row is self-evidencing.** Its cell reads *"the last performed
score recorded by `v2.59`; not re-performed"* while its source column reads
`v2.61`. **Supplier and restater, in the same row, visible without leaving the
table.**

**Sec 6 item 5 asks which revision *supplied* each disposition. One column
cannot hold both.**

| dim | disposition | supplied at | last restated |
|---|---|---|---|
| 1 | PASS | `v2.59` §2, line 198 — *"Dimension 1 — candidate integrity: PERFORMED — PASS"*; preserved by name in `v2.59`'s own banner, line 127 | `v2.60` §7 |
| 2 | PASS | `v2.60` §6, heading at line 303 | `v2.61` face |
| 3 | NOT PERFORMED | `v2.61` | `v2.68` |
| 4 | FAIL | `v2.59` | `v2.61` face |
| 5 | NOT PERFORMED | `v2.61` | `v2.61` |

**All five dispositions in v25 Sec 3 are correct. Only the attribution
collapses.** This is a defect in the column, not in the values.

**`v2.59`'s banner withdraws Dimension 2 and preserves Dimension 4 by name** —
line 127: *"Unaffected: Dimension 1 PASS; Dimension 4 FAIL; Dimensions 3 and 5
NOT PERFORMED…"* **D4's carried-historical FAIL survives its own source's
correction banner.** Deriving D4 from an unbannered `v2.59` body would return
the right answer for the wrong reason and the wrong D2 outright.

## §H4.1 Reach of this table

**D1's supplier was verified in both clones** at `v2.59:198`, and `v2.59:127`
likewise. **D2's supplier at `v2.60` §6 was derived by the executing party; the
drafting clone confirmed only that `§6. Dimension 2 score` exists at
`v2.60:303`, not the seven-row requirement table beneath it.** **Stated because
§G2.1 and §G5.1 both state their reach and the defect this document records is
what happens when a derivation does not.**

---

# §H5. One instance, recorded without a class

**A citation was accurate, its attribution was accurate, and the classification
built on top of them failed.** The claim placed §H2's defect into
`F-AUTH-1_Fix_Plan_v2.56.md` §2.1's enumerated sequence and ranked it by
interval. §2.1's instances are each *one premise standing for the whole*; a bad
measurement is not that shape, and the list carries no interval metric. **The
ranking appears to have been imported from `FD-66`'s Banner 2, which does
compare intervals but about stale citations — a third class again.**

**No mechanical check reaches this.** Nothing in it is stale, missing, or
misquoted. Blob identity, command output, and banner-order discipline all pass
on it. **It was caught by opening the cited document and reading what its list
was a list of.**

**Recorded as one instance. Not named as a class.** One instance is one
instance, and naming a class off it would be this document performing the error
it records. **If a second is found, whether it constitutes a class is a
judgment and is not made here.**

**Adjacency, as a pointer only.** `Prime_Studios_Audit_Handoff_v25.md` Sec 4.3
concerns an instrument that answers a question adjacent to the one asked.
**Here every instrument measured correctly.** The adjacency is noted; **no
relation is asserted.**

---

# §H6. What this amendment does not do

- **Does not rule on Sec 4.4's class.** §H2 records the count at one. The
  consequence belongs to whoever owns the class.
- **Does not rule on `F-Deploy-1_Fix_Plan_v1.49.md`'s prior-art citation.** §H1.1
  relocates Amd7 §G5.1's hedge and discharges nothing. **`v1.49` is Evoni-ruled
  and is not corrected here.**
- **Does not amend `Finding_Squash_Merge_Ancestry_Filter_2026-08-25.md`**, which
  rests on neither SHA and stands.
- **Does not rewrite Sec 6 item 5.** §H3 records why the instruction names a
  target that does not exist. **The rewrite belongs to v26**, per the precedent
  at v25 Sec 0, which rewrote v24's items 2 and 5 in the successor rather than
  bannering the predecessor. **Recording and rewriting are different acts.**
- **Does not name a class at §H5.** One instance.
- **Does not establish Amd7's cause.** §H1.3.
- **Does not read the four inventory commits** whose contents §H1.1 makes cheap
  to read. **Named as runnable, not run.**
- **Does not reopen F-Deploy-1**, which remains **CLOSED**. Does not perform or
  size limb 1, advance Dimension 3, discharge limb 3, enter G4, or alter the
  freeze.
- **Mints nothing.**

**On the pointer banner.** Amendment 7 states that *"Amendment 6 receives a
pointer banner that carries nothing."* **At `9d4ea804`,
`v25_Owed_Index_Amd6_2026-08-23.md` carries no such banner** and has one commit
in its history, its own creation at `7c508189`. Amendment 5 did receive
Amendment 6's banner. **This document therefore places Amendment 7's banner in
the same commit that mints this document, rather than stating it as an act
performed elsewhere.** **Whether Amd6's absent banner warrants its own entry is
not decided here** — it is raised, and is **recorded for `v26`'s Sec 6 as a
one-time item**, because a runnable obligation parked only in a non-actions
section is dropped in practice. **That is an address, not a category.**

**This amendment moves Amendment 7's blob.**
`a3e02cb272f19c16c3afe17c9ce4f777b52e092b` →
`a94b0c1e7167b2650556ac87b999647c637ec557`, under an unchanged filename, by the
pointer banner placed in this commit. **That is
`Prime_Studios_Audit_Handoff_v25.md` Sec 4.1 defeater 3 occurring here**, and it
is disclosed banner-forwarding in Sec 5.5's sense. **The basis line above cites
Amendment 7 at `a3e02cb2…` because that is its state at `9d4ea804`, the basis
read.** A Sec 6 item 2 derivation at any later basis will find it moved and
should read this as the account. **The disclosure is here rather than in
Amendment 7's banner, which points and carries nothing.**

**On this amendment's filename.** `v25_Owed_Index_Amd8_*` inherits §C3's defect,
deliberately, per §E10, and per Amendment 7's statement of the same choice.

---

*Type: amendment, derivation only. No host, AWS, database, or Cognito contact.
No endpoint exercised. Prod FROZEN.*
