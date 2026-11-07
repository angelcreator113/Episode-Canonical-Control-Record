/**
 * Issue #3714: the production role file (scripts/worker/sql/episode-worker-role.sql)
 * grants exactly what src/workers/workerDbGrants.js lists, which the
 * restricted-role integration test proves is enough, and nothing more.
 */
const fs = require('fs');
const path = require('path');
const grants = require('../../../src/workers/workerDbGrants');

const SQL = fs.readFileSync(path.join(__dirname, '../../../scripts/worker/sql/episode-worker-role.sql'), 'utf8');
const statements = SQL.split('\n').filter((l) => l.trim() && !l.trim().startsWith('--') && !l.trim().startsWith('\\')).join('\n')
  .split(';').map((s) => s.replace(/\s+/g, ' ').trim()).filter(Boolean);

describe('the worker role SQL file', () => {
  test('creates the role once, with no powers, CONNECTION LIMIT 5, and no password in any statement', () => {
    const create = statements.filter((s) => /^CREATE ROLE/i.test(s));
    expect(create).toEqual([`CREATE ROLE ${grants.WORKER_ROLE} LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS CONNECTION LIMIT ${grants.CONNECTION_LIMIT}`]);
    expect(statements.join('\n')).not.toMatch(/PASSWORD/i);
    expect(SQL).toMatch(/\\password episode_worker/);
  });

  test('the table and sequence grants are exactly the list', () => {
    const fromFile = statements.filter((s) => /^GRANT .* ON (TABLE|SEQUENCE) /i.test(s)).sort();
    const expected = grants.grantStatements(grants.WORKER_ROLE, 'x')
      .filter((s) => / ON (TABLE|SEQUENCE) /.test(s))
      .map((s) => s.replace(/"/g, ''))
      .sort();
    expect(fromFile).toEqual(expected);
  });

  test('nothing broader: no DELETE, TRUNCATE, ALL, default privileges, schema CREATE or memberships', () => {
    const grantsOnly = statements.filter((s) => /^(GRANT|ALTER DEFAULT)/i.test(s)).join('\n');
    expect(grantsOnly).not.toMatch(/\bDELETE\b|\bTRUNCATE\b|\bALL\b|ALTER DEFAULT PRIVILEGES|CREATE ON SCHEMA|\bTRIGGER\b|\bREFERENCES\b/i);
    expect(statements.filter((s) => /^GRANT \w+ TO /i.test(s))).toEqual([]);
    expect(statements).toEqual(expect.arrayContaining([
      'GRANT CONNECT ON DATABASE :"dbname" TO episode_worker',
      'GRANT USAGE ON SCHEMA public TO episode_worker',
    ]));
  });

  test('runs in one transaction that stops on the first error', () => {
    expect(SQL).toMatch(/\\set ON_ERROR_STOP on/);
    expect(statements[0]).toBe('BEGIN');
    expect(statements[statements.length - 1]).toBe('COMMIT');
  });

  test('the worker pool stays below the connection limit', () => {
    expect(grants.POOL_MAX).toBeLessThan(grants.CONNECTION_LIMIT);
  });
});
