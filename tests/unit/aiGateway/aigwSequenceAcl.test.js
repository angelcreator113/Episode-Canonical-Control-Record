'use strict';

/**
 * The G2 follow-up migration (20261108140000-aigw-sequence-acl) touches only
 * the ledger migration's three sequences, only with REVOKE, and its down does
 * nothing. The integration test proves the effect on a database with
 * production's default privileges.
 */

const ledger = require('../../../src/migrations/20261108120000-create-aigw-ledger');
const followUp = require('../../../src/migrations/20261108140000-aigw-sequence-acl');

function capture(m, method = 'up') {
  const sql = [];
  const qi = {
    sequelize: {
      transaction: async (fn) => fn({}),
      query: async (s) => { sql.push(s); return [[{ present: false }]]; },
    },
  };
  return m[method](qi).then(() => sql);
}

describe('G2 follow-up: aigw_ sequence grants', () => {
  test('its sequences are exactly the ledger migration\'s three', async () => {
    const ledgerSql = await capture(ledger);
    const fromLedger = ledgerSql.map((s) => (s.match(/^REVOKE ALL ON SEQUENCE public\.(\w+) FROM PUBLIC$/) || [])[1]).filter(Boolean);
    expect([...followUp.SEQUENCES].sort()).toEqual(fromLedger.sort());
    expect(fromLedger).toHaveLength(3);
  });

  test('only REVOKE on those sequences: no GRANT, no ownership, no DDL, no other object', async () => {
    const sql = (await capture(followUp)).join('\n');
    expect(sql).not.toMatch(/\bGRANT\b|OWNER TO|ALTER (TABLE|SEQUENCE|FUNCTION|DEFAULT)|\bDROP\b|\bCREATE\b|\bINSERT\b|\bUPDATE\b|\bDELETE\b|TRUNCATE/i);
    const named = new Set([...sql.matchAll(/public\.(\w+)/g)].map((m) => m[1]));
    expect([...named].sort()).toEqual([...followUp.SEQUENCES].sort());
    expect(sql.match(/REVOKE ALL ON SEQUENCE/g).length).toBe(6); // PUBLIC and the sweep, per sequence
  });

  test('down does nothing', async () => {
    expect(await capture(followUp, 'down')).toEqual([]);
  });
});
