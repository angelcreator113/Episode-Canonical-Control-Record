# Migration drift read

Task: #1824. A read, not a change. Basis: `origin/main` at `cc912938` (2026-09-24).

Standing labels:
- **MEASURED**: read from this repository at the basis, including the canon captures already filed under `docs/audit/`.
- **INFERRED**: reasoned from measured facts; needs a database read to confirm.
- **ATTESTED**: Evoni's own reads of the production database, as stated in the issue or in a deploy record.

Nothing here is RULED.

Production evidence used:
- `docs/audit/EvidenceNote_Canon_SequelizeMeta_2026-09-17.txt`: 219 rows, last `20260807000000-add-source-profile-to-world-event.js`.
- `docs/audit/EvidenceNote_Canon_Schema_Capture_2026-09-17.txt`: column-level. There is also an earlier capture, `…_2026-08-29.txt`.
- `docs/audit/F-Deploy-1_Deploy_2026-09-22.md` §3: `world_events.category` and `format` were added by hand.
- The issue's attestation for 2026-09-24.

## Summary

1. **Correction to the premise: there was no seven-week outage that began on 7 August.** File names are not run dates. `20260807000000` was committed on 2026-04-29, and SequelizeMeta already had 219 rows on 2026-07-12. Nothing was pending until `20260818000000` was added on 2026-08-18. The real break is **2026-07-12**: the app's database user was switched from `postgres` to `episode_app_dev`, which owns no tables. Since then, any `db:migrate` that alters an existing table fails with "must be owner". No migration has run through the CLI since, and none was pending until 08-18.
2. **The queue stops at its first file.** `20260818000000` alters `decision_logs`, a table production never had. SequelizeMeta says its create migration ran, because `scripts/bootstrap-sequelize-meta.js` recorded that name without running it. Behind it, `20260902000000` would fail too, because `asset_roles` already exists.
3. **Question 6 answer: live code depends on a column production lacks.** `assets.role_key` is declared in the Asset model, which has been deployed since at least 2026-09-23. Production does not have the column. Every Asset read or create that doesn't list its columns names `role_key` and fails. Several callers catch the error and carry on, so the failure is partly silent. Separately, the older `character_state.deleted_at` gap breaks every CharacterState model read, and three callers swallow that error.

---

## 1. The pending queue, in run order

sequelize-cli runs every file in `src/migrations/` that has no SequelizeMeta row, sorted by name.

MEASURED: the tree has 215 files; 210 sort at or before `20260807000000`.

MEASURED: diffing the tree against the 09-17 capture gives:
- **In the tree, not recorded:** exactly the five files below.
- **Recorded, not in the tree:** nine rows whose files were later renamed or deleted:
  - `20260208000000-create-lala-formula`
  - `20260306100000-create-episode-orchestration-tables`
  - `20260307140000-create-franchise-knowledge`
  - `20260311200000-create-story-calendar-system`
  - `20260315000000-add-relationship-engine-columns`
  - `20260315100000-add-expanded-world-character-columns`
  - `20260320000000-create-scene-sets-and-angles`
  - `20260627000000-add-base-still-url`
  - `20260710000000-create-generation-jobs`

  So 210 + 9 = 219. The hand-inserted `20260924000000` makes 220, which matches the attested count.

MEASURED: no file was backdated. The only files added to the tree after 2026-08-07 are the five below, and each has a name later than `20260807000000`.

| # | File (added) | What it does | Guarded? | Against production as attested |
|---|---|---|---|---|
| 1 | `20260818000000-add-deleted-at-to-decision-logs.js` (956697c01, 08-18) | `addColumn('decision_logs','deleted_at')` | No | **Fails**: `relation "decision_logs" does not exist`. The run stops here. |
| 2 | `20260902000000-create-asset-roles.js` (65cbe7013, 09-02) | `createTable('asset_roles')` including `deleted_at`, then three indexes, one of them unique and partial on `deleted_at IS NULL` | No | **Fails**: `asset_roles` already exists (12 columns, no `deleted_at`, MEASURED 09-17). Even skipping `createTable`, the partial index would fail on the missing `deleted_at`. |
| 3 | `20260902000001-add-role-key-to-assets.js` (2e5dbdf28, 09-02) | `describeTable('assets')`; if `role_key` is absent, `addColumn` plus `idx_assets_role_key` | Yes | **Runs**: adds the missing column. Needs owner rights on `assets` (postgres-owned), so it runs only as postgres. |
| 4 | `20260922000000-add-category-format-to-world-events.js` (c37fbaca3, 09-21) | `describeTable('world_events')`; adds `category` and `format` if absent | Yes | **No-op**: both columns were added by hand on 09-22 (varchar(50), nullable; deploy record §3). Running it would only write its SequelizeMeta row. |
| 5 | `20260924000000-add-event-terms.js` (d1c3c0d8b, 09-24) | `restrictions` JSONB on `world_events`; `event_deliverables` table | Yes (`describeTable`, `showAllTables`) | **Recorded by hand, 09-24** (ATTESTED). MEASURED: no register document records this hand run; `grep` for `20260924000000` / `event_deliverables` under `docs/audit/` finds nothing. |

## 2. `decision_logs`

- MEASURED: `src/migrations/20260208110001-create-decision-logs-table.js` was added on 2026-02-08 (7ae309f21). It has always lived in `src/migrations` and has never been renamed. Its `up()` is an unguarded `createTable('decision_logs')`. No migration in any tree drops the table.
- MEASURED: it is recorded in the 09-17 SequelizeMeta capture, but the table is absent from both schema captures.
- MEASURED mechanism: `scripts/bootstrap-sequelize-meta.js` lists `20260208110001-create-decision-logs-table.js` among its `KNOWN_MIGRATIONS`. When SequelizeMeta is empty and the `episodes` table exists, it **inserts every listed name without running the file**. Its header says the database was "originally set up via sequelize.sync()". It was added 2026-02-17 (8bef4b7c3), and `deploy-dev.yml` calls it before every `db:migrate`.
- INFERRED: that is how production came to record `decision_logs` as created without the table ever existing. The cause is **never created**, not a dead tree and not a drop.
- MEASURED: production has `decision_log` (singular, 11 columns), created by `20260219000001-decision-log-browse-pool.js`. `src/utils/decisionLogger.js` writes to that table, with columns that match. `src/models/DecisionLog.js` and `src/routes/decisionLogs.js` (`/api/v1/decision-logs`) use the plural name and so return 500 on every call.
- MEASURED: the v1.51 ruling keeps the two tables distinct (`PROJECT_CONTEXT.md`, the `decision_logs` / `decision_log` note).

## 3. Present but unrecorded: `asset_roles` and `world_events.category`

**`world_events.category` and `format`.** MEASURED from the attested record `F-Deploy-1_Deploy_2026-09-22.md` §3: Evoni ran the following as `postgres`:

```sql
ALTER TABLE world_events ADD COLUMN IF NOT EXISTS category VARCHAR(50), ADD COLUMN IF NOT EXISTS format VARCHAR(50);
```

The record says `20260922000000` "was **not** run by the migration tool … the migration-tracking table was not touched". Both columns exist, `format` included.

**`asset_roles`.** MEASURED: it already existed at the 2026-08-29 capture, before `20260902000000` was written. Its production shape matches the model: 12 columns, `timestamp without time zone`, no `deleted_at`. There are three candidate creators in the repository:
- the dead tree `scripts/migrations/add-asset-roles-table.sql`: `CREATE TABLE IF NOT EXISTS asset_roles`, plus `ALTER TABLE assets ADD COLUMN IF NOT EXISTS role_key`; added 2026-02-14 (9fd1a6ceb) and run by `scripts/migrations/run-roles-migration.js`;
- the dead tree `migrations/20260629000000-create-missing-tables-batch1.js`: `createTable('asset_roles')`, added 2026-03-22;
- `sequelize.sync()`, since `AssetRole` declares `tableName: 'asset_roles'`.

INFERRED: production has no `assets.role_key`, so the SQL script probably did not run there in full. The repository can't settle which of the three created the table.

**The dead trees** (MEASURED, as listed in `PROJECT_CONTEXT.md`): `migrations/`, `migrations/sequelize-migrations/`, `migrations-node-pg-migrate/`, `scripts/migrations/`. Only the two files above match `asset_roles` or `role_key`. None creates `decision_logs`. None adds `world_events.category`: `migrations/20260306100000-create-hair-makeup-libraries.js` adds a different column, `event_category`.

**Schema writes outside migrations** (MEASURED):
- `src/app.js`: `sequelize.sync()` at startup, gated on `ENABLE_DB_SYNC=true`.
- `src/server.js`: boot-time DDL, on `shows` only.
- Per-request `Model.sync()` calls:
  - `continuityEngine.js`: the Continuity* models
  - `franchiseBrainRoutes.js`: FranchiseKnowledge
  - `memories/engine.js`: StoryTaskArc
  - `sceneSetRoutes.js` and `workers/sceneGenerationWorker.js`: GenerationJob
- Inline `CREATE TABLE IF NOT EXISTS`, for these tables:
  - `video_compositions`
  - `chapter_versions`
  - `ecosystem_previews`
- `scripts/reset-database.js`: `db.sync()`.

None of these touch `asset_roles`, `assets.role_key` or `world_events.category`/`format`. The per-request `sync()` calls are another way objects can come to exist with no SequelizeMeta row.

## 4. The gap, and which credentials `db:migrate` uses

- MEASURED: **no separate migration identity exists.** A repo-wide `grep` for `DB_MIGRAT`, `MIGRATION_DATABASE_URL`, `DB_ADMIN`, `MIGRATE_USER`, `DB_OWNER` and `MASTER_USER` finds nothing. `.sequelizerc` points to `src/config/sequelize.js`, which has three blocks:
  - `development`: prefers `DATABASE_URL`, otherwise `DB_*`.
  - `production`: `DB_*` only.
  - `test`: uses `TEST_DATABASE_URL` or `DATABASE_URL`, otherwise `DB_*`.
- MEASURED (`deploy-dev.yml`): runs `db:migrate --env development`. The credentials come from the secret `episode-metadata/dev/database` via `scripts/print-db-env.js`. The register records that secret's username as `episode_app_dev` (`F-Deploy-1_Fix_Plan_v1.34.md`).
  - INFERRED: `require('dotenv').config()` means a `DATABASE_URL` in the box's `.env` would take precedence.
- MEASURED: `package.json`'s `migrate` and `migrate:up` force `NODE_ENV=development`, so they follow the same path.
- MEASURED (register): v1.34 records:
  - the production `.env` `DB_USER` was flipped from `postgres` to `episode_app_dev` on 2026-07-11/12;
  - "143/143 public tables postgres-owned";
  - migration ownership was "deferred off the critical path … ownership transfer on RDS is NOT trivially non-breaking".
- MEASURED: migrations `20260801`–`20260807` all ALTER existing tables (`phone_missions`, `phone_playthrough_state`, `wardrobe`, `world_events`, `episode_briefs`). They are recorded, and all were committed in April.
  - INFERRED: they ran as `postgres`, before the flip.
- MEASURED: nothing touching database identity changed between 08-07 and 08-18. The identity-related commits are all in July:
  - `9557df38e` (07-10): SSM deploy
  - `84159a8e2` (07-12): `print-db-env.js`
  - `c25a9db68` (07-14): `DB_SSL`
  - `1844e56b4` (07-21): ecosystem split
- MEASURED: two dev dispatches, on 07-14 and 07-21, both logged `SequelizeMeta entries: 219` and "No migrations were executed" (`F-Deploy-1_Fix_Plan_v1.43.md` §4; `F-Stats-1_Fix_Plan_v1.6.md`).

**Answer (INFERRED from the above):** migrations ran as `postgres` until 2026-07-12. Since then the only configured identity has been `episode_app_dev`, which owns no table. The ledger then sat unchanged, with nothing pending, until 08-18, and every pending file since has been blocked. Whether a later run failed on `decision_logs` first or on ownership first depends on which files it reached.

The attested error, "must be owner of table world_events", names a table that only files 4 and 5 touch. So that run either began after files 1 and 2 had been dealt with, or used another ledger or file set. It appears in no register record (MEASURED: "must be owner" occurs nowhere under `docs/`). See Q4 below.

## 5. What the deploy workflows do on a failed migration

- **`deploy-dev.yml`** (MEASURED): the on-box script runs `set -eo pipefail`, installs `trap restore_pm2 EXIT`, runs `bootstrap-sequelize-meta.js`, then:

  ```
  if ! npx sequelize-cli db:migrate --env development 2>&1 | tail -20; then … MIGRATION_FAILED=true
  ```

  The failure is detected, since `pipefail` stops `tail` from masking it. But the script then carries on:
  1. it restarts PM2 (`pm2 startOrRestart ecosystem.dev.config.js`);
  2. it runs the health checks;
  3. only at the end does it print "❌ Deployment completed but migrations failed" and `exit 1`.

  The run goes red **after** the new code is already live against the old schema. That matches Evoni's report that the workflow restarts anyway.
- **`deploy-production.yml`** (MEASURED): dispatch only; `disabled_manually`; last success 2026-05-11. Its runner step (`db:migrate --env production` with `PRODUCTION_DATABASE_URL`) is fatal on failure. Its on-box script `.github/scripts/deploy-production.sh` runs:

  ```
  npm run migrate:up || echo "⚠️  Migrations completed with warnings"
  ```

  That line **masks** a failure, and a PM2 restart follows.
- **`validate.yml`** runs migrations only against CI's own Postgres.

**What deploys since 08-07 reported** (MEASURED):
- `Deploy to Development` was disabled on 2026-09-17 (`F-Deploy-1_Fix_Plan_v1.50.md` §5). No deploy-dev run after 07-21 is recorded.
- The production deploys recorded from 09-20 to 09-24 (`F-Deploy-1_Deploy_2026-09-2*.md`) were manual: a fast-forward merge plus a PM2 restart. The 09-20 record says "No workflow was dispatched". A manual merge and restart runs no migration.
- Their records say:
  - 09-20/21: the diff "showed no package or migration changes";
  - 09-22: "no package, migration, or model changes", with the `category`/`format` change made by direct SQL (§3);
  - Evening 09-22: "No package, migration, or model" change;
  - 09-23: "No package or migration change appeared";
  - 09-24: "No package or migration change appeared".
- INFERRED: **no deploy since August could have reported a failed migration, because none ran one.** The records' "no migration change" refers to each deploy's own diff, **not** to the pending queue that deploy went live with. `2e5dbdf28`, which adds a model attribute and its migration, was deployed without its migration.

## 6. Code merged since 7 August that assumes a schema change

Method (MEASURED):
- **Base:** `30fba75dfc` (`git rev-list -1 --before=2026-08-07 origin/main`).
- **What was checked:** every model changed since the base, plus new raw SQL.
- **How:** checked against the 09-17 capture, then adjusted for the 09-22 hand ALTER and the 09-24 hand run.
- **SQL:** generated offline by loading each model with the app's `define` (`underscored`, `timestamps`, `paranoid: true`, `freezeTableName`) on a stubbed connection, with no database.

Sequelize 6's `Model.create` returns every declared attribute (`RETURNING`). So one declared-but-missing column breaks **every create** on that model, not only reads.

| Object | Code that assumes it | Created by | Production | What happens now |
|---|---|---|---|---|
| **`assets.role_key`** | `src/models/Asset.js` (`role_key` attribute, 2e5dbdf28, merged 09-02); `AssetRoleService` (`assignRoleToAsset`, `bulkAssignRoles`, `getRoleUsageStats`, `getAssetsByRole`) | pending #3 | **Missing**: MEASURED absent 09-17; ATTESTED 09-24 | **Broken now.** MEASURED generated SQL: `Asset.findAll` → `SELECT "id","asset_type","asset_role","role_key",…`. Every Asset read without an explicit `attributes` list, and every `Asset.create`/`update`, fails with `column "role_key" does not exist`. Deployed: the 09-23 and 09-24 deploy records name SHAs that contain 2e5dbdf28 (MEASURED ancestry). |
| **`character_state.deleted_at`** (inherited `paranoid: true`) | `src/models/CharacterState.js` sets no `paranoid: false`; readers in `careerGoals.js`, `episodes.js`, `evaluation.js`, `wardrobe.js` | none | **Missing** (MEASURED 09-17) | MEASURED generated SQL: `SELECT "coins" FROM "character_state" … WHERE ("CharacterState"."deleted_at" IS NULL …)`, even with `attributes` and `raw`. Every model read fails. This is older than August (the FD-66 class); only a comment changed after the base. |
| `decision_logs` (table) | `DecisionLog.js`, `routes/decisionLogs.js` | `20260208110001` (recorded, never run) + pending #1 | **Missing** (MEASURED) | `/api/v1/decision-logs` returns 500 on every call. Loud. |
| `world_events.category`, `format` | `WorldEvent.js` (c37fbaca3) | pending #4 | Exist (hand ALTER, 09-22) | OK. |
| `world_events.restrictions`, `event_deliverables` | `WorldEvent.js`, `EventDeliverable.js`, `eventTermsService.js` (d1c3c0d8b, 207f5f00e) | #5 | Exist (ATTESTED 09-24; unrecorded in the register) | OK. |
| `asset_roles` (table) | `AssetRole.js` (`timestamps: false`, so no `deleted_at` predicate) | pending #2 | Exists (MEASURED) | OK. |
| Other world_events columns (`opportunity_id`, venue fields, `event_date`/`event_time`, `source_profile_id`, `source_calendar_event_id`); `wardrobe.tags` type | `WorldEvent.js` (a433477a7, d1c3c0d8b); `Wardrobe.js` (1a42f788d) | pre-base migrations | Exist (MEASURED) | OK. |
| New raw SQL: `scene_plans`, `scene_sets.scene_type`, `career_goals.unlocks_on_complete`, `opportunities.status_history`/`show_id`, `character_state` columns | `episodeGeneratorService`, `episodeCompletionService`, `characterSyncService`, `eventEpisodeLink`, `FilterService` | pre-base | Exist (MEASURED) | OK. |

**Where the failures are silent.** All of these are MEASURED code; that each path actually fails in production is INFERRED from the missing column.

`assets.role_key`:
- `routes/worldEvents.js`, the invitation text-edit path: the edited-invitation `Asset.create` sits in `catch { /* non-blocking */ }`, which logs nothing. The edited invitation asset is lost and the route still reports success.
- `objectGenerationService.js`: `console.error`, then `return null`.
- `socialChecklistService.js`: `console.warn('… (non-blocking)')`.
- `episodeGeneratorService.js`: `.catch(() => [])`, but a raw-SQL fallback recovers.
- `invitationGeneratorService.js`: `.catch` → retry → a raw `INSERT` that drops `asset_role` and `approval_status`.
- Loud (500) elsewhere: the asset library, uploads, and `routes/roles.js`.

`character_state`:
- `episodes.js`: `catch (e) { /* no state yet */ }`.
- `careerGoals.js`: `catch (e) { /* no state */ }` and a `console.warn`.
- `evaluation.js`: `.catch(() => [])`, after which the following `create` fails on `RETURNING … deleted_at`.
- These read as "no state yet", so goal values, episode stats and evaluation fall back to defaults without an error on screen.
- Wardrobe select and purchase fail loudly.

A latent mask, harmless today: `PUT` in `worldEvents.js` catches a failed update, retries with "core fields only", logs `console.warn`, and returns `success: true` while dropping `category`, `format`, `restrictions`, `requirements` and others. The same shape would hide any future missing column.

**Register conflict, recorded only** (the register is not edited here): `F-Stats-1_Fix_Plan_v1.17.md` (line 64) states "`CharacterState` is not paranoid". The generated SQL above shows it is.

**Outside the post-August focus:** the same check across all models finds about 45 more models declaring columns or tables absent from the 09-17 capture. For example, `EpisodeScript` lacks 11 columns, and `CharacterArc`, `SceneTemplate`, `OutfitSetItems`, `UniverseCharacter` and `WardrobeUsageHistory` are paranoid without `deleted_at`. None changed after the base; this is the known FD-66 class.

## 7. Open questions for Evoni

Already answered: migrations run as `postgres`, by hand.

**Q1. `20260818000000` (decision_logs.deleted_at).** Options:
- (a) create `decision_logs` first, then run the file;
- (b) mark it run without running it, and retire the `DecisionLog` model and route, since `decision_log` is the live table;
- (c) replace it with a new guarded migration that no-ops when `decision_logs` is absent.

Also: should SequelizeMeta keep its unrun `20260208110001` row?

**Q2. `20260902000000` (asset_roles).** Options:
- (a) mark it run without running it, since the table exists; the partial unique index and `deleted_at` are then absent (the model doesn't use them);
- (b) replace it with a new guarded migration that adds `deleted_at` and the indexes if missing;
- (c) run it as is: it fails.

**Q3. `20260902000001` (assets.role_key): the one with live impact.** Options:
- (a) run it as `postgres` now: it's guarded and additive, and ends the Asset failures;
- (b) remove `role_key` from the Asset model instead, and leave the migration pending;
- (c) both, in sequence.

**Q4. `20260922000000` (category/format).** Options:
- (a) run it: it no-ops and records itself;
- (b) insert its SequelizeMeta row by hand.

Also: where did the "must be owner of table world_events" run happen, and with which ledger? It isn't in the register.

**Q5. `20260924000000`.** Should the 09-24 hand run get a deploy-record entry? The register has none.

**Q6. `character_state.deleted_at`.** Options:
- (a) add the column by a new migration;
- (b) set `paranoid: false` on `CharacterState`.

This also affects the F-Stats-1 v1.17 statement.

**Q7. Deploy workflows on a failed migration.** Options:
- (a) stop before restarting PM2 when `db:migrate` fails;
- (b) keep restarting, but fail loudly and name the pending files;
- (c) leave as is, since both workflows are disabled and deploys are manual.

Related: should a manual deploy record list the pending queue at its SHA, not just its own diff?

**Q8. Default privileges.** Options:
- (a) as `postgres`: `ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO episode_app_dev;` plus the same for sequences, so tables created by hand-run migrations are usable without a manual `GRANT`;
- (b) keep granting per migration.

**Q9. The nine SequelizeMeta rows with no file.** Options:
- (a) leave them;
- (b) delete them;
- (c) map each to its renamed file.

### Read-only SQL to confirm each finding

```sql
-- Ledger: count, newest, and rows with no file in src/migrations (compare to the list in §1)
SELECT count(*) FROM "SequelizeMeta";
SELECT name FROM "SequelizeMeta" ORDER BY name DESC LIMIT 8;

-- §2: which decision_log tables exist
SELECT table_name FROM information_schema.tables
 WHERE table_schema='public' AND table_name IN ('decision_log','decision_logs');

-- §3: asset_roles shape and existing index names
SELECT column_name, data_type FROM information_schema.columns
 WHERE table_name='asset_roles' ORDER BY ordinal_position;
SELECT indexname, indexdef FROM pg_indexes WHERE tablename IN ('asset_roles','assets');

-- §3/§6: the columns in question
SELECT table_name, column_name, data_type FROM information_schema.columns
 WHERE (table_name='assets' AND column_name='role_key')
    OR (table_name='world_events' AND column_name IN ('category','format','restrictions'))
    OR (table_name='character_state' AND column_name='deleted_at')
    OR (table_name='decision_logs' AND column_name='deleted_at');

-- §4: table owners (expect postgres) and the app role's rights on assets
SELECT tablename, tableowner FROM pg_tables
 WHERE schemaname='public' AND tablename IN ('world_events','assets','asset_roles','event_deliverables','character_state');
SELECT privilege_type FROM information_schema.role_table_grants
 WHERE grantee='episode_app_dev' AND table_name IN ('assets','event_deliverables');

-- Q8: current default privileges
SELECT defaclrole::regrole, defaclobjtype, defaclacl FROM pg_default_acl;
```

Everything above is a `SELECT`; none of it changes the database.
