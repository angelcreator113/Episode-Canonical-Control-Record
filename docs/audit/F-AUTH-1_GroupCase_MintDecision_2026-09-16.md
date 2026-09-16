| **PRIME STUDIOS** **F-AUTH-1 — GROUP-NAME CASE MISMATCH, MINT DECISION** *Records Evoni's decision that the group-case finding does not mint FD-70, and that this decision does not reopen or re-dispose `F-AUTH-1_Fix_Plan_v2.69.md` §6 Ruling 5's prior FD-70 ruling on the CP6 counting errors — a different matter. Records a decision; mints nothing.* |
| --- |

**Document version**

v1.0 — **DECISION RECORD, NOT A NEW RULING ON A NEW QUESTION.** This
document records that a mint was considered for the group-case finding
and declined. The decision itself is Evoni's; this document cites it,
it does not re-derive it.

**Basis:** `origin/main` at `35d7d1d8c3342de88c1d5860ad427b7eaa57a2a7`,
2026-09-16 (`git rev-parse origin/main`; commit date `2026-09-16T15:22:37-04:00`
per `git log -1 --format='%H %ad' --date=iso-strict origin/main`).
Standing: **MEASURED** for every repository read in this document
(filenames, FD tail, `v2.69` §6 Ruling 5's quoted text). The disposition
decision itself is **Evoni's**, dated 2026-09-16, cited here, not
re-derived.

**Author**

Claude, with JustAWomanInHerPrime (JAWIHP) / Evoni — Prime Studios.

**Status**

**Recording only.** No FD, XK, or PE number is minted by this document.
Prod **FROZEN**. No AWS, host, or database contact by this document.

---

# §0. Filename date

Derived from the filing date, same read that establishes the basis
(§1): `date -u +"%Y-%m-%d"` at the time of filing returned `2026-09-16`,
and `git rev-parse origin/main`'s commit date is also `2026-09-16` — the
two agree, so the filename carries `2026-09-16` with no disambiguation
needed.

---

# §1. What this decision is about

Four documents already carry the full record of the group-case finding;
this document names them and restates none of their content:

1. **MEASURED note** — `F-AUTH-1_GroupCaseMismatch_MEASURED_2026-09-16.md`
   (`PR #1474`).
2. **Reproduction addendum** — `F-AUTH-1_GroupCaseMismatch_Addendum_Reproduced_2026-09-16.md`
   (`PR #1476`).
3. **The fix** — `fix(auth): make group comparison case-insensitive in
   authorize and requireGroup` (`PR #1479`).
4. **Second addendum** — `F-AUTH-1_GroupCaseMismatch_Addendum2_Fixed_2026-09-16.md`
   (`PR #1481`).

In one sentence: 38 of 51 admin-group authorization call sites compared
an uppercase literal against a Cognito pool that emits lowercase group
names, denying a legitimate admin, and the comparison (not the 38
literals) was fixed the day it was found. The four documents above carry
every measured detail, the reproduction, the fix, and the residue this
decision addresses; none of it is restated here.

---

# §2. `v2.69` §6 Ruling 5 — a different FD-70 question, quoted from source

`F-AUTH-1_Fix_Plan_v2.69.md`, `## 5. FD-70 — the two CP6 disagrees`,
lines 255–265:

> ```
> 255  ## 5. FD-70 — the two CP6 disagrees
> 256
> 257  **Ruling:** Do not mint FD-70. No further action.
> 258
> 259  **Rationale:** The two `universe.js` counting errors (row 11: 4 recorded
> 260  vs. 5 observed; row 12: 4 recorded vs. 3 observed) are counting errors on
> 261  an otherwise-correct Tier ruling — the total (8) and Tier assignment as a
> 262  class are unaffected; only the 4/4 split reads as 5/3. A documentation
> 263  error, not a protection gap. Already fully described at
> 264  `F-AUTH-1_Limb1_Exceptions_Consolidated_2026-09-03.md` §3; nothing further
> 265  is owed.
> ```

`v2.69` §6 Ruling 5 already considered FD-70 and declined to mint it —
but for **the two CP6 disagree rows** (limb 1's `universe.js` counting
errors on an otherwise-correct Tier ruling), a documentation
split-error. That is a different matter from the group-case finding:
different defect, different evidentiary basis, different rationale. The
present decision does not touch, reopen, or re-dispose that ruling.

---

# §3. Current FD tail, established from a pasted read

```
$ ls docs/audit | grep -E '^FD-[0-9]+_' | sort -t- -k2 -n
FD-66_Model_Migration_Contract_Mismatch_2026-08-18_DRAFT.md
FD-69_Unauthenticated_Token_Issuance_2026-08-22_DRAFT.md
```

Highest filed `FD-NN_*.md` is **FD-69**. No `FD-70_*.md` file exists.
**FD-69 retired** (spent on a duplicate, per `Prime_Studios_Audit_Handoff_v26.md`
line 229 and `PROJECT_CONTEXT.md` line 253, both carried, not re-derived
here beyond the filename scan above). **FD-70 is next-available and
unminted** — corroborated by the filename scan and by `v2.69` §6 Ruling
5 (§2 above), which names it "next-available, unminted" in the course of
declining to mint it for a different matter.

---

# §4. The decision, Evoni's

**This finding does not mint FD-70.** FD-70's existing unminted status
is unchanged and it remains next-available. This decision does not
reopen or re-dispose the question `v2.69` §6 Ruling 5 already answered
(§2 above) — that ruling stands, untouched, on its own matter.

**Reasoning, as hers:** the finding is fully recorded across the four
documents named at §1 — measured, reproduced end to end, fixed, and the
fix itself reproduced end to end. It was fixed the day it was found. The
remaining 38 call sites' uppercase literals (`F-AUTH-1_GroupCaseMismatch_Addendum2_Fixed_2026-09-16.md`
§7) are residue under the chosen normalization — harmless under the
`.toLowerCase()` fix, not a live defect — rather than an outstanding
defect needing its own lifecycle or FD number.

---

# §5. Why this note exists

Without it, a later reader auditing the FD tail sees a real
authorization defect — measured, reproduced, and fixed — with no FD
number attached, and cannot tell from the register alone whether a mint
was considered and declined or simply overlooked. This note answers
that: a mint was considered, for this specific finding, and declined,
for the reasoning at §4.

---

# §6. What this does not do

- **Does not mint FD-70 or any number.** No FD, XK, or PE is minted by
  this document.
- **Does not rule on whether the residue should be cleaned up.** The 38
  call sites' uppercase literals remain as they are; whether to
  normalize them is not decided here.
- **Does not dispose of any of the four group-case documents** named at
  §1. None of them has an open/closed state to move — each is, by its
  own text, recording-only or additive-only, and none is closed,
  reopened, or otherwise moved by this document.
- **Does not touch FD-65** or any other finding. This decision is scoped
  to the group-case finding alone.
- **Does not re-rule `v2.69` §6 Ruling 5.** That ruling's own matter (the
  two CP6 disagree rows) is untouched; §2 above quotes it only to
  establish that it answers a different question than this one.

---

# §7. Disposition

Recording only. No FD, XK, or PE number minted by this document. Prod
**FROZEN**. No AWS, host, or database contact by this document.
