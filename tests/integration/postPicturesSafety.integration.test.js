/**
 * #3714 R2: automatic post pictures off by default, and paid outcomes kept
 * apart, against the test database through the services and the routes.
 * The image tool and the storage upload are faked; nothing goes to the
 * network.
 *   - POST_PICTURES_AUTO_ENABLED unset: a scheduled post is still
 *     published, its picture waits ('waiting_auto_off', Make now), and the
 *     release timer's runWaiting makes nothing; a pending job left by a
 *     restart (no paid call yet) waits too
 *   - a 'making' job past the window becomes 'interrupted' (either
 *     setting) and is never made again on its own; Make now without
 *     confirm_unknown is refused (409 PICTURE_OUTCOME_UNKNOWN) with no
 *     image call; with it, the picture is made once
 *   - a run that may have reached the image service (a timeout) is
 *     'uncertain', not 'failed'; Retry is refused without confirm_unknown;
 *     dismiss resolves it with no image call
 *   - a definite outcome (the image budget refused it) is still 'failed'
 *     and Retry works as before
 *   - approving again never turns an uncertain job back into pending
 */
jest.unmock('uuid');

const mockCreate = jest.fn();
jest.mock('@anthropic-ai/sdk', () => jest.fn().mockImplementation(() => ({ messages: { create: mockCreate } })));

const crypto = require('crypto');
const request = require('supertest');
const axios = require('axios');
const app = require('../../src/app');
const TokenService = require('../../src/services/tokenService');
const models = require('../../src/models');
const postRelease = require('../../src/services/postRelease');
const postPictures = require('../../src/services/postPictures');
const pulseImage = require('../../src/services/pulseImageService');

const { sequelize } = models;
const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const uuid = () => crypto.randomUUID();
const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });
const q = (sql, replacements = {}) => sequelize.query(sql, { replacements, type: sequelize.QueryTypes.SELECT });
const sleep = (ms) => new Promise((r) => { setTimeout(r, ms); });

(shouldSkip ? describe.skip : describe)('#3714 R2: automatic post pictures and paid outcomes', () => {
  const tag = uuid().slice(0, 8);
  const ids = { show: uuid(), reg: uuid(), maren: uuid() };
  const pids = {};
  const posts = [];
  let admin;
  let stored = 0;
  const savedAuto = process.env.POST_PICTURES_AUTO_ENABLED;
  const as = (req) => req.set('Authorization', `Bearer ${admin}`);
  const imageCalls = () => axios.post.mock.calls.map((c) => c[0]).filter((u) => /images\/(edits|generations)/.test(String(u)));
  const jobOf = async (id) => (await q('SELECT picture_job FROM feed_posts WHERE id = :id', { id }))[0].picture_job;
  const statusOf = async (id) => (await q('SELECT status FROM feed_posts WHERE id = :id', { id }))[0].status;
  const waitFor = async (id, states) => {
    for (let i = 0; i < 80; i += 1) {
      const job = await jobOf(id);
      if (job && states.includes(job.state)) return job;
      await sleep(50);
    }
    return jobOf(id);
  };
  const post = async ({ status = 'live', scheduled = false, job = null } = {}) => {
    const id = uuid();
    await run(`INSERT INTO feed_posts (id, show_id, poster_handle, social_profile_id, content_text, status, post_format,
                 release_state, release_at, posted_at, picture_job, created_at, updated_at)
               VALUES (:id, :show, :handle, :pid, 'flour on the counter at dawn', :status, 'post',
                 CASE WHEN :scheduled THEN 'scheduled' ELSE NULL END, CASE WHEN :scheduled THEN NOW() - INTERVAL '1 minute' ELSE NULL END,
                 CASE WHEN :status = 'live' THEN NOW() ELSE NULL END, CAST(:job AS JSONB), NOW(), NOW())`,
    { id, show: ids.show, handle: `safe${tag}`, pid: pids.maren, status, scheduled, job: job ? JSON.stringify(job) : null });
    posts.push(id);
    return id;
  };
  const ago = (minutes) => new Date(Date.now() - minutes * 60000).toISOString();

  beforeAll(async () => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || 'test-key';
    admin = TokenService.generateTokenPair({ id: 'test-admin-pps', email: 'evoni@pps.dev', name: 'Evoni', groups: ['ADMIN'], role: 'ADMIN' }).accessToken;
    await run('INSERT INTO shows (id, name, slug, created_at, updated_at) VALUES (:show, :name, :slug, NOW(), NOW())',
      { show: ids.show, name: `PPS show ${tag}`, slug: `pps-show-${tag}` });
    await run("INSERT INTO character_registries (id, title, show_id, created_at, updated_at) VALUES (:reg, 'PPS reg', :show, NOW(), NOW())", ids);
    const [[p]] = await run(`INSERT INTO social_profiles (handle, platform, vibe_sentence, display_name, feed_layer, full_profile, created_at, updated_at)
      VALUES (:h, 'pulse', 'test', 'PPS Maren', 'lalaverse', '{}'::jsonb, NOW(), NOW()) RETURNING id`, { h: `ppsmaren${tag}` });
    pids.maren = p.id;
    await run(`INSERT INTO registry_characters (id, registry_id, character_key, display_name, world, feed_profile_id, extra_fields, created_at, updated_at)
       VALUES (:id, :reg, :key, 'PPS Maren', 'lalaverse', :pid, '{}'::jsonb, NOW(), NOW())`, { id: ids.maren, reg: ids.reg, key: `pps-maren-${tag}`, pid: pids.maren });
    jest.spyOn(axios, 'post').mockImplementation(async () => ({ data: { data: [{ b64_json: 'iVBORw0KGgo=' }] } }));
    jest.spyOn(axios, 'get').mockImplementation(async () => ({ data: Buffer.from('iVBORw0KGgo=', 'base64'), headers: { 'content-type': 'image/png' } }));
    jest.spyOn(pulseImage, 'storePulseImage').mockImplementation(async () => {
      stored += 1;
      return { url: `https://cdn.test/${tag}/made-${stored}.jpg`, key: `pps/${tag}-${stored}.jpg`, width: 1536, height: 1024 };
    });
    const head = await as(request(app).put(`/api/v1/camera-roll/characters/${ids.maren}/headshot`)).send({ url: `https://cdn.test/${tag}/headshot.jpg` });
    expect(head.status).toBe(200);
  });

  afterAll(async () => {
    jest.restoreAllMocks();
    if (savedAuto === undefined) delete process.env.POST_PICTURES_AUTO_ENABLED; else process.env.POST_PICTURES_AUTO_ENABLED = savedAuto;
    await run('DELETE FROM camera_roll_moments WHERE character_id = :maren', ids);
    await run('DELETE FROM media_asset_sources WHERE asset_id IN (SELECT id FROM media_assets WHERE url LIKE :pre)', { pre: `https://cdn.test/${tag}/%` });
    await run('DELETE FROM media_asset_links WHERE asset_id IN (SELECT id FROM media_assets WHERE url LIKE :pre)', { pre: `https://cdn.test/${tag}/%` });
    await run('DELETE FROM media_assets WHERE url LIKE :pre', { pre: `https://cdn.test/${tag}/%` });
    await run("DELETE FROM ai_usage_logs WHERE route_name IN ('pulse-post-picture', 'camera-roll') AND created_at > NOW() - INTERVAL '1 hour'");
    if (posts.length) await run('DELETE FROM feed_posts WHERE id IN (:posts)', { posts });
    await run('DELETE FROM registry_characters WHERE id = :maren', ids);
    await run('DELETE FROM social_profiles WHERE id = :p', { p: pids.maren });
    await run('DELETE FROM character_registries WHERE id = :reg', ids);
    await run('DELETE FROM shows WHERE id = :show', ids);
  });

  beforeEach(() => {
    axios.post.mockClear();
    delete process.env.POST_PICTURES_AUTO_ENABLED;
  });

  describe('POST_PICTURES_AUTO_ENABLED off (the default)', () => {
    test('a scheduled post is still published; its picture waits for Make now; no image call', async () => {
      expect(postPictures.autoEnabled()).toBe(false);
      const id = await post({ status: 'draft', scheduled: true });
      const released = await postRelease.releaseDue(models);
      expect(released).toContain(id);
      expect(await statusOf(id)).toBe('live');
      await sleep(300);
      expect(await jobOf(id)).toMatchObject({ state: 'waiting_auto_off', count: 1 });
      expect(imageCalls()).toEqual([]);

      // Make now is hers: it makes the picture.
      const now = await as(request(app).post(`/api/v1/post-media/posts/${id}/picture`)).send({ make_now: true });
      expect(now.status).toBe(200);
      expect(now.body.job).toMatchObject({ state: 'made' });
      expect(imageCalls()).toHaveLength(1);
    });

    test('the release timer makes nothing: waiting and restart-pending jobs wait (pending made no paid call)', async () => {
      const waiting = await post({ job: { state: 'waiting_cap', count: 1 } });
      const pending = await post({ job: { state: 'pending', count: 1, queued_at: ago(30) } });
      expect(await postPictures.runWaiting(models)).toEqual([]);
      expect(imageCalls()).toEqual([]);
      expect(await jobOf(waiting)).toMatchObject({ state: 'waiting_cap' });
      expect(await jobOf(pending)).toMatchObject({ state: 'waiting_auto_off' });
    });

    test('the release timer itself still starts in app.js, outside tests, with no switch', () => {
      const src = require('fs').readFileSync(require('path').join(__dirname, '../../src/app.js'), 'utf8');
      expect(src).toMatch(/if \(process\.env\.NODE_ENV !== 'test'\) require\('\.\/services\/postRelease'\)\.startScheduler\(db\);/);
    });
  });

  describe('POST_PICTURES_AUTO_ENABLED=true', () => {
    test('a scheduled post gets its picture after its release, as before', async () => {
      process.env.POST_PICTURES_AUTO_ENABLED = 'true';
      const id = await post({ status: 'draft', scheduled: true });
      await postRelease.releaseDue(models);
      expect(await waitFor(id, ['made', 'failed', 'uncertain'])).toMatchObject({ state: 'made' });
      expect(imageCalls()).toHaveLength(1);
    });

    test('a pending job left by a restart (no paid call yet) is made by the timer', async () => {
      process.env.POST_PICTURES_AUTO_ENABLED = 'true';
      const id = await post({ job: { state: 'pending', count: 1, queued_at: ago(30) } });
      const done = await postPictures.runWaiting(models);
      expect(done.map((d) => d.id)).toContain(id);
      expect(await jobOf(id)).toMatchObject({ state: 'made' });
    });
  });

  describe('interrupted runs (either setting)', () => {
    test.each([[undefined], ['true']])('POST_PICTURES_AUTO_ENABLED=%j: a stale making job becomes interrupted and is not made again', async (auto) => {
      if (auto) process.env.POST_PICTURES_AUTO_ENABLED = auto;
      const id = await post({ job: { state: 'making', count: 1, claimed_at: ago(30) } });
      await postPictures.runWaiting(models);
      expect(await jobOf(id)).toMatchObject({ state: 'interrupted', error: expect.stringMatching(/may already have been made/) });
      expect(imageCalls()).toEqual([]);
      await postPictures.runWaiting(models);
      expect(imageCalls()).toEqual([]);
    });

    test('Make now on an interrupted job is refused without confirm_unknown, then made once with it', async () => {
      const id = await post({ job: { state: 'interrupted', count: 1 } });
      const refused = await as(request(app).post(`/api/v1/post-media/posts/${id}/picture`)).send({ make_now: true });
      expect(refused.status).toBe(409);
      expect(refused.body.code).toBe('PICTURE_OUTCOME_UNKNOWN');
      expect(imageCalls()).toEqual([]);
      const ok = await as(request(app).post(`/api/v1/post-media/posts/${id}/picture`)).send({ make_now: true, confirm_unknown: true });
      expect(ok.status).toBe(200);
      expect(ok.body.job).toMatchObject({ state: 'made', remade_after: 'interrupted' });
      expect(imageCalls()).toHaveLength(1);
    });

    test('a stale making job is not taken over by a plain run either (claim no longer re-claims it)', async () => {
      const id = await post({ job: { state: 'making', count: 1, claimed_at: ago(30) } });
      const refused = await as(request(app).post(`/api/v1/post-media/posts/${id}/picture`)).send({ make_now: true });
      expect(refused.status).toBe(409);
      expect(refused.body.code).toBe('PICTURE_OUTCOME_UNKNOWN');
      expect(await postPictures.claim(models, id)).toBe(false);
      expect(imageCalls()).toEqual([]);
    });
  });

  describe('uncertain and definite outcomes', () => {
    test('a timeout from the image service is uncertain, not failed; Retry needs confirm_unknown; dismiss resolves it with no call', async () => {
      const id = await post({ status: 'live' });
      axios.post.mockImplementationOnce(async () => { throw Object.assign(new Error('timeout of 120000ms exceeded'), { code: 'ECONNABORTED' }); });
      const first = await as(request(app).post(`/api/v1/post-media/posts/${id}/picture`)).send({ make_now: true });
      expect(first.status).toBeGreaterThanOrEqual(500);
      const job = await jobOf(id);
      expect(job).toMatchObject({ state: 'uncertain', paid_attempts: 1, error: expect.stringMatching(/may already have been made and charged/) });
      expect(imageCalls()).toHaveLength(1);

      const retry = await as(request(app).post(`/api/v1/post-media/posts/${id}/picture`)).send({ make_now: false });
      expect(retry.status).toBe(409);
      expect(retry.body.code).toBe('PICTURE_OUTCOME_UNKNOWN');
      expect(imageCalls()).toHaveLength(1);

      // Approving again never turns it back into a pending (automatic) job.
      expect(await postPictures.queue(models, id)).toMatchObject({ state: 'uncertain' });

      const dismissed = await as(request(app).post(`/api/v1/post-media/posts/${id}/picture/dismiss`)).send({ note: 'Checked: not in the roll' });
      expect(dismissed.status).toBe(200);
      expect(dismissed.body.job).toMatchObject({ state: 'skipped', dismissed_from: 'uncertain', reason: 'Checked: not in the roll' });
      expect(imageCalls()).toHaveLength(1);
    });

    test.each([
      ['a blank (blocked) picture comes back', 'blank'],
      ['storing the picture fails after the call', 'store'],
      ['the image service replies without an image', 'empty'],
    ])('%s: uncertain (the request was sent and may be charged), and neither Make now nor Retry re-sends it', async (_label, kind) => {
      const id = await post({ status: 'live' });
      const appearance = require('../../src/services/characterAppearance');
      if (kind === 'blank') jest.spyOn(appearance, 'isBlank').mockResolvedValueOnce(true);
      if (kind === 'store') pulseImage.storePulseImage.mockRejectedValueOnce(Object.assign(new Error('Upload refused: too large'), { status: 413 }));
      if (kind === 'empty') axios.post.mockImplementationOnce(async () => ({ data: { data: [{}] } }));
      const first = await as(request(app).post(`/api/v1/post-media/posts/${id}/picture`)).send({ make_now: true });
      expect(first.status).toBeGreaterThanOrEqual(400);
      expect(await jobOf(id)).toMatchObject({ state: 'uncertain', paid_attempts: 1 });
      expect(imageCalls()).toHaveLength(1);
      for (const body of [{ make_now: true }, { make_now: false }]) {
        const again = await as(request(app).post(`/api/v1/post-media/posts/${id}/picture`)).send(body);
        expect(again.status).toBe(409);
        expect(again.body.code).toBe('PICTURE_OUTCOME_UNKNOWN');
      }
      expect(imageCalls()).toHaveLength(1);
    });

    test('a carousel that fails on its second picture (the first made and paid) is uncertain, not failed', async () => {
      const id = uuid();
      await run(`INSERT INTO feed_posts (id, show_id, poster_handle, social_profile_id, content_text, status, post_format, posted_at, created_at, updated_at)
                 VALUES (:id, :show, :handle, :pid, 'three looks from the market', 'live', 'carousel', NOW(), NOW(), NOW())`,
      { id, show: ids.show, handle: `safe${tag}`, pid: pids.maren });
      posts.push(id);
      let n = 0;
      axios.post.mockImplementation(async () => {
        n += 1;
        if (n === 2) throw Object.assign(new Error('socket hang up'), { code: 'ECONNRESET' });
        return { data: { data: [{ b64_json: 'iVBORw0KGgo=' }] } };
      });
      try {
        const r = await as(request(app).post(`/api/v1/post-media/posts/${id}/picture`)).send({ make_now: true });
        expect(r.status).toBeGreaterThanOrEqual(400);
      } finally {
        axios.post.mockImplementation(async () => ({ data: { data: [{ b64_json: 'iVBORw0KGgo=' }] } }));
      }
      const job = await jobOf(id);
      expect(job).toMatchObject({ state: 'uncertain', paid_attempts: 2 });
      expect(job.asset_ids).toHaveLength(1);
    });

    test('dismiss refuses a job that is not interrupted or uncertain', async () => {
      const id = await post({ job: { state: 'made', count: 1 } });
      const r = await as(request(app).post(`/api/v1/post-media/posts/${id}/picture/dismiss`)).send({});
      expect(r.status).toBe(409);
    });

    test('a budget refusal is definite: failed, and Retry works as before', async () => {
      const id = await post({ status: 'live' });
      // The real image budget gate: a cap below one picture's estimate refuses it.
      const savedCap = process.env.AI_DAILY_IMAGE_BUDGET_USD;
      process.env.AI_DAILY_IMAGE_BUDGET_USD = '0.01';
      let first;
      try {
        first = await as(request(app).post(`/api/v1/post-media/posts/${id}/picture`)).send({ make_now: true });
      } finally {
        if (savedCap === undefined) delete process.env.AI_DAILY_IMAGE_BUDGET_USD; else process.env.AI_DAILY_IMAGE_BUDGET_USD = savedCap;
      }
      expect(first.status).toBe(429);
      expect(await jobOf(id)).toMatchObject({ state: 'failed' });
      expect(imageCalls()).toEqual([]);
      const retry = await as(request(app).post(`/api/v1/post-media/posts/${id}/picture`)).send({ make_now: true });
      expect(retry.status).toBe(200);
      expect(retry.body.job).toMatchObject({ state: 'made' });
    });
  });
});
