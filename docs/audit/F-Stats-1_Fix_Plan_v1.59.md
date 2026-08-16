# F-Stats-1 Fix Plan v1.59

*Additive-supersede on v1.58. Mints §62. Completes Rule 2's complement. Thirteen route files read at their destructive sites. Mints no FD, no XK.*

## What changed in v1.59

**Rule 2's complement is fully read.** The thirteen sites enumerated at v1.58 §61.5 are dispositioned: **seven instances, four excluded by domain, one out of shape, one false positive.** The complement stands at **78 sites, none unread and none carried.** Rule 2's remaining population is **19** — the v1.49 domain exclusions, which will not be read.

**Not one of the seven in-scope sites reaches tenancy. There are no clean sites in this pool.** v1.55 §58.4 found two verified-scoped sites in ten files; this pass found none in thirteen. §62.7 records what that does and does not establish.

**The shape stands at 40 sites, 39 handlers, 20 files**, still unminted. v1.48 §51.5 option 3 stands.

**Two further unauthenticated surfaces, both reported for F-AUTH-1 and neither assessed.** `authorNoteRoutes.js` declares `router.use(optionalAuth)` and mutates on POST, PUT and DELETE — **sub-form (a)**. `templateStudio.js` declares no auth anywhere across nine routes and is mounted bare at `src/app.js:883` — **sub-form (b)**, the same shape as v1.58 §61.8's `footage.js`. **Three Tier 0 surfaces have now been found by walking a Rule 2 list**, which is not what the list is for. §62.4.

**Six of the thirteen sites are `paranoid: false` hard deletes.** The complement is where the unrecoverable writes live, and v1.58 §61.6's consequence-class question is answered in the direction that makes it urgent rather than moot. §62.5.

**`Scene` is hard-deleted from three separate routes**, two of them with `force: true` — `episodes.js:239` (v1.49), `scriptParse.js:231` (here), and `footage.js:314` (v1.58) — none reaching tenancy. **`scriptParse.js:231` is `episodes.js:239` duplicated in a second file**, the operation v1.49 called the sharpest instance in either shape. §62.3.

**A probe defect in Rule 2's own instrument.** `engine.js:4690` is `req.destroy()` — an HTTP request-socket teardown in a timeout handler, not a database write. **The pattern `\.destroy\(` cannot distinguish a Sequelize model destroy from any other object's destroy method**, and the 91 has therefore always contained at least one non-destructive match. §62.8.

**Four models were found reaching tenancy through two or three untraced parents**, and a fifth reaches it through none at all. v1.58 recorded one such case as owed; this pass makes it a pattern. §62.6.

**Changes no total that is minted.** FD tail remains **FD-62**. XK tail remains **XK-3**. This revision mints no FD, no XK, no PE.

---

## §62 — Rule 2's complement, completed

### §62.1 The thirteen dispositions

| Site | Route | Model or table | Disposition |
|---|---|---|---|
| `memories/assistant.js:1690` | `DELETE /recycle-bin/:type/:id` | five tables, raw SQL | **instance** |
| `memories/core.js:474` | `POST /memories/:memoryId/dismiss` | `StorytellerMemory` | **instance** |
| `memories/engine.js:4690` | — | — | **false positive** (§62.8) |
| `eventGeneratorRoute.js:110` | `POST /generate-events` | `world_events`, raw SQL | **instance** |
| `sceneLinks.js:85` | `DELETE /:id` | `SceneFootageLink` | **instance** |
| `calendarRoutes.js:247` | `DELETE /events/:id` | `StoryCalendarEvent` | **instance** |
| `scriptAnalysis.js:73` | `POST /:scriptId/analyze` | `ScriptMetadata` | **instance** |
| `scriptParse.js:231` | `POST /:id/apply-scene-plan` | `Scene`, `force: true` | **instance** |
| `authorNoteRoutes.js:113` | `DELETE /:id` | `AuthorNote` | **out of shape** (§62.2) |
| `pageContent.js:54` | `DELETE /:pageName/:constantKey` | `PageContent` | **excluded by domain** |
| `feedRelationshipRoutes.js:103` | `DELETE /:id` | `FeedProfileRelationship` | **excluded by domain** |
| `templateStudio.js:368` | `DELETE /:id` | `template_studio`, raw SQL | **excluded by domain** |
| `templates.js:168` | `DELETE /:id` | `EpisodeTemplate` | **excluded by domain** |

**Seven instances, four excluded, one out of shape, one false positive.** Shape extends to **40 sites / 39 handlers / 20 files**.

**The four domain exclusions are not cleared.** `page_content` is a global config keyspace addressed by `page_name` and `constant_key`. `feed_profile_relationships` joins two `SocialProfile` endpoints, and **v1.55 §58.5 already established that `SocialProfile` and siblings carry no `show_id` while `FeedPost` does** — this is that same boundary reached from the relationship side. `template_studio` and `episode_templates` carry no tenant term in any of their routes: `git grep -n "show_id" -- "src/routes/templateStudio.js" "src/routes/templates.js"` returns nothing at all.

### §62.2 `authorNoteRoutes.js:113` — out of shape, and a different absence

`AuthorNote` declares `tableName: 'author_notes'`, `paranoid: false`, **no `show_id`, and no `belongsTo` of any kind.**

**The shape's variants all describe a tenancy path that exists and is not taken** — on the model unfetched, or at one, two or three joins. **`author_notes` has no path at all.** There is no depth to record. Classifying it as a no-tenant-column instance would assert a reachable tenancy that the schema does not provide.

**It belongs to the modelless-tables thread at v1.43 §46.2**, and is recorded there rather than in the shape.

**Separately, it is an unauthenticated hard delete.** See §62.4.

### §62.3 The seven instances

**`memories/assistant.js:1690` is the sharpest site in this pool.**

```
DELETE FROM "${table}" WHERE id = :id AND deleted_at IS NOT NULL
```

`DELETE /recycle-bin/:type/:id`, `requireAuth`. **The injection concern is closed**: `tableMap` at `:1677` is a five-key whitelist, unmapped types 400 at `:1686`, and `id` is bound through `replacements`. **The tenancy concern is not.** The predicate carries `id` and a state check. Any authenticated caller may permanently destroy any soft-deleted row of five types by id — `storyteller_books`, `storyteller_chapters`, `storyteller_lines`, `registry_characters`, `continuity_beats`.

**This is the one route in the register whose purpose is to empty the recovery layer.** Every other site's paranoid flag is what makes recovery possible; this handler exists to remove it. **Three of its five tables are `storyteller.js`'s models** — the file v1.53 read in full and found uniformly unscoped. Same tables, second router, same absence.

**`deleted_at IS NOT NULL` is v1.53 §56.3's shape in a new form.** It establishes that the row is in a recoverable state. It answers no question about entitlement. **An existence check, a state check and an access check are structurally identical and answer different questions** — third independent arrival.

**`memories/core.js:474` reasons carefully about the wrong thing.** `POST /memories/:memoryId/dismiss` fetches `StorytellerMemory` by caller-supplied id, and at `:468` refuses with 409 if `memory.confirmed`, explaining that confirmed memories are part of the character record. **Someone identified what makes a row protected and wrote the reason into the response body. The protection is against destroying the wrong kind of row. There is no check on whose row it is.** Fourth independent arrival at v1.55 §58.3's observation.

**`StorytellerMemory` is `paranoid: false`** with a source comment confirming no `deleted_at` column, so this is a hard delete on canon. **v1.53 §56.6 already recorded the other route into this table** — `storyteller.js:1378`, `PATCH /memories/:id/reject`, also a hard destroy. **Reject and dismiss are the same operation under different names in different routers, both unscoped.**

**The tenancy path v1.53 left unestablished is now partly established.** `StorytellerMemory.belongsTo(StorytellerLine)` gives `StorytellerMemory -> StorytellerLine -> StorytellerChapter -> StorytellerBook.show_id`, **three joins, the deepest recorded.** A second association to `RegistryCharacter` is **guarded by `if (models.RegistryCharacter)`** and documented as nullable pre-assignment. See §62.6.

**`eventGeneratorRoute.js:110` is v1.55 §58.3's fourth sub-form, and the most consequential instance of it.**

```
DELETE FROM world_events WHERE show_id = :show_id
```

**The predicate carries the tenant term and the term is caller-supplied.** Line 26: `const { show_id, replace_existing = false } = req.body`. Presence-validated at `:28`, entitlement never. On `replace_existing: true` the handler deletes a named show's entire event ledger by raw SQL and bulk-inserts Claude output in its place, with `JSON.parse` as sole validation.

**This passes XK-2's test and is defective anyway** — v1.57 §60.4's decisive test, reached from a new direction and by a different keystone's lens.

Three things distinguish it from the `/generate` handlers at v1.55 §58.3. **`world_events` is a shared ledger rather than a leaf catalogue.** The delete is **raw SQL**, bypassing whatever paranoid behaviour `WorldEvent` declares. And the 409 guard at `:46` refuses when twenty or more events exist, telling the caller how to override — **reasoning about accidental overwrite and not at all about ownership**, fifth arrival. `aiRateLimiter` bounds spend and fires against the victim's ledger, §57.5's phrasing applying again.

**`scriptParse.js:231` is `episodes.js:239` duplicated in a second file.**

```
await Scene.destroy({ where: { episode_id: id }, force: true });
```

`POST /:id/apply-scene-plan`, `requireAuth`, `id` the caller-supplied episode. **`force: true` bypasses paranoid**, so no `deleted_at` survives. The episode is fetched at `:189` and its tenancy never consulted — **v1.57 §57.4's one-join-short shape**: the parent relationship is reached and not used. Recorded also: `:184`'s `models.Scene || models.EpisodeScene` fallback, defensive coding of the migration-drift family.

**`scriptAnalysis.js:73` is `sceneSetRoutes.js:632`'s shape confirmed in a second file.** `ScriptMetadata.destroy({ where: { script_id: scriptId } })` inside `POST /:scriptId/analyze`, then rebuild from a Claude call. **The script object was fetched at `:67`** — the handler holds it and reads `script.content` — **and its tenancy is not consulted.** `ScriptMetadata` is `paranoid: false`. The delete at `:73` and the `Promise.all` of creates at `:78` are **atomic around nothing**: a failed regeneration leaves the metadata gone.

**`sceneLinks.js:85` and `calendarRoutes.js:247` are the canonical form** — `findByPk` on a caller-supplied id, 404, destroy. `SceneFootageLink` is `paranoid: false` with parents `Scene` (two joins) and `ScriptMetadata` (untraced). `StoryCalendarEvent` is `paranoid: false` with three parents and no `show_id`.

**`calendarRoutes.js:247` sits on the unreconciled calendar-to-world-events boundary.** `story_calendar_events` spawns `world_events` at `:503` and `:625`, and `source_calendar_event_id` is a one-way pointer set at spawn. **Deleting a calendar event may orphan spawned world events with no detection** — and `eventGeneratorRoute.js:110` wipes the other end of that same pair. **Both ends of an unreconciled relationship are in this pool, and neither is scoped.**

### §62.4 Two further unauthenticated surfaces

**Reported for F-AUTH-1. Not assessed, and no F-AUTH-1 disposition is proposed.**

**`authorNoteRoutes.js:18` declares `router.use(optionalAuth)` and nothing else.** POST at `:60`, PUT at `:84` and DELETE at `:108` all mutate. **This is sub-form (a)** — `optionalAuth` on write routes, which lets unauthenticated and invalid-token requests through. `DELETE /:id` hard-deletes `author_notes` rows by caller-supplied id with no token required.

**`templateStudio.js` declares no auth middleware anywhere.** Nine routes — `:28`, `:109`, `:143`, `:223`, `:343`, `:390`, `:470`, `:521`, `:572` — no `router.use`, no per-handler middleware. **`src/app.js:883` mounts it bare**: `app.use('/api/v1/template-studio', templateStudioRoutes)`. **This is sub-form (b)**, the same shape as v1.58 §61.8's `footage.js`, established the same way.

**Recorded at `templateStudio.js`:** the `:360` guard 403s unless status is `DRAFT`, **reasoning about lifecycle state and not about who is asking** — the same structure as `core.js:468` and `eventGeneratorRoute.js:46`. And `src/app.js:547` installs a 500-returning stub if the require fails, **a fail-open mount variant** joining the surface v1.55 carries.

**A dialect observation.** `templateStudio.js` uses `$1` positional binding with a `bind` array, where every other raw query read in this register uses Sequelize `:named` replacements. Recorded unminted; the cause is not established.

**Three Tier 0 surfaces have now been found by walking a Rule 2 list.** F-Stats-1's instrument is a destructive-write probe. It is not an auth probe, and it has now produced three sub-form findings in twenty-three files. **What that says about coverage elsewhere is not established here and is not asserted.**

### §62.5 The consequence class, answered

v1.58 §61.6 recorded that `layers.js:223` and `footage.js:314` are paranoid soft-deletes, and asked whether recoverable writes belong in a rule chosen for unrecoverable ones. **This pass answers it in the direction that makes the question urgent.**

**Six of the thirteen sites are `paranoid: false`:** `StorytellerMemory`, `SceneFootageLink`, `AuthorNote`, `StoryCalendarEvent`, `ScriptMetadata`, `FeedProfileRelationship`. A seventh, `scriptParse.js:231`, uses `force: true` to bypass paranoid on a model that has it. An eighth, `assistant.js:1690`, exists to permanently remove rows that paranoid preserved.

**The complement is where the unrecoverable writes live.** v1.49 §52.1 chose Rule 2 because a wrong-tenant delete is unrecoverable in a way a read is not, and the complement bears that out at **eight of the thirteen sites read, six of them in-scope instances**.

**And recoverability remains a property of the route, not the row** — v1.58 §61.6's finding, reinforced. `Scene` is `paranoid: true` and is hard-deleted from two routes with `force: true`.

**The register still has not ruled** on whether the recoverable minority belong in the shape. This revision does not rule either; it records that the population is mostly unrecoverable and the question is smaller than it looked.

### §62.6 Untraced parents — a pattern, not a series of gaps

v1.58 §61.6 recorded `LayerAsset.belongsTo(Asset)` as a second parent that was not traced, and listed it as owed. **Four further cases appeared in this pass:**

| Model | Parents | Traced |
|---|---|---|
| `StorytellerMemory` | `StorytellerLine`, `RegistryCharacter` (conditional, nullable) | first only |
| `SceneFootageLink` | `Scene`, `ScriptMetadata` | first only |
| `StoryCalendarEvent` | `StoryClockMarker`, `StorytellerLine`, `WorldLocation` | none |
| `FeedProfileRelationship` | `SocialProfile` x2, `StoryClockMarker` | domain-excluded before tracing |

**Join-tier models in this codebase reach tenancy through two or three parents of differing depth, and no revision has traced any of them.** Every depth recorded in this register is the depth of the first association read. **Where a second parent reaches tenancy by a shorter path, the recorded depth overstates the distance; where it reaches none, the recorded depth is optimistic.** Neither direction has been measured.

**`StorytellerMemory`'s second association is guarded by `if (models.RegistryCharacter)`** — a conditional association that exists only if that model loaded. **A conditional association is not a schema fact**, and whether it is wired at runtime is unread.

**`ScriptMetadata` declares no `belongsTo` at all**, yet `SceneFootageLink.belongsTo(models.ScriptMetadata)` exists. **The relation is one-directional**: the child names the parent, the parent names no child and no `Script`. `script_id` is a bare column reaching tenancy by naming convention, the same posture v1.58 recorded for `Scene`.

**A model-layer naming defect, recorded unminted.** `SceneFootageLink.belongsTo(models.Scene, { foreignKey: 'scene_id', as: 'footage' })` — on a model named `SceneFootageLink`, the association to `Scene` is aliased `footage`, under a source comment reading *Link to uploaded footage*. **Either the alias is wrong or the comment belongs to a different association.** Any consumer eager-loading `include: 'footage'` receives a `Scene`.

### §62.7 What zero clean sites establishes, and what it does not

**Seven in-scope sites, none reaching tenancy.** v1.55 §58.4 found two verified-scoped sites in ten files and observed that every clean destroy took its tenant from the route path — a correlation it **raised and dropped**, because `arcRoutes.js:158` falsified it as a general rule.

**This pass is consistent with that correlation and does not revive it.** None of the seven takes a tenant from the route path, because **none of them has a tenant in the route path to take** — that is what places them in the complement. **The complement is defined by the absence of the thing that correlates with correctness.** A pass over routes selected for not carrying `:showId` finding no route that scopes by `:showId` is close to circular, and is recorded as such.

**What it does establish is narrower and still worth having.** Thirteen files, seven in-scope sites, seven unscoped: **no handler in the complement compensates for the missing route parameter by any other means.** No fetch of a parent, no join, no derived lookup, no middleware. The absence is not merely of the route parameter but of any substitute for it. **That is a fact about handler authorship, not about route design.**

**It converges with XK-3 from a third direction.** v1.57 established that show-scoped authorization is not implementable against current schema. This pass establishes that in the complement, it is not attempted either. **Neither observation causes the other**, and the register should not read the second as evidence for the first.

### §62.8 A defect in Rule 2's instrument

**`memories/engine.js:4690` is not a destructive site.**

```
req.on('timeout', () => { req.destroy(); reject(new Error('Internal call timeout')); });
```

`req.destroy()` tears down an HTTP request socket. **It touches no database.** The probe pattern `\.destroy\(` matches any object's destroy method, and Node's stream and socket APIs use that name throughout.

**The 91 has therefore always contained at least one non-destructive match**, and the true count of destructive sites in `src/routes/` is at most 90. **This site leaves the population.**

**Whether other false positives sit in the already-read files is unmeasured.** Every file read from v1.49 onward was read at its sites, so a false positive would have been caught at reading time in those files — but **no revision recorded looking for the class**, and a site dismissed in passing may not have been written down. **The question is open and is not asserted either way.**

**Recorded as a defect in the instrument rather than an error in any revision.** v1.49 §52.1 stated Rule 2's cost as missing every cross-tenant read. **It did not state that the probe also over-collects**, and that is now on the record.

### §62.9 Recorded, unminted

Surfaced while reading. **Not adopted, not minted, not admitted.**

- **A seven-router mount stack at `/api/v1/memories`.** `src/app.js` mounts `memoriesRoutes` (:984), `scriptFromBook` (:993), `storyEvaluationRoutes` (:1002), `sceneProposeRoute` (:1038), `characterGrowthRoute` (:1047), `episodeOrchestrationRoute` (:1056) and `eventGeneratorRoute` (:1065) on the same path, resolving by registration order. **The eleven-router collision surface, in a second location.** `eventGeneratorRoute.js` is itself one of this pass's instances.
- **`CATEGORY_TO_DREAM_CITY` at `calendarRoutes.js:47`** — nine categories mapped to DREAM city names as a hardcoded JS object. **A fourth location for DREAM city constants**, joining the three already recorded. F-Franchise-1's migration class.
- **`getModels(req)` is not request-scoped.** `calendarRoutes.js:42` returns `req.app.get('models') || require('../models')`. **The `req` parameter selects a model registry, not a tenant.** Recorded as a *cleared* question rather than a finding: the idiom appears in ten or more route files and reads as request-scoped model resolution. It is not, and any future reader will ask.
- **Two `getModels` signatures across the codebase** — `getModels(req)` and `getModels()`, some `async`, in `admin.js`, `authorNoteRoutes.js`, `calendarRoutes.js`, `careerGoals.js`, `characterCrossingRoutes.js`, `characterGenerationRoutes.js`, `characterRegistry.js`, `continuityEngine.js`, `entanglementRoutes.js`, `evaluation.js` and others. Not assessed.
- **`templates.js` is the only file in this pool with an admin tier**, and it uses `authorize(['ADMIN'])` uppercase. **v1.57 §60.6 recorded the `admin` versus `ADMIN` casing split against a case-sensitive `.includes()`.** This file is where that split has the most consequence, because it is the only gate of its kind here. Reported for F-AUTH-1; no claim made.

### §62.10 Method notes

**A count published ahead of its reconciliation, for the third time.** This pass was summarised as "thirteen files read, thirteen sites dispositioned" when **eleven were settled**. `templateStudio.js:368` had been ruled on its auth surface with tenancy explicitly unresolved, and was then counted as an instance; `templates.js:168` was never opened at all, its file noted for an admin tier and passed over. **One site was double-counted across two rows to reach thirteen.**

**Same failure mode as v1.53 §56.5 and v1.58 §61.10** — an arithmetic claim published before the reconciliation that supports it. **Third occurrence, and the first where the error was in a summary rather than a probe.** Caught by recounting the disposition table against the enumeration. **The recount is the control**, and it has now worked three times.

**A probe pattern widened on a prior lesson, and it paid.** v1.58 §61.8's `footage.js` finding required a second grep because the first pattern omitted `router.use`. Every probe in this pass included it from the start — which is how `authorNoteRoutes.js:18`'s `router.use(optionalAuth)` was found. **A handler-declaration grep would have reported that file as carrying no middleware**, which is true and misleading: the finding is more specific and more serious than the absence would have suggested.

**Read method, stated precisely.** The thirteen files were read at their destructive sites, their route declarations, their middleware, and their models. **None was read in full.** This is the same depth as v1.58 and narrower than v1.53 and v1.54 performed on `storyteller.js` and `sceneSetRoutes.js`.

---

## What this revision does not do

- **Mints no FD.** FD tail remains **FD-62**. Mints no XK; tail remains **XK-3**. Mints no PE.
- Does not mint the shape. **v1.48 §51.5 option 3 stands** across all 40 sites.
- Does not read the **19 sites excluded on principle at v1.49**; they remain in the population, unread and uncleared.
- Does not survey the **reads slice**, owed since v1.49 §52.6 and untouched by this pass.
- Does not assess F-AUTH-1. §62.4's two surfaces are reports.
- Does not measure whether other false positives sit in the already-read files (§62.8).
- Does not trace any second or third parent (§62.6), and does not establish nullability on any foreign key.
- Does not establish whether `if (models.RegistryCharacter)` is satisfied at runtime.
- Does not rule on whether recoverable soft-deletes belong in the shape (§62.5).
- Does not revive v1.55 §58.4's dropped correlation (§62.7).
- Does not amend XK-1, XK-2 or XK-3. Their bodies are untouched.
- Does not disposition any statement or any file, and does not lift any gate.
- Does not enumerate prod. **Prod remains FROZEN.**
- **No live database contact. No prod-box contact. No dev-box contact.**

---

## §11 Plan Version History (UPDATED)

| v1.59 | 2026-08-16 | **RULE 2'S COMPLEMENT IS FULLY READ — 78 sites, none unread, none carried.** The thirteen sites enumerated at v1.58 §61.5 dispositioned: **seven instances, four excluded by domain, one out of shape, one false positive.** Remaining population **19**, the v1.49 exclusions, which will not be read. **Shape extends to 40 sites / 39 handlers / 20 files**, still unminted. **§62.7: not one of the seven in-scope sites reaches tenancy — no clean sites in this pool** — but the finding is recorded with its bound: the complement is *defined* by not carrying `:showId`, and v1.55 §58.4's dropped correlation observed that clean destroys take their tenant from the route path, so a pass over routes lacking that parameter finding none that use it is **close to circular and is recorded as such**. **What it does establish is narrower: no handler in the complement compensates by any other means** — no parent fetch, no join, no derived lookup, no middleware; **an absence of any substitute, which is a fact about authorship rather than route design.** Converges with XK-3 from a third direction and **is not evidence for it**. **§62.3 seven instances:** `assistant.js:1690` (`DELETE /recycle-bin/:type/:id`) is **the sharpest** — five whitelisted tables, injection closed by `tableMap` and bound `id`, **tenancy absent**; three of its five tables are `storyteller.js`'s, and **this is the one route whose purpose is emptying the recovery layer**; `deleted_at IS NOT NULL` is a state check, **third arrival at §56.3**. `core.js:474` (`POST /memories/:memoryId/dismiss`) **409s on `memory.confirmed` with a written justification and never asks whose row it is** — fourth arrival at §58.3; `StorytellerMemory` is `paranoid: false`, and **v1.53 §56.6's `storyteller.js:1378` reject is the same operation under a different name in a different router**, both unscoped; **the path v1.53 left unestablished is now three joins** via `StorytellerLine`. `eventGeneratorRoute.js:110` is **§58.3's fourth sub-form and the most consequential instance of it** — `show_id` from `req.body` at `:26`, presence-checked only, `DELETE FROM world_events WHERE show_id = :show_id` in **raw SQL** on a **shared ledger**, then bulk-insert of Claude output with `JSON.parse` as sole validation; **passes XK-2's test and is defective anyway**, §60.4's decisive test reached from a new direction; the `:46` 409 reasons about overwrite and not ownership, **fifth arrival**. `scriptParse.js:231` is **`episodes.js:239` duplicated in a second file** — `Scene.destroy({ where: { episode_id: id }, force: true })`, episode fetched at `:189` and tenancy never consulted, **§57.4's one-join-short shape**. `scriptAnalysis.js:73` is **`sceneSetRoutes.js:632`'s shape confirmed** — script fetched at `:67`, tenancy unconsulted, delete and rebuild **atomic around nothing**. `sceneLinks.js:85` and `calendarRoutes.js:247` are canonical fetch-404-destroy; **`calendarRoutes.js:247` sits on the unreconciled calendar-to-world-events boundary**, and **both ends of that pair are in this pool and neither is scoped**. **§62.2: `authorNoteRoutes.js:113` is OUT OF SHAPE** — `AuthorNote` has no `show_id` and **no `belongsTo` of any kind**, so there is no tenancy path and no depth to record; classifying it as a no-tenant-column instance would assert a reachable tenancy the schema does not provide. Modelless-tables thread, v1.43 §46.2. **§62.4: two further unauthenticated surfaces, reported for F-AUTH-1 and not assessed** — `authorNoteRoutes.js:18` `router.use(optionalAuth)` with POST/PUT/DELETE mutating, **sub-form (a)**; `templateStudio.js` **no auth anywhere across nine routes** and **`src/app.js:883` mounts it bare**, **sub-form (b)**, same shape as v1.58 §61.8. **Three Tier 0 surfaces now found by walking a Rule 2 list in twenty-three files**; what that implies about coverage elsewhere is **not asserted**. Recorded: `templateStudio.js:360` 403s on lifecycle state and not on who is asking; `src/app.js:547` installs a 500-stub on require failure, **a fail-open mount variant**; and the file uses **`$1` positional binding** where every other raw query read uses `:named`, cause not established. **§62.5: the consequence class is answered** — **six of thirteen are `paranoid: false`**, a seventh uses `force: true`, an eighth exists to empty the recovery layer; **the complement is where the unrecoverable writes live**, and **recoverability remains a property of the route rather than the row**. **§62.6: untraced parents are a pattern, not gaps** — `StorytellerMemory`, `SceneFootageLink`, `StoryCalendarEvent` and `FeedProfileRelationship` each reach tenancy through two or three parents, **and every depth in this register is the depth of the first association read**; `StorytellerMemory`'s second is **guarded by `if (models.RegistryCharacter)`**, a conditional association that is not a schema fact; **`ScriptMetadata` declares no `belongsTo` at all** while `SceneFootageLink` names it as a parent, a **one-directional relation**; and `SceneFootageLink.belongsTo(models.Scene, { as: 'footage' })` **aliases `Scene` as `footage`**, so `include: 'footage'` returns a `Scene`. **§62.8: a defect in Rule 2's instrument** — **`engine.js:4690` is `req.destroy()`, an HTTP socket teardown, not a database write**; `\.destroy\(` matches any object's destroy method, **the 91 has always contained at least one non-destructive match**, the true count is at most 90, and **whether other false positives sit in already-read files is unmeasured and not asserted**. v1.49 §52.1 stated Rule 2's cost as missing reads; **it did not state that the probe also over-collects.** **§62.9 recorded, unminted:** a **seven-router mount stack at `/api/v1/memories`** resolving by registration order; **`CATEGORY_TO_DREAM_CITY` at `calendarRoutes.js:47`, a fourth DREAM-city constant location**; **`getModels(req)` is NOT request-scoped** — `req.app.get('models') || require('../models')`, recorded as a **cleared question** because the idiom appears in ten-plus files and reads as tenancy-relevant; **two `getModels` signatures** across the codebase; and **`templates.js` is the only file in this pool with an admin tier**, using `authorize(['ADMIN'])` uppercase against v1.57 §60.6's **case-sensitive casing split**. **§62.10 method notes:** **a count published ahead of its reconciliation for the third time** — this pass was summarised as thirteen dispositioned when eleven were, `templateStudio.js:368` counted as an instance while its tenancy was explicitly unresolved and `templates.js:168` never opened, **one site double-counted across two rows**; same failure mode as v1.53 §56.5 and v1.58 §61.10, **first occurrence in a summary rather than a probe**, caught by recounting the table against the enumeration — **the recount is the control and has now worked three times**; and **a probe pattern widened on a prior lesson paid off** — including `router.use` from the start is what found `authorNoteRoutes.js:18`, which a handler-declaration grep would have reported as carrying no middleware, **true and misleading**. **Read method: thirteen files read at their destructive sites, route declarations, middleware and models; none read in full.** Mints no FD, no XK, no PE. No live DB contact. Prod FROZEN, untouched. §62 minted. Basis `5f7ee6b4`. |

## Register hygiene

- **Completes Rule 2's complement.** 78 sites, all dispositioned. Remaining population **19**, being v1.49's domain exclusions, which are **excluded and not cleared** and will not be read.
- **Mints no FD.** Tail: **FD-62**. Mints no XK; tail **XK-3**. Mints no PE.
- Mints: **§62**.
- Closes: **nothing**. Completion of a slice is not closure of a finding.
- Extends: the shape's instance record to **40 sites / 39 handlers / 20 files**. Still **unminted, unowned, unnumbered**; v1.48 §51.5 option 3 stands.
- **Removes one site from the population:** `memories/engine.js:4690`, a false positive (§62.8). The complement's true site count is at most 77.
- Records: the thirteen dispositions (§62.1); `author_notes` as out-of-shape rather than an instance (§62.2); seven instances with their variants (§62.3); two unauthenticated surfaces (§62.4); the consequence-class answer (§62.5); untraced parents as a pattern (§62.6); the bound on zero-clean (§62.7); the instrument defect (§62.8); five unminted observations (§62.9); two method notes (§62.10).
- **Discharged:** v1.53's owed tenancy path for `StorytellerMemory`, now three joins via `StorytellerLine` (§62.3); v1.58's owed question on whether `getModels(req)` scopes anything, answered no (§62.9).
- **Owes:** every second and third parent named at §62.6; nullability on all foreign keys, unread throughout; whether `if (models.RegistryCharacter)` holds at runtime; whether other `\.destroy\(` false positives sit in already-read files; a register ruling on exclusion accounting, carried from v1.58 §61.4; a register ruling on the recoverable minority (§62.5); `footage.js`'s `router.get` handlers, carried from v1.58; whether `franchiseBrainRoutes.js:54`'s `sync()` is among PE #62's enumerated sites, carried from v1.58.
- Carries forward, unchanged from v1.58: the shape instances, unminted; **the reads slice, owed since v1.49 §52.6**; XK-3's remedy and Gate 3's measurement; FD-62's remedy, unevaluated; XK-2's owed amendments; v1.51 §54.4's instrument question; §35.5's classes 2-6, unminted and homing-owed; the class 2 candidate at `opportunityRoutes.js:258`; the F-Sec-3 instance report at `wardrobe.js:1233`; the eleven-router collision surface and fail-open mount pattern, **both extended by §62.4 and §62.9**; `feedPipelineRoutes.js`'s unexplained zero; the three unread write sites from v1.48; tenancy paths owed from v1.53 and v1.54; open items 22, 24, 6; `compositions.js:896`'s `authenticateJWT`, reported for F-AUTH-1; `SEED_WARDROBE` as JS-constants-as-canon; §60.6's five observations and their homing; §60.7's unexplained pathspec defect; all other items carried from v1.58. Open items 41 and 23 remain **CLOSED** per v1.43.
- Defers: everything deferred at v1.58, unchanged.
- Forward-points: nothing new.
- Changes no unit disposition, no PR state, no gate.
- Does not evaluate any fix, does not lift any gate, does not enumerate prod.
- **No live database contact. No prod-box contact. No dev-box contact.** Prod remains FROZEN.
- Additive-supersede on v1.58; no destructive rewrite.
- **Numeral disambiguation:** *§62* is unrelated to **FD-62**, PE #62, or open item 62 — and FD-62 and PE #62 are themselves different items, both live in this document. The **19** remaining sites are v1.49's exclusion set, **not** v1.55's identically-sized set; v1.58 §61.4 records that collision and it applies here. **Sub-form (a)** and **sub-form (b)** are F-AUTH-1's; **the fourth sub-form** at §58.3 is F-Stats-1's and unrelated.
- FD-21 check: no closing keywords adjacent to `#N`.
- Ships WITH `[skip-automerge]` (doc-only PR).

## Forward Statement

**The slice is finished and nothing is closed.** Seventy-eight sites, every one dispositioned, and the shape they belong to is still unminted, unowned and unnumbered. **Completing a survey is not the same as owning what it found** — v1.48 §51.5 option 3 has stood for eleven revisions and stands here.

**Seven sites, none scoped, and the honest reading is narrower than the number suggests.** The complement is defined by the absence of `:showId`, and clean destroys correlate with taking a tenant from the route path. **A pass over routes that lack the parameter, finding none that use it, is close to circular.** What survives that deflation is the part worth keeping: **no handler in the complement substitutes anything for the missing parameter.** Not a parent fetch, not a join, not a lookup. The absence is total, and it is a fact about how these handlers were written rather than about how their routes were designed.

**Three unauthenticated surfaces came out of a probe that was not looking for them.** `footage.js`, `authorNoteRoutes.js`, `templateStudio.js` — no middleware, permissive middleware, no middleware. F-Stats-1 owns none of that surface and reported all three. **An instrument that keeps returning findings outside its own class is telling you something about coverage**, and this register is not the place to say what.

**The instrument itself is imperfect, and that is now on the record.** `\.destroy\(` matched an HTTP socket teardown for ten revisions. v1.49 stated what Rule 2 misses and did not state that it also over-collects. **A probe's stated cost was incomplete, and the correction cost one line of reading.**

**Nineteen sites remain and will not be read.** They are excluded on principle, not cleared, and the register has still not chosen whether excluded sites leave the population. **That question is now the only arithmetic left in Rule 2**, and it has been owed since v1.58.

---

*Author: Claude, with JustAWomanInHerPrime (JAWIHP) / Evoni.*
*Date: 2026-08-16. Main at `5f7ee6b4` (#1031). Predecessor: v1.58 (PR #1032, open).*
*Minted: §62. Completed: Rule 2's complement, 78 sites. Established: two further unauthenticated surfaces, reported for F-AUTH-1. Read: thirteen route files at their destructive sites, nine model files. Closed: nothing. Mints no FD, no XK, no PE. Tail: FD-62. XK tail: XK-3. [skip-automerge]*
