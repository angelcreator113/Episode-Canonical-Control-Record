> **CORRECTION BANNER — THIS COUNT IS SUPERSEDED. IT RESTED ON A PARTIAL READ
> OF THE RECORD (added 2026-08-23, additive; nothing below is removed or
> edited).**
>
> **Banners on this document are read newest-first.**
>
> **The count below, its `cannot-tell` rate, and its §5 are all wrong.** This
> document read **only the closure document's version block** and treated that
> as the record. **The code commit's message body is equally the record**, and
> every CP records dispositions there — bodies run 42 to 145 lines.
>
> **All seven `cannot-tell` results were incorrect.** Five further CPs record at
> finer granularity than their closure statements. **The corrected count is
> 129, not 25, with zero `cannot-tell` and zero `partial`.**
>
> **§5's feasibility finding is WITHDRAWN.** It held that limb 1 cannot audit
> the first half because no disposition was recorded to confirm. **Every CP
> recorded dispositions.**
>
> **The corrected measurement is
> `F-AUTH-1_Limb1_Measurement_v2_2026-08-23.md`, which governs. This banner
> points and carries nothing.**
>
> **§2's ruling of `partial` as a fourth term stands** — the term is sound and
> simply has no instance; CP3 is not partial. The population frame in §1, CP2's
> `patch-id` resolution in §1.1, and the two independent findings in §6 are
> **unaffected and stand.**
>
> Mints nothing. Prod FROZEN.

| **PRIME STUDIOS** **F-AUTH-1 LIMB 1 MEASUREMENT** *Population frame derived. 25 recorded dispositions, 3 partial to one CP, 7 CPs `cannot-tell`.* |
| --- |

# F-AUTH-1 Limb 1 — Population Frame and Disposition Count

**Document version**

**MEASUREMENT.** Performs the sizing that `F-AUTH-1_Fix_Plan_v2.68.md` §6.1
sequenced and deliberately did not take. **Ruling 1 applied to Ruling 2**, on
the sub-ruling that a CP contributes at **the record's own finest stated
granularity.**

**Does not perform limb 1.** Does not adjudicate any Tier disposition. **Does
not rule whether the first half of the sweep is auditable** — §5 raises that and
scopes it as owed.

**Mints nothing.** Closes and reopens nothing. FD tail **FD-69** (retired at
#1102); XK tail **XK-3**; PE tail **PE #67**. Limb 1 **OPEN**; limb 3 open; G4
not enterable; ASSESSMENT NOT COMPLETED. Prod **FROZEN**.

**Basis:** `origin/main` at `84b9024a`, 2026-08-22.

**Instrument preconditions, both asserted before any read**, per
`v25_Owed_Index_Amd1_2026-08-22.md` §A1: **POSITION** — `HEAD` equals
`origin/main`. **COMPLETENESS** — `git rev-parse --is-shallow-repository` is
`false`. **The completeness check was not decorative:** the first ancestry pass
in this session ran on a shallow clone and returned `false` for all thirteen CP
commits.

**Author**

JAWIHP / Evoni — Prime Studios

**Status**

Measurement. Reports a count, a rate, and three findings. Rules one term.

---

# §1. The population frame

**Twelve Step 3 CP commits plus one Track 7 mini-CP**, each with its closure
document. All thirteen CP commits verified **ancestors of `main`** against full
history.

| CP | code commit | closure doc | doc added at | doc on `main` today |
|---|---|---|---|---|
| CP1 | `05cd536d` | v2.24 | `f0052223` | **no** |
| CP2 | `d73599f8` | v2.25 | `6e5f17b5` | **no** |
| CP3 | `61f8a658` | v2.26 | `5b031d9e` | **no** |
| CP4 | `5c13531e` | v2.28 | `0ad2c691` | **no** |
| CP5 | `1a2d433d` | v2.29 | `0b9e11e3` | **no** |
| CP6 | `9892e604` | v2.31 | `ede4376b` | **no** |
| CP7 | `10577813` | v2.32 | `85294f79` | **no** |
| CP8 | `105bc6eb` | v2.33 | `a9af78b1` | **no** |
| CP9 | `34f5684e` | v2.34 | `1d454111` | **no** |
| CP10 | `b0a404e7` | v2.35 | `928473a6` | **no** |
| CP11 | `acc172f7` | v2.36 | `fe4be494` | **no** |
| CP12 | `49e08e04` | v2.37 | `1265d8c3` | **yes** |
| Track 7 | — | v2.27 | `9ba13e02` | **no** |

## §1.1 CP2's duplicate, resolved by `patch-id`

Two commits carry byte-identical CP2 subjects and identical `--stat` totals
(23 files, `510 +`, `222 −`), both ancestors of `main`.

| | `d73599f8` | `2f8f4d85` |
|---|---|---|
| committer | Claude | **GitHub** |
| parent | `05cd536d` (CP1) | `8f30dfc7` |
| tree | `5567285a` | `9aa23e47` |
| **`patch-id`** | **`3ca880dc1c9e`** | **`3ca880dc1c9e`** |

**Same change, applied at two points.** The second is the landing of the first.
**CP2 is one disposition set.** `d73599f8` is taken — the authored commit whose
parent is CP1, keeping the range contiguous along the sweep's own chain.

**Every cheap discriminator fails here.** Subjects agree, `--stat` totals agree,
and both agree there are two commits. **Only `patch-id`, which normalizes away
the parent, separates duplicate from distinct.** Same family as the undeduped
route objects behind the 890-vs-912 write discrepancy, one layer up: **a thing
counted once per landing rather than once per existence.**

**Swept, not spot-fixed.** All thirteen were grouped by `patch-id`; **CP2 is the
only duplicate.** The remaining eleven CPs are singletons.

---

# §2. `partial` — a fourth term

Ruling 3 gives the audit's per-disposition outcomes: `agree`, `disagree`,
`cannot-tell`. **Those describe the outcome of judging one disposition. They do
not describe the completeness of a CP's record**, which is a second axis.

> **`partial` — the record states dispositions for a proper subset of the CP's
> own population, and the subset is identifiable.**

**Distinguished from `cannot-tell`**, where nothing is recorded, and **from a
clean count**, where the record covers what the CP touched.

**Ruled as a term rather than a footnote for a specific reason: a partial summed
into a total silently becomes a whole.** A count annotated in a table cell
survives one transcription and then reads as complete.

---

# §3. The count

**At each CP's finest stated granularity.**

| CP | what the closure statement records | contributes |
|---|---|---|
| CP1 | no tier breakdown | **`cannot-tell`** |
| CP2 | no tier breakdown | **`cannot-tell`** |
| CP3 | `worldStudio.js — 1 Tier 3 + 18 Tier 4 GETs + 34 Tier 1 mutations` — **one of four files** | **3, `partial`** |
| CP4 | no tier breakdown | **`cannot-tell`** |
| CP5 | no tier breakdown | **`cannot-tell`** |
| CP6 | no tier breakdown | **`cannot-tell`** |
| CP7 | `153 handlers / 148 promotions`, no tier split | **`cannot-tell`** |
| CP8 | `84 Tier 1 + 6 Tier 4` | **2** |
| CP9 | `25 Tier 1 + 11 Tier 4 + 0 Tier 2` | **2** |
| CP10 | 8 classes, `~85 Tier 1` approximate | **8 ~** |
| CP11 | `17 Tier 1 (beats 5 + markers 7 + audio-clips 5)` | **3** |
| CP12 | 7 classes, two approximate | **7 ~** |
| Track 7 | frontend `apiClient` migration, no dispositions | **`cannot-tell`** |

> ## **25 recorded dispositions, of which 3 are `partial` to one CP.**
>
> **Six of thirteen contribute enumerably. One of those six is partial. Seven
> contribute nothing enumerable.**

## §3.1 What the total is not

**The total cannot be treated as covering the twelve CPs.** It is a count of
recorded dispositions across the six documents that recorded any.

**It is not a measure of work, and the unit is non-uniform across CPs.** CP10
contributes **8** and CP11 contributes **3** — CP10 wrote a fine sub-taxonomy,
CP11 itemized three files. CP10 covered ~120 handlers; CP11 covered 17. **The
count tracks how each CP wrote, not how much it judged.**

**Against the withdrawn `~700` this is roughly 28×.** Stated plainly because a
number far below the withdrawn one will read as suspicious to anyone carrying
`~700` as intuition. **It is the rejected proxy's shadow, not a measurement
error** — and the divergence is the point of having withdrawn it.

## §3.2 Two normalizations, declared

1. **Zero-count classes are not counted.** `0 Tier 2` records absence, not
   judgment.
2. **Approximate counts stay approximate.** CP10 and CP12 carry `~` unresolved.
   **Resolving them by counting the diff would be re-derivation**, which Ruling
   3 excludes.

---

# §4. The `cannot-tell` rate is 7 of 13

**54%.** Per v2.68 §4.1 the reassuring direction — **a pass reporting none would
be more suspect than one reporting several.** This rate is high enough to be a
finding rather than a caveat.

**The convention did not exist for the first half of the program.** CP1, CP2,
CP4, CP5, CP6, CP7 and Track 7 record handler counts, file counts, test counts
and session times, **and not what they ruled.** Stating a tier breakdown in the
closure statement appears sporadically at CP3 and becomes consistent only from
CP8.

**CP7 is the sharpest case.** `153 handlers / 148 promotions` — **it records how
many handlers it changed and says nothing about what it ruled them to be.**

---

# §5. Consequence for limb 1's feasibility — RAISED, NOT RULED

**Ruling 3 requires confirming a recorded disposition against the code at the
CP's basis. For seven of thirteen there is no recorded disposition to confirm.**

**Limb 1 as specified cannot audit the first half of the sweep**, because the
object the audit acts on does not exist in the record for that half.

**This is a finding about limb 1's feasibility, not about the count.** Whether
the first half is auditable at all — and if so by what procedure, since any
procedure that reconstructs a disposition is re-derivation — **is a question the
register has not faced.**

**Not ruled here.** It deserves its own scoping, on the same discipline that
produced the definitional rulings this measurement rests on. **Recorded as
owed.**

---

# §6. Two findings independent of limb 1

## §6.1 Retrievability — eleven of twelve CP records are not in the tree

Only **v2.37** is on `main`. The rest were deleted across **at least two
events** — `c3c5dbb4` removed eleven fix-plan iterations; v2.26, v2.27 and
v2.35–v2.36 left by other paths.

**All are recoverable at their adding commits, verified individually.** Nothing
is lost.

**But any instrument pointed at the worktree finds one of twelve and reports the
rest absent.** Limb 1 reads its own record from deleted history. **This is a
fact about the register's retrievability and holds independently of limb 1.**

## §6.2 The numbering trap — the closure sequence is not one-per-CP

**`v2.27` closes the Track 7 mini-CP. `v2.30` closes F-SOCKET-1 and F-AUTH-X1
Phase 2**, which are not CPs.

**Deriving the population by numbering revisions produces a wrong mapping** —
off by one from CP4 onward, and **silently**, because every document in the
range looks like a CP closure. The correct mapping is recoverable only from each
document's own closure statement, not from its version number.

---

# §7. `Tier` is overloaded across three taxonomies

**Owed to `v25_Owed_Index_Amd1_2026-08-22.md` §A3.1 as a fifth instance.**
Carried here because that document is merged and a banner may point but may not
carry.

`F-AUTH-1_Fix_Plan_v2.29.md` alone contains **165 `Tier` mentions** spanning
three unrelated taxonomies:

| taxonomy | example | relation to limb 1 |
|---|---|---|
| **finding priority** | *"F-AUTH-1 is the Tier 0 keystone"* | none |
| **Track 6 frontend file batching**, by site count | *"Tier 1 (1-site files, 9 files, warm-up cadence)"* | none |
| **auth disposition** | *"Tier 1 (requireAuth)"*, *"Tier 4 (plain optionalAuth + PUBLIC)"* | **the only one limb 1 is about** |

**An instrument enumerating `Tier N` collects all three and returns a large,
confident, wrong number.** It does not signal that it cannot tell which taxonomy
it is reading.

**Fifth instance of §A3's shape, and the first found while applying the rule
rather than before it.**

---

# §8. What this document does not do

- **Does not perform limb 1** or adjudicate any Tier disposition.
- **Does not rule whether the first half of the sweep is auditable** (§5).
- **Does not resolve CP10's or CP12's approximate counts**, and does not count
  any diff.
- **Does not amend v2.68, the owed index, or Amendment 1.** §7 is carried here
  and pointed to.
- **Does not treat 25 as a size for limb 1** (§3.1).
- Does not advance Dimension 3, discharge limb 3, enter G4, or alter the freeze.
- **Mints nothing.**

---

*Type: measurement. No host, AWS, database, or Cognito contact. No endpoint
exercised. All reads local git against `84b9024a`. Prod FROZEN. Not merged —
v24 Sec 4.6.*
