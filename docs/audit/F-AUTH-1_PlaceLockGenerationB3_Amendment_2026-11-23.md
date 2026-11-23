| **PRIME STUDIOS** **F-AUTH-1 — THE PLACE LOCK, GENERATION B3: THE LOCATIONS SAVE AND START EPISODE'S LOCATIONS UNDER THE FINALIZER'S LOCK ORDER (AMENDMENT)** *An episode's Locations save now reads the event's set under a lock and takes its rows in the Place finalizer's order; a save that moves the event is committed by the finalizer. Start Episode is told which scene set its Locations step showed for the event, refuses a Start made against a set the event no longer has, and saves its locations after the commit through the finalizer. A Start whose locations were not saved says so.* |
| --- |

**Document version**

v1.1 (v1.0 was this file at `974ae498`, on the same unmerged branch, before Evoni's correction of the same day; "Her correction" in §2, step 7 of Start Episode in §4, §4a, §8 and the test lists of §9 are what changed). This is an additive amendment, written as a new file because the register is append-only. **Mints nothing.**
- The FD tail, XK tail and PE tail are unchanged.
- No earlier register file is edited, and no banner is added to one.

**Basis:** `origin/main` at `99af008f0697ad3069c8a0d70709d3c7e2f18f75` (2026-11-23), plus branch `claude/place-lock-generation-b3`. Every `file:line` below is on the branch unless it says "at the basis".

**Author:** Claude, with Evoni (JustAWomanInHerPrime), Prime Studios.

**Status:** amendment, on Evoni's approval of Generation B3 of 2026-11-23, whose terms are set out in §2 as they were given to this work. Merging this file with the change it describes is her approval of the text. It is not an authorization to deploy (§7).

**Standings used:** RULED (§2); MEASURED (the repository reads and local test runs of §1, §3 to §6 and §9, each with its file or command); INFERRED (marked where used).

**Follows:** `F-AUTH-1_PlaceLockFoundationA_Amendment_2026-11-23.md` (the strict rule and `finalizePlaceWrite`), `F-AUTH-1_PlaceLockGenerationB1_Amendment_2026-11-23.md` (the pause between tries) and `F-AUTH-1_PlaceLockGenerationB2_Amendment_2026-11-23.md`, whose §7 left these two paths to B3.

---

# §1. What was there (MEASURED at the basis)

| Path | At the basis | How it wrote |
|---|---|---|
| The Locations save (`PUT /api/v1/episodes/:episodeId/locations`) | `saveEpisodeLocations`, `src/services/episodeLocationsService.js:222-237` | It read the episode with no lock, answered 409 `EPISODE_ACCEPTED` from that read, then opened one transaction for `assertUsable` and `applyLocations`. `applyLocations` (`:169-216`) moves beats, soft-deletes and inserts `scene_set_episodes` rows, and, when the save has an Event location, runs `UPDATE world_events SET scene_set_id` for the episode's event. It took no lock on the episode or the event first, asked no Place lock, and did not know which set the event had when the save was made. |
| Start Episode's locations | `generateEpisodeFromEvent`, `src/services/episodeGeneratorService.js:682` and `:1013-1026` | The locations were resolved from the event as the route read it, before the main transaction. After the commit they were written by `applyLocations` in a transaction of their own, with no finalizer: the event's set was written from a value read before any lock. A failure was recorded as `setupSteps.locations = { status: 'failed', reason: <the error's own message> }` on `episodes.setup_status`; the 201 did not carry the setup steps at all. |

So an acceptance, an event edit or a finalization that committed while either ran was not seen; a Locations save could wait for a set row while holding rows a finalization waits for; and a Start could write the set an event had before someone changed it (B2 amendment §7).

# §2. The decisions (RULED)

Evoni approved Generation B3 on 2026-11-23 as one change. Her rulings, as given to this work:

**The Locations save.**
1. The save reads the event's set as its source. A save that changes the event's set goes through `finalizePlaceWrite` with that source. Any other save is one transaction of its own, in this order: the episode `FOR SHARE`, the event row (`lockLiveEvent`), the event's set read again, the episode's acceptance (409 `EPISODE_ACCEPTED`, in its existing words), the set-row locks, then `applyLocations`.
2. If the event's set is not the one the save read, the save is **refused** with the existing stale-source 409. It is not run again against the newer set.
3. Home, closet and extras edits stay allowed on a draft episode whose event's Place is locked by another, accepted episode. In that path the event row's `scene_set_id` is not rewritten.
4. `EPISODE_ACCEPTED` is answered before `PLACE_LOCKED`.
5. Set-row locks: every distinct set the save names, sorted by id, in one statement, `FOR KEY SHARE NOWAIT`. This was approved only if real tests prove it prevents the deadlock against `makeEventVersion`, `makeEveryday` and the relevant scene-set updates holding real row locks (§5, §9).
6. At most three tries, with the 250 ms pause of B1, through the existing helpers; a small local loop only if unavoidable, kept minimal and explained (§4). `PLACE_LOCKED` and the stale-source refusal are never retried. Exhaustion is 409 `PLACE_FINALIZE_RETRY_EXHAUSTED` on the finalizer path, and the closest existing convention on the other.
7. Success bodies, beat moves and every existing meaning are unchanged.

**Start Episode.**
8. The request carries the scene set the Locations step showed for the event, in an enforced field (`event_scene_set_id`); `null` is a real value. The server validates it before anything is created, and omitting it must not be a way round the check.
9. Inside Start's existing main transaction, after `lockLiveEvent`, the event's set is read again and validated. When no locations were sent, the event entry is built from the locked value.
10. After the commit, `applyLocations` runs through `finalizePlaceWrite` with the set read under the lock as source, the 250 ms pause and the set-row locks. Anything but success is `setupSteps.locations = { status: 'failed', reason }` with a safe reason (no SQL), and the response must not claim a complete setup. The step must be visible and retryable.
11. `findStartBlockers` is not changed. The frontend only sends the displayed set id and shows the stale 409 and the failed step; no Locations redesign.

**Standing terms.** No migration, table, endpoint, or new locking, sync, recovery or persistence system. `src/utils/placeLock.js` is not changed. No authorization change. No live provider, storage or model call in a test.

## Her correction (RULED, 2026-11-23)

v1.0 of this change let "Resume setup" call a failed locations step done as soon as the episode had any live location (§4a). She approved a narrow correction, as given to this work:
1. Resume setup is a read-only consistency check for this step, never a second writer of locations.
2. A failed step records the roles Start tried to save, in the existing vocabulary (event, home, closet, extra; an extra by its name).
3. The step is cleared only when (A) every recorded role has a live location, with a conservative fallback for a step recorded without roles (home, and the event when the event has a set); (B) when the episode's event has a set, the episode's Event location is that set; (C) every live beat that names a set names an appropriate live location, by its role where the existing data gives one.
4. Otherwise the step stays failed and the setup incomplete, with a fixed sentence for what is missing and a meaningful code. The original write is not run again; no beat, set, link or saved scene is moved, made or rewritten; accepted episodes' data is not altered.
5. Start's answer, its replay, the checklist and Resume setup's answer agree.

# §3. What was verified before the code was written (MEASURED)

Nothing found needed a schema change, a redesign of a public API or a rewrite of the lock order.

**a. Foreign keys (read from the migrated local test schema, `pg_constraint`; the live schema was not inspected).**

| Column | References | On delete | Migration |
|---|---|---|---|
| `scene_plans.scene_set_id` | `scene_sets` | SET NULL | `20260629000000-create-episode-briefs-scene-plans.js` |
| `scene_plans.episode_id` | `episodes` | CASCADE | same |
| `scene_plans.episode_brief_id` | `episode_briefs` | SET NULL | same |
| `scene_set_episodes.scene_set_id` | `scene_sets` | CASCADE (and on update) | `20260324000000-add-scene-sets-cover-and-episodes.js`, `20261019180000-create-scene-set-episodes-if-missing.js` |
| `scene_set_episodes.episode_id` | `episodes` | CASCADE | same |
| `world_events.scene_set_id` | `scene_sets` | SET NULL | `20260630000000-add-scene-set-id-to-world-events.js` |
| `scene_set_looks` | none in this schema | | `20261002130000-create-scene-set-looks.js` |

Each of the save's statements that names a set is therefore a foreign-key reference to `scene_sets`, which PostgreSQL checks with `FOR KEY SHARE` on the set row.

**b. Lock interactions.** `FOR KEY SHARE` conflicts with `FOR UPDATE` only. `makeEventVersion` and `makeEveryday` take a set row `FOR UPDATE` and then need the event row. A plain update of a set that changes no key column takes `FOR NO KEY UPDATE`, which does not conflict with `FOR KEY SHARE`. The acceptance takes its episode `FOR UPDATE`; the save's `FOR SHARE` on the episode waits for it and is waited for by it. The event `PUT` takes the event row first.

**c. Start's answer when the locations step failed.** The 201 carried `postCommit` only (the season slot and the deliverable stamp). The failed step was on `episodes.setup_status` alone. The Event Package then opened `/episodes/:id?tab=overview`, where `EpisodeProductionChecklist.jsx` shows "Setup did not finish" with each failed step's reason (`data-testid="setup-incomplete"`) and "Resume setup" (`POST /api/v1/episode-brief/:id/setup/resume`). Resume setup never cleared a failed locations step.

**d. Nested writes.** Every statement of `applyLocations` and `assertUsable` takes the transaction it is given. Start's beats (`scene_plans`) are created by existing code outside any of this, on the locations chosen before the commit (§8).

**e. Where the Event Package gets the set it shows.** `GET /api/v1/world/:showId/events/:eventId/episode-locations` returns a proposal that `useStartEpisode` holds as `locationsStep`; the event's set is the proposal's `role: 'event'` entry. The proposal leaves out a set that was deleted, so the entry alone does not say what the event's row holds.

**f. Callers of `generateEpisodeFromEvent`.** `generate-episode` (`src/routes/worldEvents/episodeGenerate.js`; the only one that passes locations, from the request body); `generate-episode-from-many` and `regenerate-episode` (`src/routes/worldEvents/episodeBatch.js`; no locations). Frontend: `useStartEpisode` sends locations; `EventLibrary.jsx`, `NextEventSuggestionsOverlay.jsx` and `EpisodeOverviewTab.jsx` call the two routes that send none. Hence: locations without the field are refused; a Start with no locations has no displayed set to be stale, and takes the event's set as it is under the lock.

# §4. What the change does (MEASURED on the branch)

## The Locations save (`saveEpisodeLocations`, `src/services/episodeLocationsService.js:282-351`)

1. As before: 404, then 409 `EPISODE_ACCEPTED` from the first read, then the body is normalised (400 as before).
2. The source is read: the episode's event and the set it has (`episodeEventSnapshot`, `:245`).
3. **A save whose Event location is another set than the event has** (`:308-321`) is committed by `finalizePlaceWrite(event.id, { sourceSetId, retryDelayMs: 250, work })`. The work is `lockSetRows`, `assertUsable`, `applyLocations`. A refusal is 409 `{ success: false, code, error }` with the finalizer's own code and text: `PLACE_LOCKED`, `STALE_SOURCE_SET`, `EVENT_DELETED`, `PLACE_FINALIZE_RETRY_EXHAUSTED`. When the refusal is `PLACE_LOCKED` and this episode is itself accepted by then, the answer is `EPISODE_ACCEPTED` in its existing words (ruling 4).
4. **Any other save** (`:323-350`) is one transaction: `lockEpisodes([episode], share)`, `lockLiveEvent`, the event's set read again (another set than the source: 409 `STALE_SOURCE_SET`, the finalizer's code and text), the episode read again (accepted: 409 `EPISODE_ACCEPTED`), `lockSetRows`, `assertUsable`, `applyLocations` with `keepEvent: true`. It does not ask the Place lock. `keepEvent` (`:169`, `:209`) makes `applyLocations` send no statement to `world_events`. An episode with no event takes no event lock.
5. **The local loop** (ruling 6). `finalizePlaceWrite` always asks the Place lock, which this second path must not (ruling 3), and `placeLock.js` is not to be changed; so the second path has its own loop (`:330-350`), which is that helper's loop and nothing more: `isLockConflict` and `RetryableConflictError` from `utils/episodeLocks` decide what is tried again, `PLACE_FINALIZE_MAX_ATTEMPTS` bounds it, and the pause is `finalizePlaceWrite.retryPause.sleep(PLACE_FINALIZE_RETRY_DELAY_MS)`, between transactions. Exhaustion answers 409 with the existing `RetryableConflictError` convention: code `RETRY`, "Someone else changed this at the same moment. Nothing was saved: try again."
6. `lockSetRows` (`:265-271`): `SELECT id FROM scene_sets WHERE id IN (:ids) ORDER BY id FOR KEY SHARE NOWAIT`, the distinct ids sorted.

The route (`src/routes/episodes.js`, `PUT /:episodeId/locations`) is not changed: it already answers an `EpisodeLocationsError` with its status, code and text.

## Start Episode (`generateEpisodeFromEvent`, `src/services/episodeGeneratorService.js`)

1. `GET …/episode-locations` adds `event_scene_set_id`: the event row's set, or `null` (`src/routes/worldEvents/episodeGenerate.js:199`).
2. `POST …/generate-episode` reads `event_scene_set_id` from the body (`:64`).
3. Before anything is created (`:702-704`, `assertEventSetShown`, `episodeLocationsService.js:499`): locations sent without the field are 400 `EPISODE_LOCATIONS_INVALID`; a value that is neither a string nor `null` is 400; a value that is not the event's set is 409 `STALE_SOURCE_SET` with the finalizer's text. A replay of a request already answered (the same Idempotency-Key) is answered before this, as it was.
4. In the main transaction, after the event rows are locked (`:748-762`): the event's set is read again and checked again (409 `STALE_SOURCE_SET`, nothing created). When no locations were sent and the set differs from the one read first, the locations are resolved again from the held value.
5. After the commit (`:1059`): `applyStartLocations` (`episodeLocationsService.js:368-390`) runs `finalizePlaceWrite(eventId, { sourceSetId: <the set held in step 4>, retryDelayMs: 250, work: lockSetRows + applyLocations })`. It never throws. It resolves `{ status: 'complete', count }` or `{ status: 'failed', code, reason }`:
   - a refusal: `code` is the finalizer's, `reason` its text followed by "The episode's locations were not saved: set them in the episode's Locations.";
   - anything else: `code: 'SAVE_FAILED'`, `reason: "The episode's locations could not be saved. Set them in the episode's Locations."` The database's message goes to the error log by class only.
6. The result gains `setup_status` (what `recordSetupStatus` wrote: `{ complete, steps }`), and the 201 gains `setup_complete` (false when a step failed) and, when the locations step failed, the sentence ". Its locations were not saved: <reason>" at the end of `message`. A replay carries the same two (`src/services/startEpisodeIdempotency.js:123`).
7. **Retry.** A failed step also records `roles`: the locations Start tried to save, as `[{ role, name }]` (`name` for an extra). The locations are set from the episode's Locations (the save above) and its beats in the Beat Plan. "Resume setup" does not save them: it checks (§4a), and marks the step complete only when the check passes; until then the checklist keeps showing it.

## §4a. Resume setup's check of a failed locations step (the correction)

**The defect in v1.0 (MEASURED, by tests that fail at `974ae498`).** `resumeEpisodeSetup` replaced a failed step by `{ status: 'complete', count }` when `listLocations` returned at least one row. Two sequences, each reproduced through the real routes before the fix (`placeLockGenerationB3.integration.test.js`, the Resume describe; at `974ae498` Resume answered `success: true` in both):
- After Start's stale refusal, the event edit that caused it had already given the new draft episode an Event location (`syncEpisodeEventLocation`, `src/services/eventPlaceSync.js`, its insert when the episode has no event link). One location, no home: cleared.
- The locations then set from the episode (event at the newer set, home): the event's beats (10, 11, 12) still named the older set, because `applyLocations` moves beats only from a previous link of the same role and there was none: cleared.

**What ties a beat to a role (MEASURED).** `scene_plans` has no role column. The role is a function of the beat number: `BEAT_LOCATIONS` (`src/constants/beatLocations.js`), built from `CANONICAL_BEATS`' `typical_location` (HOME_BASE → home, CLOSET → closet, EVENT_LOCATION → event; transition beats 7 and 9 home, 10 event). `placeBeat` (`src/services/planLocationsService.js`) applies it, with the closet beat at home when the episode has no closet; `createScenePlanRows` and the AI planner (`scenePlannerService.js`) both place beats with it. Extras are never a beat's role (`setsByRole` leaves them out). So the appropriate location of a beat is derivable from existing data, and no data was added.

**The rule (`locationsStepGaps`, `:431`, and `checkLocationsStep`, `:475`, `src/services/episodeLocationsService.js`; called from `resumeEpisodeSetup`, `src/services/episodeGeneratorService.js:403-409`).** Read from the episode's live locations (`listLocations`: `scene_set_episodes` with `deleted_at IS NULL`, joined to live sets), its event (`EPISODE_EVENT_ID_SQL`, the resolution the Locations save uses: the live brief's event, else the first event stamped with the episode; `resumeEpisodeSetup`'s own event read for missing beats is the brief's only, and is not changed) and its live beats that name a set:
- **A.** Every recorded role has a live location of that role; an extra is matched by role and name, as `applyLocations`' `sameSlot` does. **A step with no `roles`** (recorded before they were): home, and the event when the event has a set. This fallback does not reconstruct what Start was asked for: a closet or an extra it was asked for is not known, and is not asked of the episode.
- **B.** When the event has a set, the episode's Event location is that set. With no Event location at all, the event counts as a missing role (also when Start saved none).
- **C.** A beat that is neither locked nor chosen by the user must name the set `placeBeat` gives its beat number over the live locations (its role's location; the closet beat at home when there is no closet). An extra that uses the same set does not satisfy it; a beat whose role has no location is named. **A locked or `chosen_by_user` beat** is one the existing writers never move (`applyLocations` and `syncEpisodeEventLocation` both write only `locked = false AND chosen_by_user = false`), and the beat editor may put it at any set, which then joins the locations (`linkBeatSet`): it keeps its set, and is right at any live location of the episode (an extra included) and wrong at a set that is not one. It is not exempt altogether, since "lock every beat" on stale beats would otherwise clear the step.

**When the check fails** the step is `{ status: 'failed', code: 'LOCATIONS_INCOMPLETE', reason, roles }`. `LOCATIONS_INCOMPLETE` is a fixed string beside the step's other codes (the finalizer's, `SAVE_FAILED`). `reason` is a fixed sentence: "The episode's locations are not complete." then any of "Missing: Home, Closet, "<an extra's name>".", "The Event location is not the event's current scene set.", "N beats name a scene set that is not their location (beats …).", then "Set them in the episode's Locations and Beat Plan, then choose Resume setup." The only text in it that is not fixed is an extra's name, which the user typed. `roles` is kept. A check that cannot be read leaves the step as it was.

**What it writes.** The check is three reads. `resumeEpisodeSetup` then records `episodes.setup_status`, as it always did. Its two existing steps before the check are unchanged and are not part of the check: `createScenePlanRows` inserts only beats the episode is missing, and `syncBeatScenesQuietly` creates, updates or soft-deletes the beats' scene rows where they differ from the beats. **Neither asks whether the episode is accepted** (MEASURED by reading): Resume on an accepted episode that is missing beats, or whose scene rows differ from its beats, writes those rows, as at the basis. On an accepted episode with its 14 beats and its scenes in step, Resume writes nothing but `setup_status` (tested).

**Stale beats are not repaired here.** After a stale refusal the user sets the Locations, and moves each named beat in the beat editor (`PUT /api/v1/episode-brief/:episodeId/plan/:beatNumber`, the existing route; it refuses a locked beat until it is unlocked). The Locations save does not move them. Repairing beats and saved scenes in bulk is the held work (S1).

**Agreement (MEASURED, one test).** Start's 201 (`setup_complete: false`, `data.setup_status.complete: false`), its replay (which reads the episode's record), `episodes.setup_status` (what the checklist reads) and Resume setup's answer (`success: false`, `data.setup_status.complete: false`) say incomplete while the step is failed; after the corrections and a passing check all four say complete. Corrections alone, before Resume setup is chosen, change nothing: the record is updated by the check.

## Frontend

`useStartEpisode.js`: `shownEventSet` (`:18`) takes the server's `event_scene_set_id`, or the proposal's event entry when a server does not send it; it is fixed when the step is confirmed (`:66`), so choosing another set in the step does not change what is sent. The Start body gains `event_scene_set_id`. A 409 is shown with the server's sentence by the existing error handling, and the steps stay open. A 201 whose locations step failed shows "The episode was started, but its locations were not saved: <reason>" and opens the episode, whose checklist shows the step. `EpisodeLocationsStep.jsx` is not changed.

# §5. The lock order, and the proof asked for

Both paths: the episode(s) `FOR SHARE` in id order, the event row `FOR UPDATE`, the named sets `FOR KEY SHARE NOWAIT` in id order in one statement, then the writes. The statement traces of §9 read `E:episodes:share, W:world_events:update, X:scene_sets:share` and then the writes. A held set row is 55P03 at once: the transaction is rolled back, every lock let go, and the save tried again after the pause.

**The proof (ruling 5), each with real row locks held by a second session (§9):**
- `makeEventVersion` holding its set `FOR UPDATE` and waiting for the event row the save holds: the save gets one 55P03 and steps back; no 40P01; the version commits. On both save paths.
- The save first: `makeEventVersion` waits for the set row while holding nothing the save needs, then commits; no conflict.
- `makeEveryday`, both orders: the same.
- A plain update of a set held open in another transaction: the save commits at once with no conflict and no pause. A `FOR UPDATE` on the same row: 55P03 on each try.

# §6. After a refusal

- A refused Locations save writes nothing: beats, links and the event's row are as they were.
- A refused Start (400 or 409) creates nothing: no episode, the event not stamped.
- A Start whose locations step failed: the episode exists with its beats; no `scene_set_episodes` row was written by the step; the event's set is as the newer choice left it and is not written over.

# §7. What B3 does NOT do

- **`placeLock.js`, `sceneGenerationService.js`, `findStartBlockers`, the acceptance code and `EpisodeLocationsStep.jsx` are not changed.** No authorization change.
- **The Locations save takes no "expected set" from the client.** Its source is the set the event has when the save reads it (§8).
- **The acceptance-against-event-writer deadlocks remain (C1). Saved scenes are not frozen (S1). The venue-look save and who may save or draft are unchanged (C2).**
- **Deployment.** The unit is Foundation A, B1, B2 and B3 together. This amendment authorizes no deployment.

# §8. Limits and open points

- **Start's beats are made before its locations are saved**, by existing code outside the finalizer, on the locations chosen before the commit. After a stale refusal of the step, beats can still name the older set until the locations are set on the episode.
- **An event edit before a Locations save is simply what the save reads.** The save is refused as stale only when the event's set changes between its first read and its locks.
- **A failed locations step is cleared only by Resume setup's check** (§4a), and only when chosen: correcting the episode does not update the record by itself.
- **The fallback for a step without `roles`** asks for home and, when the event has a set, the event; nothing else Start was asked for is known. No step without `roles` was written by a merged version: v1.0 was not merged.
- **Stale beats are named, not repaired.** Each is moved in the beat editor; there is no bulk move.
- **An accepted episode whose step is failed and whose locations or beats do not pass cannot be corrected**: its Locations save is refused (`EPISODE_ACCEPTED`). The step stays failed.
- **Resume setup's route sentence is about beats.** `POST /api/v1/episode-brief/:episodeId/setup/resume` (`src/routes/episodeBriefRoutes.js`, not changed here) answers an incomplete setup with `success: false`, `code: 'SETUP_INCOMPLETE'` and "Setup is still incomplete: N beats missing (…)", built from the scene-plan step; when only the locations step is failed that reads "0 beats missing ()". The step's own reason is in `data.setup_status`.
- **The checklist alert reads the episode it was given.** `EpisodeProductionChecklist.jsx` (not changed here) shows `episode.setup_status` as loaded with the page, and its Resume toast shows the route's sentence; the step's new reason, or its clearing, shows when the episode is loaded again.
- **The Start toast is shown as the page opens the episode.** The lasting indication is the episode's checklist.
- **The second path's exhaustion code is `RETRY`**, not `PLACE_FINALIZE_RETRY_EXHAUSTED`: it is not a Place finalization (§4, 5).
- **`PUT …/locations` still answers an unexpected error with a 500 carrying the error's message**, as at the basis; this change adds no such path and does not alter that one.
- **A Start request that sends locations without `event_scene_set_id` is now a 400.** The one frontend caller sends it; any other client must.
- **A set row held for longer than three tries and two pauses** ends in the exhaustion answers above.
- **The live schema and the running processes were not verified.** No server was contacted. **No migration; no stored row is changed.**

# §9. Tests (MEASURED, local)

On a private, migrated local PostgreSQL test database, through the real app, against the real `completeEpisode`, the real event `PUT`, and the real `makeEventVersion` and `makeEveryday`. No test sends DDL. The network guard reports 0 external attempts.

`tests/integration/placeLockGenerationB3.integration.test.js` (50 cases; the 13 of the correction are listed below). **Real locks and injected errors are told apart in the file and here.** "Real lock" means a second database session really holds the row, or a real concurrent request is held open at a statement by the lock trace's gate and let go; nothing is simulated about the lock. "Injected" means an error thrown at a chosen statement by the test.

- *Real locks:* the acceptance holding its episode when the save begins, and the save first (both paths, a primary event and one linked by its stamp alone); a real two-part special; an event `PUT` during the save (both paths: stale); `makeEventVersion` both orders and both paths; `makeEveryday` both orders; a plain update and a `FOR UPDATE` held on a set row; a set row let go during the pause (saved on try two, one pause, no session but the holder's inside a transaction meanwhile) and held throughout (three tries, two pauses: `RETRY` on the one path, `PLACE_FINALIZE_RETRY_EXHAUSTED` on the other); the event moved between Start's first read and its lock, and after its commit; a Start past its commit, a Locations save and an event edit at once; a set row held while Start saves its locations.
- *Injected:* a failure at the beat move, the link soft-delete, the link insert and the event update of a save (500, every row as it was); Start's locations failing for another reason (`SAVE_FAILED`, no database text).
- *Neither (plain sequences):* the two paths' statement traces; an episode with no event; a home edit on a draft whose Place is locked by another episode (saved, event untouched) and an event move there (409 `PLACE_LOCKED`); accepted before the save; the proposal's field; Start with the value, with `null`, with a stale value, without the field (400), with no locations; Resume setup clearing the step after a Locations save.

**The correction's cases (Resume setup).** Corrections go through the routes a user has (the Locations save, the beat editor's save). Three rows are written directly, each said in the test: the event's set (no route leaves an event and its draft episode's Event location apart), a set's soft-delete, and the removal of `roles` from a step.
- The failed step records the roles, extras by name.
- Nothing corrected: still failed, and nothing but `setup_status` written.
- Only the Event location the event edit's sync made: still failed (home missing; no beat at its location). *Fails at `974ae498`.*
- Locations set again, the event's beats at the older set: failed, naming beats 10, 11, 12; moved one by one in the beat editor, failed until the last, then complete. *Fails at `974ae498`.*
- A closet Start was asked for, missing; a home and a named extra missing, another extra's name not standing in.
- The Event location at another set than the event's.
- An extra at the older set does not make the event's beats right.
- A location removed again (its link soft-deleted), and a set removed from Scene Sets, do not count.
- A chosen beat at an extra is right; a chosen beat whose set is no longer a location is named.
- A step without `roles`: the fallback, and its limit shown against the same Start with roles.
- An accepted episode: the episode row (but `setup_status`), its links, beats, scenes and the show's events equal before and after.
- Start, its replay, the record and Resume setup agree, before and after.

Also run on that database, unchanged and passing: `placeLockGenerationB1` (56), `placeLockGenerationB2` (69), `placeLockFinalizer` (52), `placeLockStrict` (53), `eventPlaceSync` (6), `startEpisodeHomeSet` (1), `startEpisodeOfferDecision` (49), `regenerateEpisodeSafe` (2), `p1PlanAdmin` (85); and, before the correction only, `dealTermsDraft` (7) and `p2aSceneAdmin` (335). The unit directory: 744 suites.

Unit: new `tests/unit/services/episodeLocationsService.startLocations.test.js` (13 cases): `applyStartLocations` (every statement takes the finalizer's transaction; a failure is logged and does not throw; a refusal; no locations) and `locationsStepGaps` rule by rule.

Frontend (Vitest): new `useStartEpisode.test.jsx` (the field sent with the value the step was shown, though another set is chosen in the step; `null` sent; a 409 `STALE_SOURCE_SET` shown with the server's sentence, nothing opened, the steps kept; a failed locations step said with its reason and the episode opened). `EpisodeProductionChecklist.setup.test.jsx` gains one case (the failed step shown with its reason; Resume setup answered as still incomplete is shown as not finished, never as resumed).

**Existing tests changed:**
- `tests/unit/services/episodeGeneratorService.startTransaction.test.js`: two cases pinned the old post-commit `applyLocations` call and the logged failure; they are replaced by three (the call to `applyStartLocations` after the commit; the 400 and the 409; a failed step making the setup incomplete). Two of their assertions could not stay there, since the write is no longer in that function: that the locations are written in a transaction of their own, and that a failure is logged. Both are asserted in the new unit file above.
- `EventPackagePage.startEpisode.test.jsx` (2 assertions) and `EventPackagePage.moneyWarnings.test.jsx` (2): the pinned Start body gains `event_scene_set_id: null`.
- By reading, not run (they send DDL): the Start helpers of `episodeLocations`, `l14Zones` and `plannerAngles` send `event_scene_set_id` with their locations.

**Not run locally, by the rule that a local run sends no DDL** (CI runs them): `episodeLocations`, `l14Zones`, `plannerAngles`, `termsPricingFixes`, `startRegenerateLocks`, `lockOrderMatrix`, `lockOrderTrace`, `setupResume`, `episodeLockSafety`, `beatPlanChosen`. Apart from the three helpers above, none was found by reading to assert something this change alters (INFERRED from reading, not run). `setupResume` and `plannerAngles` call Resume setup on episodes whose locations step is not failed (absent, or complete), which the correction does not touch.

---

**Type:** amendment.
**Rules:** the Locations save and Start Episode's locations take the Place finalizer's lock order; a save that moves the event, and Start's locations, are committed by `finalizePlaceWrite`; Start carries and enforces `event_scene_set_id`; a Start whose locations were not saved says so; on Evoni's approval and rulings set out in §2. **Mints:** nothing (no FD, XK or PE number). **Discharges:** nothing.
**Host/AWS/DB/Cognito contact (this session):** the tests ran against a local PostgreSQL test database in the session's own container. No deployed host, AWS service, production or development database, or Cognito pool was contacted for this change, and no paid provider was called.
**Production standing:** as the newest Fix Plan revision states it (`F-Deploy-1_Fix_Plan_v1.56.md`, footer): "Production's freeze is lifted (`F-Deploy-1_Fix_Plan_v1.53.md` §1)". What an agent session may do in production is set by `CLAUDE.md` and `F-Tools-5_AgentProductionAccess_Ruling_2026-10-31.md`.
