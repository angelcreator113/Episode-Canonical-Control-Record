| **PRIME STUDIOS** **F-AUTH-1 — THE REMAINING SCENE SET REFERENCE WRITERS TAKE THE SET'S ROW LIVE (C2, PR 3) (AMENDMENT)** *Twenty call sites created, moved or restored a Scene Set reference without holding the set's row and without checking under a lock that the set still existed. Each now takes the affected episodes first, then the set's row, live only and never waited for while an episode or event row is held, and answers its own existing refusal when the set has gone. Three sites gain a missing-set refusal; three stop sending database text. This does NOT establish the global reference-safety invariant: S1 is unresolved.* |
| --- |

**Document version**

v1.0 (not yet merged; the first draft of this file). This is an additive amendment, written as a new file because the register is append-only. **Mints nothing.**
- The FD tail, XK tail and PE tail are unchanged.
- No earlier register file is edited, and no banner is added to one.

**Basis:** `origin/main` at `80aa203242d7f69de0aa10f5d0e428f5a294e301` (2026-11-24), which already carries the Scene Set delete lock-order change (C1 PR 1, #3935), the event-writers episode-first change (C1 PR 2, #3938) and the base-image change (#3937). Every `file:line` below is at that basis unless it says "on the branch", meaning the local branch `claude/reference-writers-set-liveness`. Nothing was pushed by this work and no pull request was opened.

**Author:** Claude, with Evoni (JustAWomanInHerPrime), Prime Studios.

**Status:** amendment, on Evoni's authorization of PR 3 of 2026-11-24 and her rulings of the same day, set out in §2 as they were given to this work. Merging this file with the change it describes is her approval of the text. It is not an authorization to deploy.

**Standings used:** RULED (§2); MEASURED (the repository reads of §1 and the local test runs of §6 and §7, each with its file or command); INFERRED (marked where used).

**The original defect.** A foreign key is not protection. An FK-backed insert waits on the set row while the delete holds it `FOR UPDATE`, but once the delete commits the FK is satisfied by the **soft-deleted** row, so the write lands on a removed set. The writers with no foreign key wait on nothing at all. Measured by this work at the basis: see §6, where the new suite with only the fifteen changed source files put back to the basis fails 20 of its 42 cases.

---

# §1. What was there (MEASURED at the basis)

Full Phase 1 inventory, with the verified call path of each site. The raw inventory is kept outside the repository at `/root/pr3-evidence/impl/PHASE1_INVENTORY.md`.

## Foreign keys to `scene_sets`

| table.column | FK? | migration |
|---|---|---|
| `scene_set_episodes.scene_set_id` | yes (CASCADE) | `20261019180000-create-scene-set-episodes-if-missing.js:35-38` |
| `scene_plans.scene_set_id` | yes (SET NULL) | `20260629000000-create-episode-briefs-scene-plans.js:48` |
| `scenes.scene_set_id` | yes, conditional on the sets table existing at migration time | `20260626000000-add-scene-set-refs-to-scenes.js:14-18` |
| `world_events.scene_set_id` | yes (SET NULL) | `20260630000000-add-scene-set-id-to-world-events.js:6-11` |
| `scene_sets.version_of_set_id` | yes | `20261016150000-add-version-of-set-id-to-scene-sets.js` |
| **`episode_lookbook_images.scene_set_id`** | **yes** (this answers the open question put to this work) | `20261010120000-create-episode-lookbooks.js:74` |
| `scene_set_looks.scene_set_id` | **no** | `20261002130000-create-scene-set-looks.js:38` |
| `character_places.scene_set_id` | **no** | `20261015160000-create-character-places.js:34` |
| `location_look_variants.scene_set_id` | **no** | `20261015170000-location-look-variants-per-set.js:38-39` |
| `shows.metadata.scene_defaults.*` | **no** (json) | no FK possible |

## The delete path's order, which no writer may invert (MEASURED)

`src/services/sceneSetUsesService.js`: `setReferences` (`:343`) reads the complete reference set; `lockSetReferences` (`:373`) takes the affected episodes `FOR UPDATE` in one ascending statement, then each event (`lockLiveEvent`), then **one** statement over `scene_sets` (the set `FOR UPDATE NOWAIT`, a live replacement `FOR KEY SHARE NOWAIT`, its live versions `FOR NO KEY UPDATE NOWAIT`), then re-reads the reference set; `withSetLocks` (`:407`) is one transaction per attempt, `PLACE_FINALIZE_MAX_ATTEMPTS` tries, then `RetryableConflictError` (409 `RETRY`). `moveUses` (`:102`) then writes, in this order: `scene_set_episodes` → `scene_plans` → `scene_set_looks` → `world_events` → `scenes` → **`shows` (`:174`)** → **`character_places` (`:183,:187`)** → `scene_sets.version_of_set_id`.

**The set rows are locked before `shows` and `character_places` are written.** This is why the writers with no foreign key take the set row FIRST, before the `shows` row and before `character_places`: taking the show first would be the opposite order.

## The sites

Paranoid models confirmed: `SceneSet` (`src/models/SceneSet.js:131`), `Scene` (`:403`), `SceneSetEpisode` (`:32`), `ScenePlan` (`:47`), `EpisodeLookbookImage` (`:33`). A `findByPk` therefore returns null for a removed set — which is why W2, W5 and W10 already answered 404. That read holds no lock, so the set can be removed between the read and the write: the TOCTOU this change closes.

| # | Site | Transaction and locks at the basis | Tier | Accepted / filmed | Existing contract |
|---|---|---|---|---|---|
| W1 | `POST /episodes/:episodeId/scene-sets` (`src/routes/episodes.js:1720-1775`, `findOrCreate` `:1757`) | **none** | `requireAuth` + ADMIN | accepted read at `:1736` with **no lock**; no filmed check | 404 episode, 409 `EPISODE_ACCEPTED`, 400, 200. **No missing-set refusal**: `SceneSet.findByPk` `:1756` is read only for the role name, so a removed or absent set still got a link |
| W2 | `POST /scene-sets/:id/episodes` (`src/routes/sceneSetRoutes.js:2865-2906`, `findOrCreate` `:2882`) | none | `requireAuth` + ADMIN | **neither** (a pre-existing gap, not widened here) | 404 `Scene set not found` `:2868`, 400s, 200 |
| W4 | Studio `PUT …/beat/:n/angle` (`src/routes/sceneStudioEpisodeRoutes.js:123-168`) | none; **two** separate `plan.update` calls (`:140`, `:149`) | `requireAuth` + ADMIN | none | **500 with `err.message` `:166`.** **No missing-set refusal**: it took `angle.scene_set_id` `:142` with no liveness check at all |
| W5 | Studio `PUT …/beat/:n/scene-set` (`:173-240`) | none; `plan.update` `:202` then `findOrCreate` `:211` | `requireAuth` + ADMIN | none | 404 `:195`; **500 with `err.message` `:238`**; `catch { }` `:215` **swallowed the link failure into a 200** |
| W6 | Beat save `PUT /episode-brief/:episodeId/plan/:n` (`src/routes/episodeBriefRoutes.js:458-507`) | none: `linkBeatSet` `:489` (given no transaction), `plan.update` `:498` and `syncBeatScenesQuietly` `:501` were **three independent commits** | `requireAuth` + ADMIN | `linkBeatSet` refuses `EPISODE_ACCEPTED` (`episodeLocationsService.js:617`) **only when a new link is inserted**; no filmed check | 404s, 409, `EpisodeLocationsError` passthrough, **500 with `err.message` `:505`** |
| W7 | Planner save (`src/services/scenePlannerService.js`, sets read `:57`, model call, save transaction `:319-328`) | the long model call was **already outside** the short save transaction; no locks | — | — | **omits** an unresolved set: `scene_set_id: sceneSet ? beat.scene_set_id : null` `:278` |
| W8 | Start's plan rows (`src/services/episodeGeneratorService.js` `createScenePlanRows:241-334`, insert `:316-324`) | **none.** The brief's premise was that these run inside Start's transaction; they do not. They are `models.sequelize.query(...)` with **no `transaction` option**, and the function is called at `:1017`, **after** Start's transaction (`:719`) has committed. They hold neither the event nor the episode. The sets were last read in `applyStartLocations` (`:1059`), a different transaction, which in fact runs **after** this call | — | — | **no refusal path**: a beat failure is collected in `failedBeats` `:328` and reported as partial by `scenePlanStep` `:341`; an unplaceable set is **omitted** (`:321`) |
| W9 | `createScene` (`src/controllers/sceneController.js:224-243`, `:238`) and `updateScene` (`:267-360`, allowlist `:318-319`, `save()` `:347`) | none | — | none | 500 `Failed to create scene` + `message: error.message`. **No missing-set refusal.** |
| W9c | duplicate `Scene.create` (`:1379`) | — | — | — | **`sceneData` (`:1361-1377`) does not include `scene_set_id`.** NOT a reference writer. Removed from scope, verified, nothing changed |
| W10 | `POST /episodes/:id/scenes/from-angle` (`src/routes/episodes.js:1956-2005`, `Scene.create` `:1987`) | none | `requireAuth` + ADMIN | none | already 404 `:1977`; TOCTOU only |
| W11 | Legacy `POST /episodes/:id/save` (`:181-301`) | **its own** transaction `:196`, locking only `timeline_data` `:207` | `requireAuth` + `legacyTimelineWritesOpen` (410 unless `LEGACY_TIMELINE_WRITES=on`) + ADMIN | none | `SaveConflict` → its status/code. `scene_set_id` `:245` straight from the body, **no validation** |
| W16 | World event create (`src/routes/worldEvents/create.js:25-233`; ORM `:110-142` and raw-SQL fallback `:159-219`) | none | `requireAuth` only | — | `resolvedSceneSetId = scene_set_id \|\| null` `:67` — **no validation of any kind**. `syncDraftedDealType` `:144`/`:222` runs after the insert |
| W17 | Calendar spawn (`src/routes/calendarRoutes.js:505-611`, `WorldEvent.create` `:549-569`, `:567`) | none | `requireAuth` only | — | no validation; **the raw-SQL fallback `:586-601` writes no `scene_set_id` at all** |
| W18 | `saveSceneDefaults` (`src/services/episodeLocationsService.js:555-589`) | sets read `:563` **outside**; transaction `:574` takes **`shows FOR UPDATE` `:575` as its first lock** — the inversion | — | — | 404 `SCENE_SET_NOT_FOUND` `:565`, 409 `LEAD_CHANGED` `:578` |
| W19 | `setLead` (`src/services/characterPlacesService.js:139-188`) and `linkPlace` (`:195-229`) | `setLead`: transaction `:146`, **`shows FOR UPDATE` `:147` first**, then `INSERT INTO character_places :162-167` from the show's own `scene_defaults`; `linkPlace`: `liveSet :202` outside, transaction `:210`, advisory lock `:213`, upsert `:221-226` | — | — | `linkPlace` 404 `SCENE_SET_NOT_FOUND` `:203`; **`setLead` has none** |
| W20 | `startVariant` (`src/services/locationLookVariantService.js:182-225`, claim `:188`) and `uploadVariant` (`:233-250`, insert `:240`) | none. `startVariant`'s paid `run()` `:207` is returned to the route and called **after the response**; `uploadVariant`'s **`storeImage(set)` `:239` writes to S3 BEFORE the insert** | — | — | `loadEveryday` 404 `SET_NOT_FOUND` `:74` |
| W21 | `setVenueImage` (`src/services/episodeLookbookService.js:231-258`, `create` `:246-255`) | none; `ensureLookbook :235` and `returnToDraft :236` already commit | — | — | 404 `VENUE_IMAGE_NOT_FOUND` `:239` |
| W22 | `approveBase` (`src/services/approvedBaseService.js:96-134`) | transaction `:102`. Its set lock `:106-110` is `FOR UPDATE` with **no `deleted_at` filter**, so it waited for the delete and then found the soft-deleted row and approved it | — | — | no set-not-found refusal in the service (the route's `findByPk` 404s) |

## Searched and confirmed to need nothing (MEASURED)

`saveEpisodeLocations` / `applyStartLocations` (episode share → event → set rows `FOR KEY SHARE NOWAIT` → a live re-read); `takeSetRow` in `src/services/venueLookImageService.js`; the base save in `src/services/sceneGenerationService.js` (#3937); `POST /scene-sets` with `episode_ids` (the set is created in the same statement); the `episode_briefs.event_id` writers (they name an event, not a set); `eventPlaceSync.syncEpisodeEventLocation` (reached only from the C1 writers, under their locks); the C1 event writers themselves (`worldEvents/update.js`, `inject.js`, `sceneSetVersionService.js`, `eventSceneSetLinkService.js`). Searched across all 87 files that mention `scene_set_id` in `src`: every other occurrence is a `WHERE`, a `SELECT`, a model attribute, or a child row keyed by an already-held set (`scene_angles`, `scene_assets`), not a new reference to a set the caller chose. The feed, automation and career-pipeline services create no event with a `scene_set_id`.

# §2. The decisions (RULED)

Evoni's four, as given to this work on 2026-11-24:

1. **The invariant, in her words:** "No ordinary writer may create, move, or restore a Scene Set reference onto a set that was already removed. An existing reference may remain after Delete Anyway where that is part of the current documented behavior."
2. **`syncBeatScenes` is assigned to S1**, not corrected here: record it, change nothing.
3. **The W3→W1 move is deferred** (the `OTHER_EVENT_VERSION` validation staleness in `refuseEventSet` called from `src/routes/worldEvents/update.js`): record the hypothesis and the proposed correction, implement nothing. See §8.
4. **PR 3's architectural direction:** correct the writers in the existing services, reusing the merged helpers; the established order is affected EPISODES first (one ascending statement), then EVENTS (ascending), then SCENE SET rows, never waited for while an episode or event row is held (NOWAIT); a removed set answers each route's EXISTING refusal; a lock conflict surviving the bounded retries answers 409 `RETRY` in the shape the repo already uses; keep validation and the write atomic; no nontransactional side effect inside a retryable transaction; successful workflows and permission tiers unchanged; no lock stronger than `FOR KEY SHARE` on a set row; no migration, table, service, queue, worker or locking subsystem; `src/utils/*` unchanged; local commits only.

Out of scope by the same rulings: "Move my beats" (C2), C1's episode-lock strength (stays `FOR UPDATE`), the filmed-episode policy for ordinary writers (preserved and pinned as a RECORDED GAP), generation claim ownership, acceptance, and recovery of existing orphan references.

# §3. What the change does, by writer (MEASURED on the branch)

## One helper added, beside the merged ones

`holdLiveSets` (`src/services/eventPlaceSync.js`, after `holdLiveSet`): `holdLiveSet` for each distinct set id a write names, in **ascending** order, so two writers naming the same two sets take them in one order. Resolves `null` when all are live and held, else the first id that is gone. No new service, no new subsystem; `src/utils/*` is untouched.

## The episode-keyed writers

Each now runs in `inEpisodeFirstTransaction`: `lockEpisodes([...], { mode: 'share' })` → the route's existing accepted check **under that lock**, where it has one → `holdLiveSet`/`holdLiveSets(..., { nowait: true })` for every set the write names → the write.

| # | On the branch | Removed set answers |
|---|---|---|
| W1 | `episodes.js`: one transaction; the accepted status is **re-read under the episode's share lock** (it was read with no lock before); then every set id the request names, ascending, NOWAIT; then the links | **404 `SCENE_SET_NOT_FOUND`** — NEW (§4) |
| W2 | `sceneSetRoutes.js`: `lockEpisodes(episode_ids, share)` in one ascending statement, then the set row NOWAIT, then the links | 404 `Scene set not found` (existing) |
| W4 | `sceneStudioEpisodeRoutes.js`: the episode, then the angle's set NOWAIT, then the beat's **two updates as one commit** | **404 `Scene set not found`** — NEW (§4). An angle with no set still clears the beat's set, as before |
| W5 | the episode, then the set NOWAIT, then the beat **and its episode link as one commit** | 404 (existing) |
| W6 | `episodeBriefRoutes.js`: the episode, then the set NOWAIT, then `linkBeatSet` **and** `plan.update` in **one** transaction (they were two commits). `linkBeatSet` now decides `EPISODE_ACCEPTED` under the episode's lock | 404 `SCENE_SET_NOT_FOUND` (`linkBeatSet`'s existing code) |
| W9 | `sceneController.js`: `createScene` and `updateScene` each take their episode (`scene.episode_id` for the update) then the set NOWAIT | **404 `Scene set not found`** — NEW (§4). `updateScene` checks only when the request names the field |
| W10 | `episodes.js`: the episode, then the set NOWAIT, then `Scene.create` | 404 `Scene set not found` (existing) |
| W11 | `episodes.js`: its existing transaction becomes `inEpisodeFirstTransaction`; the episode, then every set id the sent scenes name, NOWAIT, before anything is written | `SaveConflict(404, 'SCENE_SET_NOT_FOUND', 'Scene set not found')`, answered through the route's existing conflict path |
| W21 | `episodeLookbookService.js`: the episode, then the set NOWAIT, then the row; the find and the insert/update are now one commit | 404 `VENUE_IMAGE_NOT_FOUND` (existing) |

## W7, the planner

The long model call stays **outside** any transaction, where it already was. Inside the existing short save transaction, now `inEpisodeFirstTransaction`: the episode share lock, then every set id the plan names, ascending, **NOWAIT**. A set that went is dropped to `scene_set_id: null, scene_context: null` for its beat, and the returned beats are corrected to match — which is this service's existing answer for a set it cannot resolve (`:278`).

**Why NOWAIT and not waited.** The brief allowed waiting here "since nothing else is held". That is not true once the episode's row is held, and the documented order is that a set row is never waited for while an episode or event row is held. NOWAIT is the stronger and consistent choice; the bounded retry absorbs the conflict.

## W8, Start's plan rows — REMOVED FROM THIS CHANGE (Evoni, 2026-11-24)

**Writer 8 is NOT corrected here.** `src/services/episodeGeneratorService.js` is restored **byte-identical to the basis** (`git diff origin/main -- src/services/episodeGeneratorService.js` is empty). See §5a for the decision, the unresolved dependency and the plan for its own PR.

## W16 and W17, a new event row

Nothing else is held, so the set row is taken **WAITED** as the transaction's only lock, then the event is inserted. Both of W16's branches (the ORM one and the raw-SQL fallback) are covered; W17's raw-SQL fallback writes no `scene_set_id` and needed nothing. `syncDraftedDealType` is left **outside** the new transaction, so its commit boundary is unchanged. A removed set answers **400 `INVALID_SCENE_SET_ID`** — the code `refuseEventSet` already uses. Both routes had no set validation at all, so this is a new refusal for them too (§4).

## W18, W19 and W20, the writers with no foreign key

The set row is taken **WAITED**, as the transaction's FIRST lock, **before** the `shows` row and before `character_places` — the delete path's own order (§1).

- **W18** `saveSceneDefaults`: `holdLiveSets(Object.values(changes))` before the `shows FOR UPDATE`. A removed set is its existing 404 `SCENE_SET_NOT_FOUND`.
- **W19** `linkPlace`: `holdLiveSet(set.id)` before the advisory lock and the upsert; removed → its existing 404 `SCENE_SET_NOT_FOUND`.
- **W19** `setLead`: a **chicken-and-egg**, because the set ids it writes come from the show's own metadata. The candidates are taken from the read `loadShow` already made before the transaction, their rows are held first, and then the `shows` row is locked and the metadata read again.

  **The intentional omission.** A default naming a set that is not held is **OMITTED** from the hand-over, not refused. The reasons: those ids are the show's **stored state**, not anything the caller asked for, so there is nothing to name in a refusal; `setLead` has no `SCENE_SET_NOT_FOUND` to answer with; and the hand-over **clears both defaults anyway**, so the removed set simply becomes nobody's instead of the old lead's. A refusal here would instead block a lead change for a reason the user cannot see or fix. It is logged (`[CharacterPlaces] the show's <role> default is no longer a live scene set: …`).

  **The user-visible hand-over contract does not change**, and that is pinned, not asserted: with a **live** default, `setLead` still returns `{ lead_character_id }`, the old lead still receives the show's old home as her own `character_places` row, the new lead's own home still becomes the show default, and her own row is still removed — the same rows and the same response as on main. With a **removed** default, the lead still changes and returns the same shape; the only difference is that **no `character_places` row is restored onto the removed set**, and the default ends up cleared, so nothing names it. Both cases are deterministic cases in §6, as is `linkPlace` (live → linked; removed → 404 `SCENE_SET_NOT_FOUND`, nothing created).
- **W20** `startVariant`: the claim insert moves into a short transaction behind `holdLiveSet`. The paid `run()` is still returned to the route and called **after the answer** — outside the transaction, as before. `uploadVariant`: **`storeImage(set)` stays before the transaction**, so the S3 write is never inside a retry; the insert is behind `holdLiveSet`. Removed → 404 `SET_NOT_FOUND`.

## W22, approve base

`AND deleted_at IS NULL` added to the `FOR UPDATE` it already took. Once the delete has committed the row no longer matches, so there is no row and no lock, and the service answers `{ status: 404, error: 'Scene set not found' }`, matching the route's own wording. **No lock is strengthened**: the existing `FOR UPDATE` is unchanged in strength, only narrowed by the predicate.

# §4. Every transaction-boundary and response-contract change

| Site | Case | Before | Now |
|---|---|---|---|
| **W1** | a removed or absent set | 200, **the link was created on it** | **404 `{ success: false, code: 'SCENE_SET_NOT_FOUND', error: 'Scene set not found' }`** (new refusal) |
| **W4** | a removed or absent set | 200, **the beat was moved onto it** | **404 `{ error: 'Scene set not found' }`** (new refusal) |
| **W9** | a removed or absent set | 201 / 200, **the scene was created or moved onto it** | **404 `{ success: false, error: 'Scene set not found' }`** (new refusal) |
| W16, W17 | a removed or absent set | 201, **the event was created on it** | 400 `INVALID_SCENE_SET_ID`, the sentence `refuseEventSet` already uses |
| W11 | a sent scene naming a removed set | 200, the row was written | 404 `SCENE_SET_NOT_FOUND` through the existing `SaveConflict` path; nothing written |
| W22 | the set removed while it waited | **the soft-deleted set's base was approved** onto the World Location | 404 `Scene set not found`; nothing approved |
| **W4** | any failure | **500 with `err.message`** (database and ORM text reached the browser) | 409 `{ error, code: 'RETRY' }` for a lock conflict; otherwise 500 `'This beat could not be saved. Nothing was changed: try again.'`, with the error's **class** logged |
| **W5** | any failure | **500 with `err.message`** | as W4 |
| **W5** | the episode link failing | **200** (the link's error was swallowed by `catch { }`) | the whole write is one commit: the beat and the link succeed together or neither does |
| **W6** | any failure | **500 with `err.message`** | 409 `{ error, code: 'RETRY' }` for a lock conflict; otherwise 500 `'This beat could not be saved. Nothing was changed: try again.'`, class logged |
| W6 | the link and the beat | **two independent commits** | one commit |
| W4 | the beat's angle and its context | **two `plan.update` calls** | one |
| W1, W2, W4, W5, W6, W9, W10, W11, W21 | a lost lock after the bounded tries | 500, or the ORM's own error | 409 with code `RETRY` and the repo's existing sentence |
| W1 | the accepted check | read with **no lock** | read **under the episode's share lock** |
| W1, W2, W4, W5, W6, W7, W8, W9, W10, W11, W21 | the transaction | none (or, W7/W11, one, run once) | run up to `PLACE_FINALIZE_MAX_ATTEMPTS` times; every statement inside is rollback-safe database work only |
| W7 | a set removed during the model call | **the beat was saved naming the removed set** | the beat is saved with no set, and the returned plan says so; a warning is logged |
| W8 | a set removed before the beats are written | **the beat was created naming the removed set** | the beat is created with no set; Start is not failed; a warning is logged |
| **W19 `setLead`** | a default naming a removed set | **a `character_places` row was restored onto it** | that key is omitted from the hand-over and logged. **The one deliberate deviation from "answer the existing refusal": `setLead` has no such refusal, and the ids are not the caller's** |

**New transient outcomes.** The NOWAIT writers can now meet a 55P03 on a set row another transaction holds; it is rolled back, paused outside any transaction and tried again, and three in a row is 409 `RETRY` with nothing written. Its frequency was not measured: no jittered sweep was run (§7).

**Unchanged:** every permission tier, every success path, every other status and code, and `uses_left` reporting. Delete Anyway is not redesigned, no legacy reference is removed, and `src/utils/*` is byte-identical to the basis.

# §5. What was NOT changed, and why (RULED, §2)

- **`syncBeatScenes`** (`src/services/beatScenesService.js:43`, called as `syncBeatScenesQuietly:128` from `episodeBriefRoutes.js:501` and `episodeGeneratorService.js:1020`). It `LEFT JOIN`s `scene_sets` with `deleted_at IS NULL` (`:49`) but then writes the **plan's raw `scene_set_id`** (`:87`) into a new `scenes` row, so a beat left on a removed set re-materialises a reference. **S1's.** Measured, not changed.
- **DEVIATION, recorded and now documented in full: the beat save's synchronisation boundary.**

  **What it does.** The **primary write** — `linkBeatSet`'s episode link (`scene_set_episodes`) and `plan.update`'s beat (`scene_plans`) — commits as **one transaction**, under the episode's share lock and the set's `FOR KEY SHARE`. The **derived scene sync** (`syncBeatScenesQuietly`, `src/routes/episodeBriefRoutes.js:522-523`) stays **after** that commit, exactly where it was.

  **Why the sync is not inside it.** Three reasons, in order of weight:
  1. Threading a transaction into `syncBeatScenes` means threading one through `planLocationsService.planWithAngles` (`:193`) and its four loaders (`loadSetAngles`, `loadPlanSets`, `loadDressing` and the look reads), a service shared with `productionCoverageService` and others — outside this PR's bounded scope, and it pulls **S1's own file** into it.
  2. Running it inside this transaction would make the transaction **itself** insert `scenes` rows naming removed sets for the episode's **other legacy beats** (`syncBeatScenes:87` writes the plan's raw `scene_set_id`), under locks this transaction does not hold for those sets. That is worse for this invariant, not better.
  3. The sync is **derived, idempotent and quiet** by design: `syncBeatScenesQuietly` (`beatScenesService.js:128-135`) catches, logs and returns `null`. It reconciles `scenes` to the beats; running it again fixes whatever it missed.

  **The response contract can represent this safely, so it was NOT changed.** On a successful primary write the route answers `200 { data: plan, location? }`. It makes **no claim about the scene row** either way, so a sync that failed cannot be misread from the body as having run, and a committed primary write is **never** reported as a rollback or a failure. A refusal before or inside the primary transaction is the only thing that produces a non-200. That is the existing contract, and it is adequate; nothing about it was touched.

  **Pinned by four deterministic cases (§6):** (a) a successful save — the link and the beat both committed, and the sync then makes the beat's scene row; (b) the sync **made to fail**, injected — the save is still `200`, the body carries no `error` and no `code`, the link and the beat are both durable, and the body matches neither the database-text pattern nor any claim about scenes; (b2) the sync made to **throw** with database text in its message — still `200`, nothing rolled back, and that text never reaches the body; (c) legacy beats on removed sets present — this beat's own write lands on the live set, the legacy beat is untouched, no new reference of this route's own is added, and a further save naming the removed set is `404`.

  Evoni's call if she wants the sync made atomic anyway; it is a larger change than PR 3 and belongs with S1.
- **W9c, the scene duplicate**, writes no `scene_set_id`: nothing to change (§1).

# §5a. Writer 8 — an UNRESOLVED reference-liveness dependency (RULED, Evoni, 2026-11-24)

**The decision.** Writer 8 is **removed from PR 3** and becomes its own follow-up PR. The reason: correcting it broke the merged `placeLockGenerationB3` suite, which is **60 of 60 on unchanged main** and failed **14 of 60** with W8 in (§6). Six of its gates use the **absence of a transaction id** on a `scene_plans` insert as the signal that Start Episode has committed — `:768` (`const committed = gateOn((rec) => !rec.txId && rec.kind === 'insert' && rec.table === 'scene_plans'); // after the commit`), `:793`, `:816-817`, `:895`, `:1180-1181`. Putting those inserts in a transaction makes the signal never fire. Evoni's call was to take W8 out rather than change a merged suite inside this PR.

**What remains broken, stated plainly.** `createScenePlanRows` (`src/services/episodeGeneratorService.js:241-334`, insert `:316-324`) still **creates a `scene_plans` reference on a removed set**. It is pinned by a case in the new suite labelled `RECORDED GAP (W8, UNRESOLVED)`, which asserts the defect — at least one returned row and one committed row naming the removed set — and asserts in the same breath that no other writer may add to that set. When W8 is corrected, that case must be replaced by its positive form.

**Verification of the separation (MEASURED).** `episodeGeneratorService.js` is byte-identical to the basis; `placeLockGenerationB3` is **unmodified** (`git diff origin/main` on it is empty) and passes **60 of 60 in three runs** on this head (`/root/pr3-evidence/impl/head-w8out-B3-run1/2/3.json`). No other PR 3 protection was removed, and the rest of the new suite passes.

**PLAN for the follow-up PR (planning only; nothing below is implemented here).**

1. *The boundary.* `createScenePlanRows` is called at `:1017`, **after** Start's transaction (`:719`) has committed, so it holds neither the event nor the replaced episode; `applyStartLocations` (`:1059`) runs **after** it, so the sets were last validated in neither this call nor a transaction that outlives it. The correction is therefore its **own** short transaction, not an extension of Start's: the episode `FOR SHARE` through `lockEpisodes`, then each distinct placed set id ascending with `holdLiveSet(..., { nowait: true })`, then the inserts, with a **SAVEPOINT per beat** so one beat's own failure (a duplicate beat number from a racing retry) is still recorded while the others are written — the behaviour each autocommit statement gives today. A set that went is **omitted** from its beat, Start's existing answer for a set it cannot place; Start is never failed by this step. Alternatively, and worth measuring first: move the call **inside** Start's transaction, which would hold the event and the episode already — a larger change to Start's commit boundary, and the reason it is not the default proposal.
2. *Deterministic tests.* Start Episode against `DELETE /scene-sets/:id` in both arrival orders and both kinds (delete anyway, delete-with-replacement): the set removed before the beats are written; removed while they are being written, gated on the set-row lock; and removed between `applyStartLocations` and the beats. Each asserts no beat names the removed set, no 40P01, Start's own status and setup step unchanged, and a before/after snapshot.
3. *The six B3 gates*, only if separately authorized: replace "the absence of a transaction id on a `scene_plans` insert" with a signal that does not depend on the autocommit boundary — the `episodes` insert of Start's own transaction, the commit record itself (`rec.kind === 'commit'` for Start's transaction id), or an explicit post-commit marker. **B3's original safety guarantees must not weaken:** every status, refusal code, final-row and no-deadlock assertion it makes must stay exactly as it is; only the "Start has committed" trigger may change, and the change must be shown to fire at the same point in the sequence.
4. *Order.* The gate change and the W8 correction must land together, since each breaks the other on its own.

# §6. Tests

New file `tests/integration/referenceWritersSetLiveness.integration.test.js`, on a private migrated local PostgreSQL database (`episode_metadata_test_pr3_r1`, created by this work with `createdb` + `npm run migrate:up`; the shared `episode_metadata_test` was not used or altered). No test sends DDL. The provider, storage and the model are doubles; the network guard reports **0 external attempts**. Real locks throughout: a backend that waits is read from `pg_stat_activity`, never slept for; a writer is held open at a statement by the lock trace's gate, with its locks really held.

**42 of 42 pass** on the branch head (36.9 s). Raw log: `/root/pr3-evidence/impl/suite_PASS_after.txt`.

What it covers:
- **Delete first, then each writer** (13 cases): W1, W2, W4, W5, W6, W9 create and update, W10, W16, W18, W20, W22 each answer their refusal, no row names the removed set, and a before/after snapshot of every table a writer or a delete could touch is identical.
- **Delete with a replacement, then the writer**: the old set is refused by W1, W5, W9 and W16, the uses moved to the replacement, and the replacement keeps exactly the one link the move made.
- **A writer that really waited on the set row while the delete removed it** (4 cases: W18, W20, W16, W22): the wait is observed in `pg_stat_activity`, the delete then commits, the writer resumes and answers its existing refusal with no lock error, and the snapshot shows no partial commit.
- **Writer first** (2 cases): with the writer gated holding the set row, the delete path's own statement (`FOR UPDATE NOWAIT`) gets **55P03**; the set stays; and a second session can take the same row `FOR KEY SHARE NOWAIT` at the same time, proving the lock taken is no stronger than key-share.
- **Accepted** (3 cases): `EPISODE_ACCEPTED` with nothing linked; and an acceptance that commits while the link waits on the episode row **is seen**, because the status is now read under that lock.
- **RECORDED GAP** (2 cases): an ordinary writer still links a live set to a **filmed** episode (today's behaviour, pinned, not endorsed; only the delete path refuses a filmed use); and Delete Anyway still leaves the references it finds, while no writer may add another.
- **The writers with no foreign key** (3 cases): the lock trace shows W18 locking `scene_sets` **before** `shows`; W18 and W20 raced against the delete of the same set with no lock conflict, and after it settles the writer refuses the set for good.
- **The planner and Start** (3 cases): the set removed during the model call, and removed before Start's beats are written — in both the beat is saved with no set and no beat names the removed set; and with a live set the beats are still made at it.
- **No database text** (2 cases): W4, W5 and W6 given a real lock conflict (their episode row held `FOR UPDATE`) answer 409 `RETRY` or the fixed 500 sentence, and **no body matches** `/deadlock|violates|constraint|SELECT |UPDATE |INSERT |relation|syntax|sequelize|canceling statement|lock timeout|scene_sets|scene_plans|scene_set_episodes/i`; nothing is written.
- **Against the C1 event writers and the finalizers** (3 cases): the event PUT with a set change, the Locations save, and a three-way delete/link/beat-save race — no lock conflict in any, and after a Delete Anyway settles the writers refuse the set.
- **No deadlock**, asked of `pg_stat_database.deadlocks`: unchanged across the whole file.
- **The success paths and the permission tier**: W1, W2, W5, W9, W10 and W16 all succeed against a live set; a VIEWER is still refused; the delete path still refuses an accepted and a filmed use.

**FAIL-BEFORE.** The same suite, unmodified, with **only the fifteen changed source files restored to the basis**: **20 failed, 22 passed** (222.7 s). Raw log `/root/pr3-evidence/impl/suite_FAIL_BEFORE.txt`, case list `/root/pr3-evidence/impl/FAIL_BEFORE_summary.txt`. The failures are the defects themselves: W1 answers 200 and creates the link, W4 200 and moves the beat, W9 201/200 and writes the scene, W16 201 and creates the event, W22 has no refusal at all, W18 takes no set lock so nothing ever waits on one, W7 and W8 write a beat naming the removed set, W4/W5/W6 exceed the timeout rather than answer a bounded 409, and the writers do not hold the set row. After restoring, `git status` was clean.

**MAIN-ONLY BASELINE** (on the coordinator's requirement of 2026-11-24, run last, with nothing else on the cluster). The same suite, byte-identical, in an isolated worktree detached at the basis (`.claude/worktrees/pr3base`, `git rev-parse HEAD` = `80aa2032…`) with its own database (`episode_metadata_test_pr3base_e1`), no source change applied and no assertion adjusted: **20 failed, 22 passed, three runs, the failing set identical in all three, no flakes.** The row-by-row comparison of defect, column, committed rows, response and corrected outcome — with every retained row labelled NEWLY CREATED/MOVED or INTENTIONALLY RETAINED by Delete Anyway — is `/root/pr3-evidence/impl/BASELINE-VS-HEAD.md`; raw jest JSON and logs are `baseline-main-run1/2/3.json` and `.log`.

**THE STOP, AND WHAT EVONI DECIDED.** The first regression battery found **`placeLockGenerationB3` failing 14 of its 60 cases** on the head that still carried W8, while the same suite was **60 of 60 on unchanged main** (`/root/pr3-evidence/impl/suites_placeLock.txt`, `baseline-main-B3.json`). Cause: six gates in B3 use the **absence of a transaction id** on a `scene_plans` insert as the signal that Start has committed (`:768`, `:793`, `:816-817`, `:895`, `:1180-1181`); W8's transaction makes that signal never fire, and the 14 cases are jest timeouts, not assertion failures. That is the stop condition "an existing test would have to change"; B3 was not edited and the work stopped. **Evoni's decision (2026-11-24): remove Writer 8 from PR 3** (§5a). Record: `/root/pr3-evidence/impl/STOP_CONDITION.md`.

**AFTER THE SEPARATION — the full battery on the final head.** `placeLockGenerationB3`, **unmodified** (`git diff origin/main` on it is empty): **60 of 60, three runs** (`head-w8out-B3-run1/2/3.json`). The eleven required suites in one run, **766 of 766, 0 failed** (`head-w8out-battery.json`): `sceneSetDeleteLockOrder` 77, `eventWritersEpisodeFirst` 79, `p2bSceneSetAdmin` 243, `p1PlanAdmin` 85, `placeLockGenerationB2` 69, `placeLockGenerationB1` 56, `placeLockStrict` 53, `placeLockFinalizer` 52, `baseImageStillUsed` 30, `baseSaveLiveSet` 15, `sceneSetsAudit7` 7.

**`tests/unit`: 11287 tests.** On unchanged main in the baseline worktree, **0 failed** (`baseline-main-unit.json`). On the head it first failed **27**, and **17 of those were real regressions of this change**: the world event create, the calendar spawn and `createScene`/`updateScene` opened their transaction **unconditionally**, and those suites drive the routes with a `models` double whose `sequelize` has no `transaction()`, so their 201s and 200s became 500s (`worldEvents-event-basics`, `worldEvents-manual-create-links`, `worldEvents-from-profile-sponsor-not-organizer`, `eventAutomationService-calendar-sponsor-not-organizer`, `nested-episode-no-script`). **Corrected in this change, not by editing those tests:** a write that names no scene set references none, so it holds nothing, checks nothing and opens **no transaction**, exactly as before (§4). `tests/unit` is now **10 failed**, all in three network-guard self-test files (`networkGuard`, `networkGuardStage3a`, `networkGuard.canary`) which read `<rootDir>/node_modules` paths this worktree does not have (it has no `node_modules` of its own and resolves to the parent repository's). **Shown to be environmental:** with every source file of this branch reverted to the basis, the same three files still fail the same 10 cases in this worktree, and they pass on main in `pr3base`, which has its own `node_modules`.

**eslint** on every changed file: **exit 0**. The four validation scripts: `node scripts/validate-routes.js` **0**, `bash scripts/lint-silent-catches.sh` **0**, `bash scripts/audit-cost-exposure.sh` **0**, `node scripts/check-root-junk.js` **0** (`head-final-validation.txt`).

## Real-delete contention and a bounded jittered sweep (MEASURED, run last and alone on the cluster)

Through a harness deliberately kept **out of the pull request** (untracked, deleted after its run). Provider, storage and model are doubles; the network guard recorded **0 external attempts**. Full account: `/root/pr3-evidence/impl/SWEEP.md`.

| | cells / runs | 40P01 | 500 | retry exhausted | database text | reference made on an already-removed set |
|---|---|---|---|---|---|---|
| each corrected writer vs the REAL delete, both arrival orders, both kinds (16 writers × 2 × 2) | **64 cells** | **0** | **0** | **0** | **0** | **0** |
| bounded jittered sweep, 10 runs per ordered pair (16 writers × {delete anyway, delete with a replacement, the C1 event PUT with a set change, generate-venue with its base save}) | **640 runs** | **0** | **0** | **0** | **0** | **0** |

**704 contention runs, no deadlock, no 500, no retry exhaustion, no database or ORM text in any body, and no reference created on a set that had already been removed.** Every answer was the operation's own documented outcome; no response contract changed unexpectedly. Since no `RETRY` was ever exhausted, no frequency for that outcome is claimed.

Thirteen `writer-first` cells and 58 jittered runs ended with a reference on a removed set. Those are the races the **writer won**: it committed while the set was live and Delete Anyway then kept what it found, which is its documented behaviour, not a violation. The jittered runs are judged by two checks that do not depend on who won — a writer that answered a refusal while a reference exists (**0 of 640**), and the writer run **once more** against the now definitely removed set, which must refuse and add nothing (**0 of 640**).

**One flag was raised and resolved as a harness artifact:** seven W22 runs first failed the second check with `writer: 200, before: 0, after: 0` — nothing written. `approveBase` refuses by **resolving** `{ status: 404 }` rather than throwing, and the harness classified any resolved call as a 200. The classifier was corrected and the W22 pairs re-measured: 0 violations, 0 retained.

**A separate finding about the DELETE path, not about any writer** (`/root/pr3-evidence/impl/FINDING-delete-path-unmoved-references.md`): `countUses` and `moveUses` (`sceneSetUsesService.js:37-55`, `:102-193`) know nothing about `episode_lookbook_images.scene_set_id` or `location_look_variants.scene_set_id`. So a delete **with a replacement** leaves those rows on the **removed** set instead of moving them, and Delete Anyway does not report them in `uses_left`. Pre-existing on main, observed in the cell `W21|delete-replacement|writer-first`. PR 3 neither causes nor fixes it, and may not: `uses_left` reporting and the delete path are out of its scope by ruling.

# §7. What was not run, and what is not claimed

- **Every corrected site now has a case of its own.** The five that had been reviewed by reading only — W21 the lookbook venue image, W19 `linkPlace` **and** `setLead`, W11 the legacy save (driven with `LEGACY_TIMELINE_WRITES=on`), W17 the calendar spawn, and W20's `uploadVariant` — are each driven on their real protected write path in §6. **None is claimed from an unrelated test.** The one thing still not driven end to end is W16's **raw-SQL fallback** branch (`create.js:159-219`), which runs only when `models.WorldEvent` is absent; it carries the same `inLiveSet` guard as the ORM branch, and that is a reading, not an observation.
- **The combined tree** with any other open branch was **not** built or run by this work.
- **CI-only suites, and suites whose setup sends DDL or runs a migration, were read, not run.** Of the suites that touch the routes this change edits, those run are listed in §6; `lockOrderMatrix` and `lockOrderTrace` (migration in setup) were not.
- **Frequency** is claimed only where §6's sweep states a count, and only for the cells it ran.
- **Part A of the sweep orders the two sides by completion, not by a statement gate.** A gate holds a pooled connection, and the first attempt hung the run when a paused side finished first; the mid-transaction overlap is instead covered deterministically by the main suite's "writer holds the set row, the delete's own NOWAIT gets 55P03" cases and probabilistically by Part B's jitter. The gated, truly-overlapping real-delete race is therefore **covered for W1, W6, W20 and W21 only**, and inferred for the rest.
- That no ordering of these nineteen sites, the C1 writers, the finalizers and the real delete can deadlock is **INFERRED** from each taking episodes, then events, then set rows without waiting. Only the orderings run are evidence.

# §8. What this does NOT do

- **PR 3's guarantee is only that the CORRECTED writers never create, move or restore a Scene Set reference onto a removed set.** It is the writers named in §1 and §3, in the orderings run in §6.
- **The global reference-safety invariant is NOT established, and must not be reported as established, while S1 is unresolved.**
- **Syncing a beat that still references a removed set can create a NEW `scenes` row with that removed set id** (`syncBeatScenes`, §5). It runs after the beat save and after Start. **S1's.**
- **The W3→W1 move is deferred** (ruling 3). The hypothesis, recorded and not acted on: `refuseEventSet` (`src/services/eventPlaceSync.js:77`) reads the candidate set and its `other_event` with the caller's transaction but **without holding the set's row**, and `OTHER_EVENT_VERSION` (`:88`) compares `set.version_of_set_id` and the set's other event against `event.scene_set_id` taken from the row the caller passed in. Called from `src/routes/worldEvents/update.js`, that validation can therefore be decided on a state that has changed by the time the write commits: an event version released, or another event moved onto the set, between the read and the commit. **Proposed correction, for separate approval:** take the candidate set's row `FOR KEY SHARE` (live only, NOWAIT, after the episode and event locks the caller already holds) and re-read `version_of_set_id` and `other_event` **under** that lock inside the same locked transaction, answering the same `OTHER_EVENT_VERSION` 409 as now. Not implemented here; no test for it here.
- **Out, by ruling:** the C2 move route (`moveRemovedSetsForEpisode`, `src/services/sceneSetUsesService.js:467`, route `src/routes/episodes.js:1700`); acceptance; recovery of existing orphan references; generation claim ownership; the filmed-episode policy for ordinary writers (preserved and pinned as a RECORDED GAP, §6).
- **W2 still has no accepted or filmed check.** That gap is at the basis and is not widened; it is not corrected here.
- **Delete Anyway is unchanged**, including its `uses_left` reporting and the existing references it leaves.
- **Passing this suite does not authorize deployment.**
- **WRITER 8 IS STILL BROKEN AND IS THE FIRST THING THAT SHOULD FOLLOW THIS CHANGE.** Start Episode's plan rows still make a `scene_plans` reference on a removed set. It is out of PR 3 on Evoni's decision, pinned as `RECORDED GAP (W8, UNRESOLVED)`, and planned in §5a. Until it lands, **a Start Episode run remains a way for a reference to appear on a removed set**, whatever the nineteen corrected sites do.
- **The two writers of the beat→scene sync and the move route are S1's and C2's.** With W8 and `syncBeatScenes` both open, the `scene_plans` → `scenes` path is not closed end to end.
- **Ten cases in three network-guard self-test files fail in the implementation worktree** for want of its own `node_modules`. Shown to be environmental (§6), but it means `tests/unit` was never observed fully green in that worktree; it was observed fully green on main in `pr3base`.

---

**Type:** amendment.
**Rules:** the remaining Scene Set reference writers take the affected episodes first, then the set's row live only and without waiting while an episode or event row is held; a removed set answers each site's existing refusal, and the three sites that had none gain one; a lost lock is retried and then answered 409 RETRY; no database or ORM text is sent by the three sites that sent it; on Evoni's authorization and rulings set out in §2. **Mints:** nothing (no FD, XK or PE number). **Discharges:** nothing.
**Host/AWS/DB/Cognito contact (this session):** the tests ran against a private local PostgreSQL test database in the session's own container (`episode_metadata_test_pr3_r1`, created by this work). No deployed host, AWS service, production or development database, or Cognito pool was contacted for this change, and no paid provider was called.
**Production standing:** as the newest Fix Plan revision states it (`F-Deploy-1_Fix_Plan_v1.56.md`, footer): "Production's freeze is lifted (`F-Deploy-1_Fix_Plan_v1.53.md` §1)". What an agent session may do in production is set by `CLAUDE.md` and `F-Tools-5_AgentProductionAccess_Ruling_2026-10-31.md`.
