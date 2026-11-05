# Deploy hardening: migrations run only on a trusted search path (2026-11-04)

**Status:** this PR, separate from #3709 at Evoni's direction (2026-11-04). **Not approved to merge or deploy**; each needs her approval. No production grant, role or data change is made or proposed for automatic execution here.

## 1. The risk

**Who runs migrations.** Production migrations run as `postgres`:
- the Deploy workflow's `phase_migrate` runs them with the credential in `~/.episode-migrate.env`;
- `postgres` is LOGIN, CREATEROLE, CREATEDB and a member of `rds_superuser` (Evoni's read-only role check, 2026-11-04).

**What the application role can do.** The application connects as `episode_app_dev`. It can create objects in `public`: it owns one table there, and §5 lists the runtime DDL that needs it. It may also be able to create schemas (`F-Deploy-1_Fix_Plan_v1.34.md`: "CONNECT/USAGE/CREATE verified").

**How Postgres resolves names.** Postgres finds unqualified tables, functions and operators through the session's `search_path`. When a schema on the path holds a better-matching function or operator than the built-ins, that one is chosen. It then runs with the rights of whoever made the call. This is the CVE-2018-1058 class of attack.

**Shown locally against production's grants** (PR #3709, and this PR's integration test):
- **Planted operator.** An operator `=(varchar, varchar)` planted in `public` by the application role ran as the migration role during an ordinary migration. In the test it recorded the migration role as its caller; in #3709's simulation it granted itself full access to the correction log.
- **Look-alike schema.** The migration role's default path is `"$user", public`. A schema named `postgres` comes first in it, and anyone with CREATE on the database can make one.

**Why a one-time check is not enough** (Evoni, 2026-11-04). A read-only preflight cannot see an object planted a second after it runs. The protection must hold for the whole migration.

## 2. The fix

**Pinned search path.**
- `phase_migrate` passes `PGOPTIONS="-c lock_timeout=30s -c search_path=public"` to every database process of the migration: the trust check below and `sequelize-cli db:migrate`.
- **Why `public` and nothing else:**
  - `pg_catalog` is always searched first, even when it is not listed;
  - the per-user schema is gone;
  - new unqualified objects go into `public`. Listing `pg_catalog` first would send every unqualified `CREATE TABLE` into `pg_catalog`, which is refused; the integration test hit exactly that.

**The trust check, `scripts/deploy/migration-trust-check.js`.**
- **When it runs:** in the migrate phase, right before `db:migrate`, from the staged release, with the same credential and the same `PGOPTIONS`.
- **What it does:** read-only, a `BEGIN READ ONLY` transaction of SELECTs. It stops the migration (exit 1) when any of these holds:
  1. **The pin did not arrive:** the connection's `search_path` is not exactly `public`.
  2. **Someone untrusted can create on the path:** an untrusted role has CREATE on a schema on the path. **This condition is what makes the check hold after it runs:** without CREATE there, no new object can appear on the path.
  3. **Someone untrusted can add triggers:** an untrusted role holds TRIGGER on a table on the path, so it could attach its own function to a table a migration writes.
  4. **Something untrusted is already there:** an untrusted role owns an object on the path. Checked objects: relations, functions, procedures, aggregates, operators, types, collations, conversions, text search objects, operator classes and families, and extensions. Also a trigger there whose function an untrusted role owns.
- **Trusted roles:** the migration login, every role it belongs to (`rds_superuser`, `pg_database_owner`), superusers, and `rdsadmin`. Every other role is untrusted, including `episode_app_dev`.
- **On failure:** the phase dies with "No migration was run; nothing was changed". The findings are printed, with the migration password scrubbed.

**Scope:**
- No change to the application's connection, to `deploy.yml`, or to the SSM document.
- No change to any grant.
- `check-pending-migrations.js` still runs as the application user. That is the application's own privilege, so the risk does not apply to it.

## 3. The real production execution path (item 3)

| Step | Where the protection applies | Evidence |
|---|---|---|
| Which script runs | The SSM document runs `git show <sha>:scripts/deploy/workflow-deploy.sh` from **the commit being deployed** | `docs/runbooks/deploy-workflow.md`, the `PrimeStudios-Deploy` document |
| Which code connects | `sequelize-cli` and the trust check run from the staged release of that commit (`STAGE_PATHS` now includes the trust check, and `verify_stage` checks it file by file) | `phase_migrate`, `stage_release` |
| How the pin reaches connections | `pg` 8.20 reads `PGOPTIONS` at connect when the config sets no `options`; `src/config/sequelize.js` sets none. Production already relies on this for `lock_timeout` (Deploy run 176) | `node_modules/pg/lib/connection-parameters.js` (`val('options')`) |
| Separate connections | Any `new Client()` or new Sequelize a migration opens reads the same environment | integration test: a second connection opened inside the migration reports `public` |
| Subprocesses | Child processes inherit `PGOPTIONS` | integration test: a child process started by the migration reports `public` |
| A migration that sets its own path | Unaffected: for example #3709 sets `SET LOCAL search_path = pg_catalog, pg_temp` | #3709 applied under the pin: table in `public`, owned by `postgres`, ACL `{postgres=arwdDxt/postgres}` |
| Existing migrations | All 396 files on `main` ran from scratch under the pin, exit 0 (local Postgres 16) | §6 |

## 4. Regression test (item 4)

**`tests/integration/deployMigrationTrustedPath.integration.test.js`** uses a throwaway database and two throwaway roles laid out like production:
- `dh_migrator` owns the database and is not a superuser;
- `dh_app` has CREATE on the database and on `public`, and the default privileges.

It runs the real `sequelize-cli` with the repo's config, `NODE_ENV=production` and the `DB_*` variables, exactly as `phase_migrate` does:
1. **The exploit is real.** With the old `PGOPTIONS` (lock timeout only), a probe migration's varchar comparison ran `dh_app`'s planted operator, which recorded the caller as `dh_migrator`.
2. **With production's grants, the check refuses.** The trust check exits 1 and names the CREATE privilege, the operator and its function. The probe never runs, and the planted code runs 0 times. That phase_migrate then stops is tested in `tests/unit/scripts/workflowDeployStagedMigrate.test.js`.
3. **A missing pin is caught.** Without the pin, the trust check refuses because the path is `"$user", public`.
4. **The trusted state works end to end.** With `public`'s CREATE revoked from `dh_app`, it plants the same operator in a schema named `dh_migrator`:
   - unpinned, an ordinary comparison by the migration role runs it;
   - with the pin, the trust check passes and the migration runs;
   - its own connection, a second connection and a child process all report `public`;
   - the planted code runs 0 times, and nothing is created in the look-alike schema.

**Unit tests** (`workflowDeployStagedMigrate.test.js`):
- the trust check runs first, from the stage, as the migration user, with the same `PGOPTIONS` as `db:migrate`;
- a failing or erroring check stops the phase with no `db:migrate`, nothing recorded and the live directory unchanged;
- the findings are shown with the password scrubbed.

## 5. Why `episode_app_dev` can create in `public`, and whether it needs to (item 5)

**Why it can:**
- **v1.34, 2026-07-10** records that the role was created with "CONNECT/USAGE/CREATE verified". Its grant leg added DML on all tables and default privileges.
- **It still owns one table in `public`** (role check: "episode_app_dev owns 1"), so it created at least one at runtime.
- **The cluster may also grant CREATE on `public` to PUBLIC.** That was the default before Postgres 15 and is kept on upgrade. The read-only query below tells which.

**It needs it today, because the application runs DDL at runtime** (outside migrations, which `CLAUDE.md` already forbids):

| Where | What | When it runs |
|---|---|---|
| `src/routes/sceneSetRoutes.js` `ensureGenerationJobsTable` | `GenerationJob.sync()` | first use per process |
| `src/workers/sceneGenerationWorker.js` `start` | `GenerationJob.sync()` | every worker start |
| `src/routes/storyHealth.js` | `CREATE TABLE IF NOT EXISTS chapter_versions` (two places) | on those requests |
| `src/routes/worldStudio.js` | `CREATE TABLE IF NOT EXISTS ecosystem_previews` | on that request |
| `src/routes/admin.js`, `src/controllers/videoCompositionController.js` | `CREATE TABLE IF NOT EXISTS video_compositions`, plus two `CREATE INDEX IF NOT EXISTS` | on those requests |
| `src/routes/continuityEngine.js` `ensureTables` | `Model.sync()` × 4 | only if `continuity_timelines` is missing |
| `src/routes/franchiseBrainRoutes.js` | `FranchiseKnowledge.sync()` | only if counting the table fails |
| `src/app.js` | `sequelize.sync()` | only with `ENABLE_DB_SYNC=true` |
| `src/server.js`, `src/controllers/sceneController.js` | index and constraint changes | conditional; they need table ownership anyway |

**Measured locally:** without CREATE on the schema, `CREATE TABLE IF NOT EXISTS` fails with "permission denied for schema public" **even when the table already exists**. Revoking CREATE today would therefore break at least the first five rows: generation jobs, the scene worker's start, chapter versions, ecosystem previews and video compositions.

**Recommendation (not done; each step needs Evoni's approval):**
1. **A code PR** that removes this runtime DDL. Every table already exists through migrations, or gets one.
2. **A read-only check** that every such table exists in production and who owns it.
3. **Then the revoke, as a production change with its own approval:**
   - `REVOKE CREATE ON SCHEMA public FROM episode_app_dev` (and `FROM PUBLIC` if it is set);
   - `ALTER TABLE <the app-owned table> OWNER TO postgres`;
   - undo is the matching GRANT and ALTER.

## 6. What the trust check will say in production today

Until §5 step 3, it is expected to **refuse**, naming at least `episode_app_dev`'s CREATE on `public` and its one table. That is by design: it fails closed, and nothing is migrated or changed.

**To see it in advance, read-only,** with the `prime_readonly` connection lines as before. It is the trust check's query with the migration login written out as `postgres`:

```sql
SET default_transaction_read_only = on;
\pset pager off
WITH trusted AS (SELECT r.oid FROM pg_roles r WHERE r.rolname = 'postgres' OR r.rolsuper OR r.rolname = 'rdsadmin' OR pg_has_role('postgres', r.oid, 'MEMBER'))
SELECT 'can CREATE in public' AS finding, r.rolname AS who FROM pg_roles r
 WHERE r.oid NOT IN (SELECT oid FROM trusted) AND has_schema_privilege(r.oid, 'public', 'CREATE')
UNION ALL
SELECT 'owns ' || CASE c.relkind WHEN 'r' THEN 'table' WHEN 'S' THEN 'sequence' WHEN 'i' THEN 'index' WHEN 'v' THEN 'view' ELSE c.relkind::text END || ' public.' || c.relname, pg_get_userbyid(c.relowner)
  FROM pg_class c WHERE c.relnamespace = 'public'::regnamespace AND c.relowner NOT IN (SELECT oid FROM trusted)
UNION ALL
SELECT 'owns function/operator public.' || x.name, pg_get_userbyid(x.owner) FROM (
  SELECT proname::text AS name, proowner AS owner FROM pg_proc WHERE pronamespace = 'public'::regnamespace
  UNION ALL SELECT oprname::text, oprowner FROM pg_operator WHERE oprnamespace = 'public'::regnamespace) x
 WHERE x.owner NOT IN (SELECT oid FROM trusted)
UNION ALL
SELECT 'PUBLIC holds CREATE on public', 'PUBLIC' WHERE EXISTS (
  SELECT 1 FROM pg_namespace n, aclexplode(n.nspacl) a WHERE n.nspname = 'public' AND a.grantee = 0 AND a.privilege_type = 'CREATE')
UNION ALL
SELECT 'can CREATE schemas in the database', r.rolname FROM pg_roles r
 WHERE r.oid NOT IN (SELECT oid FROM trusted) AND has_database_privilege(r.oid, current_database(), 'CREATE')
ORDER BY 1, 2;
```

**Reading it:**
- **Rows 1 to 4 are what the trust check refuses.** The last row is not: once the path is pinned, a schema of its own no longer reaches the migration.
- **Expect to see** `episode_app_dev` with CREATE, the one table it owns, and possibly `prime_readonly` and the `rds_*` roles if PUBLIC holds CREATE.

## 7. Order relative to #3709 (Evoni's question)

**This PR does not need a deploy of its own before #3709.**
- The box runs the migrate phase from the commit being deployed (§3). One Deploy run of a commit that contains both PRs therefore checks and pins #3709's migration.
- The only requirement is that this PR is on `main` at or before that commit. **Merging #3709 alone and deploying it would run it under the old, unpinned phase.**

**But the combined deploy will not migrate until §5 is done.** The trust check will refuse while `episode_app_dev` can create in `public`. #3709's own SQL is already immune (it pins itself and names everything with `public.`). It is the migration framework's own statements, and any other migration in the same run, that need the trusted path.

**The safe sequence** is in §8.

## 8. Approval sequence

Each step is separate and needs Evoni's approval.
1. Merge this PR.
2. Merge the runtime-DDL removal PR (§5 step 1; not written yet), and confirm the tables in production (read-only).
3. **The production privilege change** (§5 step 3), with its exact commands and undo. Then re-run the §6 query: it must return only the last kind of row.
4. Merge #3709.
5. **One Deploy run** of the commit containing steps 1 to 4. The trust check must print `OK`; then the migration runs, snapshot first.
6. The A/B preflight, then Evoni's confirmation of the procedure, then A and B.
