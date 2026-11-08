'use strict';

/**
 * AI gateway G2 follow-up: migration 20261108140000-aigw-sequence-acl.
 *
 * Production's migration login has default privileges on new sequences in
 * schema public (read 2026-11-08: episode_app_dev SELECT, USAGE). The ledger
 * migration sweeps its tables and functions but only revokes PUBLIC on its
 * three sequences, so the application login could call nextval() on them.
 * On a throwaway database with those default privileges:
 *   - the ledger migration alone leaves the application login nextval() (the gap);
 *   - with the follow-up, the three sequences are owner-only; the application
 *     login gets 42501 on nextval, currval-style reads and setval;
 *   - tables and functions are as before; the gateway still writes its history
 *     (the SECURITY DEFINER functions use the sequences as their owner);
 *   - the deploy's migration trust check, unchanged, still accepts the database;
 *   - the follow-up is idempotent and does nothing where the sequences are absent.
 */

const crypto = require('crypto');
const { Client } = require('pg');
const { Sequelize } = require('sequelize');
const { ADMIN_URL, shouldSkip, createAigwTestDb, urlFor, ident } = require('../helpers/aigwTestDb');
const followUp = require('../../src/migrations/20261108140000-aigw-sequence-acl');
const { check: trustCheck } = require('../../scripts/deploy/migration-trust-check');
const { createPgLedger, createPgAdmin } = require('../../src/aiGateway/pgLedger');
const { withLimits } = require('../../src/aiGateway/constants');
const { anthropicCall } = require('../unit/aiGateway/_harness');

const SEQ_ACL = `SELECT c.relname, COALESCE(c.relacl::text, '') AS acl FROM pg_class c
  WHERE c.relname = ANY($1) ORDER BY 1`;
const nonOwnerSeqGrants = async (t) => (await t.su.query(`SELECT c.relname, a.grantee::regrole::text AS grantee, a.privilege_type
  FROM pg_class c, aclexplode(c.relacl) a WHERE c.relname = ANY($1) AND a.grantee <> c.relowner ORDER BY 1, 2, 3`, [followUp.SEQUENCES])).rows;
const asApp = async (t, sql) => {
  const c = new Client({ connectionString: t.url('app') });
  await c.connect();
  try { return await c.query(sql).then(() => 'allowed', (e) => e.code); } finally { await c.end(); }
};
const trustFindings = async (t) => {
  const c = new Client({ connectionString: t.url('migrator'), options: '-c search_path=public' });
  await c.connect();
  try { return await trustCheck(c); } finally { await c.end(); }
};

(shouldSkip ? describe.skip : describe)('AI gateway G2 follow-up: the aigw_ sequences are owner-only', () => {
  jest.setTimeout(60000);

  test('the gap: with production\'s default privileges, the ledger migration alone leaves the application login nextval()', async () => {
    const t = await createAigwTestDb({ poolMax: 1, productionDefaultPrivileges: true });
    try {
      const grants = await nonOwnerSeqGrants(t);
      expect(grants.map((g) => [g.relname, g.grantee === t.roles.app, g.privilege_type])).toEqual(expect.arrayContaining([
        ['aigw_audit_id_seq', true, 'USAGE'], ['aigw_audit_id_seq', true, 'SELECT']]));
      expect(await asApp(t, "SELECT nextval('public.aigw_audit_id_seq')")).toBe('allowed');
      // tables were already swept: the application login's default table grants are gone
      expect(await asApp(t, 'SELECT 1 FROM public.aigw_permits LIMIT 1')).toBe('42501');
    } finally {
      await t.close();
    }
  });

  test('with the follow-up: owner-only sequences, application login refused, tables and functions unchanged, gateway still writes, trust check passes', async () => {
    const t = await createAigwTestDb({ poolMax: 2, productionDefaultPrivileges: true, extraMigrations: [followUp] });
    try {
      expect(await nonOwnerSeqGrants(t)).toEqual([]);
      for (const sql of ["SELECT nextval('public.aigw_audit_id_seq')", 'SELECT last_value FROM public.aigw_permit_events_id_seq',
        "SELECT setval('public.aigw_reconciliations_id_seq', 1)"]) {
        expect([sql, await asApp(t, sql)]).toEqual([sql, '42501']);
      }
      const { rows: tables } = await t.su.query(`SELECT c.relname, a.grantee::regrole::text AS grantee, a.privilege_type FROM pg_class c, aclexplode(c.relacl) a
        WHERE c.relname LIKE 'aigw\\_%' AND c.relkind = 'r' AND a.grantee <> c.relowner AND a.grantee::regrole::text NOT IN ($1, 'prime_readonly')`, [t.roles.inspector]);
      expect(tables).toEqual([]);

      // a full flow: authorize, dispatch, outcome, a set_caps and Stop, so every sequence is used through the functions
      const ledger = createPgLedger({ caller: t.port('caller'), gateway: t.port('gateway'), instance: 'gw-seq', limits: withLimits({ permitTtlMs: 5000 }) });
      const admin = createPgAdmin({ admin: t.port('admin') });
      await admin.setCaps({ dailyMicros: 100000, imageDailyMicros: 100000, actor: 'evoni', reason: 'seq test' });
      const challengeId = crypto.randomUUID();
      const nonceHash = crypto.createHash('sha256').update(challengeId).digest('hex');
      const r = await admin.requestResume({ actor: 'evoni', reason: 'seq test', challengeId, nonceHash, ttlSeconds: 60 });
      expect((await admin.confirmResume({ actor: 'evoni', challengeId, nonceHash, targetVersion: r.target_version })).ok).toBe(true);
      const a = await ledger.authorize(anthropicCall({ logicalKey: 'seq-flow' }).authorizeInput);
      expect(a.ok).toBe(true);
      expect((await ledger.dispatch(a.permit.id, { operation: 'anthropic.messages' })).ok).toBe(true);
      await ledger.recordOutcome(a.permit.id, { phase: 'unknown' });
      expect((await admin.reconcile(a.permit.id, { to: 'failed_confirmed', method: 'provider_status_read', evidence: { s: 'failed' }, billed: 'no', reason: 'seq test', actor: 'evoni' })).ok).toBe(true);
      const { rows: [n] } = await t.su.query(`SELECT (SELECT count(*) FROM aigw_permit_events)::int AS events,
        (SELECT count(*) FROM aigw_reconciliations)::int AS recs, (SELECT count(*) FROM aigw_audit)::int AS audit`);
      expect(n.events).toBe(4);
      expect(n.recs).toBe(1);
      expect(n.audit).toBeGreaterThanOrEqual(3);

      expect(await trustFindings(t)).toEqual([]);
    } finally {
      await t.close();
    }
  });

  test('idempotent, and a no-op where the ledger does not exist', async () => {
    const t = await createAigwTestDb({ poolMax: 1, productionDefaultPrivileges: true, extraMigrations: [followUp] });
    try {
      const before = (await t.su.query(SEQ_ACL, [followUp.SEQUENCES])).rows;
      await followUp.up(t.sequelize.getQueryInterface(), Sequelize);
      expect((await t.su.query(SEQ_ACL, [followUp.SEQUENCES])).rows).toEqual(before);
      await expect(followUp.down(t.sequelize.getQueryInterface(), Sequelize)).resolves.toBeUndefined();
      expect((await t.su.query(SEQ_ACL, [followUp.SEQUENCES])).rows).toEqual(before);

    } finally {
      await t.close();
    }
  });

  test('a database without the ledger: the follow-up does nothing and does not fail', async () => {
    const server = new Client({ connectionString: ADMIN_URL });
    await server.connect();
    const name = `aigw_noledger_${crypto.randomBytes(4).toString('hex')}`;
    await server.query(`CREATE DATABASE ${ident(name)}`);
    const seq = new Sequelize(urlFor(name), { logging: false });
    try {
      await expect(followUp.up(seq.getQueryInterface(), Sequelize)).resolves.toBeUndefined();
      const [[x]] = await seq.query("SELECT count(*)::int AS n FROM pg_class WHERE relname LIKE 'aigw\\_%'");
      expect(x.n).toBe(0);
    } finally {
      await seq.close();
      await server.query('SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()', [name]);
      await server.query(`DROP DATABASE IF EXISTS ${ident(name)}`);
      await server.end();
    }
  });
});
