# Scene delete and reorder: numbering without schema changes (2026-11-22)

**Status:** implemented in PR #3925 at Evoni's approval (2026-11-22). **Not approved to merge or deploy** at the time of writing. No server and no deployed database was read or changed for this record. The tests ran on private, freshly migrated local databases, with and without the index described in §2.

**Follows:** `docs/reads/2026-11-04-runtime-ddl-inventory.md`, finding D9 and its "Separate fixes found by this work". That record is not edited.

**#3925 does not establish global scene-number uniqueness.** It makes two handlers, the scene delete and the scene reorder, atomic and free of schema changes. §2 to §4 say what is still open.

## 1. What #3925 changes

In `src/controllers/sceneController.js` only. No route, migration or model is changed.

- **`deleteScene`** no longer drops and re-creates `idx_scenes_episode_scene_number`. The soft delete and the renumbering are one transaction, under the episode's lock (`lockEpisodes`, `src/utils/episodeLocks.js`). Either both happen or neither does.
- **`reorderScenes`** takes the same episode lock before it reads the scenes, so a delete and a reorder of one episode take turns.
- **Waiting numbers** (`waitingBase`). Both handlers renumber in two passes. In the first, the scenes wait at numbers above the highest number any live scene of the episode holds. A reorder used to wait at 1000 and up, which met any live scene already numbered there.
- **Overflow.** `scene_number` is a 32-bit integer. When the waiting numbers would not fit, both handlers refuse with 409 `SCENE_NUMBER_RANGE` and change nothing; the delete's soft delete is rolled back with its transaction.
- **Lock wait.** A wait for the episode's lock that runs out, or a deadlock, answers the existing 409 `RETRY`, with nothing changed.
- **Guard.** `tests/unit/guards/noRuntimeDdl.test.js` no longer lists `sceneController.js` as an exception.

**D9's production symptom** (a scene delete answering 500 after the scene was already soft-deleted) should be resolved by this. "Should" rests on the read recorded on 2026-11-04 and on a test that runs both handlers as a login that does not own the table. It does not rest on a check of any server.

## 2. The index, and where it exists

- **Production, as recorded on 2026-11-04 and 2026-11-06; not re-read for this record:** `scenes` has a partial unique index on `(episode_id, scene_number) WHERE deleted_at IS NULL`, named `idx_scenes_episode_scene_number` and owned by `postgres` (D9 in the 2026-11-04 inventory; the header of `tests/integration/beatScenesProductionShape.integration.test.js` for the 2026-11-06 capture).
- **No file under `src/migrations` creates it.** A freshly migrated database does not have it (measured on a private local database after every migration). After #3925 nothing creates it at run time.
- **The development server:** not known. `docs/reads/2026-11-04-runtime-ddl-check.sql` (D9) answers it for any server; it was not run for this record.
- **So:** a database without the index can hold two live scenes of one episode with the same number, and nothing in #3925 prevents that.

## 3. Writers that pick a number without the episode's lock

Unchanged by #3925. Read from the code at `origin/main` `878a22d8`; none of them was run for this record unless the row says so.

| Writer | How the number is chosen | Lock, transaction | With the index, when the number is taken |
|---|---|---|---|
| `sceneController.createScene` (`POST /api/v1/scenes`) | `Scene.getNextSceneNumber`: the highest live number + 1 | No episode lock; no transaction (a read, then `Scene.create`) | The create is refused; 500 "Failed to create scene"; nothing written |
| `sceneController.duplicateScene` (`POST /api/v1/scenes/:id/duplicate`) | `Scene.max('scene_number')` for the episode, + 1 | No episode lock; no transaction (the scene, then its asset links, as separate statements) | The create is refused before any asset link; 500 "Failed to duplicate scene"; nothing written |
| `apply-scene-plan` (`src/routes/scriptParse.js`) | The parsed script's own numbers, from 1 | No episode lock; no transaction; one `Scene.create` per scene, each in its own `try` | That scene is skipped and logged ("Failed to create scene N"); the others are still created; the route answers 200 with a lower `scenesCreated`. With `clearExisting`, the earlier hard delete is not undone |
| `parse-scenes` (`POST /api/v1/scripts/:scriptId/parse-scenes` → `scriptsService.parseScriptAndCreateScenes`, legacy) | The parsed script's numbers | No episode lock; no transaction; one raw `INSERT` per scene | The statement throws and the request fails; scenes inserted before it stay. The insert names columns `name` and `type`, which the migrated `scenes` table does not have, so on a migrated database it fails at the first scene whatever the numbers are |
| Footage upload (`POST /api/footage/upload`, `src/routes/footage.js`) | The number parsed from the filename, or none | No episode lock; no transaction; the file is stored before the scene row is made | The create is refused; 500 "Upload failed"; the stored file stays with no scene row. A scene with no number never collides |

What a test in #3925 exercises (`tests/integration/sceneDeleteNoRuntimeDdl.integration.test.js`, on a `scenes` table with and without the index):

| Case | Index present | Index absent |
|---|---|---|
| A scene is added at highest + 1, by a plain insert standing in for these writers, while a reorder is part-way | The reorder's first waiting number is taken: unique violation, the whole reorder rolls back and never commits, 500; every earlier row is as it was and the added scene is as its creator committed it. A retry succeeds | No error; the reorder goes through |
| A reorder lists only some scenes, and its final numbers meet an unlisted scene's number | Unique violation in the second pass, full rollback, no commit, 500 (as before #3925) | The numbers repeat (as before #3925) |

The writers in the first table were not themselves run against a reorder or a delete.

## 4. Numbers near the integer limit

An episode with a live scene numbered within n of 2,147,483,647 (n being the number of scenes to renumber) cannot be renumbered by a delete or a reorder: both refuse with `SCENE_NUMBER_RANGE`, and nothing is changed. Nothing in the application moves such a number down. No instance is known; no database was read.

## 5. Options not taken

- **A migration that defines the index** (`IF NOT EXISTS`, after a check for duplicates on each server). It would make migrated databases match production as recorded. A separate decision.
- **Making the writers in §3 take the episode's lock,** or choose their number under it. Out of #3925's scope.

## 6. Follow-up work

- **STILL OWED, separate fix: duplicates where the index is absent.** A database without the index can hold repeated live scene numbers (§2, §3); #3925 leaves that as it was.
- **STILL OWED, separate fix: recovery for numbers near the integer limit** (§4). There is no way to bring such a number down.
- **STILL OWED, separate decision (Evoni): schema reconciliation.** Whether a migration should define the index (§5). Before it, on each server, a read-only check that no two live scenes of an episode share a number.
- **STILL OWED, separate fix: the remaining writers that pick a number without the episode's lock** (§3).
- **STILL OWED, Evoni-only: the D9 query on the development server,** to learn whether its `scenes` has the index.
- **STILL OWED, Evoni-only, after any deploy of #3925: one scene delete on the server,** since §1's "should" is not a server check.
