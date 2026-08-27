| **PRIME STUDIOS** **V25 OWED INDEX — AMENDMENT 10** *Two filed count/instrument errors corrected, three owed items routed, and one citation carried out of a document scheduled to void.* |
| --- |

# v25 Owed Index — Amendment 10

**AMENDMENT 10 to `v25_Owed_Index_2026-08-22.md`.** Six items. Adds §J0–§J6.

**Basis:** `origin/main` at `4acc623128da2e31cb88f080ee5764f78704f91a`, 2026-08-27.
`v25_Owed_Index_Amd8_2026-08-27.md` at `3438cd5b218a42d04cbbcf6a1b65c3db3e685ca5`.
`v25_Owed_Index_Amd9_2026-08-27.md` measured at §J6, after this commit's banner
is placed, not before.

**Author**

Claude, with JustAWomanInHerPrime (JAWIHP) / Evoni — Prime Studios.

**Status**

**Rules nothing about any finding. Mints nothing.** Ships no code. Changes no
gate, severity, owner, or disposition. Limb 1 **OPEN**; limb 3 open; G4 not
enterable; **ASSESSMENT NOT COMPLETED**. FD tail **FD-69** (retired at #1102),
**FD-70 next-available and unminted**; XK tail **XK-3**; PE tail **PE #67**.
Prod **FROZEN**.

---

# §J0. Why this amendment exists

**Two of its six items are corrections to filed text on `main`, and neither had
an address.** The other four are owed rewrites that did.

That asymmetry is the whole reason this document was drafted rather than
deferred. A rewrite owed to `v26`'s Sec 6 and recorded at `Amd8:184`,
`Amd8:296`, and `v26_Draft_Material_Perennials_2026-08-27.md` survives the loss
of any particular session — a successor re-deriving Sec 6 meets the address. **A
wrong count with nothing pointing at it does not.** Before this document,
`seven-row` returned one hit across `docs/audit/` and `nine-row` returned zero.

**Deferral was argued twice on the correct ground and abandoned on a changed
one.** The standing objection — *the availability of a conclusion is not an
argument for reaching it* — disposes of momentum. It does not dispose of a
filed error that no reader has a reason to check.

---

# §J1. `v25_Owed_Index_Amd8_2026-08-27.md` §H4.1 — seven where the tree says nine

**§H4.1 states:** *"the drafting clone confirmed only that `§6. Dimension 2
score` exists at `v2.60:303`, not the seven-row requirement table beneath it."*

**The table has nine data rows.** `F-AUTH-1_Fix_Plan_v2.60.md`:

| line | content |
|---|---|
| 303 | `# §6. Dimension 2 score` |
| 307 | header — `\| Requirement \| Evidence \| Result \|` |
| 308 | separator — `\|---\|---\|---\|` |
| 309–317 | **nine data rows** |

Mechanism identified / Owning authority / Repository implementation / API
enabled / Frontend-backend coherence / Field exercise / Deployed-SHA proof path
/ Historical path reconciled / Additional authority sweep.

**§H4's substantive claim is unaffected.** The heading exists at `v2.60:303`,
the D2 supplier attribution stands, and the ruling beneath the table is
unchanged. **This corrects a count, not an attribution.**

## §J1.1 The count was asserted inside the paragraph disclosing it was not read

§H4.1 exists to state reach. **The `seven-row` figure is a property of the whole
table asserted by the party that had not read the whole table**, in the sentence
disclosing that the other party had not read it either. **The disclosure is what
makes the error recoverable; it is not what makes the claim safe.**

**Same family as Amd9 §I5's two.** Nothing prevented the match; the scope of the
claim exceeded the scope of the read. **Third instance. Recorded, not ruled** —
three is where the question of a class becomes askable and this amendment does
not answer it.

## §J1.2 Both parties reached the table through a chosen window

The correction surfaced because two windows disagreed, not because either was
right.

```
party A:  sed -n '309,315p'  → 7   (excluded rows 316, 317)
party B:  sed -n '307,316p' | grep -c '^| '  → 9
          (included header 307; separator 308 has no space, never matched;
           excluded row 317 — two offsetting boundary errors)
```

**Nine was returned by a coincidence of offsetting defects, not by a correct
bound.** Had both parties sliced identically they would have agreed, confidently,
and the figure would have entered as corroborated. **The detector is two people
happening to slice differently, and it has no denominator: the case where both
slice the same leaves nothing behind.** The sound instrument — count from the
header until the pipes stop — was reached for only after the disagreement forced
it.

---

# §J2. `v25_Owed_Index_Amd8_2026-08-27.md` §H3 — row 4 is measured by a different instrument than rows 1–3

**§H3's table is headed** *"Status-face carriage across the chain, by line."*
Rows 1–3 carry line citations. **Row 4 — `v2.62`–`v2.68`, "D3 only" — carries
`—`.** That is the surface signal, and it holds.

**Measured at each `**Status**` block's own bounds, plural-safe** (`Dimensions 3
and 5` does not match `Dimension [1-5]`):

| revision | `**Status**` marker | dimensions on the Status face |
|---|---|---|
| `v2.59` | line 157 | **NONE** — agrees with §H3 |
| `v2.60` | line 30 | **2, 3, 5** — three, agrees with §H3 |
| `v2.61` | line 30 | **2, 3, 4, 5** — four, agrees with §H3 |
| `v2.62` | **absent** | — |
| `v2.63` | **absent** | — |
| `v2.64` | **absent** | — |
| `v2.65` | line 125 | **NONE** |
| `v2.66` | **absent** | — |
| `v2.67` | line 25 | **NONE** |
| `v2.68` | line 49 | **NONE** |

**No revision from `v2.62` to `v2.68` carries any dimension on its Status face.
Four of the seven have no `**Status**` marker at all.** Row 4's "D3 only" is not
a Status-face measurement and the table does not say so.

## §J2.1 §H3's holding is strengthened, not undermined

*"No Status face in the chain carries five"* and *"`v2.61`'s four is the
**maximum**, and it is unique"* both hold **harder** against a tail carrying zero
than against a tail carrying one. **This corrects the table. The conclusion built
on it is untouched and is not re-derived here.**

## §J2.2 Where row 4's value actually comes from, and the reach of that claim

D3 appears for most of the tail in the **Document-version block**, a different
structure from the Status block.

| revision | Document-version block | dims |
|---|---|---|
| `v2.62` | 4–20 | **none** |
| `v2.63` | 4–28 | **none** |
| `v2.64` | 4–23 | 3 |
| `v2.65` | 95–113 | 3 |
| `v2.66` | 4–22 | 3 |
| `v2.67` | 4–18 | 3 |
| `v2.68` | 24–37 | 3 |

**Five of seven; two carry no dimension in either face block.** Bound rule:
`**Document version**` to the next `^**Author`, `^**Basis`, or `^---`.

**This column was measured wrongly twice before it was measured correctly.** One
party bounded at ten lines after the marker and read `NONE` for `v2.64`, `v2.67`
and `v2.68`; the other used a twelve-line window and read `NONE` for `v2.61`,
`v2.65` and `v2.66`. **Both errors are the §J1.2 mechanism, committed inside a
measurement whose subject is the §J1.2 mechanism.** Both were withdrawn as
evidence before this table was written. **The Status-face column above is
bounded by its own marker and is the column this section's finding rests on;
this one is context.**

## §J2.3 A live trap on the current authority

`F-AUTH-1_Fix_Plan_v2.68.md`'s `**Status**` block reads, in full:

> Ruling. **Five dispositions**, all definitional. No measurement is taken.

**Those are `v2.68`'s five definitional rulings on limb 1's scope. They are not
the five G3 dimensions.** v25 Sec 6 item 5 sends its reader to the current face
in search of five dimensions, and the current face offers the word *five* within
three lines of its `**Status**` marker.

**Recorded because the collision is silent.** A reader holding §H3 stops; a cold
successor holding only item 5 does not.

---

# §J3. `Prime_Studios_Audit_Handoff_v25.md` Sec 6 item 5 — the walk-back is withdrawn

**Owed. Named at `Amd8:184` as a consequence, not rewritten there.**

Item 5 instructs: *"walk back to the last revision carrying a five-dimension
face line."* Per §H3 **that target does not exist**, and per §J2 the tail
carries **zero** on the Status face rather than one.

**The instruction is not merely inert. It is misleading in a specific
direction:** a successor executing it faithfully walks back from `v2.68` past
`v2.61`'s four into `v2.60`'s three and `v2.59`'s none. **Past `v2.61` the walk
moves away from the answer**, and nothing in the instruction signals a stopping
point.

**Proposed replacement text for `v26`'s Sec 6 item 5:**

> **5. Re-derive G3.** Class: **perennial**.
>
> Limb 1 status, limb 3 outcome, G4 entry, and all five dimension dispositions.
>
> **Do not walk back through the revision chain.** No Status face carries five
> dimensions; `v2.61`'s four is the maximum and is unique, and every revision
> after it carries none. **Take the dispositions and their suppliers from
> `v25_Owed_Index_Amd8_2026-08-27.md` §H4's table**, which separates *supplied
> at* from *last restated*.
>
> **`F-AUTH-1_Fix_Plan_v2.59.md`'s correction banner is mandatory reading for
> Dimensions 1 and 4.** It withdraws D2 and preserves D1 and D4 **by name** at
> line 127. Deriving D4 from an unbannered `v2.59` body returns the right answer
> for the wrong reason and the wrong D2 outright.
>
> **Record for each disposition whether it is a current score or a carried
> historical.** D1 and D4 are carried historicals.
>
> **Mention is not carriage.** Counting occurrences of a dimension's name across
> a document measures mentions. Face carriage is read at the `**Status**` block,
> **bounded at the block, and plural-safe** — `Dimensions 3 and 5` does not match
> a singular pattern. **This is recorded because it has failed three times: at
> v25 Sec 3 originally, and twice in the derivation of this correction.**
>
> **`v2.68`'s Status face says "Five dispositions, all definitional." Those are
> its limb-1 scope rulings, not the G3 dimensions.**

**The dispositions as they stand at this basis**, offered as the derivation this
item asks for and not as a new ruling:

| dim | disposition | supplied at | last restated | current or carried |
|---|---|---|---|---|
| 1 | PASS | `v2.59` §2, line 198 | `v2.60` §7 | **carried historical** |
| 2 | PASS | `v2.60` §6, heading line 303 | `v2.61` face | current at `v2.60` basis |
| 3 | NOT PERFORMED | `v2.61` | `v2.68` | current |
| 4 | FAIL | `v2.59`, preserved by name at `v2.59:127` | `v2.61` face | **carried historical** |
| 5 | NOT PERFORMED | `v2.61` | `v2.61` | current |

Limb 1 **OPEN** — defined at `v2.68`, not performed, not sized; the `~700`
estimate **WITHDRAWN**. Limb 3 **open**. G4 **not enterable**. G5 blocked. G6 not
reached.

**Supplier attributions are §H4's and were verified independently** at
`v2.59:198`, `v2.59:127`, and `v2.60:303`.

---

# §J4. `v25_Owed_Index_Amd6_2026-08-23.md` — the absent pointer banner

**Owed. Raised at `Amd8:295–298` and explicitly not decided there:** *"Whether
Amd6's absent banner warrants its own entry is not decided here… That is an
address, not a category."*

**Confirmed live at this basis.** Amendment 6 is the **only non-tail link in the
chain carrying no pointer banner**:

```
Amd4  POINTER BANNER → Amendment 5
Amd5  POINTER BANNER → Amendment 6
Amd6  (none)                          ← Amendment 7 states it was promised one
Amd7  POINTER BANNER → Amendment 8
Amd8  POINTER BANNER → Amendment 9
Amd9  POINTER BANNER → Amendment 10   ← placed by this commit
```

Amendment 7 states *"Amendment 6 receives a pointer banner that carries
nothing."* **It does not.** Amendment 8 recorded the discrepancy and placed
Amendment 7's banner in its own commit rather than promising it; Amendment 9 did
the same for Amendment 8; **this commit does the same for Amendment 9.**

**Amendment 6's banner is still not placed here.** Placing it would require
ruling which of Amendment 6's two candidate forward-pointers is correct — a
question Amendment 7 raised and declined at §G6 — and **that ruling is not this
amendment's to make.** What is discharged is the obligation to carry the item to
`v26`'s Sec 6 as a one-time entry rather than leave it in a non-actions section.

**Proposed `v26` Sec 6 entry:**

> **Amd6's absent pointer banner.** Class: **one-time, OPEN.** Amendment 6 is the
> only non-tail link in the Owed Index chain without a forward pointer. Amendment
> 7 states it received one; it did not. **Placing it requires first ruling which
> forward pointer is correct** — see Amendment 7 §G6. **The ruling is not the
> `v26` author's to make.**

---

# §J5. `Prime_Studios_Audit_Handoff_v25.md` Sec 6 item 1 — the missing warning, and its substance carried

**Owed.** Item 1 enumerates `git fetch --prune`, `git log -1 origin/main`,
`git rev-parse`, and `git rev-list --left-right --count`. **None of those
exhibits the hazard.** What item 1 lacks is a warning that **history-scoped and
commit-scoped reads have identical output shapes.**

## §J5.1 Why this entry carries substance rather than citing it

The warning's derivation is filed at
`v26_Draft_Material_Perennials_2026-08-27.md`. **That document is on `main` and
carries no `_DRAFT` in its filename**, so it is not
`Prime_Studios_Audit_Handoff_v25.md` §5.3's class of register fact resting on an
unfiled draft.

**Its absorption condition is "Void on `v26` landing."**

**Routing a citation to it into `v26`'s Sec 6 produces a reference that dies at
the moment the citing document is born.** That is a dangling reference with a
known date — more predictable than §5.3's open-ended dependency and, for that
reason, easier to fail to notice. **This section therefore carries the mechanism
and the demonstration, so the `v26` entry cites this amendment and not the
voiding document.**

## §J5.2 The mechanism

`git log` walks history for the newest commit touching `<path>` **reachable
from** `<commit>`. **It is a history query, not a commit query.** `--format=`
suppresses the only field that distinguishes the two, after which **both reads
emit a bare path list and are indistinguishable by shape.**

Worked, against `fec15be6` and
`docs/audit/Paranoid_Exposure_Inventory_2026-08-07.md`:

```
ground truth — git diff-tree --no-commit-id --name-only -r fec15be6
   touches F-AUTH-1_Fix_Plan_v2.61.md, NOT the inventory.  Answer: no.

A.  git show --name-only --format= fec15be6 -- <path>
      (empty)                      ← answers the question asked

B.  git log -1 --format= --name-only fec15be6 -- <path>
      docs/audit/Paranoid_Exposure_Inventory_2026-08-07.md
                                   ← plausible, non-empty, NOT about fec15be6

restore the suppressed field:
    git log -1 --format='%h %ci' --name-only fec15be6 -- <path>
      470ad7a1   2026-08-19 03:35:19 -0400
```

`fec15be6` is 2026-08-22 06:55. **B answered about `470ad7a1`.**

**Instrument A is sound here because `fec15be6` is a non-merge commit** — one
parent, `e1086702`. **Without `-m` it is not sound on merges.** The condition is
load-bearing and easy to leave implicit.

## §J5.3 Proposed `v26` Sec 6 item 1 addition

> **(h) History-scoped reads answer commit-scoped questions.** `git log … -- <path>`
> walks history for the newest commit touching `<path>` reachable from the named
> commit; `git show --name-only --format= <commit> -- <path>` answers about that
> commit. **With `--format=` suppressing the date, both emit a bare path list and
> are indistinguishable by shape** — a false YES is plausible, non-empty, and
> about a different commit. **Use `git show --name-only`, or restore the date
> field.** `git show` is sound on non-merge commits; **on a merge it needs `-m`.**
> Full derivation at `v25_Owed_Index_Amd10_2026-08-27.md` §J5.2.

---

# §J6. What this amendment does not do, and its disclosures

- **Does not rule on `Prime_Studios_Audit_Handoff_v25.md` Sec 4.4's class.**
  §H2 recorded the count at one. Nothing here moves it.
- **Does not rule on `F-Deploy-1_Fix_Plan_v1.49.md`'s prior-art citation
  standing.**
- **Does not rule on `v25` Sec 6 item 10-B** — whether a class of six dead
  request-path routes warrants an FD. **That is a minting decision.** FD tail is
  unmoved: **FD-69 retired, FD-70 next-available and unminted.**
- **Does not decide whether §J1.1's three instances constitute a class.**
- **Does not amend `Amd8` §H3's or §H4.1's text in place.** Both stand as their
  at-filing record; this document is the correction authority, per the
  additive-supersede convention.
- **Does not place Amendment 6's pointer banner** — see §J4.
- **Does not perform `v25` Sec 6 items 1(c), 7, or 13's API half.** All three
  were **NOT PERFORMED** at this basis: `api.github.com` returned HTTP 403 with
  `core: 0/60`, reset `2026-08-27T23:49:35Z`. **A blocked read is recorded as an
  omission, not as an absence.**

**This amendment moves Amendment 9's blob.**
`503a3c29bf8f5f54e2324f24949e94b09d8f92a2` →
`4ab1faa52d7c7a61b7e655374c99912f8e86f1ab`, under an unchanged filename, by the
pointer banner placed in this commit. **That is
`Prime_Studios_Audit_Handoff_v25.md` Sec 4.1 defeater 3 occurring here**, and it
is disclosed banner-forwarding in Sec 5.5's sense. **Both values are measured
after the banner was placed, not predicted before it** — the practice Amendment 9
established and Amendment 8 did not have.

**On this amendment's filename.** `v25_Owed_Index_Amd10_*` inherits §C3's defect,
deliberately, per §E10 and per Amendments 7, 8 and 9's statement of the same
choice. **`Amd10` additionally sorts before `Amd2` byte-lexicographically** —
the first two-digit member of this family. **`sort -V` orders it correctly;
`git ls-tree --name-only` does not.** Recorded because
`Prime_Studios_Audit_Handoff_v25.md` Sec 6 item 2 requires explicit numeric sort
and this document is the first in the chain where the requirement bites.

---

*Type: amendment, derivation and correction only. No host, AWS, database, or
Cognito contact. No endpoint exercised. Prod FROZEN.*
