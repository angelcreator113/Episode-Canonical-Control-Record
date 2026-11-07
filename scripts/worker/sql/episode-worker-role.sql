-- scripts/worker/sql/episode-worker-role.sql: the production episode-worker's
-- own database role, with only what it uses (issue #3714). The worker used
-- to connect as postgres, the master login. Nothing here runs by itself:
-- this file is reviewed in a PR and then run by Evoni, once, by hand.
--
-- What the worker uses (traced from src/workers/start.js; the same list is
-- src/workers/workerDbGrants.js, and tests/unit/workers/workerDbGrants.test.js
-- checks this file against it):
--   generation_jobs, scene_sets, scene_angles   SELECT, UPDATE
--   world_locations, world_events               SELECT
--   ai_usage_logs                               SELECT, INSERT
--   ai_usage_logs_id_seq                        USAGE (its id is serial)
-- No DELETE, TRUNCATE or DDL anywhere, no other table, no default
-- privileges (a table added later is not reachable until it is granted here
-- on purpose), no CREATE on the schema, no role memberships.
--
-- Evoni runs this as the admin database user (it creates a role on the
-- production database, so it is gated, F-Tools-5 §4):
--
--   psql "<admin connection>" -v dbname=episode_metadata -f episode-worker-role.sql
--   then, in psql:  \password episode_worker     (typed, not echoed, never in a file)
--
-- The password is set with \password, never in a statement, so it is not
-- written to the database log. Then check it with the read-only preflight:
--   node scripts/worker/check-db-access.js
--
-- Undo (also gated):
--   REVOKE ALL ON ALL TABLES IN SCHEMA public FROM episode_worker;
--   REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM episode_worker;
--   REVOKE ALL ON SCHEMA public FROM episode_worker;
--   REVOKE ALL ON DATABASE episode_metadata FROM episode_worker;
--   DROP ROLE episode_worker;

\set ON_ERROR_STOP on
BEGIN;
-- Fails (and rolls back) if the role already exists: it is created once, on purpose.
CREATE ROLE episode_worker LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS CONNECTION LIMIT 5;
REVOKE ALL ON DATABASE :"dbname" FROM episode_worker;
GRANT CONNECT ON DATABASE :"dbname" TO episode_worker;
GRANT USAGE ON SCHEMA public TO episode_worker;
GRANT SELECT, UPDATE ON TABLE public.generation_jobs TO episode_worker;
GRANT SELECT, UPDATE ON TABLE public.scene_sets TO episode_worker;
GRANT SELECT, UPDATE ON TABLE public.scene_angles TO episode_worker;
GRANT SELECT ON TABLE public.world_locations TO episode_worker;
GRANT SELECT ON TABLE public.world_events TO episode_worker;
GRANT SELECT, INSERT ON TABLE public.ai_usage_logs TO episode_worker;
GRANT USAGE ON SEQUENCE public.ai_usage_logs_id_seq TO episode_worker;
-- A transaction left open (a crash mid-claim) does not hold its row locks.
ALTER ROLE episode_worker SET idle_in_transaction_session_timeout = '60s';
COMMIT;
