-- scripts/diagnostics/sql/readonly-role.sql — the read-only database role the
-- Diagnostics workflow uses (F-Tools-2, 2026-10-29). Evoni runs this once, as
-- the admin database user, from the box (docs/runbooks/diagnostics-workflow.md
-- step 3):
--
--   psql "<admin connection>" -v dbname=<database name> -v migrate_user=<migration user> -f readonly-role.sql
--   then, in psql:  \password prime_readonly     (typed, not echoed, never in a file)
--
-- tests/unit/scripts/diagnostics.test.js runs this same file against a scratch
-- database and proves every write is refused.

CREATE ROLE prime_readonly LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION CONNECTION LIMIT 2;
REVOKE ALL ON DATABASE :"dbname" FROM prime_readonly;
GRANT CONNECT ON DATABASE :"dbname" TO prime_readonly;
GRANT USAGE ON SCHEMA public TO prime_readonly;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO prime_readonly;
-- Tables created later by the admin user, and by the migration user (Deploy's
-- migrate phase runs as that user), are readable too.
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO prime_readonly;
ALTER DEFAULT PRIVILEGES FOR ROLE :"migrate_user" IN SCHEMA public GRANT SELECT ON TABLES TO prime_readonly;
ALTER ROLE prime_readonly SET default_transaction_read_only = on;
ALTER ROLE prime_readonly SET statement_timeout = '30s';
ALTER ROLE prime_readonly SET idle_in_transaction_session_timeout = '60s';
