'use strict';

/**
 * AI egress gateway, phase G2: the database roles for the ledger, and exactly
 * what each may do. One source for:
 *   - scripts/aigw/sql/aigw-roles.sql (hand-run by Evoni; NOT executed in
 *     production by G2; tests/unit/aiGateway/aigwDbGrants.test.js checks the
 *     file matches this list);
 *   - the integration tests, which build the same roles in a throwaway
 *     database and check every grant and every refusal.
 *
 * Ownership (Evoni, 2026-11-08, Option A): the tables and functions stay
 * owned by the trusted migration login that runs the migration
 * 20261108120000-create-aigw-ledger.js (the Deploy workflow's own login, not
 * the application's). Nothing moves them to another owner, so the deploy's
 * migration trust check (scripts/deploy/migration-trust-check.js) keeps
 * passing. The migration grants EXECUTE to nobody. Runtime access is granted
 * to the roles below and nothing else: no role but the inspector reads a
 * table, and no role writes one directly; every write is a SECURITY DEFINER
 * function.
 *
 * The existing application login gets NO administrative function: Stop,
 * Resume, pauses, caps and reconciliation belong to aigw_admin only. When G3
 * wires a caller, the application login may be made a member of aigw_caller
 * (authorize, abandon an unused permit, read the Stop state) and nothing
 * else.
 *
 * Roles (all NOLOGIN group roles; logins are a G3 decision):
 *   aigw_caller     the services that ask for a permit (API, worker, scripts)
 *   aigw_gateway    the gateway process: dispatch, outcomes, cleanup, ack
 *   aigw_admin      Stop, Resume, pauses, caps, reconciliation
 *   aigw_inspector  read-only inspection and audit
 *
 * The role script runs as the migration login. It can do all of it: it has
 * CREATEROLE, owns the database (pg_database_owner, so it may grant USAGE on
 * schema public) and owns every aigw object (so it may grant on them).
 * Per docs/reads/2026-11-04-deploy-migration-trusted-path.md that login is
 * `postgres`; the application connects as `episode_app_dev`.
 */

const ROLES = Object.freeze({
  caller: 'aigw_caller',
  gateway: 'aigw_gateway',
  admin: 'aigw_admin',
  inspector: 'aigw_inspector',
});

const TABLES = Object.freeze([
  'aigw_operations', 'aigw_control', 'aigw_permits', 'aigw_permit_events', 'aigw_reconciliations', 'aigw_audit',
]);

// EXECUTE grants, by role. Signatures exactly as Postgres prints them.
const FUNCTION_GRANTS = Object.freeze({
  caller: Object.freeze([
    'aigw_authorize(jsonb)',
    'aigw_abandon_authorized(uuid, text)',
    'aigw_read_control()',
  ]),
  gateway: Object.freeze([
    'aigw_get_permit(uuid)',
    'aigw_dispatch(uuid, text, text)',
    'aigw_abandon_authorized(uuid, text)',
    'aigw_mark_not_forwarded(uuid, text, text)',
    'aigw_record_outcome(uuid, jsonb)',
    'aigw_sweep(interval, integer)',
    'aigw_find_by_task(text, text)',
    'aigw_gateway_ack(jsonb)',
    'aigw_read_control()',
    'aigw_exposure(date, text)',
  ]),
  admin: Object.freeze([
    'aigw_stop(text, text)',
    'aigw_request_resume(jsonb)',
    'aigw_confirm_resume(jsonb)',
    'aigw_cancel_resume(text, text)',
    'aigw_set_pause(text, boolean, text, text)',
    'aigw_set_caps(jsonb)',
    'aigw_reconcile(uuid, jsonb)',
    'aigw_read_control()',
    'aigw_exposure(date, text)',
  ]),
  inspector: Object.freeze([
    'aigw_read_control()',
    'aigw_exposure(date, text)',
  ]),
});

// SELECT only, and only for the inspector.
const TABLE_GRANTS = Object.freeze({
  caller: Object.freeze([]),
  gateway: Object.freeze([]),
  admin: Object.freeze([]),
  inspector: Object.freeze([...TABLES]),
});

// The functions only an administrator may run. No other role may hold any.
const ADMIN_ONLY = Object.freeze([
  'aigw_stop(text, text)',
  'aigw_request_resume(jsonb)',
  'aigw_confirm_resume(jsonb)',
  'aigw_cancel_resume(text, text)',
  'aigw_set_pause(text, boolean, text, text)',
  'aigw_set_caps(jsonb)',
  'aigw_reconcile(uuid, jsonb)',
]);

const q = (id) => `"${String(id).replace(/"/g, '""')}"`;

/**
 * The statements giving `role` exactly the privileges of `kind`. Run by the
 * migration login, which owns the database and every aigw object. CONNECT is
 * included only when a database is named (the tests' logins need it; the
 * production group roles are NOLOGIN).
 */
function grantStatements(kind, role, database) {
  if (!FUNCTION_GRANTS[kind]) throw new Error(`aigw grants: unknown role kind ${kind}`);
  return [
    ...(database ? [`GRANT CONNECT ON DATABASE ${q(database)} TO ${q(role)}`] : []),
    `GRANT USAGE ON SCHEMA public TO ${q(role)}`,
    ...TABLE_GRANTS[kind].map((t) => `GRANT SELECT ON TABLE public.${t} TO ${q(role)}`),
    ...FUNCTION_GRANTS[kind].map((f) => `GRANT EXECUTE ON FUNCTION public.${f} TO ${q(role)}`),
  ];
}

module.exports = {
  ROLES, TABLES, FUNCTION_GRANTS, TABLE_GRANTS, ADMIN_ONLY, grantStatements,
};
