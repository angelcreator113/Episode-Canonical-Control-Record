-- Step 3, as the MIGRATION user (postgres, from ~/.episode-migrate.env): the application role
-- loses CREATE on public. Undo: R2-restore-create.sql.
\set ON_ERROR_STOP on
\pset pager off
\ir roles.sql
BEGIN;
SET LOCAL search_path = pg_catalog, pg_temp;
SELECT session_user = :'mig_role' AS is_mig \gset
\if :is_mig \else
  \echo 'STEP 3 STOPPED: not run as the migration user; nothing changed'
  DO $s$ BEGIN RAISE EXCEPTION 'stopped, see the line above; nothing changed'; END $s$;
\endif
REVOKE CREATE ON SCHEMA public FROM :"app_role";
SELECT NOT has_schema_privilege(:'app_role', 'public', 'CREATE') AS revoked \gset
\if :revoked \else
  \echo 'STEP 3 STOPPED: the application role can still CREATE on public (another grant, e.g. to PUBLIC?); rolled back'
  DO $s$ BEGIN RAISE EXCEPTION 'stopped, see the line above; nothing changed'; END $s$;
\endif
COMMIT;
\echo 'STEP 3 DONE: the application role can no longer create in public'
