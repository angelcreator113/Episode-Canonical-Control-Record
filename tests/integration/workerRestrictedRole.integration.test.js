/**
 * Issue #3714: the episode worker under its least-privilege database role,
 * on the real migrated test database. A role is created here with exactly
 * the grants in src/workers/workerDbGrants.js (the production SQL file is
 * checked against the same list by tests/unit/workers/workerDbGrants.test.js),
 * the worker's own modules are loaded connecting as that role, and:
 *   - every database operation the worker performs succeeds: boot recovery,
 *     the job claim (FOR UPDATE SKIP LOCKED), job completion and failure,
 *     the cascade with its angle claims, and the service statements the jobs
 *     run (visual language merges, base re-pointing, the description review,
 *     the scene brief reads, the approved-base read, the generation cost,
 *     the image-cost budget read and usage row, today's AI spend). Image
 *     generation itself is stubbed: no provider is called;
 *   - everything else is refused (42501): DELETE, INSERT where not granted,
 *     UPDATE on read-only tables, other tables, TRUNCATE, DDL, other
 *     sequences, setval;
 *   - the read-only preflight passes for this role and fails for a role
 *     with an extra privilege or for the admin login;
 *   - a pool of 4 serves many concurrent queries under CONNECTION LIMIT 5,
 *     and the limit is enforced (53300) beyond it;
 *   - a disabled worker process loads no model, pg, Bull, renderer or AI SDK
 *     and opens no database session; one refused for its settings (a
 *     password in its environment, a missing or unsafe credential file, the
 *     postgres login) exits 78;
 *   - an enabled worker process (Option B), on this local test database with
 *     every non-loopback connection refused and Redis pointed where nothing
 *     listens, reads its login from a mode-600 file, connects as the role,
 *     and its own environment (/proc/<pid>/environ and process.env), every
 *     child it starts, and the environment FFmpeg actually receives through
 *     execFile and fluent-ffmpeg carry no password; nor does its log. The
 *     test asserts booleans only and deletes every file it made.
 */
jest.unmock('uuid');

const mockAnthropicCreate = jest.fn(async () => { throw new Error('no AI call is expected'); });
jest.mock('@anthropic-ai/sdk', () => jest.fn(() => ({ messages: { create: mockAnthropicCreate } })));

const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const { Client } = require('pg');
const { Sequelize } = require('sequelize');
const grants = require('../../src/workers/workerDbGrants');
const { checkWorkerDbAccess } = require('../../scripts/worker/check-db-access');

const ADMIN_URL = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL || '';
const shouldSkip = !ADMIN_URL || ADMIN_URL.includes('amazonaws.com') || !ADMIN_URL.includes('episode_metadata_test');

const uuid = () => crypto.randomUUID();
const tag = crypto.randomBytes(4).toString('hex');
const ROLE = `ew_test_${tag}`;
const POOL_ROLE = `ew_pool_${tag}`;
const EXTRA_ROLE = `ew_extra_${tag}`;
const PASSWORD = `pw-${crypto.randomBytes(12).toString('hex')}`;
const urlFor = (role) => {
  const u = new URL(ADMIN_URL);
  u.username = role;
  u.password = PASSWORD;
  return u.toString();
};
const dbName = () => new URL(ADMIN_URL).pathname.replace(/^\//, '');
const ident = (s) => `"${s.replace(/"/g, '""')}"`;

// Every module below, and every one they load later (imageCostService and
// aiCostTracker require the models lazily, at call time), connects as the
// restricted role: the environment points there before any of them loads,
// and they share one module registry. The admin connection uses ADMIN_URL.
const savedEnv = { DATABASE_URL: process.env.DATABASE_URL, TEST_DATABASE_URL: process.env.TEST_DATABASE_URL };
if (!shouldSkip) {
  process.env.DATABASE_URL = urlFor(ROLE);
  process.env.TEST_DATABASE_URL = urlFor(ROLE);
}
const { poolMax } = require('../../src/config/sequelize');
const worker = shouldSkip ? {} : {
  models: require('../../src/models'),
  sceneWorker: require('../../src/workers/sceneGenerationWorker'),
  sceneGen: require('../../src/services/sceneGenerationService'),
  claim: require('../../src/services/generationClaimService'),
  baseDescription: require('../../src/services/baseDescriptionService'),
  brief: require('../../src/services/sceneBriefService'),
  approvedBase: require('../../src/services/approvedBaseService'),
  imageCost: require('../../src/services/imageCostService'),
  aiCost: require('../../src/services/aiCostTracker'),
};

(shouldSkip ? describe.skip : describe)('#3714: the episode worker under its least-privilege role', () => {
  jest.setTimeout(60000);
  let admin;
  const ids = { sets: [], angles: [], jobs: [], locations: [], events: [], show: uuid() };

  async function createRole(role, { extra = [] } = {}) {
    await admin.query(`CREATE ROLE ${ident(role)} LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS CONNECTION LIMIT ${grants.CONNECTION_LIMIT} PASSWORD '${PASSWORD}'`);
    await admin.query(`REVOKE ALL ON DATABASE ${ident(dbName())} FROM ${ident(role)}`);
    for (const sql of grants.grantStatements(role, dbName())) await admin.query(sql);
    for (const sql of extra) await admin.query(sql);
  }
  async function dropRole(role) {
    await admin.query(`REVOKE ALL ON ALL TABLES IN SCHEMA public FROM ${ident(role)}`).catch(() => {});
    await admin.query(`REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM ${ident(role)}`).catch(() => {});
    await admin.query(`REVOKE ALL ON SCHEMA public FROM ${ident(role)}`).catch(() => {});
    await admin.query(`REVOKE ALL ON DATABASE ${ident(dbName())} FROM ${ident(role)}`).catch(() => {});
    await admin.query(`DROP ROLE IF EXISTS ${ident(role)}`).catch((err) => console.error(`[test] could not drop ${role}: ${err.message}`));
  }
  async function asRole(role, fn) {
    const c = new Client({ connectionString: urlFor(role) });
    await c.connect();
    try { return await fn(c); } finally { await c.end(); }
  }
  const denied = async (role, sql) => asRole(role, async (c) => {
    try {
      await c.query(sql);
      return 'allowed';
    } catch (err) {
      return err.code;
    }
  });

  async function seedSet(fields = {}) {
    const id = uuid();
    ids.sets.push(id);
    await admin.query(`INSERT INTO scene_sets (id, name, scene_type, generation_status, visual_language, created_at, updated_at)
      VALUES ($1, $2, 'HOME_BASE', $3, $4, NOW(), NOW())`, [id, `Restricted ${tag}`, fields.status || 'pending', fields.vl || null]);
    return id;
  }
  async function seedAngle(setId, fields = {}) {
    const id = uuid();
    ids.angles.push(id);
    await admin.query(`INSERT INTO scene_angles (id, scene_set_id, angle_name, angle_label, generation_status, still_image_url, quality_review, created_at, updated_at)
      VALUES ($1, $2, 'Wide', $3, $4, $5, $6, NOW(), NOW())`,
    [id, setId, fields.label || 'WIDE', fields.status || 'pending', fields.still || null, fields.review || null]);
    return id;
  }
  async function seedJob(fields) {
    const id = uuid();
    ids.jobs.push(id);
    await admin.query(`INSERT INTO generation_jobs (id, job_type, status, scene_set_id, scene_angle_id, attempts, max_attempts, priority, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW() - interval '1 hour', NOW())`,
    [id, fields.type, fields.status, fields.setId, fields.angleId || null, fields.attempts || 0, fields.max || 3, fields.priority ?? 1000]);
    return id;
  }
  const row = async (table, id) => (await admin.query(`SELECT * FROM ${table} WHERE id = $1`, [id])).rows[0];

  beforeAll(async () => {
    admin = new Client({ connectionString: ADMIN_URL });
    await admin.connect();
    await createRole(ROLE);
    await createRole(POOL_ROLE);
    await createRole(EXTRA_ROLE, { extra: ['GRANT DELETE ON TABLE public.generation_jobs TO ' + ident(EXTRA_ROLE)] });
  });

  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => jest.restoreAllMocks());

  afterAll(async () => {
    if (worker.models) await worker.models.sequelize.close().catch(() => {});
    if (admin) {
      if (ids.jobs.length) await admin.query('DELETE FROM generation_jobs WHERE id = ANY($1::uuid[])', [ids.jobs]);
      if (ids.angles.length) await admin.query('DELETE FROM scene_angles WHERE id = ANY($1::uuid[])', [ids.angles]);
      if (ids.sets.length) await admin.query('DELETE FROM scene_sets WHERE id = ANY($1::uuid[])', [ids.sets]);
      if (ids.locations.length) await admin.query('DELETE FROM world_locations WHERE id = ANY($1::uuid[])', [ids.locations]);
      if (ids.events.length) await admin.query('DELETE FROM world_events WHERE id = ANY($1::uuid[])', [ids.events]);
      await admin.query("DELETE FROM ai_usage_logs WHERE route_name = $1", [`worker-restricted-${tag}`]);
      // The worker's sessions must be gone before its role can be dropped.
      await admin.query('SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE usename = ANY($1::text[])', [[ROLE, POOL_ROLE, EXTRA_ROLE]]);
      for (const r of [ROLE, POOL_ROLE, EXTRA_ROLE]) await dropRole(r);
      await admin.end();
    }
    for (const [k, v] of Object.entries(savedEnv)) {
      if (v === undefined) delete process.env[k]; else process.env[k] = v;
    }
    expect(mockAnthropicCreate).not.toHaveBeenCalled();
  });

  describe('every database operation the worker performs succeeds', () => {
    test('the worker\'s models, including the ones loaded lazily, connect as the restricted role', async () => {
      const [[me]] = await worker.models.sequelize.query('SELECT current_user AS u');
      expect(me.u).toBe(ROLE);
      // imageCostService and aiCostTracker require the models at call time: the same instance.
      expect(require('../../src/models')).toBe(worker.models);
    });

    test('boot recovery: a stuck job is re-queued; one out of attempts fails and releases its cascade set', async () => {
      const setA = await seedSet();
      const setB = await seedSet({ status: 'generating' });
      const retry = await seedJob({ type: 'generate_base', status: 'processing', setId: setA, attempts: 1, max: 3 });
      const dead = await seedJob({ type: 'cascade_regenerate', status: 'processing', setId: setB, attempts: 3, max: 3 });
      jest.spyOn(console, 'error');
      await worker.sceneWorker.recoverStuckJobs();
      expect(console.error).not.toHaveBeenCalled();
      expect((await row('generation_jobs', retry)).status).toBe('queued');
      expect((await row('generation_jobs', dead)).status).toBe('failed');
      expect((await row('scene_sets', setB)).generation_status).toBe('failed');
    });

    test('the claim (SELECT ... FOR UPDATE SKIP LOCKED, then UPDATE) takes a queued job', async () => {
      const setId = await seedSet();
      const jobId = await seedJob({ type: 'generate_base', status: 'queued', setId, priority: 100000 });
      const job = await worker.sceneWorker.claimNextJob();
      expect(job && job.id).toBe(jobId);
      const stored = await row('generation_jobs', jobId);
      expect(stored.status).toBe('processing');
      expect(stored.attempts).toBe(1);
    });

    test('a job completes, and a failed one marks its angle failed (generation stubbed)', async () => {
      const setId = await seedSet();
      const angleId = await seedAngle(setId, { status: 'generating' });
      jest.spyOn(worker.sceneGen, 'generateAngle').mockResolvedValueOnce({ success: true, stubbed: true });
      const okId = await seedJob({ type: 'generate_angle', status: 'processing', setId, angleId, attempts: 1 });
      await worker.sceneWorker.processJob(await worker.models.GenerationJob.findByPk(okId));
      expect((await row('generation_jobs', okId)).status).toBe('completed');

      jest.spyOn(console, 'error').mockImplementation(() => {});
      worker.sceneGen.generateAngle.mockRejectedValueOnce(new Error('stubbed provider failure'));
      const badId = await seedJob({ type: 'generate_angle', status: 'processing', setId, angleId, attempts: 3, max: 3 });
      await worker.sceneWorker.processJob(await worker.models.GenerationJob.findByPk(badId));
      expect((await row('generation_jobs', badId)).status).toBe('failed');
      expect((await row('scene_angles', angleId)).generation_status).toBe('failed');
    });

    test('a cascade reads its set with its angles and claims each angle (generation stubbed)', async () => {
      const setId = await seedSet();
      const a1 = await seedAngle(setId, { label: 'WIDE' });
      const a2 = await seedAngle(setId, { label: 'VANITY' });
      jest.spyOn(worker.sceneGen, 'generateBaseScene').mockResolvedValue({ success: true, stubbed: true });
      jest.spyOn(worker.sceneGen, 'generateAngle').mockResolvedValue({ success: true, stubbed: true });
      const jobId = await seedJob({ type: 'cascade_regenerate', status: 'processing', setId, attempts: 1 });
      await worker.sceneWorker.processJob(await worker.models.GenerationJob.findByPk(jobId));
      const stored = await row('generation_jobs', jobId);
      expect(stored.status).toBe('completed');
      expect(stored.result.successfulAngles).toBe(2);
      for (const a of [a1, a2]) expect((await row('scene_angles', a)).generation_status).toBe('generating');
    });

    test('the service statements a job runs: merges, re-pointing, review, brief reads, cost', async () => {
      const db = worker.models.sequelize;
      const setId = await seedSet({ vl: { keep: 1 } });
      const angleId = await seedAngle(setId, { still: `https://x/${tag}-old.jpg`, review: { from_base: { url: `https://x/${tag}-old.jpg` } } });
      await worker.sceneGen.mergeVisualLanguage(worker.models.SceneSet, setId, { added: 2 });
      expect((await row('scene_sets', setId)).visual_language).toMatchObject({ keep: 1, added: 2 });
      expect(await worker.sceneGen.repointBaseAngles(db, setId, `https://x/${tag}-old.jpg`, `https://x/${tag}-new.jpg`)).toBe(1);
      expect((await row('scene_angles', angleId)).still_image_url).toBe(`https://x/${tag}-new.jpg`);
      await worker.baseDescription.writeReview(db, setId, { note: 'stub' });
      await worker.baseDescription.writeReview(db, setId, null);
      await worker.models.SceneSet.increment('generation_cost', { by: 0.5, where: { id: setId } });
      await worker.models.SceneAngle.increment('generation_cost', { by: 0.25, where: { id: angleId } });

      const loc = uuid();
      ids.locations.push(loc);
      await admin.query("INSERT INTO world_locations (id, name, location_type, created_at, updated_at) VALUES ($1, $2, 'interior', NOW(), NOW())", [loc, `Loc ${tag}`]);
      expect((await worker.brief.loadBriefLocation(db, loc)).name).toBe(`Loc ${tag}`);
      const ev = uuid();
      ids.events.push(ev);
      await admin.query("INSERT INTO world_events (id, show_id, name, created_at, updated_at) VALUES ($1, $2, $3, NOW(), NOW())", [ev, ids.show, `Ev ${tag}`]);
      expect(await worker.brief.loadBriefEvent(db, ev, ids.show)).toBeTruthy();
      expect(await worker.approvedBase.locationApprovingSet(db, setId)).toBeNull();
    });

    test('image cost: the budget read and the usage row (provider stubbed), and today\'s AI spend', async () => {
      // Both services catch database errors and go on (fail open), so a
      // missing grant shows only in their logs: none may say "permission denied".
      jest.spyOn(console, 'error').mockImplementation(() => {});
      const provider = jest.fn(async () => ({ url: 'https://x/stub.png' }));
      const out = await worker.imageCost.runImageCall({ model: 'fal-ai/flux/dev', width: 1024, height: 1024, routeName: `worker-restricted-${tag}` }, provider);
      expect(out).toEqual({ url: 'https://x/stub.png' });
      expect(provider).toHaveBeenCalledTimes(1);
      const logged = await admin.query('SELECT model_name, cost_usd FROM ai_usage_logs WHERE route_name = $1', [`worker-restricted-${tag}`]);
      expect(logged.rows).toHaveLength(1);
      await worker.aiCost.refreshSpend();
      const logs = JSON.stringify([...console.warn.mock.calls, ...console.error.mock.calls]);
      expect(logs).not.toMatch(/permission denied/i);
    });
  });

  describe('everything else is refused', () => {
    test.each([
      ['DELETE a job', 'DELETE FROM generation_jobs WHERE false'],
      ['INSERT a job', "INSERT INTO generation_jobs (job_type, status, scene_set_id) SELECT 'generate_base', 'queued', id FROM scene_sets LIMIT 0"],
      ['DELETE a scene set', 'DELETE FROM scene_sets WHERE false'],
      ['INSERT a scene angle', 'INSERT INTO scene_angles (id) SELECT id FROM scene_angles LIMIT 0'],
      ['UPDATE an event', 'UPDATE world_events SET name = name WHERE false'],
      ['UPDATE a location', 'UPDATE world_locations SET name = name WHERE false'],
      ['UPDATE a usage row', 'UPDATE ai_usage_logs SET model_name = model_name WHERE false'],
      ['DELETE a usage row', 'DELETE FROM ai_usage_logs WHERE false'],
      ['TRUNCATE usage', 'TRUNCATE ai_usage_logs'],
      ['read episodes', 'SELECT 1 FROM episodes LIMIT 0'],
      ['read shows', 'SELECT 1 FROM shows LIMIT 0'],
      ['read the migrations table', 'SELECT 1 FROM "SequelizeMeta" LIMIT 0'],
      ['create a table', `CREATE TABLE public.ew_probe_${tag} (id int)`],
      ['setval the usage sequence', "SELECT setval('ai_usage_logs_id_seq', 1)"],
    ])('%s: permission denied', async (_label, sql) => {
      expect(await denied(ROLE, sql)).toBe('42501');
    });

    test('another sequence: permission denied', async () => {
      const { rows } = await admin.query("SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE c.relkind = 'S' AND n.nspname = 'public' AND c.relname <> 'ai_usage_logs_id_seq' LIMIT 1");
      expect(rows).toHaveLength(1);
      expect(await denied(ROLE, `SELECT nextval('public.${rows[0].relname}')`)).toBe('42501');
    });
  });

  describe('the read-only preflight', () => {
    const preflight = (role, expectedUser) => asRole(role, async (c) => {
      await c.query('SET default_transaction_read_only = on');
      await c.query('BEGIN READ ONLY');
      try { return await checkWorkerDbAccess(c, { expectedUser }); } finally { await c.query('ROLLBACK'); }
    });

    test('passes for the restricted role', async () => {
      const { ok, results } = await preflight(ROLE, ROLE);
      expect(results.filter((r) => r.status === 'FAIL')).toEqual([]);
      expect(ok).toBe(true);
    });

    test('fails for a role with one extra privilege, naming it', async () => {
      const { ok, results } = await preflight(EXTRA_ROLE, EXTRA_ROLE);
      expect(ok).toBe(false);
      expect(results.filter((r) => r.status === 'FAIL').map((r) => r.check)).toEqual(['no DELETE on generation_jobs']);
    });

    test('fails for the admin login', async () => {
      const c = new Client({ connectionString: ADMIN_URL });
      await c.connect();
      try {
        await c.query('BEGIN READ ONLY');
        const { ok, results } = await checkWorkerDbAccess(c, { expectedUser: ROLE });
        await c.query('ROLLBACK');
        expect(ok).toBe(false);
        const failed = results.filter((r) => r.status === 'FAIL').map((r) => r.check);
        expect(failed).toEqual(expect.arrayContaining(['login', 'not superuser', 'no other table']));
      } finally {
        await c.end();
      }
    });
  });

  describe('the pool under CONNECTION LIMIT 5', () => {
    test('the worker\'s pool of 4 (DB_POOL_MAX) serves 16 concurrent queries; a 6th session is refused (53300)', async () => {
      const max = poolMax({ DB_POOL_MAX: '4' });
      expect(max).toBe(grants.POOL_MAX);
      expect(max).toBeLessThan(grants.CONNECTION_LIMIT);
      const seq = new Sequelize(urlFor(POOL_ROLE), { logging: false, pool: { max, min: Math.min(10, max), acquire: 20000, idle: 1000 } });
      let peak = 0;
      const sampler = setInterval(async () => {
        const { rows } = await admin.query('SELECT count(*)::int AS n FROM pg_stat_activity WHERE usename = $1', [POOL_ROLE]).catch(() => ({ rows: [{ n: 0 }] }));
        peak = Math.max(peak, rows[0].n);
      }, 50);
      try {
        await Promise.all(Array.from({ length: 16 }, () => seq.query('SELECT pg_sleep(0.15)')));
      } finally {
        clearInterval(sampler);
      }
      expect(peak).toBeGreaterThan(0);
      expect(peak).toBeLessThanOrEqual(max);
      await seq.close();

      // The limit itself: five sessions fit, a sixth is refused.
      const clients = [];
      try {
        for (let i = 0; i < grants.CONNECTION_LIMIT; i += 1) {
          const c = new Client({ connectionString: urlFor(POOL_ROLE) });
          await c.connect();
          clients.push(c);
        }
        const sixth = new Client({ connectionString: urlFor(POOL_ROLE) });
        await expect(sixth.connect()).rejects.toMatchObject({ code: '53300' });
      } finally {
        await Promise.all(clients.map((c) => c.end()));
      }
    });
  });

  describe('the worker process', () => {
    const START = path.join(__dirname, '../../src/workers/start.js');
    const TRACE = path.join(__dirname, '../helpers/traceRequires.js');
    const PROBE = path.join(__dirname, '../helpers/workerEnvProbe.js');
    const FORBIDDEN = [/src[\\/]models[\\/]index\.js$/, /sceneGenerationWorker\.js$/, /videoRenderer\.js$/, /aiCostTracker\.js$/,
      /node_modules[\\/]bull[\\/]/, /node_modules[\\/]pg[\\/]/, /node_modules[\\/]@anthropic-ai[\\/]/, /node_modules[\\/]sequelize[\\/]/];
    const sessions = async () => (await admin.query('SELECT count(*)::int AS n FROM pg_stat_activity WHERE usename = $1', [ROLE])).rows[0].n;

    // A credential file in its own directory (deleted after each run).
    function credentialFile(dir, { user = ROLE, password = PASSWORD, mode = 0o600 } = {}) {
      const p = path.join(dir, 'worker-db.env');
      fs.writeFileSync(p, `WORKER_DB_USER=${user}\nWORKER_DB_PASSWORD=${password}\n`, { mode });
      fs.chmodSync(p, mode);
      return p;
    }

    function run(makeEnv, { killAfterMs = null, preload = [], whileRunning = null } = {}) {
      const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'ew-'));
      const traceOut = path.join(cwd, 'trace.json');
      const u = new URL(ADMIN_URL);
      const childEnv = {
        PATH: process.env.PATH,
        NODE_ENV: 'production',
        WORKER_DB_REQUIRED: 'true',
        DB_USER: '', DB_PASSWORD: '',
        DB_HOST: u.hostname, DB_PORT: u.port || '5432', DB_NAME: dbName(), DB_SSL: 'false', DB_POOL_MAX: '4',
        REDIS_HOST: '127.0.0.1', REDIS_PORT: '1',
        TRACE_REQUIRES_OUT: traceOut,
        ...makeEnv(cwd),
      };
      return new Promise((resolve) => {
        const args = ['-r', TRACE, ...preload.flatMap((f) => ['-r', f]), START];
        const child = spawn(process.execPath, args, { cwd, env: childEnv });
        let out = '';
        child.stdout.on('data', (d) => { out += d; });
        child.stderr.on('data', (d) => { out += d; });
        const during = whileRunning ? whileRunning(child, cwd) : Promise.resolve(null);
        const timer = killAfterMs ? setTimeout(() => child.kill('SIGTERM'), killAfterMs) : null;
        child.on('exit', async (code) => {
          if (timer) clearTimeout(timer);
          const seen = await during;
          const loaded = fs.existsSync(traceOut) ? JSON.parse(fs.readFileSync(traceOut, 'utf8')) : null;
          const files = {};
          for (const f of fs.readdirSync(cwd)) files[f] = fs.readFileSync(path.join(cwd, f));
          fs.rmSync(cwd, { recursive: true, force: true });
          resolve({ code, out, loaded, seen, files });
        });
      });
    }

    test('disabled (the default): stays up, loads nothing that works, opens no session; ends cleanly on SIGTERM', async () => {
      const before = await sessions();
      const res = await run((dir) => ({ WORKER_DB_CREDENTIALS_FILE: credentialFile(dir) }), { killAfterMs: 2000 });
      expect(res.out).toMatch(/Generation worker is disabled/);
      expect(res.code).toBe(0);
      expect(res.loaded).not.toBeNull();
      for (const re of FORBIDDEN) expect(res.loaded.filter((f) => re.test(f))).toEqual([]);
      expect(await sessions()).toBe(before);
      expect(res.out.includes(PASSWORD)).toBe(false);
    });

    test.each([
      ['the API login in its environment, enabled', () => ({ GENERATION_WORKER_ENABLED: 'true', DB_USER: 'episode_app_dev', DB_PASSWORD: 'api-secret' })],
      ['the API login in its environment, disabled (a stale pm2 saved env)', () => ({ DB_USER: 'postgres', DB_PASSWORD: 'api-secret' })],
      ['a worker password in its environment (the old Option A)', (dir) => ({ GENERATION_WORKER_ENABLED: 'true', WORKER_DB_USER: ROLE, WORKER_DB_PASSWORD: 'api-secret', WORKER_DB_CREDENTIALS_FILE: credentialFile(dir) })],
      ['no credential file', (dir) => ({ GENERATION_WORKER_ENABLED: 'true', WORKER_DB_CREDENTIALS_FILE: path.join(dir, 'missing.env') })],
      ['a credential file with mode 644', (dir) => ({ GENERATION_WORKER_ENABLED: 'true', WORKER_DB_CREDENTIALS_FILE: credentialFile(dir, { mode: 0o644 }) })],
      ['a credential file naming postgres', (dir) => ({ GENERATION_WORKER_ENABLED: 'true', WORKER_DB_CREDENTIALS_FILE: credentialFile(dir, { user: 'postgres' }) })],
    ])('%s: refused with exit 78 before anything loads', async (_label, makeEnv) => {
      const res = await run(makeEnv);
      expect(res.code).toBe(78);
      expect(res.out).toMatch(/Refusing to start/);
      for (const re of FORBIDDEN) expect(res.loaded.filter((f) => re.test(f))).toEqual([]);
      expect(res.out.includes('api-secret')).toBe(false);
      expect(res.out.includes(PASSWORD)).toBe(false);
    });

    test('enabled, on the local test database with the network blocked: connects as the role from the file; no environment, child process or log carries the password', async () => {
      const fakeBin = fs.mkdtempSync(path.join(os.tmpdir(), 'ew-bin-'));
      // A stand-in ffmpeg that records the environment it really received.
      fs.writeFileSync(path.join(fakeBin, 'ffmpeg'), '#!/bin/sh\n/usr/bin/env > "$PROBE_DIR/ffmpeg-env-$$.txt"\nexit 0\n', { mode: 0o700 });
      const u = new URL(ADMIN_URL);
      try {
        const res = await run((dir) => ({
          GENERATION_WORKER_ENABLED: 'true',
          WORKER_DB_CREDENTIALS_FILE: credentialFile(dir),
          PATH: `${fakeBin}:${process.env.PATH}`,
          PROBE_DIR: dir,
          PROBE_ALLOW_HOST: u.hostname,
          PROBE_AFTER_MS: '2500',
        }), {
          preload: [PROBE],
          killAfterMs: 7000,
          whileRunning: (child) => new Promise((resolve) => setTimeout(async () => {
            let environHasPassword = null;
            try { environHasPassword = fs.readFileSync(`/proc/${child.pid}/environ`).includes(PASSWORD); } catch (err) { console.error('[test] /proc environ unreadable:', err.code); }
            resolve({ environHasPassword, roleSessions: await sessions() });
          }, 4500)),
        });

        // It really ran: the scene worker started and connected as the role.
        expect(res.out).toMatch(/Database login: the worker's own \(credential file\)/);
        expect(res.out).toMatch(/Scene generation worker started/);
        expect(res.loaded.some((f) => /src[\\/]models[\\/]index\.js$/.test(f))).toBe(true);
        expect(res.seen.roleSessions).toBeGreaterThan(0);
        expect(res.out).not.toMatch(/permission denied/i);

        // The worker's own environment, as the kernel holds it and as Node sees it.
        expect(res.seen.environHasPassword).toBe(false);
        expect(res.files['worker-env.json']).toBeDefined();
        const workerEnv = JSON.parse(res.files['worker-env.json']);
        expect(JSON.stringify(workerEnv).includes(PASSWORD)).toBe(false);
        for (const k of ['DB_PASSWORD', 'WORKER_DB_PASSWORD', 'DB_USER', 'WORKER_DB_USER', 'DATABASE_URL']) expect(Object.keys(workerEnv)).not.toContain(k);

        // Every child the worker started, and what FFmpeg actually received
        // through execFile and through fluent-ffmpeg's spawn.
        const children = JSON.parse(res.files['children.json']);
        expect(children.filter((c) => /ffmpeg$/.test(String(c.file))).length).toBeGreaterThanOrEqual(2);
        expect(children.every((c) => Array.isArray(c.envPairs) && !c.envPairs.some((p) => p.includes(PASSWORD)))).toBe(true);
        const ffmpegEnvs = Object.keys(res.files).filter((f) => /^ffmpeg-env-\d+\.txt$/.test(f)).map((f) => res.files[f]);
        expect(ffmpegEnvs.length).toBeGreaterThanOrEqual(2);
        expect(ffmpegEnvs.every((b) => b.includes('PROBE_DIR=') && !b.includes(PASSWORD))).toBe(true);

        // Nothing it logged, nothing left on disk.
        expect(res.out.includes(PASSWORD)).toBe(false);
        expect(res.files['probe-error.json']).toBeUndefined();
      } finally {
        fs.rmSync(fakeBin, { recursive: true, force: true });
      }
    });
  });
});
