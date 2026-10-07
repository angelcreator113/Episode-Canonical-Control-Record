/**
 * Deploy DJ bugs in "Generate this look"'s base path (Evoni, 2026-10-02,
 * from production logs; docs/EVENT_EPISODE_FLOW.md §8(hh) L7-L9):
 *   1. The Place section stayed on "Generating…" after a base-only run. The
 *      base's status is read as done or failed, every failure keeps its
 *      reason, and a run stuck for 10 minutes is marked failed.
 *   2. The image analysis after the base still ran "for undefined" and
 *      failed ("WHERE parameter "id" has invalid "undefined" value"): it now
 *      gets the scene set's id.
 *   3. The base brief flagged "Time of day" missing though the event has its
 *      time: the empty-room base takes its time of day from the event, and
 *      the look's lighting when set (Q4).
 * Through the real routes on the migrated database; the image provider,
 * S3, sharp and the Anthropic client are mocked.
 */
jest.unmock('uuid');

jest.mock('axios', () => ({ post: jest.fn(), get: jest.fn(), create: jest.requireActual('axios').create }));
jest.mock('@aws-sdk/client-s3', () => {
  const actual = jest.requireActual('@aws-sdk/client-s3');
  return {
    ...actual,
    S3Client: jest.fn(() => ({ send: jest.fn(async () => ({})) })),
    PutObjectCommand: jest.fn((input) => ({ input })),
    DeleteObjectCommand: jest.fn((input) => ({ input })),
  };
});
jest.mock('sharp', () => {
  const chain = () => {
    const c = {};
    for (const m of ['resize', 'jpeg', 'png', 'extract', 'composite', 'grayscale', 'blur', 'normalize', 'rotate', 'webp']) c[m] = () => c;
    c.toBuffer = async () => Buffer.from('img');
    c.metadata = async () => ({ width: 1920, height: 1080 });
    return c;
  };
  return jest.fn(() => chain());
});
const mockCreate = jest.fn();
jest.mock('@anthropic-ai/sdk', () => jest.fn(() => ({ messages: { create: mockCreate } })));

const request = require('supertest');
const crypto = require('crypto');
const axios = require('axios');
const { Sequelize } = require('sequelize');
const app = require('../../src/app');
const TokenService = require('../../src/services/tokenService');
const models = require('../../src/models');
const approvedMigration = require('../../src/migrations/20261001220000-world-locations-approved-base');
const venueLookMigration = require('../../src/migrations/20261002110000-add-world-events-venue-look');
const looksMigration = require('../../src/migrations/20261002130000-create-scene-set-looks');
const baseModelMigration = require('../../src/migrations/20261001140000-add-scene-sets-base-model');

const { sequelize } = models;

const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const uuid = () => crypto.randomUUID();
const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });
const rows = async (sql, replacements = {}) => (await sequelize.query(sql, { replacements }))[0];

(shouldSkip ? describe.skip : describe)('"Generate this look": the base path (DJ bugs 1-3)', () => {
  const show = uuid();
  let token;
  const saved = {};
  const auth = (r) => r.set('Authorization', `Bearer ${token}`);
  const url = (ev, tail = '') => `/api/v1/world/${show}/events/${ev}/look${tail}`;
  async function until(check, ms = 5000) {
    const end = Date.now() + ms;
    while (!(await check())) {
      if (Date.now() > end) throw new Error('timed out waiting');
      await new Promise((r) => setTimeout(r, 10));
    }
  }
  const setRow = async (id) => (await rows('SELECT generation_status, base_still_url, base_generation, visual_language FROM scene_sets WHERE id = :id', { id }))[0];

  /** A venue with no approved base, its studio set with no base image, an event at 18:30 linked to it. */
  async function venue({ lighting = null } = {}) {
    const loc = uuid(); const set = uuid(); const ev = uuid();
    await run(`INSERT INTO world_locations (id, name, description, created_at, updated_at)
               VALUES (:loc, 'Studio by Sable', 'A white photo studio.', NOW(), NOW())`, { loc });
    await run(`INSERT INTO scene_sets (id, name, scene_type, show_id, world_location_id, canonical_description, base_model, generation_status, created_at, updated_at)
               VALUES (:set, 'Studio by Sable''s Studio', 'EVENT_LOCATION', :show, :loc, 'A white cyclorama studio.', 'flux-dev', 'pending', NOW(), NOW())`,
    { set, show, loc });
    await run(`INSERT INTO world_events (id, show_id, name, event_type, status, prestige, venue_location_id, scene_set_id, event_time, venue_look, created_at, updated_at)
               VALUES (:ev, :show, 'Sable shoot', 'invite', 'ready', 5, :loc, :set, '18:30', CAST(:look AS jsonb), NOW(), NOW())`,
    { ev, show, loc, set, look: JSON.stringify({ overall: 'A moody editorial shoot.', ...(lighting ? { lighting } : {}) }) });
    return { loc, set, ev };
  }

  beforeAll(async () => {
    await sequelize.query(`ALTER TABLE scene_sets
      ADD COLUMN IF NOT EXISTS style_reference_url text,
      ADD COLUMN IF NOT EXISTS negative_prompt text,
      ADD COLUMN IF NOT EXISTS variation_count integer DEFAULT 1,
      ADD COLUMN IF NOT EXISTS cover_angle_id uuid`);
    const qi = sequelize.getQueryInterface();
    for (const m of [baseModelMigration, approvedMigration, venueLookMigration, looksMigration]) await m.up(qi, Sequelize);
    token = TokenService.generateTokenPair({
      id: 'test-user-look-base', email: 'user@lookbase.dev', name: 'Editor', groups: ['USER', 'EDITOR'], role: 'USER',
    }).accessToken;
    await run(`INSERT INTO shows (id, name, slug, metadata, created_at, updated_at) VALUES (:show, :name, :slug, '{}', NOW(), NOW())`,
      { show, name: `Look base ${show.slice(0, 8)}`, slug: `look-base-${show.slice(0, 8)}` });
  });

  beforeEach(() => {
    for (const k of ['FAL_KEY', 'ANTHROPIC_API_KEY', 'AI_DAILY_IMAGE_BUDGET_USD', 'AI_DAILY_BUDGET_USD', 'SCENE_BASE_MODEL_DEFAULT']) saved[k] = process.env[k];
    process.env.FAL_KEY = 'test-fal';
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.SCENE_BASE_MODEL_DEFAULT;
    process.env.AI_DAILY_IMAGE_BUDGET_USD = '100000';
    process.env.AI_DAILY_BUDGET_USD = '100000';
    axios.post.mockReset();
    axios.get.mockReset();
    axios.get.mockImplementation(async () => ({ data: Buffer.from('jpg') }));
    axios.post.mockImplementation(async (u) => {
      if (u.startsWith('https://fal.run/')) return { status: 200, data: { images: [{ url: 'https://fal.media/base.jpg' }] } };
      throw new Error(`unexpected provider call ${u}`);
    });
    mockCreate.mockReset();
    mockCreate.mockResolvedValue({ content: [{ text: '{"room_type":"studio","color_palette":["#ffffff"]}' }] });
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
    jest.restoreAllMocks();
  });

  it("bug 3: the base brief takes its time of day from the event, and the look's lighting when set", async () => {
    const plain = await venue();
    let res = await auth(request(app).post(url(plain.ev, '/brief'))).send({});
    expect(res.body.data.step).toBe('base');
    let time = res.body.data.brief.lines.find((l) => l.key === 'time');
    expect(time).toMatchObject({ layer: 'environment', source: 'event' });
    expect(time.text).not.toBe('');
    expect(res.body.data.brief.missing.map((m) => m.key)).not.toContain('time');
    expect(res.body.data.brief.lines.some((l) => l.layer === 'event')).toBe(false); // still the empty room

    const lit = await venue({ lighting: 'Low tungsten key light, deep shadows.' });
    res = await auth(request(app).post(url(lit.ev, '/brief'))).send({});
    time = res.body.data.brief.lines.find((l) => l.key === 'time');
    expect(time).toMatchObject({ source: 'look', text: 'Low tungsten key light, deep shadows.' });
  });

  it("bug 1: a base-only run reads as complete when it is done, and the generated base is in the event's light (bug 3)", async () => {
    const v = await venue({ lighting: 'Low tungsten key light, deep shadows.' });
    const res = await auth(request(app).post(url(v.ev, '/generate'))).send({});
    expect(res.status).toBe(202);
    expect(res.body.data.step).toBe('base');
    await until(async () => (await setRow(v.set)).generation_status !== 'generating');
    const got = await auth(request(app).get(url(v.ev)));
    expect(got.body.data.scene_set).toMatchObject({ id: v.set, generation_status: 'complete', error: null });
    expect(got.body.data.scene_set.base_still_url).toMatch(/stills\/\d+-base\.jpg$/);
    const body = axios.post.mock.calls.find(([u]) => u.startsWith('https://fal.run/'))[1];
    expect(body.prompt).toContain('Low tungsten key light, deep shadows.');
    expect(body.prompt).not.toContain('A moody editorial shoot');
  });

  it('bug 2: the analysis after the base still runs on the scene set itself (its id and name)', async () => {
    process.env.ANTHROPIC_API_KEY = 'test-anthropic';
    const v = await venue();
    await auth(request(app).post(url(v.ev, '/generate'))).send({});
    await until(async () => Boolean((await setRow(v.set)).visual_language?.image_analysis));
    const logs = console.log.mock.calls.map((c) => c.join(' '));
    expect(logs).toContain("[SceneGen] Analyzing base image with Claude Vision for Studio by Sable's Studio");
    expect(logs.some((l) => l.includes('for undefined'))).toBe(false);
    expect(console.warn.mock.calls.map((c) => c.join(' ')).some((l) => l.includes('invalid "undefined"'))).toBe(false);
    // Both the analysis and the style lock are kept (they write at the same time).
    await until(async () => (await setRow(v.set)).visual_language?.locked === true);
    const vl = (await setRow(v.set)).visual_language;
    expect(vl.image_analysis.source_url).toMatch(/stills\/\d+-base\.jpg$/);
    expect(vl.locked).toBe(true);
  });

  it('bug 1: a failed base run reads as failed with its reason', async () => {
    const v = await venue();
    // A 400 is not retried (a 5xx or no status is, with backoff).
    axios.post.mockImplementation(async () => { throw Object.assign(new Error('fal: prompt rejected'), { response: { status: 400, data: {} } }); });
    await auth(request(app).post(url(v.ev, '/generate'))).send({});
    // The generator marks the set failed first; the reason is written just
    // after (markBaseFailed), so wait for both.
    await until(async () => {
      const row = await setRow(v.set);
      return row.generation_status === 'failed' && Boolean(row.base_generation?.last_error);
    });
    const got = await auth(request(app).get(url(v.ev)));
    expect(got.body.data.scene_set.generation_status).toBe('failed');
    expect(got.body.data.scene_set.error).toContain('fal: prompt rejected');
  });

  it('bug 1: a base or look stuck generating for 10 minutes is marked failed when read; a recent one is left', async () => {
    const stuck = await venue();
    await run(`UPDATE scene_sets SET generation_status = 'generating', updated_at = NOW() - INTERVAL '11 minutes' WHERE id = :id`, { id: stuck.set });
    let got = await auth(request(app).get(url(stuck.ev)));
    expect(got.body.data.scene_set).toMatchObject({ generation_status: 'failed', error: 'Timed out: no image after 10 minutes' });

    const recent = await venue();
    await run(`UPDATE scene_sets SET generation_status = 'generating', updated_at = NOW() - INTERVAL '1 minute' WHERE id = :id`, { id: recent.set });
    got = await auth(request(app).get(url(recent.ev)));
    expect(got.body.data.scene_set.generation_status).toBe('generating');

    const lookStuck = await venue();
    await run(`INSERT INTO scene_set_looks (id, scene_set_id, event_id, status, created_at, updated_at)
               VALUES (gen_random_uuid(), :set, :ev, 'generating', NOW() - INTERVAL '12 minutes', NOW() - INTERVAL '12 minutes')`,
    { set: lookStuck.set, ev: lookStuck.ev });
    got = await auth(request(app).get(url(lookStuck.ev)));
    expect(got.body.data.look).toMatchObject({ status: 'failed', error: 'Timed out: no image after 10 minutes' });
  });
});
