/**
 * An old base image a saved scene still shows is not deleted (Evoni,
 * 2026-11-24;
 * docs/audit/F-AUTH-1_BaseImageStillUsedByScenes_Amendment_2026-11-24.md).
 *
 * When a set's base is replaced, the previous image's file is deleted from
 * storage unless something still shows it (sceneGenerationService
 * deleteOldBaseImage / imageStillUsed). The check looked at angles, approved
 * location bases and other sets' bases. It did not look at saved scenes:
 * scenes.background_url holds a copy of the base's URL (beatScenesService
 * copies it for a beat on the set's base; Scene Studio saves the background
 * it was shown). A scene still on the old base lost its file. The check now
 * includes live scenes.
 *
 * On the migrated test database. The replacements are the real ones:
 * POST /scene-sets/:id/upload-base, and POST /scene-sets/:id/generate-base
 * (generateBaseScene, with the provider a double). The storage is a double
 * that records every delete by key; no file exists anywhere. Nothing sends
 * DDL. [real race] cases hold one side open with the lock trace's gate or a
 * latch on the storage double.
 */
jest.unmock('uuid');
process.env.S3_PRIMARY_BUCKET = 'img-keep-test-bucket';

const mockAnthropic = jest.fn(async () => { throw new Error('the model is not called in this suite'); });
jest.mock('@anthropic-ai/sdk', () => jest.fn(() => ({ messages: { create: mockAnthropic } })));
jest.mock('axios', () => {
  const actual = jest.requireActual('axios');
  return { ...actual, post: jest.fn(), get: jest.fn(), put: jest.fn(), delete: jest.fn(), request: jest.fn(), create: actual.create };
});
const mockS3Send = jest.fn();
jest.mock('@aws-sdk/client-s3', () => {
  const actual = jest.requireActual('@aws-sdk/client-s3');
  return { ...actual, S3Client: jest.fn(() => ({ send: mockS3Send })) };
});

const request = require('supertest');
const sharp = require('sharp');
const axios = require('axios');
const app = require('../../src/app');
const TokenService = require('../../src/services/tokenService');
const models = require('../../src/models');
const sceneGen = require('../../src/services/sceneGenerationService');
const lockTrace = require('../helpers/lockTrace');
const networkGuard = require('../networkGuard/core');
const { placeLockFixtures } = require('../helpers/placeLockFixtures');

const { sequelize } = models;
const BUCKET = 'img-keep-test-bucket';
const HOST = `https://${BUCKET}.s3.us-east-1.amazonaws.com/`;

const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const open = [];
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const send = (req) => req.then((res) => res);
const settle = (promise) => promise.then((value) => ({ ok: true, value }), (error) => ({ ok: false, error }));

(shouldSkip ? describe.skip : describe)('an old base image a saved scene still shows is kept', () => {
  jest.setTimeout(Number(process.env.IMG_TEST_TIMEOUT_MS) || 90000);
  const fx = placeLockFixtures(sequelize, models);
  const { run, rows, mkShow, mkEpisode, mkSet, mkLocation } = fx;
  const TAG = fx.uuid().slice(0, 8);
  let show;
  let IMAGE;
  let PNG;
  let trace = null;
  let guardEventsAtStart = 0;
  let usageLog;
  const usageLogIds = [];
  const saved = {};
  const storage = { holdDelete: null, failDelete: false };

  let admins = 0;
  const adminToken = () => {
    admins += 1;
    return TokenService.generateTokenPair({ id: `img-admin-${TAG}-${admins}`, email: `admin${admins}@img.dev`, name: 'Admin', groups: ['ADMIN'], role: 'ADMIN' }).accessToken;
  };
  const asAdmin = (r) => r.set('X-Forwarded-For', `10.99.${Math.floor(admins / 250)}.${(admins % 250) + 1}`).set('Authorization', `Bearer ${adminToken()}`);
  const uploadBase = (id) => asAdmin(request(app).post(`/api/v1/scene-sets/${id}/upload-base`)).attach('image', IMAGE, { filename: 'base.png', contentType: 'image/png' });

  const s3Calls = (name) => mockS3Send.mock.calls.map(([cmd]) => cmd).filter((cmd) => cmd?.constructor?.name === name);
  /** The keys the storage was asked to delete. */
  const deleted = () => s3Calls('DeleteObjectCommand').map((cmd) => cmd.input.Key);
  const warnLines = () => console.warn.mock.calls.map((call) => call.map(String).join(' '));

  // ── Fixtures ───────────────────────────────────────────────────────────
  /** A set whose base is an image in the bucket. */
  async function setWithBase() {
    const id = await mkSet(show, `Hall ${fx.uuid().slice(0, 6)}`, { scene_type: 'EVENT_LOCATION', base_model: 'flux-dev', generation_status: 'complete' });
    const key = `scene-sets/${id}/stills/${Date.now()}-base.jpg`;
    const url = `${HOST}${key}`;
    await run('UPDATE scene_sets SET base_still_url = :url WHERE id = :id', { url, id });
    return { id, key, url };
  }
  /** A saved scene of the episode whose background is the given URL. */
  async function scene(ep, backgroundUrl, { removed = false, setId = null, n = 1 } = {}) {
    const id = fx.uuid();
    await run(`INSERT INTO scenes (id, episode_id, scene_number, title, location, background_url, scene_set_id,
                                   duration_seconds, characters, ui_elements, dialogue_clips, scene_type, production_status, deleted_at, created_at, updated_at)
               VALUES (:id, :ep, :n, 'Scene', 'Hall', :backgroundUrl, :setId, 5.0, '[]', '[]', '[]', 'main', 'draft', :deletedAt, NOW(), NOW())`,
    { id, ep, n, backgroundUrl, setId, deletedAt: removed ? new Date() : null });
    return id;
  }
  async function film(ep) {
    const id = fx.uuid();
    await run(`INSERT INTO episode_raw_clips (id, episode_id, show_id, performer, s3_key_raw, key_status, key_strength, created_at, updated_at)
               VALUES (:id, :ep, :show, :performer, :key, 'none', 'medium', NOW(), NOW())`,
    { id, ep, show, performer: require('../../src/services/rawClipsService').PERFORMERS?.[0] || 'lala', key: `raw/${id}.mp4` });
  }
  const EPISODES = {
    'an accepted episode': async () => mkEpisode(show, { evaluation: 'accepted' }),
    'a filmed draft (it has a raw clip)': async () => { const ep = await mkEpisode(show); await film(ep); return ep; },
    'an ordinary draft': async () => mkEpisode(show),
  };
  const backgroundOf = async (id) => (await rows('SELECT background_url FROM scenes WHERE id = :id', { id }))[0].background_url;
  const baseOf = async (id) => (await rows('SELECT base_still_url FROM scene_sets WHERE id = :id', { id }))[0].base_still_url;

  // ── The two real replacements ──────────────────────────────────────────
  /** POST /scene-sets/:id/upload-base: resolves once the route answered (its cleanup is done before it answers). */
  async function replaceByUpload(s) {
    const res = await uploadBase(s.id);
    expect(res.status).toBe(200);
    expect(await baseOf(s.id)).not.toBe(s.url);
  }
  /** POST /scene-sets/:id/generate-base: 202, then generateBaseScene in the background; resolves when it ended. */
  async function replaceByGeneration(s) {
    const spy = jest.spyOn(sceneGen, 'generateBaseScene');
    const res = await asAdmin(request(app).post(`/api/v1/scene-sets/${s.id}/generate-base`)).send({});
    expect(res.status).toBe(202);
    const end = Date.now() + 5000;
    while (!spy.mock.results.length && Date.now() < end) await sleep(10);
    const ended = await settle(spy.mock.results[0].value);
    spy.mockRestore();
    if (!ended.ok) throw ended.error;
    expect(await baseOf(s.id)).not.toBe(s.url);
  }
  const REPLACEMENTS = [['an uploaded base (upload-base)', replaceByUpload], ['a generated base (generateBaseScene)', replaceByGeneration]];

  function gateOn(predicate) {
    if (!trace) trace = lockTrace.install(sequelize);
    const g = trace.gate(predicate);
    open.push(async () => g.open());
    return g;
  }
  function latchDelete() {
    let release;
    let reached;
    const hold = { used: false };
    hold.wait = new Promise((resolve) => { release = resolve; });
    hold.reached = new Promise((resolve) => { reached = resolve; });
    hold.arrive = reached;
    storage.holdDelete = hold;
    open.push(async () => release());
    return { reached: hold.reached, release };
  }

  beforeAll(async () => {
    guardEventsAtStart = networkGuard.getState().events.length;
    IMAGE = await sharp({ create: { width: 800, height: 450, channels: 3, background: '#cccccc' } }).png().toBuffer();
    PNG = await sharp({ create: { width: 4, height: 4, channels: 3, background: '#ffffff' } }).png().toBuffer();
  });
  beforeEach(async () => {
    show = await mkShow('Image kept');
    for (const k of ['FAL_KEY', 'AI_DAILY_IMAGE_BUDGET_USD', 'AI_DAILY_BUDGET_USD', 'ANTHROPIC_API_KEY']) saved[k] = process.env[k];
    process.env.FAL_KEY = 'test-fal';
    process.env.AI_DAILY_IMAGE_BUDGET_USD = '100000';
    process.env.AI_DAILY_BUDGET_USD = '100000';
    delete process.env.ANTHROPIC_API_KEY;
    storage.holdDelete = null;
    storage.failDelete = false;
    mockS3Send.mockReset();
    mockS3Send.mockImplementation(async (cmd) => {
      if (cmd?.constructor?.name === 'DeleteObjectCommand') {
        const hold = storage.holdDelete;
        if (hold && !hold.used) {
          hold.used = true;
          hold.arrive();
          await hold.wait;
        }
        if (storage.failDelete) throw new Error('storage is down');
      }
      return {};
    });
    axios.get.mockImplementation(async () => ({ data: PNG }));
    let n = 0;
    axios.post.mockImplementation(async (url) => {
      if (!String(url).startsWith('https://fal.run/')) throw new Error(`unexpected provider call ${url}`);
      n += 1;
      return { status: 200, data: { images: [{ url: `https://fal.media/img-${n}.jpg` }] } };
    });
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    usageLog = jest.spyOn(models.AIUsageLog, 'create');
  });
  afterEach(async () => {
    for (const result of usageLog?.mock.results || []) {
      const row = result.type === 'return' ? await Promise.resolve(result.value).catch(() => null) : null;
      if (row?.id != null) usageLogIds.push(row.id);
    }
    for (const close of open.splice(0).reverse()) await close();
    if (trace) {
      trace.uninstall();
      trace = null;
    }
    jest.restoreAllMocks();
    for (const k of Object.keys(saved)) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  });
  afterAll(async () => {
    await sleep(200);
    if (usageLogIds.length) await run('DELETE FROM ai_usage_logs WHERE id IN (:ids)', { ids: usageLogIds });
    for (const s of fx.made.shows) await run('DELETE FROM episode_raw_clips WHERE episode_id IN (SELECT id FROM episodes WHERE show_id = :s)', { s });
    if (fx.made.sets.length) await run('DELETE FROM scene_angles WHERE scene_set_id IN (:ids)', { ids: fx.made.sets });
    await fx.cleanup();
  });

  // ══ A saved scene keeps the file ═══════════════════════════════════════
  describe.each(REPLACEMENTS)('the base replaced by %s', (_how, replace) => {
    test.each(Object.keys(EPISODES))('the old base is the background of a saved scene of %s: its file is not deleted, and the scene is not rewritten', async (kind) => {
      const s = await setWithBase();
      const ep = await EPISODES[kind]();
      const sc = await scene(ep, s.url, { setId: s.id });
      await replace(s);
      expect(deleted()).toEqual([]);
      expect(await backgroundOf(sc)).toBe(s.url);
    });

    test('no scene, angle, approved location or other set shows the old base: its file is deleted, as before', async () => {
      const s = await setWithBase();
      await replace(s);
      expect(deleted()).toEqual([s.key]);
    });

    test('only a removed (soft-deleted) scene shows it: deleted, as before (nothing restores a removed scene)', async () => {
      const s = await setWithBase();
      await scene(await mkEpisode(show), s.url, { removed: true });
      await replace(s);
      expect(deleted()).toEqual([s.key]);
    });
  });

  test('several scenes show the same old base: kept while any of them does; the cleanup deletes it only once none does', async () => {
    const s = await setWithBase();
    const one = await scene(await mkEpisode(show, { evaluation: 'accepted' }), s.url);
    const two = await scene(await mkEpisode(show), s.url, { n: 2 });
    await replaceByUpload(s);
    expect(deleted()).toEqual([]);
    // No route comes back for a file it kept: the cleanup's own function is asked again here.
    const cleanup = () => sceneGen.deleteOldBaseImage(s.url, sequelize, { setId: s.id });
    await cleanup();
    expect(deleted()).toEqual([]);
    await run('UPDATE scenes SET background_url = :next WHERE id = :one', { next: await baseOf(s.id), one });
    await cleanup();
    expect(deleted()).toEqual([]); // the second scene still shows it
    await run('UPDATE scenes SET deleted_at = NOW() WHERE id = :two', { two });
    await cleanup();
    expect(deleted()).toEqual([s.key]);
  });

  // ══ What already kept a file still does ════════════════════════════════
  describe('the three things that already kept an old base still do', () => {
    test('an angle of any set shows it', async () => {
      const s = await setWithBase();
      await run(`INSERT INTO scene_angles (id, scene_set_id, angle_name, angle_label, generation_status, still_image_url, sort_order, created_at, updated_at)
                 VALUES (:id, :set, 'Wide', 'CLOSE', 'complete', :url, 0, NOW(), NOW())`, { id: fx.uuid(), set: s.id, url: s.url });
      await replaceByUpload(s);
      expect(deleted()).toEqual([]);
    });

    test('a location\'s approved base image is that picture', async () => {
      const s = await setWithBase();
      const place = await mkLocation('Kept hall');
      await run('UPDATE world_locations SET approved_base_image_url = :url WHERE id = :place', { url: s.url, place });
      await replaceByUpload(s);
      expect(deleted()).toEqual([]);
      await run('UPDATE world_locations SET approved_base_image_url = NULL WHERE id = :place', { place });
    });

    test('another set\'s base is that picture', async () => {
      const s = await setWithBase();
      const other = await mkSet(show, `Other ${fx.uuid().slice(0, 6)}`, { scene_type: 'EVENT_LOCATION', generation_status: 'complete', base_still_url: s.url });
      await replaceByUpload(s);
      expect(deleted()).toEqual([]);
      expect(await baseOf(other)).toBe(s.url);
    });
  });

  // ══ The forms a scene's background takes ═══════════════════════════════
  describe('the same stored object is recognised whatever address a scene keeps for it, and a different object never is', () => {
    const cleanup = (s) => sceneGen.deleteOldBaseImage(s.url, sequelize, { setId: s.id });

    test.each([
      ['the URL as the base stored it (what a beat\'s scene row copies)', (s) => s.url],
      ['that URL with a query string (a signed or cache-busting copy)', (s) => `${s.url}?X-Amz-Signature=abc&v=2`],
      ['that URL with a fragment', (s) => `${s.url}#top`],
      ['the same key behind another host', (s) => `https://cdn.example.com/${s.key}`],
      ['the same key behind another host, with a query string', (s) => `https://cdn.example.com/${s.key}?w=640`],
    ])('%s: kept', async (_form, backgroundOfScene) => {
      const s = await setWithBase();
      await scene(await mkEpisode(show), backgroundOfScene(s));
      await cleanup(s);
      expect(deleted()).toEqual([]);
    });

    test.each([
      ['another set\'s object with the same file name', (s) => `${HOST}scene-sets/${fx.uuid()}/stills/${s.key.split('/').pop()}`],
      ['a key that only starts with this one', (s) => `${s.url}.bak`],
      ['a key that only ends like this one', (s) => `${HOST}${s.key.replace('scene-sets/', 'archive-scene-sets/')}`],
      ['this key named only inside a query string', (s) => `https://cdn.example.com/other.jpg?from=/${s.key}`],
      ['no background', () => null],
    ])('%s: not this object, so the old base is deleted', async (_form, backgroundOfScene) => {
      const s = await setWithBase();
      await scene(await mkEpisode(show), backgroundOfScene(s));
      await cleanup(s);
      expect(deleted()).toEqual([s.key]);
    });

    test('an old base that is not in the bucket (another address altogether): matched by its exact URL only; nothing is deleted from storage for it, as before', async () => {
      const id = await mkSet(show, `Outside ${fx.uuid().slice(0, 6)}`, { scene_type: 'EVENT_LOCATION', generation_status: 'complete' });
      const url = 'https://images.example.com/somewhere/base.jpg';
      await sceneGen.deleteOldBaseImage(url, sequelize, { setId: id });
      expect(deleted()).toEqual([]);
    });
  });

  // ══ A reference made while the cleanup runs ════════════════════════════
  describe('[real race] a scene made to show the old base while the base is being replaced', () => {
    test('made after the new base is saved and before the cleanup\'s check: the check sees it, the file is kept', async () => {
      const s = await setWithBase();
      const ep = await mkEpisode(show);
      // The upload stopped just after it saved the new base (its cleanup not yet run).
      const g = gateOn((rec, sql) => /^UPDATE "scene_sets" SET "base_still_url"/.test(sql));
      const pending = send(uploadBase(s.id));
      await g.reached;
      expect(await baseOf(s.id)).not.toBe(s.url);
      const sc = await scene(ep, s.url); // a writer that read the old base a moment before
      g.open();
      expect((await pending).status).toBe(200);
      expect(deleted()).toEqual([]);
      expect(await backgroundOf(sc)).toBe(s.url);
    });

    test('KNOWN REMAINING RACE (not closed by this change): made after the cleanup\'s check and before the storage delete: the file is deleted and that scene shows a file that is gone', async () => {
      const s = await setWithBase();
      const ep = await mkEpisode(show);
      // The cleanup stopped at the storage delete: its check has run and found nothing.
      const atDelete = latchDelete();
      const pending = send(uploadBase(s.id));
      await atDelete.reached;
      const sc = await scene(ep, s.url);
      atDelete.release();
      expect((await pending).status).toBe(200);
      // The outcome as it is: the delete goes ahead.
      expect(deleted()).toEqual([s.key]);
      expect(await backgroundOf(sc)).toBe(s.url);
    });
  });

  // ══ Failures ═══════════════════════════════════════════════════════════
  describe('a check that cannot be read, and a storage that fails', () => {
    test('the usage check failing: nothing is deleted, the replacement still succeeds, and the warning carries the error\'s class, not the database\'s text', async () => {
      const s = await setWithBase();
      const real = sequelize.query.bind(sequelize);
      let failed = 0;
      jest.spyOn(sequelize, 'query').mockImplementation((sql, options) => {
        if (typeof sql === 'string' && /FROM scene_angles WHERE still_image_url = :url/.test(sql)) {
          failed += 1;
          return Promise.reject(Object.assign(new Error('relation "scenes" does not exist'), { name: 'SequelizeDatabaseError', original: { code: '42P01' } }));
        }
        return real(sql, options);
      });
      const res = await uploadBase(s.id);
      expect(failed).toBe(1);
      expect(res.status).toBe(200);
      expect(await baseOf(s.id)).not.toBe(s.url);
      expect(deleted()).toEqual([]);
      const line = warnLines().find((l) => l.includes('could not check whether an old base image is still used'));
      expect(line).toBe(`[SceneGen] could not check whether an old base image is still used; it is kept (set=${s.id} key=${s.key} error=SequelizeDatabaseError/42P01)`);
      expect(JSON.stringify(res.body)).not.toMatch(/relation|does not exist/);
    });

    test('the storage delete failing: as before, the new base stays saved and the replacement succeeds', async () => {
      const s = await setWithBase();
      storage.failDelete = true;
      const res = await uploadBase(s.id);
      expect(res.status).toBe(200);
      expect(deleted()).toEqual([s.key]); // it was asked once
      expect(await baseOf(s.id)).not.toBe(s.url);
      expect(warnLines().some((l) => l.includes('S3 cleanup failed (non-blocking)'))).toBe(true);
    });
  });

  describe('the network guard', () => {
    test('no external network attempt in this file', () => {
      const mine = networkGuard.getState().events.slice(guardEventsAtStart);
      expect(mine.filter((e) => e.type === 'attempt')).toEqual([]);
    });
  });
});
