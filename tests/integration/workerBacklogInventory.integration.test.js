/**
 * Issue #3714 Phase 1: the backlog inventory (scripts/worker/backlog-inventory.js)
 * end to end, on the local migrated test database only (it skips unless the
 * URL names episode_metadata_test and is not RDS), connecting as a role with
 * exactly the worker's grants through a mode-600 credential file, and on a
 * throwaway local redis-server (skipped when redis-server is not installed).
 *
 *   - fixture jobs of every shape are classified as the worker would treat
 *     them (would run, re-queued by recovery, failed by recovery, never
 *     claimed; legacy, uncertain paid, stale cascade, target gone);
 *   - failed jobs' errors come back without URLs or tokens; spend is summed;
 *   - nothing changes: every row of generation_jobs, scene_sets,
 *     scene_angles and ai_usage_logs hashes the same before and after; the
 *     session refuses a write (25006);
 *   - Redis: the Bull keys' contents are identical before and after, and the
 *     server saw only AUTH, PING, LLEN, ZCARD, SCARD and EXISTS;
 *   - neither the database nor the Redis password appears in the output.
 */
jest.unmock('uuid');

const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const net = require('net');
const { spawn, execFileSync } = require('child_process');
const { Client } = require('pg');
const grants = require('../../src/workers/workerDbGrants');
const inventory = require('../../scripts/worker/backlog-inventory');

const ADMIN_URL = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL || '';
const shouldSkip = !ADMIN_URL || ADMIN_URL.includes('amazonaws.com') || !ADMIN_URL.includes('episode_metadata_test');
let redisServerBin = null;
try { redisServerBin = execFileSync('sh', ['-c', 'command -v redis-server'], { encoding: 'utf8' }).trim() || null; } catch { redisServerBin = null; }

const tag = crypto.randomBytes(4).toString('hex');
const ROLE = `ew_inv_${tag}`;
const PASSWORD = `pw-${crypto.randomBytes(12).toString('hex')}`;
const REDIS_PASSWORD = `rp-${crypto.randomBytes(12).toString('hex')}`;
const ROUTE = `backlog-inventory-${tag}`;
const uuid = () => crypto.randomUUID();
const ident = (s) => `"${s.replace(/"/g, '""')}"`;
const dbName = () => new URL(ADMIN_URL).pathname.replace(/^\//, '');
const TABLES = ['generation_jobs', 'scene_sets', 'scene_angles', 'ai_usage_logs'];

(shouldSkip ? describe.skip : describe)('#3714 Phase 1: the read-only backlog inventory', () => {
  jest.setTimeout(60000);
  let admin;
  let dir;
  const ids = { sets: [], angles: [], jobs: {} };

  async function seedSet(fields = {}) {
    const id = uuid();
    ids.sets.push(id);
    await admin.query(`INSERT INTO scene_sets (id, name, scene_type, generation_status, base_still_url, deleted_at, created_at, updated_at)
      VALUES ($1, $2, 'HOME_BASE', $3, $4, $5, NOW(), $6)`,
    [id, `Inventory ${tag}`, fields.status || 'complete', fields.base || null, fields.deleted ? new Date() : null, fields.updatedAt || new Date()]);
    return id;
  }
  async function seedAngle(setId, fields = {}) {
    const id = uuid();
    ids.angles.push(id);
    await admin.query(`INSERT INTO scene_angles (id, scene_set_id, angle_name, angle_label, generation_status, still_image_url, created_at, updated_at)
      VALUES ($1, $2, 'Wide', 'WIDE', $3, $4, NOW(), NOW())`, [id, setId, fields.status || 'complete', fields.still || null]);
    return id;
  }
  async function seedJob(key, f) {
    const id = uuid();
    ids.jobs[key] = id;
    await admin.query(`INSERT INTO generation_jobs (id, job_type, status, scene_set_id, scene_angle_id, payload, attempts, max_attempts, priority,
        error, started_at, completed_at, deleted_at, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 0, $9, $10, $11, $12, NOW() - make_interval(mins => $13), NOW())`,
    [id, f.type, f.status, f.setId, f.angleId || null, f.payload || {}, f.attempts || 0, f.max || 1,
      f.error || null, f.status === 'processing' ? new Date() : null, ['failed', 'completed'].includes(f.status) ? new Date() : null,
      f.deleted ? new Date() : null, f.ageMin || 5]);
    return id;
  }
  const tableHash = async () => {
    const out = {};
    for (const t of TABLES) out[t] = (await admin.query(`SELECT count(*)::int AS n, md5(coalesce(string_agg(x::text, '|' ORDER BY x.id), '')) AS h FROM ${t} x`)).rows[0];
    return out;
  };

  beforeAll(async () => {
    admin = new Client({ connectionString: ADMIN_URL });
    await admin.connect();
    await admin.query(`CREATE ROLE ${ident(ROLE)} LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS CONNECTION LIMIT ${grants.CONNECTION_LIMIT} PASSWORD '${PASSWORD}'`);
    await admin.query(`REVOKE ALL ON DATABASE ${ident(dbName())} FROM ${ident(ROLE)}`);
    for (const sql of grants.grantStatements(ROLE, dbName())) await admin.query(sql);

    const set = await seedSet({ base: 'https://example.invalid/base.jpg' });
    const angle = await seedAngle(set, { still: 'https://example.invalid/a.jpg' });
    const deletedSet = await seedSet({ deleted: true });
    const liveClaimSet = await seedSet({ status: 'generating' });
    await seedJob('videoQueued', { type: 'generate_angle_video', status: 'queued', setId: set, angleId: angle });
    await seedJob('legacyBase', { type: 'generate_base', status: 'queued', setId: set, max: 3 });
    await seedJob('cascadeProcessing', { type: 'cascade_regenerate', status: 'processing', setId: liveClaimSet, attempts: 1, max: 1 });
    await seedJob('legacyProcessing', { type: 'generate_angle', status: 'processing', setId: set, angleId: angle, attempts: 1, max: 3 });
    await seedJob('exhausted', { type: 'generate_angle_video', status: 'queued', setId: set, angleId: angle, attempts: 1, max: 1 });
    await seedJob('staleCascade', { type: 'cascade_regenerate', status: 'queued', setId: set, payload: { force: true, overrides: { mood: 'x' } }, ageMin: 3 * 24 * 60 });
    await seedJob('missingSet', { type: 'cascade_regenerate', status: 'queued', setId: uuid() });
    await seedJob('deletedSet', { type: 'cascade_regenerate', status: 'queued', setId: deletedSet });
    await seedJob('failed', { type: 'generate_angle_video', status: 'failed', setId: set, angleId: angle, attempts: 1, max: 1,
      error: 'Runway poll failed: https://api.dev.runwayml.com/v1/tasks/abc?key=SECRETVALUE Bearer sk-live-0123456789abcdefghijkl' });
    await seedJob('completed', { type: 'generate_angle_video', status: 'completed', setId: set, angleId: angle, attempts: 1, max: 1 });
    await seedJob('softDeleted', { type: 'generate_angle_video', status: 'queued', setId: set, angleId: angle, deleted: true });
    await admin.query(`INSERT INTO ai_usage_logs (route_name, model_name, cost_usd, is_error, provider, billing_unit, billed_units, created_at)
      VALUES ($1, 'flux-pro', 0.05, false, 'fal', 'image', 1, NOW()), ($1, 'gen3a_turbo', NULL, false, 'runway', 'video', 1, NOW()),
             ($1, 'claude-sonnet-4-6', 0.01, false, 'anthropic', NULL, NULL, NOW())`, [ROUTE]);

    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ew-inv-'));
    fs.writeFileSync(path.join(dir, 'worker-db.env'), `WORKER_DB_USER=${ROLE}\nWORKER_DB_PASSWORD=${PASSWORD}\n`, { mode: 0o600 });
  });

  afterAll(async () => {
    if (dir) fs.rmSync(dir, { recursive: true, force: true });
    if (admin) {
      await admin.query('DELETE FROM generation_jobs WHERE id = ANY($1::uuid[])', [Object.values(ids.jobs)]);
      await admin.query('DELETE FROM scene_angles WHERE id = ANY($1::uuid[])', [ids.angles]);
      await admin.query('DELETE FROM scene_sets WHERE id = ANY($1::uuid[])', [ids.sets]);
      await admin.query('DELETE FROM ai_usage_logs WHERE route_name = $1', [ROUTE]);
      await admin.query('SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE usename = $1', [ROLE]);
      for (const sql of [`REVOKE ALL ON ALL TABLES IN SCHEMA public FROM ${ident(ROLE)}`, `REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM ${ident(ROLE)}`,
        `REVOKE ALL ON SCHEMA public FROM ${ident(ROLE)}`, `REVOKE ALL ON DATABASE ${ident(dbName())} FROM ${ident(ROLE)}`, `DROP ROLE IF EXISTS ${ident(ROLE)}`]) {
        await admin.query(sql).catch((err) => console.error(`[test] cleanup: ${err.message}`));
      }
      await admin.end();
    }
  });

  function envFor(extra = {}) {
    const u = new URL(ADMIN_URL);
    return {
      DB_HOST: u.hostname, DB_PORT: u.port || '5432', DB_NAME: dbName(), DB_SSL: 'false',
      WORKER_DB_CREDENTIALS_FILE: path.join(dir, 'worker-db.env'),
      AI_DAILY_BUDGET_USD: '50', AI_DAILY_IMAGE_BUDGET_USD: '10',
      ...extra,
    };
  }
  async function runMain(args, env) {
    const out = [];
    const err = [];
    const code = await inventory.main(args, { env, log: (m) => out.push(m), err: (m) => err.push(m) });
    return { code, out: out.join('\n'), err: err.join('\n') };
  }

  test('classifies every fixture as the worker would treat it, writes nothing, prints no password', async () => {
    const before = await tableHash();
    const res = await runMain(['--json', '--no-redis', '--limit', '5000', '--failed', '500'], envFor());
    const after = await tableHash();

    expect(res.err).toBe('');
    expect(res.code).toBe(0);
    expect(after).toEqual(before);
    expect(res.out.includes(PASSWORD)).toBe(false);
    const inv = JSON.parse(res.out);
    expect(inv.complete).toBe(true);
    expect(inv.redisSkipped).toBe(true);

    const byId = Object.fromEntries(inv.db.open.rows.map((r) => [r.id, r]));
    const get = (k) => byId[ids.jobs[k]];
    expect(get('videoQueued')).toMatchObject({ ifEnabled: 'would run', flags: [] });
    expect(get('legacyBase')).toMatchObject({ ifEnabled: 'would run', flags: expect.arrayContaining(['legacy', 'paid-retries']) });
    expect(get('cascadeProcessing')).toMatchObject({ ifEnabled: 'marked failed by recovery', flags: expect.arrayContaining(['uncertain-paid', 'set-claim-live']) });
    expect(get('legacyProcessing')).toMatchObject({ ifEnabled: 're-queued by recovery, then run again', flags: expect.arrayContaining(['legacy', 'uncertain-paid', 'paid-retries']) });
    expect(get('exhausted')).toMatchObject({ ifEnabled: 'never claimed (attempts used up; stays queued)', flags: ['never-claimable'] });
    expect(get('staleCascade')).toMatchObject({ ifEnabled: 'would run', has_overrides: true, force: true, flags: expect.arrayContaining(['stale-cascade', 'force', 'older-than-24h']) });
    expect(get('missingSet')).toMatchObject({ set_missing: true, flags: ['target-gone'] });
    expect(get('deletedSet')).toMatchObject({ set_deleted: true, flags: ['target-gone'] });
    expect(get('videoQueued')).toMatchObject({ set_has_base: true, angle_has_still: true, angle_has_video: false, angle_label: 'WIDE' });
    for (const k of ['failed', 'completed', 'softDeleted']) expect(get(k)).toBeUndefined();

    const failed = inv.db.failed.find((r) => r.id === ids.jobs.failed);
    expect(failed.error).toMatch(/^Runway poll failed: <url>/);
    expect(failed.error).not.toMatch(/runwayml|SECRETVALUE|sk-live|0123456789abcdef/);

    expect(inv.db.totals.softDeleted).toBeGreaterThanOrEqual(1);
    expect(inv.db.ifEnabled.uncertainPaid).toBeGreaterThanOrEqual(2);
    const today = inv.db.spend[0];
    expect(today.runway_calls).toBeGreaterThanOrEqual(1);
    expect(today.unpriced_calls).toBeGreaterThanOrEqual(1);
    expect(today.total_usd).toBeGreaterThanOrEqual(0.06 - 1e-9);
    expect(today.image_usd).toBeGreaterThanOrEqual(0.05 - 1e-9);
  });

  test('the text report names the open jobs and what would happen, and prints no password', async () => {
    const res = await runMain(['--no-redis', '--limit', '5000'], envFor());
    expect(res.code).toBe(0);
    expect(res.out).toContain(ids.jobs.staleCascade);
    expect(res.out).toMatch(/If GENERATION_WORKER_ENABLED were true now:/);
    expect(res.out).toMatch(/RESULT: COMPLETE \(nothing was written\)/);
    expect(res.out.includes(PASSWORD)).toBe(false);
    expect(res.out).not.toContain(new URL(ADMIN_URL).hostname);
  });

  test('the session the inventory uses refuses writes (25006), even though the role holds UPDATE', async () => {
    const c = new Client({ connectionString: (() => { const u = new URL(ADMIN_URL); u.username = ROLE; u.password = PASSWORD; return u.toString(); })() });
    await c.connect();
    try {
      await c.query('SET default_transaction_read_only = on');
      await c.query('BEGIN READ ONLY');
      await inventory.collectDbInventory(c, { limit: 10, failedLimit: 1 });
      await expect(c.query("UPDATE generation_jobs SET status = 'failed' WHERE id = $1", [ids.jobs.videoQueued])).rejects.toMatchObject({ code: '25006' });
      await c.query('ROLLBACK');
    } finally {
      await c.end();
    }
    expect((await admin.query('SELECT status FROM generation_jobs WHERE id = $1', [ids.jobs.videoQueued])).rows[0].status).toBe('queued');
  });

  test('a database failure or an unreachable Redis is reported as incomplete (exit 1 / 2), never as complete', async () => {
    const free = await new Promise((r) => { const s = net.createServer().listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => r(p)); }); });
    const noRedis = await runMain([], envFor({ REDIS_HOST: '127.0.0.1', REDIS_PORT: String(free) }));
    expect(noRedis.code).toBe(1);
    expect(noRedis.out).toMatch(/Redis video-export queue:\n {2}NOT READ/);
    expect(noRedis.out).toMatch(/RESULT: INCOMPLETE/);
    const noDb = await runMain(['--no-redis'], envFor({ DB_PORT: String(free) }));
    expect(noDb.code).toBe(2);
    expect(noDb.err.includes(PASSWORD)).toBe(false);
  });

  (redisServerBin ? describe : describe.skip)('against a local redis-server', () => {
    let redisProc;
    let port;
    const cli = (...args) => execFileSync('redis-cli', ['-p', String(port), '--no-auth-warning', '-a', REDIS_PASSWORD, ...args], { encoding: 'utf8' });
    const KEYS = {
      'bull:video-export:wait': 'list', 'bull:video-export:active': 'list', 'bull:video-export:delayed': 'zset',
      'bull:video-export:failed': 'zset', 'bull:video-export:completed': 'zset', 'bull:video-export:stalled': 'set', 'bull:video-export:41': 'hash',
    };
    const snapshot = () => {
      const s = { dbsize: cli('DBSIZE').trim() };
      for (const [k, t] of Object.entries(KEYS)) {
        s[k] = t === 'list' ? cli('LRANGE', k, '0', '-1') : t === 'zset' ? cli('ZRANGE', k, '0', '-1', 'WITHSCORES') : t === 'set' ? cli('SMEMBERS', k) : cli('HGETALL', k);
      }
      return s;
    };

    beforeAll(async () => {
      port = await new Promise((r) => { const s = net.createServer().listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => r(p)); }); });
      redisProc = spawn(redisServerBin, ['--port', String(port), '--bind', '127.0.0.1', '--save', '', '--appendonly', 'no', '--requirepass', REDIS_PASSWORD], { stdio: 'ignore' });
      for (let i = 0; i < 50; i += 1) {
        try { if (cli('PING').trim() === 'PONG') break; } catch { /* starting */ }
        await new Promise((r) => setTimeout(r, 100));
      }
      cli('RPUSH', 'bull:video-export:wait', '41', '42', '43');
      cli('RPUSH', 'bull:video-export:active', '40');
      cli('ZADD', 'bull:video-export:delayed', '1', '44', '2', '45');
      cli('ZADD', 'bull:video-export:failed', '1', '39');
      cli('ZADD', 'bull:video-export:completed', '1', '30', '2', '31', '3', '32', '4', '33');
      cli('SADD', 'bull:video-export:stalled', '40');
      cli('HSET', 'bull:video-export:41', 'name', 'export-video', 'data', '{"episodeId":"x"}', 'attemptsMade', '0');
    });
    afterAll(() => { if (redisProc) redisProc.kill('SIGKILL'); });

    test('counts every Bull list and set, changes no key, and the server saw only read-only commands', async () => {
      const before = snapshot();
      cli('CONFIG', 'RESETSTAT');
      const res = await runMain(['--json', '--limit', '5000'], envFor({ REDIS_HOST: '127.0.0.1', REDIS_PORT: String(port), REDIS_PASSWORD }));
      const stats = cli('INFO', 'commandstats');
      const after = snapshot();

      expect(res.code).toBe(0);
      expect(after).toEqual(before);
      const seen = [...stats.matchAll(/^cmdstat_([a-z|]+):/gm)].map((m) => m[1].toUpperCase()).filter((c) => !['INFO', 'CONFIG|RESETSTAT', 'CONFIG'].includes(c));
      expect(seen.length).toBeGreaterThan(0);
      for (const c of seen) expect(inventory.ALLOWED_REDIS_COMMANDS).toContain(c);
      const inv = JSON.parse(res.out);
      expect(inv.redis.counts).toEqual({ wait: 3, active: 1, paused: 0, delayed: 2, priority: 0, failed: 1, completed: 4, stalled: 1 });
      expect(inv.redis.wouldProcessOnEnable).toBe(6);
      expect(res.out.includes(REDIS_PASSWORD)).toBe(false);
      expect(res.out.includes(PASSWORD)).toBe(false);
    });

    test('a wrong Redis password is reported as incomplete, without the password', async () => {
      const res = await runMain(['--limit', '1'], envFor({ REDIS_HOST: '127.0.0.1', REDIS_PORT: String(port), REDIS_PASSWORD: 'wrong-pass-123' }));
      expect(res.code).toBe(1);
      expect(res.out).toMatch(/NOT READ \(Redis replied with an error to AUTH\)/);
      expect(res.out).not.toContain('wrong-pass-123');
    });
  });
});
