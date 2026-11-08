'use strict';

/**
 * AI gateway G2: transaction lock ordering and concurrency, on a throwaway
 * database, with real separate processes (tests/helpers/aigwChild.js).
 *
 * Lock order: L1 control row -> L2 logical-key advisory lock -> L3 day
 * advisory lock -> L4 permit rows (several only in id order, SKIP LOCKED).
 *
 *   P1-P3  ordering, observed in pg_stat_activity: a Stop or a pause waits
 *          for an authorization or dispatch in progress and vice versa; a
 *          logical key and a day decide one at a time
 *   P4     20 processes against a cap for 7: exactly 7 authorized
 *   P5     10 processes dispatch one permit: exactly one dispatch
 *   P6     a Stop at a random moment among concurrent authorize + dispatch:
 *          nothing authorized or dispatched at or after the Stop's version
 *   P7     one logical key from 10 processes: exactly one permit
 *   chaos  authorize, dispatch, outcomes, cleanup, reconciliation, Stop,
 *          Resume, pauses and acknowledgements together: no deadlock, no
 *          lock timeout, and every safety invariant holds over the history
 */

const crypto = require('crypto');
const path = require('path');
const { execFile } = require('child_process');
const { Client } = require('pg');
const { shouldSkip, createAigwTestDb } = require('../helpers/aigwTestDb');
const { createPgAdmin } = require('../../src/aiGateway/pgLedger');

const CHILD = path.join(__dirname, '../helpers/aigwChild.js');
const DAY = '2026-11-08';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function runChild(spec) {
  return new Promise((resolve, reject) => {
    execFile(process.execPath, [CHILD, JSON.stringify(spec)], { timeout: 60000, env: { PATH: process.env.PATH } }, (err, stdout, stderr) => {
      const line = String(stdout).trim().split('\n').pop();
      try {
        const out = JSON.parse(line);
        if (out.fatal) reject(new Error(`child failed: ${out.fatal} ${stderr}`));
        else resolve(out);
      } catch (e) {
        reject(new Error(`child output unreadable (${err ? err.message : 'no error'}): ${stdout} ${stderr}`));
      }
    });
  });
}

const allErrors = (outs) => outs.reduce((acc, o) => {
  for (const [k, v] of Object.entries(o.errors)) acc[k] = (acc[k] || 0) + v;
  return acc;
}, {});

(shouldSkip ? describe.skip : describe)('AI gateway G2 concurrency', () => {
  jest.setTimeout(180000);
  let t;
  let admin;
  const urls = (...kinds) => Object.fromEntries(kinds.map((k) => [k, t.url(k)]));

  async function release() {
    const challengeId = crypto.randomUUID();
    const nonceHash = crypto.createHash('sha256').update(challengeId).digest('hex');
    const r = await admin.requestResume({ actor: 'evoni', reason: 'test', challengeId, nonceHash, ttlSeconds: 60 });
    if (r.ok) await admin.confirmResume({ actor: 'evoni', challengeId, nonceHash, targetVersion: r.target_version });
    expect((await admin.readControl()).global_state).toBe('RELEASED');
  }
  // the backend pid is read at connect time: a client waiting on a lock cannot answer
  const pids = new WeakMap();
  async function clientAs(kind) {
    const c = new Client({ connectionString: t.url(kind) });
    await c.connect();
    pids.set(c, (await c.query('SELECT pg_backend_pid() AS p')).rows[0].p);
    return c;
  }
  const pidOf2 = async (c) => pids.get(c);
  async function waitingOn(pid, kind = 'Lock') {
    for (let i = 0; i < 100; i += 1) {
      const { rows } = await t.su.query('SELECT wait_event_type, wait_event FROM pg_stat_activity WHERE pid = $1', [pid]);
      if (rows[0] && rows[0].wait_event_type === kind) return rows[0].wait_event;
      await sleep(20);
    }
    return null;
  }
  const mk = (key, extra = {}) => JSON.stringify({
    secret_hash: crypto.randomBytes(32).toString('hex'), caller_class: 'api', caller_instance: 'p', provider: 'anthropic',
    operation: 'anthropic.messages', body_kind: 'json', model: 'm', logical_key: key, attempt: 1, estimate_micros: 100,
    reservation_day: DAY, ttl_ms: 30000, body_sha256: 'f'.repeat(64), body_bytes: 1, billing_fields: { model: 'm' },
    billing_fields_canonical: '{"model":"m"}', ...extra,
  });

  beforeAll(async () => {
    t = await createAigwTestDb({ poolMax: 4 });
    admin = createPgAdmin({ admin: t.port('admin') });
    await admin.setCaps({ dailyMicros: 1_000_000_000, imageDailyMicros: 1_000_000_000, actor: 'evoni', reason: 'concurrency' });
    await release();
  });
  afterAll(async () => { if (t) await t.close(); });

  describe('P1-P3: lock ordering, observed', () => {
    test('P1: a Stop and a pause wait for an authorization in progress (L1 FOR SHARE); the permit carries the old version and dispatch then refuses', async () => {
      const caller = await clientAs('caller');
      const adminC = await clientAs('admin');
      try {
        const v0 = (await admin.readControl()).version;
        await caller.query('BEGIN');
        const a = (await caller.query('SELECT public.aigw_authorize($1::jsonb) AS r', [mk('p1')])).rows[0].r;
        expect(a).toMatchObject({ ok: true, authorized_version: v0 });
        // a pause (a plain UPDATE) must wait too: the FOR SHARE lock, not FOR KEY SHARE
        const pause = adminC.query("SELECT public.aigw_set_pause('writing', true, 'evoni', 'p1') AS r");
        expect(await waitingOn(await pidOf2(adminC))).toMatch(/^(transactionid|tuple)$/);
        await caller.query('COMMIT');
        expect((await pause).rows[0].r.ok).toBe(true);
        await admin.setPause('writing', false, 'evoni', 'p1 undo');
        // the same for a Stop
        await caller.query('BEGIN');
        const b = (await caller.query('SELECT public.aigw_authorize($1::jsonb) AS r', [mk('p1b')])).rows[0].r;
        expect(b.ok).toBe(true);
        const stop = adminC.query("SELECT public.aigw_stop('evoni', 'p1') AS r");
        expect(await waitingOn(await pidOf2(adminC))).toMatch(/^(transactionid|tuple)$/);
        await caller.query('COMMIT');
        const s = (await stop).rows[0].r;
        expect(s.version).toBeGreaterThan(b.authorized_version);
        const d = (await t.pools.gateway.query("SELECT public.aigw_dispatch($1::uuid, 'anthropic.messages', 'gw') AS r", [b.permit_id])).rows[0].r;
        expect(d.code).toBe('STOPPED');
      } finally {
        await caller.end();
        await adminC.end();
        await release();
      }
    });

    test('P2: an authorization waits for a Stop in progress, then refuses', async () => {
      const caller = await clientAs('caller');
      const adminC = await clientAs('admin');
      try {
        await adminC.query('BEGIN');
        await adminC.query("SELECT public.aigw_stop('evoni', 'p2')");
        const auth = caller.query('SELECT public.aigw_authorize($1::jsonb) AS r', [mk('p2')]);
        expect(await waitingOn(await pidOf2(caller))).toMatch(/^(transactionid|tuple)$/);
        await adminC.query('COMMIT');
        expect((await auth).rows[0].r.code).toBe('STOPPED');
      } finally {
        await caller.end();
        await adminC.end();
        await release();
      }
    });

    test('P3: a dispatch waits for a Stop in progress and then refuses (not_sent); a Stop waits for a dispatch in progress', async () => {
      const gw = await clientAs('gateway');
      const adminC = await clientAs('admin');
      try {
        const id1 = (await t.pools.caller.query('SELECT public.aigw_authorize($1::jsonb) AS r', [mk('p3a')])).rows[0].r.permit_id;
        const id2 = (await t.pools.caller.query('SELECT public.aigw_authorize($1::jsonb) AS r', [mk('p3b')])).rows[0].r.permit_id;
        // dispatch in progress: Stop waits; the dispatch carries the pre-Stop version
        await gw.query('BEGIN');
        const d1 = (await gw.query("SELECT public.aigw_dispatch($1::uuid, 'anthropic.messages', 'gw') AS r", [id1])).rows[0].r;
        expect(d1.ok).toBe(true);
        const stop = adminC.query("SELECT public.aigw_stop('evoni', 'p3') AS r");
        expect(await waitingOn(await pidOf2(adminC))).toMatch(/^(transactionid|tuple)$/);
        await gw.query('COMMIT');
        expect((await stop).rows[0].r.version).toBeGreaterThan(d1.dispatch_version);
        await release();
        // Stop in progress: the dispatch waits, then refuses and the permit is not_sent
        await adminC.query('BEGIN');
        await adminC.query("SELECT public.aigw_stop('evoni', 'p3b')");
        const d2 = gw.query("SELECT public.aigw_dispatch($1::uuid, 'anthropic.messages', 'gw') AS r", [id2]);
        expect(await waitingOn(await pidOf2(gw))).toMatch(/^(transactionid|tuple)$/);
        await adminC.query('COMMIT');
        expect((await d2).rows[0].r.code).toBe('STOPPED');
        const { rows } = await t.su.query('SELECT phase FROM aigw_permits WHERE id = $1', [id2]);
        expect(rows[0].phase).toBe('not_sent');
      } finally {
        await gw.end();
        await adminC.end();
        await release();
      }
    });

    test('L2 and L3: one decision at a time per logical key, then per day; different days do not wait', async () => {
      const c1 = await clientAs('caller');
      const c2 = await clientAs('caller');
      try {
        await c1.query('BEGIN');
        expect((await c1.query('SELECT public.aigw_authorize($1::jsonb) AS r', [mk('lk')])).rows[0].r.ok).toBe(true);
        const same = c2.query('SELECT public.aigw_authorize($1::jsonb) AS r', [mk('lk', { attempt: 2 })]);
        expect(await waitingOn(await pidOf2(c2))).toBe('advisory');
        await c1.query('COMMIT');
        expect((await same).rows[0].r.code).toBe('PRIOR_ATTEMPT_NOT_RETRYABLE');

        await c1.query('BEGIN');
        expect((await c1.query('SELECT public.aigw_authorize($1::jsonb) AS r', [mk('day-a')])).rows[0].r.ok).toBe(true);
        const sameDay = c2.query('SELECT public.aigw_authorize($1::jsonb) AS r', [mk('day-b')]);
        expect(await waitingOn(await pidOf2(c2))).toBe('advisory');
        await c1.query('COMMIT');
        expect((await sameDay).rows[0].r.ok).toBe(true);

        await c1.query('BEGIN');
        expect((await c1.query('SELECT public.aigw_authorize($1::jsonb) AS r', [mk('day-c')])).rows[0].r.ok).toBe(true);
        const otherDay = await c2.query('SELECT public.aigw_authorize($1::jsonb) AS r', [mk('day-d', { reservation_day: '2026-11-09' })]);
        expect(otherDay.rows[0].r.ok).toBe(true); // returned while c1 still holds its locks
        await c1.query('COMMIT');
      } finally {
        await c1.end();
        await c2.end();
      }
    });
  });

  test('P4: 20 processes, cap for 7: exactly 7 authorized, the rest DAILY_CAP; exposure is 7 x the estimate', async () => {
    const day = '2026-12-01';
    await admin.setCaps({ dailyMicros: 7000, imageDailyMicros: 7000, actor: 'evoni', reason: 'P4' });
    const startAt = Date.now() + 1500;
    const outs = await Promise.all(Array.from({ length: 20 }, (_x, i) => runChild({
      urls: urls('caller'), startAt, day, scenario: 'authorize', payloads: [{ key: `p4-${i}`, est: 1000, day }],
    })));
    const results = outs.flatMap((o) => o.results);
    expect(allErrors(outs)).toEqual({});
    expect(results.filter((r) => r.ok)).toHaveLength(7);
    expect(results.filter((r) => r.code === 'DAILY_CAP')).toHaveLength(13);
    expect(await admin.exposure(day)).toMatchObject({ reserved: 7000, exposure: 7000 });
    await admin.setCaps({ dailyMicros: 1_000_000_000, imageDailyMicros: 1_000_000_000, actor: 'evoni', reason: 'P4 done' });
  });

  test('P5: 10 processes dispatch one permit at once: exactly one dispatch', async () => {
    const id = (await t.pools.caller.query('SELECT public.aigw_authorize($1::jsonb) AS r', [mk('p5')])).rows[0].r.permit_id;
    const startAt = Date.now() + 1500;
    const outs = await Promise.all(Array.from({ length: 10 }, () => runChild({ urls: urls('gateway'), startAt, scenario: 'dispatch', ids: [id] })));
    const results = outs.flatMap((o) => o.results);
    expect(allErrors(outs)).toEqual({});
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(results.filter((r) => r.code === 'PERMIT_USED')).toHaveLength(9);
    const { rows } = await t.su.query("SELECT count(*)::int AS n FROM aigw_permit_events WHERE permit_id = $1 AND to_phase = 'dispatching'", [id]);
    expect(rows[0].n).toBe(1);
  });

  test('P6: a Stop at a random moment among concurrent authorize + dispatch: nothing authorized or dispatched at or after its version', async () => {
    for (const seed of [11, 23, 37]) {
      await release();
      const startAt = Date.now() + 1500;
      const flows = Array.from({ length: 6 }, (_x, i) => runChild({
        urls: urls('caller', 'gateway'), startAt, day: DAY, scenario: 'flow', prefix: `p6-${seed}-${i}`, durationMs: 1200, seed: seed * 100 + i, dispatchDelayMs: 20,
      }));
      const stopper = runChild({ urls: urls('admin'), startAt, scenario: 'stopper', maxDelayMs: 900, seed });
      const [stopOut, ...flowOuts] = await Promise.all([stopper, ...flows]);
      expect(allErrors([stopOut, ...flowOuts])).toEqual({});
      const stopVersion = stopOut.results[0].version;
      const { rows: late } = await t.su.query(
        `SELECT count(*)::int AS n FROM aigw_permits WHERE logical_key LIKE $1 AND (authorized_version >= $2 OR dispatch_version >= $2)`,
        [`p6-${seed}-%`, stopVersion]);
      expect(late[0].n).toBe(0);
      const disp = flowOuts.flatMap((o) => o.results).filter((r) => r.step === 'dispatch');
      expect(disp.some((r) => r.ok)).toBe(true); // the race really happened on both sides
      expect(disp.filter((r) => r.ok).every((r) => r.version < stopVersion)).toBe(true);
      const after = flowOuts.flatMap((o) => o.results).filter((r) => r.step === 'authorize' && !r.ok);
      expect(after.every((r) => r.code === 'STOPPED')).toBe(true);
    }
    await release();
  });

  test('P7: one logical key from 10 processes (same and different attempts): exactly one permit, no unique-violation error', async () => {
    const startAt = Date.now() + 1500;
    const outs = await Promise.all(Array.from({ length: 10 }, (_x, i) => runChild({
      urls: urls('caller'), startAt, day: DAY, scenario: 'authorize', payloads: [{ key: 'p7', attempt: (i % 3) + 1 }],
    })));
    const results = outs.flatMap((o) => o.results);
    expect(allErrors(outs)).toEqual({});
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    for (const r of results.filter((x) => !x.ok)) expect(['ATTEMPT_EXISTS', 'PRIOR_ATTEMPT_NOT_RETRYABLE']).toContain(r.code);
    const { rows } = await t.su.query("SELECT count(*)::int AS n FROM aigw_permits WHERE logical_key = 'p7'");
    expect(rows[0].n).toBe(1);
  });

  test('chaos: authorize, dispatch, outcomes, cleanup, reconciliation, Stop/Resume, pauses and acks together: no deadlock, every invariant holds', async () => {
    await release();
    const startAt = Date.now() + 2000;
    const durationMs = 4000;
    const outs = await Promise.all([
      ...Array.from({ length: 6 }, (_x, i) => runChild({
        urls: urls('caller', 'gateway'), startAt, day: DAY, scenario: 'flow', prefix: `chaos-${i}`, durationMs, seed: 500 + i, ttlMs: 1000, dispatchDelayMs: 40,
      })),
      runChild({ urls: urls('gateway'), startAt, scenario: 'sweeper', durationMs, timeoutMs: 300, everyMs: 25 }),
      runChild({ urls: urls('gateway'), startAt, scenario: 'sweeper', durationMs, timeoutMs: 300, everyMs: 35 }),
      runChild({ urls: urls('admin', 'inspector'), startAt, scenario: 'reconciler', durationMs, seed: 77 }),
      runChild({ urls: urls('admin', 'gateway'), startAt, scenario: 'toggler', durationMs, seed: 99, everyMs: 60 }),
    ]);
    const errors = allErrors(outs);
    expect(errors).toEqual({}); // no 40P01 deadlock, no 55P03 lock timeout, nothing unexpected
    const steps = outs.flatMap((o) => o.results);
    expect(steps.filter((s) => s.step === 'dispatch' && s.ok).length).toBeGreaterThan(5);
    expect(steps.filter((s) => s.step === 'sweep' && s.unknown > 0).length).toBeGreaterThan(0);
    expect(steps.filter((s) => s.step === 'reconcile' && s.ok).length).toBeGreaterThan(0);
    expect(steps.filter((s) => s.step === 'stop').length).toBeGreaterThan(0);

    // Invariants over the recorded history.
    // 1. the state at every version, from the audit trail
    const { rows: audit } = await t.su.query("SELECT action, target_id, after FROM aigw_audit WHERE after ? 'version' ORDER BY id");
    const stateAt = new Map();
    let st = { state: 'STOPPED', paused: { images: false, writing: false, video: false, voice: false } }; // the seed
    const { rows: [ctl0] } = await t.su.query('SELECT min(authorized_version) AS v FROM aigw_permits');
    expect(ctl0.v).not.toBeNull();
    for (const a of audit) {
      st = { state: st.state, paused: { ...st.paused } };
      if (a.action === 'stop') st.state = 'STOPPED';
      if (a.action === 'resume_requested') st.state = 'RESUME_PENDING';
      if (a.action === 'resume_confirmed') st.state = 'RELEASED';
      if (a.action === 'resume_cancelled') st.state = 'STOPPED';
      if (a.action === 'pause') st.paused[a.target_id] = true;
      if (a.action === 'unpause') st.paused[a.target_id] = false;
      stateAt.set(Number(a.after.version), st);
    }
    const allowedAt = (v, service) => {
      const s = stateAt.get(Number(v));
      return Boolean(s) && s.state === 'RELEASED' && !s.paused[service];
    };
    const { rows: permits } = await t.su.query("SELECT id, service, phase, authorized_version, dispatch_version FROM aigw_permits WHERE logical_key LIKE 'chaos-%'");
    expect(permits.length).toBeGreaterThan(20);
    for (const p of permits) {
      // 2. authorized and dispatched only at a version where submissions were allowed
      expect([p.id, 'authorized', allowedAt(p.authorized_version, p.service)]).toEqual([p.id, 'authorized', true]);
      if (p.dispatch_version != null) expect([p.id, 'dispatched', allowedAt(p.dispatch_version, p.service)]).toEqual([p.id, 'dispatched', true]);
    }
    // 3. every history is a legal path; a dispatched request never became not_sent
    //    here (no proof was given), and unknown left only by reconciliation
    const { rows: events } = await t.su.query(`SELECT e.permit_id, e.from_phase, e.to_phase, e.cause FROM aigw_permit_events e
      JOIN aigw_permits p ON p.id = e.permit_id WHERE p.logical_key LIKE 'chaos-%' ORDER BY e.id`);
    const last = new Map();
    for (const e of events) {
      expect(e.from_phase).toBe(last.has(e.permit_id) ? last.get(e.permit_id) : null);
      last.set(e.permit_id, e.to_phase);
      expect(e.from_phase === 'dispatching' && e.to_phase === 'not_sent').toBe(false);
      if (e.from_phase === 'unknown') expect(e.cause).toBe('reconcile');
    }
    for (const p of permits) expect(last.get(p.id)).toBe(p.phase);
    // 4. no permit is left dispatching past the sweep, and none was ever reset
    const { rows: dup } = await t.su.query("SELECT permit_id FROM aigw_permit_events WHERE to_phase = 'dispatching' GROUP BY permit_id HAVING count(*) > 1");
    expect(dup).toEqual([]);
  });
});
