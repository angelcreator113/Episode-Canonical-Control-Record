/**
 * Character poses (Evoni, 2026-10-20): Lala and JustAWoman photos per
 * episode, labelled by pose, on the migrated database through the real
 * routes. S3 and remove.bg are mocked (remove.bg hands back a made-up
 * cut-out); Replicate is not set up, so the upscale is skipped and says so.
 * The image work itself is real (sharp).
 */
jest.unmock('uuid');

// A small S3: what is put can be got back (reprocess reads the original).
const mockStore = new Map();
const mockSend = jest.fn(async (cmd) => {
  const { Key, Body } = cmd.input || {};
  if (cmd.constructor.name === 'GetObjectCommand') {
    const body = mockStore.get(Key);
    if (!body) throw Object.assign(new Error('NoSuchKey'), { name: 'NoSuchKey' });
    return { Body: { transformToByteArray: async () => body } };
  }
  if (Body) mockStore.set(Key, Buffer.from(Body));
  return {};
});
// The upload bucket comes from the server's settings (src/services/assetBucket.js).
process.env.S3_PRIMARY_BUCKET = process.env.S3_PRIMARY_BUCKET || 'test-bucket';

jest.mock('@aws-sdk/client-s3', () => {
  const actual = jest.requireActual('@aws-sdk/client-s3');
  return { ...actual, S3Client: jest.fn(() => ({ send: (...a) => mockSend(...a) })) };
});

const request = require('supertest');
const crypto = require('crypto');
const sharp = require('sharp');
const axios = require('axios');
const { Sequelize } = require('sequelize');
const app = require('../../src/app');
const TokenService = require('../../src/services/tokenService');
const models = require('../../src/models');
const posesMigration = require('../../src/migrations/20261020150000-create-episode-character-poses');

const { sequelize } = models;

const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const uuid = () => crypto.randomUUID();
const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });
const rows = async (sql, replacements = {}) => (await sequelize.query(sql, { replacements }))[0];

const photo = (w = 1700, h = 1700) => sharp({ create: { width: w, height: h, channels: 3, background: '#6B5B4B' } }).jpeg().toBuffer();
async function madeUpCutout() {
  const w = 400; const h = 600;
  const data = Buffer.alloc(w * h * 4);
  for (let y = 100; y < 500; y += 1) {
    for (let x = 150; x < 250; x += 1) {
      const i = (y * w + x) * 4;
      data[i] = 210; data[i + 1] = 160; data[i + 2] = 130; data[i + 3] = 255;
    }
  }
  return sharp(data, { raw: { width: w, height: h, channels: 4 } }).png().toBuffer();
}

(shouldSkip ? describe.skip : describe)('Character poses (Files tab)', () => {
  const show = uuid();
  let token;
  let postSpy;
  const ORIGINAL_ENV = { ...process.env };
  const auth = (r) => r.set('Authorization', `Bearer ${token}`);
  const url = (ep, rest = '') => `/api/v1/episode-poses/${ep}${rest}`;

  async function episode() {
    const ep = uuid();
    await run(`INSERT INTO episodes (id, show_id, title, episode_number, status, created_at, updated_at)
               VALUES (:ep, :show, 'Poses ep', :n, 'draft', NOW(), NOW())`, { ep, show, n: Math.floor(Math.random() * 100000) + 500 });
    return ep;
  }

  const upload = async (ep, character, pose, w, h) => auth(request(app).post(url(ep)))
    .field('character_key', character).field('pose', pose)
    .attach('image', await photo(w, h), { filename: 'pose.jpg', contentType: 'image/jpeg' });

  /** Waits until none of the episode's poses is queued or processing. */
  async function settled(ep) {
    for (let i = 0; i < 100; i += 1) {
      const res = await auth(request(app).get(url(ep)));
      if (res.body.data.every((p) => !['queued', 'processing'].includes(p.status))) return res.body.data;
      await new Promise((r) => setTimeout(r, 100));
    }
    throw new Error('poses never settled');
  }

  beforeAll(async () => {
    await posesMigration.up(sequelize.getQueryInterface(), Sequelize);
    token = TokenService.generateTokenPair({
      id: 'test-user-poses', email: 'user@poses.dev', name: 'Editor', groups: ['USER', 'EDITOR'], role: 'USER',
    }).accessToken;
    await run(`INSERT INTO shows (id, name, slug, metadata, created_at, updated_at) VALUES (:show, :name, :slug, '{}', NOW(), NOW())`,
      { show, name: `Poses ${show.slice(0, 8)}`, slug: `poses-${show.slice(0, 8)}` });
    const cut = await madeUpCutout();
    postSpy = jest.spyOn(axios, 'post').mockImplementation(async (target) => {
      if (target === 'https://api.remove.bg/v1.0/removebg') return { data: cut };
      throw new Error(`unexpected POST ${target}`);
    });
  });

  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV, REMOVEBG_API_KEY: 'test-key' };
    delete process.env.REPLICATE_API_TOKEN;
    delete process.env.RUNWAY_ML_API_KEY;
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
    postSpy.mockRestore();
  });

  test('the migration is guarded: running it again changes nothing', async () => {
    await posesMigration.up(sequelize.getQueryInterface(), Sequelize);
    const [{ n }] = await rows("SELECT COUNT(*)::int AS n FROM pg_indexes WHERE tablename = 'episode_character_poses'");
    expect(n).toBe(3);
  });

  test('upload: 202 queued, the first of a pose is its default, then it is processed to a trimmed cut-out', async () => {
    const ep = await episode();
    const res = await upload(ep, 'lala', 'front', 1700, 1700);
    expect(res.status).toBe(202);
    expect(res.body.data).toMatchObject({ character_key: 'lala', pose: 'front', is_default: true, status: 'queued', width: 1700, height: 1700 });
    expect(res.body.data.original_url).toMatch(new RegExp(`episodes/${ep}/poses/${res.body.data.id}/original\\.jpg$`));
    expect(res.body.data).not.toHaveProperty('original_key');

    const [done] = await settled(ep);
    expect(done).toMatchObject({ status: 'ready', error: null, steps: { color: true, upscale: 'not needed', background: 'remove.bg', edges: true } });
    expect(done.final_url).toMatch(/-final\.png$/);
    expect(done.enhanced_url).toMatch(/-enhanced\.jpg$/);
    // The made-up cut-out is a 100 x 400 figure: trimmed to it plus 8px each side.
    expect([done.final_width, done.final_height]).toEqual([116, 416]);
    const keys = mockSend.mock.calls.map(([c]) => c.input?.Key).filter((k) => k && k.includes(done.id));
    expect(keys).toEqual(expect.arrayContaining([expect.stringMatching(/original\.jpg$/), expect.stringMatching(/-enhanced\.jpg$/), expect.stringMatching(/-final\.png$/)]));
    const [{ n }] = await rows("SELECT COUNT(*)::int AS n FROM ai_usage_logs WHERE model_name = 'remove.bg' AND provider = 'removebg' AND created_at > NOW() - INTERVAL '1 minute'");
    expect(n).toBeGreaterThanOrEqual(1);
  });

  test('a small photo with no Replicate token: the upscale is skipped and says why', async () => {
    const ep = await episode();
    await upload(ep, 'justawoman', 'glamour', 300, 500);
    const [done] = await settled(ep);
    expect(done).toMatchObject({ status: 'ready', steps: { upscale: 'skipped: upscaling is not set up on the server' } });
  });

  test('JustAWoman keeps her background: the enhanced photo is final, and remove.bg is never called', async () => {
    const ep = await episode();
    postSpy.mockClear();
    await upload(ep, 'justawoman', 'front', 1700, 1700);
    await upload(ep, 'justawoman', 'side', 1700, 1700);
    await settled(ep);
    // Reprocess goes the same way.
    const [first] = (await auth(request(app).get(url(ep)))).body.data;
    expect((await auth(request(app).post(url(ep, `/${first.id}/reprocess`)))).status).toBe(202);
    const done = await settled(ep);
    expect(done).toHaveLength(2);
    for (const p of done) {
      expect(p).toMatchObject({ status: 'ready', error: null, steps: { color: true, upscale: 'not needed', background: 'kept' } });
      expect(p.final_url).toBe(p.enhanced_url);
      expect(p.final_url).toMatch(/-enhanced\.jpg$/);
      expect([p.final_width, p.final_height]).toEqual([1700, 1700]);
    }
    expect(postSpy).not.toHaveBeenCalled();
  });

  test('several per pose, one default: starring moves it; moving a default to another pose drops its star; list order', async () => {
    const ep = await episode();
    const a = (await upload(ep, 'lala', 'glamour', 1700, 1700)).body.data;
    const b = (await upload(ep, 'lala', 'glamour', 1700, 1700)).body.data;
    const c = (await upload(ep, 'justawoman', 'back', 1700, 1700)).body.data;
    expect([a.is_default, b.is_default, c.is_default]).toEqual([true, false, true]);
    await settled(ep);

    const star = await auth(request(app).patch(url(ep, `/${b.id}`))).send({ is_default: true });
    expect(star.status).toBe(200);
    expect(star.body.data.is_default).toBe(true);
    const list = (await auth(request(app).get(url(ep)))).body.data;
    expect(list.find((p) => p.id === a.id).is_default).toBe(false);
    expect(list.map((p) => p.id)).toEqual([c.id, b.id, a.id]); // justawoman before lala; the default first

    const moved = await auth(request(app).patch(url(ep, `/${b.id}`))).send({ pose: 'side' });
    expect(moved.body.data).toMatchObject({ pose: 'side', is_default: false });
    const restar = await auth(request(app).patch(url(ep, `/${a.id}`))).send({ is_default: true });
    expect(restar.body.data.is_default).toBe(true);

    const bad = await auth(request(app).patch(url(ep, `/${a.id}`))).send({ pose: 'sitting' });
    expect(bad.status).toBe(400);
    expect(bad.body.error).toMatch(/pose must be one of front, back, side, glamour/);
  });

  test('reprocess runs again from the original; a delete hides it and frees its default', async () => {
    const ep = await episode();
    const p = (await upload(ep, 'lala', 'back', 1700, 1700)).body.data;
    const [first] = await settled(ep);
    const again = await auth(request(app).post(url(ep, `/${p.id}/reprocess`)));
    expect(again.status).toBe(202);
    expect(again.body.data.status).toBe('queued');
    const [second] = await settled(ep);
    expect(second.status).toBe('ready');
    expect(second.final_url).not.toBe(first.final_url);

    const del = await auth(request(app).delete(url(ep, `/${p.id}`)));
    expect(del.status).toBe(200);
    expect((await auth(request(app).get(url(ep)))).body.data).toEqual([]);
    const next = (await upload(ep, 'lala', 'back', 1700, 1700)).body.data;
    expect(next.is_default).toBe(true);
    await settled(ep);
    expect((await auth(request(app).delete(url(ep, `/${p.id}`)))).status).toBe(404);
  });

  test('a failed removal is recorded with a plain message and the steps done; Retry works once it is set up', async () => {
    const ep = await episode();
    delete process.env.REMOVEBG_API_KEY;
    const p = (await upload(ep, 'lala', 'side', 1700, 1700)).body.data;
    const [failed] = await settled(ep);
    expect(failed).toMatchObject({ status: 'failed', error: 'Background removal is not set up on the server (REMOVEBG_API_KEY).', steps: { color: true, upscale: 'not needed' } });
    expect(failed.enhanced_url).toMatch(/-enhanced\.jpg$/);
    process.env.REMOVEBG_API_KEY = 'test-key';
    await auth(request(app).post(url(ep, `/${p.id}/reprocess`)));
    const [ok] = await settled(ep);
    expect(ok).toMatchObject({ status: 'ready', error: null });
  });

  test('refusals: bad character, missing photo, a non-photo, an unknown episode, no sign-in', async () => {
    const ep = await episode();
    const guest = await auth(request(app).post(url(ep))).field('character_key', 'guest').field('pose', 'front')
      .attach('image', await photo(), { filename: 'p.jpg', contentType: 'image/jpeg' });
    expect(guest.status).toBe(400);
    expect(guest.body.error).toMatch(/character_key must be one of lala, justawoman/);
    const none = await auth(request(app).post(url(ep))).field('character_key', 'lala').field('pose', 'front');
    expect(none.status).toBe(400);
    const text = await auth(request(app).post(url(ep))).field('character_key', 'lala').field('pose', 'front')
      .attach('image', Buffer.from('hello'), { filename: 'p.jpg', contentType: 'image/jpeg' });
    expect(text.status).toBe(400);
    expect(text.body.error).toMatch(/not a photo we can read/);
    const gone = await upload(uuid(), 'lala', 'front', 100, 100);
    expect(gone.status).toBe(404);
    expect((await request(app).get(url(ep))).status).toBe(401);
    await expect(run(`INSERT INTO episode_character_poses (episode_id, character_key, pose, original_key) VALUES (:ep, 'lala', 'sitting', 'k')`, { ep }))
      .rejects.toThrow(/episode_character_poses_pose/);
  });
});
