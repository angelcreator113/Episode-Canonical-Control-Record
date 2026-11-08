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

  test('every way in is closed: PUBLIC, direct grants and grants through a role the application login is a member of (inherited or by SET ROLE); currval too', async () => {
    const t = await createAigwTestDb({ poolMax: 1, productionDefaultPrivileges: true });
    const grp = `aigw_seqgrp_${t.tag}`;
    const app2 = `aigw_seqapp2_${t.tag}`;
    t.roles.seqgrp = grp; // removed with the test's roles at close
    t.roles.seqapp2 = app2;
    try {
      await t.su.query(`CREATE ROLE ${ident(grp)} NOLOGIN`);
      await t.su.query(`CREATE ROLE ${ident(app2)} LOGIN INHERIT PASSWORD '${t.password}'`);
      await t.su.query(`GRANT CONNECT ON DATABASE ${ident(t.dbName)} TO ${ident(app2)}`);
      await t.su.query(`GRANT USAGE ON SCHEMA public TO ${ident(grp)}, ${ident(app2)}`);
      await t.su.query(`GRANT ${ident(grp)} TO ${ident(app2)}, ${ident(t.roles.app)}`);
      for (const s of followUp.SEQUENCES) {
        await t.su.query(`GRANT ALL ON SEQUENCE public.${s} TO PUBLIC`);
        await t.su.query(`GRANT ALL ON SEQUENCE public.${s} TO ${ident(grp)}`);
        await t.su.query(`GRANT ALL ON SEQUENCE public.${s} TO ${ident(t.roles.app)}`);
      }
      const u2 = new URL(t.url('app'));
      u2.username = app2;
      const as = async (url, sqls) => {
        const c = new Client({ connectionString: url });
        await c.connect();
        const out = [];
        try { for (const s of sqls) out.push(await c.query(s).then(() => 'allowed', (e) => e.code)); } finally { await c.end(); }
        return out;
      };
      const probes = (s, viaRole) => [
        ...(viaRole ? [`SET ROLE ${ident(grp)}`] : []),
        `SELECT nextval('public.${s}')`, `SELECT currval('public.${s}')`, `SELECT setval('public.${s}', 1)`, `SELECT last_value FROM public.${s}`];

      // before: every path works
      expect(await as(u2.toString(), probes('aigw_audit_id_seq', false))).toEqual(['allowed', 'allowed', 'allowed', 'allowed']);

      await followUp.up(t.sequelize.getQueryInterface(), Sequelize);

      expect(await nonOwnerSeqGrants(t)).toEqual([]);
      for (const s of followUp.SEQUENCES) {
        // the application login directly, an inheriting member of the group, and the login switching into the group
        expect([s, 'app', await as(t.url('app'), probes(s, false))]).toEqual([s, 'app', ['42501', '42501', '42501', '42501']]);
        expect([s, 'member', await as(u2.toString(), probes(s, false))]).toEqual([s, 'member', ['42501', '42501', '42501', '42501']]);
        expect([s, 'set role', await as(t.url('app'), probes(s, true))]).toEqual([s, 'set role', ['allowed', '42501', '42501', '42501', '42501']]);
        for (const p of ['SELECT', 'USAGE', 'UPDATE']) {
          const { rows: [r] } = await t.su.query(`SELECT has_sequence_privilege($1, $2, $3) AS app, has_sequence_privilege($4, $2, $3) AS member,
            has_sequence_privilege($5, $2, $3) AS grp, has_sequence_privilege($6, $2, $3) AS owner`, [t.roles.app, `public.${s}`, p, app2, grp, t.roles.migrator]);
          expect([s, p, r]).toEqual([s, p, { app: false, member: false, grp: false, owner: true }]);
        }
      }
      // the migration login is not a member of anything the application login holds, and vice versa
      const { rows: [m] } = await t.su.query("SELECT pg_has_role($1, $2, 'MEMBER') AS app_in_owner", [t.roles.app, t.roles.migrator]);
      expect(m.app_in_owner).toBe(false);
    } finally {
      await t.su.query('SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE usename = ANY($1)', [[app2, t.roles.app]]).catch((e) => console.error(`[aigw test] ${e.message}`));
      await t.close();
    }
  });

  test('right after both migrations on a fresh database: the gateway is STOPPED with both caps NULL and empty history', async () => {
    const t = await createAigwTestDb({ poolMax: 1, productionDefaultPrivileges: true, extraMigrations: [followUp] });
    try {
      const { rows: [c] } = await t.su.query('SELECT global_state, version::int AS version, daily_cap_micros, image_daily_cap_micros, changed_by FROM aigw_control');
      expect(c).toEqual({ global_state: 'STOPPED', version: 1, daily_cap_micros: null, image_daily_cap_micros: null, changed_by: 'migration' });
      const { rows: [n] } = await t.su.query(`SELECT (SELECT count(*) FROM aigw_permits)::int AS p, (SELECT count(*) FROM aigw_permit_events)::int AS e,
        (SELECT count(*) FROM aigw_reconciliations)::int AS r, (SELECT count(*) FROM aigw_audit)::int AS a, (SELECT count(*) FROM aigw_operations)::int AS o`);
      expect(n).toEqual({ p: 0, e: 0, r: 0, a: 0, o: 9 });
      const { rows: [v] } = await t.su.query("SELECT current_setting('server_version_num')::int AS v");
      console.log(`[aigw test] PostgreSQL server_version_num ${v.v}`);
    } finally {
      await t.close();
    }
  });

  test('running the follow-up again changes no permission and no data; down changes nothing', async () => {
    const t = await createAigwTestDb({ poolMax: 2, productionDefaultPrivileges: true, extraMigrations: [followUp] });
    try {
      // some history first, so there is data to compare
      const ledger = createPgLedger({ caller: t.port('caller'), gateway: t.port('gateway'), instance: 'gw-seq2', limits: withLimits({ permitTtlMs: 5000 }) });
      const admin = createPgAdmin({ admin: t.port('admin') });
      await admin.setCaps({ dailyMicros: 1000, imageDailyMicros: 1000, actor: 'evoni', reason: 'rerun test' });
      await admin.stop('evoni', 'rerun test');
      expect((await ledger.authorize(anthropicCall({ logicalKey: 'rerun' }).authorizeInput)).code).toBe('STOPPED');
      const state = async () => ({
        acl: (await t.su.query(`SELECT relname, COALESCE(relacl::text, '') AS acl FROM pg_class WHERE relname LIKE 'aigw\\_%' ORDER BY 1`)).rows,
        fnacl: (await t.su.query(`SELECT p.oid::regprocedure::text AS f, COALESCE(p.proacl::text, '') AS acl FROM pg_proc p WHERE p.proname LIKE 'aigw\\_%' ORDER BY 1`)).rows,
        control: (await t.su.query('SELECT * FROM aigw_control')).rows,
        counts: (await t.su.query(`SELECT (SELECT count(*) FROM aigw_permits)::int AS p, (SELECT count(*) FROM aigw_permit_events)::int AS e,
          (SELECT count(*) FROM aigw_audit)::int AS a, (SELECT count(*) FROM aigw_operations)::int AS o`)).rows,
        seq: (await t.su.query(`SELECT 'e' AS s, last_value::text, is_called FROM aigw_permit_events_id_seq UNION ALL
          SELECT 'r', last_value::text, is_called FROM aigw_reconciliations_id_seq UNION ALL SELECT 'a', last_value::text, is_called FROM aigw_audit_id_seq`)).rows,
      });
      const before = await state();
      await followUp.up(t.sequelize.getQueryInterface(), Sequelize);
      expect(await state()).toEqual(before);
      await expect(followUp.down(t.sequelize.getQueryInterface(), Sequelize)).resolves.toBeUndefined();
      expect(await state()).toEqual(before);
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
