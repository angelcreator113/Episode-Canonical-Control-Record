# F-Stats-1 Fix Plan v1.55
*Additive-supersede on v1.54. Mints §58. Ten files read under Rule 2. Mints no finding.*

## What changed in v1.55

**Ten files read, 27 sites resolved.** Six new instances, **two verified scoped**,
nineteen excluded by domain. The shape stands at **30 sites, 29 handlers, 11
files.** Rule 2's remaining population: **34.**

**A fourth sub-form is recorded** — §58.3. *Predicate carries a tenant term; the
term is caller-supplied.* **`where: { show_id }` is not a sufficient test for
correct scoping**, and any probe classifying by predicate shape would mark these
clean.

**Two sites are VERIFIED SCOPED** — §58.4. `careerGoals.js:487` and
`opportunityRoutes.js:255`, both taking the tenant from the route path.

**Six files excluded by domain, all world/character/authoring tier** — §58.5.
Nineteen sites out of population, **not cleared.**

**A fourth root-only-partitioned domain** — `ContinuityTimeline` carries `show_id`
where its characters and beats do not, matching Storyteller and Scene.

**Two probe defects, one unexplained** — §58.7.

---

## §58 — the ten-file batch

### §58.1 Disposition

| File | Sites | Result |
|---|---|---|
| `socialProfileRoutes.js` | 5 | **excluded** — all targets unpartitioned |
| `tierFeatures.js` | 5 | **excluded** — all targets unpartitioned |
| `careerGoals.js` | 1 | **verified scoped** |
| `hairLibraryRoutes.js` | 2 | **2 instances** |
| `makeupLibraryRoutes.js` | 2 | **2 instances** |
| `opportunityRoutes.js` | 1 | **verified scoped** |
| `wardrobe.js` | 1 | **1 instance** (file already counted at v1.54) |
| `continuityEngine.js` | 4 | **1 instance**, 3 excluded |
| `stories.js` | 3 | **excluded** |
| `compositions.js` | 3 | **excluded** |
| **Total** | **27** | **6 instances / 2 clean / 19 excluded** |

**Shape total: 30 sites, 29 handlers, 11 files.** *(v1.54's `wardrobe.js:173`
already counted the file; `:859` adds a site and a handler, not a file.)*

### §58.2 The six new instances

| Site | Route | Model | `show_id` | Sub-form |
|---|---|---|---|---|
| `hairLibraryRoutes.js:127` | `DELETE /hair-library/:id` | `HairLibrary` | yes | on model, unfetched |
| `hairLibraryRoutes.js:194` | `POST /hair-library/generate` | `HairLibrary` | yes | **caller-supplied tenant** |
| `makeupLibraryRoutes.js:125` | `DELETE /makeup-library/:id` | `MakeupLibrary` | yes | on model, unfetched |
| `makeupLibraryRoutes.js:192` | `POST /makeup-library/generate` | `MakeupLibrary` | yes | **caller-supplied tenant** |
| `wardrobe.js:859` | `POST /wardrobe/seed` | `Wardrobe` | yes | **caller-supplied tenant** |
| `continuityEngine.js:145` | `DELETE` on a timeline | `ContinuityTimeline` | yes | on model, unfetched |

**The hair and makeup files are near-identical** — same structure, same guard,
same gap, differing only in a default `count` (8 vs 7) and their physical-descriptor
fields. **The defect was duplicated at authorship rather than drifting into
existence.**

### §58.3 The fourth sub-form — a tenant term that proves nothing

`hairLibraryRoutes.js:194`, `makeupLibraryRoutes.js:192`, `wardrobe.js:859`:

```
const { show_id, replace_existing = false } = req.body;
if (!show_id) return res.status(400).json({ error: 'show_id required' });
...
if (replace_existing) {
  await db.HairLibrary.destroy({ where: { show_id } });
}
```

**The predicate is tenanted. The tenant is whatever the caller named.** A caller
passing another show's id deletes that show's catalogue and replaces it with
Claude-generated styles.

**This is a method finding as much as an instance finding.** Every probe in this
pass has leaned on predicate shape — *does the `where` clause carry a scope term* —
and **these three sites pass that test and are defective.** `where: { show_id }`
establishes that a column is filtered on, not that the value is authorized.

**The correct test requires reading where the value came from**, which is a
handler read, not a grep. That is the same conclusion §54.4 reached from the reads
surface and §55.6 reached from the model layer, arriving from a third direction.

**`wardrobe.js:859` is narrower than the other two** and is recorded as such: its
predicate also filters `name` against the `SEED_WARDROBE` constants, so a caller
can wipe another show's *seeded* items, not its whole catalogue. The operation is
a seeder and `clear_existing` re-seeding is intended; **the defect is purely whose
show is re-seeded.**

**A guard that reasons one step short.** Both `/generate` handlers check
`replace_existing` and **409 if the catalogue already has four or more items**,
naming the flag needed to override. **Someone reasoned carefully about accidental
overwrite and not at all about whose catalogue it is** — the same shape as
`sceneSetRoutes.js:1006`'s containment check, in a different dimension.

### §58.4 Two verified scoped

**`careerGoals.js:487`** — `DELETE /world/:showId/goals/:goalId`:

```
const { showId, goalId } = req.params;
await models.CareerGoal.destroy({ where: { id: goalId, show_id: showId } });
```

**`opportunityRoutes.js:255`** — `DELETE /opportunities/:showId/:id`:

```
const { showId, id } = req.params;
if (models.Opportunity) {
  await models.Opportunity.destroy({ where: { id, show_id: showId } });
} else {
  await models.sequelize.query(
    'UPDATE opportunities SET deleted_at = NOW() WHERE id = :id AND show_id = :showId', ...);
}
```

**Both take the tenant from the route path and use it.** These are the first
destructive writes in the Rule 2 pass to come back clean, and they are recorded as
positives rather than as absences of findings.

**`opportunityRoutes.js:255` is also the first Pattern 42 instance where both
branches are correct.** The defensive `if (models.Opportunity) … else raw SQL`
fallback — recorded as a defect marker at `wardrobe.js:1291`, `WorldEvent.js:57`
and `worldEvents.js:2836` — scopes identically on both paths here. Its raw branch
hand-rolls `deleted_at` on a paranoid model, **which is §12.41's class and is the
one context where hand-rolling is the only option**, since the model is by
hypothesis unavailable.

**A correlation, raised and dropped.** All clean destructive writes found so far
take the tenant from the route path; all thirty instances take it from elsewhere
or nowhere. **That is not a rule, and it is recorded as not being one:** XK-2's
founding instance `arcRoutes.js:158` has a route-path tenant, scopes its read with
it, and drops it at the write. **Route-path tenancy correlates with correct
destroys in this pass and does not guarantee correct writes generally.**

### §58.5 Six files excluded — and what exclusion means

| File | Sites | Targets |
|---|---|---|
| `socialProfileRoutes.js` | 5 | `SocialProfile`, `SocialProfileFollower`, `SocialProfileRelationship`, `SocialProfileTemplate` |
| `tierFeatures.js` | 5 | `RelationshipEvent`, `WorldTimelineEvent`, `WorldLocation`, `WorldStateSnapshot`, `StoryThread` |
| `stories.js` | 3 | `StorytellerStory`, `SocialMediaImport`, `NovelAssembly` |
| `compositions.js` | 3 | `ThumbnailComposition`, `CompositionOutput`, `EpisodeAsset` |
| `continuityEngine.js` (partial) | 3 | `ContinuityCharacter`, `ContinuityBeat`, `ContinuityBeatCharacter` |
| *(`worldStudio.js`, v1.44 §47.2)* | *13* | *no show partition in addressing* |

**Every target model was verified to carry no `show_id`, and every negative was
guarded** by confirming the model file exists in `src/models/` before reading an
empty grep as absence.

**Excluded is not cleared.** These sites are outside the shape's population
because the domain they operate on is not show-partitioned — a handler cannot omit
a check against a tenancy that does not exist. **Nothing is asserted about their
correctness in any other respect.**

**A partitioning seam, recorded.** `SocialProfile` and its three siblings carry no
`show_id` while **`FeedPost` does** (v1.52 §55.2). **Posts are show-scoped; the
profiles that author them are not.** A global author producing show-scoped content
is coherent; it means the tenancy boundary runs *between two models in one feature
area*, and it is recorded because a future reader may expect the domain to be
uniform.

**`tierFeatures.js` carries `:showId` on some routes** — it is in the 22-file list
— **and all five of its destroys target unpartitioned world-tier models.** The
file-level question *"is this domain partitioned"* is therefore the wrong
granularity, and this pass has used per-target classification throughout.

### §58.6 A fourth root-only-partitioned domain

| Domain | Root (carries `show_id`) | Children |
|---|---|---|
| Storyteller | `StorytellerBook` | chapter, line, echo, memory — none |
| Scene | `SceneSet` | angle, plan, scene, set-episode — none |
| **Continuity** | **`ContinuityTimeline`** | **character, beat, beat-character — none** |
| World / character | *none* | none |
| Social profiles | *none* | none (but `FeedPost` is partitioned) |

**Three domains now show root-only partitioning, and in all three the root's
destroy is unscoped while the children are out of population.** `StorytellerBook`
at :280, `SceneSet` at :447, `ContinuityTimeline` at :145 — same schema shape,
same defect at the same place.

**Recorded as an observation about where the defect lands, not as a causal
claim.** The root model is where tenancy lives and where the guard is consistently
absent.

### §58.7 Method notes — two probe defects

**1. A null from an unexplained probe.** A regex intended to name the models
behind three `instance.destroy()` variables returned **nothing** for `stories.js`,
implying the file had no ORM fetches — which contradicted the fact that
`.destroy()` requires a Sequelize instance. Direct reading found
`db.StorytellerStory.findByPk`, `db.SocialMediaImport.findByPk`,
`db.NovelAssembly.findByPk`.

A first correction (`\w+` → `[\w.]+`, to allow `db.Model`) **also returned
nothing** against a line it plainly matches. **The cause is unknown.**

**A probe whose null behaviour cannot be explained must not be used for negative
evidence.** Nothing in this revision rests on a null from that pattern: every
model named here came from a returned line or a direct read. **The
`continuityEngine.js` fetch listing used the same construction and did return
results**, which makes the inconsistency stranger rather than safer.

**The defence that worked: a null that contradicts a known constraint is a probe
defect, not a finding.** `.destroy()` on a non-instance is impossible, so "no
fetches in a file that calls `.destroy()`" could only be an artifact.

Ninth position in the hazard family — §28's `Measure-Object -Line`, §43.7's null
controls, §46.4's shape-without-model, §47.6's malformed probe, §52.5's partial
population, §53.5's three counts, §54.5's `-c`/`-n`, §55.6's unread model layer,
§56.5's merged-by-text sites.

**2. Predicate shape is not a scoping test.** §58.3's three sites pass a
`where: { show_id }` grep and are defective. **Any future automated pass over this
surface must resolve the tenant's provenance, not its presence.**

### §58.8 Recorded, unminted

- **`compositions.js:896` uses `authenticateJWT`**, not `requireAuth`. Every other
  destructive site in this pass — all 30 instances and both clean sites — uses
  `requireAuth`. **A third middleware name on the same operation class.**
  F-AUTH-1's five-tier model is built around `requireAuth` / `optionalAuth` /
  `authorize`. **Reported for whoever executes F-AUTH-1's deployment tracks;
  F-AUTH-1 is not assessed and no claim is made on it.**
- **`SEED_WARDROBE` is JS-constants-as-canon.** `wardrobe.js` carries seed items
  with `lala_reaction_own` / `_locked` / `_reject` strings inline — the class
  recorded at `arcProgressionService.js:119`, `influencerData.js:12`,
  `sceneSetRoutes.js`'s `templateMap`, and F-Franchise-1's Director Brain
  migration target. **Not adopted.**
- **Both `/generate` handlers destroy canon and rebuild it from model output**,
  with `JSON.parse` on the response as the only validation. Same destroy-then-
  regenerate structure as `sceneSetRoutes.js:632`, without `force: true`.

---

## What this revision does not do

- **Does not mint any finding.** The shape remains unminted, unowned, unnumbered
  across all 30 sites; v1.48 §51.5's option 3 stands.
- Does not assert that any excluded site is correct in any respect other than
  falling outside this shape's population.
- Does not read the remaining **34 destructive sites**; they are not asserted
  clean.
- Does not resolve the unexplained probe behaviour at §58.7.
- Does not amend XK-2's Cross-Keystone Register entry.
- Does not assess F-AUTH-1, `authenticateJWT`, or PE #9.
- Does not measure the reads surface; v1.51 §54.4's instrument question stands.
- Does not measure XK-2's ORM-surface extent.
- Does not propose or evaluate a remedy. **Both shapes' remedies remain
  UNEVALUATED.**
- **Does not record the hair/makeup two-tier schema question.** During this pass
  it was established that `WardrobeLibrary` → `Wardrobe` is a catalogue-plus-owned-
  instance pair carrying the game economy, and that `HairLibrary` and
  `MakeupLibrary` have the catalogue tier only. **Evoni confirms the instance tier
  is intended and unbuilt.** That is scoped-but-unbuilt work, not a defect against
  intended behaviour, and **belongs on the roadmap rather than this register.**
  Recorded here only so that a future reader knows it was considered and
  deliberately not filed.
- Does not disposition any statement. **No file other than `worldEvents.js` is
  dispositioned.**
- Does not mint an FD, PE, or XK number.
- Does not lift any gate.
- Does not enumerate prod. **Prod remains FROZEN.**
- **No live database contact. No prod-box contact. No dev-box contact.**

---

## §11 Plan Version History (UPDATED)

| v1.55 | 2026-08-15 | **Ten files read under Rule 2, 27 sites resolved — 6 instances, 2 VERIFIED SCOPED, 19 excluded by domain.** Shape now **30 sites / 29 handlers / 11 files**; Rule 2 remainder **34**. New instances: `hairLibraryRoutes.js` :127 / :194, `makeupLibraryRoutes.js` :125 / :192, `wardrobe.js:859`, `continuityEngine.js:145`. **§58.3 mints a fourth sub-form — predicate carries a tenant term, term is caller-supplied.** `/generate` on hair and makeup takes `show_id` from `req.body`, validates presence only, and on `replace_existing` deletes that show's whole catalogue and rebuilds it from Claude output; `wardrobe.js:859`'s seeder is the same shape, narrowed by a `name IN (SEED_WARDROBE)` filter. **`where: { show_id }` is therefore not a sufficient scoping test** — these three pass a predicate-shape grep and are defective; **provenance must be read, not matched**, a third independent arrival at §54.4's and §55.6's conclusion. Both `/generate` handlers 409 when the catalogue already holds four or more items — **reasoning carefully about accidental overwrite and not at all about ownership**, the `sceneSetRoutes.js:1006` shape in a new dimension. Hair and makeup files are near-identical, differing in a default count: **the defect was duplicated at authorship.** **§58.4: two VERIFIED SCOPED sites** — `careerGoals.js:487` (`DELETE /world/:showId/goals/:goalId`) and `opportunityRoutes.js:255` (`DELETE /opportunities/:showId/:id`), both taking the tenant from the route path; the latter is also **the first Pattern 42 defensive fallback whose branches are both correct.** A correlation is raised **and dropped**: every clean destroy takes its tenant from the route path, but **`arcRoutes.js:158` falsifies it as a general rule** — route-path tenancy there scopes the read and is dropped at the write. **§58.5: six files excluded, all world/character/authoring tier**, 19 sites out of population and **not cleared**; every target verified unpartitioned with the file-exists guard. Recorded: **`SocialProfile` and siblings carry no `show_id` while `FeedPost` does** — posts show-scoped, their authors global; and **`tierFeatures.js` carries `:showId` on some routes while all five destroys target unpartitioned world-tier models**, so file-level domain classification is the wrong granularity. **§58.6: `ContinuityTimeline` is a fourth root-only-partitioned model** — three domains now show root-carries-tenancy-children-do-not, and **in all three the root's destroy is unscoped** (`StorytellerBook:280`, `SceneSet:447`, `ContinuityTimeline:145`). **§58.7: two probe defects, one unexplained** — a regex returned null for `stories.js`'s fetches, contradicting the constraint that `.destroy()` requires a Sequelize instance; direct reading found three `db.Model.findByPk` calls, and a corrected pattern **also returned null against a line it matches**. Cause unknown; **nothing here rests on a null from that pattern.** Ninth position in the hazard family. Recorded unminted: `compositions.js:896` uses **`authenticateJWT`**, a third middleware name on this operation class, reported for F-AUTH-1; `SEED_WARDROBE` as JS-constants-as-canon; both `/generate` handlers destroying canon and rebuilding from model output with `JSON.parse` as sole validation. Mints no FD, no XK. No live DB contact. Prod FROZEN, untouched. §58 minted. Basis `2f14832b`. |

## Register hygiene

- **Mints no FD**, consistent with F-Stats-1 practice v1.1–v1.54. Tail: **FD-61**.
  **XK tail: XK-2**, unchanged.
- Mints: **§58**.
- Closes: **nothing**.
- Extends: the shape's instance record to **30 sites / 29 handlers / 11 files**.
  Still **unminted, unowned, unnumbered.**
- Records: the **fourth sub-form** (§58.3) and its consequence for probe design;
  **two verified-scoped sites** (§58.4); the raised-and-dropped route-path
  correlation; six domain exclusions and the excluded-is-not-cleared distinction
  (§58.5); the `FeedPost` / `SocialProfile` partitioning seam; **a fourth
  root-only-partitioned model** (§58.6); §58.7's two probe defects; §58.8's three
  unminted observations.
- Reports, not claimed: `compositions.js:896`'s `authenticateJWT`, for F-AUTH-1.
- Excludes from this register, deliberately: the hair/makeup two-tier schema
  question, as scoped-but-unbuilt roadmap work rather than a defect.
- Carries: XK-2's owed amendments; **34 unread destructive sites**; the reads
  surface and v1.51 §54.4's instrument question; §35.5's classes 2–6, unminted and
  homing-owed; the class 2 candidate at `opportunityRoutes.js:258`; the F-Sec-3
  instance report at `wardrobe.js:1233`; the eleven-router collision surface and
  fail-open mount pattern; `feedPipelineRoutes.js`'s unexplained zero; the three
  unread write sites from v1.48; tenancy paths owed from v1.53 and v1.54; open
  items 22, 24, 6; all other items carried from v1.54. Open items 41 and 23 remain
  **CLOSED** per v1.43.
- Defers: all variants' homing; XK-2's ORM-surface extent, remedy and sequence
  position; classes 2–6's reach; §39.4 defect 1 and defect 3; §44.8; XK-1's remedy
  and population question.
- Forward-points: nothing new.
- Changes no unit disposition, no PR state, no gate. **The Cross-Keystone Register
  is not modified.**
- Does not evaluate any fix, does not lift any gate, does not enumerate prod.
- **No live database contact. No prod-box contact. No dev-box contact.** Prod
  remains FROZEN.
- Additive-supersede on v1.54; no destructive rewrite.
- **Numeral disambiguation:** *XK-1 and XK-2 (Cross-Keystone Register)* are
  unrelated to FD-1/FD-2, §1/§2, or any open item 1/2. §58 is minted in v1.55;
  section numbers and their minting revision numbers do not correspond.
- FD-21 check: no closing keywords adjacent to `#N`.
- Ships WITH `[skip-automerge]` (doc-only PR).

## Forward Statement

Twenty-seven sites resolved in ten files, and **the most useful result is that two
of them are correct.** `careerGoals.js:487` and `opportunityRoutes.js:255` take
the tenant from the route path and put it in the predicate. Thirty sites do not.
**The register has been accumulating negatives, and a positive of this exact shape
is evidence about what this codebase can do rather than only about what it fails
to do.**

**The fourth sub-form is the finding that changes how the rest of this work has to
be done.** Three handlers write `where: { show_id }` and take that `show_id` from
the request body, validated for presence and nothing else. **They pass every test
this pass has been applying.** A grep for a scope term in a predicate marks them
clean, and they will delete another show's catalogue on request.

That is the third independent arrival at the same place. §54.4 reached it from
509 unauditable read sites, §55.6 from a model layer nobody had opened, and §58.3
from a predicate that names the right column and the wrong value. **Provenance
cannot be matched. It has to be read** — and a surface that cannot be read
handler-by-handler cannot be verified by pattern either.

**Six files fell out of population entirely**, every one of them world, character,
or authoring tier. The instances cluster on show-tier surfaces — episodes,
wardrobe, scene sets, storyteller books, arcs, feed posts, hair and makeup
libraries. **The partition boundary is real and the schema respects it. The
handlers on the show side of it do not.**

**Thirty-four destructive sites remain unread.** The marginal yield is falling —
this batch returned six instances against nineteen exclusions — and that is itself
information about where the remaining risk is not.

---

*Author: Claude, with JustAWomanInHerPrime (JAWIHP) / Evoni.*
*Date: 2026-08-15. Main at `2f14832b` (#1028). Predecessor: v1.54.*
*Minted: §58. Read: ten files, 27 sites. Closed: nothing. Mints no FD, no XK. Tail: FD-61. XK tail: XK-2. [skip-automerge]*
