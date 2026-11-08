'use strict';

/**
 * AI gateway G2: the hand-run role file (scripts/aigw/sql/aigw-roles.sql,
 * not executed by G2) grants exactly what src/aiGateway/aigwDbGrants.js
 * lists, which the integration tests prove is enough and nothing more; no
 * administrative function reaches any role but aigw_admin; and the
 * migration's operation seed equals the G1 catalogue.
 */

const fs = require('fs');
const path = require('path');
const grants = require('../../../src/aiGateway/aigwDbGrants');
const migration = require('../../../src/migrations/20261108120000-create-aigw-ledger');
const { OPERATIONS } = require('../../../src/aiGateway/operationCatalog');

const SQL = fs.readFileSync(path.join(__dirname, '../../../scripts/aigw/sql/aigw-roles.sql'), 'utf8');
const statements = SQL.split('\n').filter((l) => l.trim() && !l.trim().startsWith('--') && !l.trim().startsWith('\\')).join('\n')
  .split(';').map((s) => s.replace(/\s+/g, ' ').trim()).filter(Boolean);
const norm = (s) => s.replace(/"/g, '');

describe('AI gateway roles: the grants module', () => {
  test('administrative functions belong to aigw_admin only', () => {
    for (const kind of ['caller', 'gateway', 'inspector']) {
      for (const f of grants.ADMIN_ONLY) expect([kind, f, grants.FUNCTION_GRANTS[kind].includes(f)]).toEqual([kind, f, false]);
    }
    for (const f of grants.ADMIN_ONLY) expect(grants.FUNCTION_GRANTS.admin).toContain(f);
  });

  test('the caller can only ask for, give up, and read: never dispatch, record or clean up', () => {
    expect([...grants.FUNCTION_GRANTS.caller].sort()).toEqual(['aigw_abandon_authorized(uuid, text)', 'aigw_authorize(jsonb)', 'aigw_read_control()']);
  });

  test('only the inspector reads tables, and only with SELECT', () => {
    expect(grants.TABLE_GRANTS.caller).toEqual([]);
    expect(grants.TABLE_GRANTS.gateway).toEqual([]);
    expect(grants.TABLE_GRANTS.admin).toEqual([]);
    expect(grants.TABLE_GRANTS.inspector).toEqual(migration.TABLES);
    expect(grants.TABLES).toEqual(migration.TABLES);
  });

  test('every granted function exists in the migration; no internal helper is granted', () => {
    const granted = new Set(Object.values(grants.FUNCTION_GRANTS).flat());
    for (const f of granted) expect(migration.FUNCTIONS).toContain(f);
    for (const f of granted) expect(f).not.toMatch(/_guard\(\)|aigw_event\(|aigw_actor\(|_internal\(|aigw_transition_allowed\(|aigw_permit_json\(/);
  });

  test('the migration seeds exactly the catalogue\'s submission operations', () => {
    const fromCatalog = OPERATIONS.filter((o) => o.cls === 'submission').map((o) => [o.id, o.provider, o.service, o.bodyKind]).sort();
    expect([...migration.SUBMISSION_OPERATIONS].map((x) => [...x]).sort()).toEqual(fromCatalog);
  });
});

describe('AI gateway roles: the hand-run SQL file', () => {
  test('creates five NOLOGIN roles, once, with no powers and no password', () => {
    const create = statements.filter((s) => /^CREATE ROLE/i.test(s));
    const names = [grants.OWNER_ROLE, ...Object.values(grants.ROLES)];
    expect(create).toEqual(names.map((n) => `CREATE ROLE ${n} NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS`));
    expect(statements.join('\n')).not.toMatch(/PASSWORD|\bLOGIN\b(?<!NOLOGIN)/);
  });

  test('moves every table and function to the owner role, with a membership revoked in the same transaction', () => {
    const owns = statements.filter((s) => / OWNER TO /.test(s)).sort();
    expect(owns).toEqual(grants.ownershipStatements(grants.OWNER_ROLE, migration.FUNCTIONS).map(norm).sort());
    const i = statements.indexOf(`GRANT ${grants.OWNER_ROLE} TO CURRENT_USER`);
    const j = statements.indexOf(`REVOKE ${grants.OWNER_ROLE} FROM CURRENT_USER`);
    expect(i).toBeGreaterThan(0);
    expect(j).toBeGreaterThan(i);
    expect(j).toBeLessThan(statements.length - 1);
  });

  test('the grants are exactly the module\'s, role by role', () => {
    const fromFile = statements.filter((s) => /^GRANT .* ON /i.test(s)).sort();
    const expected = Object.keys(grants.FUNCTION_GRANTS)
      .flatMap((k) => grants.grantStatements(k, grants.ROLES[k], null))
      .map(norm).sort();
    expect(fromFile).toEqual(expected);
  });

  test('nothing broader: no ALL, write privileges, default privileges, schema CREATE or role memberships', () => {
    const g = statements.filter((s) => /^(GRANT|ALTER DEFAULT)/i.test(s));
    expect(g.join('\n')).not.toMatch(/\bALL\b|\bINSERT\b|\bUPDATE\b|\bDELETE\b|\bTRUNCATE\b|ALTER DEFAULT PRIVILEGES|CREATE ON SCHEMA|\bTRIGGER\b|\bREFERENCES\b/i);
    const memberships = g.filter((s) => /^GRANT \w+ TO /i.test(s));
    expect(memberships).toEqual([`GRANT ${grants.OWNER_ROLE} TO CURRENT_USER`]);
  });

  test('runs in one transaction that stops on the first error, and says it is not run by G2', () => {
    expect(SQL).toMatch(/\\set ON_ERROR_STOP on/);
    expect(statements[0]).toBe('BEGIN');
    expect(statements[statements.length - 1]).toBe('COMMIT');
    expect(SQL).toMatch(/NOT RUN BY G2/);
  });
});
