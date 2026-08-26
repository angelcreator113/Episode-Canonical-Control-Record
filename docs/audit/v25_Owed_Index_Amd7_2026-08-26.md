| **PRIME STUDIOS** **V25 OWED INDEX — AMENDMENT 7** *Filename sort is not an authority instrument. Three defeaters, three mechanisms, one instrument.* |
| --- |

# v25 Owed Index — Amendment 7

**Document version**

**AMENDMENT 7 to `v25_Owed_Index_2026-08-22.md`.** One item. Adds §G1–§G6.

**Minted rather than carried in place**, per `F-Deploy-1_Fix_Plan_v1.49.md`.
Amendment 6 receives a pointer banner that carries nothing.

**Rules nothing about any finding. Mints nothing.** Ships no code. Changes no
gate, severity, owner, or disposition. Limb 1 **OPEN**; limb 3 open; G4 not
enterable; ASSESSMENT NOT COMPLETED. Prod **FROZEN**. **Gate states carried as
face reads; not re-derived here.**

**Basis:** `origin/main` at `8fe3a8a3`, 2026-08-26. **Derived and filed in the
same sitting; no derivation-to-filing gap opened.**

**Author**

Claude, with JustAWomanInHerPrime (JAWIHP) / Evoni — Prime Studios.

**Status**

Derivation. One class, three instances, one correction to a cited prior art.

---

# §G0. Why this amendment exists

**Derived in the course of running the wake-up trio, correct, and transcript-
only at the moment of derivation.** That is §B3's condition.

**The chain's count is not continued here, because the chain's own count is not
settled.** Amendment 5 §E0 asserts the seventh. **Amendment 6 states the
condition twice and differently:** its §F0 body reads *"this would be the eighth
if it sat"* — conditional, and it did not sit — while **the pointer banner it
placed on Amendment 5 reads "§F0 records an eighth occurrence."**
`v25_Draft_Material_2026-08-24.md` Sec 0 adopts the body's reading and claims
the eighth conditionally for itself.

**This document records that §B3's condition recurred. It does not number the
recurrence.** Numbering it would require ruling which of Amendment 6's two
statements governs, and that is not this document's to rule. **Recorded for a
ratifying revision.**

**It was first ruled into v25.** That ruling was made against a route list of
two — a Fix Plan revision, Evoni-ruled and none open, or v25 — and was reversed
when the third route was identified: **an amendment in this chain mints nothing
and needs no Fix Plan revision.** The reversal is recorded because the reasoning
that produced the first answer was sound and the list it ran against was not.

**"It goes into v25" is the deferral with no occasion attached** that §B3 names
and §C5 found recurring. **The occasion is this document.**

**Internal attribution, per §F0's departure.** The executing party derived the
instrument defect while running the trio; the drafting party ruled it to v25,
then reversed on being shown the third route. **§D2.1's class**, and §D3
governs: recorded, no procedure proposed.

---

# §G1. The claim

**Authority derived by sorting filenames is unsound in this corpus.** The claim
is about the **instrument**, not about any one mechanism that defeats it.

**Three defeaters are recorded below. They are distinct mechanisms and are not
collapsed.** Each independently returns a wrong authority with no signal that it
is wrong. **Naming them as one mechanism would overstate the claim**; naming the
instrument as unsound on three independent grounds does not.

**Scope.** This concerns *deriving which document governs*. It does not concern
sorting for display, inventory, or navigation, where a wrong order is visible.

---

# §G2. Defeater 1 — the sort is not the sort that was asked for

**`git ls-tree --name-only` returns byte-lexicographic order on the full path,
not numeric order.**

Verified at `8fe3a8a3`: the tail of `git ls-tree --name-only origin/main
docs/audit/` is `v10_session_brief.md`. **The true numeric maxima are elsewhere
in the listing:**

| family | lexicographic tail | true maximum |
|---|---|---|
| `F-AUTH-1_Fix_Plan` | `v2.9` | **`v2.68`** |
| `F-Deploy-1_Fix_Plan` | `v1.9` | **`v1.49`** |
| `F-Stats-1_Fix_Plan` | `v1.9` | **`v1.60`** |
| `Prime_Studios_Audit_Handoff` | `v9` | **`v24`** |

`v1.10` sorts above `v1.2`; `v2.12` above `v2.2`. **`F-AUTH-1_*` precedes
`F-App-1_*`** because `U` < `p` in byte order.

**Mechanism: the instrument does not perform the operation named.** The number
tracks content correctly; the ordering does not read the number.

**Standing: verified at `8fe3a8a3` this sitting.**

---

# §G3. Defeater 2 — a correct derivation ages, and its staleness is silent

**`Prime_Studios_Audit_Handoff_v24.md` Sec 1 derives the authority table at
`fec15be6`, 2026-08-22.** It names `F-AUTH-1_Fix_Plan_v2.61.md` and
`F-Deploy-1_Fix_Plan_v1.48.md`.

At `8fe3a8a3` the maxima are **`v2.68`** and **`v1.49`**;
`git rev-list --count fec15be6..origin/main` returns **49**.

**v24 committed no error and defends against this in its own header:**

> **Derived at `fec15be6` by numeric sort and live reads. This table is a
> snapshot of a derivation, not authority. Sec 6 requires reproducing it.**

**Mechanism: the derivation was correct and the corpus moved.** Minting worked;
each later revision took a new number. **This defeater belongs to the reader who
skips the required reproduction, not to the instrument's blindness** — which is
precisely why it is recorded as a distinct mechanism rather than folded into
§G4.

**Standing: verified at `8fe3a8a3` this sitting.**

---

# §G4. Defeater 3 — content moves and the number does not

**Recorded at `F-Deploy-1_Fix_Plan_v1.49.md`, which states it of itself.**
PR #1105 appended 74 lines in place to `v1.48`, already merged at `6b0900be`:

> **The defect is in the carriage, not the content:** v24 Sec 6 derives document
> authority by numeric sort, and an in-place amendment is invisible to that
> instrument — the document changed (`d4f382ba` → `0a31b603`), the number did
> not. A reader deriving authority by sorting revisions gets a stale answer with
> no signal that it is stale.

**Mechanism: the number is not a function of the content.** This is the only one
of the three where performing the derivation *correctly* still returns the wrong
answer.

**v1.49's disposition is carried, not re-adjudicated.** It closes no finding,
reopens none, and **F-Deploy-1 remains CLOSED.**

**Standing: verified — v1.49 read at `8fe3a8a3` this sitting.**

---

# §G5. The cited prior art, read at source, is narrower than its citation

**v1.49 cites XK-1's Correction Banner 2 as prior art:**

> **This is the mechanism XK-1's Correction Banner 2 already declines to use**,
> on the stated grounds that a dated layer which changes after merging cannot be
> relied on for what it said on its date. The register held the principle; it
> was not applied here.

**`Paranoid_Exposure_Inventory_2026-08-07.md` was read directly.** Correction
Banner 2 states:

> **Banners are read newest-first. Where two disagree the later governs; where a
> banner and the body disagree the banner governs. The 2026-08-18 banner below
> is preserved exactly as merged at `76a7f1ac` and is not edited.**

The document describes itself as **"the measurement of record, amended by
additive-supersede."**

**What the banner holds is layer immutability** — a prior dated layer is not
edited; a new layer is added above it. **It does not decline in-place amendment;
it practises it.** The principle does not speak to whether the filename or
number moves.

**Consequence for §G4, stated and not ruled:** #1105's append would have
*satisfied* layer immutability — it added without editing. What it defeated is
the number's relation to the content, which Banner 2 does not address. **The
cited prior art therefore does not cover the case it is cited for.**

**This records a reading of two documents. It rules nothing about either.**
`v1.49` is Evoni-ruled and is not corrected here; **whether its citation warrants
amendment is left open and belongs to a ratifying revision.**

**Standing: verified at `origin/main` only — both documents read at source this
sitting.** This item exists because a claim about a document was checked against
the document, per v24 §4.3.

## §G5.1 The basis of this reading, and what it could not reach

**Both documents were read exclusively at `origin/main` = `8fe3a8a3`**, via
`git show origin/main:path`. **No branch, no off-`main` commit, and no PR
history was read.**

**Correction Banner 2 cites `76a7f1ac` as where the 2026-08-18 banner "was
merged." That commit is not an ancestor of `origin/main`.** It exists — merge of
PR #1054, 2026-08-18 — and the document there is 153 lines carrying one banner,
against 187 lines and two banners at `8fe3a8a3`. **The banner stacking therefore
occurred off `main`; `main` received the composed result in a single commit
(`fec15be6`), and the path shows one commit in `main`'s history.**

**Off-`main` context exists, is reachable, and was not read.** It could
establish that v1.49's citation points at something this reading cannot see —
in which case **§G5's conclusion does not hold.** The conclusion is stated at
this basis and is defeasible by that unread context.

**This limitation is stated here rather than left to a reader's inference**,
because §G3's defeater is a correct derivation whose staleness was silent, and
a reading that does not name its own reach would repeat it.

---

# §G6. What this amendment does not do

- **Does not amend §1, §A1, §B1, or §F1–§F5.** All stand.
- **Does not propose a replacement instrument**, a naming convention, or a
  procedure. §D3 and §D5.
- **Does not rule on `F-Deploy-1_Fix_Plan_v1.49.md`** or on its prior-art
  citation. §G5 records a reading.
- **Does not reopen F-Deploy-1**, which remains **CLOSED**.
- **Does not rule on XK-1's admission**, its banner convention, or the
  measurement it carries.
- **Does not cite the squash-merge ancestry question**, though §G5 encountered
  it: `76a7f1ac` is not an ancestor of `origin/main`. **Encountered, recorded,
  not derived into.**
- **Does not claim a fourth instance.** A loosely-written grep defeated in the
  same sitting was tested against this class and **excluded**: a correctly-
  specified instrument written imprecisely and caught on inspection is not an
  instrument that is structurally blind. **Recorded as a negative control.**
- Does not perform or size limb 1, advance Dimension 3, discharge limb 3, enter
  G4, or alter the freeze.
- **Mints nothing.**

**On this amendment's filename.** `v25_Owed_Index_Amd7_*` inherits §C3's defect,
deliberately, per §E10 — **and does so while recording that the defect is the
subject of this document.** Consistency with the chain is chosen over
discoverability by an instrument this amendment states is unsound.

---

*Type: amendment, derivation only. No host, AWS, database, or Cognito contact.
No endpoint exercised. Prod FROZEN. Not merged — v24 Sec 4.6.*
