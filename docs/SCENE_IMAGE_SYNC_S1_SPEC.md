# S1: scene image synchronization — consolidated implementation specification

Design specification. Approved in design by Evoni on 2026-11-22 with the conditions recorded here. Code implementation is not authorized; see Status.

## Status

- **S1 code implementation is NOT authorized.** Nothing described here is implemented.
- **Design:** approved by Evoni on 2026-11-22, with the conditions and rulings recorded in sections 2, 7, 10A, 16 and 18.
- **Before implementation:** #3921 (PR A), #3922 (P1) and #3923 (P2a) have merged. Still required: P2b (#3926) integrated together with the Place-lock concurrency work A and B (section 0A; #3926 alone is not an independently safe deployment unit), the verification gaps in section 16 remain open, and Evoni must authorize implementation separately. None of A, B, C or S1 is authorized for implementation at this revision.
- **Unresolved production-integrity risk until S1 is implemented and verified:** today's automatic scene sync rewrites the saved scenes of accepted and filmed episodes (section 6, "Current behaviour").
- **Date of this revision:** 2026-11-22 (later the same day: sections 0A and 6 and items 10 to 14 of section 16 added; nothing removed).

**Code basis:** `origin/main` at `01a5037f93c899a2ddd1060adaa8ca0ecdea1d33` (#3919 and #3920 merged). Code is cited by function, route or component name; a line number, where given, is at that commit and is only a convenience. #3921 merged after this basis (main then at `878a22d87a9b14d6a3535f5ec18528115510e220`); nothing cited here was re-read at that commit. #3922, #3923 and #3925 have merged since (main at `5068bd137515f77cb66bc099218df9e52a82d4ae`); the body's line numbers were not re-read there either. Section 0A and the additions to sections 6 and 16 were read at `5068bd13` and at #3926's head `8ce15b38`.
**Standings:** **M** = measured (the named code was read at the basis commit, or a lock experiment was run on a local PostgreSQL 16 test database). **I** = inferred.
**History:** this document consolidates a first design draft, three addenda to it (locking and outcomes; the filmed race; the remaining code checks) and an image-dependency review, all working papers of 2026-11-22 that are not kept in the repository. Where a later paper corrected an earlier one, only the final position is stated in the body; section 17 lists what changed. In section 15, "old N" is a test's number in the first draft and its later additions, and "addendum N" its number in the locking addendum.

---

## 0. Summary

**What changes for a user**

1. Opening the Scenes tab or the Timeline no longer writes anything. `GET /episodes/:episodeId/scenes` only reads.
2. A beat's scene picks up a new image when that image is stored (generated or uploaded), with no page load needed.
3. An accepted or filmed episode's scenes are never changed automatically.
4. A background made in Scene Studio (restyle, inpaint) is never replaced automatically, including on older scenes.
5. An admin can put the beat's image back with "Restore Beat Background", after seeing before and after.
6. Replacing a set's base image never leaves a scene pointing at a deleted file. Old files are kept when in doubt.
7. Promoting an angle to base, or deleting an angle, no longer blanks scenes; they keep their last usable image.
8. If scene images could not be updated, the Episode checklist says which beat and scene, without calling the whole setup failed. Resume setup retries. If an event's place was changed without its episode's plan following, the checklist says so, and keeps saying so until the plan is actually moved.
9. An owner-run script shows what is out of date (dry run, read-only) and can apply it after a typed confirmation.
10. Admin behaviour elsewhere is unchanged.

**One distinction to keep in mind throughout:** S1's scene-number conflict check is application-level prevention among the writers that take the episode's lock. It is not a database-enforced uniqueness guarantee; only the unique index gives that, and only where the index exists (section 4A).

### Dependency order

| Order | Work | Why it comes before S1 |
|---|---|---|
| 1 | #3921 (PR A): destructive scene, beat and package operations ADMIN-only. **Merged** (main at `878a22d8`) | Shared a pinned route test with the PRs below; made `apply-scene-plan`, which hard-deletes scenes and assigns scene numbers, ADMIN-only |
| 2 | #3922 (P1): plan and Start Episode writes ADMIN-only; event-edit field rule. **Merged** (main at `809f9442`) | Gates event look generate and upload (two completion hooks) and every caller of the sync on the plan side; its rule on `scene_set_id` is what `generate-venue` must not bypass |
| 3 | #3923 (P2a): scene, set-link and footage writes ADMIN-only. **Merged** (main at `558b4409`) | Gates set restyle, dressed-angle generate and upload, the scene update route used by Restore, `from-angle`, and every Scene Studio write S1 edits |
| 4 | P2b (47 routes, subject to final verification) | Gates the seven base and angle completion routes and the destructive angle routes; makes `generate-venue` ADMIN-only; and adds the Place-lock refusal to `generate-venue` (ruled 2026-11-22). **That refusal is an early check only: it does not complete concurrency protection (section 0A). #3926 is open and unmerged** |
| 4a | Place-lock concurrency work **A** (shared rule and transactional finalizer) and **B** (paid generation and late refusal), integrated with P2b. Planned; not authorized | Section 2a and tests 82 and 88 assume `generate-venue` changes nothing on an accepted episode's event. That holds against a concurrent acceptance only after B (section 0A) |
| 4b | Place-lock concurrency work **C** (other event, Scene Set and episode writers). Planned; not authorized | Removes existing deadlocks between acceptance and event-first writers, and adds reference-aware guards. Its order relative to S1 is not yet decided |
| 5 | **S1** (this document) | Every request-side hook then sits behind an ADMIN-only write |
| 6 | S2 | Non-image propagation, built on S1's sync and warnings |

**Not required but assumed absent:** no migration, no new endpoint, no new database grant, no IAM change (section 14).

### 0A. What P2b does not do: Place-lock concurrency (A, B, C) and the S1 freeze dependency

Added 2026-11-22 after the lock-order review of #3926 (Evoni: "Clarify that P2b provides ADMIN authorization and early Place-lock checks, but does not complete concurrency protection. Document the required A/B/C integration and the S1 freeze dependency. State clearly that #3926 alone is not an independently safe deployment unit.").

**What P2b (#3926) provides.** `authorize(['ADMIN'])` on 47 routes, and on `generate-venue` one Place-lock check before any generation, storage write or event update, including the attached-set missing-base branch.

**What it does not provide.** The check runs once, with no transaction and no row lock, and generation then takes minutes. An episode accepted after the check still has its event's place changed. **#3926 alone is therefore not an independently safe deployment unit.** The same check-then-write shape exists in event look generate and upload, dressed-angle generate and upload, `scene-set-link`, return-to-everyday, Locations save and Scene Set delete.

**The planned protection (design accepted for planning; implementation not authorized).**

| Scope | Contents |
|---|---|
| A | `isPlaceLocked` becomes "locked when any canonically linked live episode is accepted" (primary by brief, non-primary by stamp, both parts of a two-part special). One finalizer helper in `utils/placeLock`: `lockEpisodes(…, { mode: 'share' })` on the linked episodes in id order, then the event row `FOR UPDATE` (`lockLiveEvent`), its own lock timeout, a re-read of the links, a re-check of the Place lock and of the event's source Scene Set, at most three attempts. No new lock service |
| B | `generate-venue` (both branches), `generateBaseScene` and its callers, event look generate and upload, dressed-angle generate and upload, and the venue-look draft finalize through A's helper after generation, with no transaction open during generation. A late refusal writes nothing, repeats no provider or storage call, and records the unlinked image's URL. Also in B: Locations save locks the event before the episode's set rows, and Start Episode re-reads the event's set under its event lock |
| C | The event-first writers (event edit, `makeEventVersion`, return-to-everyday, `scene-set-link`, `moveUses`) take the episode share lock first, together; reference-aware guards for sets and angles that accepted episodes use; venue-look save and draft ADMIN-only |

- **Minimum safe integration and deployment unit:** #3926 + A + B.
- **Why episode `FOR SHARE`, not `FOR UPDATE`:** the event-first writers insert a `scene_set_episodes` row, whose foreign key takes a key-share lock on the episode. That conflicts with `FOR UPDATE` and deadlocks; it does not conflict with `FOR SHARE`, which still makes both acceptance writes (the completion transaction and Part 2's separate update) wait.
- **Evidence (M, isolated local PostgreSQL 16 databases, the finalizer a stand-in calling the real helpers, opponents the real routes and services):** 74 interleavings. No deadlock with acceptance for primary, non-primary and two-part cases in either order; the `FOR UPDATE` variant deadlocks; the four event-first writers deadlock with acceptance on `main` today; Locations save deadlocks with the finalizer and with the event edit until it locks the event first; Start Episode writes a stale event set on `main` today.
- **Not run (I):** `moveUses` and the deliverable routes; the real finalizer inside the generation services.

**The S1 freeze dependency.** A, B and C protect what feeds an accepted episode (the event's place, sets, bases, looks, angles). They do not stop the scene sync from rewriting an accepted or filmed episode's saved scene rows; only S1's freeze does (section 6). Two ADMIN recovery workflows (a removed Scene Set under an accepted episode's beats; a deleted event Place) are designed to change plan references and links only, never saved backgrounds, and are **not to be implemented before S1's freeze is available**. A deliberate background replacement belongs to S1's Restore (section 5), not to a second image-replacement path.

### Out of scope (S2)

- **Full event-to-episode plan-location propagation** after a change of an event's place that bypasses the event edit. S1 detects and warns only (section 10A).
- **Filmed-only location mismatch (recorded 2026-11-22 as an identified production-integrity risk).** An episode with raw footage but without accepted status can still have its unlocked beat assignments moved through ordinary event editing, because `syncEpisodeEventLocation` skips accepted episodes only. S1 preserves the stored scene images and detects the inconsistent event and episode location through the existing warning mechanism; it does not move or restore plan rows. **S2 must investigate** applying the existing filmed-episode freeze, and an explicit authorized location-change workflow, to these plan mutations. Filmed scenes are not to be silently rewritten, and P1 is not expanded for this.
- **Also S2:** beat, location and set changes propagating to protected episodes; the Studio beat-angle and beat scene-set routes; approve-base propagation; a manual background lost when a scene is removed and recreated; a beat moved to a different set that has no image; worker-side completion hooks; set move writing `scenes.scene_set_id` on a filmed-only episode; the Beat Plan displaying a look variant the scene does not use.

---

## 1. Image precedence: how a beat's background is resolved

`syncBeatScenes` (`src/services/beatScenesService.js:43`) → `planWithAngles` (`src/services/planLocationsService.js`) → `beatBackground` (`beatScenesService.js:36`). **M**

| # | Candidate | Source | Conditions |
|---|---|---|---|
| 1 | Dressed angle | `scene_set_look_angles.image_url` | The beat resolved an angle; the set has the episode's look; the dressed row is `complete` with an image and not deleted |
| 2 | The beat's angle | `scene_angles.still_image_url` | Matched by `scene_plans.angle_label` (text, case-insensitive), else by the beat's kind; an imaged angle is preferred, else the first by `sort_order` |
| 3 | Nothing | – | The beat names a label or a non-base kind and no such angle exists |
| 4 | Event look | `scene_set_looks.image_url` | No angle asked; the look is `complete` or `generating` with an image, on the set the event is held at now (`world_events.scene_set_id`), made at the event's current venue; a generated look only while its recorded approved base still equals the location's approved base, unless the episode is accepted |
| 5 | Set base | `scene_sets.base_still_url` | No angle asked, no look; the set is live |

- A beat references its angle by **label text, not id** (`ScenePlan` has `angle_label`, no angle id). Deleting an angle leaves the label. **M**
- An Inside beat falls back to the base when its angle has no usable image. A non-Inside beat keeps the angle's stored URL even while the angle is `pending`, `failed` or `generating`. **M**
- **Never a scene background through the sync:** look variants (applied only to the picture the Beat Plan displays), the venue photo, the location's approved base (it only gates rule 4), angle video, depth maps, post-processed copies, mood variants (stored only inside `scene_sets.visual_language`; the `POST /scene-sets/:id/mood-variants` handler, `sceneSetRoutes.js:3382`, writes `set.update({ visual_language })`). **M**

---

## 2. Completion matrix

Classes: **Hook** = a new or changed image should reach unprotected scenes, so the path calls the sync. **Keep** = a source is nulled or gone; the scene keeps its stored image. **Delete** = a stored file is deleted; needs the locked still-used check. **Resolve** = what a beat resolves to changes with no image written; picked up at the next hook, beat save, export, Resume setup or reconciliation. **None** = cannot affect a scene.

"Sync call" always means `beatScenesService.syncScenesForSet(sequelize, setId, where)` (new helper, section 4), which runs the existing `syncBeatScenes` per unprotected episode. Protected-episode behaviour is the same on every row: **the sync skips accepted and filmed episodes under the episode lock and writes nothing.**

### 2a. Request-side completion hooks (14 image-sync paths and 1 detection path, on 14 routes, plus Restore)

| # | Path | File:line | Changes a beat's background? | Where the sync call goes | Gate |
|---|---|---|---|---|---|
| 1 | POST `/scene-sets/:id/generate-base` | `sceneSetRoutes.js:1372` → `generateBaseScene` (`sceneGenerationService.js:935`) | Yes: base beats, and angles that are the base picture (`repointBaseAngles`, `:865`) | Optional `afterStore` callback of `generateBaseScene`, run after the set save and `repointBaseAngles`, **before** `deleteOldBaseImage` (`:1020`). The route answers 202 first; the image is stored afterwards in the same handler | P2b |
| 2 | POST `/scene-sets/:id/upload-base` | `:1123` | Yes | Inline, after the set update (`:1183`) and repoint, before `deleteOldBaseImage` (`:1198`) | P2b |
| 3 | PUT `/scene-sets/:id` when `base_still_url` changes | `:622` | Yes | After the update, only when the stored base changed | Already ADMIN |
| 4 | POST `/scene-sets/:id/regenerate-background` (base, or an angle with `angle_id`) | `:3110` → `sceneStudioController.regenerateSceneSetBackground` (`:1337`; writes at `:1411`, `:1425`) | Yes | After the angle or set update | P2a |
| 5 | POST `/scene-sets/:id/promote-to-base` | `:2724` (base `:2750`, other angles nulled `:2772`) | Yes, and Keep for the nulled angles | After both updates | P2b |
| 6 | POST `…/angles/:angleId/generate` | `:1737` → `generateAngle` (`sceneGenerationService.js:2256`) | Yes | `afterStore` callback of `generateAngle`, after the angle row is saved (also covers `useBaseAsAngle`, `:2102`). The route answers 202 first | P2b |
| 7 | POST `/scene-sets/:id/generate-all-angles` | `:3258` | Yes | Once, at the end of its `run()`, after the last angle is stored | P2b |
| 8 | POST `…/angles/:angleId/regenerate` | `:2092` → `regenerateAngleRefined` (`:2612`) | Yes | After the angle save | P2b |
| 9 | POST `…/angles/:angleId/upload` | `:1861` (write `:1892`) | Yes | After the angle update | P2b |
| 10 | POST `/world/:showId/events/:eventId/look/generate` | `worldEvents/looks.js` → `venueLookImageService` | Yes: the look step (rule 4; it also soft-deletes the look's dressed angles) and the base step (first base for a venue set, through `generateBaseScene`) | One call at the end of the service's `run()`, after `dropDressedAngles`. The base step is covered by hook 1's callback | P1 (#3922) |
| 11 | POST `…/look/upload` | `worldEvents/looks.js` | Yes | After the look row is written and dressed angles dropped | P1 (#3922) |
| 12 | POST `/episode-brief/:episodeId/dressed-angles/:angleId/generate` | `episodeBriefRoutes.js` → `dressedAngleService` | Yes (rule 1) | End of its `run()`, after the dressed row is `complete`. Answers 202 first | P2a |
| 13 | POST `…/dressed-angles/:angleId/upload` | `episodeBriefRoutes.js` | Yes | After the dressed row is written | P2a |
| 14 | POST `/world/:showId/events/:eventId/generate-venue`, attached-set branch | `worldEvents/venue.js:84`; awaits `generateBaseScene` | Yes: the set gains its first base | Covered by hook 1's callback (same function). In the request | P2b: ADMIN only |
| 15 | POST `…/generate-venue`, new-venue branch (`force`, or no attached set) | `venue.js` → `venueGenerationService.generateVenueImages` (`:155`): creates a set with a base (`:212`), two imaged angles (`:234`, `:249`), then `UPDATE world_events SET scene_set_id` (`:271`) | It would, indirectly: the event's place changes, so an event look on the old set stops applying (rule 4). Plan rows are **not** moved (raw update; `syncEpisodeEventLocation` is not called). **S1 does not let this change a stored scene:** it is the event-location inconsistency of section 10A | **Detection, not image sync.** After the event update, for each live episode whose event this is: run the per-episode sync, which detects the inconsistency, keeps the affected scenes and writes the warning | P2b: ADMIN only, and refused on an accepted episode's locked event place |
| + | PUT `/scenes/:id` with `restore_beat_background` | `scenes.js` → `sceneController.updateScene` (`:266`) | Yes: that one scene | Scene-scoped sync inside the handler (section 5) | P2a |

**Final count: 14 image-sync hook paths and 1 detection path, on 14 routes, plus Restore.** Rows 14 and 15 are the two branches of `generate-venue`; row 15 syncs no image, it detects and warns.

**`generate-venue` in P2b:** `authorize(['ADMIN'])` goes directly after `requireAuth`, before `aiRateLimiter`, so no paid generation, storage write or event-location update runs for a signed-out or non-admin caller. The existing implementation is kept; no second venue-generation pathway is added.

**Place lock on `generate-venue` (P2b, not S1; ruled 2026-11-22):** P2b also makes the route refuse, with the existing Place-lock service and refusal, when the event's episode is accepted, before any generation, storage write, set creation or event update, including with `force: true`. S1 is written for the state after P2b: on an accepted episode's event the route changes nothing, so no inconsistency is created there by this route. Before P2b the route had no such check and could move such an event's place; that is history, not a state S1 runs in. **Correction (same day):** P2b's check is an early check. Against an acceptance that commits while generation is running, "changes nothing" holds only after scope B (section 0A); S1 therefore follows the integrated unit #3926 + A + B, not #3926 alone.

### 2b. Deletion points

| Path | File:line | What | Rule |
|---|---|---|---|
| `deleteOldBaseImage` | `sceneGenerationService.js:883`, called from `generateBaseScene` (`:1020`) and upload-base (`sceneSetRoutes.js:1198`); also reached by the worker's `generate_base` and `cascade_regenerate` jobs | The set's previous base file | Section 9 |

No other stored file in the chain is ever deleted. **M:** the only other delete sites are angle video (`sceneGenerationService.js:2572`, `:2577`) and the venue photo (`sceneSetRoutes.js:1053`–`:1112`), neither in the chain. Angle stills, look images, dressed images, look-variant images and Studio outputs are never deleted, and every stored key carries a timestamp, so no file is overwritten in place.

### 2c. Keep-previous cases

| Path | File:line | Effect on the source |
|---|---|---|
| Promote-to-base | `sceneSetRoutes.js:2772` | Every other angle's still set to null (kept in history) |
| DELETE `…/angles/:angleId`, DELETE `/:id/angles` | `:1842`, `:2017` | Angle soft-deleted; the beat keeps its label; files stay |
| DELETE `/scene-sets/:id` without a replacement | `:987` | The base reads as null for beats still pointing at the set |

Rule: when a beat resolves to no image and its scene already holds an image **on the same set**, the scene keeps it (`kept_previous`).

### 2d. Resolution changes with no image written

Approve and un-approve base (`:2612`, `:2625`); angle PATCH (label, kind, status), reject, reorder; new pending angles (create, `suggest-angles-from-image`, `spec/create-angles`, time and season variants); `analyze-image` (`:1269`) and `apply-template` (`:3468`), which destroy **only** angles with no image and status `pending` or `failed` (`:1339`, `:3498`); the event's set or venue changing; set move; locations save. These are S2 or reach scenes at the next hook.

### 2e. Cannot affect a scene

Look-variant generate, upload and delete (upload stores `scene-sets/<set>/variants/<kind>-<value>-<timestamp>.<ext>`, a new key each time; nothing is deleted); mood variants; venue photo; post-process; angle video; depth; favorite; cover angle; `PUT …/venue-look` and `POST …/venue-look/draft` (they write the event's `venue_look` text only). **M**

### 2f. Worker and queue completions

| Job | Reaches scenes by |
|---|---|
| Worker `generate_base`, `cascade_regenerate`, `generate_angle`, `regenerate_angle` | The next request-side hook on that set, a beat save, export, Resume setup, or reconciliation |
| Refinement queue (`auto-refine`) | The same. **Today these jobs never run:** `registerWorker` (`src/queues/sceneRefinementQueue.js:98`) is called only by a unit test; no server, app or worker file registers it. **M** |

No hook is placed inside code the worker runs (section 12).

---

## 3. Read-only scenes GET

- **Today (M):** `GET /api/v1/episodes/:episodeId/scenes` (`src/routes/episodes.js:887`) calls `syncBeatScenesQuietly` at `:891`–`:892` before `sceneController.getEpisodeScenes`.
- **Change:** remove those lines. The route reads stored rows only.
- **Effect:** an older episode whose scene rows were never made shows no scenes until a hook, a beat save, export, Resume setup or the reconciliation script makes them. Episodes started since #3919 have their rows from Start Episode.

---

## 4. The sync algorithm

`syncBeatScenes(sequelize, episodeId, opts)` becomes `planBeatScenes` + `applyBeatScenes`, in one transaction per episode.

1. **Open a transaction.**
2. **Lock the episode:** `lockEpisodes(sequelize, [episodeId], { transaction })` (`src/utils/episodeLocks.js:63`, default mode `update` = `FOR UPDATE`, which also sets `SET LOCAL lock_timeout`, 10 seconds).
3. **Freeze check, as fresh statements after the lock:** `snapshotFrozen` for filmed, and a read of `episodes.evaluation_status` for accepted. Never a value read before the lock. If protected and `opts.includeProtected` is not set: return `protected`, issue no other statement.
3a. **Event-location check** (reads only; section 10A): runs for every episode, protected or not, straight after the freeze check. Its result travels in the outcome object so the caller can write or clear the `event_location` warning. A protected episode still returns `protected` and writes no scene.
4. **Plan** (`planBeatScenes`, reads only): resolve each beat through `planWithAngles` and `beatBackground`; read the episode's live tied scenes; for each beat decide `create`, `update`, `remove`, `unchanged`, `kept_manual`, `kept_previous`. The manual rule (section 5), keep-previous (2c) and the event-location hold (10A) are applied here. The planner takes **no options**.
4a. **Scene-number conflict check** (reads only, in the plan step, under the episode lock; ruled 2026-11-22; section 4A):
   - **One read:** `SELECT id, scene_number, scene_plan_id, title FROM scenes WHERE episode_id = :episodeId AND deleted_at IS NULL`, every live scene of the episode, tied **and untied**. One read per sync is enough for every writer that takes the episode lock, because none of them can run until this transaction ends. It is not enough against a writer that bypasses the lock (section 4A lists them).
   - **Final numbering, not current numbering.** The planner works out where every tied scene will be at the end of this sync: kept at its number, moved to its beat's number, or soft-deleted. A number is **free for a beat** when no live scene holds it other than (i) the beat's own scene (the scene being updated is excluded), (ii) a tied scene this same sync is moving to another number, or (iii) a tied scene this same sync is soft-deleting.
   - **A beat conflicts** when its desired number (`beat_number`) is held by any other live scene of the episode that is staying where it is: an untied legacy scene (`scene_plan_id IS NULL`), or a tied scene that is not moving. This holds whether or not the beat's own scene is already at that number, so a duplicate left by an earlier race is reported, not hidden.
   - **Fixed point.** A tied scene whose own move is in conflict stays where it is, which can block another beat. The planner repeats the test until no further beat becomes conflicted. Two tied scenes exchanging numbers, or a run of tied scenes each shifting by one, are therefore **not** conflicts.
   - **Outcome for a conflicting beat:** `conflict`, reason `scene_number_held`, with the holding scene's id and title. **Nothing is written for that beat:** its existing scene row, if any, keeps its number, background, set and angle; no scene is inserted. Other beats continue. The episode's outcome is `failure`. The warning goes through the existing `setup_status.warnings.scene_sync` entry (section 10), with `{ beat, scene_id, title, reason: 'scene_number_held', held_by: { scene_id, title } }`.
5. **If nothing would be written:** commit and return `unchanged`.
6. **Shared advisory lock:** `SET LOCAL lock_timeout = '5s'`, then `pg_advisory_xact_lock_shared(<class>, <id>)` with a fixed two-integer key.
6a. **Apply the numbering first, so the index is never transiently violated** (where it exists). In this order:
   1. Soft-deletes (they free numbers under the partial index).
   2. **Renumbering in one savepoint, in two statements,** for the tied scenes whose number changes and whose beat is not in conflict: first every such scene to a number above every number in use in the episode and above the highest beat number; then each to its beat's number. Neither statement can meet a number another live scene holds. This is the same two-pass method the scene reorder uses today (`sceneController.reorderScenes`, temporary numbers from 1000) and that the scene-delete fix in #3925 uses (`renumberLiveScenes`); S1 implements it inside `beatScenesService`, with no new service.
   3. If either statement nevertheless fails with a unique violation (a writer that bypasses the episode lock took a number in between), the savepoint is rolled back, so every scene is back at the number it had; each beat in that renumbering is reported `conflict`, reason `scene_number_race`; the other beats continue.
7. **Apply, each beat in its own `SAVEPOINT`:**
   - **Guarded update:** `UPDATE scenes SET … WHERE id = :id AND deleted_at IS NULL AND background_url IS NOT DISTINCT FROM :seen AND <source still current>`.
   - **Source still current**, by where the URL came from: set base → `EXISTS (… scene_sets WHERE id = :setId AND base_still_url = :url AND deleted_at IS NULL)`; angle → `EXISTS (… scene_angles WHERE id = :angleId AND still_image_url = :url AND deleted_at IS NULL)`; look or dressed image → no predicate (those files are never deleted).
   - **Zero rows affected** is not an error: re-resolve that beat once; if it still does not apply, its outcome is `stale_source` or `changed_elsewhere`.
   - **Insert** keeps the existing `ON CONFLICT (scene_plan_id) … DO NOTHING` (`beatScenesService.js:112`). The insert runs only for a beat the conflict check passed. **The unique index, where it exists, stays as the final guard:** a unique violation (SQLSTATE 23505) on `idx_scenes_episode_scene_number` inside the beat's savepoint is still caught and mapped to the same `conflict` outcome (reason `scene_number_race`), and the other beats continue (section 4A).
8. **Commit.** Return the outcome object (section 10).

`syncScenesForSet(sequelize, setId, where)`: lists the episodes with a live beat on that set (a read, outside any transaction), runs the per-episode sync for each in ascending id order, never throws, and returns the worst outcome. A `busy` episode is retried once after a short delay.

`syncBeatScenesQuietly` stays as the never-throw wrapper and returns the outcome object (today it returns nothing useful).

**Call sites today (M), none inside an open transaction:** Start Episode (`episodeGeneratorService.js:980`), Resume setup (`:393`), generate-plan (`episodeBriefRoutes.js:301`), beat save (`:499`–`:500`), export (`export.js:74`–`:75`). The three route callers of `generateEpisodeFromEvent` (`worldEvents/episodeGenerate.js:55`, `episodeBatch.js:101`, `:135`, `:291`) pass no transaction. No CLS namespace is configured, so a transaction is never attached implicitly.

---

## 4A. The scene-number unique index: production has it, a freshly migrated database does not

**Recorded facts (M, from the repository's own records; no database was read for this document):**

- **Production has** the partial unique index `idx_scenes_episode_scene_number` on `scenes (episode_id, scene_number) WHERE deleted_at IS NULL`. Two recorded reads say so: finding D9 of `docs/reads/2026-11-04-runtime-ddl-inventory.md` (a read of 2026-11-04: the index exists, owned by `postgres`), and the header of `tests/integration/beatScenesProductionShape.integration.test.js` (a read-only capture of production's `scenes` table on 2026-11-06, which lists a unique index on `(episode_id, scene_number) WHERE deleted_at IS NULL`).
- **No file under `src/migrations` creates it.** The only code that names it is the scene delete handler, `sceneController.deleteScene` (`src/controllers/sceneController.js:405`, `:429`), which drops and re-creates it around renumbering at run time. So a freshly migrated test database has no such index until a test deletes a scene through that handler, after which the shared table has it for the rest of the run.
- **A separately authorized fix, not part of S1,** removes that run-time index change from scene deletion without adding a migration. After it, a freshly migrated database never gains the index, and the difference from production remains.
- **The development server:** not known. The read-only query in `docs/reads/2026-11-04-runtime-ddl-check.sql` (section D9) answers it.

**What the sync does with a scene number today (M, `syncBeatScenes`, `src/services/beatScenesService.js:43`):**

- It reads only the episode's **tied** live scenes (`scene_plan_id IS NOT NULL`). An untied scene is never read, so the sync does not know which numbers untied scenes hold.
- A tied scene whose plan row was replaced by a re-plan (an "orphan") is reused by the new beat with the same number, so the sync steps round its own orphans.
- A new scene is inserted with `scene_number = beat_number`. The insert's `ON CONFLICT (scene_plan_id) WHERE deleted_at IS NULL AND scene_plan_id IS NOT NULL DO NOTHING` (`:112`) guards the plan-link index **only**. It does not cover the scene-number index.
- An existing tied scene whose beat number changed is updated to the new number with a plain `UPDATE` (no guard).

**Today, the per-beat conflict exists only as a violation of this index (M).** A legacy untied scene, or any live scene the sync did not read, holds beat N's number:
- **Index present:** the `INSERT`, or a renumbering `UPDATE`, fails with a unique violation (23505). The error leaves `syncBeatScenes`, so every later beat is skipped; writes already made stay, because each statement is its own transaction. `syncBeatScenesQuietly` (`beatScenesService.js:128`) logs it and returns nothing.
- **Index absent:** no error. The insert succeeds and the episode has two live scenes with the same number.

**Today's renumbering can also violate the index on its own (M).** When a tied scene's number no longer equals its beat's number, the sync restores it one row at a time, in beat order, each a separate autocommitted `UPDATE scenes SET … scene_number = :scene_number … WHERE id = :id` with no ordering or temporary value (the update inside the beat loop of `syncBeatScenes`). Tied scenes get out of step because other writers renumber them: the scene delete renumbers **every** live scene of the episode 1..n, tied ones included, and the scene reorder renumbers the scenes it is sent. If the tied scenes for beats 2 and 3 hold numbers 3 and 2 (a swap), or the scenes for beats 2..14 hold 1..13 (after an untied scene numbered 1 was deleted), the first update sets a scene to a number its neighbour still holds. With the index present that is a 23505 on the first beat and the sync stops; with it absent it is a transient duplicate that the later updates remove. Step 6a of section 4 fixes this.

### The approved rule (Evoni, 2026-11-22)

S1 adds an application-level conflict check to the existing sync (section 4, steps 4a and 6a): after the episode lock, inside the sync's transaction, it detects another live scene of the same episode already holding the desired number, including an untied legacy scene, excluding the scene being updated. A conflict is a per-beat failure: existing rows are preserved, other beats continue, and the warning goes through the existing scene-sync warning. The unique index, where it exists, remains the final database guard. No new service, migration, index-management operation or warning system is introduced.

| Situation | Index present | Index absent |
|---|---|---|
| A conflict visible under the episode lock (an untied legacy scene, or a tied scene that is staying put, holds the number) | Beat `conflict` (`scene_number_held`); nothing written for it; others continue; warning | **The same** |
| Tied scenes exchanging or shifting numbers within one sync | Not a conflict; two-pass renumbering; the index is never violated | **The same;** no transient duplicate either |
| A writer that bypasses the episode lock takes the number after the check and before the write | The write is refused by the index inside its savepoint; beat `conflict` (`scene_number_race`); others continue; warning | **A duplicate number can still be created.** The next sync of that episode sees it under the lock and reports `conflict` |

**Stated limitation.** The read check does not guarantee global uniqueness against writers that bypass the episode lock. Where the index exists it closes that gap; where it does not, a duplicate scene number remains possible and is reported at the next sync, not prevented.

### Writers of a scene's number, and whether they take the episode lock

**M** at `01a5037f` for "today"; #3925 (the scene-delete fix, not merged when this was written) read from its branch.

| Writer | How it chooses or changes a number | Episode lock today | After #3925 | After S1 |
|---|---|---|---|---|
| The sync (`syncBeatScenes`) | Beat number; restores tied scenes' numbers | No | No | **Yes** |
| Restore, reconciliation `--apply` | Through the sync | – | – | **Yes** |
| `POST /episodes/:episodeId/scenes/from-angle` (`episodes.js`) | Highest number + 1 (`Scene.getNextSceneNumber`) | No | No | **Yes** (section 8) |
| Legacy timeline save (`POST /episodes/:id/save`) | The client's `scene_number`, else position, for every sent scene | No | No | **Yes** (section 7) |
| Scene delete (`sceneController.deleteScene`) | Renumbers every live scene 1..n; on main it drops and re-creates the index around it | No | **Yes** (two-pass, no index change) | Yes |
| Scene reorder (`sceneController.reorderScenes`) | Renumbers the sent scenes 1..n in two passes; on main the temporary numbers start at 1000 | No | **Yes;** #3925 also changes the temporary range so it cannot meet a number in use (approved; in progress when this was written) | Yes |
| Scene create (`sceneController.createScene`) | Highest + 1 | No | No | **No (bypasses)** |
| Scene duplicate (`sceneController.duplicateScene`) | Highest + 1 (`Scene.max`) | No | No | **No (bypasses)** |
| `apply-scene-plan` (`routes/scriptParse.js`) | The parsed plan's numbers; with `clearExisting` it first hard-deletes the episode's scenes | No | No | **No (bypasses)** |
| Legacy script `parse-scenes` (`scriptsService`, raw `INSERT INTO scenes`) | The parsed script's numbers | No | No | **No (bypasses)** |
| Footage upload (`routes/footage.js`) | The uploaded file's scene number, or null | No | No | **No (bypasses)** |
| Scene update (`sceneController.updateScene`) | Does not write `scene_number` (it is not in the handler's allowed list) | – | – | – |
| Set move (`sceneSetUsesService.moveUses`) | Does not write `scene_number` | – | – | – |

After S1 the bypassing writers are scene create, scene duplicate, `apply-scene-plan`, legacy `parse-scenes` and footage upload. Create and duplicate choose the highest number plus one, so they collide with a beat only when a beat's number is above every existing scene's. Who may call them: `apply-scene-plan` is ADMIN-only since #3921 (merged) and legacy `parse-scenes` since #3920 (merged); scene create, scene duplicate and footage upload become ADMIN-only with #3923 (P2a, not merged when this was written). Making them take the episode lock is not part of S1.

### Application-level prevention versus a database guarantee

These are two different things, and S1 provides only the first.

| | Application-level prevention (S1's conflict check) | Database-enforced guarantee (the unique index) |
|---|---|---|
| What it is | A read of the episode's live scenes, taken by the sync under the episode's lock, and a refusal to write a number another scene holds | `idx_scenes_episode_scene_number`, a partial unique index on `scenes (episode_id, scene_number) WHERE deleted_at IS NULL` |
| Whom it binds | Only writers that take the episode's lock and so take turns with the sync | Every writer, whatever it locks |
| Where it exists | Wherever S1's code runs | In production, by two recorded reads (2026-11-04 and 2026-11-06). **No migration creates it,** so its presence on any other database, including the development server and every freshly migrated test database, is not assured |
| What it promises | The sync will not itself create a duplicate number from a state it can see | No two live scenes of an episode share a number, ever |

- **Writers that take the episode's lock** (so the check holds against them): the sync, Restore and reconciliation apply; after #3925, scene delete and scene reorder; after S1, the legacy timeline save and `from-angle`.
- **Writers that do not** (so the check does not hold against them): scene create, scene duplicate, `apply-scene-plan`, legacy `parse-scenes`, footage upload.
- **What a reader should conclude:** on a database that has the index, scene numbers are unique per episode, and S1 turns what would have been a failed sync into a per-beat `conflict` with a warning. On a database without it, S1 prevents the duplicates the sync itself would have made and reports the ones other writers make, at the next sync.
- **What a reader should not conclude:** that S1 makes scene numbers unique, or that a passing S1 test suite on a freshly migrated database shows anything about uniqueness.
- **What would make it a guarantee everywhere:** a migration that defines the index, so every database has it. That is a separate decision. It is not part of S1, which adds no migration and performs no index management.

**Consequences for S1's tests (no migration, no index management):**

- Every test that depends on a scene-number collision runs on **isolated** tables in **both** configurations: index absent (as freshly migrated) and production-shaped (index present), built the way `beatScenesProductionShape.integration.test.js` builds its table, in its own schema placed first on the connection's `search_path`.
- **No S1 test creates, drops or alters anything on the shared `public.scenes` table**, and none relies on another test having deleted a scene.
- Tests 47, 55, 59, 62, 71, 72, 76 and 90 to 103 state the expected result per configuration. For conflicts visible under the lock the two results are now identical.

---

## 5. Manual Studio background protection, and Restore

**Writers of a scene's background today (M):**

| Writer | Source |
|---|---|
| `syncBeatScenes` | The beat's image |
| `saveCanvas` (`sceneStudioController.js:177`) | Any string the client sends |
| `regenerateBackground` (`:1285`), `inpaint` (`:1537`) | A new Studio file under `scene-studio/<sceneId>/…` |
| `sceneController.updateScene` (`:266`), `createScene` (`:159`) | The client's body |
| `POST /episodes/:episodeId/scenes/from-angle` (`episodes.js:1926`) | The angle's still |
| Legacy timeline save (`episodes.js:179`) | The client's body |

None records an author, lock or log.

**Marker (no migration):** inside the existing `scenes.canvas_settings` JSON: `background_source = { kind: 'studio', url, at, by }`.
- Written by `regenerateBackground` and `inpaint` in the same statement as `background_url`, with a targeted `jsonb_set`.
- `saveCanvas`, `suggestObjects` (`:1459`) and `generateDepth` (`:1765`) change from whole-object writes to targeted JSON updates so they cannot erase it.
- A client cannot set or clear it: `saveCanvas` strips the key from client input.

**Manual rule (in the planner):** a scene is manual when the marker's `url` equals its stored background, **or** its stored background contains `/scene-studio/<its own id>/`. The path is the compatibility signal for historical rows, not the permanent guarantee. A manual scene keeps its background; its set, angle, number and plan link still follow the beat.

**Stale Canvas save:** `saveCanvas` writes `background_url` only when the value is this scene's own Studio output (the marker's URL or the path rule). Any other echoed value is ignored. `saveCanvas` inserts only `scene_assets` rows, which reference scenes, sets, angles and assets, not episodes, so it never waits on an episode lock. **M**

**Restore Beat Background**
- **Where:** the Background section of `InspectorPanel.jsx` in Scene Studio, beside "Change"; shown for a beat-tied scene whose background is manual or differs from the beat's image.
- **Preview:** a confirm dialog shows the current background and the beat's current image (from the plan read, which writes nothing since #3919). Nothing is sent until confirmed.
- **Route:** the existing `PUT /api/v1/scenes/:id` with `{ restore_beat_background: true }`.
- **Authorization:** ADMIN always, on every episode, checked with `userInGroup(req.user, 'ADMIN')` (and by `authorize` on the route after P2a). A non-admin gets 403 before any write.
- **Server:** same transaction shape as a one-beat sync (episode lock, freeze state read, shared advisory lock, guarded update), clears the marker. Beat has no image: 409, nothing changed. On an accepted or filmed episode it proceeds, because it is an explicit ADMIN action.
- **Also:** a background sent directly to `updateScene` for a tied scene of a protected episode requires ADMIN. The handler accepts both spellings, `background_url` and `backgroundUrl` (and `scene_set_id`/`sceneSetId`, `scene_angle_id`/`sceneAngleId`); the rule covers every spelling in its allowed list. **M**

---

## 6. Freeze rules

- **Accepted (M):** `episodes.evaluation_status = 'accepted'`, written by `episodeCompletionService` under `FOR UPDATE` on the episode.
- **Filmed (M):** any row in `episode_raw_clips` for the episode, removed rows included (`snapshotFrozen`, `peekFrozen` and `frozenEpisode.filmedAt` all read `SELECT MIN(created_at) … FROM episode_raw_clips WHERE episode_id = :episodeId` with no `deleted_at` filter).
- **Enforcement:** step 3 of the algorithm. A protected episode gets no automatic write, including no soft-delete.
- **Filmed race, closed:** the only raw-clip insert in `src/` and `scripts/` is in `rawClipsService.attachClip`, whose first statement is `lockEpisodes(…, { mode: 'share' })`. The sync's `FOR UPDATE` and the clip's `FOR SHARE` wait for each other in both orders (section 8, experiments). No clip writer changes.
- **Beat save on a protected episode:** the plan row still saves; the sync returns `protected`; the response says scenes are frozen.
- **Export:** calls the same sync; on a protected episode it renders stored images. On an unprotected episode manual backgrounds are kept by section 5.
- **Scope, restated (Evoni, 2026-11-22, section 16 item 10):** the freeze applies when an episode is accepted **or** has raw footage, at every automatic entry point: the scenes read, export, Resume setup, beat saves and the image-completion hooks. It preserves backgrounds, Scene Sets, angles, canvas data and manually approved imagery. It stays in S1's scope; no partial version of it goes into A, B or C.
- **Current behaviour (M at `8ce15b38`; an unresolved production-integrity risk until S1 is implemented and verified):** `syncBeatScenes` has no accepted or filmed check. It runs on `GET /episodes/:id/scenes`, on export, at Start and Resume setup, after generate-plan and after a beat save, and rewrites `scenes.background_url`, `scene_set_id` and `scene_angle_id` whenever live resolution differs from the stored row. For an accepted episode a base-served beat at a soft-deleted Scene Set gets an empty background at the next read (the sync joins live sets only): read from the code, not run, and whether it has happened on any server is not known. An accepted episode can also have no scene rows at all (nothing at acceptance creates them; Part 2 of a two-part special starts with none).

---

## 7. Legacy timeline save fix

`POST /api/v1/episodes/:id/save` (`src/routes/episodes.js:179`): 410 unless `LEGACY_TIMELINE_WRITES=on`, then ADMIN. **M**

**Ruling (Evoni, 2026-11-22):** "For beat-tied scenes, ignore client-supplied background, Scene Set and angle fields, including omitted, null, nested and stale values. Protect those fields through the existing canonical plan and Scene Studio workflows. Preserve other authorized timeline edits and the current behavior of untied scenes. Keep the episode-first locking correction and concurrency tests in S1."

**What the handler does today (M, read in full):** in one transaction it reads the episode with **no lock**, optionally locks the timeline row, then for each sent scene builds a fixed `fields` object and either updates the matching live scene or creates a new one. The client's scene object is never spread into the row, so there is no alias or nested path: each column is read from exactly one key.

**A beat-tied scene** is a row with `scene_plan_id` not null. That is the predicate the same route already uses to decide a scene "belongs to its beat" (`timelineSaveGuard.scenesToRemove`, `src/utils/timelineSaveGuard.js:91`). **M**

| Column written per scene | Read from | Today when the key is omitted or null | Beat-tied scene after S1 | Untied or new scene after S1 |
|---|---|---|---|---|
| `background_url` | `scene.background_url` | **Set to null** (`|| null`) | **Ignored: the stored value is kept** | As today |
| `scene_set_id` | `scene.scene_set_id` | **Set to null** | **Ignored: kept** | As today |
| `scene_angle_id` | `scene.scene_angle_id` | **Set to null** | **Ignored: kept** | As today |
| `scene_number` | `scene.scene_number`, else position | Position in the list | Written as today | As today |
| `title` | `scene.title` | "Scene N" | Written as today | As today |
| `duration_seconds` | `scene.duration_seconds` | 5.0 | Written as today | As today |
| `characters` | `scene.characters` | `[]` | Written as today | As today |
| `ui_elements` | `scene.ui_elements` | `[]` | Written as today | As today |
| `dialogue_clips` | `scene.dialogue_clips` | Left alone when not sent | Written as today | As today |

**Change (about 8 lines):**
1. `lockEpisodes(sequelize, [id], { transaction: t })` as the first statement of the transaction, before the timeline row lock.
2. For a matched row with `scene_plan_id` set, the three protected keys are left out of `fields` altogether, whatever the client sent: a value, a stale value, `null`, nothing, or the same data under another key or nesting (which the handler never reads). The stored values stay.
3. Untied scenes, and scenes the save creates (always untied), behave exactly as today, including the null-on-omit behaviour.
4. Those three columns on a beat's scene are changed only by the canonical plan (the sync) and by Scene Studio (restyle, inpaint, Restore).

**Unchanged:** the timeline-basis stale-save refusal, the removal rules, the timeline upsert, and every other field the Timeline edits.

## 8. Lock design

### Final lock order

| Participant | Order |
|---|---|
| Sync, Restore, reconciliation `--apply` | Episode `FOR UPDATE` (via `lockEpisodes`, 10 s) → freeze check → shared advisory (two-integer key, 5 s) → scene rows |
| (the scene-number conflict check) | Reads the episode's live scenes after the episode lock and before the advisory lock, in the same transaction. **It takes no lock of its own;** no new lock is introduced |
| `from-angle` scene create | Episode `FOR UPDATE` (via `lockEpisodes`) → shared advisory → `INSERT … SELECT` reading the angle's current still |
| Legacy timeline save (after section 7) | Episode `FOR UPDATE` → timeline row → scene rows |
| Clip attach | Episode `FOR SHARE` → clip insert |
| Acceptance, episode update, episode delete | Episode `FOR UPDATE` → their own tables; no scene rows |
| Base-image deleter | `pg_try_advisory_xact_lock` (exclusive, never waits) → still-used check → storage delete (2 s limit) |
| Studio writers (`saveCanvas`, restyle, inpaint), set move, scene reorder | Scene rows only |

**Invariant.** A source file is deleted only if, while holding the exclusive advisory lock, no live `scenes` row has `background_url = url` and the existing `imageStillUsed` checks are also false. Every writer that stores a set-derived URL holds the shared lock and proves in the same statement that the URL is still its source row's current value.

**Key:** the two-integer advisory form, with a fixed class constant. It is a separate key space from the single-key form that all nine existing advisory-lock call sites use, so no hash collision with them is possible.

### Measured (PostgreSQL 16, local test database)

| Experiment | Result |
|---|---|
| `FOR SHARE` held, `FOR UPDATE` requested (1 s timeout) | Waits; 55P03 at 1,002 ms |
| `FOR UPDATE` held, `FOR SHARE` requested | Waits; 55P03 at 1,001 ms |
| `FOR SHARE` held, `FOR SHARE` requested | No wait (1 ms) |
| Sync first, then clip | Clip waited 703 ms until the sync committed; the next sync saw the clip |
| Clip first, then sync | Sync waited; its freeze check after the lock saw the clip |
| Sync read "no clips" before the clip was inserted | Its check after the lock still saw the clip |
| Child insert while parent held `FOR UPDATE` | Blocked (55P03 at 1,000 ms) |
| Another episode's lock and inserts while one is locked | No wait (0 ms) |
| 20 shared advisory holders | Acquired in 6 ms total |
| Deleter's failed try, then a 21st shared request | No queue (0 ms) |
| Waiting exclusive request with a later shared request (the convoy) | The shared request waited 3,705 ms behind it; this is why the deleter uses the try form |
| Unrelated sync while a deleter holds for its 2 s limit | Waited 2,002 ms, inside the 5 s timeout |
| Second deleter while the first holds | Fails at once; no queue |
| Legacy save (scene update, then scene insert) against a sync, unfixed | 40P01 deadlock after 1,000 ms |
| Advisory functions executable by every role | Yes |

### Timeouts

- **Episode lock:** 10 s (existing `lockEpisodes`). On timeout the sync returns `failure`/`busy`.
- **Shared advisory lock:** 5 s. On timeout `failure`/`busy`; `syncScenesForSet` retries that episode once, then records a warning.
- **Deleter:** never waits. Lock not granted → the file is kept and the event logged.
- **Storage delete:** its own 2-second limit; on expiry the transaction ends, the lock is released, the unconfirmed delete is logged.

### Why it cannot deadlock

- The deleter holds only the advisory lock, takes no row lock and never waits.
- Every participant that takes both an episode lock and scene rows takes the episode first; after section 7 that includes the legacy save, and `from-angle` by Evoni's condition 5.
- Shared advisory holders do not block each other.
- Participants that take only scene rows never ask for an episode or advisory lock afterwards.
- `episodeController.updateEpisode` locks the episode as its first statement; the delete handler too; none of the twelve other `lockEpisodes` users writes scenes or calls the sync inside its locked transaction. **M**

### Contention

- **Per episode:** while one episode's sync runs, a clip upload (which already retries three times), another sync of that episode, and any insert that references that episode wait. A sync is a handful of statements. **I** for the duration.
- **Across episodes:** none, except behind a deleter's hold, bounded by the 2 s storage limit.
- **Lock mode:** `update`, the only write mode `lockEpisodes` offers (`MODES`, `episodeLocks.js:28`) and the one `snapshotFrozen` requires. No third mode is added.

---

## 9. Source-reference protection and deletion failure behaviour

**Order for a base replacement:** save the new base → `repointBaseAngles` → `syncScenesForSet` → open the delete transaction → try the exclusive advisory lock → `imageStillUsed` (now also `EXISTS live scenes WHERE background_url = :url`, as a separate query that keeps the file on any error) → storage delete (2 s limit) → commit.

Storage operations are not transactional and cannot be rolled back, so every failure point resolves to **keep the file**:

| Failure point | Resulting state |
|---|---|
| New base save fails | Nothing changed; old file in use |
| Crash or error after the save, before the sync | Set shows the new base; scenes still show the old file; **no delete was issued** |
| Sync fails or returns `busy` for an episode | Its scenes still hold the old URL; the still-used check sees them; **file kept**; warning recorded |
| Advisory try-lock not granted | **File kept**, logged |
| Scenes check errors or is denied (worker role) | Treated as "in use"; **file kept** |
| Check passes, storage delete times out or errors | Lock released; logged; the file may or may not exist; **no scene references it**, because the check ran under the lock |
| Storage delete succeeds, commit then fails | Same: no live scene referenced the URL at the check, and no writer could add one meanwhile (they need the shared lock and the source-still-current predicate, which is already false) |
| A sync resolved the old base before the save and writes after the delete | Its guarded update affects zero rows (the set row holds the new URL); it re-resolves to the new base |

**Accepted cost:** protected and manual scenes keep their URLs, so their files are kept and accumulate, as do files kept on a lost try. Cleanup is a separate, gated action.

**Residual risk, stated plainly:** an ADMIN can still paste any URL into `updateScene` or `createScene`. The invariant covers source-derived writes only.

---

## 10. Sync outcomes, warnings, Resume setup

### Return contract

```
{ episode_id,
  outcome: 'success' | 'unchanged' | 'protected' | 'failure',
  reason,            // 'accepted' | 'filmed' | 'busy' | 'error' | 'beats_failed'
  created, updated, removed, kept_manual, kept_previous,
  beats: [{ beat, scene_id, title, outcome, reason }] }
```

- **Per beat:** `created`, `updated`, `removed`, `unchanged`, `kept_manual`, `kept_previous`, `stale_source`, `changed_elsewhere`, `conflict`, `error`.
- **`success`:** at least one write and no failed beat. **`unchanged`:** nothing to write. **`protected`:** only the lock and the check ran. **`failure`:** a beat failed or the episode could not be processed; beats that succeeded stay committed.
- `syncScenesForSet` returns `{ set_id, outcome, episodes: [...] }`, the worst of its episodes, or `failure`/`lookup` when the episode list could not be read.

### What each caller does

| Caller | success / unchanged | protected | failure |
|---|---|---|---|
| Start Episode, Resume setup | Proceed; the clearing rule runs | Resume reports it | Warning persisted; `steps` and `complete` untouched |
| generate-plan, beat save | Response gains `scene_sync: { outcome }` | Plan saved; response says scenes are frozen | Request still succeeds; warning persisted; response lists the failed beats |
| Export | Renders | Renders stored images | Renders stored images; warning persisted |
| Image completion routes | Response (or the stored job result, for 202 routes) gains `scene_sync` | Listed per episode | The image is saved; warning persisted per episode |
| Reconciliation | Printed | Printed | Printed; non-zero exit |

### Warning persistence

- **Where:** `episodes.setup_status` (JSONB), at `warnings.scene_sync = { at, where, scenes: [{ beat, scene_id, title, reason }] }`.
- **Write:** a targeted `jsonb_set` that does not name `steps` or `complete`, in its **own** statement after the sync's transaction ends, so a rolled-back sync cannot take its warning with it.
- **Writers of `setup_status` (M):** `recordSetupStatus` (`episodeGeneratorService.js:358`), which overwrites the whole object from a copy read earlier; and `seasonSlotService`, which already uses a targeted update and preserves other keys. No route accepts `setup_status` from a client. **I** for the last.
- **Race fixed:** `resumeEpisodeSetup` (`:378`) reads the episode, runs the sync (`:393`), then overwrites the status, erasing a warning written during that resume. `recordSetupStatus` changes to build its value in SQL, merged with the row's current `warnings`. It never reads then writes.
- **If writing the warning fails:** logged with the episode and the original reason; the original outcome is still returned; one immediate retry. There is no second durable store: the next sync of that episode reproduces the failure and the reconciliation dry run lists it. This is a stated limit.
- **A set-level `lookup` failure** has no episode to attach to: logged and returned only.

### Clearing only after verified recovery

A beat's entry is removed only when all three hold:
1. A later sync of the same episode returns `success` or `unchanged` and that beat's outcome is `created`, `updated`, `unchanged`, `kept_manual` or `kept_previous`.
2. A fresh read of the scene row, after that sync commits, matches what the plan wanted (or is a manual or kept-previous background).
3. The clear is conditional on the warning's `at` being the one that was read, so a newer warning is never cleared.

The `scene_sync` key is removed when its list is empty. A protected skip neither creates nor clears a warning. If an episode becomes protected while warned, the warning stays, the checklist adds "This episode is frozen; an admin can restore the scene.", and it clears through an ADMIN Restore or `--apply --include-protected`.

### Display

`EpisodeProductionChecklist.jsx` shows a separate line, "Scene images did not update: beat N (scene title): reason", with the existing Resume setup button. It does not show "Setup did not finish." for this. `setup_status` is not in `EPISODE_SAFE_FIELDS`, so non-admin readers receive no warning. **M**

---

## 10A. Event-location inconsistency (generate-venue and any other bypass)

**Ruling (Evoni, 2026-11-22):** "Approve deferring full event-to-episode plan-location propagation to S2. However, S1 must not silently treat a changed linked-event location as fully synchronized when its episode plan still references the previous location. Preserve the stored scenes, detect the inconsistency, and expose it through the existing episode setup warning mechanism. The warning must not clear until the inconsistency is actually resolved. Do not automatically rewrite accepted or filmed episodes."

### Who writes an event's place (M, search of `src` at `01a5037f`)

| Writer | File:line | Calls `syncEpisodeEventLocation`? |
|---|---|---|
| Event edit (`PUT /world/:showId/events/:eventId`) | `routes/worldEvents/update.js:616` | Yes |
| Scene-set link to an event | `services/eventSceneSetLinkService.js:96`, sync at `:99` | Yes |
| Set version made or removed | `services/sceneSetVersionService.js:150` (sync `:153`), `:204` (sync `:207`) | Yes |
| Event look generation choosing a set | `services/venueLookImageService.js:191`, sync at `:194` | Yes |
| Episode Locations save (the other direction) | `services/episodeLocationsService.js:211` | Not needed: it writes the event **from** the episode's Event location in the same transaction |
| Set move (`moveUses`) | `services/sceneSetUsesService.js:168` | Not needed: it moves the links, beats, looks, events and scenes together |
| **`generate-venue`, new-venue branch** | `services/venueGenerationService.js:271` | **No. This is the only bypass found** |

Even the writers that do call it leave some episodes behind by design: `syncEpisodeEventLocation` (`services/eventPlaceSync.js:26`) skips **accepted** episodes, and moves only plan rows that are not `locked` and not `chosen_by_user`. So the inconsistency below can also arise, legitimately, on an accepted episode after an ordinary event edit.

### The inconsistency, exactly

For an episode E whose event is V by the canonical rule (`episodeEventIdSql`, `src/utils/episodeEventSql.js`: the live brief's event, else the first event stamped with the episode; the same predicate `syncEpisodeEventLocation` uses):

> V's place `world_events.scene_set_id` is a set **Y** (not null), and E's live Event-location link (`scene_set_episodes` with `role = 'event'`, `deleted_at IS NULL`) is on a different set **X**.

- **Affected beats:** E's live plan rows on X (`scene_plans.scene_set_id = X`, `deleted_at IS NULL`).
- **Not an inconsistency:** V has no place; or E has no Event-location link (nothing references a previous place; `syncEpisodeEventLocation` would simply add the link).
- **At the `generate-venue` hook only**, the previous place is also known directly (the event's `scene_set_id` before the update), so an episode with plan rows on that set and no Event-location link is flagged too.

### What S1 does

- **Detects** in step 3a of the sync, on every sync of that episode, with reads only; and at the `generate-venue` new-venue completion, by running the per-episode sync for each live episode whose event it is.
- **Preserves the stored scenes.** While the inconsistency holds, the planner gives every affected beat the outcome `kept_previous` with reason `event_location`: its scene's background, set and angle are not written. Without this, the event look would stop applying (rule 4 needs the look's set to be the event's current set) and the scene would silently swap to an angle or the old set's base. Beats on other sets sync normally. A scene that has no stored image yet is created as usual.
- **Never rewrites the plan.** No `scene_plans`, `scene_set_episodes` or `world_events` row is written by S1 for this. Accepted and filmed episodes are not touched at all (the sync returns `protected`), and they still get the warning.
- **Warns** through the existing mechanism, as a sibling of `scene_sync`:

```
setup_status.warnings.event_location = {
  at, where,                      // when and which path detected it
  event_id, event_name,
  event_set_id,                   // Y: where the event is now
  plan_set_id,                    // X: where the episode's plan still is
  beats: [{ beat, scene_id, title }]
}
```

  Same writer (a targeted `jsonb_set` that names neither `steps` nor `complete`, in its own statement), same preservation by `recordSetupStatus`' SQL merge, same retry-once rule if the write fails.
- **Checklist line** (`EpisodeProductionChecklist.jsx`): "This episode's event moved to another place. Beats N, M still use the previous place; their scenes were left as they were. An admin can move them in Locations." For an accepted or filmed episode: "…This episode is frozen; its scenes were left as they were."
- **Outcome object:** gains `event_location: { consistent: true } | { consistent: false, event_set_id, plan_set_id, beats }`, so callers and the reconciliation dry run report it.

### Clearing only after it is actually resolved

The warning is recomputed on every sync and removed only when a **fresh read after the sync commits** shows either:
1. E's Event-location link is on V's current place and no live plan row with `locked = false AND chosen_by_user = false` remains on X (the state `syncEpisodeEventLocation` produces); or
2. V's place is X again (the event was moved back); or
3. E no longer has that event.

The clear is conditional on the warning's `at`, so a newer warning is never cleared. A sync that merely succeeds does not clear it. Resume setup does not clear it unless one of the three holds.

### Who resolves it

- **Unfinished episode:** an ADMIN saves the episode's Locations (`PUT /episodes/:episodeId/locations`, P2a), which moves the beats and writes the event's place from the episode; or edits the event's place (P1 field rule), which runs `syncEpisodeEventLocation`. S2 will do this propagation automatically.
- **Accepted episode:** after P2b `generate-venue` can no longer create the inconsistency there (it is refused by the Place lock) when the episode was accepted before the request; an acceptance during generation is closed only by scope B (section 0A). Where it exists for another reason, the Locations save refuses (409 `EPISODE_ACCEPTED`) and `syncEpisodeEventLocation` skips the episode, so the warning stays until the event's place is the plan's again. It is not cleared by any automatic path.
- **Filmed-only episode:** S1 treats it as protected (scenes untouched) and warns. Note that an ordinary event edit still moves such an episode's unlocked beats today; that is the S2 item in section 0.
- **Visibility:** `setup_status` is not in the non-admin safe fields, so only ADMIN readers see it. **M**

## 11. Reconciliation script

`scripts/reconcile-beat-scenes.js`, owner-run.

- **Scope:** `--episode <id>` or `--show <id>` is required.
- **Dry run by default.** It calls only `planBeatScenes`, the same planner the sync uses, so dry run and apply cannot diverge. It prints, per beat, have / want / outcome.
- **Read-only enforced by the database:** the dry run's transaction begins with `SET TRANSACTION READ ONLY` and ends with a rollback. PostgreSQL refuses any write (SQLSTATE 25006). It takes no advisory lock and no row lock.
- **`--apply`:** prints the plan and the count of episodes and scenes that would change; requires that count typed back. Without a terminal it refuses unless `--confirm <count>` matches.
- **`--include-protected`:** read in exactly one place, the accepted/filmed check (step 3). It still takes the episode lock.
- **Manual protection is absolute:** the manual rule lives in the planner, which takes no options; `applyBeatScenes` has no branch that writes a background for `kept_manual`. There is no override flag.
- **Production:** a run against production follows the CLAUDE.md gates.

---

## 12. Worker boundaries

- **Grants (M, `workerDbGrants.js`):** `generation_jobs`, `scene_sets`, `scene_angles`, `world_locations`, `world_events`, `ai_usage_logs`. No privilege on `scenes`, `scene_plans` or `episodes`. **Unchanged by S1.**
- **Under the worker role:** the advisory try-lock works (no grant needed); the new scenes check is denied; `imageStillUsed` treats the error as "in use"; the file is kept. So a worker cascade **never** deletes an old base after S1 (today it can).
- **No hook runs in the worker.** Worker and queue completions reach scenes through the next hook, a beat save, export, Resume setup or reconciliation.
- **No IAM, S3 or database permission changes.**
- **To verify operationally:** see "Outstanding environment and runtime verification gaps" in section 16.

---

## 13. Behaviour by scene type

| Scene | Before S1 | After S1 |
|---|---|---|
| Accepted episode | Rewritten on a scenes read, beat save or export | Never changed automatically; ADMIN Restore, or the script with `--include-protected` |
| Filmed episode | Same | Same as accepted |
| Manually edited in Studio (marker) | Overwritten by the next sync | Background kept; set, angle, number follow the beat; Restore returns it |
| Unfinished episode | Caught up on reads | Caught up when an image is stored, on beat save, export and Resume setup; never blanked on the same set |
| Legacy tied, Studio path, no marker | Overwritten | Kept (path rule) |
| Legacy tied, stale source URL | Caught up on read | Caught up at the next hook or by reconciliation |
| Legacy untied (no `scene_plan_id`) | Untouched | Untouched |
| Duplicate of a scene | Untied; no background copied | Same; pinned by a regression test |

---

## 14. Change list

**No migration. No new endpoint. No database grant. No IAM change.**

| File | Change | Size |
|---|---|---|
| `src/services/beatScenesService.js` | Plan/apply split; episode lock; freeze check; scene-number conflict check and two-pass renumbering (inside this service: no new service, no migration, no index management); manual rule; keep-previous; event-location hold; guarded write; savepoints; outcomes; `syncScenesForSet`; scene-scoped Restore; warning write and clear | ~290 lines |
| `src/routes/episodes.js` | Remove the sync from the scenes GET; legacy save fix; `from-angle` lock order and `INSERT … SELECT` | ~30 |
| `src/controllers/sceneStudioController.js` | Marker writes; `saveCanvas` rule; targeted JSON updates; hook in set restyle | ~75 |
| `src/controllers/sceneController.js` | Restore branch; ADMIN check on a direct background for protected episodes | ~45 |
| `src/routes/sceneSetRoutes.js` | Hook calls (upload-base, set PUT, promote, angle upload, generate-all); order around the base delete | ~40 |
| `src/services/sceneGenerationService.js` | `afterStore` callbacks in `generateBaseScene`, `generateAngle`, `regenerateAngleRefined`; scenes check in `imageStillUsed`; locked delete with try-lock and storage timeout | ~60 |
| `src/services/venueLookImageService.js`, `dressedAngleService.js`, `venueGenerationService.js`, `routes/worldEvents/looks.js`, `routes/worldEvents/venue.js`, `routes/episodeBriefRoutes.js`, `routes/export.js` | Hook calls; outcome in responses | ~50 |
| `src/services/episodeGeneratorService.js` | `recordSetupStatus` SQL merge preserving `warnings`; Resume clears on verified recovery | ~25 |
| `scripts/reconcile-beat-scenes.js` | New | ~160 |
| Frontend: `InspectorPanel.jsx`, `SceneStudio.jsx`, `EpisodeProductionChecklist.jsx`, their CSS | Restore button and dialog; warning line | ~130 |
| `docs/EVENT_EPISODE_FLOW.md` | Dated as-built note | small |
| `docs/audit/` | One new amendment file | new |

**Tests:** new `tests/integration/sceneSyncS1.integration.test.js`, `sceneSyncLocks.integration.test.js`, `reconcileBeatScenes.integration.test.js`, a Vitest file for the Restore dialog and one for the checklist line; changes to `beatScenes.integration`, `beatScenesProductionShape`, `sceneBaseImageKept`, `workerRestrictedRole`, the timeline-save suites.

---

## 15. Acceptance tests

Mechanisms: `tests/helpers/lockTrace.js` (`gate()` pauses between two statements, `byTransaction()` reads lock order, `records` counts writes); the restricted-role pattern of `tests/integration/workerRestrictedRole.integration.test.js`; a storage double that records puts and deletes and can delay or fail; a `READ ONLY` transaction for refusal. "Old" gives the earlier number(s).

### A. Read-only GET
1. Stale or missing scene rows; a viewer, an editor and an admin each read the scenes list → `lockTrace` records no write; rows unchanged; signed out 401. *(old 1)*

### B. Completion hooks
2. Unfinished episode; each of the 14 image-sync hook paths stores its image → the beat's scene shows it with no GET sent. *(old 2, 61)*
3. The same completion fired twice → the second writes nothing; `updated_at` unchanged. *(old 3)*
4. The five routes that answer first (generate-base, angle generate, generate-all, look generate, dressed generate): the image arrives after the response → the scene updates with no GET. *(old 59)*
5. A regenerated look moves a scene off its dressed angle in one sync; a later dressed generate moves it back. *(old 60)*
6. `generate-venue`, attached-set branch: the Inside beats' scenes show the new base. *(old 61)* The new-venue branch is tests 80–86.
7. Look variants: with a complete Night variant displayed in the Beat Plan, the scene's background is the plain base and no scene row holds a variant URL; regenerate, upload and delete of the variant change no scene and delete no file. *(old 52, 53)*
8. `analyze-image` and `apply-template` on a set used by an unfinished, an accepted, a filmed and a manual scene → every imaged angle survives; no scene changes; no storage delete. *(old 54)*
9. Un-approving a base leaves a scene on a generated look unchanged until a hook or sync runs; an accepted episode's scene never changes. *(old 62)*

### C. Freeze
10. Accepted episode: every hook, beat save, export, Resume setup → no scene row changes; export returns stored images. *(old 4)*
11. Filmed episode whose only clip is soft-deleted: the same. *(old 5, 36)*
12. First clip commits first, through the multipart path, with the sync gated before its episode lock → the sync returns `protected`/`filmed`; no scene write. *(old 32)*
13. The same through the single-request upload path. *(old 33)*
14. Sync locks first, gated before commit; `createClip` is called → the clip insert is not recorded until the sync commits; a further sync returns `protected`. *(old 34)*
15. After test 14, every automatic path leaves every scene row byte-identical. *(old 35)*
16. A sync that already read "no clips" still returns `protected` when a clip commits before its lock (freeze check placement). *(old 45)*
17. The sync's trace shows the episode `FOR UPDATE` before the freeze read, the advisory lock and any scene write. *(old 37)*
18. Acceptance race: acceptance waits for a gated sync; a sync after acceptance returns `protected` and writes nothing. *(old 11)*
19. Episode held `FOR UPDATE` past 10 s: the clip attach retries, then succeeds or answers its existing error; no half-written clip. *(old 38)*

### D. Manual backgrounds
20. A scene with the marker, and one with only the legacy path: every hook, beat save, export, resume and script `--apply` leave the background unchanged while set, angle and number follow the beat. *(old 6)*
21. Stale tab: `saveCanvas` with an old source URL leaves the background unchanged; with the scene's own Studio URL it is written. *(old 7)*
22. `saveCanvas`, `suggestObjects` and `generateDepth` after an inpaint leave the marker; a client-sent marker is ignored. *(old 8)*
23. A sync gated between read and write; an inpaint lands → the inpaint and its marker remain; the beat's outcome is `kept_manual`. *(old 9, addendum 6)*
24. The same with a Canvas save. *(addendum 7)*
25. Guard: every Studio writer of a scene background writes the marker and stores under `scene-studio/<sceneId>/`. *(old 20)*

### E. Restore
26. ADMIN, unfinished episode: the scene gets the beat's image and the marker is cleared; with no beat image, 409 and nothing changed; signed out 401. *(old 10, amended)*
27. Non-admin, on an unfinished, an accepted and a filmed episode: 403, row unchanged, no write in the trace. *(old 10, 11, amended to ADMIN always)*
28. ADMIN on an accepted and on a filmed episode: succeeds and changes only that scene. A direct `background_url` on a protected tied scene by a non-admin: 403. *(old 11)*
29. An ADMIN Restore gated after its lock makes a clip attach wait; a Restore after the clip still succeeds. *(old 44)*
30. A warning on a newly accepted episode survives every automatic path and clears after an ADMIN Restore. *(addendum 25)*

### F. Promote and keep-previous
31. Promote-to-base: scenes on the reset angles keep their previous image and their files exist; regenerating the angle updates them; the promoted angle's beats and the base beats both show the promoted picture. *(old 12, 57)*
32. Angle delete, one and all, with a labelled beat on it: the unfinished scene keeps its image (`kept_previous`); protected and manual scenes unchanged; the file exists. *(old 55)*
33. Reject, and a PATCH to `pending`: a non-Inside scene keeps the still; an Inside scene shows the base; protected scenes unchanged. *(old 56)*
34. A set soft-deleted without a replacement: unfinished scenes keep their stored image. *(old 58)*
35. Promote-to-base with a concurrent sync: previous images kept; nothing deleted. *(addendum 9)*

### G. Deletion and failure injection
36. A base replaced while an accepted episode's scene shows the old one → the old file is not deleted; with only soft-deleted scenes showing it, it is deleted; the sync is observed before the delete. *(old 13)*
37. The delete transaction's trace: the exclusive advisory try, reads only, no row lock; the storage delete is called before its commit. *(addendum 2)*
38. Late reference: a sync gated after resolving the old base; the base is replaced and the delete completes → the sync's update affects zero rows; the scene never holds the deleted URL; it ends on the new base. *(addendum 3)*
39. Early reference: a sync wrote the old base before the delete → the file is not deleted; no scene points at a missing file. *(addendum 4)*
40. The same two cases with Restore, and with reconciliation `--apply`, as the writer. *(addendum 8)*
41. Failure injection, `generate-base`: the scenes check forced to throw, the sync forced to fail, and the transaction rolled back, each after the new base is saved → no storage delete is issued; every live scene's file exists. *(old 63, 15)*
42. Failure injection, `upload-base`: the same three cases. *(old 64)*
43. The storage delete returns and the commit then fails → no live scene references the deleted URL. *(old 66)*
44. Storage delete delayed past 2 s → the exclusive lock is released, later syncs succeed, the failure is logged. *(old 41)*
45. Concurrent base replacement and sync on one set, repeated → no live scene points at a deleted file. *(old 14)*

### H. Locks, concurrency, contention
46. Lock order: a sync, a Restore, a `from-angle` create and a legacy save each show episode `FOR UPDATE` → advisory (where used) → scene writes, by `byTransaction()`. *(addendum 1, amended for from-angle)*
47. Two syncs of one episode at once: the second waits, then finds nothing to do; one live scene per beat. *(old 17, addendum 5, amended)* **Run in both configurations (section 4A).** The same result with and without the index: the second sync waits on the episode lock, reads the first one's rows, and writes nothing; no duplicate number exists in either.
48. Base replacement and a multi-set episode sync started in each order, repeated → both finish; no 40P01. *(addendum 10)*
49. Sync, acceptance, clip attach and episode delete on one episode, each pairwise order, repeated → all finish; no 40P01. *(old 43)*
50. Writer timeout: the exclusive lock held by a test session → the sync returns `failure`/`busy`, writes nothing, is retried once, then records a warning. *(addendum 12)*
51. Deleter never waits: with a shared lock held, the delete returns at once, the file is kept, and a sync started meanwhile is not delayed. *(old 39, addendum 13)*
52. No convoy: a long sync and a base replacement at once do not delay a second sync on another episode. *(old 40)*
53. Unrelated episodes: with one episode's sync gated under its lock, a sync, a clip attach and a scene create on another episode complete without waiting. *(old 50)*
54. Bounded deleter hold: with the storage double at its limit, an unrelated sync waits no longer than that limit and then succeeds. *(old 51)*
55. A scene create on an episode whose sync is gated completes after the sync commits, inside 10 s. *(old 49)* **Run in both configurations (section 4A).** The create does not take the episode lock (section 4A): it waits only on the foreign-key lock, then takes highest + 1. If that number is a beat's: index present, the later write that collides is refused and reported; index absent, the duplicate exists and the next sync reports `conflict`. Both are asserted as the stated limitation.
56. Key space: holding the S1 advisory lock does not block the rate-card or voice-footage locks, and the reverse. *(old 42)*

### I. Outcomes, warnings, Resume setup
57. Each of `success`, `unchanged`, `protected` (accepted; filmed) and `failure` is returned with its documented fields. *(addendum 16)*
58. A protected skip writes nothing and neither creates nor clears a warning. *(addendum 17)*
59. One conflicting beat (an older untied scene holding its number): the other beats commit; outcome `failure`; the warning names the beat and scene; `steps` and `complete` byte-identical. *(old 16, addendum 18, 19)* **Run in both configurations (section 4A).** With the conflict check the result is **the same in both**: beat `conflict` (`scene_number_held`), nothing written for it, the other beats commit, outcome `failure`, the warning names the beat and the holding scene.
60. A warning survives `recordSetupStatus`, including when written during that same Resume setup; and survives the season-slot writer. *(addendum 20, 21)*
61. Warning write forced to fail: the outcome is still returned and logged; one retry; the next sync reproduces the failure. *(addendum 22)*
62. A `success` while the named scene row still differs does not clear the warning; after the cause is fixed and Resume setup verifies the row, the entry is removed and the key goes when empty. *(old 16, addendum 23)* **Run in both configurations (section 4A).** The same in both configurations: the warning exists in both and clears in both only after verified recovery.
63. A newer warning is never cleared by an older clear. *(addendum 24)*
64. Non-admin episode reads carry no `setup_status`. *(addendum 26)*

### J. Reconciliation
65. Dry run: zero write records and a `READ ONLY` transaction in the trace; a write injected into the planner is refused by the database. *(old 18, addendum 27)*
66. The dry run's planned changes equal the rows `--apply` then changes. *(addendum 28)*
67. `--apply` without the typed count, or with a wrong one, writes nothing. *(addendum 29)*
68. Protected episodes change only with `--include-protected`. *(addendum 30)*
69. With `--apply --include-protected`, marked scenes and legacy-path scenes keep their background byte for byte. *(addendum 31)*

### K. Legacy timeline save
70. With `LEGACY_TIMELINE_WRITES=on`, a save and a sync on one episode in each order both finish; no 40P01. *(old 46)*
71. Beat-tied scene, table-driven over `background_url`, `scene_set_id` and `scene_angle_id`, each sent as: a new value, a stale value, `null`, omitted, and all three together → the three stored columns are byte-identical after the save; the scene's title, duration, number, characters and dialogue clips **are** saved. *(old 47, extended; ruling 3)* **Run in both configurations (section 4A).** A sent `scene_number` that collides with another live scene: index present, the save fails as today with nothing written; index absent, it is saved as today and the next sync reports the conflict. After S1 the save holds the episode lock, so it and a sync take turns (test 97).
72. The same inputs for an untied scene, and for a scene the save creates → written exactly as on main, including null when omitted. *(ruling 3)* **Run in both configurations (section 4A).** The same collision rule as test 71.
73. Look-alike and nested keys for a beat-tied scene (`backgroundUrl`, `background`, `sceneSetId`, `scene.scene.background_url`, `canvas_settings.background_source`) → none reaches the row, and the marker is unchanged. *(condition 2; ruling 3)*
74. A stale save (older timeline basis) is still refused as today, with nothing written, for tied and untied scenes. *(condition 2)*

### L. Duplicate and from-angle
75. A duplicated scene has no `scene_plan_id`, no `background_url` and no marker; every automatic path leaves it unchanged; duplicating during a gated sync waits, then succeeds. *(old 48, condition 3)*
76. `from-angle` reads the angle's current still inside its insert; with a base replacement racing it, the created scene never holds a deleted URL. *(addendum lock table)* **Run in both configurations (section 4A).** After S1 `from-angle` holds the episode lock, so it takes highest + 1 from a settled state and takes turns with the sync (test 97); the result is the same in both configurations.

### M. Worker
77. Under the worker's restricted role: the advisory try succeeds, the scenes check is denied, no storage delete is issued. *(old 15, 65, addendum 14)*
78. A cascade through the worker module leaves the scene stale and deletes nothing a scene shows; reconciliation then updates it. *(old 19)*

### N. Frontend
79. Restore dialog: shows both images; sends nothing until confirmed; hidden or disabled with the message for a non-admin. *(old 21)*
80. Checklist: shows "Scene images did not update: beat N (title): reason" with Resume setup, and not "Setup did not finish.", when only the scene-sync warning is present. *(spec §8)*

### O. Event-location inconsistency (section 10A)
81. **`generate-venue` with `force: true` on an event linked to an unfinished episode** whose scene shows the event look → the event's place is the new set; the episode's plan rows, Event-location link and every scene row are byte-identical (`lockTrace` shows no write to `scenes`, `scene_plans` or `scene_set_episodes`); the affected beats' outcome is `kept_previous`/`event_location`; `warnings.event_location` names the event, both sets and the beats; `steps` and `complete` unchanged. *(ruling 2, required)*
82. `generate-venue` with `force: true` on an event linked to an **accepted** episode → refused by the Place lock (P2b, which S1 follows): no provider call, no storage write, no new scene set, the event's place, the plan rows and every scene row byte-identical; no warning is created, because nothing became inconsistent. The warning path for accepted episodes is exercised by test 87. *(ruling 2; Place-lock ruling)*
83. `generate-venue` with `force: true` on an event linked to a **filmed-only** episode (one raw clip, and separately one soft-deleted clip; not accepted) → the route proceeds (the Place lock covers accepted episodes); the sync returns `protected`; every scene row byte-identical; the plan rows unchanged; `warnings.event_location` is present. *(ruling 2; filmed-only ruling)*
84. The warning survives `recordSetupStatus`, Resume setup, a beat save on another set, export, every image hook and a second `generate-venue`; a sync that returns `success` or `unchanged` does not clear it. *(ruling 2)*
85. It clears only when resolved: after an ADMIN Locations save moves the beats (unfinished episode); after the event's place is set back to the previous set; and it does **not** clear while one unlocked, unchosen plan row remains on the previous set. A newer warning is not cleared by an older clear. *(ruling 2)*
86. Beats on other sets of the same episode still sync normally while the warning holds; a manual scene on the affected set is unchanged. *(ruling 2)*
87. An accepted episode whose Event-location link differs from its event's current place (set up directly in the test, and separately reached through a writer that calls `syncEpisodeEventLocation`, which skips accepted episodes) → every sync returns `protected`, writes no scene, and writes `warnings.event_location`; the warning survives every automatic path and clears only when the event's place is the plan's again. A filmed-only episode after an ordinary ADMIN event edit: its unlocked beats are moved by the existing code (the S2 risk), its scenes are byte-identical, and no warning remains once link and plan agree. *(10A; Place-lock and filmed-only rulings)*
88. P2b dependencies, asserted again in S1's suite so a regression is caught where it matters: on `generate-venue` a signed-out caller gets 401 and a non-admin 403, and an ADMIN with `force: true` on an accepted episode's event gets the Place-lock refusal, each with no provider call, no storage write, no new scene set, no event update and no plan change. An unlinked event, and an event linked to a draft episode, behave as before for an ADMIN. *(ruling 1; Place-lock ruling)*
89. Reconciliation dry run lists the inconsistency for an affected episode and writes nothing; `--apply` does not move the plan. *(10A)*

### P. Scene-number conflicts, in both index configurations (section 4A)

All of group P runs on isolated tables, once with the index absent and once production-shaped (index present). No test alters the shared `public.scenes` table.

90. **An untied legacy scene holds the number.** Given beats 1 to 5 with sets and a legacy untied live scene holding number 3, when the sync runs → **in both configurations:** beats 1, 2, 4 and 5 have their scenes; beat 3's outcome is `conflict` (`scene_number_held`); no scene is inserted for beat 3; the untied scene is byte-identical; the episode's outcome is `failure`; `warnings.scene_sync` names beat 3 and the holding scene; `steps` and `complete` are unchanged; `lockTrace` shows no write for beat 3. No duplicate number exists in either configuration. *(rulings of 2026-11-22 on the index and on conflict handling)*
91. **The scene being updated is excluded.** A tied scene already at its beat's number, whose background changes → updated; not a conflict; in both configurations.
92. **Exchange and shift within one sync.** Given tied scenes for beats 2 and 3 holding numbers 3 and 2; and separately tied scenes for beats 2 to 6 holding 1 to 5 (as left by a scene delete's renumbering) → every scene ends at its beat's number; no beat is `conflict`; with the index present no unique violation occurs at any statement (`lockTrace` shows the two-pass renumbering in one savepoint); with it absent no two live scenes share a number at any commit.
93. **A tied scene that cannot move blocks its neighbour.** Given an untied scene at 4, and tied scenes for beats 4 and 5 holding 5 and 6 → beat 4 is `conflict`; its scene stays at 5; so beat 5 is `conflict` too and its scene stays at 6; other beats sync; nothing is written for either; the warning names both, each with what holds its number. Same in both configurations.
94. **Recovery.** After test 90, the legacy scene is renumbered or removed and the sync runs → beat 3's scene is created; a fresh read verifies it; the warning entry is removed, and the key goes when empty. A sync that runs while the legacy scene still holds the number does not clear it. Same in both configurations.
95. **Concurrent syncs of one episode.** Two syncs released together on the conflict setup of test 90, and on the exchange setup of test 92 → the second waits on the episode lock; one live scene per beat; no duplicate number in either configuration; the same outcomes as a single sync.
96. **A writer that bypasses the lock races the sync (the stated limitation).** The sync is gated with `lockTrace.gate()` after its conflict check and before beat N's insert; `createScene` (and separately scene duplicate) then commits a scene with number N. **Index present:** the insert is refused inside its savepoint; beat N is `conflict` (`scene_number_race`); the other beats commit; the warning names it. **Index absent:** the insert succeeds and two live scenes share N, and this sync reports beat N as created. The **next** sync of the episode reads both under the lock: beat N's own scene is at N, and another live scene that is staying put also holds N, so beat N is `conflict` (`scene_number_held`), nothing is written for it, the warning names the other scene, and the reconciliation dry run lists it. No scene row is lost in either configuration.
97. **Writers that take the lock take turns with the sync.** For scene delete and scene reorder (after #3925), and the legacy timeline save and `from-angle` (after S1): the sync gated under its episode lock makes each wait; each gated under its lock makes the sync wait; in both orders both finish, PostgreSQL reports no deadlock, and no duplicate number exists in either configuration. Where #3925 is not yet merged, the delete and reorder halves are marked pending on it.

98. **A three-way exchange.** Tied scenes for beats 2, 3 and 4 holding numbers 3, 4 and 2 → every scene ends at its beat's number; no beat is `conflict`; with the index present no unique violation at any statement; with it absent no two live scenes share a number at any commit. *(review of 2026-11-22: exchanges)*
99. **Manual backgrounds survive the sync's renumbering.** For a scene with the marker, and for a legacy scene with only the Studio path: the scene's number is changed by the two-pass renumbering in a swap and in a shift → `background_url` and the marker are byte-identical before and after; only `scene_number` (and set, angle, plan link where the beat changed) differs; the beat's outcome is `kept_manual`. Both index configurations. *(review: manual background preservation through renumbering)*
100. **Manual backgrounds survive other writers' renumbering.** The same two scenes, renumbered by a scene delete and by a scene reorder (as on main, and as changed by #3925), then a sync that restores their beat numbers → `background_url` and the marker byte-identical throughout. Both index configurations; the #3925 halves are pending on it. *(review)*
101. **A conflicting beat whose existing scene is manual.** A manual scene tied to beat N sits at another number, and an untied legacy scene holds N → beat N is `conflict` (`scene_number_held`); nothing is written to the manual scene (number, background and marker byte-identical); after the legacy scene is renumbered or removed, the next sync moves the manual scene to N and its background and marker are still byte-identical. Both index configurations. *(review)*
102. **Each writer that bypasses the episode lock.** (a) Gated between the sync's check and its write, as in test 96: `apply-scene-plan` commits a scene holding beat N's number → index present, beat N is `conflict` (`scene_number_race`), others commit, warning; index absent, the duplicate exists and the next sync reports `conflict` (`scene_number_held`). (b) Not gated: a scene made by scene duplicate, by legacy `parse-scenes` and by footage upload, each holding a beat's number before the sync runs → `conflict` (`scene_number_held`) in both configurations, nothing written for that beat, warning names the holder. With test 96 (scene create, scene duplicate gated) this covers all five. *(review: concurrent scene writers that bypass episode locking)*
103. **The conflict warning's whole life.** After a `scene_number_held` conflict: the warning names the beat and the holding scene's id and title; it survives `recordSetupStatus`, Resume setup and the season-slot writer; the episode is then accepted, and a sync returns `protected` and neither clears nor changes it; a sync that returns `success` for other beats does not clear it; it is removed only when a fresh read after a later sync shows beat N's scene at number N with no other live scene on N; a newer warning is not cleared by an older clear. Both index configurations. *(review: per-beat conflict warnings and recovery)*

#### Coverage of the six reviewed areas (Evoni, 2026-11-22)

| Area | Tests |
|---|---|
| Scene-number exchanges (swap, three-way, shift after a delete) | 92, 98; with a blocked neighbour 93; concurrently 95 |
| Legacy untied scenes occupying required beat numbers | 59, 90, 93, 94, 101 |
| Index-present and index-absent databases | 47, 55, 59, 62, 71, 72, 76 and 90–103, each run in both, on isolated tables |
| Concurrent scene writers that bypass episode locking | 55, 96, 102 (all five writers); the writers that do take the lock, for contrast, 97 |
| Manual background preservation through renumbering | 99, 100, 101; and without renumbering 20–25 |
| Per-beat conflict warnings and recovery | 59, 60, 62, 63, 90, 94, 103 |

**Every earlier number 1–66 appears above.** Tests 71–74 are rewritten and 81–103 are new (rulings and review of 2026-11-22). Tests 47, 55, 59, 62, 71, 72, 76 and 90–103 run in both index configurations, on isolated tables. **Total: 103.** Old 57 → 31; old 45 → 16; old 52/53 → 7; old 54 → 8.

---

## 16. Decisions, and outstanding verification gaps

### Settled (Evoni, 2026-11-22)

1. **`generate-venue`:** "Approve ADMIN authorization for generate-venue in P2b. The proposed P2b count becomes 47 routes, subject to final verification. Ensure authorization happens before any paid generation, storage operation or event-location mutation. Retain the existing implementation rather than creating another venue-generation pathway." → section 2a, rows 14–15.
2. **New-venue propagation:** "Approve deferring full event-to-episode plan-location propagation to S2. However, S1 must not silently treat a changed linked-event location as fully synchronized when its episode plan still references the previous location. Preserve the stored scenes, detect the inconsistency, and expose it through the existing episode setup warning mechanism. The warning must not clear until the inconsistency is actually resolved. Do not automatically rewrite accepted or filmed episodes. Add an acceptance test for generate-venue with force:true on an event linked to an episode." → section 10A, tests 81–89.
3. **Legacy timeline save:** "For beat-tied scenes, ignore client-supplied background, Scene Set and angle fields, including omitted, null, nested and stale values. Protect those fields through the existing canonical plan and Scene Studio workflows. Preserve other authorized timeline edits and the current behavior of untied scenes. Keep the episode-first locking correction and concurrency tests in S1." → section 7, tests 70–74.
4. **Refinement queue:** "Record a separate backlog item: auto-refine jobs may be queued without an active registered processor. Document the affected route, queue, expected worker, current registration and user-visible consequences. Do not activate a worker or change infrastructure." → section 18.

5. **`generate-venue` Place lock:** "APPROVED: Include a narrow Place-lock enforcement fix in P2b. Reuse the existing Place-lock service and refusal behavior. Check the restriction before any AI generation, storage write, Scene Set creation or event-location mutation. An ADMIN cannot bypass an accepted episode's locked event location through force:true. Keep existing valid behavior for unprotected events. Test accepted, draft, filmed-only, linked and unlinked cases, including force:true. Test that a refusal produces no paid provider call, storage write, new Scene Set, event update or plan mutation. Do not introduce another locking or authorization system. P2b's proposed 47-route count remains subject to final verification." → a P2b change, not an S1 change; section 0 (dependency order), section 2a, tests 82 and 88.
6. **Filmed-only location mismatch:** "APPROVED: Record the correction under S2. An episode with raw footage but without accepted status can still have unlocked beat assignments moved through ordinary event editing. This is an identified production-integrity risk. S1 must preserve stored scene images and detect the inconsistent event/episode location using the existing warning mechanism. S2 must investigate applying the existing filmed-episode freeze and explicit authorized location-change workflow to these plan mutations. Do not silently rewrite filmed scenes or expand P1 in this approval." → section 0 (S2 list), section 10A, tests 83 and 87.
7. **Preserving this specification:** "AUTHORIZED: Save the complete consolidated S1 design in the existing repository documentation structure on a separate documentation-only branch." This document is that record.

8. **Scene-number index:** "APPROVED: Add a focused note and acceptance-test clarification … documenting that the scene-number unique index exists in the recorded production schema but is absent from freshly migrated test databases. S1's per-beat uniqueness-conflict tests must include a production-shaped index configuration. Do not change S1 implementation code or add a migration. The S1 specification remains documentation only, and its implementation is not yet authorized." → section 4A; tests 47, 55, 59, 62, 71, 72, 76 and 90.

9. **Scene-number conflict handling:** "APPROVED: Add an application-level live-scene-number conflict check to the existing S1 sync algorithm. Requirements: Execute the conflict check after obtaining the episode lock, inside the sync transaction. Detect another live scene in the same episode already holding the desired scene number, including an untied legacy scene. Exclude the scene being updated. Treat a conflict as a per-beat failure, preserving existing scene rows and continuing other unaffected beats. Record the warning through the existing scene-sync warning mechanism. Preserve the unique index as the final database guard wherever it exists. Test on isolated databases both with and without the index. Test concurrent synchronization and relevant scene writers. Document that the read check does not guarantee global uniqueness against writers that bypass the episode lock. Do not introduce a new service, migration, index-management operation or separate warning system." → section 4 (steps 4a, 6a), section 4A, tests 90–103. Reviewed by Evoni the same day: "Keep the approved live-scene-number conflict check and two-pass synchronization plan. … The documentation must clearly distinguish application-level conflict prevention from a database-enforced uniqueness guarantee. Do not implement S1 code yet." → the subsection "Application-level prevention versus a database guarantee" in section 4A and the coverage table in section 15.

10. **Accepted and filmed scene protection:** "APPROVED: Automatic scene synchronization must not rewrite saved scenes when an episode is accepted OR has raw footage. The protection applies to all automatic synchronization entry points, including reads, exports, Resume setup, beat saves and image-completion hooks. Preserve backgrounds, Scene Sets, angles, canvas data and manually approved imagery. Keep this in the consolidated S1 scope. Do not implement a partial workaround in A, B or C. Record the current behavior as an unresolved production-integrity risk until S1 is implemented and verified." → section 6; tests 10 to 19 and 57 (unchanged).
11. **P2b and concurrency:** "Clarify that P2b provides ADMIN authorization and early Place-lock checks, but does not complete concurrency protection. Document the required A/B/C integration and the S1 freeze dependency. State clearly that #3926 alone is not an independently safe deployment unit." → section 0A; Status; dependency order rows 4, 4a and 4b. Tests 82 and 88 are unchanged: they assert the early refusal. The tests that race the real acceptance belong to A and B and are not S1 tests.
12. **Recovery of a removed Scene Set on an accepted episode:** "An ADMIN recovery of a removed Scene Set changes only the expressly selected plan reference and necessary episode–set link. The saved scene background must remain unchanged by default. Any deliberate background replacement belongs to the existing S1 Restore Beat Background workflow, with preview and explicit ADMIN confirmation. Do not create another image-replacement system." → section 5 (Restore) is the only deliberate replacement path; the recovery itself is a separate design, not part of S1.
13. **Locked-beat recovery:** "APPROVED IN DESIGN ONLY: A locked beat may be repaired without first unlocking it, but only through an explicitly confirmed, narrowly scoped ADMIN recovery action. … Do not implement before S1's freeze protection is available. Do not allow a generic confirm:true flag to bypass ordinary accepted-episode restrictions." → section 0A (the S1 freeze dependency).
14. **Deleted event Place:** "Prepare a separate read-only recovery design for accepted episodes whose event's Place was deleted. … No automatic venue replacement and no generic Place-lock bypass. Do not implement it yet." → a separate design; recorded here because it also waits on S1's freeze.

### Open

None at this revision.

### Outstanding environment and runtime verification gaps

None of these can be established from the repository. Each is to be checked on the servers, or by a read-only query, before or during S1's rollout. S1 is designed to be safe whatever the answers; they decide how often its fallback paths are exercised and what the first reconciliation dry run will show.

| Gap | Why it matters to S1 |
|---|---|
| Whether the generation worker (`episode-worker`) is running on the production and development servers (`pm2 list`) | Worker completions reach scenes only at the next hook or by reconciliation; the worker never deletes an old base after S1 |
| The value of `GENERATION_WORKER_ENABLED` on each server | Same |
| The value of `LEGACY_TIMELINE_WRITES` on each server | Whether the legacy timeline save (section 7) is reachable at all |
| Whether Redis is running on each server | Whether the refinement queue accepts jobs (section 18) |
| The value of `ADMIN_WRITE_GUARD` on each server | Not relied on by S1 or by the ADMIN-only PRs; recorded so nobody assumes it is on |
| Stored scene data: backgrounds on a Studio path without the scene's own id (historical Studio layouts); backgrounds that are a look-variant URL from older code; backgrounds whose file no longer exists | Decides what the manual rule protects on old rows and what the first dry run lists. A single read-only aggregate count on the development database is authorized and has not been run |
| Whether each server's `scenes` table has the unique index `idx_scenes_episode_scene_number` | **Production: yes,** by two recorded reads (`docs/reads/2026-11-04-runtime-ddl-inventory.md`, finding D9, 2026-11-04; the header of `tests/integration/beatScenesProductionShape.integration.test.js`, 2026-11-06). Neither has been repeated since. **Development server: not known;** the read-only query in `docs/reads/2026-11-04-runtime-ddl-check.sql` (section D9) answers it. **Freshly migrated test databases: no** (section 4A). The sync's per-beat `conflict` outcome exists only where the index does |
| PostgreSQL version: CI runs 15; the lock experiments ran on 16 | The lock modes used are long-standing; the acceptance tests run on 15 in CI |
| The deployed database connection path (direct, or through a pooler) | Transaction-scoped advisory locks are safe under transaction pooling; session-level features are not used |
| Historical Studio storage paths in older versions of the code | The repository history available when this was written was shallow |

### Not verified in the code reading

- **Line numbers** for the event look routes (`worldEvents/looks.js`), `venueLookImageService`, `dressedAngleService` and the dressed-angle routes were not re-read at the basis commit; those rows cite the function or route, not a line.
- **The existing Place-lock refusal's exact body** (409 `PLACE_LOCKED`) is quoted from the event-edit handler's behaviour as tested in #3922, not re-read here.
- **The auto-refine route's response when Redis is unreachable** (section 18) is inferred.
- **`prepareSceneBrief`** (the set `brief` route) was not read to the end; it does not bear on S1.
- **That no route accepts `setup_status` from a client** rests on a search.
- **The search for direct writers of an event's place** (section 10A) is text-based.

---

## 17. Appendix: superseded statements

| Earlier statement | Final position |
|---|---|
| Restore: any signed-in user on unfinished episodes, ADMIN on protected ones (spec §5) | ADMIN always (Evoni's ruling) |
| The sync locks the episode `FOR SHARE` (addendum 1) | `FOR UPDATE` through `lockEpisodes`; `FOR SHARE` does not conflict with the clip's `FOR SHARE` (addendum 2, measured in 3) |
| The freeze check uses `peekFrozen` (spec §2) | `snapshotFrozen`, after the lock, as a fresh statement |
| Lock: the set's generation claim, or a per-set advisory lock (spec §7) | One global, transaction-scoped advisory key in the two-integer form |
| Key `hashtext('scene_background_sources')` (addendum 1) | Two-integer key, a separate key space |
| The deleter waits for the exclusive lock with a 5 s timeout (addendum 1) | The deleter uses the try form and never waits; the storage delete has a 2 s limit |
| The sync is a series of individual guarded statements (spec) | One transaction per episode with per-beat savepoints |
| Two syncs of one episode run concurrently (addendum 1, "sync × sync") | The second waits, then finds nothing to do |
| "Filmed" race judged acceptable (addendum 1) | Closed (addendum 2; measured in addendum 3) |
| The row-lock conflict taken from PostgreSQL documentation (addendum 2) | Measured |
| `episodeController` update may write scenes before locking the episode (addendum 2) | It locks the episode as its first statement; no cycle |
| Three Studio writers set a scene background (spec §4) | Eight writers in all, adding `updateScene`, `createScene`, `from-angle`, the legacy timeline save |
| Scene duplicate "should use the same shared lock" (addendum 1) | It copies no background, plan link or marker; no lock; a regression test pins that |
| `from-angle`: shared advisory lock, then insert (addendum 3) | Episode lock first, then the advisory lock (Evoni's condition 5) |
| 13 completion points plus Restore (spec §1) | 14 image-sync hook paths and 1 detection path, on 14 routes, plus Restore: `generate-venue` adds one of each |
| "The hook goes after the handler's last write" | The hook goes where the image is stored; five routes answer 202 first |
| Look generate is one completion point | Two kinds: the look step and a base step |
| Set restyle changes the base | It can also change an angle (`angle_id`) |
| Approve and un-approve listed with hooks | Resolution changes; no image written; no hook |
| `analyze-image` and `apply-template` "destroy and recreate a set's angles" | They destroy only imageless `pending` or `failed` angles |
| Look variants may be a fourteenth image source | They never reach a scene background |
| Keep-previous covers promote-to-base | Also angle delete and a soft-deleted set |
| A worker cascade can delete an old base (today's behaviour, unstated in the spec) | After S1 it never does: the scenes check is denied under its role and the file is kept |
| `syncBeatScenesQuietly` returns nothing | It returns the outcome object |
| "S1's hooks sit behind ADMIN-only writes after P2" | True only after P1, P2a **and** P2b, and once `generate-venue` is gated |
| Legacy timeline save: "ignore a client `background_url` on a beat-tied scene" (addendum 3) | `background_url`, `scene_set_id` and `scene_angle_id` are all ignored for beat-tied scenes, whether sent, omitted, null, nested or stale (ruled 2026-11-22) |
| `generate-venue` is "in no approved scope" / "Gate: None" (first draft of this document) | ADMIN in P2b (ruled 2026-11-22); P2b is 47 routes, subject to verification |
| `generate-venue`'s new-venue branch: "S1 syncs the event's previous set" so scenes stop showing a look that no longer applies (first draft) | S1 keeps the stored scenes, detects the event-location inconsistency and warns; no image sync for that branch (ruled 2026-11-22) |
| "15 request-side hook paths on 14 routes, plus Restore" (first draft) | 14 image-sync hook paths and 1 detection path, on 14 routes, plus Restore |
| 79 acceptance tests (first draft) | 103 |
| Open decisions 1–4 (first draft) | Settled (section 16, items 1–4) |
| "`generate-venue` with `force: true` bypasses the Place lock on an accepted episode's event" listed as an open decision | Settled: P2b adds the Place-lock refusal; S1's test 82 asserts the refusal, and the accepted-episode warning path is covered by test 87 |
| Test 82: `generate-venue` `force: true` on an accepted episode "→ protected; scenes byte-identical; the warning is present" | After P2b the route is refused there; nothing changes and no warning is created |
| "Filmed-only episodes and `syncEpisodeEventLocation`" listed as an open item "flagged for S2" | Recorded under S2 as an identified production-integrity risk, with what S2 must investigate (section 0) |
| Test 59 (and the first draft's test 16): "one conflicting beat (an older untied scene holding its number)" stated without a database configuration, implying it could be shown on the migrated test database | The conflict is a violation of `idx_scenes_episode_scene_number`, which a freshly migrated database lacks; the test runs in both configurations and test 90 states each result (section 4A) |
| "A uniqueness error gets one retry" / "at most one retry" for concurrent syncs (first draft) | Two syncs of one episode serialize on the episode lock; a scene-number violation is not retried, it is reported as `conflict` |
| "Index absent: no violation occurs, so there is no `conflict` outcome and no warning; the beat is `created` and the duplicate number exists" (the first form of section 4A and of test 90) | With the approved conflict check the result is the same in both configurations for a conflict visible under the episode lock: `conflict`, nothing written for the beat, warning. Only a race with a lock-bypassing writer still differs |
| "The `conflict` outcome can be exercised only against a table that has the index" | It is reached in both configurations; the index is the final guard, not the only one |
| Open decision "Index-absent behaviour" | Settled: the application-level check (section 16, item 9) |
| The sync restores tied scenes' numbers one row at a time (today's code; unstated in earlier drafts) | Two-pass renumbering in one savepoint, so the index is never transiently violated |
| "#3921 (PR A) must be merged first" (earlier revisions of the dependency order and Status) | #3921 has merged; the remaining prerequisites are #3922, #3923 and P2b |
| "the remaining prerequisites are #3922, #3923 and P2b" (previous revision of Status) | #3922 and #3923 have merged; the remaining prerequisite is P2b (#3926) integrated with scopes A and B (section 0A) |
| "P2b … adds the Place-lock refusal to `generate-venue`" read as closing the accepted-episode bypass; "after P2b `generate-venue` can no longer create the inconsistency there" | P2b's refusal is an early check. An acceptance during generation is closed only by scope B; #3926 alone is not an independently safe deployment unit |
| "All five [bypassing writers] are ADMIN-only after #3921, #3920 and #3923" | Stated per writer: `apply-scene-plan` since #3921 and legacy `parse-scenes` since #3920 (both merged); scene create, scene duplicate and footage upload with #3923 (not merged when this was written) |
| 97 acceptance tests | 103, with a coverage table for the six reviewed areas |

---

## 18. Backlog items recorded, not part of S1

### Refinement queue: auto-refine jobs are queued with no registered processor

**No worker is activated and no infrastructure is changed by S1 or by this note.**

| Item | Finding (M, at `01a5037f`) |
|---|---|
| Route | `POST /api/v1/scene-sets/:id/angles/:angleId/auto-refine` (`src/routes/sceneSetRoutes.js:2176`; `requireAuth, aiRateLimiter`; in P2b's list). It calls `refinementQueue.addRefinementJob` (`:2202`) |
| Queue | Bull queue `scene-refinement` in `src/queues/sceneRefinementQueue.js:45`, on Redis (`redisConfig` host and port) |
| Expected processor | `registerWorker()` (`sceneRefinementQueue.js:98`), which calls `refinementQueue.process('refine-angle', 2, …)` (`:103`) and would regenerate the angle through up to three passes |
| Current registration | **None in the application.** The only caller of `registerWorker` in the repository is `tests/unit/queues/sceneRefinementQueueClaims.test.js:38`. Neither `src/server.js`, `src/app.js`, the generation worker nor `ecosystem.config.js` registers it. `autoRefineIfNeeded` (`:264`) has no caller either |
| What the route returns | 200 `{ success: true, data: { jobId, pass: 1, maxPasses: 3 } }` (and `existing: true` on a repeat click while the first job waits) |
| What then happens | With Redis reachable: the job stays `waiting` indefinitely. The angle's image, `generation_status` and quality fields do not change; nothing is charged, because no pass runs. `GET /scene-sets/refinement-queue/jobs/:jobId` keeps reporting it waiting and `GET /scene-sets/refinement-queue/stats` shows the waiting count growing. With Redis unreachable: the queue logs the connection error (`[RefinementQueue] Error: … ECONNREFUSED`, then "Redis unavailable — stopping reconnection") and the route answers an error instead (**I**: the exact status and delay were not run) |
| User-visible consequence | The request appears to succeed and promises up to three refinement passes that never happen. No frontend component was found calling the route (search of `frontend/src`), so today this is reachable only by a direct API call |
| For S1 | Nothing depends on it. If a processor is registered later, its completions reach scenes like any worker completion (section 2f) |
| Whether Redis is running on either server | Not verifiable from the repository |

**Suggested follow-up (not started):** decide whether auto-refine is wanted; if not, have the route answer plainly that it is unavailable; if so, register the processor deliberately, with its cost controls, as its own change.
