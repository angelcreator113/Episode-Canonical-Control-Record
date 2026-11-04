# Runtime DDL: inventory and removal (2026-11-04)

**Status:** PR prepared at Evoni's approval (2026-11-04). **Not approved to merge or deploy.** No production privilege, ownership, data or schema change is made here. The read-only production check in §4 is run by Evoni.

**Why:** the Deploy workflow's migration trust check (#3710, merged) refuses to migrate while the application role `episode_app_dev` can create objects in `public`. That privilege can only be revoked once the application stops creating tables at runtime. With CREATE revoked, `CREATE TABLE IF NOT EXISTS` fails with "permission denied for schema public" even when the table exists (measured).

## 1. The nine table-creation paths

| # | File, function | When it runs | Table | Migration before this PR | Permanent? | If the creation call is removed | Normal behaviour affected? |
|---|---|---|---|---|---|---|---|
| 1 | `src/routes/sceneSetRoutes.js` `ensureGenerationJobsTable` | Request: five routes (angle still regenerate check `refuseWhileVideoRuns`, `POST /:id/angles/:angleId/generate-video`, `POST /:id/cascade-regenerate`, `GET /jobs/set/:setId`, `GET /jobs/:jobId`); first call per process | `generation_jobs` | yes, `20260323000000` (and two later ones) | yes (the job queue) | Nothing changes where the table exists. If it were missing, the reads fail as they do today after the sync fails: `GET /jobs/set` returns `[]`, the others 500. | No |
| 2 | `src/workers/sceneGenerationWorker.js` `start` | Background: the `episode-worker` pm2 process starts it (`src/workers/start.js`); the dev server embeds it outside production | `generation_jobs` | yes | yes | Nothing changes. The sync failure was already caught and only logged; without CREATE it would have logged an error on every worker start. | No |
| 3 | `src/routes/continuityEngine.js` `ensureTables` | Request: the first `GET /api/v1/continuity/timelines` per process, and only when `continuity_timelines` is missing | `continuity_timelines`, `continuity_characters`, `continuity_beats`, `continuity_beat_characters`, type `enum_continuity_timelines_status` | **no** (new: `20261104200000`) | yes (user content) | Tables come from the migration. Before it runs, a missing table makes the continuity routes 500. Before this PR, any other continuity route used first also failed. | No, once the migration has run |
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
- **Definitions:** the exact runtime definitions. For the continuity tables, they were captured from what `Model.sync()` sends; for the other three, from the raw SQL.
- **Create only what is missing:**
  - every table is `CREATE TABLE IF NOT EXISTS`, and the enum is created only if missing;
  - each index is created only when missing **and** the migration role may index that table. On a table another role owns (production: the app-created table, §4), the index is skipped with a notice, because `CREATE INDEX` there is refused for a non-superuser even with `IF NOT EXISTS`.
- **Name resolution:** schema-qualified names, and a `pg_catalog`-only search path inside the transaction.
- **`down`:** does nothing. The tables may predate the migration and hold data.
- **Convention exception:** `chapter_versions`, `ecosystem_previews` and `video_compositions` have **no `deleted_at`**, because production's tables have none. Adding it is a separate change after the ownership transfer.

**Tests:**
- **`scriptWriteGuard`:** registers the migration.
- **CP10 admin test:** now asserts the route is gone.
- **Step-2 schema baseline:** loses its four continuity entries, which no longer occur.

**Verified locally (Postgres 16):**
- **Same schema as the old runtime DDL.** On a fresh database, `pg_dump -s` of the seven tables created by the migration is identical to that created by the old runtime DDL (sync plus raw SQL).
- **Runs once.** A second run applies nothing.
- **Production-like role.** Run as a non-superuser migration role while another role owns `chapter_versions`, `video_compositions` and one of its indexes, it:
  - creates the missing tables;
  - leaves the app-owned ones untouched;
  - skips the missing index with its notice;
  - succeeds.
- **Whole history under the pin.** All 397 migrations run from scratch under #3710's pinned path.

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

## 5. Transferring the app-owned table to `postgres`: impact (for the separate approval)

Written generally here; the exact commands follow once D2, D5 and D10 name the table, its dependents and the memberships.

**What changes:**
- **Owner:** the table, and with it its indexes and any sequence it owns, gets owner `postgres`. No data is rewritten; it is a catalog change.
- **The app's privileges:** the app keeps only what is **granted explicitly**.
  - An owner's implicit privileges go, and default privileges don't apply to an existing table, so the transfer must `GRANT SELECT, INSERT, UPDATE, DELETE` on it (and USAGE, SELECT on an owned sequence) to `episode_app_dev` **in the same transaction**. Otherwise the feature that writes it breaks.
  - The app also loses DDL on it (ALTER, DROP, CREATE INDEX, TRUNCATE). That is the point, and nothing in the code needs it once this PR is in.

**Lock:** a moment of ACCESS EXCLUSIVE on that one table, so queries on it wait for the commit (milliseconds).

**Who can run it:** the role running it must be able to act as the current owner and as the new one.
- `postgres` is not a member of `episode_app_dev` with SET (D10 confirms).
- It can grant itself temporary membership, because it created the role and so holds ADMIN on it. Then it transfers ownership and takes the membership back.

**Draft** (not to be run; for review once D2 and D10 are known):

```sql
BEGIN;
GRANT episode_app_dev TO postgres;                 -- temporary: lets postgres act as the current owner
ALTER TABLE public.<table> OWNER TO postgres;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.<table> TO episode_app_dev;
GRANT SELECT ON public.<table> TO prime_readonly;
REVOKE episode_app_dev FROM postgres;
COMMIT;
```

**Undo:** the same with the owners swapped. Data is never touched either way.

**Then the privilege change itself** (a separate approval): `REVOKE CREATE ON SCHEMA public FROM episode_app_dev`, plus `FROM PUBLIC` if D8 shows PUBLIC holds it. Undo: `GRANT CREATE ON SCHEMA public TO episode_app_dev`.

## 6. Order (each step separately approved)

**The constraint.** #3710's trust check refuses to run a migration while `episode_app_dev` can create in `public`. This PR brings a migration. So the Deploy that ships this code can only migrate **after** the revoke. Between the revoke and that Deploy's restart, the **old** code still runs in production without CREATE.

**What fails in that window** (from §1):
- **Version history:** saving and listing chapter versions (routes 5 and 6) return 500.
- **Video compositions:** the list (route 9) returns 500; nothing in the frontend calls it.
- **Admin test route:** returns 500; nothing calls it.
- **Nothing else:**
  - World Studio's create errors were already swallowed, so its routes keep working;
  - the generation-jobs syncs were already non-fatal;
  - continuity and franchise create only when a table is missing, which D1 checks.

**How long:** from the revoke to the end of one Deploy run (snapshot, migrate, deploy, restart): minutes.

**Recommended sequence:**
1. Run the §4 read-only check. Confirm D1 (the tables exist), the app-owned table (D2), its dependents (D5) and the memberships (D10).
2. Merge this PR, then #3709.
3. The ownership transfer (§5), as its own approval. It changes no behaviour while the app keeps CREATE.
4. **Right before starting the Deploy run:** revoke CREATE on `public` from `episode_app_dev` (approval). Then start the Deploy of the commit containing both PRs.
   - The trust check must print `OK`, then: snapshot, both migrations, restart.
   - The window above lasts until the restart.
5. Run the A/B preflight, confirm the procedure, then run A and B.

**Zero-window alternative, if D1 shows every table already exists in production:**
1. Split this PR's migration into a follow-up PR.
2. Deploy the code alone. With no migration pending, the trust check is not reached.
3. Then do the ownership transfer and the revoke; nothing breaks, because the new code needs no CREATE.
4. Then merge the migration PR and #3709 and run one Deploy.

**Cost of the alternative:** two Deploy runs instead of one. The behavioural test must also move with the migration, since CI builds its database from migrations.
