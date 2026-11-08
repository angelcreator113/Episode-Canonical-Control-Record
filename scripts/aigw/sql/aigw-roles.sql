-- scripts/aigw/sql/aigw-roles.sql: the AI egress gateway ledger's runtime
-- database roles (phase G2). NOT RUN BY G2. Nothing here runs by itself:
-- this file is reviewed in a PR and run by Evoni, once, by hand, only when
-- G3 is approved. It creates roles and grants privileges on the production
-- database, so it is gated (F-Tools-5 section 4): an explicit yes for this
-- exact run first.
--
-- Ownership (Evoni, 2026-11-08, Option A): the aigw tables and functions
-- stay owned by the trusted migration login that ran the migration
-- 20261108120000-create-aigw-ledger. Per
-- docs/reads/2026-11-04-deploy-migration-trusted-path.md that is `postgres`
-- (the Deploy workflow's credential in ~/.episode-migrate.env); the
-- application connects as `episode_app_dev` and runs no migration. This
-- file moves no ownership and makes no role a member of another, so the
-- deploy's migration trust check (scripts/deploy/migration-trust-check.js)
-- keeps passing. Migration ownership and runtime permissions stay separate:
-- the owner is the migration login; runtime access is only the grants below.
--
-- The list is src/aiGateway/aigwDbGrants.js; tests/unit/aiGateway/aigwDbGrants.test.js
-- checks this file against it, and tests/integration/aigwRoles.integration.test.js
-- runs it on a throwaway database as a non-superuser migration login and
-- then runs the trust check.
--
--   aigw_caller     authorize, abandon an unused permit, read the Stop state
--   aigw_gateway    read a permit, dispatch, outcomes, cleanup, task lookup,
--                   acknowledge the Stop state, read exposure
--   aigw_admin      Stop, Resume (request, confirm, cancel), pauses, caps,
--                   reconciliation, read the Stop state and exposure
--   aigw_inspector  SELECT on the six tables; read the Stop state and exposure
--
-- All four are NOLOGIN group roles. The existing application login is not
-- made a member of any of them here (and never of aigw_admin); which logins
-- join which role is a G3 decision. No default privileges, no CREATE on the
-- schema, no table writes for anyone: every write is a SECURITY DEFINER
-- function owned by the migration login.
--
-- Run as the migration login, with psql's -f option pointing at this file.
-- It needs only what that login already has: CREATEROLE, ownership of the
-- database (to grant USAGE on schema public) and of the aigw objects (to
-- grant on them).
--
-- Undo (also gated, as the migration login): revoke the grants below, then
-- remove the four roles.
\set ON_ERROR_STOP on
BEGIN;
-- Fails (and rolls back) if a role already exists: they are created once, on purpose.
CREATE ROLE aigw_caller NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS;
CREATE ROLE aigw_gateway NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS;
CREATE ROLE aigw_admin NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS;
CREATE ROLE aigw_inspector NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS;

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
