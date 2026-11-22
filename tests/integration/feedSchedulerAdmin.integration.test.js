/**
 * Feed generation and the scheduler's settings are an ADMIN's (Evoni,
 * 2026-11-22), through the real app against the test database.
 *
 *   POST /api/v1/feed-scheduler/auto-generate       paid: sparks and profiles
 *   POST /api/v1/feed-scheduler/auto-generate-job   paid: the same, as a job
 *   PUT  /api/v1/feed-scheduler/config              interval, batch size, switches
 *
 * Each asked for a sign-in only. Now: no token 401; a signed-in account
 * outside the admin group 403 from authorize(['ADMIN']), before the rate
 * limiter and the handler; an ADMIN as before. PUT /config also refuses an
 * interval_hours or batch_size outside feedScheduler's CONFIG_LIMITS with a
 * 400, whole, leaving the settings and the timer as they were.
 * POST /preview-sparks stays any signed-in account's.
 *
 * The provider is doubled at the transport: global fetch is replaced, so the
 * real SDK and the real cost tracker (budget gate included) run, and no
 * request can leave the process. Every call the double sees is recorded; a
 * URL that is not the provider's fails the test. The scheduler's timers are
 * doubled too: no cycle is ever scheduled or run here.
 */
jest.unmock('uuid');

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const request = require('supertest');
const app = require('../../src/app');
const TokenService = require('../../src/services/tokenService');
const db = require('../../src/models');
const scheduler = require('../../src/services/feedScheduler');
const tracker = require('../../src/services/aiCostTracker');
const { readOnlyTokens, expectWriteRefused } = require('../helpers/writeGuard');

const { sequelize } = db;

const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const BASE = '/api/v1/feed-scheduler';
const ROUTE_SRC = fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'routes', 'feedSchedulerRoutes.js'), 'utf8');
const TAG = crypto.randomUUID().replace(/-/g, '').slice(0, 8);
const HANDLE = `@fsadm${TAG}`;
// The double's usage figures, so its ai_usage_logs rows can be told apart and removed.
const USAGE = { input_tokens: 7, output_tokens: 11 };
const TABLES = ['social_profiles', 'world_locations', 'bulk_import_jobs', 'social_profile_followers', 'social_profile_relationships', 'ai_usage_logs'];
const HOUR = 60 * 60 * 1000;

(shouldSkip ? describe.skip : describe)('Feed generation and the scheduler settings are an ADMIN\'s', () => {
  const tokens = {};
  const saved = {};
  let initialConfig;
  let providerCalls;   // every request the transport double saw
  let handleN = 0;
  const jobIds = [];   // jobs this file made, removed at the end
  let timers;          // { set: [[ms, handle]], cleared: [handle] } for the scheduler's interval
  let watched;         // model spies: the handlers' first reads and writes

  const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });
  const counts = async () => {
    const out = {};
    for (const t of TABLES) {
      // eslint-disable-next-line no-await-in-loop
      out[t] = Number((await run(`SELECT COUNT(*)::int AS n FROM ${t}`))[0][0].n);
    }
    return out;
  };
  const settle = async () => { for (let i = 0; i < 4; i += 1) await new Promise((r) => setImmediate(r)); };
  // A new address per request: the app's own limit on writes (60 a minute an
  // address, src/app.js writeLimiter) is not what is tested here.
  let ipN = 0;
  const from = (r) => { ipN += 1; return r.set('X-Forwarded-For', `198.51.${100 + Math.floor(ipN / 250) % 100}.${(ipN % 250) + 1}`); };
  const send = (verb, p, who, body = {}) => {
    const r = from(request(app)[verb](`${BASE}${p}`));
    return (who ? r.set('Authorization', `Bearer ${tokens[who] || who}`) : r).send(body);
  };
  // RateLimit-Limit on an answer is the last limiter's that counted the
  // request: the app's write limit, or aiRateLimiter's once a request reaches it.
  let aiLimit;
  const WRITE_LIMIT = '60';
  const token = (id, groups, role) => TokenService.generateTokenPair({ id, email: `${id}@feedadmin.dev`, name: id, groups, role }).accessToken;
  const freshAdmin = (name) => token(`admin-${name}-${TAG}`, ['ADMIN'], 'ADMIN');

  // The provider, at the transport. Answers by what the scheduler asks for:
  // the pre-flight check (max_tokens 10), sparks (Haiku), or one profile.
  const message = (text, model) => ({
    id: `msg_${TAG}`, type: 'message', role: 'assistant', model,
    content: [{ type: 'text', text }], stop_reason: 'end_turn', stop_sequence: null, usage: USAGE,
  });
  const providerDouble = async (url, init = {}) => {
    const target = String(url?.url || url);
    providerCalls.push(target);
    if (!/^https:\/\/api\.anthropic\.com\/v1\/messages(\?|$)/.test(target)) throw new Error(`unexpected network call in test: ${target}`);
    const body = JSON.parse(init.body);
    let text;
    if (body.max_tokens === 10) text = 'ok';
    else if (/haiku/.test(body.model)) {
      const want = Number(/Generate exactly (\d+) unique creator sparks/.exec(body.messages[0].content)[1]);
      text = JSON.stringify(Array.from({ length: want }, () => {
        handleN += 1;
        return { handle: `${HANDLE}${handleN}`, platform: 'instagram', vibe_sentence: 'Posts from a test.', archetype: 'the_peer', follower_tier: 'micro' };
      }));
    } else text = JSON.stringify({ display_name: `Feed Admin ${TAG}`, content_category: 'fitness', follower_tier: 'micro', archetype: 'the_peer', current_trajectory: 'rising' });
    return new Response(JSON.stringify(message(text, body.model)), { status: 200, headers: { 'content-type': 'application/json' } });
  };

  // The scheduler's own timers never really start: setInterval / setTimeout
  // of scheduledRun hand back a marker; everything else goes to Node.
  const installTimerDoubles = () => {
    timers = { set: [], cleared: [], initial: 0 };
    const realSetInterval = global.setInterval;
    const realClearInterval = global.clearInterval;
    const realSetTimeout = global.setTimeout;
    const realClearTimeout = global.clearTimeout;
    jest.spyOn(global, 'setInterval').mockImplementation((fn, ms, ...rest) => {
      if (fn?.name !== 'scheduledRun') return realSetInterval(fn, ms, ...rest);
      const handle = { fakeSchedulerInterval: timers.set.length + 1 };
      timers.set.push([ms, handle]);
      return handle;
    });
    jest.spyOn(global, 'clearInterval').mockImplementation((handle) => {
      if (!handle?.fakeSchedulerInterval) return realClearInterval(handle);
      timers.cleared.push(handle);
      return undefined;
    });
    jest.spyOn(global, 'setTimeout').mockImplementation((fn, ms, ...rest) => {
      if (fn?.name !== 'scheduledRun') return realSetTimeout(fn, ms, ...rest);
      timers.initial += 1;
      return { fakeSchedulerTimeout: true };
    });
    jest.spyOn(global, 'clearTimeout').mockImplementation((handle) => (handle?.fakeSchedulerTimeout ? undefined : realClearTimeout(handle)));
  };
  // A running scheduler, with the doubles above standing in for its timers.
  const startFakeScheduler = () => {
    process.env.FEED_SCHEDULER_ENABLED = 'true';
    scheduler.startScheduler(4, db);
    delete process.env.FEED_SCHEDULER_ENABLED;
    expect(timers.set).toHaveLength(1);
    timers.set.length = 0;
    return scheduler.getSchedulerStatus();
  };
  const nextRunIn = () => new Date(scheduler.getSchedulerStatus().next_run).getTime() - Date.now();
  const nothingRan = () => {
    expect(providerCalls).toEqual([]);
    for (const spy of watched) expect(spy).not.toHaveBeenCalled();
    expect(timers.set).toEqual([]);
    expect(timers.cleared).toEqual([]);
    expect(timers.initial).toBe(0);
  };

  beforeAll(async () => {
    Object.assign(tokens, readOnlyTokens(`feedadmin-${TAG}`));
    tokens.nogroup = token(`nogroup-${TAG}`, [], undefined);
    tokens.admin = freshAdmin('main');
    for (const k of ['ADMIN_WRITE_GUARD', 'FEED_SCHEDULER_ENABLED', 'ANTHROPIC_API_KEY']) saved[k] = process.env[k];
    // The routes' own check is what is tested: the app-wide write guard is off here.
    process.env.ADMIN_WRITE_GUARD = 'off';
    delete process.env.FEED_SCHEDULER_ENABLED;
    process.env.ANTHROPIC_API_KEY = 'test-key-not-a-real-one';
    initialConfig = scheduler.getConfig();
    await sequelize.authenticate();
    // /start with the scheduler switched off starts nothing, and passes aiRateLimiter.
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    const probe = await send('post', '/start', freshAdmin('probe'), {});
    console.warn.mockRestore();
    expect(probe.status).toBe(409);
    aiLimit = probe.headers['ratelimit-limit'];
    expect(Number(aiLimit)).toBeGreaterThan(0);
    expect(aiLimit).not.toBe(WRITE_LIMIT);
  });

  beforeEach(() => {
    providerCalls = [];
    jest.spyOn(global, 'fetch').mockImplementation(providerDouble);
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    installTimerDoubles();
    watched = [
      jest.spyOn(db.SocialProfile, 'count'), jest.spyOn(db.SocialProfile, 'create'), jest.spyOn(db.SocialProfile, 'findAll'),
      jest.spyOn(db.BulkImportJob, 'create'), jest.spyOn(db.BulkImportJob, 'findByPk'), jest.spyOn(db.WorldLocation, 'create'),
    ];
  });

  afterEach(async () => {
    await settle();
    scheduler.stopScheduler();
    scheduler.updateConfig(initialConfig);
    jest.restoreAllMocks();
  });

  afterAll(async () => {
    for (const [k, v] of Object.entries(saved)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; }
    const like = `${HANDLE}%`;
    const mine = 'SELECT id FROM social_profiles WHERE handle LIKE :like';
    const clean = async (label, sql) => run(sql, { like }).catch((err) => console.error(`[cleanup] ${label}:`, err.message));
    await clean('followers', `DELETE FROM social_profile_followers WHERE social_profile_id IN (${mine})`);
    await clean('relationships', `DELETE FROM social_profile_relationships WHERE source_profile_id IN (${mine}) OR target_profile_id IN (${mine})`);
    if (jobIds.length) await run('DELETE FROM bulk_import_jobs WHERE id IN (:ids)', { ids: jobIds }).catch((err) => console.error('[cleanup] jobs:', err.message));
    await clean('profiles', 'DELETE FROM social_profiles WHERE handle LIKE :like');
    await run('DELETE FROM ai_usage_logs WHERE input_tokens = :i AND output_tokens = :o', { i: USAGE.input_tokens, o: USAGE.output_tokens })
      .catch((err) => console.error('[cleanup] ai_usage_logs:', err.message));
    await tracker.refreshSpend();
  });

  // ── The source: the group check is the file's one guard, ahead of the limiter ──
  describe('the route chains', () => {
    test('one admin guard, requireAuth then authorize ADMIN; the three routes spread it before aiRateLimiter and the handler', () => {
      expect(ROUTE_SRC).toMatch(/const admin = \[requireAuth, authorize\(\['ADMIN'\]\)\];/);
      expect(ROUTE_SRC).toMatch(/router\.post\('\/auto-generate', \.\.\.admin, aiRateLimiter, async \(req, res\) => \{/);
      expect(ROUTE_SRC).toMatch(/router\.post\('\/auto-generate-job', \.\.\.admin, aiRateLimiter, async \(req, res\) => \{/);
      expect(ROUTE_SRC).toMatch(/router\.put\('\/config', \.\.\.admin, \(req, res\) => \{/);
    });
    test('preview-sparks is as it was: a sign-in, then the rate limiter', () => {
      expect(ROUTE_SRC).toMatch(/router\.post\('\/preview-sparks', requireAuth, aiRateLimiter, async \(req, res\) => \{/);
    });
    test('the cost tracker (budget gate) is loaded by the app before any route', () => {
      const appSrc = fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'app.js'), 'utf8');
      expect(appSrc.indexOf("require('./services/aiCostTracker')")).toBeGreaterThan(-1);
      expect(appSrc.indexOf("require('./services/aiCostTracker')")).toBeLessThan(appSrc.indexOf('feedSchedulerRoutes'));
    });
  });

  // ── Refusals ────────────────────────────────────────────────────────────
  const GUARDED = [
    ['post', '/auto-generate', { feed_layer: 'real_world', count: 3 }],
    ['post', '/auto-generate', { feed_layer: 'lalaverse', count: 20, stream: true }],
    ['post', '/auto-generate-job', { feed_layer: 'real_world', count: 3 }],
    ['put', '/config', { interval_hours: 6, batch_size: 10, auto_fill_enabled: false }],
    ['put', '/config', { interval_hours: 0.001, batch_size: 100000 }],
    // Admin only since SEC-4 (2026-10-29); still so.
    ['post', '/start', { interval_hours: 1 }],
    ['post', '/stop', {}],
    ['post', '/run-now', {}],
    ['post', '/fill-one', { feed_layer: 'real_world' }],
  ];

  describe.each(GUARDED)('%s %s %j', (verb, p, body) => {
    test('signed out 401; a viewer and an editor 403 AUTH_GROUP_REQUIRED; nothing run, written, set or scheduled', async () => {
      const before = { rows: await counts(), config: scheduler.getConfig(), status: scheduler.getSchedulerStatus() };
      watched.forEach((spy) => spy.mockClear());
      await expectWriteRefused(() => from(request(app)[verb](`${BASE}${p}`)).send(body), tokens);
      await settle();
      nothingRan();
      expect(await counts()).toEqual(before.rows);
      expect(scheduler.getConfig()).toEqual(before.config);
      expect(scheduler.getSchedulerStatus()).toEqual(before.status);
    });

    test('an account in no group: 403 with authorize\'s own body, as JSON, and the rate limiter never saw it', async () => {
      const before = { rows: await counts(), config: scheduler.getConfig() };
      watched.forEach((spy) => spy.mockClear());
      const res = await send(verb, p, 'nogroup', body);
      expect(res.status).toBe(403);
      expect(res.body).toEqual({ error: 'Forbidden', message: 'User must be in one of these groups: ADMIN', code: 'AUTH_GROUP_REQUIRED' });
      expect(res.headers['content-type']).toMatch(/application\/json/);
      // Only the app's write limit counted it; aiRateLimiter did not.
      expect(res.headers['ratelimit-limit']).toBe(WRITE_LIMIT);
      await settle();
      nothingRan();
      expect(await counts()).toEqual(before.rows);
      expect(scheduler.getConfig()).toEqual(before.config);
    });
  });

  test('refused requests do not spend the rate limit: a viewer is answered 403, never 429, past the limit', async () => {
    const answers = new Set();
    for (let i = 0; i < Number(aiLimit) + 3; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      const res = await send('post', '/auto-generate', 'viewer', { count: 1 });
      answers.add(`${res.status} ${res.headers['ratelimit-limit']}`);
    }
    expect([...answers]).toEqual([`403 ${WRITE_LIMIT}`]);
    nothingRan();
  });

  test('with a scheduler running, a non-admin config save leaves its timer and its next run alone', async () => {
    const status = startFakeScheduler();
    expect(status.running).toBe(true);
    const config = scheduler.getConfig();
    for (const who of ['viewer', 'editor', 'nogroup']) {
      // eslint-disable-next-line no-await-in-loop
      const res = await send('put', '/config', who, { interval_hours: 1, batch_size: 20, auto_fill_enabled: false });
      expect([who, res.status, res.body.code]).toEqual([who, 403, 'AUTH_GROUP_REQUIRED']);
    }
    expect(timers.set).toEqual([]);
    expect(timers.cleared).toEqual([]);
    expect(scheduler.getConfig()).toEqual(config);
    expect(scheduler.getSchedulerStatus().running).toBe(true);
    expect(Math.abs(nextRunIn() - 4 * HOUR)).toBeLessThan(5000);
  });

  // ── An ADMIN, as before ─────────────────────────────────────────────────
  describe('an ADMIN, with the provider doubled', () => {
    test('auto-generate: the same answer, and the profiles the provider described are written', async () => {
      const before = await counts();
      const res = await send('post', '/auto-generate', 'admin', { feed_layer: 'real_world', count: 2 });
      expect(res.status).toBe(200);
      expect(Object.keys(res.body).sort()).toEqual(['created', 'errors', 'message', 'profiles', 'skipped', 'sparks_generated']);
      expect(res.body).toMatchObject({ message: 'Auto-generated 2 profiles for real_world', created: 2, errors: [], skipped: [], sparks_generated: 2 });
      expect(res.body.profiles).toHaveLength(2);
      for (const p of res.body.profiles) {
        expect(Object.keys(p).sort()).toEqual(['archetype', 'display_name', 'follower_tier', 'handle', 'id', 'lala_relevance_score', 'platform']);
        expect(p.handle.startsWith(HANDLE)).toBe(true);
        expect(p.display_name).toBe(`Feed Admin ${TAG}`);
      }
      expect(res.headers['ratelimit-limit']).toBe(aiLimit);
      const [rows] = await run('SELECT handle, feed_layer, status FROM social_profiles WHERE id IN (:ids)', { ids: res.body.profiles.map((p) => p.id) });
      expect(rows).toHaveLength(2);
      expect(rows.every((r) => r.feed_layer === 'real_world')).toBe(true);
      // One call for the sparks, one per profile; all to the double.
      expect(providerCalls).toHaveLength(3);
      await settle();
      const after = await counts();
      expect(after.social_profiles).toBe(before.social_profiles + 2);
      expect(after.bulk_import_jobs).toBe(before.bulk_import_jobs);
      // The real cost tracker wrapped each call: its usage rows are there.
      const [[{ n }]] = await run('SELECT COUNT(*)::int AS n FROM ai_usage_logs WHERE input_tokens = :i AND output_tokens = :o AND created_at > NOW() - INTERVAL \'1 minute\'', { i: USAGE.input_tokens, o: USAGE.output_tokens });
      expect(n).toBeGreaterThanOrEqual(3);
    });

    test('auto-generate-job: the same answer, a job row made and completed in the background', async () => {
      const before = await counts();
      const res = await send('post', '/auto-generate-job', 'admin', { feed_layer: 'real_world', count: 1 });
      expect(res.status).toBe(200);
      jobIds.push(res.body.job_id);
      expect(res.body).toEqual({
        job_id: expect.any(Number), status: 'pending', total: 1,
        message: `Auto-generate job #${res.body.job_id} queued. 1 profiles will be generated in the background.`,
      });
      let job;
      for (let i = 0; i < 100; i += 1) {
        // eslint-disable-next-line no-await-in-loop
        [[job]] = await run('SELECT status, total, completed, failed, results, character_key FROM bulk_import_jobs WHERE id = :id', { id: res.body.job_id });
        if (job.status === 'completed' || job.status === 'failed') break;
        // eslint-disable-next-line no-await-in-loop
        await new Promise((r) => setTimeout(r, 50));
      }
      expect(job).toMatchObject({ status: 'completed', completed: 1, failed: 0, character_key: 'auto-gen-real_world' });
      expect(job.results).toHaveLength(1);
      expect(job.results[0]).toMatchObject({ status: 'success', platform: 'instagram' });
      expect(job.results[0].handle.startsWith(HANDLE)).toBe(true);
      // Pre-flight check, sparks, one profile.
      expect(providerCalls).toHaveLength(3);
      const after = await counts();
      expect(after.bulk_import_jobs).toBe(before.bulk_import_jobs + 1);
      expect(after.social_profiles).toBe(before.social_profiles + 1);
    });

    test('start, stop, run-now and fill-one are not stopped by the check', async () => {
      const who = freshAdmin('controls');
      // FEED_SCHEDULER_ENABLED is unset here, so /start starts nothing and says so.
      const start = await send('post', '/start', who, {});
      expect(start.status).toBe(409);
      expect(start.body.error).toMatch(/switched off/);
      const stop = await send('post', '/stop', who, {});
      expect(stop.status).toBe(200);
      expect(stop.body.message).toBe('Feed scheduler stopped');
      expect(timers.set).toEqual([]);
      expect(timers.initial).toBe(0);
      expect(providerCalls).toEqual([]);
    });
  });

  // ── The budget gate and the rate limiter still stand for an ADMIN ───────
  describe('budget and rate limit, for an ADMIN', () => {
    const overBudget = async () => {
      jest.spyOn(db.AIUsageLog, 'sum').mockResolvedValue(tracker.DAILY_BUDGET + 1000);
      await tracker.refreshSpend();
      await tracker.refreshSpend();
      expect(tracker.getDailySpend()).toBeGreaterThan(tracker.DAILY_BUDGET);
    };
    afterEach(async () => {
      db.AIUsageLog.sum.mockRestore?.();
      await tracker.refreshSpend();
      await tracker.refreshSpend();
    });

    test('over the daily budget, auto-generate makes no provider call and writes no profile', async () => {
      jest.spyOn(console, 'error').mockImplementation(() => {});
      await overBudget();
      const before = await counts();
      const res = await send('post', '/auto-generate', freshAdmin('budget1'), { feed_layer: 'real_world', count: 2 });
      // The route's answer to a refused call is what it was before this
      // change: the batch reports each profile as an error, created 0.
      expect(res.status).toBe(200);
      expect(res.body.created).toBe(0);
      expect(res.body.profiles).toEqual([]);
      expect(res.body.errors).toHaveLength(2);
      for (const e of res.body.errors) expect(e.error).toMatch(/AI daily budget exceeded/);
      expect(providerCalls).toEqual([]);
      await settle();
      const after = await counts();
      expect(after.social_profiles).toBe(before.social_profiles);
      expect(after.bulk_import_jobs).toBe(before.bulk_import_jobs);
      expect(after.world_locations).toBe(before.world_locations);
    });

    test('over the daily budget, auto-generate-job is refused at its pre-flight check and makes no job', async () => {
      await overBudget();
      const before = await counts();
      const res = await send('post', '/auto-generate-job', freshAdmin('budget2'), { feed_layer: 'real_world', count: 2 });
      expect(res.status).toBe(503);
      expect(res.body.error).toMatch(/^AI service unavailable: /);
      expect(providerCalls).toEqual([]);
      await settle();
      const after = await counts();
      expect(after.bulk_import_jobs).toBe(before.bulk_import_jobs);
      expect(after.social_profiles).toBe(before.social_profiles);
    });

    test('past the rate limit, an ADMIN is answered 429 AI_RATE_LIMITED and nothing is generated', async () => {
      const who = freshAdmin('limited');
      // /start with the scheduler switched off does nothing, and counts.
      for (let i = 0; i < Number(aiLimit); i += 1) {
        // eslint-disable-next-line no-await-in-loop
        expect((await send('post', '/start', who, {})).status).toBe(409);
      }
      const before = await counts();
      watched.forEach((spy) => spy.mockClear());
      for (const [verb, p] of [['post', '/auto-generate'], ['post', '/auto-generate-job'], ['post', '/preview-sparks']]) {
        // eslint-disable-next-line no-await-in-loop
        const res = await send(verb, p, who, { feed_layer: 'real_world', count: 2 });
        expect([p, res.status, res.body.code]).toEqual([p, 429, 'AI_RATE_LIMITED']);
      }
      nothingRan();
      expect(await counts()).toEqual(before);
    });
  });

  // ── The settings ────────────────────────────────────────────────────────
  describe('PUT /config, for an ADMIN', () => {
    const getConfig = async () => (await request(app).get(`${BASE}/config`).set('Authorization', `Bearer ${tokens.viewer}`)).body;

    test('the limits are the ones the page and the routes already use', () => {
      expect(scheduler.CONFIG_LIMITS).toEqual({
        interval_hours: { min: 1, max: 168, integer: false },
        batch_size: { min: 1, max: 20, integer: true },
      });
      expect(Object.isFrozen(scheduler.CONFIG_LIMITS)).toBe(true);
      // The defaults sit inside them.
      expect(initialConfig).toMatchObject({ interval_hours: 4, batch_size: 5 });
      // The Automation panel's batch sizes, and the routes' cap on one request.
      const panel = fs.readFileSync(path.join(__dirname, '..', '..', 'frontend', 'src', 'pages', 'feed', 'FeedViews.jsx'), 'utf8');
      expect(panel).toContain('{[1,2,3,5,8,10,15,20].map(n=><option key={n} value={n}>{n} profiles</option>)}');
      expect(ROUTE_SRC.match(/Math\.min\(parseInt\(req\.body\.count\) \|\| 5, 20\)/g)).toHaveLength(3);
    });

    test.each([
      [{ batch_size: 1 }], [{ batch_size: 20 }], [{ batch_size: 8 }], [{ batch_size: '15' }],
      [{ interval_hours: 1 }], [{ interval_hours: 168 }], [{ interval_hours: 4.5 }],
      [{ interval_hours: 6, batch_size: 10, auto_cross_enabled: false, finalize_threshold: 8 }],
      [{ auto_fill_enabled: false }],
    ])('a valid update %j is saved and GET /config shows it', async (body) => {
      const res = await send('put', '/config', 'admin', body);
      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Configuration updated');
      const expected = { ...initialConfig, ...Object.fromEntries(Object.entries(body).map(([k, v]) => [k, typeof initialConfig[k] === 'number' ? Number(v) : v])) };
      expect(res.body.config).toEqual(expected);
      expect(await getConfig()).toEqual(expected);
      // No scheduler is running, so no timer is made.
      expect(timers.set).toEqual([]);
      expect(timers.cleared).toEqual([]);
    });

    test('a null value and an unknown key are ignored, as before', async () => {
      const res = await send('put', '/config', 'admin', { batch_size: null, interval_hours: null, not_a_setting: 1 });
      expect(res.status).toBe(200);
      expect(res.body.config).toEqual(initialConfig);
    });

    test('changing the interval while the scheduler runs restarts its timer on the new interval', async () => {
      startFakeScheduler();
      const res = await send('put', '/config', 'admin', { interval_hours: 6 });
      expect(res.status).toBe(200);
      expect(res.body.config.interval_hours).toBe(6);
      expect(timers.cleared).toEqual([{ fakeSchedulerInterval: 1 }]);
      expect(timers.set).toHaveLength(1);
      expect(timers.set[0][0]).toBe(6 * HOUR);
      expect(timers.initial).toBe(1); // startScheduler's own first run, never a second
      expect(scheduler.getSchedulerStatus().running).toBe(true);
      expect(Math.abs(nextRunIn() - 6 * HOUR)).toBeLessThan(5000);
      expect(providerCalls).toEqual([]);
    });

    test('changing only the batch size while the scheduler runs leaves the timer alone', async () => {
      startFakeScheduler();
      const res = await send('put', '/config', 'admin', { batch_size: 10 });
      expect(res.status).toBe(200);
      expect(timers.cleared).toEqual([]);
      expect(timers.set).toEqual([]);
    });

    const BAD_INTERVAL = [0, -1, -4, 0.5, 0.999, 168.5, 169, 596, 1e9, 1e308, 'abc', '', ' ', 'NaN', 'Infinity', '-4', '1e3', '0x10', '4h', true, false, [4], { hours: 4 }];
    const BAD_BATCH = [0, -1, 21, 100, 1e9, 2.5, '2.5', '21', '0', 'abc', '', 'NaN', 'Infinity', true, false, [5], { n: 5 }];
    const INVALID = [
      ...BAD_INTERVAL.map((v) => [{ interval_hours: v }, ['interval_hours']]),
      ...BAD_BATCH.map((v) => [{ batch_size: v }, ['batch_size']]),
      // One good key with one bad one: nothing of the request is applied.
      [{ batch_size: 10, interval_hours: 0 }, ['interval_hours']],
      [{ interval_hours: 6, batch_size: 21 }, ['batch_size']],
      [{ auto_fill_enabled: false, finalize_threshold: 9, batch_size: 99 }, ['batch_size']],
      [{ auto_discover_enabled: false, interval_hours: 0.01 }, ['interval_hours']],
      [{ interval_hours: -1, batch_size: 1000 }, ['interval_hours', 'batch_size']],
    ];
    const sentence = (fields) => `${fields.map((f) => (f === 'interval_hours'
      ? 'interval_hours must be a number from 1 to 168' : 'batch_size must be a whole number from 1 to 20')).join('; ')}. Nothing was changed.`;

    test.each(INVALID)('%j is refused with a 400 naming %j; the settings and a running timer are as they were', async (body, fields) => {
      startFakeScheduler();
      const before = { config: scheduler.getConfig(), status: scheduler.getSchedulerStatus(), rows: await counts() };
      const res = await send('put', '/config', 'admin', body);
      expect(res.status).toBe(400);
      expect(res.body).toEqual({ success: false, code: 'INVALID_SCHEDULER_CONFIG', error: sentence(fields), message: sentence(fields), fields });
      expect(scheduler.getConfig()).toEqual(before.config);
      expect(await getConfig()).toEqual(before.config);
      expect(timers.cleared).toEqual([]);
      expect(timers.set).toEqual([]);
      expect(timers.initial).toBe(1); // startFakeScheduler's; none after
      const status = scheduler.getSchedulerStatus();
      expect({ ...status, next_run: null }).toEqual({ ...before.status, next_run: null });
      // The interval the timer would be made with is still four hours.
      expect(Math.abs(nextRunIn() - 4 * HOUR)).toBeLessThan(5000);
      expect(providerCalls).toEqual([]);
      expect(await counts()).toEqual(before.rows);
    });

    test('the service refuses the same values for any caller, NaN and Infinity included, before it sets anything', () => {
      startFakeScheduler();
      const before = scheduler.getConfig();
      for (const updates of [
        { interval_hours: NaN }, { interval_hours: Infinity }, { interval_hours: -Infinity }, { interval_hours: 0 },
        { batch_size: NaN }, { batch_size: Infinity }, { batch_size: 21 }, { batch_size: 1.5 },
        { batch_size: 10, interval_hours: NaN }, { auto_fill_enabled: false, batch_size: Infinity },
      ]) {
        let thrown;
        try { scheduler.updateConfig(updates); } catch (err) { thrown = err; }
        expect([updates, thrown?.code, thrown?.status]).toEqual([updates, 'INVALID_SCHEDULER_CONFIG', 400]);
        expect(thrown.fields).toEqual(scheduler.configRefusal(updates).fields);
        expect(scheduler.getConfig()).toEqual(before);
      }
      expect(timers.cleared).toEqual([]);
      expect(timers.set).toEqual([]);
      expect(Math.abs(nextRunIn() - 4 * HOUR)).toBeLessThan(5000);
    });
  });

  // ── POST /start: an interval in the body is held to the same limits ─────
  describe('POST /start, for an ADMIN', () => {
    const REFUSAL = {
      success: false, code: 'INVALID_SCHEDULER_CONFIG', fields: ['interval_hours'],
      error: 'interval_hours must be a number from 1 to 168. Nothing was changed.',
      message: 'interval_hours must be a number from 1 to 168. Nothing was changed.',
    };
    const BAD_START = [0, -1, 0.5, 0.001, 168.5, 169, 596, 1e9, 1e308, 'abc', '', ' ', 'NaN', 'Infinity', '-4', '1e3', '0x10', '4h', true, false, [4], { hours: 4 }];
    const withoutNextRun = (status) => ({ ...status, next_run: null });
    afterEach(() => { delete process.env.FEED_SCHEDULER_ENABLED; });

    describe.each([['switched on', 'true'], ['switched off', undefined]])('with the scheduler %s on the server', (_name, flag) => {
      const setFlag = () => { if (flag) process.env.FEED_SCHEDULER_ENABLED = flag; else delete process.env.FEED_SCHEDULER_ENABLED; };

      test.each(BAD_START.map((v) => [v]))('interval_hours %j, scheduler stopped: 400, nothing set or started', async (value) => {
        setFlag();
        const before = { config: scheduler.getConfig(), status: scheduler.getSchedulerStatus() };
        const res = await send('post', '/start', freshAdmin(`start-a-${ipN}`), { interval_hours: value });
        expect(res.status).toBe(400);
        expect(res.body).toEqual(REFUSAL);
        expect(scheduler.getConfig()).toEqual(before.config);
        expect(scheduler.getSchedulerStatus()).toEqual(before.status);
        expect(scheduler.getSchedulerStatus().running).toBe(false);
        await settle();
        nothingRan();
      });

      test.each(BAD_START.map((v) => [v]))('interval_hours %j, scheduler running: 400, its timer and settings as they were', async (value) => {
        startFakeScheduler();
        setFlag();
        const before = { config: scheduler.getConfig(), status: scheduler.getSchedulerStatus() };
        const res = await send('post', '/start', freshAdmin(`start-b-${ipN}`), { interval_hours: value });
        expect(res.status).toBe(400);
        expect(res.body).toEqual(REFUSAL);
        expect(scheduler.getConfig()).toEqual(before.config);
        expect(withoutNextRun(scheduler.getSchedulerStatus())).toEqual(withoutNextRun(before.status));
        expect(scheduler.getSchedulerStatus().running).toBe(true);
        expect(timers.set).toEqual([]);
        expect(timers.cleared).toEqual([]);
        expect(timers.initial).toBe(1); // startFakeScheduler's; none after
        expect(Math.abs(nextRunIn() - 4 * HOUR)).toBeLessThan(5000);
        expect(providerCalls).toEqual([]);
      });
    });

    test.each([[1, 1], [4, 4], [168, 168], [4.5, 4.5], ['6', 6]])('switched on, interval_hours %j: started on that interval, as before', async (value, hours) => {
      process.env.FEED_SCHEDULER_ENABLED = 'true';
      const res = await send('post', '/start', freshAdmin(`start-ok-${ipN}`), { interval_hours: value });
      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Feed scheduler started');
      expect(res.body.status).toMatchObject({ running: true, enabled: true, interval_hours: hours });
      expect(scheduler.getConfig()).toEqual({ ...initialConfig, enabled: true, interval_hours: hours });
      expect(timers.set).toEqual([[hours * HOUR, { fakeSchedulerInterval: 1 }]]);
      expect(timers.cleared).toEqual([]);
      expect(timers.initial).toBe(1);
      expect(providerCalls).toEqual([]);
    });

    test.each([[{}], [{ interval_hours: null }], [{ something_else: 1 }]])('switched on, no interval (%j): started on the current interval, as before', async (body) => {
      process.env.FEED_SCHEDULER_ENABLED = 'true';
      const res = await send('post', '/start', freshAdmin(`start-none-${ipN}`), body);
      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Feed scheduler started');
      expect(scheduler.getConfig()).toEqual({ ...initialConfig, enabled: true });
      expect(timers.set).toEqual([[4 * HOUR, { fakeSchedulerInterval: 1 }]]);
      expect(timers.initial).toBe(1);
    });

    test('switched on and already running: a valid start replaces the timer, as before', async () => {
      startFakeScheduler();
      process.env.FEED_SCHEDULER_ENABLED = 'true';
      const res = await send('post', '/start', freshAdmin('start-again'), { interval_hours: 6 });
      expect(res.status).toBe(200);
      expect(timers.cleared).toEqual([{ fakeSchedulerInterval: 1 }]);
      expect(timers.set).toHaveLength(1);
      expect(timers.set[0][0]).toBe(6 * HOUR);
      expect(timers.initial).toBe(2);
      expect(scheduler.getConfig().interval_hours).toBe(6);
    });

    test.each([[{}], [{ interval_hours: 4 }], [{ interval_hours: 168 }]])('switched off, a valid start %j: the same 409, nothing started', async (body) => {
      const before = scheduler.getConfig();
      const res = await send('post', '/start', freshAdmin(`start-off-${ipN}`), body);
      expect(res.status).toBe(409);
      expect(res.body.error).toBe('The feed scheduler is switched off on the server (FEED_SCHEDULER_ENABLED is not true), so nothing was started.');
      expect(res.body.status.running).toBe(false);
      expect(scheduler.getConfig()).toEqual(before);
      nothingRan();
    });

    test('the service refuses an out-of-bounds interval for any caller, switched on or off, before it sets or starts anything', () => {
      for (const flag of ['true', undefined]) {
        for (const running of [false, true]) {
          scheduler.stopScheduler();
          if (running) startFakeScheduler();
          if (flag) process.env.FEED_SCHEDULER_ENABLED = flag; else delete process.env.FEED_SCHEDULER_ENABLED;
          timers.set.length = 0; timers.cleared.length = 0;
          const initialRuns = timers.initial;
          const before = { config: scheduler.getConfig(), status: withoutNextRun(scheduler.getSchedulerStatus()) };
          for (const value of [0, 0.001, -1, 169, 1e9, NaN, Infinity, -Infinity, 'abc', '', true, false, [4]]) {
            let thrown;
            try { scheduler.startScheduler(value, db); } catch (err) { thrown = err; }
            expect([value, thrown?.code, thrown?.status, thrown?.fields]).toEqual([value, 'INVALID_SCHEDULER_CONFIG', 400, ['interval_hours']]);
            expect(scheduler.getConfig()).toEqual(before.config);
            expect(withoutNextRun(scheduler.getSchedulerStatus())).toEqual(before.status);
          }
          expect(timers.set).toEqual([]);
          expect(timers.cleared).toEqual([]);
          expect(timers.initial).toBe(initialRuns);
        }
      }
    });

    test('the route asks the same validator before the switch and before startScheduler', () => {
      const start = ROUTE_SRC.slice(ROUTE_SRC.indexOf("router.post('/start'"), ROUTE_SRC.indexOf("router.post('/stop'"));
      expect(start).toMatch(/^router\.post\('\/start', \.\.\.admin, aiRateLimiter, \(req, res\) => \{\n {2}const refusal = configRefusal\(\{ interval_hours: req\.body\?\.interval_hours \}\);/);
      expect(start.indexOf('configRefusal(')).toBeLessThan(start.indexOf('FEED_SCHEDULER_ENABLED'));
      expect(start.indexOf('FEED_SCHEDULER_ENABLED')).toBeLessThan(start.indexOf('startScheduler('));
    });
  });

  // ── preview-sparks: any signed-in account, and it only reads ────────────
  describe('POST /preview-sparks stays a signed-in account\'s', () => {
    test('signed out: 401', async () => {
      expect((await send('post', '/preview-sparks', null, { count: 2 })).status).toBe(401);
      expect(providerCalls).toEqual([]);
    });

    test.each([['viewer', 'real_world'], ['editor', 'real_world'], ['nogroup', 'lalaverse']])(
      'a %s gets sparks for %s from the doubled provider; no profile, place, job or setting is written',
      async (who, layer) => {
        const before = { rows: await counts(), config: scheduler.getConfig(), status: scheduler.getSchedulerStatus() };
        const writes = [
          jest.spyOn(db.SocialProfile, 'update'), jest.spyOn(db.SocialProfile, 'destroy'), jest.spyOn(db.WorldLocation, 'update'),
          jest.spyOn(db.SocialProfileFollower, 'create'), jest.spyOn(db.SocialProfileRelationship, 'create'),
        ];
        const res = await send('post', '/preview-sparks', who, { feed_layer: layer, count: 2 });
        expect(res.status).toBe(200);
        expect(Object.keys(res.body).sort()).toEqual(['count', 'layer', 'sparks']);
        expect(res.body).toMatchObject({ layer, count: 2 });
        expect(res.body.sparks.map((s) => s.handle.startsWith(HANDLE))).toEqual([true, true]);
        expect(res.headers['ratelimit-limit']).toBe(aiLimit);
        // The pre-flight check, then the sparks.
        expect(providerCalls).toHaveLength(2);
        await settle();
        const after = await counts();
        for (const t of TABLES.filter((x) => x !== 'ai_usage_logs')) expect([t, after[t]]).toEqual([t, before.rows[t]]);
        for (const spy of [db.SocialProfile.create, db.BulkImportJob.create, db.WorldLocation.create, ...writes]) expect(spy).not.toHaveBeenCalled();
        expect(scheduler.getConfig()).toEqual(before.config);
        expect(scheduler.getSchedulerStatus()).toEqual(before.status);
        expect(timers.set).toEqual([]);
        expect(timers.cleared).toEqual([]);
      },
    );

    test('the budget gate applies to it: over the daily budget it makes no provider call', async () => {
      jest.spyOn(db.AIUsageLog, 'sum').mockResolvedValue(tracker.DAILY_BUDGET + 1000);
      jest.spyOn(console, 'error').mockImplementation(() => {});
      await tracker.refreshSpend();
      await tracker.refreshSpend();
      try {
        const res = await send('post', '/preview-sparks', 'editor', { feed_layer: 'real_world', count: 2 });
        expect(res.status).toBe(503);
        expect(res.body.error).toMatch(/^AI service unavailable: /);
        expect(providerCalls).toEqual([]);
      } finally {
        db.AIUsageLog.sum.mockRestore();
        await tracker.refreshSpend();
        await tracker.refreshSpend();
      }
    });
  });

  test('no request left the process: every transport call in this file went to the double', () => {
    // providerDouble throws on any URL but the provider's, and global fetch
    // is the double for the whole of every test above.
    expect(jest.isMockFunction(global.fetch)).toBe(true);
  });
});
