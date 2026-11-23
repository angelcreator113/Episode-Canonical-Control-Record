| **PRIME STUDIOS** **F-AUTH-1 — THE PLACE LOCK, GENERATION B1: `generate-venue` SAVES THROUGH THE FINALIZER (AMENDMENT)** *The two paid paths of `generate-venue` (a new venue; the missing base of the set the event has) now save what they generated in the Foundation A finalizer's transaction. A save refused after the picture was made answers 409 `generated_not_saved`: nothing is written, nothing is deleted from storage, the provider is not called again. Event looks, dressed angles, the venue-look draft, the Locations save and Start Episode are not changed.* |
| --- |

**Document version**

v1.0. This is an additive amendment, written as a new file because the register is append-only. **Mints nothing.**
- The FD tail, XK tail and PE tail are unchanged.
- No earlier register file is edited, and no banner is added to one.

**Basis:** `origin/main` at `862314b71c6805d7ef300be0d330ef03302a3c7c` (2026-11-23), plus branch `claude/place-lock-generation-b1`. Every `file:line` below is on the branch unless it says "at the basis".

**Author:** Claude, with Evoni (JustAWomanInHerPrime), Prime Studios.

**Status:** amendment, on Evoni's authorization of 2026-11-23, quoted in §2. Merging this file with the change it describes is her approval of the text. It is not an authorization to deploy (§2, §7).

**Standings used:** RULED (§2, in Evoni's words); MEASURED (the repository reads and the local test runs in §1, §3 to §6 and §9, each with its file or command); INFERRED (marked where used).

**Follows:** `F-AUTH-1_PlaceLockFoundationA_Amendment_2026-11-23.md` (the strict rule and `finalizePlaceWrite`, which no route called).

---

# §1. What was there (MEASURED at the basis)

`POST /api/v1/world/:showId/events/:eventId/generate-venue` (`src/routes/worldEvents/venue.js:96-174`), an ADMIN's, has two paid paths after its early Place check (`:133-136`):

| Path | At the basis | How it saved |
|---|---|---|
| A new venue (no set, a set that no longer exists, or `force`) | `generateVenueImages`, `src/services/venueGenerationService.js:155-289` | After two provider calls and two storage puts: `SceneSet.create`, one or two `SceneAngle.create`, then `UPDATE world_events SET scene_set_id`, each its own autocommit statement, the creates and the link each inside a `try` whose `catch` logged a warning and carried on (`:209-265`, `:268-277`). The episode's Event location was not moved. |
| The missing base of the set the event has | `generateBaseScene`, `src/services/sceneGenerationService.js:935-1085` | A marker (`generation_status='generating'` and `base_runway_prompt`), the provider call and the storage put, a read asking whether the base was approved meanwhile, then one autocommit `UPDATE` with the picture (`:1008-1014`). |

The early check is a read (`isPlaceLocked`). An acceptance that committed while the provider was being paid was not seen: the new set was created and the event moved to it, or the base was written, on an event whose Place had locked. The same for an event edit that chose another set meanwhile (the new venue replaced the newer choice), and for an event deleted meanwhile.

Three callers mark a base `failed` when `generateBaseScene` throws: its own `catch` (`sceneGenerationService.js:1077-1084`), the `generate-base` route (`src/routes/sceneSetRoutes.js:1442-1446`), and the look's base step (`src/services/venueLookImageService.js:244-247`, through `markBaseFailed`, for every error).

The Scene Sets page read a base run's end from the set's status alone (`frontend/src/pages/SceneSetsTab.jsx:3398-3410`): a run that left the set `complete` was toasted "Base image regenerated!", including the run refused because the base had been approved meanwhile, which leaves the old picture.

# §2. The decisions (RULED)

Evoni, 2026-11-23, authorizing this change:

> "Split Generation B into B1, B2 and B3. Authorize B1 implementation only at this stage."

B1 includes, in her words:

> "generate-venue new-venue and missing-base paths; generateBaseScene and all three failed-marking callers; generate-venue's exception mapping; Correct handling of generated-but-not-saved; Existing last-error reporting and frontend false-success correction; Draft episode event-location synchronization after successful new-venue finalization."

How it is built, in her words:

> "Use the existing Foundation A finalizer. The callback must contain only transaction-bound, rollback-safe database work. Generate IDs and timestamps before entering the retryable callback. Keep paid provider calls, storage operations and irreversible side effects outside the callback. Retain the existing early Place-lock check before any paid work or generation-status marker."

> "Use generated_not_saved as a distinct value of the existing outcome field, preserving the established refusal code and explanatory text."

> "On late refusal: Do not mutate event, set, angle, plan, scene or episode-location relationships. Restore the previous generation status, never uncertain. Record the refusal through the existing last-error mechanism. Do not overwrite accepted episode data. Do not automatically delete generated storage objects. Log the stored object key, event, outcome and known cost. Do not repeat a provider call during database retries."

> "A successful new-venue finalization should synchronize the linked draft episode's event location through the existing helper, in the same atomic database operation where appropriate. Preserve accepted-episode refusals and the established lock order. Do not introduce a new synchronization service."

> "Before adding database operations inside finalizer callbacks, trace Scene Set and angle creation hooks for implicit writes or side effects. Verify every helper involved accepts and actually uses the transaction, including relevant nested calls. If a hidden hook performs work outside the transaction, stop and report the smallest safe correction before proceeding."

No migration, table, endpoint, lock service, synchronization service, cleanup service, permission model or second generation pipeline is created.

# §3. What was verified before the callbacks were written (MEASURED)

Her last instruction above. Nothing found stopped the work.

## Model hooks

| Read | Finding |
|---|---|
| `src/models/SceneSet.js`, `src/models/SceneAngle.js` | `Model.init` with `underscored`, `paranoid`, `timestamps`. No `hooks` option, no `addHook`, no `beforeCreate` / `afterCreate` / `afterSave` / `afterBulkCreate`. |
| `src/models/index.js` | Requires the two models (`:453-454`) and runs their `associate` (`:885-892`). It registers no hook on either. Its one hook is `sequelize.afterConnect` (`:45-47`, `SET CLIENT_ENCODING` once per new connection): it is not run per statement and writes nothing. |
| `src/config/sequelize.js` `define` | `underscored`, `timestamps`, `paranoid`, `freezeTableName`. No `hooks`. |
| `grep -rn "useCLS\|cls-hooked\|continuation-local" src` (no match) | No CLS namespace. A statement not given `transaction` runs on another connection. |

So, with `{ transaction }` passed:
- `SceneSet.create(values, { transaction })`: one `INSERT … RETURNING` in that transaction. No other statement.
- `SceneAngle.create(values, { transaction })`: the same.
- `SceneSet.update(values, { where, transaction })` (the static, bulk form, no `individualHooks`): one `UPDATE … WHERE deleted_at IS NULL AND id = …` in that transaction.
- No queue, cache, storage or log write is attached to any of them.

Sequelize fills `created_at` and `updated_at` itself at `create`. To honour "generate IDs and timestamps before entering the retryable callback", the rows are given `createdAt` and `updatedAt` and created with `silent: true`; the suite reads the stored `created_at` and `updated_at` back as the timestamp made before the transaction (§9).

## Database triggers and foreign keys

`src/migrations/20261108210100-scene-generation-attempts.js`: on `scene_sets` and `scene_angles`, `scene_generation_target_guard` (`BEFORE UPDATE OR DELETE`, row) and `scene_generation_status_write_guard` (`BEFORE UPDATE OF generation_status`, row). Both run inside the statement's transaction; they read `scene_generation_attempts` only when the row has a `current_attempt_id`, and write nothing. No trigger fires on `INSERT`.

- No application code writes `current_attempt_id` (`grep -rln "current_attempt_id\|scene_generation_attempts" src` finds the two model files and that migration only). With it NULL, the writes this change makes pass: the marker (`→ generating`), the final write (`→ complete`), and the restore (`generating → pending | complete | failed`).
- With an attempt in flight on the set, the marker is refused by the guard exactly as before (it is still one statement naming `generation_status`): pinned by `tests/integration/sceneGenerationPlannedFlows.integration.test.js` and by a case of the new suite.
- The inserts take the database's own foreign-key locks (`FOR KEY SHARE`) on the set's show and World Location, and the angles' on the new set row, in the same transaction.

## Helpers called inside the callbacks

| Helper | Finding |
|---|---|
| `syncEpisodeEventLocation` (`src/services/eventPlaceSync.js:26-70`) | Takes `transaction`. All seven statements go through its `opts()` (`:28`), which adds the transaction. It calls nothing else that queries (`episodeEventIdSql` builds text). It reads only episodes that are not accepted. |
| `baseReplaceRefusal` (`src/services/approvedBaseService.js:40-48`) | **Did not take a transaction** at the basis, though `locationApprovingSet` did. It now takes `{ transaction }` and passes it on. Its other callers pass none and are unchanged. |
| `locationApprovingSet` (`:23-32`) | One `SELECT`, given the transaction. |
| `finalizePlaceWrite` (`src/utils/placeLock.js`) | Not changed. |

## The last-error mechanism

`markBaseFailed` (`src/services/venueLookImageService.js:361-369`) is the one writer of `scene_sets.base_generation.last_error` and `failed_at`; it also sets `generation_status = 'failed'`, in one statement, and lives in a file this change may touch in one place only (§7). It cannot be reused without marking the set failed. `restoreBaseAfterRefusal` (`src/services/sceneGenerationService.js:997-1016`) writes the same two keys in the same shape (`jsonb_build_object('last_error', CAST(:reason AS text), 'failed_at', NOW())`, the reason cut to 500 characters) and does not set `failed`.

# §4. What the change does (MEASURED on the branch)

## The new venue: `generateVenueImages` (`src/services/venueGenerationService.js:174-352`)

1. `sourceSetId = event.scene_set_id ?? null`, from the row the route loaded, before anything is generated (`:176`).
2. Outside the transaction, as before: the briefs, the interior and exterior provider calls, the downloads, the two storage puts. The provider calls are given an `onLogged` callback, so the cost and `ai_usage_logs` ids they were logged with are known afterwards. The object keys written are collected (`uploadToS3`, `:35-44`).
3. Before the transaction: the set's id, the angles' ids, one timestamp, and the whole rows (`:249-308`).
4. `finalizePlaceWrite(sequelize, event.id, { sourceSetId, work })` (`:340`). `work({ transaction })` (`:315-325`), every statement with that transaction and no `catch`: `SceneSet.create`, the `SceneAngle.create`s, `UPDATE world_events SET scene_set_id`, then `syncEpisodeEventLocation({ eventId, fromSetId: sourceSetId, toSetId, transaction })`. A new model instance is built on each try.
5. `OK`: what the route answered before. Any other outcome: one log line (below) and a `PlaceFinalizeRefusal`. An error thrown by `work` that is no lock conflict is rolled back by the helper and thrown on, after the same log line with `outcome=SAVE_FAILED`.

The two `catch` blocks that swallowed a failed create or a failed link are gone. A failed statement now fails the save as a whole: before, a venue whose angles failed to insert was still answered as "scene set created".

## The missing base: `generateBaseScene` (`src/services/sceneGenerationService.js:1047-1257`)

One pipeline, with two new options. Callers that pass neither behave as before except where this section says so.

- `options.finalize`: `async (work) => { outcome, code, message, attempts }`. Not given: one plain `sequelize.transaction` around `work`.
- `options.priorStatus`: the status put back on a refusal. Not given (`priorBaseStatus`, `:982-987`): the row's own status when it is `pending`, `complete` or `failed`; else (the caller's claim already marked it `generating`) `complete` with a base and `pending` without, the rule the cascade route uses (`src/routes/sceneSetRoutes.js:2505`). Never `generating`, never `uncertain`.

In order:
1. The marker (`:1070-1073`): one statement, `generation_status = 'generating'` only. `base_runway_prompt` is no longer written here; it is written with the picture. (After a failed run the set keeps its earlier prompt. The readers of that column are the Scene Sets page's "prompt" disclosure and the angle-suggestion context, `sceneSetRoutes.js:1553`.)
2. The provider call and the storage put, as before.
3. Everything the final write needs, built before the save (`:1094-1121`).
4. `finalize(work)`. `work({ transaction })` (`:1135-1150`): lock the set row; ask whether the base was approved meanwhile, in the transaction; the final `UPDATE`, with the prompt.
5. `OK`: then, outside the transaction and as before, `repointBaseAngles`, `deleteOldBaseImage`, `noteBaseChanged`, the analysis and the style call.
6. Not `OK` (`:1180-1185`): `restoreBaseAfterRefusal`; the log line; `throw new PlaceFinalizeRefusal(outcome)`.
7. Approved meanwhile (`:1172-1174`): the same `ApprovedBaseError` and message as before. The status is put back to what it was instead of always to `complete`, and the reason is now kept in `last_error` (a set with an approved base that was `complete` before reads `complete` after, as before).

`venue.js:143-153` passes `finalize: (work) => finalizePlaceWrite(sequelize, event.id, { sourceSetId: attached.id, work })`. No other caller passes a `finalize` in B1.

## The route's answers (`src/routes/worldEvents/venue.js:101-195`)

The early Place check and the "already available" answer are where they were, before the provider key is looked for and before any marker. Their bodies are unchanged.

A save refused after the picture was made is HTTP **409**, never the 500:

```
{ "success": false,
  "outcome": "generated_not_saved",
  "code":    <the outcome's code>,
  "error":   <the outcome's message>,
  "message": "The image was generated but it was not saved. Generating it again costs again." }
```

| `code` | `error` |
|---|---|
| `PLACE_LOCKED` | "This event's episode is accepted: its Place is locked" (the early check's code and text) |
| `STALE_SOURCE_SET` | "This event's scene set changed while this was being made. Nothing was saved over the newer choice." |
| `EVENT_DELETED` | "This event was deleted. Nothing was started or linked." |
| `PLACE_FINALIZE_RETRY_EXHAUSTED` | "This could not be saved: the event or its episode was busy on every try. Nothing was saved." |

`outcome` is the field the route already answered `generated`, `already_available` and `failed` in; `message` is the free-text field its success answers already carry. No field is added. The early refusal has no `outcome`, as before.

An error thrown inside the save that is no lock conflict (a constraint violation, a lost connection) is still the route's 500 `{ success: false, outcome: "failed", error }`. Everything is rolled back, and the stored objects are logged with `outcome=SAVE_FAILED`. See §8.

## The three callers that mark a base failed

| Caller | Now |
|---|---|
| `generateBaseScene`'s own `catch` (`sceneGenerationService.js:1248-1256`) | Skips `ApprovedBaseError` (as before) and `PlaceFinalizeRefusal`. |
| The `generate-base` route (`sceneSetRoutes.js:1442-1451`) | The same two. |
| The look's base step (`venueLookImageService.js:244-250`) | Returns on `PlaceFinalizeRefusal` before `markBaseFailed`. Everything else, an approval meanwhile included, is marked failed as before: that flow is B2's. |

Only `venue.js` passes a finalizer that can refuse, so in B1 the second and third cannot meet the refusal yet. The skip is tested by giving `generateBaseScene` a `finalize` that refuses.

The worker (`src/workers/sceneGenerationWorker.js:190-191`, `:258`) marks a set failed with `WHERE generation_status = 'generating'`: after the restore it matches nothing. Read, not changed.

## The log line

One `console.error` line per picture that was made and not saved (`generatedNotSavedLine`, `sceneGenerationService.js:963-972`):

```
[GeneratedNotSaved] an image was generated and not saved: storage_keys=venues/<event id>/<uuid>-venue.png,venues/<event id>/<uuid>-exterior.png event=<event id> set=none outcome=PLACE_LOCKED attempts=1 cost=$0.08 estimate=$0.08 usage_log_ids=<id>,<id>; nothing was deleted from storage
```

- `storage_keys`: the object keys (for a base, `scene-sets/<set id>/stills/<ms>-base.jpg`). Never a URL, a host or a query string. With no bucket configured the venue path stores nothing and the line says `none (no bucket is configured: nothing was stored)`.
- `cost`: the sum the provider calls were logged with; `unknown` when none was priced. `estimate`: the rate-table estimate. `usage_log_ids`: the `ai_usage_logs` rows.
- `outcome`: the code, or `SAVE_FAILED`.

## The frontend (display only)

- `frontend/src/pages/SceneSetsTab.jsx`: `baseNotSavedReason(set)` returns `base_generation.last_error` when `failed_at` is newer than the set's last saved base (`generated_at` or `uploaded_at`) and the set is neither generating nor failed. `waitForBase` (what `pollSetStatus` now calls) asks it before the status; `baseRunToast` then shows the recorded sentence as an error instead of "Base image regenerated!" or "Base generated for …". A first base that was not saved (the set is `pending` again) is reported at once instead of at the two-minute timeout. The set read (`GET /scene-sets/:id`) already returns `base_generation`: no server field is added.
- The run refused because the base was approved meanwhile now records `last_error` too (§4), so the same check corrects that older false success.
- `frontend/src/components/EventPackage/EventLookImage.jsx`: `baseNotSaved(set)`; the base error line and toast are shown for it as for a failed base, and "The base is ready" is not. See §8: the look read does not yet send the two timestamps.

# §5. The lock order, and the set row (MEASURED and INFERRED)

Inside the finalizer the order is the one Foundation A set: the linked episodes `FOR SHARE` in id order, then the event row `FOR UPDATE`, then `work`.

**The new venue.** `work` writes a set row and angle rows it has just made, the event row it holds, and, through the sync, `scene_set_episodes` and `scene_plans` rows of draft episodes it holds `FOR SHARE` (the sync's episodes are those whose event this is: a subset of the linked ones). The statement trace reads `E:episodes:share, W:world_events:update` and then the writes (§9).

**The missing base.** `work` must write a set row that already exists, after the event row. Two existing transactions take a set row first and the event row after it:

| Existing code | Holds | Then takes |
|---|---|---|
| `makeEventVersion` (`src/services/sceneSetVersionService.js:84-161`) | the set and the everyday set, `FOR UPDATE` | the event row `FOR UPDATE` (`:117`) |
| `makeEveryday` with `returnEvent` (`:169-217`) | the set, `FOR UPDATE` | `UPDATE world_events … WHERE scene_set_id = :id` (`:203`) |
| `approveBase` (`src/services/approvedBaseService.js:96-134`) | the set, `FOR UPDATE` | the World Location row (no event) |

A base save that holds the event row and then **waits** for the set row closes a circle with the first two: each holds what the other waits for. This is so whether the wait is an explicit row lock or the `UPDATE`'s own: `FOR NO KEY UPDATE` conflicts with their `FOR UPDATE` as `FOR UPDATE` does, so neither of the two options first considered (a weaker explicit lock, or no explicit lock) removes it. PostgreSQL would break the circle after `deadlock_timeout` by aborting whichever waiter checks first, here the existing `makeEventVersion` (it began waiting first), which has no retry.

**The decision: the set row is locked `FOR NO KEY UPDATE NOWAIT` when the save runs under a caller's finalizer** (`sceneGenerationService.js:1137-1141`). The save never waits for a set row while it holds the event row, so it can be in no such circle. A held set row is PostgreSQL 55P03 at once; the finalizer treats 55P03 as a lock conflict, rolls back (releasing the event row and the episodes) and tries again, up to three times in all. With no caller's finalizer (the Scene Sets `generate-base`, the cascade, the look's base step, the model comparison) nothing else is held, and the lock is a plain `FOR NO KEY UPDATE` that waits, as the `UPDATE` always did.

What that costs, plainly: the three tries follow one another with no pause (the helper has none, and it is not changed here). When the set row's holder is itself waiting for this event, the first rollback lets it through and the second try queues behind it at the event row: saved on try two (raced with the real `makeEventVersion`, §9). When the holder is not waiting for this event and holds the set row for longer than three immediate tries take, the save ends `PLACE_FINALIZE_RETRY_EXHAUSTED` and the picture is not saved. The existing holders are single short transactions, so this is expected to be rare (INFERRED); it is not impossible. A pause between tries would be a change to the Foundation A helper and is not made here.

The restore after a refusal is one statement outside any transaction; it waits for the set row like any other write, holding nothing.

# §6. A refusal after the picture was made: the contract

For every outcome but `OK`, on both paths:

- **Nothing of the event's Place is written**: no event row, set, angle, plan, scene or episode-location row. For the new venue, nothing at all is written. For the missing base, the set's own status and reason are (next two points) and nothing else. The suite compares the rows before and after (§9).
- **The base's status goes back** to what it was (`pending`, `complete` or `failed`), in one statement that matches only while the row is still `generating`. It is never left `generating`, never set `uncertain`, and never set `failed` by this refusal.
- **The reason is kept** in `base_generation.last_error` (the outcome's message followed by "The image was generated but it was not saved. Generating it again costs again.") with `failed_at`.
- **No image column is written**: `base_still_url`, `base_runway_prompt`, `base_runway_seed`, `generation_cost` and `base_generation.generated_at` are as they were.
- **Nothing is deleted from storage.** The old base is not deleted either.
- **The provider is not called again.** A lock conflict repeats only the short transaction.
- **The route answers 409** `generated_not_saved` (§4).

## The orphan, and the money

The picture that was not saved stays in the bucket, referenced by no row. The provider was paid for it, and that cost is not recovered: `ai_usage_logs` keeps its rows, and the day's image budget counts it. Generating again pays again; the answer says so.

What exists to find the object afterwards is the one log line of §4, in the application's error log, with the object keys, the event, the outcome, the logged cost and the usage-log ids. **No table records it, and no cleanup, sweep or re-attach exists**: none was authorized, and this change adds none. The object is not reachable from the application.

# §7. What B1 does NOT do

- **Event looks, dressed angles and the venue-look draft are not changed (B2).** "Generate this look" (`venueLookImageService.startLook`, `uploadLook`), the dressed angles (`dressedAngleService`) and the venue-look save and draft (`venueLookService`) still read the Place lock and then write. An acceptance during one of those paid runs is still not seen. The look's base step still calls `generateBaseScene` with no finalizer; only its `catch` knows the new error.
- **The Locations save and Start Episode are not changed (B3).** `episodeLocationsService` and `episodeGeneratorService` take their own locks in their own order. Until B3, a Locations save can still deadlock with a finalization (it holds episode-location rows the sync writes, and then needs rows the finalization holds), and a Start Episode can still write the set an event had before a finalization moved it.
- **The acceptance-against-event-writer deadlocks remain (C1).** B1 adds none (§5) and removes none.
- **Saved scenes are not frozen (S1).**
- **The acceptance code is not changed**, nor `src/utils/placeLock.js`, `looks.js`, `episodeBriefRoutes.js`, the worker, or the World Location delete. The helper's own comment still says "No route calls it yet" (`src/utils/placeLock.js:28-29`); it is left, because that file is outside this change. `generate-venue` now calls it.
- **Deployment.** The unit is Foundation A, the `generate-venue` Place check (#3926) and all of B (B1, B2 and B3) together, never one of them alone. Deployed without B2 and B3, B1 closes the race on one route and leaves the others open, and adds the Locations-save deadlock named above. This amendment authorizes no deployment.

# §8. Limits and open points

- **A save that fails for another reason is still a 500 "failed"** (§4). The picture was generated and stored in that case too, so "generated, not saved" would describe it; it is not mapped to `generated_not_saved` because that outcome's `code` is the finalizer's refusal code and there is no established generic one. The stored keys are logged with `outcome=SAVE_FAILED`. On the missing-base path the set is marked `failed`, as a failed final write was before. Left for Evoni to rule.
- **Retry exhaustion on a held set row** (§5).
- **The look panel's new display has no data yet.** `eventLook` (`venueLookImageService.js:413`) sends `scene_set.error` only when the set is `failed`, and sends no `failed_at` or `generated_at`. That line is in the file B1 may change in one place only, so it was left. `EventLookImage` shows the reason when the read carries `error`, `failed_at` and `generated_at` on `scene_set`; until the read sends them (B2), the panel shows a not-saved base as it did before. The Scene Sets page's correction needs no server change and is complete.
- **`generate-venue`'s missing-base path takes no claim.** Two requests for the same set at once both pay, as before.
- **The doubles.** The provider and the object storage are test doubles in every run here. No provider was called and nothing was stored.
- **The live schema and the running processes were not verified.** Tables, columns, triggers and foreign keys are read from `src/migrations` and from a local database built by them. `deadlock_timeout` and the worker's database role on any server were not read. No server was contacted.
- **Stored rows.** None is changed. No migration.

# §9. Tests (MEASURED, local)

On a private, migrated local PostgreSQL test database, through the real app. The image provider (`axios`) and the object storage (`S3Client`) are doubles. No test sends DDL. The network guard reports 0 external attempts for every run below.

`tests/integration/placeLockGenerationB1.integration.test.js` (48 cases), against the real acceptance (`completeEpisode`, a real two-part completion made by the season routes and Start Episode), the real event `PUT` and the real `makeEventVersion`. A latch in the provider double holds a generation open while something else commits; other interleavings are held with the statement trace's gate or a second transaction, and a wait is seen in `pg_stat_activity`, not slept for.

- **New venue.** Saved with the same 200 body; one provider call and one put per image; the set, two angles, the event link and the sync in one transaction that ends in a commit, with no such write outside it; the stored `created_at` / `updated_at` are the timestamp made before it. The draft episode's Event location and its free beat move and its locked beat stays, row for row what a real event `PUT` to the same set does to a twin episode. An event with no set and no episode.
- **Accepted during generation** (a real completion committed while the provider double is held), for a primary event and for an event linked by its stamp alone: 409 `generated_not_saved` `PLACE_LOCKED` with the established text; one provider call per image; the puts happened and nothing was deleted; the event row (with `updated_at` and `scene_set_id`), every set, angle, episode link, plan and scene of the show equal before and after; no writing statement to those tables; one log line with the stored keys, the event, the outcome and the usage-log ids, and no `?`, signature or URL in any error line.
- **Both orders against a real acceptance**, for both kinds of event, on both paths: the acceptance holding its episode `FOR UPDATE` when the save begins (the save waits, then is refused); the save first (it commits, the acceptance waits and then succeeds; no lock conflict).
- **A two-part special**, on both paths: Part 1 accepted and Part 2's `UPDATE` held in its real window (refused under the strict rule), and the full two-part completion.
- **The set changed during generation** (a real event `PUT`; and no set, then one chosen): `STALE_SOURCE_SET`, the newer set kept, nothing written. **The event soft-deleted**: `EVENT_DELETED`.
- **Retries.** New venue: the event's links change between the finalizer's read and its locks on tries one and two, saved on try three, the provider and storage used once, one set row; on all three tries, `PLACE_FINALIZE_RETRY_EXHAUSTED`. A lock conflict raised inside the save after the set insert: that try rolled back whole, the next writes the same ids once. Missing base: the set row really held by another transaction (55P03 from `NOWAIT`, three times, in well under one lock timeout), exhausted; held on tries one and two and freed, saved on try three. The helper's `lockTimeout` test seam is not used: no production caller passes it.
- **A partial write**: the second angle insert, and the sync, made to throw: no set, no angle, the event and the episode's rows as they were; the route's 500 "failed"; the `SAVE_FAILED` line.
- **Missing base.** Saved as before; the marker is one autocommit statement `SET "generation_status"=…,"updated_at"=…` with no prompt, and the prompt is written once, in the final write, in the finalizer's transaction; the trace reads `E:episodes:share, W:world_events:update, X:scene_sets:update, X:scene_sets:write` and the set lock ends `FOR NO KEY UPDATE NOWAIT`. Accepted during generation with the set `pending` before and `failed` before: the status put back, the image columns equal, `last_error` and `failed_at` kept, one write to the set, nothing deleted. An attempt in flight on the set: the marker is refused by the database guard as before, and nothing is generated.
- **The set row against the real `makeEventVersion`**, both orders: the save holding the event row while the version holds the set row and waits for the event (no 40P01; one 55P03; the version commits; the save commits on its next try); the save holding both first (the version waits holding nothing; no lock conflict).
- **The three callers**, with a `finalize` that refuses: `generateBaseScene` itself (the typed error; `complete` with its old base put back, the old base neither replaced nor deleted; `pending` for a claimed set; a given `priorStatus`; never `uncertain`; a row another writer moved on is left), the `generate-base` route, and the look's base step: not marked failed. For each, a provider failure is still marked failed. With no `finalize`: one plain transaction and a waiting set lock. The base approved while the picture was being made: refused as before, `complete` put back, the reason kept.
- **The early refusal**, on both paths: the same body, with no `outcome`; no provider call, nothing stored, no writing statement.

Also run on that database, unchanged and passing: `p2bSceneSetAdmin` (in full: its early-refusal pins and both success paths), `placeLockStrict`, `placeLockFinalizer`, `sceneGenerationPlannedFlows`, `eventPlaceSync`, `worldLocationAdmin`; `tests/unit/routes`, `tests/unit/guards`, `tests/unit/middleware`, the `tests/unit/services/scene*` suites, `tests/unit/queues` and `tests/unit/workers`. One note on `sceneGenerationPlannedFlows`: it runs on the default daily image budget ($10) and passed unchanged in the first run; after several runs of the new suite the scratch database's logged spend for the day was above that budget (the new suite then left its `ai_usage_logs` rows behind), and one of its cases was refused by the budget gate before the provider double. The new suite now removes the usage rows it logs, by id, as `approvedBase` does; `sceneGenerationPlannedFlows` passes on that same database with `AI_DAILY_IMAGE_BUDGET_USD` raised for the run.

Frontend (Vitest): `SceneSetsTab.baseNotSaved.test.jsx` (7) and `EventLookImage.notSaved.test.jsx` (5): the success toast on a real success, on a success after an older recorded error, and the recorded sentence on a run that was not saved; with the page's and the panel's existing suites.

**Control.** With the six changed backend source files put back to the basis (`git checkout origin/main --` on them, then restored), 40 of the 48 cases fail and 8 pass. The 8 are the ones that describe what did not change: an event with no set and no episode, no provider key and a failing provider (both paths), the attempt in flight, the two early refusals, the network guard, and one case the basis satisfies by ignoring the option it is given (a `finalize` that runs the work twice ends with the base saved either way). That run used an 8-second limit per case (`GENB1_TEST_TIMEOUT_MS`), since a case that holds an interleaving the basis never reaches waits out its whole limit; the suite's own limit is 90 seconds.

**No existing test was changed.**

**Not run locally, by the rule that a local run sends no DDL** (each runs `ALTER TABLE` or a migration's `up()` / `down()` in its own setup; CI runs them): `approvedBase`, `venueAttachedSet`, `venueBrief`, `venueLookImage`, `sceneGenerationLegacyCompat`, `sceneGenerationGuards`, `sceneBrief`, `sceneBriefShown`, `sceneEventChoice`, `sceneBaseModelComparison`, `baseDescriptionReview`, `workerRestrictedRole`. They exercise `generateBaseScene` and `generate-venue` and were read against this change: `approvedBase`'s late-approval case sets the set `complete` before the run, so the status put back is `complete`, as it asserts; the others read the prompt only after a run that completed. The late-approval behaviour and the default path are covered locally by the new suite.

---

**Type:** amendment.
**Rules:** `generate-venue`'s new-venue and missing-base paths save through `finalizePlaceWrite`; a save refused after the picture was made is 409 `generated_not_saved`, with the contract of §6, on Evoni's authorization quoted in §2. **Mints:** nothing (no FD, XK or PE number). **Discharges:** nothing.
**Host/AWS/DB/Cognito contact (this session):** the tests ran against a local PostgreSQL test database in the session's own container. No deployed host, AWS service, production or development database, or Cognito pool was contacted for this change, and no paid provider was called.
**Production standing:** as the newest Fix Plan revision states it (`F-Deploy-1_Fix_Plan_v1.56.md`, footer): "Production's freeze is lifted (`F-Deploy-1_Fix_Plan_v1.53.md` §1)". What an agent session may do in production is set by `CLAUDE.md` and `F-Tools-5_AgentProductionAccess_Ruling_2026-10-31.md`.
