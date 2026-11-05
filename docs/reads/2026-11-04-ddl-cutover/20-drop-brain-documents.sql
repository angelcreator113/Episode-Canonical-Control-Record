-- Step 2, as the APPLICATION user (episode_app_dev, from ~/episode-metadata/.env): drop its own
-- EMPTY brain_documents, so the migration role can recreate it (inventory §5). One transaction:
-- check the login, lock the table (so nothing can insert between the checks and the drop), then
-- check that it is owned by this login, holds no rows and nothing else depends on it. Any failed
-- check: rollback, nothing changed, exit 3. A write in flight makes the lock wait at most 5 s,
-- then the step stops with "lock timeout" and changes nothing.
\set ON_ERROR_STOP on
\pset pager off
\ir roles.sql
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL search_path = pg_catalog, pg_temp;
SELECT session_user = :'app_role' AS is_app \gset
\if :is_app \else
  \echo 'STEP 2 STOPPED: not run as the application user; nothing changed'
  DO $s$ BEGIN RAISE EXCEPTION 'stopped, see the line above; nothing changed'; END $s$;
\endif
LOCK TABLE public.brain_documents IN ACCESS EXCLUSIVE MODE;
-- The dependents count is the query in brain-documents-dependents.sql (10-precheck.sql P2 lists them).
WITH x AS (SELECT to_regclass('public.brain_documents') AS t, to_regclass('public.brain_documents_id_seq') AS s)
SELECT (SELECT pg_get_userbyid(relowner) FROM pg_class, x WHERE oid = x.t) = session_user AS is_owner,
       (SELECT count(*) FROM public.brain_documents) AS n_rows,
       (SELECT count(*) FROM pg_depend d, x
         WHERE d.refclassid = 'pg_catalog.pg_class'::regclass AND d.refobjid IN (x.t, x.s) AND d.deptype IN ('n', 'a')
           AND NOT (d.classid = 'pg_catalog.pg_constraint'::regclass AND d.objid IN (SELECT oid FROM pg_constraint WHERE conrelid = x.t AND contype = 'p'))
           AND NOT (d.classid = 'pg_catalog.pg_attrdef'::regclass AND d.objid IN (SELECT oid FROM pg_attrdef WHERE adrelid = x.t))
           AND NOT (d.classid = 'pg_catalog.pg_class'::regclass AND (d.objid = x.s OR d.objid IN (SELECT indexrelid FROM pg_index WHERE indrelid = x.t)))
       ) AS n_deps
  FROM x
\gset
\if :is_owner \else
  \echo 'STEP 2 STOPPED: brain_documents is not owned by this login; nothing changed'
  DO $s$ BEGIN RAISE EXCEPTION 'stopped, see the line above; nothing changed'; END $s$;
\endif
SELECT :n_rows = 0 AS is_empty, :n_deps = 0 AS no_deps \gset
\if :is_empty \else
  \echo 'STEP 2 STOPPED: brain_documents holds' :n_rows 'row(s); nothing changed'
  DO $s$ BEGIN RAISE EXCEPTION 'stopped, see the line above; nothing changed'; END $s$;
\endif
\if :no_deps \else
  \echo 'STEP 2 STOPPED:' :n_deps 'object(s) depend on brain_documents; nothing changed (see 10-precheck.sql, P2)'
  DO $s$ BEGIN RAISE EXCEPTION 'stopped, see the line above; nothing changed'; END $s$;
\endif
DROP TABLE public.brain_documents;
SELECT to_regclass('public.brain_documents') IS NULL AND to_regclass('public.brain_documents_id_seq') IS NULL AS gone \gset
\if :gone \else
  \echo 'STEP 2 STOPPED: the table is still there; rolled back'
  DO $s$ BEGIN RAISE EXCEPTION 'stopped, see the line above; nothing changed'; END $s$;
\endif
COMMIT;
\echo 'STEP 2 DONE: the empty brain_documents (and its sequence) dropped'
