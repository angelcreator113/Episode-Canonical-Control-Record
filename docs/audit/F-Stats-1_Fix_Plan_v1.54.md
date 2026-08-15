# F-Stats-1 Fix Plan v1.54
*Additive-supersede on v1.53. Mints §57. Qualifies v1.53 §56.4. Mints no finding.*

## What changed in v1.54

**v1.53 §56.4's per-file uniformity claim was tested and does NOT generalise.**
`sceneSetRoutes.js` carries **three distinct guard forms across six sites**, where
`storyteller.js` carried one across eight.

**`sceneSetRoutes.js` is complete under Rule 2 — 6 sites, 6 handlers, all
instances.** The shape now stands at **24 sites, 23 handlers, 8 files.** Rule 2's
remaining population: **61**.

**A third guard form is recorded** — §57.3. `:1663` performs **no fetch at all**;
its 404 comes from the delete's return value, after the write attempted.

**One handler gets within one join of tenancy and stops** — §57.4. `:1006` checks
containment (`angle` belongs to `scene_set`) but not ownership.

**The Scene family mirrors the Storyteller family exactly** — §57.2. Root carries
`show_id`, children do not. Two independent domains, same partitioning shape.

**Two `force: true` hard deletes**, one of them on a cross-tenant canon-write
path — §57.5.

---

## §57 — `sceneSetRoutes.js`, and the uniformity test

### §57.1 Why this file

v1.53 §56.4 recorded that `storyteller.js` showed eight identical omissions in one
file, and reasoned that **uniformity is more consistent with a convention never
established than with eight independent lapses.** It scoped the claim to that file
and named `sceneSetRoutes.js` (6 destructive sites) as the natural test.

**The test was run. The claim does not generalise.**

### §57.2 Model layer — checked first

Per v1.52 §55.6, the model layer was read **before** any handler:

| Model | `show_id` |
|---|---|
| `SceneSet` | **yes** |
| `SceneAngle`, `ScenePlan`, `Scene`, `SceneSetEpisode` | no |

`SceneAngle.js`'s absence from the grep was verified as a real negative by
confirming the file exists in `src/models/` — the check whose omission produced
v1.52's false negative.

**This mirrors the Storyteller family exactly.** `StorytellerBook` carries
`show_id`; chapter, line, echo and memory do not. **Two independent domains, both
partitioned at the root only.** Recorded as an observation about schema shape; no
causal claim is made and no remedy follows from it here.

*Incidental:* the v1.52 §55.2 classification of
`sceneStudioEpisodeRoutes.js:139` (`SceneAngle.findByPk`) is confirmed correct —
`SceneAngle` genuinely carries no `show_id`.

### §57.3 Three guard forms

| Form | Sites | Guards | Model | Variant |
|---|---|---|---|---|
| Bare `findByPk` → 404 → destroy | :447, :632, :1089, :2205 | existence | `SceneSet` (has `show_id`) | tenancy-on-model-unfetched |
| Compound `findOne({ id, scene_set_id })` | :1006 | **containment** | `SceneAngle` | no tenant column |
| **No fetch; 404 from the delete's return** | **:1663** | **nothing before the write** | `SceneSetEpisode` | no tenant column |

**Six sites, three forms.** `storyteller.js` had eight sites and one.

**`:1663` is the weakest structure recorded in this shape to date:**

```
const destroyed = await SceneSetEpisode.destroy({
  where: { scene_set_id: req.params.id, episode_id: req.params.episodeId },
});
if (!destroyed) return res.status(404).json({ error: 'Link not found' });
```

**Nothing is checked before the write executes.** The 404 is produced by the
delete returning zero rows. Consequence is low — a junction row, recoverable by
re-linking — but the structure is a destroy on unvalidated caller input with the
existence check *after* the fact.

### §57.4 The handler that stops one join short

`:1006`, `DELETE /:id/angles/:angleId`:

```
const angle = await SceneAngle.findOne({
  where: { id: req.params.angleId, scene_set_id: req.params.id },
});
```

**This is a containment check, and it is real.** The angle must belong to the
scene set named in the route; an arbitrary (setId, angleId) pair does not pass.

**It is still not a tenancy check.** Both values come from the caller, so a caller
holding a valid pair for another show deletes that show's angle.

**What it demonstrates is that the relationship was considered.** Whoever wrote
this handler thought about which parent the row belonged to and verified it — and
stopped at the parent rather than continuing to `SceneSet.show_id`, **which was
one property away on a model the same file fetches elsewhere.**

That is a different picture from "the convention was never established." **The
convention exists in partial form and terminates one level short.**

### §57.5 Two hard deletes, one on a canon-write path

`:632` and `:2205` both issue
`SceneAngle.destroy({ where: { scene_set_id: set.id }, force: true })` followed by
`bulkCreate`. **`force: true` bypasses paranoid; the originals are unrecoverable.**
Same structure as `episodes.js:239`.

**`:632` is the more consequential.** `POST /:id/analyze-image` fetches a scene set
by caller-supplied id, sends its `base_still_url` to an Anthropic Vision call, and
writes back `canonical_description`, `base_runway_prompt`, `scene_type` and
`mood_tags` — then hard-deletes every angle and regenerates them from the model's
output.

**`canonical_description` is already on the register**: three stale copies read by
generation services, not wired to StoryTeller or the Continuity Engine,
`visual_language` JSONB never resynced. **This handler is a cross-tenant write to
that column.**

`aiRateLimiter` is present, so API spend is bounded — but it fires on the
caller's request against another show's data.

### §57.6 Recorded, unminted

- **Hardcoded template canon.** `:2186`–`:2198` defines a `templateMap` of ten
  scene templates with fixed angle lists, under the comment `// Hardcoded
  fallback`. **This is the JS-constants-as-canon pattern** already recorded at
  `arcProgressionService.js:119`, `influencerData.js:12`, `seasonalEventService`
  and the franchise-law seeder — the class F-Franchise-1's Director Brain build is
  intended to migrate into `franchise_brain`. **A further instance, on the
  scene-set surface. Not adopted; F-Franchise-1 is not assessed.**
- **Dead in-process router re-entry.** `:2178`–`:2182` constructs a fake `res`
  object and calls `router.handle()` synchronously to fetch the same file's
  template list. **The result is assigned to `_templates` and never used**; the
  handler falls through to `templateMap` regardless, and the trailing `.catch?.()`
  on a resolved array is a no-op. Recorded as an observation.
- **`validateUUIDParam` is present on all six routes in this file** — more
  consistent than `episodes.js`, where v1.49 §52.3 recorded it applied to one of
  three. **Input validation discipline is uneven across files, not within this
  one.**

### §57.7 What the test result means

**v1.53 §56.4 is qualified, not withdrawn.** Its claim about `storyteller.js`
stands: eight handlers, one shape, no variation, and that file reads as a
convention never established.

**What does not follow is the generalisation.** `sceneSetRoutes.js` shows three
forms, including one that checks containment and one that checks nothing before
writing. **The codebase is not uniformly missing a tenancy convention. It is
applying inconsistent partial guards**, and at least one of those guards was
written by someone reasoning about row relationships.

**This is the more useful answer**, and it bears on remedy shape without selecting
one. A missing convention suggests introducing it. **Inconsistent partial guards
suggest something enforceable** — the instrument question v1.51 §54.4 already
recorded, arriving from a second direction. **No remedy is proposed or evaluated;
both shapes' remedies remain UNEVALUATED.**

---

## What this revision does not do

- **Does not mint any finding.** The shape remains unminted, unowned, unnumbered
  across all 24 sites; v1.48 §51.5's option 3 stands.
- Does not withdraw v1.53 §56.4. **Its `storyteller.js` claim stands; its
  generalisation is qualified.**
- Does not read any further Rule 2 file. **61 sites remain unread and are not
  asserted clean.**
- Does not establish tenancy paths for `SceneAngle`, `SceneSetEpisode`,
  `StorytellerEcho`, `StorytellerMemory`, or `StoryThread`.
- Does not examine cascade behaviour on `SceneSet` or any other model.
- Does not assess the `templateMap` constants, or F-Franchise-1's scope.
- Does not amend XK-2's Cross-Keystone Register entry.
- Does not measure the reads surface; v1.51 §54.4's instrument question stands.
- Does not measure XK-2's ORM-surface extent.
- Does not propose or evaluate a remedy. **§57.7 bears on remedy shape and selects
  none.**
- Does not disposition any statement. **No file other than `worldEvents.js` is
  dispositioned.**
- Does not mint an FD, PE, or XK number.
- Does not lift any gate.
- Does not enumerate prod. **Prod remains FROZEN.**
- **No live database contact. No prod-box contact. No dev-box contact.**

---

## §11 Plan Version History (UPDATED)

| v1.54 | 2026-08-15 | **v1.53 §56.4's uniformity claim TESTED and does NOT generalise.** `sceneSetRoutes.js` complete under Rule 2 — **6 sites, 6 handlers, all instances**; shape now **24 sites / 23 handlers / 8 files**; Rule 2 remainder **61**. **Three distinct guard forms in one file** where `storyteller.js` had one across eight: bare `findByPk` → 404 → destroy (:447, :632, :1089, :2205, all on `SceneSet` which **carries `show_id`** — tenancy-on-model-unfetched); compound `findOne({ id, scene_set_id })` at :1006 checking **containment**; and **:1663 with no fetch at all**, its 404 produced by the delete's return value after the write attempted — the weakest structure recorded in this shape. **§57.4: `:1006` gets within one join of tenancy and stops** — the containment check is real and demonstrates the parent relationship was considered, terminating one property short of `SceneSet.show_id` on a model the same file fetches elsewhere. **§57.2: model layer checked first per v1.52 §55.6** — `SceneSet` carries `show_id`, `SceneAngle`/`ScenePlan`/`Scene`/`SceneSetEpisode` do not, with `SceneAngle.js`'s absence verified as a real negative by confirming the file exists; **the Scene family mirrors the Storyteller family exactly, both partitioned at the root only.** v1.52 §55.2's classification of `sceneStudioEpisodeRoutes.js:139` confirmed correct. **§57.5: two `force: true` hard deletes** (:632, :2205), and `:632`'s `POST /:id/analyze-image` writes `canonical_description`, `base_runway_prompt`, `scene_type` and `mood_tags` from an Anthropic Vision call then wipes and regenerates every angle — **a cross-tenant write to a column already on the register with three stale copies and no `visual_language` resync**; `aiRateLimiter` bounds spend but fires against the victim's data. **§57.7: v1.53 §56.4 is qualified, not withdrawn** — the codebase is **not uniformly missing a tenancy convention; it applies inconsistent partial guards**, which bears on remedy shape (enforcement rather than introduction) and converges with v1.51 §54.4's instrument question from a second direction; **no remedy proposed or evaluated.** Recorded unminted: a ten-entry hardcoded `templateMap` (JS-constants-as-canon, F-Franchise-1's migration class); dead in-process `router.handle()` re-entry at :2178 whose result is never used; `validateUUIDParam` present on all six routes here versus one of three in `episodes.js`. Mints no FD, no XK. No live DB contact. Prod FROZEN, untouched. §57 minted. Basis `42dae022`. |

## Register hygiene

- **Mints no FD**, consistent with F-Stats-1 practice v1.1–v1.53. Tail: **FD-61**.
  **XK tail: XK-2**, unchanged.
- Mints: **§57**.
- Closes: **nothing**.
- **Qualifies v1.53 §56.4** — its `storyteller.js` claim stands; the
  generalisation to other files does not hold.
- Extends: the shape's instance record to **24 sites / 23 handlers / 8 files**.
  `sceneSetRoutes.js` complete at 6. Still **unminted, unowned, unnumbered.**
- Records: the **third guard form** (§57.3); §57.4's one-join-short containment
  check; §57.2's root-only partitioning across two independent domains; §57.5's
  cross-tenant canon-write path; §57.6's three unminted observations.
- Confirms: v1.52 §55.2's `sceneStudioEpisodeRoutes.js:139` classification.
- Owes: tenancy paths for `SceneAngle`, `SceneSetEpisode`, and the three
  Storyteller models from v1.53; cascade behaviour on `SceneSet`.
- Carries: XK-2's owed amendments; **61 unread destructive sites**; the reads
  surface and v1.51 §54.4's instrument question; §35.5's classes 2–6, unminted and
  homing-owed; the class 2 candidate at `opportunityRoutes.js:258`; the F-Sec-3
  instance report at `wardrobe.js:1233`; the eleven-router collision surface and
  fail-open mount pattern; `feedPipelineRoutes.js`'s unexplained zero; the three
  unread write sites from v1.48; open items 22, 24, 6; all other items carried
  from v1.53. Open items 41 and 23 remain **CLOSED** per v1.43.
- Defers: all variants' homing; XK-2's ORM-surface extent, remedy and sequence
  position; classes 2–6's reach; §39.4 defect 1 and defect 3; §44.8; XK-1's
  remedy and population question.
- Forward-points: the `templateMap` constants to F-Franchise-1's migration class.
  Recorded, not adopted.
- Changes no unit disposition, no PR state, no gate. **The Cross-Keystone Register
  is not modified.**
- Does not evaluate any fix, does not lift any gate, does not enumerate prod.
- **No live database contact. No prod-box contact. No dev-box contact.** Prod
  remains FROZEN.
- Additive-supersede on v1.53; no destructive rewrite. v1.53's body is not
  modified; the qualification lives here.
- **Numeral disambiguation:** *XK-1 and XK-2 (Cross-Keystone Register)* are
  unrelated to FD-1/FD-2, §1/§2, or any open item 1/2. §57 is minted in v1.54;
  section numbers and their minting revision numbers do not correspond.
- FD-21 check: no closing keywords adjacent to `#N`.
- Ships WITH `[skip-automerge]` (doc-only PR).

## Forward Statement

v1.53 recorded a claim and named the file that would test it. **The test ran and
returned the narrower answer**, which is the outcome worth having: eight identical
omissions in `storyteller.js` do read as a convention never established, and six
sites in `sceneSetRoutes.js` show three different guard forms, so the reading does
not extend past the file it was drawn from.

**`:1006` is the reason the distinction matters.** That handler verifies the angle
belongs to the scene set before deleting it. Someone reasoned about the row's
parent, wrote the predicate, and stopped — one property short of
`SceneSet.show_id`, on a model the same file fetches in four other handlers.
**That is not an absent convention. That is a convention that terminates early.**

The difference bears on what a remedy would be. **Introducing a convention and
enforcing one are different pieces of work**, and this file argues for the second:
the reasoning is present and reaches the wrong stopping point, in a codebase where
`uiOverlayRoutes.js` scopes all twenty-nine of its statements correctly. **v1.51
§54.4 reached the same place from the reads surface — 509 sites that cannot be
hand-audited cannot be hand-patched.** Two independent lines of evidence now point
at enforcement rather than at patching, and **neither this revision nor that one
selects a remedy.**

**Sixty-one destructive sites remain unread.** Two files are complete. The
distance between "unexamined" and "clean" is still the only thing this register
exists to hold.

---

*Author: Claude, with JustAWomanInHerPrime (JAWIHP) / Evoni.*
*Date: 2026-08-15. Main at `42dae022` (#1027). Predecessor: v1.53.*
*Minted: §57. Completed: `sceneSetRoutes.js` under Rule 2, 6 sites. Qualified: v1.53 §56.4. Closed: nothing. Mints no FD, no XK. Tail: FD-61. XK tail: XK-2. [skip-automerge]*
