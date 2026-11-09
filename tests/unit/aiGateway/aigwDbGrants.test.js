'use strict';

/**
 * AI gateway G2: the hand-run role file (scripts/aigw/sql/aigw-roles.sql,
 * not executed by G2) grants exactly what src/aiGateway/aigwDbGrants.js
 * lists, which the integration tests prove is enough and nothing more; it moves no
 * ownership (Option A, Evoni 2026-11-08: the migration login keeps it, so
 * the deploy's migration trust check keeps passing); no administrative
 * function reaches any role but aigw_admin; and the migration's operation
 * seed equals the G1 catalogue.
 */

const fs = require('fs');
const path = require('path');
const grants = require('../../../src/aiGateway/aigwDbGrants');
const migration = require('../../../src/migrations/20261108120000-create-aigw-ledger');
const { OPERATIONS } = require('../../../src/aiGateway/operationCatalog');

const SQL = fs.readFileSync(path.join(__dirname, '../../../scripts/aigw/sql/aigw-roles.sql'), 'utf8');
const statements = SQL.split('\n').filter((l) => l.trim() && !l.trim().startsWith('--') && !l.trim().startsWith('\\')).join('\n')
  .split(';').map((x) => x.replace(/\s+/g, ' ').trim()).filter(Boolean);
const KINDS = ['caller', 'gateway', 'admin', 'inspector'];
const norm = (x) => x.replace(/"/g, '');

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
  test('creates the four NOLOGIN roles, once, with no powers and no password', () => {
    expect(statements.filter((x) => /^CREATE ROLE/i.test(x))).toEqual(
      KINDS.map((k) => `CREATE ROLE ${grants.ROLES[k]} NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS`));
  });

  test('the grants are exactly the module\'s, role by role, and the file holds nothing else', () => {
    expect(statements.filter((x) => /^GRANT/i.test(x)).sort()).toEqual(
      KINDS.flatMap((k) => grants.grantStatements(k, grants.ROLES[k], null)).map(norm).sort());
    expect(statements.filter((x) => !/^(BEGIN|COMMIT|CREATE ROLE aigw_\w+ NOLOGIN .*|GRANT (USAGE ON SCHEMA public|EXECUTE ON FUNCTION public\.aigw_\w+\(.*\)|SELECT ON TABLE public\.aigw_\w+) TO aigw_\w+)$/.test(x))).toEqual([]);
  });

  test('Option A: no ownership move, no owner role, no role membership, no password, no login', () => {
    const all = statements.join('\n');
    expect(all).not.toMatch(/OWNER TO|REASSIGN|ALTER (TABLE|FUNCTION|DATABASE|SCHEMA)|aigw_owner|CURRENT_USER|SET ROLE/i);
    expect(statements.filter((x) => /^GRANT \w+ TO /i.test(x))).toEqual([]); // role memberships
    expect(all).not.toMatch(/PASSWORD|\bLOGIN\b(?<!NOLOGIN)/);
    expect(SQL).toMatch(/Option A/);
  });

  test('nothing broader: no ALL, write privileges, default privileges, schema CREATE, TRIGGER or REFERENCES', () => {
    const g = statements.filter((x) => /^(GRANT|ALTER DEFAULT)/i.test(x));
    expect(g.join('\n')).not.toMatch(/\bALL\b|\bINSERT\b|\bUPDATE\b|\bDELETE\b|\bTRUNCATE\b|ALTER DEFAULT PRIVILEGES|CREATE ON SCHEMA|\bTRIGGER\b|\bREFERENCES\b/i);
  });

  test('administrative functions are granted to aigw_admin only', () => {
    for (const f of grants.ADMIN_ONLY) {
      const to = statements.filter((x) => x.includes(`public.${f} TO `)).map((x) => x.split(' TO ')[1]);
      expect([f, to]).toEqual([f, ['aigw_admin']]);
    }
  });

  test('one transaction that stops on the first error; says it is not run by G2 and runs as the migration login', () => {
    expect(SQL).toMatch(/\\set ON_ERROR_STOP on/);
    expect(statements[0]).toBe('BEGIN');
    expect(statements[statements.length - 1]).toBe('COMMIT');
    expect(SQL).toMatch(/NOT RUN BY G2/);
    expect(SQL).toMatch(/Run as the migration login/);
    expect(SQL).not.toMatch(/application login (that )?(ran|runs) the migration/i);
  });
});
