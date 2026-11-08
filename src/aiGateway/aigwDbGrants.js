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
 * The tables and functions are created by the migration
 * 20261108120000-create-aigw-ledger.js, which grants EXECUTE to nobody.
 * All access goes through SECURITY DEFINER functions; no role but the
 * inspector reads a table, and no role writes one directly.
 *
 * The existing application login gets NO administrative function: Stop,
 * Resume, pauses, caps and reconciliation belong to aigw_admin only. When G3
 * wires a caller, the application login may be made a member of aigw_caller
 * (authorize, abandon an unused permit, read the Stop state) and nothing
 * else.
 *
 * Roles (all NOLOGIN group roles; logins are a G3 decision):
 *   aigw_owner      owns the tables and functions; nothing is granted to it
 *                   and nobody is made a member of it
 *   aigw_caller     the services that ask for a permit (API, worker, scripts)
 *   aigw_gateway    the gateway process: dispatch, outcomes, cleanup, ack
 *   aigw_admin      Stop, Resume, pauses, caps, reconciliation
 *   aigw_inspector  read-only inspection and audit
 */

const OWNER_ROLE = 'aigw_owner';

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

/** Move every table and function to the owner role (run by a superuser or a member of it). */
function ownershipStatements(owner, functions) {
  return [
    ...TABLES.map((t) => `ALTER TABLE public.${t} OWNER TO ${q(owner)}`),
    ...functions.map((f) => `ALTER FUNCTION public.${f} OWNER TO ${q(owner)}`),
  ];
}

/** The statements giving `role` exactly the privileges of `kind`. */
function grantStatements(kind, role, database) {
  if (!FUNCTION_GRANTS[kind]) throw new Error(`aigw grants: unknown role kind ${kind}`);
  const out = [];
  if (database) out.push(`GRANT CONNECT ON DATABASE ${q(database)} TO ${q(role)}`);
  out.push(`GRANT USAGE ON SCHEMA public TO ${q(role)}`);
  for (const t of TABLE_GRANTS[kind]) out.push(`GRANT SELECT ON TABLE public.${t} TO ${q(role)}`);
  for (const f of FUNCTION_GRANTS[kind]) out.push(`GRANT EXECUTE ON FUNCTION public.${f} TO ${q(role)}`);
  return out;
}

module.exports = {
  OWNER_ROLE, ROLES, TABLES, FUNCTION_GRANTS, TABLE_GRANTS, ADMIN_ONLY, ownershipStatements, grantStatements,
};
