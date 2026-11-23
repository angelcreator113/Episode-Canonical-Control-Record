| **PRIME STUDIOS** **F-AUTH-1 — THE PLACE LOCK, GENERATION B1: `generate-venue` SAVES THROUGH THE FINALIZER (AMENDMENT)** *The two paid paths of `generate-venue` (a new venue; the missing base of the set the event has) now save what they generated in the Foundation A finalizer's transaction. A save refused after the picture was made answers 409 `generated_not_saved`: nothing is written, nothing is deleted from storage, the provider is not called again. A save that fails for another reason stays a 500, told apart by a code. The finalizer gains one opt-in pause between tries that lost to a lock. Event looks, dressed angles, the venue-look draft, the Locations save and Start Episode are not changed.* |
| --- |

**Document version**

v1.1 (v1.0 was this file before Evoni's review of the same day, on the same unmerged branch; §2 "Her review", §5a, the 500 in §4 and the test lists are what changed). This is an additive amendment, written as a new file because the register is append-only. **Mints nothing.**
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

## Her review of the change (RULED, 2026-11-23)

On the set-row lock and the three immediate tries (§5, §5a):

> "Keep NOWAIT for the set-row lock because it avoids the identified opposing lock-order deadlock. However, three immediate retries may prematurely abandon an already-paid generation. Before changing code, inspect Foundation A's retry helper and propose the smallest backward-compatible way to introduce a bounded delay between eligible lock-contention retries. Requirements: Maximum three attempts remains unchanged. Delay happens outside all transactions. No paid provider or storage operation is repeated. Non-retryable errors and Place-lock refusals are never retried. Existing callers keep their current behavior unless separately approved. Preserve the established exhaustion response and strict locking guarantees. Test a transient row lock, persistent lock, real acceptance in both orders and the established timeout behavior. If introducing this safely requires expanding Foundation A in an unexpected way, stop and report before modifying it."

On a save that fails for a reason that is no refusal (§4):

> "Do not classify an unexpected database exception as PLACE_LOCKED. Preserve the existing HTTP 500 behavior and safe error code, but distinguish 'image generated and stored, database finalization failed' through consistent structured error metadata. Do not expose SQL, stack traces or private storage credentials. Log known stored-object keys, event, outcome, error classification and known cost. Preserve rollback of all database work inside the finalizer. Do not delete stored images automatically or rerun paid generation. Before modifying response contracts, identify any existing callers and tests that depend on the current HTTP 500 body. Reuse existing error conventions."

On the look panel (§8):

> "Leave the incomplete read-field integration for B2. Do not expand B1 to change the B2-reserved read path. Ensure B1 does not introduce a regression into the current Event look panel."

And on the new venue:

> "A generated venue must not report successful Scene Set creation if required angle creation or event-location synchronization fails. Use one finalizer transaction for its required database writes. Keep optional provider-based post-success work outside the retryable callback."

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
| `finalizePlaceWrite` (`src/utils/placeLock.js`) | Its checks, locks, tries and outcomes are not changed. One opt-in option is added on her ruling (§5a). |

## The last-error mechanism

`markBaseFailed` (`src/services/venueLookImageService.js:361-369`) is the one writer of `scene_sets.base_generation.last_error` and `failed_at`; it also sets `generation_status = 'failed'`, in one statement, and lives in a file this change may touch in one place only (§7). It cannot be reused without marking the set failed. `restoreBaseAfterRefusal` (`src/services/sceneGenerationService.js:1042-1061`) writes the same two keys in the same shape (`jsonb_build_object('last_error', CAST(:reason AS text), 'failed_at', NOW())`, the reason cut to 500 characters) and does not set `failed`.

# §4. What the change does (MEASURED on the branch)

## The new venue: `generateVenueImages` (`src/services/venueGenerationService.js:174-355`)

1. `sourceSetId = event.scene_set_id ?? null`, from the row the route loaded, before anything is generated (`:176`).
2. Outside the transaction, as before: the briefs, the interior and exterior provider calls, the downloads, the two storage puts. The provider calls are given an `onLogged` callback, so the cost and `ai_usage_logs` ids they were logged with are known afterwards. The object keys written are collected (`uploadToS3`, `:35-44`).
3. Before the transaction: the set's id, the angles' ids, one timestamp, and the whole rows (`:249-308`).
4. `finalizePlaceWrite(sequelize, event.id, { sourceSetId, work, retryDelayMs })` (`:341`; the pause is §5a). `work({ transaction })` (`:315-325`), every statement with that transaction and no `catch`: `SceneSet.create`, the `SceneAngle.create`s, `UPDATE world_events SET scene_set_id`, then `syncEpisodeEventLocation({ eventId, fromSetId: sourceSetId, toSetId, transaction })`. A new model instance is built on each try.
5. `OK`: what the route answered before. Any other outcome: one log line (below) and a `PlaceFinalizeRefusal`. An error thrown by `work` that is no lock conflict is rolled back by the helper and thrown on, marked as a failed save, after the same log line with `outcome=SAVE_FAILED` and the error's class.
6. Nothing provider-based runs after the save on this path: the venue has no analysis or style call. Every required write (the set, each angle, the event's move, the episode's Event location) is in the one transaction, so none can fail and leave the venue answered as created.

The two `catch` blocks that swallowed a failed create or a failed link are gone. A failed statement now fails the save as a whole: before, a venue whose angles failed to insert was still answered as "scene set created".

## The missing base: `generateBaseScene` (`src/services/sceneGenerationService.js:1091-1307`)

One pipeline, with two new options. Callers that pass neither behave as before except where this section says so.

- `options.finalize`: `async (work) => { outcome, code, message, attempts }`. Not given: one plain `sequelize.transaction` around `work`.
- `options.priorStatus`: the status put back on a refusal. Not given (`priorBaseStatus`, `:1014-1019`): the row's own status when it is `pending`, `complete` or `failed`; else (the caller's claim already marked it `generating`) `complete` with a base and `pending` without, the rule the cascade route uses (`src/routes/sceneSetRoutes.js:2505`). Never `generating`, never `uncertain`.

In order:
1. The marker (`:1114-1117`): one statement, `generation_status = 'generating'` only. `base_runway_prompt` is no longer written here; it is written with the picture. (After a failed run the set keeps its earlier prompt. The readers of that column are the Scene Sets page's "prompt" disclosure and the angle-suggestion context, `sceneSetRoutes.js:1553`.)
2. The provider call and the storage put, as before.
3. Everything the final write needs, built before the save (`:1138-1165`).
4. `finalize(work)`. `work({ transaction })` (`:1179-1194`): lock the set row; ask whether the base was approved meanwhile, in the transaction; the final `UPDATE`, with the prompt.
5. `OK`: then, outside the transaction and as before, `repointBaseAngles`, `deleteOldBaseImage`, `noteBaseChanged`, the analysis and the style call.
6. Not `OK` (`:1230-1235`): `restoreBaseAfterRefusal`; the log line; `throw new PlaceFinalizeRefusal(outcome)`.
7. Approved meanwhile (`:1217-1219`): the same `ApprovedBaseError` and message as before. The status is put back to what it was instead of always to `complete`, and the reason is now kept in `last_error` (a set with an approved base that was `complete` before reads `complete` after, as before).

8. The save throwing anything else (`:1220-1227`): the log line with `outcome=SAVE_FAILED` and the error's class; the fixed sentence of the 500 below kept in `last_error` with `failed_at`; the error marked as a failed save and thrown on unchanged, so the set is marked `failed` by the `catch` below it exactly as a failed final write was at the basis (`sceneGenerationService.js:1077-1084` there).

`venue.js:143-155` passes `finalize: (work) => finalizePlaceWrite(sequelize, event.id, { sourceSetId: attached.id, work, retryDelayMs })`. No other caller passes a `finalize` in B1.

## The route's answers (`src/routes/worldEvents/venue.js:101-211`)

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

### A save that fails for another reason (her ruling, §2)

An error inside the save that is no lock conflict and no refusal (a constraint violation, a lost connection, any exception from a required write). It is never answered as `PLACE_LOCKED` or `generated_not_saved`, and never as a set created.

What depended on the 500 body, read before it was changed:

| Reader | What it reads |
|---|---|
| The frontend | Nothing. `grep -rn "generate-venue" frontend/src scripts` finds one test file, which asserts the route is **not** called (`EventLibrary.venueBrief.test.jsx:70, 98`). No page calls the route. |
| `tests/integration/venueAttachedSet.integration.test.js:208-209` | A provider failure: status 500, `toMatchObject({ success: false, outcome: 'failed' })`. Not this case, and still true of it. |
| `p2bSceneSetAdmin`, `venueBrief`, `tests/unit/routes/world-cluster-tier-promotion.test.js` | No 500 body. |

At the basis, and for every other failure still, the body is `{ success: false, outcome: "failed", error: err.message }`, HTTP 500 (429 for a budget refusal): `error` is the exception's own message. For a provider failure that is the provider's text, as before, and it is left exactly so. For a database error it is the database's message, which names tables and constraints. There was no `code` on this route's 500.

The repository's convention for a 5xx that must not echo the exception is a fixed `error` sentence with a stable `code` (`src/routes/sceneSetRoutes.js:299, 318`: `{ success: false, error: 'Scene sets could not be read', code: 'SCENE_SETS_UNAVAILABLE', … }`; `src/utils/aiFailure.js:44`). That is what is used. No new field: `code` and `message` are fields the route's other answers already carry.

```
HTTP 500
{ "success": false,
  "outcome": "failed",
  "code":    "GENERATED_SAVE_FAILED",
  "error":   "The image was generated and stored, but saving it failed. Nothing was saved.",
  "message": "The image was generated and stored, but saving it failed. Generating it again costs again." }
```

- The status, `success` and `outcome` are what they were. `code` tells it from a failed generation (which has none).
- `error` and `message` are fixed sentences. The exception's message, SQL, parameters, constraint detail and stack are not sent.
- The server logs the `[GeneratedNotSaved]` line (below) with `outcome=SAVE_FAILED` and `error=<error name>/<SQLSTATE or code>`, and one line `[VenueGen] generated, the save failed (<class>)`. For this case the exception itself is not logged: a database error's parameters can carry the provider's signed URL when no bucket is configured. Every other failure is logged as it was (`console.error('[VenueGen] Error:', err)`).
- Everything the finalizer's transaction wrote is rolled back by the helper (not changed). Nothing is deleted from storage. The provider is not called again.
- On the missing-base path the set is marked `failed`, as at the basis for a failed final write, and `last_error` holds the `message` sentence.

How it is carried: the error thrown is the original one, with a non-enumerable `generatedSaveFailed` mark (`markSaveFailed`, `sceneGenerationService.js:953-958`), so `generateBaseScene`'s other callers see the same error and message they saw before.

## The three callers that mark a base failed

| Caller | Now |
|---|---|
| `generateBaseScene`'s own `catch` (`sceneGenerationService.js:1298-1306`) | Skips `ApprovedBaseError` (as before) and `PlaceFinalizeRefusal`. |
| The `generate-base` route (`sceneSetRoutes.js:1442-1451`) | The same two. |
| The look's base step (`venueLookImageService.js:244-250`) | Returns on `PlaceFinalizeRefusal` before `markBaseFailed`. Everything else, an approval meanwhile included, is marked failed as before: that flow is B2's. |

Only `venue.js` passes a finalizer that can refuse, so in B1 the second and third cannot meet the refusal yet. The skip is tested by giving `generateBaseScene` a `finalize` that refuses.

The worker (`src/workers/sceneGenerationWorker.js:190-191`, `:258`) marks a set failed with `WHERE generation_status = 'generating'`: after the restore it matches nothing. Read, not changed.

## The log line

One `console.error` line per picture that was made and not saved (`generatedNotSavedLine`, `sceneGenerationService.js:994-1004`):

```
[GeneratedNotSaved] an image was generated and not saved: storage_keys=venues/<event id>/<uuid>-venue.png,venues/<event id>/<uuid>-exterior.png event=<event id> set=none outcome=PLACE_LOCKED attempts=1 cost=$0.08 estimate=$0.08 usage_log_ids=<id>,<id>; nothing was deleted from storage
```

- `storage_keys`: the object keys (for a base, `scene-sets/<set id>/stills/<ms>-base.jpg`). Never a URL, a host or a query string. With no bucket configured the venue path stores nothing and the line says `none (no bucket is configured: nothing was stored)`.
- `cost`: the sum the provider calls were logged with; `unknown` when none was priced. `estimate`: the rate-table estimate. `usage_log_ids`: the `ai_usage_logs` rows.
- `outcome`: the code, or `SAVE_FAILED`. With `SAVE_FAILED` the line also carries ` error=<error name>/<SQLSTATE or code>` before the last clause (for example `error=SequelizeForeignKeyConstraintError/23503`): the class, never the message, the SQL or its parameters. `attempts` reads `n/a` there: the helper throws such an error on the try it happened in and does not say which.

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

**The decision: the set row is locked `FOR NO KEY UPDATE NOWAIT` when the save runs under a caller's finalizer** (`sceneGenerationService.js:1181-1185`). The save never waits for a set row while it holds the event row, so it can be in no such circle. A held set row is PostgreSQL 55P03 at once; the finalizer treats 55P03 as a lock conflict, rolls back (releasing the event row and the episodes) and tries again, up to three times in all. With no caller's finalizer (the Scene Sets `generate-base`, the cascade, the look's base step, the model comparison) nothing else is held, and the lock is a plain `FOR NO KEY UPDATE` that waits, as the `UPDATE` always did.

Ruled kept (§2). What it cost in v1.0 of this change: the three tries followed one another with no pause, so a set row held for a few milliseconds longer than three tries take ended `PLACE_FINALIZE_RETRY_EXHAUSTED` with a picture already paid for. §5a is the answer to that.

When the set row's holder is itself waiting for this event, the first rollback lets it through and the next try queues behind it at the event row (raced with the real `makeEventVersion`, §9).

The restore after a refusal is one statement outside any transaction; it waits for the set row like any other write, holding nothing.

# §5a. The pause between tries (RULED §2; MEASURED)

## What was read first in the helper (at the basis, `src/utils/placeLock.js:182-197`)

- The loop calls `attemptPlaceFinalize` up to three times. Each call opens its own transaction and has committed or rolled it back before it returns or throws (`:75`, `:93`, `:100`, `:105`, `:113`, `:123`, `:126`). So between two iterations no transaction, lock or connection is held: a pause placed there holds nothing.
- A try is repeated for two kinds of reason: a link that changed between the read and the locks (`EVENT_LINK_CHANGED`, `:99-102`), and a lock conflict caught at `:125-131` (PostgreSQL 40P01 or 55P03, or a `RetryableConflictError` thrown by `work`). The three refusals return at once; any other error is thrown at once.
- Its callers: at the basis, none in the application; on this branch, the two of B1 (`venueGenerationService.js:341`, `venue.js:151`). Its suite (`placeLockFinalizer`) pins the attempts, the outcomes, the 55P03 timings and the module's exact exports (`Object.keys(placeLock)`).

## The change (`src/utils/placeLock.js`)

One optional option, `retryDelayMs`, default `0`.

- **Default 0: no pause, exactly as before.** A caller that does not pass it is unchanged; the existing suite passes without an edit (§9).
- **Bound:** a finite number from 0 to 2000 (`finalizePlaceWrite.MAX_RETRY_DELAY_MS`). Anything else (negative, `NaN`, `Infinity`, above the bound, a string, `null`) is an error thrown before any transaction, as a bad `lockTimeout` is. It is not clamped: a wrong value is a caller's mistake, and silence would hide it.
- **Where:** in the loop, after a try returned "try again" and before the next begins (`:225`). The lost try's transaction is finished by then.
- **When:** only after a lock conflict (40P01, 55P03, `RetryableConflictError`). `attemptPlaceFinalize` now says which kind of retry it is (`contention: true` from its `catch`). After `EVENT_LINK_CHANGED` the next try is immediate, as before: nothing is being waited for there, the new link is simply locked on the next try.
- **Never:** after the last try; before a refusal (`PLACE_LOCKED`, `STALE_SOURCE_SET`, `EVENT_DELETED`); before a thrown error. Those end at once, as before.
- **Unchanged:** three tries at most; every check repeated on every try; the lock order; the 10-second lock wait; the outcomes and the exhaustion result's shape; `work` once per try. The pause repeats nothing paid: `work` is database work only.
- The timer is `finalizePlaceWrite.retryPause.sleep`, and the bound `finalizePlaceWrite.MAX_RETRY_DELAY_MS`: both on the function, not on the module, whose exports the suite pins. The stale comment "No route calls it yet" is corrected (comment only).

Nothing else in the helper needed to change, and `episodeLocks.js` is not touched.

## What B1 passes: 250 ms, on both paths

`PLACE_FINALIZE_RETRY_DELAY_MS = 250` (`sceneGenerationService.js:934`), passed by both call sites.

- The lock it is for is the `NOWAIT` set-row lock of the missing-base path. Its holders are single short transactions (`makeEventVersion`, `makeEveryday`, `approveBase`: a handful of statements). A quarter of a second outlasts them by a wide margin; three tries now span at least half a second instead of a few milliseconds.
- The cost is at most two pauses: half a second added to a request that has already waited many seconds for a provider.
- The new-venue path takes no `NOWAIT` lock, but its tries can lose to a deadlock (40P01) or a lock wait that ran out (55P03) on the episode, event or episode-location rows. A pause after a deadlock lets the other transaction finish before the same rows are asked for again; after a 10-second wait it is negligible. Both paths pass the same value so that one number describes the behaviour.
- A row held for longer than that by a transaction that is not waiting for this event still ends `PLACE_FINALIZE_RETRY_EXHAUSTED`, with the established answer. The pause makes that rare; it does not make it impossible.

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
- **The acceptance code is not changed**, nor `looks.js`, `episodeBriefRoutes.js`, `episodeLocks.js`, the worker, or the World Location delete. `src/utils/placeLock.js` gains the one option of §5a and a corrected comment, and nothing else.
- **Deployment.** The unit is Foundation A, the `generate-venue` Place check (#3926) and all of B (B1, B2 and B3) together, never one of them alone. Deployed without B2 and B3, B1 closes the race on one route and leaves the others open, and adds the Locations-save deadlock named above. This amendment authorizes no deployment.

# §8. Limits and open points

- **A save that fails for another reason is a 500 "failed" with `GENERATED_SAVE_FAILED`** (§4; ruled, §2).
- **Retry exhaustion on a set row held for longer than the three tries and their two pauses** (§5a).
- **The look panel's new display has no data yet.** `eventLook` (`venueLookImageService.js:413`) sends `scene_set.error` only when the set is `failed`, and sends no `failed_at` or `generated_at`. Ruled left for B2 (§2): the read path is not changed. `EventLookImage` shows the reason when the read carries `error`, `failed_at` and `generated_at` on `scene_set`; until the read sends them, the panel shows a not-saved base as it did before. **With today's read the panel is as it was**: `baseNotSaved` needs a `failed_at`, which today's read never sends, so every branch it guards takes the path it took at the basis; a Vitest file with today's payload (a base generating, failed with and without a reason, complete, absent, and no set) passes against the component at the basis and on the branch (§9). The Scene Sets page's correction needs no server change and is complete.
- **`generate-venue`'s missing-base path takes no claim.** Two requests for the same set at once both pay, as before.
- **The doubles.** The provider and the object storage are test doubles in every run here. No provider was called and nothing was stored.
- **The live schema and the running processes were not verified.** Tables, columns, triggers and foreign keys are read from `src/migrations` and from a local database built by them. `deadlock_timeout` and the worker's database role on any server were not read. No server was contacted.
- **Stored rows.** None is changed. No migration.

# §9. Tests (MEASURED, local)

On a private, migrated local PostgreSQL test database, through the real app. The image provider (`axios`) and the object storage (`S3Client`) are doubles. No test sends DDL. The network guard reports 0 external attempts for every run below.

`tests/integration/placeLockGenerationB1.integration.test.js` (56 cases), against the real acceptance (`completeEpisode`, a real two-part completion made by the season routes and Start Episode), the real event `PUT` and the real `makeEventVersion`. A latch in the provider double holds a generation open while something else commits; other interleavings are held with the statement trace's gate or a second transaction, and a wait is seen in `pg_stat_activity`, not slept for.

- **New venue.** Saved with the same 200 body; one provider call and one put per image; the set, two angles, the event link and the sync in one transaction that ends in a commit, with no such write outside it; the stored `created_at` / `updated_at` are the timestamp made before it. The draft episode's Event location and its free beat move and its locked beat stays, row for row what a real event `PUT` to the same set does to a twin episode. An event with no set and no episode.
- **Accepted during generation** (a real completion committed while the provider double is held), for a primary event and for an event linked by its stamp alone: 409 `generated_not_saved` `PLACE_LOCKED` with the established text; one provider call per image; the puts happened and nothing was deleted; the event row (with `updated_at` and `scene_set_id`), every set, angle, episode link, plan and scene of the show equal before and after; no writing statement to those tables; one log line with the stored keys, the event, the outcome and the usage-log ids, and no `?`, signature or URL in any error line.
- **Both orders against a real acceptance**, for both kinds of event, on both paths: the acceptance holding its episode `FOR UPDATE` when the save begins (the save waits, then is refused); the save first (it commits, the acceptance waits and then succeeds; no lock conflict).
- **A two-part special**, on both paths: Part 1 accepted and Part 2's `UPDATE` held in its real window (refused under the strict rule), and the full two-part completion.
- **The set changed during generation** (a real event `PUT`; and no set, then one chosen): `STALE_SOURCE_SET`, the newer set kept, nothing written. **The event soft-deleted**: `EVENT_DELETED`.
- **Retries.** New venue: the event's links change between the finalizer's read and its locks on tries one and two, saved on try three, the provider and storage used once, one set row; on all three tries, `PLACE_FINALIZE_RETRY_EXHAUSTED`. A lock conflict raised inside the save after the set insert: that try rolled back whole, the next writes the same ids once. Missing base: the set row really held by another transaction (55P03 from `NOWAIT`, three times, in well under one lock timeout), exhausted; held on tries one and two and freed, saved on try three. The helper's `lockTimeout` test seam is not used: no production caller passes it.
- **A save that fails for another reason** (§4), with an error shaped as the database driver's (a message naming a table and a constraint, SQL, parameters holding a signed URL). New venue, thrown at each required write in turn (the second angle insert; the event's move to the new set; the sync): the 500 body exactly; never a 200, `outcome: "generated"` or `data`; nothing of the error in the body (no SQL keyword, constraint text, stack frame, URL or `?`); the event row and every set, angle, episode link, plan and scene equal before and after; one provider call and one put per image, nothing deleted, no second try and no pause; the log line with the keys, the event, `outcome=SAVE_FAILED`, `error=SequelizeForeignKeyConstraintError/23503`, the cost and the usage-log ids; no error line carrying the message, SQL, URL or signature. Missing base, thrown at the final set update: the same body; the set `failed` with the fixed sentence in `last_error`; the image columns equal; everything else equal.
- **The pause** (§5a) on the generation paths: none after a changed link (saved on try three, and exhausted); one of 250 ms after a lock conflict inside the new venue's save; the missing base with its set row held when the save begins and let go during the pause (a transient lock): saved on try two, one pause, and during it no session but the holder's inside a transaction and the lost try's transaction rolled back; held throughout: three tries, two pauses, the established exhaustion answer; against the real `makeEventVersion`: one 55P03, one pause, both commit.
- **What the source still says**: `requireAuth, authorize(['ADMIN']), aiRateLimiter` on `generate-venue`, in that order; the early Place check before the provider key, `generateBaseScene` and `generateVenueImages`; no storage delete in the venue service; both call sites passing the same pause.
- **Missing base.** Saved as before; the marker is one autocommit statement `SET "generation_status"=…,"updated_at"=…` with no prompt, and the prompt is written once, in the final write, in the finalizer's transaction; the trace reads `E:episodes:share, W:world_events:update, X:scene_sets:update, X:scene_sets:write` and the set lock ends `FOR NO KEY UPDATE NOWAIT`. Accepted during generation with the set `pending` before and `failed` before: the status put back, the image columns equal, `last_error` and `failed_at` kept, one write to the set, nothing deleted. An attempt in flight on the set: the marker is refused by the database guard as before, and nothing is generated.
- **The set row against the real `makeEventVersion`**, both orders: the save holding the event row while the version holds the set row and waits for the event (no 40P01; one 55P03; the version commits; the save commits on its next try); the save holding both first (the version waits holding nothing; no lock conflict).
- **The three callers**, with a `finalize` that refuses: `generateBaseScene` itself (the typed error; `complete` with its old base put back, the old base neither replaced nor deleted; `pending` for a claimed set; a given `priorStatus`; never `uncertain`; a row another writer moved on is left), the `generate-base` route, and the look's base step: not marked failed. For each, a provider failure is still marked failed. With no `finalize`: one plain transaction and a waiting set lock. The base approved while the picture was being made: refused as before, `complete` put back, the reason kept.
- **The early refusal**, on both paths: the same body, with no `outcome`; no provider call, nothing stored, no writing statement.

`tests/integration/placeLockFinalizer.integration.test.js`: its 31 cases are not edited; 21 are added, each named "retryDelayMs: …" (52 in all). Not given, or 0: no pause, a lock conflict tried again at once. A transient row lock let go during the pause: saved on try two, one pause, and during it the lost try's transaction is rolled back and no session but the holder's is inside a transaction (`pg_stat_activity`). A real timer waited between tries. A persistent lock: three tries, two pauses, the exhaustion result equal field for field. The three refusals and an error that is no lock conflict: one try, no pause. A changed link: tried again at once. The 10-second `SET LOCAL lock_timeout` still issued; a real 55P03 at a held event row (shortened through the existing `lockTimeout` seam) let go during the pause: saved after one pause. Seven invalid values refused before any transaction; the maximum accepted. A real acceptance in both orders, for both kinds of event, and the two-part window, with the pause asked for: the outcomes of the cases without it, and no pause. Run three times in a row, passing each time. **Control:** with `src/utils/placeLock.js` put back to the basis, none of the 31 existing cases fails; 20 of the 21 new ones do (the one that passes asks only that the maximum be accepted, which the basis does by ignoring it).

Also run on that database, unchanged and passing: `p2bSceneSetAdmin` (in full: its early-refusal pins and both success paths), `placeLockStrict`, `sceneGenerationPlannedFlows`, `eventPlaceSync`, `worldLocationAdmin`; `tests/unit/routes`, `tests/unit/guards`, `tests/unit/middleware`, the `tests/unit/services/scene*` suites, `tests/unit/queues` and `tests/unit/workers`. One note on `sceneGenerationPlannedFlows`: it runs on the default daily image budget ($10) and passed unchanged in the first run; after several runs of the new suite the scratch database's logged spend for the day was above that budget (the new suite then left its `ai_usage_logs` rows behind), and one of its cases was refused by the budget gate before the provider double. The new suite now removes the usage rows it logs, by id, as `approvedBase` does; `sceneGenerationPlannedFlows` passes on that same database with `AI_DAILY_IMAGE_BUDGET_USD` raised for the run.

Frontend (Vitest): `SceneSetsTab.baseNotSaved.test.jsx` (7) and `EventLookImage.notSaved.test.jsx` (5): the success toast on a real success, on a success after an older recorded error, and the recorded sentence on a run that was not saved; with the page's and the panel's existing suites. `EventLookImage.todaysPayload.test.jsx` (7): the panel with the read as it is today, passing on the branch and, as a control, against `EventLookImage.jsx` at the basis.

**Control (v1.0 of the suite, 48 cases).** With the six changed backend source files put back to the basis (`git checkout origin/main --` on them, then restored), 40 of the 48 cases fail and 8 pass. The 8 are the ones that describe what did not change: an event with no set and no episode, no provider key and a failing provider (both paths), the attempt in flight, the two early refusals, the network guard, and one case the basis satisfies by ignoring the option it is given (a `finalize` that runs the work twice ends with the base saved either way). That run used an 8-second limit per case (`GENB1_TEST_TIMEOUT_MS`), since a case that holds an interleaving the basis never reaches waits out its whole limit; the suite's own limit is 90 seconds.

**No test that existed at the basis was changed.** Cases were added to `placeLockFinalizer`; its existing cases are not edited.

**Not run locally, by the rule that a local run sends no DDL** (each runs `ALTER TABLE` or a migration's `up()` / `down()` in its own setup; CI runs them): `approvedBase`, `venueAttachedSet`, `venueBrief`, `venueLookImage`, `sceneGenerationLegacyCompat`, `sceneGenerationGuards`, `sceneBrief`, `sceneBriefShown`, `sceneEventChoice`, `sceneBaseModelComparison`, `baseDescriptionReview`, `workerRestrictedRole`. They exercise `generateBaseScene` and `generate-venue` and were read against this change: `approvedBase`'s late-approval case sets the set `complete` before the run, so the status put back is `complete`, as it asserts; the others read the prompt only after a run that completed. The late-approval behaviour and the default path are covered locally by the new suite.

---

**Type:** amendment.
**Rules:** `generate-venue`'s new-venue and missing-base paths save through `finalizePlaceWrite`; a save refused after the picture was made is 409 `generated_not_saved`, with the contract of §6; a save that fails for another reason is a 500 `GENERATED_SAVE_FAILED`; `finalizePlaceWrite` takes an opt-in pause between tries that lost to a lock; on Evoni's authorization and rulings quoted in §2. **Mints:** nothing (no FD, XK or PE number). **Discharges:** nothing.
**Host/AWS/DB/Cognito contact (this session):** the tests ran against a local PostgreSQL test database in the session's own container. No deployed host, AWS service, production or development database, or Cognito pool was contacted for this change, and no paid provider was called.
**Production standing:** as the newest Fix Plan revision states it (`F-Deploy-1_Fix_Plan_v1.56.md`, footer): "Production's freeze is lifted (`F-Deploy-1_Fix_Plan_v1.53.md` §1)". What an agent session may do in production is set by `CLAUDE.md` and `F-Tools-5_AgentProductionAccess_Ruling_2026-10-31.md`.
