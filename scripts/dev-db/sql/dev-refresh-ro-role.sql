-- scripts/dev-db/sql/dev-refresh-ro-role.sql: the read-only database role the
-- dev-box refresh (scripts/dev-db/refresh-dev-db.sh) dumps production with
-- (Task #3716; Evoni, 2026-11-05). It is a separate role from prime_readonly,
-- so rotating one never touches the other. Same grants as
-- scripts/diagnostics/sql/readonly-role.sql, plus:
--   * SELECT on sequences, current and future: pg_dump reads each sequence's
--     last_value. SELECT cannot call nextval/setval.
--   * no access to data_correction_log, which stays out of the dev copy.
--
-- Evoni runs this once, as the admin database user (it changes production
-- roles, so it is gated):
--
--   psql "<admin connection>" -v dbname=episode_metadata -v migrate_user=<migration user> -f dev-refresh-ro-role.sql
--   then, in psql:  \password dev_refresh_ro     (typed, not echoed, never in a file)
--
-- When a later migration takes this role's grants off its own tables (the AI
-- gateway ledger did), the refresh fails at pg_dump with "permission denied
-- for table <name>". This file cannot be run again as a whole: CREATE ROLE
-- fails on a role that exists. Evoni runs the missing grants by hand, as the
-- admin database user (gated), and the same names are added to the DO block
-- below. As run on production on 2026-11-11:
--
--   GRANT SELECT ON public.aigw_operations, public.aigw_control, public.aigw_permits,
--     public.aigw_permit_events, public.aigw_reconciliations, public.aigw_audit TO dev_refresh_ro;
--   GRANT SELECT ON SEQUENCE public.aigw_permit_events_id_seq,
--     public.aigw_reconciliations_id_seq, public.aigw_audit_id_seq TO dev_refresh_ro;
--
-- To list what the role cannot read (expect only data_correction_log):
--
--   SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
--    WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p', 'S')
--      AND NOT has_table_privilege('dev_refresh_ro', c.oid, 'SELECT');
--
-- Undo:
--   ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE SELECT ON TABLES FROM dev_refresh_ro;
--   ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE SELECT ON SEQUENCES FROM dev_refresh_ro;
--   ALTER DEFAULT PRIVILEGES FOR ROLE <migration user> IN SCHEMA public REVOKE SELECT ON TABLES FROM dev_refresh_ro;
--   ALTER DEFAULT PRIVILEGES FOR ROLE <migration user> IN SCHEMA public REVOKE SELECT ON SEQUENCES FROM dev_refresh_ro;
--   REVOKE ALL ON ALL TABLES IN SCHEMA public FROM dev_refresh_ro;
--   REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM dev_refresh_ro;
--   REVOKE ALL ON SCHEMA public FROM dev_refresh_ro;
--   REVOKE ALL ON DATABASE episode_metadata FROM dev_refresh_ro;
--   DROP ROLE dev_refresh_ro;

\set ON_ERROR_STOP on
BEGIN;
CREATE ROLE dev_refresh_ro LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION CONNECTION LIMIT 2;
REVOKE ALL ON DATABASE :"dbname" FROM dev_refresh_ro;
GRANT CONNECT ON DATABASE :"dbname" TO dev_refresh_ro;
GRANT USAGE ON SCHEMA public TO dev_refresh_ro;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO dev_refresh_ro;
GRANT SELECT ON ALL SEQUENCES IN SCHEMA public TO dev_refresh_ro;
-- Tables and sequences created later by the admin user, and by the migration
-- user, are readable too.
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO dev_refresh_ro;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON SEQUENCES TO dev_refresh_ro;
ALTER DEFAULT PRIVILEGES FOR ROLE :"migrate_user" IN SCHEMA public GRANT SELECT ON TABLES TO dev_refresh_ro;
ALTER DEFAULT PRIVILEGES FOR ROLE :"migrate_user" IN SCHEMA public GRANT SELECT ON SEQUENCES TO dev_refresh_ro;
-- data_correction_log is production's access-controlled undo record (#3709)
-- and is never copied to dev.
REVOKE ALL ON public.data_correction_log FROM dev_refresh_ro;
-- The AI gateway ledger. Its migrations (20261108120000-create-aigw-ledger and
-- 20261108140000-aigw-sequence-acl) take every non-owner grant off its six
-- tables and three sequences when they run, this role's included, and give
-- SELECT back to prime_readonly only. pg_dump locks every table it dumps, so
-- the next refresh stopped at "permission denied for table aigw_operations"
-- (2026-11-11). These grants put read access back; the role still cannot
-- write a row or call an aigw_ function. Each is skipped when its table or
-- sequence does not exist yet, and running it again changes nothing.
DO $ledger$
DECLARE
  r text;
BEGIN
  FOREACH r IN ARRAY ARRAY[
    'aigw_operations', 'aigw_control', 'aigw_permits', 'aigw_permit_events', 'aigw_reconciliations', 'aigw_audit',
    'aigw_permit_events_id_seq', 'aigw_reconciliations_id_seq', 'aigw_audit_id_seq'
  ] LOOP
    IF to_regclass('public.' || r) IS NOT NULL THEN
      EXECUTE format('GRANT SELECT ON public.%I TO dev_refresh_ro', r);
    END IF;
  END LOOP;
END
$ledger$;
ALTER ROLE dev_refresh_ro SET default_transaction_read_only = on;
ALTER ROLE dev_refresh_ro SET statement_timeout = '30s';
ALTER ROLE dev_refresh_ro SET idle_in_transaction_session_timeout = '60s';
COMMIT;
