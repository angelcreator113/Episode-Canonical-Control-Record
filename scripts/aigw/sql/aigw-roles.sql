-- scripts/aigw/sql/aigw-roles.sql: the AI egress gateway ledger's database
-- roles (phase G2). NOT RUN BY G2. Nothing here runs by itself: this file is
-- reviewed in a PR and run by Evoni, once, by hand, only when G3 is approved.
-- It creates roles and changes ownership on the production database, so it
-- is gated (F-Tools-5 section 4): an explicit yes for this exact run first.
--
-- The list is src/aiGateway/aigwDbGrants.js; tests/unit/aiGateway/aigwDbGrants.test.js
-- checks this file against it, and the G2 integration tests build the same
-- roles in a throwaway database and prove every grant and every refusal.
--
--   aigw_owner      NOLOGIN; owns every aigw table and function, so the
--                   application login that ran the migration owns nothing.
--                   Nothing is granted to it; nobody stays a member of it.
--   aigw_caller     authorize, abandon an unused permit, read the Stop state
--   aigw_gateway    read a permit, dispatch, outcomes, cleanup, task lookup,
--                   acknowledge the Stop state, read exposure
--   aigw_admin      Stop, Resume (request, confirm, cancel), pauses, caps,
--                   reconciliation, read the Stop state and exposure
--   aigw_inspector  SELECT on the six tables; read the Stop state and exposure
--
-- All are NOLOGIN group roles. The existing application login is NOT made a
-- member of aigw_admin, aigw_gateway or aigw_inspector by this file (and
-- never of aigw_admin). Which logins join which role is a G3 decision.
-- No default privileges, no CREATE on the schema, no table writes for anyone:
-- every write is a SECURITY DEFINER function owned by aigw_owner.
--
-- Run as the admin database user, after the migration
-- 20261108120000-create-aigw-ledger has run (it grants EXECUTE to nobody),
-- with psql's -f option pointing at this file.
--
-- ALTER ... OWNER needs the running user to own the objects (or be a member
-- of their owner) and to be able to SET ROLE aigw_owner: the temporary
-- membership below gives the second and is revoked before COMMIT. On RDS the
-- master user is not a superuser; confirm who owns the aigw objects first
-- (SELECT relowner::regrole FROM pg_class WHERE relname = 'aigw_control').
--
-- Undo (also gated): reassign the aigw objects back to the migration login,
-- revoke the grants below, then remove the five roles.

\set ON_ERROR_STOP on
BEGIN;
-- Fails (and rolls back) if a role already exists: they are created once, on purpose.
CREATE ROLE aigw_owner NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS;
CREATE ROLE aigw_caller NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS;
CREATE ROLE aigw_gateway NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS;
CREATE ROLE aigw_admin NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS;
CREATE ROLE aigw_inspector NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS;

-- Ownership: the application login keeps nothing.
GRANT aigw_owner TO CURRENT_USER;
ALTER TABLE public.aigw_operations OWNER TO aigw_owner;
ALTER TABLE public.aigw_control OWNER TO aigw_owner;
ALTER TABLE public.aigw_permits OWNER TO aigw_owner;
ALTER TABLE public.aigw_permit_events OWNER TO aigw_owner;
ALTER TABLE public.aigw_reconciliations OWNER TO aigw_owner;
ALTER TABLE public.aigw_audit OWNER TO aigw_owner;
ALTER FUNCTION public.aigw_transition_allowed(text, text) OWNER TO aigw_owner;
ALTER FUNCTION public.aigw_actor(text) OWNER TO aigw_owner;
ALTER FUNCTION public.aigw_exposure_internal(date, text) OWNER TO aigw_owner;
ALTER FUNCTION public.aigw_permit_json(public.aigw_permits) OWNER TO aigw_owner;
ALTER FUNCTION public.aigw_event(uuid, text, text, text, text) OWNER TO aigw_owner;
ALTER FUNCTION public.aigw_permits_guard() OWNER TO aigw_owner;
ALTER FUNCTION public.aigw_append_only_guard() OWNER TO aigw_owner;
ALTER FUNCTION public.aigw_control_guard() OWNER TO aigw_owner;
ALTER FUNCTION public.aigw_authorize(jsonb) OWNER TO aigw_owner;
ALTER FUNCTION public.aigw_get_permit(uuid) OWNER TO aigw_owner;
ALTER FUNCTION public.aigw_dispatch(uuid, text, text) OWNER TO aigw_owner;
ALTER FUNCTION public.aigw_abandon_authorized(uuid, text) OWNER TO aigw_owner;
ALTER FUNCTION public.aigw_mark_not_forwarded(uuid, text, text) OWNER TO aigw_owner;
ALTER FUNCTION public.aigw_record_outcome(uuid, jsonb) OWNER TO aigw_owner;
ALTER FUNCTION public.aigw_sweep(interval, integer) OWNER TO aigw_owner;
ALTER FUNCTION public.aigw_find_by_task(text, text) OWNER TO aigw_owner;
ALTER FUNCTION public.aigw_reconcile(uuid, jsonb) OWNER TO aigw_owner;
ALTER FUNCTION public.aigw_exposure(date, text) OWNER TO aigw_owner;
ALTER FUNCTION public.aigw_read_control() OWNER TO aigw_owner;
ALTER FUNCTION public.aigw_stop(text, text) OWNER TO aigw_owner;
ALTER FUNCTION public.aigw_request_resume(jsonb) OWNER TO aigw_owner;
ALTER FUNCTION public.aigw_confirm_resume(jsonb) OWNER TO aigw_owner;
ALTER FUNCTION public.aigw_cancel_resume(text, text) OWNER TO aigw_owner;
ALTER FUNCTION public.aigw_set_pause(text, boolean, text, text) OWNER TO aigw_owner;
ALTER FUNCTION public.aigw_set_caps(jsonb) OWNER TO aigw_owner;
ALTER FUNCTION public.aigw_gateway_ack(jsonb) OWNER TO aigw_owner;
REVOKE aigw_owner FROM CURRENT_USER;

-- aigw_caller: callers: authorize and give up an unused permit
GRANT USAGE ON SCHEMA public TO aigw_caller;
GRANT EXECUTE ON FUNCTION public.aigw_authorize(jsonb) TO aigw_caller;
GRANT EXECUTE ON FUNCTION public.aigw_abandon_authorized(uuid, text) TO aigw_caller;
GRANT EXECUTE ON FUNCTION public.aigw_read_control() TO aigw_caller;

-- aigw_gateway: the gateway process
GRANT USAGE ON SCHEMA public TO aigw_gateway;
GRANT EXECUTE ON FUNCTION public.aigw_get_permit(uuid) TO aigw_gateway;
GRANT EXECUTE ON FUNCTION public.aigw_dispatch(uuid, text, text) TO aigw_gateway;
GRANT EXECUTE ON FUNCTION public.aigw_abandon_authorized(uuid, text) TO aigw_gateway;
GRANT EXECUTE ON FUNCTION public.aigw_mark_not_forwarded(uuid, text, text) TO aigw_gateway;
GRANT EXECUTE ON FUNCTION public.aigw_record_outcome(uuid, jsonb) TO aigw_gateway;
GRANT EXECUTE ON FUNCTION public.aigw_sweep(interval, integer) TO aigw_gateway;
GRANT EXECUTE ON FUNCTION public.aigw_find_by_task(text, text) TO aigw_gateway;
GRANT EXECUTE ON FUNCTION public.aigw_gateway_ack(jsonb) TO aigw_gateway;
GRANT EXECUTE ON FUNCTION public.aigw_read_control() TO aigw_gateway;
GRANT EXECUTE ON FUNCTION public.aigw_exposure(date, text) TO aigw_gateway;

-- aigw_admin: administration: never the application login
GRANT USAGE ON SCHEMA public TO aigw_admin;
GRANT EXECUTE ON FUNCTION public.aigw_stop(text, text) TO aigw_admin;
GRANT EXECUTE ON FUNCTION public.aigw_request_resume(jsonb) TO aigw_admin;
GRANT EXECUTE ON FUNCTION public.aigw_confirm_resume(jsonb) TO aigw_admin;
GRANT EXECUTE ON FUNCTION public.aigw_cancel_resume(text, text) TO aigw_admin;
GRANT EXECUTE ON FUNCTION public.aigw_set_pause(text, boolean, text, text) TO aigw_admin;
GRANT EXECUTE ON FUNCTION public.aigw_set_caps(jsonb) TO aigw_admin;
GRANT EXECUTE ON FUNCTION public.aigw_reconcile(uuid, jsonb) TO aigw_admin;
GRANT EXECUTE ON FUNCTION public.aigw_read_control() TO aigw_admin;
GRANT EXECUTE ON FUNCTION public.aigw_exposure(date, text) TO aigw_admin;

-- aigw_inspector: read-only inspection and audit
GRANT USAGE ON SCHEMA public TO aigw_inspector;
GRANT SELECT ON TABLE public.aigw_operations TO aigw_inspector;
GRANT SELECT ON TABLE public.aigw_control TO aigw_inspector;
GRANT SELECT ON TABLE public.aigw_permits TO aigw_inspector;
GRANT SELECT ON TABLE public.aigw_permit_events TO aigw_inspector;
GRANT SELECT ON TABLE public.aigw_reconciliations TO aigw_inspector;
GRANT SELECT ON TABLE public.aigw_audit TO aigw_inspector;
GRANT EXECUTE ON FUNCTION public.aigw_read_control() TO aigw_inspector;
GRANT EXECUTE ON FUNCTION public.aigw_exposure(date, text) TO aigw_inspector;
COMMIT;
