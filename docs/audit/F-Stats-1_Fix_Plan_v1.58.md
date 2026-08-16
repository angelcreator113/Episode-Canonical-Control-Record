# F-Stats-1 Fix Plan v1.58

*Additive-supersede on v1.57. Mints §61. Corrects the Rule 2 remainder. Three route files read at their destructive sites. Mints no FD, no XK.*

## What changed in v1.58

**Rule 2's remainder was wrong, and it was wrong low.** The carried figure of **34** over-subtracted by three: v1.55 resolved 27 sites and decremented a complement-based counter by 27, but **three of those 27 were `:showId`-pool sites, not complement sites**. The corrected remainder at v1.57 is **37**. §61.3 records the error and its derivation.

**The full Rule 2 partition was re-derived live and holds.** Probe `\.destroy\(|DELETE FROM` over `src/routes/*.js` returns **91 sites across 39 files** at `5f7ee6b4`, unchanged from v1.49's figures at `8c7d74af`. The `:showId` cohort is **22 files carrying 13 sites**; the complement is **78**. Every figure in v1.49 §52 reconciles against the live tree.

**The remainder series is verified step by step from v1.49 to v1.57** — 75, 75, 75, 74, 67, 61, 34, 34, 34 — with every decrement traced to a named revision and a stated read. §61.2. **No revision restated a figure it had not earned.** The register's running arithmetic is sound; only the v1.55 boundary crossing is defective.

**The unread population is enumerated by name for the first time.** Eighteen sites across sixteen files at v1.57; **thirteen sites across thirteen files** after this revision. §61.5. The remainder counter stands at **32** and decomposes as **19 permanently excluded plus 13 readable**.

**Three instances read.** `layers.js:223`, `layers.js:407`, `footage.js:314` — all the no-tenant-column variant of v1.52 §55.3, at join depths one, two and one. The shape's instance record extends to **33 sites, 32 handlers, 13 files**, still unminted. §61.6.

**`src/routes/footage.js` is an unauthenticated surface.** The router contains **no auth middleware of any name and no `router.use` at all**, and `src/app.js:833` mounts it bare. Five mutating handlers — a video upload and two deletes among them — are reachable with no token. **This is F-AUTH-1 sub-form (b) on a live mount, established by three greps against `origin/main` and reported for F-AUTH-1's disposition.** §61.8.

**That is the most severe item in this revision**, and it is not a Rule 2 finding. F-Stats-1's lens reached it only by walking an enumerated list of files nobody had opened.

**A second register-integrity finding: exclusion accounting is inconsistent between v1.49 and v1.55.** v1.49 excluded nineteen sites on principle and left them **in** the population. v1.55 excluded nineteen sites by domain and took them **out**. Same operation, opposite treatment, same register. §61.4.

**Changes no total that is minted.** FD tail remains **FD-62**. XK tail remains **XK-3**. This revision mints no FD, no XK, no PE.

---

## §61 — Rule 2's population, reconciled

### §61.1 The partition, re-derived live

v1.49 §52 established Rule 2 at basis `8c7d74af`. This revision re-ran the probe at `5f7ee6b4` and obtained identical figures:

| Quantity | v1.49 | Live at `5f7ee6b4` |
|---|---|---|
| Sites in `src/routes/` | 91 | **91** |
| Files bearing `:showId` | 22 | **22** |
| Sites in the `:showId` cohort | 13 | **13** |
| Complement | 78 | **78** |

**The population is stable across seven revisions of drift.** The probe is re-derivable and Rule 2 has a method, not merely a number.

**The `:showId` intersection, computed rather than assumed.** Nine files carry both `:showId` and destructive sites: `careerGoals.js` 1, `feedPostRoutes.js` 1, `opportunityRoutes.js` 1, `phoneMissionRoutes.js` 1, `shows.js` 2, `uiOverlayRoutes.js` 1, `wardrobe.js` 1, `wardrobeEventRoutes.js` 1, `worldEvents.js` 4 — thirteen sites. This intersection is what makes §61.3's error visible.

**`git grep -c` counts matching lines, not occurrences.** A line bearing two calls counts once. v1.49 used the same probe form, so the reconciliation is consistent throughout; but **91 is a floor on the true site count, not a ceiling.** Recorded so that any future hand count reconciling against it knows what it is measuring.

### §61.2 The remainder series, verified step by step

| Revision | Remainder | Step | Basis for the step |
|---|---|---|---|
| v1.49 | 75 | 78 − 3 | `episodes.js` read, 3 sites |
| v1.50 | 75 | — | carried |
| v1.51 | 75 | — | carried |
| v1.52 | 74 | −8 +7 | `storyteller.js` removed at 8; its 7 unread returned to pool |
| v1.53 | 67 | −7 | `storyteller.js` completed, 7 sites read |
| v1.54 | 61 | −6 | `sceneSetRoutes.js` completed, 6 sites |
| v1.55 | 34 | −27 | ten files, 6 instances / 2 clean / 19 excluded |
| v1.56 | 34 | — | carried |
| v1.57 | 34 | — | carried |

**v1.52's `+7` is not a withdrawal.** The revision removed `storyteller.js` from the pool at its full count of eight and returned the seven it had not read, enumerating them by line at §55.5. Bookkeeping precision. **No read was ever reversed anywhere in the series**, and no downstream figure inherits withdrawal risk.

**Every decrement corresponds to a whole-file read.** `episodes.js` 3, `storyteller.js` 8, `sceneSetRoutes.js` 6, and v1.55's ten files. **No revision read a file partially and decremented by the part** except v1.52, which stated so explicitly and corrected for it in the same expression. This is what makes the enumeration at §61.5 possible without line-level archaeology.

### §61.3 The pool-boundary error at v1.55 — the remainder is 37, not 34

v1.55 §58.1 tabulates 27 sites resolved and its hygiene section carries the remainder to 34, from 61.

**Three of those 27 are not complement sites.**

| Site | Route | Cohort |
|---|---|---|
| `careerGoals.js:487` | `DELETE /world/:showId/goals/:goalId` | `:showId` |
| `opportunityRoutes.js:255` | `DELETE /opportunities/:showId/:id` | `:showId` |
| `wardrobe.js:859` | `POST /wardrobe/seed` | `:showId` |

**v1.55 §58.4 names the first two as taking tenancy from the route path** — which is precisely what places them in the `:showId` cohort. All three files are confirmed members of the 22 by live intersection at §61.1.

**Only 24 of v1.55's 27 came from the 78.** The counter was decremented by 27 against a complement-derived figure. **The corrected remainder at v1.55, v1.56 and v1.57 is 37.**

**This does not impugn v1.55's substantive work.** Its six instances, two verified-scoped sites and nineteen domain exclusions all stand as recorded; §58.4's two clean sites are correctly classified and correctly reasoned. **The defect is confined to which counter was decremented.**

**Independently corroborated.** Enumerating the remaining sites by name (§61.5) yields eighteen, and 18 + 19 permanent exclusions = 37. The pool-boundary audit and the name-by-name enumeration were performed by different routes and agree.

### §61.4 Inconsistent exclusion accounting — a second finding

**v1.49** excluded four files on principle per v1.44 §47.2 — `worldStudio.js` 13, `characterRegistry.js` 3, `relationships.js` 2, `universe.js` 1, nineteen sites — and **left them in the population**. Its remainder is 78 − 3, with no exclusion subtraction. Those nineteen sites are traceable through every subsequent revision and are never removed.

**v1.55** excluded six files by domain — nineteen sites — and **took them out of the population**. §58.5 states "19 sites out of population and not cleared", and 61 − 27 = 34 confirms the subtraction.

**Same register, same operation, opposite treatment.** The consequence is that the carried remainder reads as N units of pending work when 19 of them are units nobody intends to read. **The register has not chosen a convention.** This revision follows v1.55's — excluded sites leave the pool — and says so rather than choosing silently. **Which convention should govern is a register question and is not settled here.**

**A collision, for the naming list.** Two disjoint exclusion sets, one of four files and one of six, both totalling **nineteen sites**, both termed "excluded". Bare "the 19 excluded" is ambiguous across v1.49 and v1.55. First reference must carry the revision.

### §61.5 The enumeration

**At v1.57, eighteen sites across sixteen files** had been neither read nor excluded. Derived by subtracting the 19 v1.49 exclusions and the 41 complement reads from the 78.

| File | Sites | Disposition at v1.58 |
|---|---|---|
| `franchiseBrainRoutes.js` | 2 | **excluded by domain** (§61.7) |
| `layers.js` | 2 | **2 instances** (§61.6) |
| `footage.js` | 1 | **1 instance** (§61.6) |
| `authorNoteRoutes.js` | 1 | unread |
| `calendarRoutes.js` | 1 | unread |
| `eventGeneratorRoute.js` | 1 | unread |
| `feedRelationshipRoutes.js` | 1 | unread |
| `memories/assistant.js` | 1 | unread |
| `memories/core.js` | 1 | unread |
| `memories/engine.js` | 1 | unread |
| `pageContent.js` | 1 | unread |
| `sceneLinks.js` | 1 | unread |
| `scriptAnalysis.js` | 1 | unread |
| `scriptParse.js` | 1 | unread |
| `templateStudio.js` | 1 | unread |
| `templates.js` | 1 | unread |

**Thirteen sites across thirteen files remain unread**, one site each. **They are not asserted clean.**

**Remainder after this revision: 32** — 19 permanently excluded plus 13 readable. Corrected 37, less 5 dispositioned here.

**The three `memories/` sites are in the population and always were.** Recorded because a probe in this session read them as a separate surface; see §61.10.

### §61.6 Three instances

All three are v1.52 §55.3's **no tenant column** variant. All carry `requireAuth` at the handler except where §61.8 applies. All fetch by `findByPk` on a caller-supplied id, return 404 on absence, and destroy.

| Site | Route | Model | Apparent path to tenancy | Depth |
|---|---|---|---|---|
| `layers.js:223` | `DELETE /:id` | `Layer` | `Layer → Episode → Show` | 1 join |
| `layers.js:407` | `DELETE /assets/:assetId` | `LayerAsset` | `LayerAsset → Layer → Episode → Show` | 2 joins |
| `footage.js:314` | `DELETE /scenes/:sceneId` | `Scene` | `Scene → Episode → Show` | 1 join |

**Model layer read first, per v1.52 §55.6.** `Layer` carries `episode_id` and no `show_id`, with `belongsTo(models.Episode)`. `LayerAsset` carries `layer_id` and no `show_id`, with `belongsTo(models.Layer)` **and `belongsTo(models.Asset)`**. `Scene` carries `episode_id` and no `show_id`, `tableName: 'scenes'`, `paranoid: true`.

**The paths are apparent, not established.** `Scene`'s linkage to `Episode` was observed as a column and a camelCase getter alias; **no `belongsTo` was observed on `Scene`**. `LayerAsset`'s second parent is a second candidate path that was not traced. **Nullability was not read on any of the three foreign keys** — an association is not a guaranteed path, and a nullable FK admits rows reaching no show at all. Per v1.53's treatment of `StorytellerEcho`, these depths are recorded and **not asserted**.

**A consequence class the register has not distinguished.** `layers.js:223` carries the source comment `// Soft delete (paranoid)`, and `Scene` sets `paranoid: true`. **Rule 2 was chosen because a destructive write is unrecoverable in a way a read is not** — v1.49 §52.1. A paranoid delete leaves `deleted_at` and is recoverable. These two sites are cross-tenant writes with a recovery path, which is not the consequence class the rule was selected for.

**And recoverability is not a property of the row.** `episodes.js:239` hard-deletes `Scene` rows with `force: true`, bypassing paranoid — v1.49. **The same table is recoverable from one route and not from another.** Whether the distinction changes classification is a register question and is not settled here.

### §61.7 `franchiseBrainRoutes.js` — excluded by domain

`src/models/FranchiseKnowledge.js` exists and declares `tableName: 'franchise_knowledge'`. **It carries no `show_id` and declares no `belongsTo`.** The model file was confirmed present before the negative was accepted, per the guard v1.53 applied to `StorytellerEcho` and v1.57 §60.2 applied to Gate 4.

**Franchise tier sits above the show partition.** Both sites are excluded on the v1.44 §47.2 principle that probing a non-partitioned domain manufactures findings — the same posture as `worldStudio.js`. **Excluded, not cleared.**

**`:228` is otherwise unremarkable** — `DELETE /franchise-brain/entries/:id` at `:223`, `requireAuth`, canonical fetch-404-destroy.

### §61.8 `footage.js` — an unauthenticated surface on a live mount

**Reported for F-AUTH-1. Not assessed, and no F-AUTH-1 disposition is proposed.** The absence is established; what to do about it belongs to that keystone's register.

A grep for `router.(delete|post|put|patch)` over `src/routes/footage.js` returns five declarations and **not one carries auth middleware**:

| Line | Route |
|---|---|
| 47 | `POST /upload` (`upload.single('video')`) |
| 171 | `POST /episodes/:episodeId/assets` |
| 256 | `DELETE /episodes/:episodeId/assets/:assetId` |
| 289 | `DELETE /scenes/:sceneId` |

**`src/app.js:833` is a bare mount** — `app.use('/api/footage', footageRoutes)`, no middleware. Nothing closes the hole at the mount.

**This is the sub-form (b) shape** — routes declaring no auth middleware at all — on a live mount carrying a file upload and two deletes.

**The router-level check was run and returned empty.** `git grep -n -E "router\.use|requireAuth|optionalAuth|authenticate|authenticateJWT|verifyGroup|authorize" origin/main -- "src/routes/footage.js"` produced no output and exit status 1. **There is no `router.use` in the file and no auth middleware under any of the seven names this register has recorded in use.** The surface is not closed inside the router, and it is not closed at the mount.

**The finding is therefore established, not observed.** Three independent greps against `origin/main` — handler declarations, the mount in `src/app.js`, and the router body — agree. **`src/routes/footage.js` is reachable without authentication**, including `POST /upload`, which accepts a video file, and both delete handlers.

**This was written narrowly in draft and is upgraded on evidence, not on argument.** §52.5's withdrawn generalisation is the precedent: the earlier scoping was correct while the check was outstanding, and the check is what changed the claim.

**One boundary remains and does not affect the above.** `router.get` was not in the probe pattern, so this file's read handlers are unenumerated. Their exposure follows from the same absent middleware, but they are not counted here.


**A second mount observation.** `src/app.js:816` mounts `editMapsRoutes` at `/api/v1/raw-footage` — a different router on a footage-named path. Belongs to the eleven-router collision surface already carried.

### §61.9 Recorded, unminted

Surfaced while reading. **Not adopted, not minted, not admitted.**

- **`db.FranchiseKnowledge.sync()` executes inside a route handler's catch block** at `POST /franchise-brain/seed` (`:54`). A request-triggered schema create. **This is F-App-1 §12.11's Variant A `model.sync` family**, whose residue is unowned and tracked at **PE #62**. Whether this site is among the eleven already enumerated there **was not checked** and is owed before it is filed as new.
- **`force: true` from `req.body` wipes the entire franchise canon.** `POST /franchise-brain/seed` at `:82` executes `DELETE FROM franchise_knowledge` — **no predicate of any kind** — then re-seeds from ten migration files. Gated by `requireAuth` alone; **no admin tier**. Not cross-tenant, because the table carries no tenant. **This is XK-3's substrate absence appearing on an unpartitioned table**: nothing to scope to, and no group check either. Reported for F-AUTH-1's tier disposition; not claimed.
- **A predicate-free destructive write is outside all four sub-forms.** §55.3's variants concern predicates that are absent, wrong, or caller-supplied. `:82` has no predicate. Recorded as a shape the taxonomy does not cover; **no sub-form is minted**, and the site is excluded by domain regardless.

### §61.10 Method notes

**A subset read as a disjoint population — twelfth in the hazard family.** `git grep -- "src/routes/*.js"` returns 91 sites; `git grep -- "src/routes/**/*.js"` returns 3. The three were read as a surface the first probe had missed, and the pool was reduced from 18 to 15 on that basis. **The reduction was wrong.** Git pathspec `*` matches `/`, so the first form already matched recursively; the second requires an intermediate directory and therefore returns a **subset**. **A pathspec that returns fewer results is not evidence of a population the wider one missed.** The error was caught by summing the original per-file listing, which was correct throughout — the same recovery v1.53 §56.5 used.

**Offered as a candidate explanation for v1.57 §60.7's unexplained pathspec defect**, where `-- src/migrations` returned one file and `-- "src/migrations/*.js"` returned nineteen. The mechanism is not the same and **this does not close §60.7**; it establishes only that pathspec form changes result sets in ways that do not announce themselves.

**A population figure asserted before its boundary was checked.** The readable pool was stated as 15 on the assumption that all 27 of v1.55's resolved sites came from the complement. That assumption was not tested when the figure was published, and it was false. **Same failure mode as v1.53 §56.5** — an arithmetic claim published ahead of its reconciliation — and caught the same way.

**Citation-mining cannot reconstruct a read-set.** An attempt to recover the 44 read sites by extracting every `file.js:NNN` citation from v1.51–v1.56 returned 24 after filtering, against a required count that did not exist as a set. **The method is structurally incapable**: a revision cites sites it discusses, and a site read and found guarded produces no citation. **The cited set is biased toward findings and silent on clears.** Widening the net cannot fix it. The reconstruction succeeded only once it moved to whole-file subtraction.

**Two probe defects of my own, recorded so the pattern is visible.** A regex `read[s]? (\w+|\d+) (site|file)` matched the literal word *unread* and captured the token it was written to find. And a pattern using `.` failed against `75 − 8 + 7` because U+2212 arrives through this console as three characters, so a single-character wildcard cannot match it — **the mojibake display artifact has a regex consequence**, which is new. Neither defect is unexplained; both are recorded because a null from either would have read as absence.

**A summary is not a source.** Two intermediate summaries in this session asserted site-level line numbers that appeared in no output they showed, and one narrated a reconciliation from a script whose enumeration step had failed silently. **Their file-level counts were correct and independently corroborated; their line-level claims were not adopted.** The facts used from them — `storyteller.js` 7 at v1.53, `sceneSetRoutes.js` 6 at v1.54 — were verified against primary text before use.

**Read method, stated precisely.** `storyteller.js` and `sceneSetRoutes.js` were read in full by v1.53 and v1.54. **The three files dispositioned here were not.** They were read at their destructive sites, their route declarations, and their models. **This is a narrower read than those revisions performed**, and the instances are recorded at that depth.

---

## What this revision does not do

- **Mints no FD.** FD tail remains **FD-62**. Mints no XK; tail remains **XK-3**. Mints no PE.
- Does not mint the shape. **v1.48 §51.5 option 3 stands.**
- Does not read the remaining **13 destructive sites**; they are not asserted clean.
- Does not enumerate `src/routes/footage.js`'s `router.get` handlers, and makes no claim about their exposure.
- Does not establish nullability on `Layer.episode_id`, `LayerAsset.layer_id`, or `Scene.episode_id`, and does not trace `LayerAsset.belongsTo(Asset)`.
- Does not settle which exclusion convention governs (§61.4), and does not restate any prior revision's remainder in place.
- Does not resolve whether paranoid soft-deletes belong in Rule 2's consequence class (§61.6).
- Does not check whether `franchiseBrainRoutes.js:54`'s `sync()` is among PE #62's enumerated sites.
- Does not close v1.57 §60.7's unexplained pathspec defect.
- Does not assess F-AUTH-1. §61.8 and §61.9 are reports.
- Does not amend XK-1, XK-2 or XK-3. Their bodies are untouched.
- Does not disposition any statement or any file, and does not lift any gate.
- Does not enumerate prod. **Prod remains FROZEN.**
- **No live database contact. No prod-box contact. No dev-box contact.**

---

## §11 Plan Version History (UPDATED)

| v1.58 | 2026-08-16 | **Rule 2's remainder CORRECTED — 34 to 37 — and the unread population enumerated by name for the first time.** Full partition re-derived live at `5f7ee6b4` and unchanged from v1.49's `8c7d74af`: **91 sites / 39 files, 22 `:showId` files carrying 13 sites, 78 complement.** **§61.2: the remainder series verified step by step** across v1.49–v1.57 — 75/75/75/74/67/61/34/34/34 — every decrement traced to a named revision and a stated read, **no figure restated without being earned**, and **v1.52's `+7` established as bookkeeping rather than withdrawal** (`storyteller.js` removed at 8, its 7 unread returned to pool). **§61.3: v1.55 crossed the pool boundary** — 3 of its 27 resolved sites (`careerGoals.js:487`, `opportunityRoutes.js:255`, `wardrobe.js:859`) are `:showId`-cohort, not complement, and **§58.4 names the first two as taking tenancy from the route path**, which is what places them there; only 24 came from the 78, so **the counter was decremented three too far**. v1.55's substantive work stands entirely; the defect is confined to which counter moved. **Corroborated independently** — name-by-name enumeration yields 18, and 18 + 19 permanent exclusions = 37. **§61.4 second finding: exclusion accounting is inconsistent** — v1.49 excluded 19 sites on principle and left them **in** the population, v1.55 excluded 19 by domain and took them **out**; same operation, opposite treatment, **and the register has not chosen a convention**. This revision follows v1.55's and says so. **A 19/19 collision for the naming list** — two disjoint exclusion sets of identical total, both termed "excluded". **§61.5: eighteen sites across sixteen files unread at v1.57**, listed by file; **thirteen sites across thirteen files remain** after this revision, one each, **not asserted clean**; remainder **32** = 19 permanently excluded + 13 readable. **§61.6: three instances** — `layers.js:223` (`Layer → Episode → Show`, 1 join), `layers.js:407` (`LayerAsset → Layer → Episode → Show`, 2 joins), `footage.js:314` (`Scene → Episode → Show`, 1 join) — all §55.3's **no-tenant-column** variant, all `findByPk` on a caller-supplied id then destroy; shape extends to **33 sites / 32 handlers / 13 files**, still unminted. **Paths are apparent, not established** — no `belongsTo` observed on `Scene`, `LayerAsset` carries a **second parent** (`Asset`) untraced, and **nullability unread on all three FKs**; per v1.53's `StorytellerEcho` posture. **A consequence class the register has not distinguished** — `layers.js:223` is commented `// Soft delete (paranoid)` and `Scene` sets `paranoid: true`, so both are **recoverable** cross-tenant writes, which is not why Rule 2 was chosen (v1.49 §52.1); **and recoverability is not a property of the row** — `episodes.js:239` hard-deletes the same `Scene` table with `force: true`. **§61.7: `franchiseBrainRoutes.js` excluded by domain** — `FranchiseKnowledge` carries no `show_id` and no `belongsTo`, model file confirmed present before the negative was accepted; franchise tier sits above the partition, v1.44 §47.2, **excluded not cleared**. **§61.8: `src/routes/footage.js` is an ESTABLISHED UNAUTHENTICATED SURFACE — the most severe item in this revision and not a Rule 2 finding.** No auth middleware on any of five mutating declarations (:47 `POST /upload` with `upload.single('video')`, :171, :256, :289); **`src/app.js:833` is a bare mount**; and a router-body grep for the seven middleware names this register has recorded in use **returned empty at exit 1** — **no `router.use` in the file and no auth middleware of any name.** Three independent greps against `origin/main` agree; the surface is closed neither in the router nor at the mount. **Sub-form (b) on a live mount carrying a video upload and two deletes; reported for F-AUTH-1, not assessed.** Written narrowly in draft and **upgraded on evidence rather than argument** — §52.5's withdrawn generalisation is the precedent, and the outstanding check is what changed the claim. `router.get` was not in the pattern, so read handlers remain unenumerated. Also `app.js:816` mounts `editMapsRoutes` at `/api/v1/raw-footage`, a second router on a footage-named path. **§61.9 recorded, unminted:** `db.FranchiseKnowledge.sync()` inside a route handler's catch block, **F-App-1 §12.11 Variant A family, PE #62**, overlap unchecked; **`force: true` from `req.body` executing `DELETE FROM franchise_knowledge` with no predicate of any kind**, `requireAuth` only and **no admin tier**, **XK-3's substrate absence appearing on an unpartitioned table**; and a **predicate-free destructive write is outside all four §55.3 sub-forms**, recorded without minting one. **§61.10 method notes, four:** a **subset read as a disjoint population** — `src/routes/**/*.js` returns 3 where `src/routes/*.js` returns 91, git pathspec `*` matches `/` so the second is a **subset**, the pool was wrongly cut 18 to 15, caught by summing the original listing; offered as a **candidate explanation for §60.7 and explicitly not closing it**; a **population figure asserted before its boundary was checked**, same failure mode as v1.53 §56.5; **citation-mining cannot reconstruct a read-set** — clean reads produce no citation, so the cited set is **biased toward findings and silent on clears**, structurally unfixable by widening; and **two self-inflicted probe defects** — a regex capturing the literal word *unread*, and `.` failing against U+2212 because the mojibake artifact arrives as three characters, **a display artifact with a regex consequence**. **A summary is not a source** — two intermediate summaries asserted line numbers appearing in no output they showed and narrated a silently-failed script; their file-level counts were verified against primary text before use, their line-level claims discarded. **Read method stated precisely** — the three files here were read at their destructive sites, route declarations and models, **not in full**, a narrower read than v1.53 and v1.54 performed. Mints no FD, no XK, no PE. No live DB contact. Prod FROZEN, untouched. §61 minted. Basis `5f7ee6b4`. |

## Register hygiene

- **Corrects the Rule 2 remainder: 34 → 37 at v1.57**, and carries **32** forward after this revision. **No prior revision is edited**; the correction is recorded here and supersedes by addition.
- **Mints no FD.** Tail: **FD-62**. Mints no XK; tail **XK-3**. Mints no PE.
- Mints: **§61**.
- Closes: **nothing**.
- Extends: the shape's instance record to **33 sites / 32 handlers / 13 files**. Still **unminted, unowned, unnumbered**; v1.48 §51.5 option 3 stands.
- Records: the live re-derivation (§61.1); the verified remainder series (§61.2); the v1.55 pool-boundary error (§61.3); the exclusion-accounting inconsistency and the 19/19 collision (§61.4); the by-name enumeration (§61.5); three instances and the paranoid consequence-class question (§61.6); the franchise-tier exclusion (§61.7); the `footage.js` auth surface, scoped (§61.8); three unminted observations (§61.9); four method notes (§61.10).
- **Discharged in-revision:** the `footage.js` router-level middleware check, run empty against `origin/main`; §61.8 is upgraded from scoped observation to established finding on that result.
- **Owes:** `footage.js`'s `router.get` handlers, unenumerated; nullability on the three FKs and `LayerAsset`'s second parent; whether `franchiseBrainRoutes.js:54`'s `sync()` is among PE #62's enumerated sites; a register ruling on exclusion accounting; a register ruling on whether paranoid soft-deletes sit inside Rule 2's consequence class.
- Carries forward, unchanged from v1.57: the shape instances, unminted; **13 unread destructive sites**; XK-3's remedy and Gate 3's measurement; FD-62's remedy, unevaluated; XK-2's owed amendments; the reads surface and v1.51 §54.4's instrument question; §35.5's classes 2–6, unminted and homing-owed; the class 2 candidate at `opportunityRoutes.js:258`; the F-Sec-3 instance report at `wardrobe.js:1233`; the eleven-router collision surface and fail-open mount pattern; `feedPipelineRoutes.js`'s unexplained zero; the three unread write sites from v1.48; tenancy paths owed from v1.53 and v1.54; open items 22, 24, 6; `compositions.js:896`'s `authenticateJWT`, reported for F-AUTH-1 and not claimed; `SEED_WARDROBE` as JS-constants-as-canon; §60.6's five observations and their homing; §60.7's unexplained pathspec defect; all other items carried from v1.57. Open items 41 and 23 remain **CLOSED** per v1.43.
- Defers: everything deferred at v1.57, unchanged.
- Forward-points: nothing new.
- Changes no unit disposition, no PR state, no gate.
- Does not evaluate any fix, does not lift any gate, does not enumerate prod.
- **No live database contact. No prod-box contact. No dev-box contact.** Prod remains FROZEN.
- Additive-supersede on v1.57; no destructive rewrite.
- **Numeral disambiguation:** *§61* is unrelated to FD-61, PE #61, or open item 61. The **19** of v1.49's exclusions and the **19** of v1.55's are different sets; neither may be referenced bare. **13** appears three times in this document with three referents — the `:showId` cohort's site count, the remaining unread population, and `worldStudio.js`'s site count — and is written with its referent each time.
- FD-21 check: no closing keywords adjacent to `#N`.
- Ships WITH `[skip-automerge]` (doc-only PR).

## Forward Statement

**The register's arithmetic was sound and its boundary was not.** Nine revisions of running subtraction survived a step-by-step audit without a single unearned figure — and the one defect that exists is not an arithmetic error at all. v1.55 counted correctly and decremented the wrong pool. **A counter is only as good as the population it is a counter of**, and nothing in the series records which population each figure belongs to.

**The remainder was carried nine revisions without anyone being able to name what it contained.** That is the more useful finding. 34 was defensible at every step and enumerable at none; it is now 37, and the 37 decomposes into 19 sites nobody intends to read and 18 that had never been listed. **The gap between a number that reconciles and a number that can be enumerated is where this one lived.**

**Three instances came out of thirteen files nobody had opened.** `layers.js` and `footage.js` are the same shape `storyteller.js` showed at v1.53 — a fetch that establishes existence and answers no question about entitlement. **The population was worth enumerating because it was worth reading**, and the enumeration cost more than the reading did.

**`footage.js` is the item that does not belong to this keystone, and it is the one that matters most.** Five mutating handlers with no middleware, behind a bare mount, in a router containing no `router.use` at all — a Tier 0 surface reachable without a token, found by F-Stats-1's lens only because someone walked a list of files nobody had opened. **The enumeration was worth doing for a reason that had nothing to do with Rule 2.**

**It was drafted narrowly and upgraded on a grep.** The scoped wording was correct while the check was outstanding, and the check is what moved it — which is the order these things should happen in, and the reason §52.5's withdrawal is quoted rather than forgotten.

**Nothing is fixed. Thirteen sites remain and are not asserted clean.**

---

*Author: Claude, with JustAWomanInHerPrime (JAWIHP) / Evoni.*
*Date: 2026-08-16. Main at `5f7ee6b4` (#1031). Predecessor: v1.57.*
*Minted: §61. Corrected: Rule 2 remainder 34 → 37. Established: `src/routes/footage.js` as an unauthenticated surface, reported for F-AUTH-1. Read: three route files at their destructive sites, four model files. Closed: nothing. Mints no FD, no XK, no PE. Tail: FD-62. XK tail: XK-3. [skip-automerge]*
