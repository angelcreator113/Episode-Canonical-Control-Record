# v26 Draft Material — Item 1: Two Shape-Identical Failure Modes in Path-Touch Reads

| | |
|---|---|
| **Purpose** | One instrument hazard bearing on Sec 6 item 1. Draft material for the v26 author. |
| **Created** | 2026-08-27 |
| **Basis** | Reads against `origin/main` at `21a2d165c6e7de2aee9334eff56648c8f30be70d`. |
| **Absorption condition** | **Draft material, not a chain link.** Void on v26 landing. Supersedes nothing, superseded by nothing, holds no place in any chain. |
| **Authority note** | Mints nothing. No FD, no XK, no PE. Closes no finding, reopens none, changes no gate, disposition, owner, or severity. No host, AWS, database, or Cognito contact. No endpoint exercised. Prod FROZEN. |

---

## §1 What this carries

**One entry, two failure directions.** Reads used to answer *did this commit
touch this path* have **two** shape-identical failure modes, in opposite
directions:

- A **history-scoped** read answers a **commit-scoped** question with a
  plausible, non-empty, wrong result — **a false YES**, on non-merge commits.
- A **commit-scoped** read using the combined diff returns empty for a path a
  **merge** commit did change — **a false NO**.

**Neither emits any signal distinguishing its failure from a correct answer.**
The two are recorded as one entry because they are the same hazard family
— an output shape that carries no evidence of which question was answered
— and **no class is named on two observations.**

**It is not a defect in Sec 6 item 1 as written.** Item 1 instructs `git fetch
--prune`, `git log -1 origin/main`, `git rev-parse`, and `git rev-list
--left-right --count`. **None of those exhibits this.** What item 1 lacks is a
warning that history-scoped and commit-scoped reads have identical output shapes.
**That is a missing warning, not a bad instruction** — rewrite-shaped, and owed
to the successor rather than to a banner on v25, per the precedent at v25 Sec 0.

**Deliberately one entry.** Other material derived in the same sitting was held
out rather than bundled.

---

## §2 The substitution

**Question:** does `fec15be6` modify
`docs/audit/Paranoid_Exposure_Inventory_2026-08-07.md`?

**Ground truth**, `git diff-tree --no-commit-id --name-only -r fec15be6`: the
commit touches `docs/audit/F-AUTH-1_Fix_Plan_v2.61.md` and **not** the inventory.
The answer is **no**.

> **That instrument is sound here because `fec15be6` is a non-merge commit** —
> one parent, `e1086702`. **Without `-m` it is not sound on merges**; see §3.1.
> **The condition is stated because it is load-bearing and easy to leave
> implicit.**

```
A.  git show --name-only --format= fec15be6 -- <path>
      (empty)                         ← answers the question asked

B.  git log -1 --format= --name-only fec15be6 -- <path>
      docs/audit/Paranoid_Exposure_Inventory_2026-08-07.md
                                      ← plausible, non-empty, NOT about fec15be6
```

**Restoring the suppressed field exposes it:**

```
    git log -1 --format='%h %ci' --name-only fec15be6 -- <path>
      470ad7a1   2026-08-19 03:35:19 -0400
```

`fec15be6` is 2026-08-22 06:55. **B answered about `470ad7a1`.**

**Mechanism.** `git log` walks history for the newest commit touching `<path>`
**reachable from** `<commit>`. It is a history query, not a commit query.
`--format=` removes the only field that distinguishes the two. **With it
suppressed, both reads emit a bare path list and are indistinguishable by
shape.**

---

## §3 The asymmetry — the load-bearing part

Positive control on `470ad7a1`, which does touch the path: **B returns the path,
correctly.**

Negative control on a path never touched in any commit: **B returns empty.**

| true answer | B returns |
|---|---|
| YES — the commit touches the path | the path. **Correct.** |
| NO — the commit does not touch it | the path, **if any reachable commit touched it. False YES.** |
| NO — no commit anywhere touched it | empty. **Correct.** |

**On non-merge commits, B can produce a false YES and cannot produce a false
NO.**

**It fails in the direction of confirming**, and the instrument is reached for
precisely when a reader wants to establish that a commit did *not* touch
something. **"Non-empty" is not the tell**, because B does return empty for a
path with no history at all — so an empty result is not diagnostic of the
instrument being sound, only of that particular path.

### §3.1 A fails in the opposite direction, on merges

**`git show --name-only` and `git diff-tree` without `-m` emit the *combined*
diff on a merge commit** — only paths differing from **every** parent. **A path
resolved cleanly from one parent is invisible.**

`76a7f1ac`, parents `79f9bab1` and `afe13438`:

```
git show --name-only --format= 76a7f1ac -- <path>       (empty)   FALSE NO
git diff-tree --no-commit-id --name-only -r 76a7f1ac    (empty)   FALSE NO
git show -m --name-only --format= 76a7f1ac -- <path>    <path>    correct
git diff-tree -m --no-commit-id --name-only -r          <path>    correct
git diff --name-only 76a7f1ac^ 76a7f1ac -- <path>       <path>    correct
git diff --name-only 79f9bab1 76a7f1ac -- <path>        <path>    differs from parent 1
git diff --name-only afe13438 76a7f1ac -- <path>        (empty)   resolved from parent 2
```

**The merge took `afe13438`'s version of the path, which differs from
`79f9bab1`'s. It therefore changed the path along the first-parent line, and the
combined diff reports nothing.**

**This bites the commit at the centre of `v25_Owed_Index_Amd8_2026-08-27.md`
§H1.** A reader taking §2's A-form and running it against `76a7f1ac` gets
**empty** and concludes the merge did not touch the inventory. **It did.**

### §3.2 The full picture

| instrument | non-merge commit | merge commit |
|---|---|---|
| B — `git log -1 --format= --name-only` | **false YES possible** | history-scoped; answers about another commit |
| A — `git show --name-only`, `git diff-tree` without `-m` | correct | **false NO** |
| `git show -m` / `git diff-tree -m` | correct | correct |
| `git diff <commit>^ <commit>` | correct | correct **on the first-parent line**, which is the question usually meant |

**B fails toward confirming on non-merges. A fails toward denying on merges.
Neither is unconditionally sound.** The unambiguous forms are `-m` or an
explicit two-point diff.

**A false NO is the worse failure here**, because the instrument is reached for
when establishing that a commit did not touch something — which is exactly what
a false NO appears to confirm.

---

## §4 Standing, and the bound

**One live occurrence in practice. Zero in the corpus.**

**The live occurrence.** B was run against `fec15be6` during this session, the
path came back, and a wrong belief about `fec15be6` was formed and stated before
being caught. **It was not constructed. It bit.**

**The near-miss, and why it is the positive control.**
`v25_Draft_Material_2026-08-24.md:402` carries the only corpus occurrence of the
formulation:

```
$ git log --all --oneline --name-only --diff-filter=A | grep -iE 'handoff.*v25|…'
```

**That is a history question asked with a history instrument, and it retains
`--oneline`.** The identifier field is present. It is the correct use, and its
correctness is what §2's mechanism predicts: the hazard is `--format=` removing
the distinguishing field on a **commit-scoped** question. **The corpus contains
the instrument and not the hazard.**

**Adjacency, as a pointer only.** `Prime_Studios_Audit_Handoff_v25.md` Sec 4.3
concerns an instrument answering a question adjacent to the one asked. **Here the
substitution is invisible rather than merely wrong** — Sec 4.3's cases are
detectable on inspection of the output; this one is not, because the output shape
carries no evidence of which question was answered. **The adjacency is noted; no
relation is asserted.**

---

## §5 Reach — how the zero was reached

**This document's "zero in the corpus" was produced twice, by different means,
and a reader deserves to know which zero it is.**

**The first zero was defective.** The scan was
`git grep -E 'git log[^\n]*--name-only'`, which returned no files. **In `git
grep`'s ERE, `[^\n]` is a bracket expression meaning "not backslash, not the
letter `n`"** — it is not "any character except newline." The target line reads
`git log --all --oneline --name-only`, and `oneline` contains an `n`, **so the
class could not span the gap and the match was structurally impossible.**

Demonstrated:

```
git log[^\n]*--name-only   → 0 files
git log.*--name-only       → 1 file   (v25_Draft_Material_2026-08-24.md:402)
git log[^z]*--name-only    → 1 file   ← same line; class excludes a letter not present
```

**The second zero was established by finding §4's near-miss and inspecting it.**
That is the zero this document rests on. **The first zero read as a mismatch and
was in fact a broken instrument** — which is
`Prime_Studios_Audit_Handoff_v25.md` Sec 4.3's fourth bullet, *"A grep whose
character class silently excluded the pattern it was written to find, returning
zero matches that read as a mismatch."* **Already filed there. Pointed at, not
re-derived, and not a second entry in this document.**

**Recorded because this document's subject is instruments that return empties
reading as answers**, and a document on that subject whose own zero came first
from a broken instrument must say so.

---

## §6 What this does not do

- **Does not rewrite Sec 6 item 1.** §1 records why a warning is owed. **The
  rewrite is the v26 author's.**
- **Does not claim a defect in item 1's instructions.** None of the four reads it
  names exhibits this.
- **Does not claim any single-instrument formulation is unconditionally sound.**
  §3.2 records conditions, not a recommendation.
- **Does not name a class.** Two observed failure directions in one instrument
  family is one hazard family, not a class.
- **Does not re-derive the character-class hazard**, filed at v25 Sec 4.3.
- **Does not assert a relation to Sec 4.3's cases.** §4's adjacency is a pointer.
- **Mints nothing**, and holds no place in any chain.

---

*Type: draft material, derivation only. Void on v26 landing. No host, AWS,
database, or Cognito contact. No endpoint exercised. Prod FROZEN.*
