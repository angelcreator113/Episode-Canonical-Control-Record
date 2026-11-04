# Runtime DDL: inventory and removal (2026-11-04)

**Status:** PR prepared at Evoni's approval (2026-11-04). **Not approved to merge or deploy.** No production privilege, ownership, data or schema change is made here. The read-only production check in §4 is run by Evoni.

**Why:** the Deploy workflow's migration trust check (#3710, merged) refuses to migrate while the application role `episode_app_dev` can create objects in `public`. That privilege can only be revoked once the application stops creating tables at runtime. With CREATE revoked, `CREATE TABLE IF NOT EXISTS` fails with "permission denied for schema public" even when the table exists (measured).

## 1. The nine table-creation paths

| # | File, function | When it runs | Table | Migration before this PR | Permanent? | If the creation call is removed | Normal behaviour affected? |
|---|---|---|---|---|---|---|---|
| 1 | `src/routes/sceneSetRoutes.js` `ensureGenerationJobsTable` | Request: five routes (angle still regenerate check `refuseWhileVideoRuns`, `POST /:id/angles/:angleId/generate-video`, `POST /:id/cascade-regenerate`, `GET /jobs/set/:setId`, `GET /jobs/:jobId`); first call per process | `generation_jobs` | yes, `20260323000000` (and two later ones) | yes (the job queue) | Nothing changes where the table exists. If it were missing, the reads fail as they do today after the sync fails: `GET /jobs/set` returns `[]`, the others 500. | No |
| 2 | `src/workers/sceneGenerationWorker.js` `start` | Background: the `episode-worker` pm2 process starts it (`src/workers/start.js`); the dev server embeds it outside production | `generation_jobs` | yes | yes | Nothing changes. The sync failure was already caught and only logged; without CREATE it would have logged an error on every worker start. | No |
| 3 | `src/routes/continuityEngine.js` `ensureTables` | Request: the first `GET /api/v1/continuity/timelines` per process, and only when `continuity_timelines` is missing | `continuity_timelines`, `continuity_characters`, `continuity_beats`, `continuity_beat_characters`, type `enum_continuity_timelines_status` | **no** (new: `20261104200000`) | yes (user content) | Tables come from the migration (they already exist in production). Before it runs, a missing table makes the continuity routes 500. Before this PR, any other continuity route used first also failed. | No, once the migration has run |
| 4 | `src/routes/franchiseBrainRoutes.js` `POST /franchise-brain/seed` | Request (manual seeding), only when `FranchiseKnowledge.count()` fails | `franchise_knowledge` | yes, `20260307210000` | yes (Show Brain) | Returns 503 "could not be read (has its migration run?)" instead of trying to create the table. The table exists and many services read it. | No |
| 5 | `src/routes/storyHealth.js` `GET /versions/chapter/:chapterId` | Request (BookEditor version history) | `chapter_versions` | **no** (new) | yes (version history) | Table comes from the migration; before it runs, 500. | No, once the migration has run |
| 6 | `src/routes/storyHealth.js` `POST /versions/chapter/:chapterId` | Request (saving a version) | `chapter_versions` | **no** (new) | yes | Same as 5 | No, once the migration has run |
| 7 | `src/routes/worldStudio.js` `ensurePreviewsTable` | Startup (+10 s), then hourly in the API process (`cleanupOrphanedPreviews`). Also after an AI preview is generated (`persistPreviewToDB`), and on `GET /world/preview/:id`, `GET /world/previews` and `DELETE /world/previews/:id` | `ecosystem_previews` | **no** (new) | The table yes; its rows are temporary (pending previews, purged after an hour) | Table comes from the migration. The create's error was already swallowed with a warning, so behaviour is unchanged; the hourly CREATE attempt and its warning go away. | No |
| 8 | `src/routes/admin.js` `GET /create-video-compositions-table` | Manual admin request (a "test route"); no frontend caller | `video_compositions` and 2 indexes | **no** (new) | n/a | **The route is removed (404).** A GET that changes schema is not kept. | No (no caller) |
| 9 | `src/controllers/videoCompositionController.js` `list` | Request: `GET /api/v1/episodes/:episodeId/video-compositions`; no frontend caller | `video_compositions` and 2 indexes | **no** (new) | yes | Table comes from the migration; before it runs, 500. | No, once the migration has run |

**Not table creation.** None of these needs CREATE on `public`, so they don't block the revoke. They stay, and a guard test caps them:

| File | What | Note |
|---|---|---|
| `src/app.js` | `sequelize.sync()` | Only with `ENABLE_DB_SYNC=true`, a danger switch never set in production (F-App-1 plan §9.3). |
| `src/models/index.js` | the `sync()` helper | Nothing calls it. |
| `src/server.js` | legacy repair of the `shows` unique constraints (ALTER, DROP INDEX, CREATE UNIQUE INDEX) | Only while `shows_name_key`/`shows_slug_key` exist. It needs **table ownership**, which the app does not have, so in production it fails with a warning on each start if they still exist (§4, D9). **Separate decision.** |
| `src/controllers/sceneController.js` | scene delete: DROP INDEX and CREATE UNIQUE INDEX `idx_scenes_episode_scene_number` around renumbering | Needs ownership of `scenes`. If that index exists in production and `postgres` owns `scenes`, renumbering after a scene delete fails and rolls back, after the soft delete already succeeded (D9 shows whether the index exists). **Possible existing bug; separate fix.** |
| `src/services/scriptVoiceClipsService.js` | `ensureTable` | Only checks `to_regclass` and answers 409 if missing: the pattern to follow. |

## 2. The change

**Code:**
- **Removed:** all nine creation calls, and the admin test route.
- **Comments:** each removed call is replaced by a one-line comment naming the migration that creates its table.
- **franchise_knowledge:** its seed route answers 503 instead of creating the table.

**Migration `20261104200000-create-runtime-created-tables.js`:**
- **Definitions:** **production's own**, read from its catalog (§4a, D3/D4): the four continuity tables and their indexes, `ecosystem_previews`, and `video_compositions` with its indexes. Also `chapter_versions`, absent in production, with its runtime definition; and `brain_documents`, with its migration's definition (§5).
- **Create only what is missing:**
  - every table is `CREATE TABLE IF NOT EXISTS`;
  - each index is created only when missing **and** the migration role may index that table. On a table another role owns, the index is skipped with a notice, because `CREATE INDEX` there is refused for a non-superuser even with `IF NOT EXISTS`.
- **Name resolution:** schema-qualified names, and a `pg_catalog`-only search path inside the transaction.
- **`down`:** does nothing. The tables may predate the migration and hold data.
- **Convention exception:** `chapter_versions`, `ecosystem_previews`, `video_compositions` and `continuity_beat_characters` have **no `deleted_at`**, as in production. Adding it is a separate change.

**Tests:**
- **`scriptWriteGuard`:** registers the migration.
- **CP10 admin test:** now asserts the route is gone.
- **Step-2 schema baseline:** the three continuity "no table" entries go. `ContinuityBeatCharacter`'s missing `deleted_at` stays, re-labelled `paranoid-no-deleted_at`.

**Verified locally (Postgres 16):**
- **Same schema as production.** On a fresh database built from all 397 migrations, the D3/D4 output for these tables is identical to production's, line for line (84 lines).
- **Runs once.** A second run applies nothing.
- **Production-like role** (first version of the migration). Run as a non-superuser migration role while another role owns `chapter_versions`, `video_compositions` and one of its indexes, it:
  - creates the missing tables;
  - leaves the app-owned ones untouched;
  - skips the missing index with its notice;
  - succeeds.
- **Whole history under the pin.** All 397 migrations run from scratch under #3710's pinned path.
- **The production sequence** (§5): rehearsed end to end with #3710's trust check.

## 3. Regression tests

- **`tests/unit/guards/noRuntimeDdl.test.js` (static):**
  - no file under `src/` (except migrations and seeders) holds DDL, apart from the five listed exceptions, each capped at its current count;
  - the nine sites are gone;
  - each table has a migration;
  - the guard recognises each form it looks for.

  Against `main` it fails on two of its four tests.
- **`tests/integration/noRuntimeDdl.integration.test.js` (behaviour).** The app runs as a throwaway role with the application's data privileges and **no CREATE**: the state after the revoke. Every SQL statement on every connection is captured at the pg driver.
  - **Startup:** the app loads, and the World Studio cleanup that runs 10 s after startup runs.
  - **Requests:**
    - `GET /continuity/timelines`;
    - GET and POST `/story-health/versions/chapter/:id` (the version is really saved);
    - `GET /world/previews`, `GET /world/preview/:id`, `DELETE /world/previews/:id`;
    - `GET /episodes/:id/video-compositions`;
    - `GET /scene-sets/jobs/set/:id`, `GET /scene-sets/jobs/:id`;
    - the removed admin route answers 404.
  - **Background job:** the scene generation worker starts, reads `generation_jobs` and logs no error.
  - **Results:** each sends no DDL, and no response is a 5xx or mentions "permission denied". 13 of 13 pass. **Against `main`, 8 fail:** startup, both story-health routes, the previews list, video compositions, the admin route, and the saved version.

## 4. Read-only production check (Evoni)

**What it is:** `docs/reads/2026-11-04-runtime-ddl-check.sql`. It reads only catalog data (`pg_class`, `pg_attribute`, `pg_stat_user_tables`, `pg_depend` and so on), never table contents, so it runs as `prime_readonly`. It was validated locally as a role with nothing but CONNECT and USAGE.

| Section | Shows |
|---|---|
| D1 | each affected table: present, owner, estimated rows, size |
| D2 | **every relation in `public` not owned by `postgres`**: the one app-owned table, its indexes and sequences |
| D3, D4 | columns, indexes and constraints of the runtime-created tables, to compare with the migration |
| D5, D6, D7 | what depends on the app-owned table, foreign keys to or from it, and other app-owned objects |
| D8 | who can CREATE in `public` and in the database; the default privileges |
| D9 | whether the legacy `shows` constraints and the scenes index exist (the two exceptions above) |
| D10 | role memberships around `episode_app_dev` (needed for the ownership transfer) |

**To run it on the box:**
1. Copy the file there (scp, as before).
2. Use the read-only connection lines from `~/.episode-readonly.env`.
3. Run `psql -X -f ~/2026-11-04-runtime-ddl-check.sql > ~/runtime-ddl-check.txt 2>&1`.
4. Send `runtime-ddl-check.txt`.

### 4a. Results (Evoni ran it, 2026-11-04; all ten sections)

| Finding | Result |
|---|---|
| D1 | `generation_jobs` (141 rows), `franchise_knowledge` (605 rows), the four continuity tables, `ecosystem_previews` and `video_compositions` (all empty) **exist, owned by `postgres`**. **`chapter_versions` does not exist**, so the version history routes have never run in production (they would have created it). |
| D2, D7 | **The one app-owned table is `brain_documents`**: 0 rows, 16 kB, with its sequence `brain_documents_id_seq`, its primary key index and its row type. ACL: `episode_app_dev` everything, `prime_readonly` SELECT. |
| D3, D4 | Production's continuity tables differ from what `Model.sync()` creates: `varchar(20)` plus a CHECK instead of an enum, database defaults, extra indexes, and no `updated_at`/`deleted_at` on `continuity_beat_characters`. **The migration was rewritten to production's definitions.** On a fresh database built from all migrations, the D3/D4 output for these tables is **identical to production's, line for line** (84 lines). `ecosystem_previews` and `video_compositions` already matched. |
| D5, D6 | Nothing depends on `brain_documents` except its own default values and sequence. No foreign key points at it or from it. |
| D8 | `episode_app_dev` has CREATE on `public`, granted explicitly; it cannot create schemas. PUBLIC has only USAGE. Default privileges for tables `postgres` creates: `episode_app_dev` gets `arwd`, `prime_readonly` gets `r`; on sequences `episode_app_dev` gets `rU`. |
| D9 | The legacy `shows_name_key` and `shows_slug_key` constraints are **gone**, so the `server.js` repair block only runs its SELECT and does nothing. **`idx_scenes_episode_scene_number` exists, owned by `postgres`.** As `episode_app_dev`, the scene-delete renumbering cannot drop it, so every scene delete's renumbering fails and rolls back after the soft delete. This is an existing production bug, for a separate fix. |
| D10 | `episode_app_dev` has no role memberships in either direction. **`postgres` has no ADMIN on it.** |

## 5. Making `brain_documents` owned by `postgres`

**Why not `ALTER TABLE ... OWNER TO postgres`.** That needs the role running it to act as the current owner. `postgres` has no membership in `episode_app_dev` (D10), and on Postgres 16 and later a CREATEROLE role can grant itself that membership only with ADMIN on the role, which it does not have. `episode_app_dev` cannot hand its table to `postgres` either.

**Instead (the table is empty): drop and recreate.**
1. **`episode_app_dev` drops its own empty table.** It is the owner, so it may. A guard refuses unless the table is empty and owned by the login running it. This drops 0 rows, and its sequence, index and row type go with it.
2. **This PR's migration recreates it, as `postgres`.** It uses `20261008100000`'s definition and runs in the Deploy migrate phase.
3. **Production's default privileges then give access automatically:** `episode_app_dev` gets `arwd` on the table and `rU` on its sequence, and `prime_readonly` gets `r`. That is the access it has today, minus ownership.

**Rehearsed locally**, with a non-superuser migration role, production's grants and default privileges, and the app-owned table:
- **Before:** #3710's trust check fails with 6 findings (CREATE, TRIGGER, the table, its sequence, index and row type).
- **Steps:** the app drops the table (guarded), the migration role revokes CREATE, and the trust check prints `OK`.
- **The migration:** it recreates `brain_documents` and `chapter_versions` owned by the migration role, with the ACLs above.
- **Afterwards:** the app inserts into and reads both tables, and `prime_readonly` reads. The app's `CREATE TABLE` is refused ("permission denied for schema public").

**The commands** (a separate approval). Run on the box with the **app** user from `.env`; nothing is printed:

```sql
BEGIN;
DO $g$ BEGIN
  IF (SELECT count(*) FROM public.brain_documents) <> 0 THEN RAISE EXCEPTION 'STOPPED: brain_documents is not empty; nothing changed'; END IF;
  IF (SELECT pg_get_userbyid(relowner) FROM pg_class WHERE oid = 'public.brain_documents'::regclass) <> session_user THEN RAISE EXCEPTION 'STOPPED: not run as the owner; nothing changed'; END IF;
END $g$;
DROP TABLE public.brain_documents;
COMMIT;
```

Then, with the migration user from `~/.episode-migrate.env`:

```sql
REVOKE CREATE ON SCHEMA public FROM episode_app_dev;
```

**What is lost:** nothing; the table holds no rows (the guard enforces it).

**Undo:**
- Before the Deploy: the app user re-creates the table with `20261008100000`'s definition.
- The revoke: `GRANT CREATE ON SCHEMA public TO episode_app_dev`.

## 6. Order (each step separately approved)

**The constraint.** #3710's trust check refuses to migrate until `episode_app_dev` can no longer create in `public` and owns nothing there. So the drop and the revoke come **before** the Deploy that ships this code, and the **old** code runs without CREATE until that Deploy restarts the API.

**What the old code does in that window,** with production's state (§4a):

| Path | In the window |
|---|---|
| 1, 2 generation jobs | sync fails, caught and logged; the jobs work (the table exists) |
| 3 continuity | the tables exist, so no create runs; works |
| 4 franchise brain seed | the count works, so no create runs; works |
| 5, 6 chapter version history | **500**; never used in production (the table has never existed) |
| 7 World Studio previews | the create error is swallowed; works |
| 8 admin test route | 500; no caller |
| 9 video compositions list | 500; no frontend caller |
| brain documents | an ingest's document row is not saved (logged); the Documents tab errors; it holds no documents |

**User-visible effect:** effectively none, for minutes.

**Recommended sequence:**
1. Merge this PR, then #3709.
2. **Right before starting the Deploy run** (approval): the guarded `brain_documents` drop as the app user, then the revoke as the migration user (§5).
3. **The Deploy run** of the commit with both PRs (approval). The trust check must print `OK`. Then: the snapshot, this PR's migration and #3709's, and the restart onto the new code.
4. After the restart, re-run the read-only check (§4). Expect: D1 all present, D2 empty, D8 `create_in_public` `f` for `episode_app_dev`.
5. The A/B preflight, then your confirmation, then A and B.

**If the trust check refuses at step 3:**
- nothing is migrated or changed, and the old code keeps running;
- the window simply lasts until the cause is fixed. Undo with the §5 grant if needed.

**Separate fixes found by this work** (not in this PR):
- the scene-delete renumbering (D9);
- the `ContinuityBeatCharacter` model is soft-delete, but its table has no `deleted_at`, in production as in the migration. This is recorded in the step-2 schema baseline as `paranoid-no-deleted_at`; before, it was recorded as `canon-missing-column`.
