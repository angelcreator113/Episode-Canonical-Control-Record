# F-Stats-1 Fix Plan v1.51
*Additive-supersede on v1.50. Mints §54. Sizes the reads surface and declines to slice it.*

## What changed in v1.51

**The reads slice owed at v1.49 §52.6 was attempted and is NOT taken.** The
surface is **509 single-row-by-id read sites across 68 files** — 6.5× Rule 2's
destructive-write population, of which one file was read in a full session.

**No rule proposed produces a finishable slice**, and none is taken. **509 is
recorded as the size of the problem, not as an instance count.**

**The methodology question goes on the register instead of a partial count** —
§54.4. The reads surface needs a different instrument than per-handler reading,
and so, on the same evidence, does the remedy.

**A method note:** the first sizing returned 68 and was nearly reported as sites.
It was files. §54.5.

---

## §54 — the reads surface, sized and not sliced

### §54.1 What was owed

v1.49 §52.6 recorded Rule 2's cost explicitly: destructive writes only, **no reads
at all**, with `wardrobe.js:173` standing as proof that the read surface holds
instances Rule 2 cannot return. The reads slice was written into the register
*"so that it is owed in the register rather than in someone's memory of this
session."*

**It is now attempted.**

### §54.2 Sizing

Population: the same 120-file complement — routes not carrying `:showId`.

**Probe:** `findByPk\(|findOne\(` — single-row fetches by id, the shape that pairs
with a child-addressed route. `findAll` is excluded as a list-endpoint shape and a
different question. Raw `SELECT` is excluded here and remains unmeasured on this
surface.

| | Count |
|---|---|
| Files in the complement carrying such reads | **68** |
| **Sites** | **509** |

**Comparison.** Rule 2's population was **78 destructive sites**, of which
**3 were read** — one file, `episodes.js`, across a working session.
**509 is 6.5× that population.**

### §54.3 What 509 is not

**509 is an upper bound on the population, not an instance count.** No claim is
made that any of these sites is an instance. Most will not be:

- Many sit on domains with **no show partition by design** — `worldStudio.js`,
  `characterRegistry.js`, `universe.js`, `relationships.js` — where v1.44 §47.2
  established the shape cannot apply.
- Many read tables that are **not show-partitioned** at all.
- Many take an id that **arrived from an already-scoped source**, which is the
  distinction that made `evaluation.js:628` a ruling rather than a guess.

**Determining which requires reading the handler.** That is the whole difficulty.

### §54.4 Three options, and the one taken

| Option | Assessment |
|---|---|
| Canon-bearing tables only | **Circular.** The filter needs the read's target table; `findByPk` does not show it without reading the handler, which is the cost being avoided |
| One named file, read completely | Finishable and honest, **but one file is a sample, not a slice** |
| **Size it, decline to slice, record the methodology question** | **Taken** |

**Option 3 is taken because 509 is itself the result.**

Beginning a pass that cannot be completed would leave the register holding a
partial count that reads like a measurement. **That is the failure this plan has
spent six revisions correcting** — §28's `Measure-Object -Line`, §43.7's null
controls, §46.4's shape-without-model, §47.6's malformed probe, §52.5's partial
population, §53.5's three counts. **A seventh position is available here and is
declined by not starting.**

**The constructive form of the result.** The reads surface is not unknowable; it
is **unmeasurable at per-handler granularity in this working mode.** A different
instrument would measure it — a static-analysis pass over the model layer, a lint
rule asserting that every `findByPk` on a show-partitioned model is followed by a
scope check, or runtime instrumentation recording which queries carry a tenant
predicate. **None of those is proposed or evaluated here.**

**And the same evidence bears on the remedy.** If 509 read sites cannot be
hand-audited, they equally cannot be hand-patched. **A per-site remedy for the
second shape is not viable at this scale**, which points at the structural
candidates already recorded against XK-2 — a scoping convention, a repository
layer, or row-level security — rather than at individual fixes. **Recorded as an
implication of the sizing, not as a remedy recommendation.** Both shapes' remedies
remain UNEVALUATED.

### §54.5 Method note — 68 was files

The first sizing ran `git grep -c` and returned **68**, piped through
`Measure-Object -Line`. **`-c` counts matches per file and emits one line per
file**, so 68 was the count of *files*, and `Measure-Object` counted those lines.
It was nearly reported as a site count.

The site count required `-n`, which emits one line per match: **509**.

**Same hazard family, caught in the same breath** — a result describing the
instrument rather than the subject. The distinguishing check was noticing that a
number arrived from a flag whose semantics had not been stated.

**Recorded because the near-miss is instructive at this size.** Had 68 been
carried forward, the reads surface would have looked comparable to Rule 2's
population and a slice would have been started on a figure off by a factor of
seven and a half.

---

## What this revision does not do

- **Does not take a reads slice.** None of the 509 sites is read, ruled, or
  counted as an instance.
- Does not assert that any of the 509 is an instance, or that any is clean.
- Does not measure raw `SELECT` reads on this surface, or `findAll` list reads.
  Both remain unmeasured.
- Does not propose, select, or evaluate an alternative instrument. §54.4's
  candidates are named as candidates only.
- **Does not propose or evaluate a remedy** for either shape. §54.4's implication
  bears on remedy viability, not on remedy selection. Both remain UNEVALUATED.
- Does not mint any finding. **The second shape remains unminted, unowned,
  unnumbered** at 9 handlers / 10 sites / 6 files.
- Does not amend XK-2's Cross-Keystone Register entry.
- Does not survey the **75 unread destructive sites**; they are not asserted clean.
- Does not measure XK-2's ORM-surface extent.
- Does not disposition any statement. **No file other than `worldEvents.js` is
  dispositioned.**
- Does not mint an FD, PE, or XK number.
- Does not lift any gate.
- Does not enumerate prod. **Prod remains FROZEN.**
- **No live database contact. No prod-box contact. No dev-box contact.**

---

## §11 Plan Version History (UPDATED)

| v1.51 | 2026-08-15 | **The reads slice owed at v1.49 §52.6 was attempted and is NOT taken.** Sizing over the same 120-file complement, probing `findByPk\(|findOne\(` (single-row-by-id reads; `findAll` and raw `SELECT` excluded and unmeasured), returns **509 sites across 68 files** — **6.5× Rule 2's 78-site destructive population**, of which 3 sites in one file were read across a working session. **509 is an upper bound on the population, not an instance count**: many sites sit on domains with no show partition by design (v1.44 §47.2), read non-partitioned tables, or take ids from already-scoped sources, and distinguishing them requires reading the handler — which is the cost being sized. **Three options assessed; option 3 taken**: canon-table filtering is circular (the filter needs the target table, which requires the handler read); one file read completely is a sample not a slice; **sizing and declining is the honest result, because starting an uncompletable pass would leave the register holding a partial count that reads like a measurement** — the failure corrected six times on this plan, and a seventh position is declined by not starting. **Constructive form:** the surface is unmeasurable at per-handler granularity *in this working mode*, not unknowable; a static-analysis pass, a lint rule over `findByPk` on show-partitioned models, or runtime predicate instrumentation would measure it — **none proposed or evaluated.** **Implication recorded, not a recommendation:** 509 sites that cannot be hand-audited equally cannot be hand-patched, so a per-site remedy for the second shape is not viable at this scale, pointing at the structural candidates already recorded against XK-2; **both shapes' remedies remain UNEVALUATED.** **§54.5 method note:** the first sizing returned **68** from `git grep -c` — which counts per file and emits one line per file — and was nearly reported as a site count; `-n` gave 509. Had 68 carried forward, a slice would have started on a figure off by a factor of seven and a half. Mints no FD, no XK. No live DB contact. Prod FROZEN, untouched. §54 minted. Basis `0608d2d9`. |

## Register hygiene

- **Mints no FD**, consistent with F-Stats-1 practice v1.1–v1.50. Tail: **FD-61**.
  **XK tail: XK-2**, unchanged.
- Mints: **§54**.
- Closes: **nothing**.
- **Discharges** v1.49 §52.6's owed reads slice **as attempted-and-declined**, with
  the surface sized at 509 sites / 68 files. **The slice itself is not taken and
  is not re-owed in its current form** — §54.4 records why the rule does not
  produce a finishable pass.
- Records: the sizing; §54.3's statement of what 509 is not; §54.4's option
  assessment and the instrument question; §54.4's remedy-viability implication;
  §54.5's method note.
- Changes **no instance count**. The second shape stands at 9 handlers / 10 sites /
  6 files, unminted and unowned.
- Carries: XK-2's owed amendments (Reach, sub-form 3 wording, extent statement);
  the **75 unread destructive sites**; §35.5's classes 2–6, unminted and
  homing-owed; the class 2 candidate at `opportunityRoutes.js:258`; the F-Sec-3
  instance report at `wardrobe.js:1233`; the eleven-router collision surface and
  fail-open mount pattern from v1.50; `feedPipelineRoutes.js`'s unexplained zero;
  the three unread write sites from v1.48; open items 22, 24, 6; all other items
  carried from v1.50. Open items 41 and 23 remain **CLOSED** per v1.43.
- Defers: both shapes' homing; XK-2's ORM-surface extent, remedy and sequence
  position; classes 2–6's reach; §39.4 defect 1 (label-only) and defect 3
  (unruled); §44.8; XK-1's remedy and population question.
- Forward-points: the instrument question at §54.4 — measuring the reads surface
  requires tooling this working mode does not have. Recorded, not adopted, and
  **no tool is proposed.**
- Changes no unit disposition, no PR state, no gate. **The Cross-Keystone Register
  is not modified.**
- Does not evaluate any fix, does not lift any gate, does not enumerate prod.
- **No live database contact. No prod-box contact. No dev-box contact.** Prod
  remains FROZEN.
- Additive-supersede on v1.50; no destructive rewrite.
- **Numeral disambiguation:** *XK-1 and XK-2 (Cross-Keystone Register)* are
  unrelated to FD-1/FD-2, §1/§2, or any open item 1/2. §54 is minted in v1.51;
  section numbers and their minting revision numbers do not correspond.
- FD-21 check: no closing keywords adjacent to `#N`.
- Ships WITH `[skip-automerge]` (doc-only PR).

## Forward Statement

v1.49 put the reads slice on the register so it would be owed somewhere durable.
**This revision discharges that debt by attempting it and reporting that it does
not fit.**

**509 read sites across 68 files.** Rule 2's whole population was 78, and one
file's three sites took a session. No narrowing rule proposed here survives
inspection: filtering by canon table requires the handler read that the filter
exists to avoid, and reading one file completely produces a sample that would be
cited as a slice.

**The number is the finding.** Not because 509 sites are defective — most are
almost certainly fine, and §54.3 says so — but because **the surface cannot be
characterised by reading handlers one at a time**, and that is a fact about the
remediation problem rather than about a session's budget.

It cuts the same way on the fix. **Whatever cannot be hand-audited at this scale
cannot be hand-patched at this scale either.** That does not select a remedy, and
this plan selects none. It does say that a remedy consisting of five hundred
individual scope predicates is not a plan, and that the structural candidates
already sitting UNEVALUATED against XK-2 are where the answer has to come from.

**What is owed now is not a slice. It is an instrument** — and naming that
honestly is worth more than a partial count that would have looked like progress.

---

*Author: Claude, with JustAWomanInHerPrime (JAWIHP) / Evoni.*
*Date: 2026-08-15. Main at `0608d2d9` (#1024). Predecessor: v1.50.*
*Minted: §54. Discharged: v1.49 §52.6's reads slice, as attempted-and-declined. Closed: nothing. Mints no FD, no XK. Tail: FD-61. XK tail: XK-2. [skip-automerge]*
