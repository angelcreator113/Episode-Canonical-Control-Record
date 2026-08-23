| **PRIME STUDIOS** **F-AUTH-1 LIMB 1 MEASUREMENT v2** *Supersedes the 2026-08-22 count. 129, not 25. Zero `cannot-tell`. §5's feasibility finding withdrawn.* |
| --- |

# F-AUTH-1 Limb 1 — Measurement v2

**Document version**

**MEASUREMENT v2. SUPERSEDES `F-AUTH-1_Limb1_Measurement_2026-08-22.md` in its
count, its `cannot-tell` rate, and its §5.** That document rested on **a partial
read of the record.**

**Minted, not amended in place**, per `F-Deploy-1_Fix_Plan_v1.49.md`: the
correction invalidates the headline number, the rate, and a finding — far past
what a banner may carry. **The superseded document receives a pointer banner.**

**Does not perform limb 1.** Does not adjudicate any Tier disposition. **Mints
nothing.** Limb 1 **OPEN**; limb 3 open; G4 not enterable; ASSESSMENT NOT
COMPLETED. Prod **FROZEN**.

**Basis:** `origin/main` at `bef5da9e`, 2026-08-23.

**Author**

JAWIHP / Evoni — Prime Studios

**Status**

Correction. Supersedes a merged measurement. States its method (§1) because
§C1 requires it and because the superseded document's failure was precisely a
claim stated without one.

---

# §1. Method

**Stated first, and in full, per `v25_Owed_Index_Amd3_2026-08-23.md` §C1.**

**Preconditions asserted before any read**, per Amd1 §A1 and Amd2 §B1:
POSITION — `HEAD` equals `origin/main`; COMPLETENESS — `--is-shallow-repository`
is `false`; RETRIEVABILITY — reasoned per question, and **it is the property
that failed last time.**

**Sources read, per CP — both, not one:**

1. **The closure document's version block**, via
   `git show <adding-commit>:docs/audit/<doc>`.
2. **The code commit's message body**, via `git log -1 --format=%b <sha>`,
   **read in full.**

**Counting rule.** A **recorded disposition** is one distinct *(scope, class)*
pair the record states, **scope taken at the finest granularity the record
names** — file, mount, or cluster.

**The boundary, as ruled:**

- **Distinct classes at one scope are distinct dispositions.**
  `characterRegistry.js (36 PROMOTE + 1 PRESERVE @ L1882)` is **two**. The
  PRESERVE is the author deciding one handler is different and saying so.
  **Collapsing them because they share a file would count the file, not the
  ruling** — the handler-proxy error inverted.
- **The same disposition stated at two granularities is one.** Where the record
  itemizes a class into named scopes, **the itemization is counted and the class
  total is not.** Where a class total is only partly itemized, the named scopes
  are counted plus **one** for the un-itemized remainder.
- **A deferral is a disposition.** CP1's *"4 POSTs deferred to CP10"* has a
  scope and a stated treatment: these are not being ruled here, and that is a
  ruling.
- **Zero-count classes are not counted.** `Tier 2/3/4/5: 0 handlers` records
  absence, not judgment. Carried unchanged from the superseded document.
- **Approximate counts stay approximate.** Not resolved by counting any diff.

**Where the rule cut against finer granularity — stated because §C1 requires
the method, not just the result.** CP12 names five `§5.21` mixed-tier instances
*and* a class list covering them. **The class list was counted and the five
instances treated as its itemization**, because the record does not permit a
clean decomposition of which handlers the named instances cover. **The finer
reading would have given CP12 twelve rather than seven.**

---

# §2. The count

| CP | superseded said | **v2** | what the record states at finest granularity |
|---|---|---|---|
| CP1 | `cannot-tell` | **3** | press.js Tier 3; manuscript-export.js Tier 3; 4 POSTs deferred to CP10 |
| CP2 | `cannot-tell` | **9** | episodes.js in 5 conversion shapes; wardrobeApproval Tier 2; uiOverlay Tier 2; episodeOrchestration AI POST; cluster Tier 1 remainder |
| CP3 | `3, partial` | **5** | worldTemperature Tier 1; Tier 1 remainder; worldStudio Tier 3; worldStudio Tier 4 GETs; worldEvents PRESERVED |
| CP4 | `cannot-tell` | **3** | Tier 1 [113]; sceneProposeRoute AI POST; sceneSetRoutes ×12 |
| CP5 | `cannot-tell` | **3** | Tier 1 [74]; AI POST [12]; Item 16 escalation |
| CP6 | `cannot-tell` | **22** | 13 files, each with its own class mix |
| CP7 | `cannot-tell` | **18** | 17 files itemized |
| CP8 | 2 | **21** | 9 files itemized |
| CP9 | 2 | **11** | 5 files itemized |
| CP10 | 8 ~ | **21** | WP3 across 9 routes + remainder; WP4 across 6; WP6; AI POSTs; processing.js Tier 2-equiv; queue-monitor mount-line; PRESERVE |
| CP11 | 3 | **3** | beats 5, markers 7, audio-clips 5 — **body and closure agree** |
| CP12 | 7 ~ | **7** | class list; five `§5.21` instances as its itemization (§1) |
| Track 7 | `cannot-tell` | **3** | 15 mutation sites; 1 Tier 3; 7 Tier 4 |

> ## **129 recorded dispositions. Zero `cannot-tell`. Zero `partial`.**

**Only CP11 is unchanged.** Its commit body and closure statement state the same
three groupings — the sole CP where the two sources agree in granularity.

**`partial` does not apply to CP3.** Its body covers all four files of the World
cluster; the closure statement's coverage of `worldStudio.js` alone was **a
summary of part of a complete record**, not a partial population. **The term
ruled at the superseded document's §2 stands as a term** and simply has no
instance here.

---

# §3. What the superseded document got wrong, and why

## §3.1 The error

**It read the closure document's version block and treated that as the record.**
The **commit message body is equally the record** — arguably more so, since it
sits with the code the disposition is about, which is the exact pairing Ruling 3
asks an auditor to compare.

**Every CP records dispositions in its commit body.** Bodies run 42 to 145
lines. Seven CPs called `cannot-tell` record dispositions there; **five more
record them at finer granularity than their closure statements.**

## §3.2 It is the §A3 shape, seventh instance

An instrument that could not reach the commit body **returned "no tier
breakdown" — absence, not error.** The superseded document recorded that
absence as a property of the record rather than of the read.

**This instance is the most consequential of the seven**, because it did not
merely mislead a working session: **it produced a published measurement, merged
to `main`, whose headline number and central finding were both wrong.**

## §3.3 §C1 would have caught it, and §C1 postdates it by forty minutes

`v25_Owed_Index_Amd3` §C1 requires a negative existence claim to be stated with
the read that produced it.

**The superseded document said "no tier breakdown" for seven CPs and did not
state the method.** Had it said *"no tier breakdown, per a read of the closure
document's version block,"* **the incompleteness is visible on the face of the
claim** — a reader asks why only the version block.

**§C1's claim, demonstrated against the document that motivated it.** Recorded
here rather than in Amendment 3, because the demonstration belongs with the
correction it explains.

---

# §4. §4.1's signal discriminates in both directions

`F-AUTH-1_Fix_Plan_v2.68.md` §4.1 states that a pass reporting **no**
`cannot-tell` results is more suspect than one reporting several.

**The superseded document's 7-of-13 rate read as rigor and was under-reading.**

> **The `cannot-tell` rate is a discriminator in both directions. A suspiciously
> LOW rate suggests drift into re-derivation. A suspiciously HIGH rate suggests
> the record has not been fully read.**

**Owed to v2.68 §4.1 as a pointer**, not carried into it — v2.68 is merged, and
amending it would be a substantive edit to a merged revision.

## §4.1 This document reports zero, and that is explained rather than clean

**Zero `cannot-tell` is exactly what §4 says to distrust.**

**It is not drift.** Reading a commit body is **retrieval, not inference**;
Ruling 3 excludes re-derivation and no disposition here was reconstructed from
code. The record genuinely states dispositions for all thirteen.

**But the uncertainty did not vanish. It moved.** It now sits in the *(scope,
class)* boundary, which is a ruling rather than a reading. **A zero that is
explained is a different object from a zero that is clean**, and this one is
explained: the residue is in §5, not in the availability of the record.

---

# §5. The count is precision-limited by its boundary rule

**129 is stated with the rule that produced it (§1), and alternatives exist.**

Under defensible variations of the *(scope, class)* boundary the figure moves
materially — **roughly 120 to 140 under the ruled boundary, and further outside
it.** The superseded document's own §3.1 caution applies here in a sharper form:
**this is a count of recorded dispositions under one stated boundary, not a
measure of work, and not a size for limb 1.**

**§C1's method requirement applied to a positive claim rather than a negative
one.** A count without its boundary rule is as unfalsifiable as an absence
without its search.

---

# §6. The superseded §5 feasibility finding is WITHDRAWN

The superseded document held that **limb 1 as specified cannot audit the first
half of the sweep**, because Ruling 3 requires confirming a recorded disposition
and seven of thirteen recorded none.

**That premise is false. Every CP recorded dispositions.**

**The finding is withdrawn on its face.** Whether Ruling 3 is satisfiable over
CP1–CP7 is now **an open question with a different answer than the one the
superseded document implied**, and it is **not ruled here.**

**No scoping of first-half auditability is performed**, and any prior scoping
premised on an absent record does not apply.

---

# §7. What this document does not do

- **Does not perform limb 1** or adjudicate any Tier disposition.
- **Does not rule on first-half auditability** (§6). The question is reopened,
  not answered.
- **Does not amend `F-AUTH-1_Fix_Plan_v2.68.md`.** §4's refinement is owed to
  its §4.1 as a pointer.
- **Does not amend the superseded measurement.** It receives a pointer banner
  and is otherwise untouched.
- **Does not resolve CP10's or CP12's approximate counts**, and counts no diff.
- **Does not treat 129 as a size for limb 1** (§5).
- Does not advance Dimension 3, discharge limb 3, enter G4, or alter the freeze.
- **Mints nothing.**

---

*Type: measurement, correcting a merged measurement. All reads local git at
`bef5da9e`. No host, AWS, database, or Cognito contact. No endpoint exercised.
Prod FROZEN. Not merged — v24 Sec 4.6.*
