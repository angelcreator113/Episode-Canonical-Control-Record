'use strict';

/**
 * AI gateway G2: the least-privilege roles (src/aiGateway/aigwDbGrants.js)
 * on a throwaway database. The privilege matrix the database actually holds
 * equals the grants module, every role is refused what it was not given, and
 * the application login (no aigw grant, or later only aigw_caller) can never
 * reach Stop, Resume, pauses, caps or reconciliation.
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
const { shouldSkip, createAigwTestDb, ident } = require('../helpers/aigwTestDb');
const grants = require('../../src/aiGateway/aigwDbGrants');
const migration = require('../../src/migrations/20261108120000-create-aigw-ledger');
const { anthropicCall, DAY } = require('../unit/aiGateway/_harness');
const { createPgLedger, createPgAdmin } = require('../../src/aiGateway/pgLedger');
const { withLimits } = require('../../src/aiGateway/constants');

const KINDS = ['caller', 'gateway', 'admin', 'inspector', 'app'];
const PROBES = {
  'aigw_authorize(jsonb)': "SELECT public.aigw_authorize('{}'::jsonb)",
  'aigw_get_permit(uuid)': "SELECT public.aigw_get_permit('00000000-0000-4000-8000-000000000000')",
  'aigw_dispatch(uuid, text, text)': "SELECT public.aigw_dispatch('00000000-0000-4000-8000-000000000000', 'x', 'probe')",
  'aigw_abandon_authorized(uuid, text)': "SELECT public.aigw_abandon_authorized('00000000-0000-4000-8000-000000000000', 'probe')",
  'aigw_mark_not_forwarded(uuid, text, text)': "SELECT public.aigw_mark_not_forwarded('00000000-0000-4000-8000-000000000000', 'p', 'probe')",
  'aigw_record_outcome(uuid, jsonb)': "SELECT public.aigw_record_outcome('00000000-0000-4000-8000-000000000000', '{}'::jsonb)",
  'aigw_sweep(interval, integer)': "SELECT public.aigw_sweep(interval '1 hour', 1)",
  'aigw_find_by_task(text, text)': "SELECT public.aigw_find_by_task('x', 'y')",
  'aigw_reconcile(uuid, jsonb)': "SELECT public.aigw_reconcile('00000000-0000-4000-8000-000000000000', '{}'::jsonb)",
  'aigw_exposure(date, text)': `SELECT public.aigw_exposure('${DAY}', NULL)`,
  'aigw_read_control()': 'SELECT public.aigw_read_control()',
  'aigw_stop(text, text)': "SELECT public.aigw_stop('probe', '')",
  'aigw_request_resume(jsonb)': "SELECT public.aigw_request_resume('{}'::jsonb)",
  'aigw_confirm_resume(jsonb)': "SELECT public.aigw_confirm_resume('{}'::jsonb)",
  'aigw_cancel_resume(text, text)': "SELECT public.aigw_cancel_resume('probe', '')",
  'aigw_set_pause(text, boolean, text, text)': "SELECT public.aigw_set_pause('images', true, 'probe', '')",
  'aigw_set_caps(jsonb)': "SELECT public.aigw_set_caps('{}'::jsonb)",
  'aigw_gateway_ack(jsonb)': "SELECT public.aigw_gateway_ack('{}'::jsonb)",
};
const INTERNAL = migration.FUNCTIONS.filter((f) => !(f in PROBES));

(shouldSkip ? describe.skip : describe)('AI gateway G2 roles', () => {
  jest.setTimeout(60000);
  let t;
  const tryAs = async (kind, sql, params) => {
    try {
      await t.pools[kind].query(sql, params);
      return 'allowed';
    } catch (err) {
      return err.code;
    }
  };

  beforeAll(async () => { t = await createAigwTestDb({ poolMax: 2 }); });
  afterAll(async () => { if (t) await t.close(); });

  test('every public function has a probe; every grant names a real function', () => {
    const granted = new Set(Object.values(grants.FUNCTION_GRANTS).flat());
    for (const f of granted) expect(migration.FUNCTIONS).toContain(f);
    for (const f of Object.keys(PROBES)) expect(migration.FUNCTIONS).toContain(f);
    expect(INTERNAL.sort()).toEqual([
      'aigw_actor(text)', 'aigw_append_only_guard()', 'aigw_control_guard()', 'aigw_event(uuid, text, text, text, text)',
      'aigw_exposure_internal(date, text)', 'aigw_permit_json(public.aigw_permits)', 'aigw_permits_guard()', 'aigw_transition_allowed(text, text)',
    ]);
  });

  test('the database holds exactly the grants module\'s EXECUTE matrix', async () => {
    for (const kind of KINDS) {
      const { rows } = await t.su.query(`SELECT p.oid::regprocedure::text AS f FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public' AND p.proname LIKE 'aigw\\_%' AND has_function_privilege($1, p.oid, 'EXECUTE')`, [t.roles[kind]]);
      const expected = kind === 'app' ? [] : grants.FUNCTION_GRANTS[kind].map((f) => f.replace(/\s/g, ''));
      expect(rows.map((r) => r.f.replace(/\s/g, '')).sort()).toEqual([...expected].sort());
    }
  });

  test.each(KINDS.flatMap((k) => Object.keys(PROBES).map((f) => [k, f])))('%s calling %s: allowed only if granted', async (kind, f) => {
    const allowed = kind !== 'app' && grants.FUNCTION_GRANTS[kind].includes(f);
    const res = await tryAs(kind, PROBES[f]);
    if (allowed) expect(res).not.toBe('42501');
    else expect(res).toBe('42501');
  });

  test.each(KINDS.flatMap((k) => INTERNAL.filter((f) => !/guard\(\)$/.test(f) && !/permit_json/.test(f)).map((f) => [k, f])))('%s cannot call the internal %s', async (kind, f) => {
    const calls = {
      'aigw_actor(text)': "SELECT public.aigw_actor('x')",
      'aigw_event(uuid, text, text, text, text)': "SELECT public.aigw_event('00000000-0000-4000-8000-000000000000', NULL, 'authorized', 'x', 'y')",
      'aigw_exposure_internal(date, text)': `SELECT * FROM public.aigw_exposure_internal('${DAY}', NULL)`,
      'aigw_transition_allowed(text, text)': "SELECT public.aigw_transition_allowed('unknown', 'abandoned')",
    };
    expect(await tryAs(kind, calls[f])).toBe('42501');
  });

  test.each(KINDS.flatMap((k) => grants.TABLES.map((tb) => [k, tb])))('%s on %s: only the inspector reads; nobody writes', async (kind, tb) => {
    const read = await tryAs(kind, `SELECT 1 FROM public.${tb} LIMIT 1`);
    expect(read).toBe(kind === 'inspector' ? 'allowed' : '42501');
    for (const sql of [`DELETE FROM public.${tb} WHERE false`, `UPDATE public.${tb} SET created_at = created_at WHERE false`,
      `TRUNCATE public.${tb}`, `INSERT INTO public.${tb} SELECT * FROM public.${tb} WHERE false`]) {
      expect(await tryAs(kind, sql)).toBe('42501');
    }
  });

  test('no role can create objects, change ownership, or set the trusted session flags to effect', async () => {
    for (const kind of KINDS) {
      expect(await tryAs(kind, `CREATE TABLE public.aigw_probe_${kind} (id int)`)).toBe('42501');
      expect(await tryAs(kind, 'ALTER TABLE public.aigw_permits DISABLE TRIGGER aigw_permits_row_guard')).toBe('42501');
    }
    // a session flag a caller sets does not let it past the guards: it has no table access at all
    const c = new Client({ connectionString: t.url('gateway') });
    await c.connect();
    try {
      await c.query('BEGIN');
      await c.query("SELECT set_config('aigw.reconcile', 'on', true), set_config('aigw.not_sent_proof', 'proven', true)");
      await expect(c.query("UPDATE public.aigw_permits SET billed = 'no'")).rejects.toMatchObject({ code: '42501' });
      await c.query('ROLLBACK');
    } finally {
      await c.end();
    }
  });

  test('the owner role cannot log in and nobody is a member of it', async () => {
    const { rows } = await t.su.query('SELECT rolcanlogin FROM pg_roles WHERE rolname = $1', [t.roles.owner]);
    expect(rows).toEqual([{ rolcanlogin: false }]);
    const { rows: members } = await t.su.query('SELECT 1 FROM pg_auth_members m JOIN pg_roles r ON r.oid = m.roleid WHERE r.rolname = $1', [t.roles.owner]);
    expect(members).toEqual([]);
    const { rows: owned } = await t.su.query(`SELECT DISTINCT pg_get_userbyid(relowner) AS o FROM pg_class WHERE relname LIKE 'aigw\\_%' AND relkind = 'r'
      UNION SELECT DISTINCT pg_get_userbyid(proowner) FROM pg_proc WHERE proname LIKE 'aigw\\_%'`);
    expect(owned).toEqual([{ o: t.roles.owner }]);
  });

  test('the application login, even made a member of the caller role (the G3 shape), cannot stop, resume, set caps, pause or reconcile', async () => {
    const app2 = `aigw_app2_${t.tag}`;
    await t.su.query(`CREATE ROLE ${ident(app2)} LOGIN INHERIT PASSWORD '${t.password}'`);
    await t.su.query(`GRANT CONNECT ON DATABASE ${ident(t.dbName)} TO ${ident(app2)}`);
    await t.su.query(`GRANT ${ident(t.roles.caller)} TO ${ident(app2)}`);
    const u = new URL(t.url('caller'));
    u.username = app2;
    const c = new Client({ connectionString: u.toString() });
    await c.connect();
    const run = async (sql) => c.query(sql).then(() => 'allowed', (err) => err.code);
    try {
      expect(await run(PROBES['aigw_read_control()'])).toBe('allowed');
      expect(await run(PROBES['aigw_authorize(jsonb)'])).toBe('allowed');
      for (const f of grants.ADMIN_ONLY) expect([f, await run(PROBES[f])]).toEqual([f, '42501']);
      for (const f of ['aigw_dispatch(uuid, text, text)', 'aigw_record_outcome(uuid, jsonb)', 'aigw_mark_not_forwarded(uuid, text, text)', 'aigw_sweep(interval, integer)']) {
        expect([f, await run(PROBES[f])]).toEqual([f, '42501']);
      }
    } finally {
      await c.end();
      await t.su.query('SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE usename = $1', [app2]);
      await t.su.query(`REVOKE ${ident(t.roles.caller)} FROM ${ident(app2)}`);
      await t.su.query(`REVOKE CONNECT ON DATABASE ${ident(t.dbName)} FROM ${ident(app2)}`);
      await t.su.query(`DROP ROLE ${ident(app2)}`);
    }
  });

  test('the hand-run role file applies cleanly to a throwaway database and leaves the same matrix (test server only)', async () => {
    const fixed = [grants.OWNER_ROLE, ...Object.values(grants.ROLES)];
    const { rows: present } = await t.su.query('SELECT rolname FROM pg_roles WHERE rolname = ANY($1)', [fixed]);
    if (present.length > 0) {
      console.warn(`[aigw test] skipping the role-file run: ${present.map((r) => r.rolname).join(', ')} already exist on this server`);
      return;
    }
    const fresh = await createAigwTestDb({ poolMax: 1, ownership: false });
    const sqlText = fs.readFileSync(path.join(__dirname, '../../scripts/aigw/sql/aigw-roles.sql'), 'utf8')
      .split('\n').filter((l) => !l.trim().startsWith('\\')).join('\n');
    try {
      await fresh.su.query(sqlText); // one simple-protocol call: BEGIN ... COMMIT as written
      for (const kind of ['caller', 'gateway', 'admin', 'inspector']) {
        const { rows } = await fresh.su.query(`SELECT p.oid::regprocedure::text AS f FROM pg_proc p
          WHERE p.proname LIKE 'aigw\\_%' AND has_function_privilege($1, p.oid, 'EXECUTE')`, [grants.ROLES[kind]]);
        expect(rows.map((r) => r.f.replace(/\s/g, '')).sort()).toEqual(grants.FUNCTION_GRANTS[kind].map((f) => f.replace(/\s/g, '')).sort());
      }
      const { rows: owners } = await fresh.su.query(`SELECT DISTINCT pg_get_userbyid(relowner) AS o FROM pg_class WHERE relname LIKE 'aigw\\_%' AND relkind = 'r'
        UNION SELECT DISTINCT pg_get_userbyid(proowner) FROM pg_proc WHERE proname LIKE 'aigw\\_%'`);
      expect(owners).toEqual([{ o: grants.OWNER_ROLE }]);
      const { rows: members } = await fresh.su.query('SELECT 1 FROM pg_auth_members m JOIN pg_roles r ON r.oid = m.roleid WHERE r.rolname = $1', [grants.OWNER_ROLE]);
      expect(members).toEqual([]);
      const { rows: logins } = await fresh.su.query('SELECT rolname FROM pg_roles WHERE rolname = ANY($1) AND rolcanlogin', [fixed]);
      expect(logins).toEqual([]);
      // a second run fails as a whole (the roles exist) and changes nothing
      await expect(fresh.su.query(sqlText)).rejects.toMatchObject({ code: '42710' });
      await fresh.su.query('ROLLBACK');
    } finally {
      await fresh.close();
      for (const r of fixed) await t.su.query(`DROP ROLE IF EXISTS ${ident(r)}`).catch((err) => console.error(`[aigw test] could not drop ${r}: ${err.message}`));
    }
  });

  test('a full flow works through the roles, and the history names each database login', async () => {
    const ledger = createPgLedger({ caller: t.port('caller'), gateway: t.port('gateway'), instance: 'gw-roles', limits: withLimits({ permitTtlMs: 5000 }) });
    const admin = createPgAdmin({ admin: t.port('admin') });
    await admin.setCaps({ dailyMicros: 100_000, imageDailyMicros: 100_000, actor: 'evoni', reason: 'roles' });
    const challengeId = crypto.randomUUID();
    const nonceHash = crypto.createHash('sha256').update('roles').digest('hex');
    const r = await admin.requestResume({ actor: 'evoni', reason: 'roles', challengeId, nonceHash, ttlSeconds: 60 });
    expect((await admin.confirmResume({ actor: 'evoni', challengeId, nonceHash, targetVersion: r.target_version })).ok).toBe(true);
    const a = await ledger.authorize(anthropicCall({ logicalKey: 'roles-flow' }).authorizeInput);
    expect(a.ok).toBe(true);
    expect((await ledger.dispatch(a.permit.id, { operation: 'anthropic.messages' })).ok).toBe(true);
    expect((await ledger.recordOutcome(a.permit.id, { phase: 'succeeded', billed: 'yes', confirmedMicros: 900 })).ok).toBe(true);
    const ev = await t.pools.inspector.query('SELECT actor FROM public.aigw_permit_events WHERE permit_id = $1 ORDER BY id', [a.permit.id]);
    expect(ev.rows.map((x) => x.actor.split(' via ')[1])).toEqual([t.roles.caller, t.roles.gateway, t.roles.gateway]);
    const audit = await t.pools.inspector.query("SELECT actor FROM public.aigw_audit WHERE action = 'set_caps'");
    expect(audit.rows[0].actor).toBe(`evoni via ${t.roles.admin}`);
  });
});
