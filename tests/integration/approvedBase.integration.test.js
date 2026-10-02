/**
 * Ruling S6 (Evoni, 2026-09-30) and her answers (2026-10-01;
 * EVENT_EPISODE_FLOW.md §8(dd)): "A recurring location keeps one approved
 * permanent base image; event-dressed versions are made from it, so the
 * place stays recognisable across episodes."
 *   1. The approved base lives on the World Location.
 *   2. Event-dressed versions edit the approved base with only the event
 *      layer, using Flux Kontext, priced and shown in the brief.
 *   3. Regenerate, promote-to-base and restyle refuse to replace an approved
 *      base until it is un-approved.
 *   4. Nothing is approved automatically; Evoni approves from Scene Sets.
 * On the test database through the scene-set and Scene Studio routes.
 * Providers, S3 and sharp are mocked as in sceneBriefShown.integration.test.js.
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
    for (const m of ['resize', 'jpeg', 'png', 'extract', 'composite', 'grayscale', 'blur', 'normalize', 'rotate', 'webp', 'metadata']) c[m] = () => c;
    c.toBuffer = async () => Buffer.from('img');
    c.metadata = async () => ({ width: 1920, height: 1080 });
    return c;
  };
  return jest.fn(() => chain());
});

const { Sequelize } = require('sequelize');
const request = require('supertest');
const axios = require('axios');
const crypto = require('crypto');
const app = require('../../src/app');
const TokenService = require('../../src/services/tokenService');
const models = require('../../src/models');
const sceneGen = require('../../src/services/sceneGenerationService');
const migration = require('../../src/migrations/20261001140000-add-scene-sets-base-model');
const approvedMigration = require('../../src/migrations/20261001220000-world-locations-approved-base');
const { briefToPrompt, DRESSING_KEEP } = require('../../src/services/sceneBriefService');
const { ApprovedBaseError } = require('../../src/services/approvedBaseService');

const { sequelize } = models;

const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const B64 = Buffer.from('png-bytes').toString('base64');
const uuid = () => crypto.randomUUID();
const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });

function mockProviders() {
  axios.post.mockReset();
  axios.get.mockReset();
  axios.get.mockImplementation(async () => ({ data: Buffer.from('jpg') }));
  axios.post.mockImplementation(async (url) => {
    if (url.startsWith('https://fal.run/')) return { status: 200, data: { images: [{ url: 'https://fal.media/x.jpg' }] } };
    if (url.startsWith('https://api.openai.com/v1/images/')) return { status: 200, data: { data: [{ b64_json: B64 }] } };
    throw new Error(`unexpected provider call ${url}`);
  });
}

(shouldSkip ? describe.skip : describe)('The approved base of a recurring location (S6)', () => {
  let token;
  const ids = { show: uuid(), otherShow: uuid(), location: uuid(), parent: uuid(), event: uuid(), foreignEvent: uuid() };
  const createdSetIds = [];
  const saved = {};

  beforeAll(async () => {
    await sequelize.query(`ALTER TABLE scene_sets
      ADD COLUMN IF NOT EXISTS style_reference_url text,
      ADD COLUMN IF NOT EXISTS negative_prompt text,
      ADD COLUMN IF NOT EXISTS variation_count integer DEFAULT 1,
      ADD COLUMN IF NOT EXISTS cover_angle_id uuid`);
    // The SceneAngle model's columns that only a dead migration tree adds
    // (migrations/20260322100000 and its neighbours), so the test database
    // lacks them; the S1 suite does the same for scene_sets.
    await sequelize.query(`ALTER TABLE scene_angles
      ADD COLUMN IF NOT EXISTS angle_description text,
      ADD COLUMN IF NOT EXISTS camera_direction text,
      ADD COLUMN IF NOT EXISTS quality_score integer,
      ADD COLUMN IF NOT EXISTS artifact_flags jsonb DEFAULT '[]'::jsonb,
      ADD COLUMN IF NOT EXISTS quality_review jsonb,
      ADD COLUMN IF NOT EXISTS generation_attempt integer,
      ADD COLUMN IF NOT EXISTS refined_prompt text,
      ADD COLUMN IF NOT EXISTS camera_motion varchar(255),
      ADD COLUMN IF NOT EXISTS video_duration integer,
      ADD COLUMN IF NOT EXISTS style_reference_url text,
      ADD COLUMN IF NOT EXISTS variation_count integer,
      ADD COLUMN IF NOT EXISTS variation_data jsonb,
      ADD COLUMN IF NOT EXISTS post_processing_status text,
      ADD COLUMN IF NOT EXISTS enhanced_still_url text,
      ADD COLUMN IF NOT EXISTS enhanced_video_url text`);
    await migration.up(sequelize.getQueryInterface(), Sequelize);
    await approvedMigration.up(sequelize.getQueryInterface(), Sequelize);
    token = TokenService.generateTokenPair({
      id: 'test-user-approved-base-s6', email: 'user@approved-base-s6.dev', name: 'Editor', groups: ['USER', 'EDITOR'], role: 'USER',
    }).accessToken;
    for (const [id, name] of [[ids.show, `S6 show ${ids.show.slice(0, 8)}`], [ids.otherShow, `S6 other ${ids.otherShow.slice(0, 8)}`]]) {
      await run(`INSERT INTO shows (id, name, slug, created_at, updated_at) VALUES (:id, :name, :slug, NOW(), NOW())`,
        { id, name, slug: `s6-${id.slice(0, 8)}` });
    }
    await run(`INSERT INTO world_locations (id, name, city, district, created_at, updated_at)
               VALUES (:parent, 'Echo Park', 'Los Angeles', 'Echo Park', NOW(), NOW())`, ids);
    await run(`INSERT INTO world_locations (id, name, parent_location_id, venue_type, style_guide, created_at, updated_at)
               VALUES (:location, 'The Glasshouse', :parent, 'event_hall', :guide, NOW(), NOW())`,
    { ...ids, guide: JSON.stringify({ architecture: 'Victorian iron-and-glass conservatory', materials: { metal: 'black wrought iron' } }) });
    await run(`INSERT INTO world_events (id, show_id, name, event_type, theme, format, color_palette, event_time, prestige, status, created_at, updated_at)
               VALUES (:event, :show, 'Velour Launch', 'invite', 'Midnight Garden', 'brand_launch', '["plum","gold"]', '20:00', 5, 'ready', NOW(), NOW())`, ids);
    await run(`INSERT INTO world_events (id, show_id, name, event_type, prestige, status, created_at, updated_at)
               VALUES (:foreignEvent, :otherShow, 'Another show gala', 'invite', 5, 'ready', NOW(), NOW())`, ids);
  });

  beforeEach(() => {
    for (const k of ['FAL_KEY', 'OPENAI_API_KEY', 'ANTHROPIC_API_KEY', 'AI_DAILY_IMAGE_BUDGET_USD', 'AI_DAILY_BUDGET_USD', 'SCENE_BASE_MODEL_DEFAULT']) saved[k] = process.env[k];
    process.env.FAL_KEY = 'test-fal';
    process.env.OPENAI_API_KEY = 'test-openai';
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.SCENE_BASE_MODEL_DEFAULT;
    process.env.AI_DAILY_IMAGE_BUDGET_USD = '100000';
    process.env.AI_DAILY_BUDGET_USD = '100000';
    mockProviders();
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
    jest.restoreAllMocks();
  });

  afterAll(async () => {
    if (createdSetIds.length) {
      await sequelize.query('DELETE FROM scene_angles WHERE scene_set_id IN (:ids)', { replacements: { ids: createdSetIds } });
      const [rows] = await sequelize.query('SELECT base_generation FROM scene_sets WHERE id IN (:ids)', { replacements: { ids: createdSetIds } });
      const logIds = rows.flatMap((r) => (r.base_generation && r.base_generation.usage_log_ids) || []);
      if (logIds.length) await sequelize.query('DELETE FROM ai_usage_logs WHERE id IN (:ids)', { replacements: { ids: logIds } });
      await sequelize.query('DELETE FROM scene_sets WHERE id IN (:ids)', { replacements: { ids: createdSetIds } });
    }
    await run('UPDATE world_locations SET approved_base_scene_set_id = NULL, approved_base_image_url = NULL, approved_base_at = NULL WHERE id = :location', ids);
    await run('DELETE FROM world_events WHERE id IN (:event, :foreignEvent)', ids);
    await run('DELETE FROM world_locations WHERE id IN (:location, :parent)', ids);
    await run('DELETE FROM shows WHERE id IN (:show, :otherShow)', ids);
    await sequelize.close();
  });

  async function makeSet() {
    const set = await models.SceneSet.create({
      name: 'The Glasshouse', scene_type: 'OTHER', show_id: ids.show, world_location_id: ids.location,
      canonical_description: 'A greenhouse ballroom under a glass roof.', time_of_day: 'evening', base_model: 'flux-dev',
    });
    createdSetIds.push(set.id);
    return set;
  }

  const auth = (r) => r.set('Authorization', `Bearer ${token}`);
  const brief = (setId, body = {}) => auth(request(app).post(`/api/v1/scene-sets/${setId}/brief`)).send(body);
  const line = (b, key) => b.lines.find((l) => l.key === key);

  async function waitForBase(setId) {
    for (let i = 0; i < 50; i += 1) {
      const row = await models.SceneSet.findByPk(setId, { attributes: ['generation_status', 'base_generation', 'base_runway_prompt'] });
      if (row.generation_status === 'complete' || row.generation_status === 'failed') return row;
      await new Promise((r) => setTimeout(r, 100));
    }
    throw new Error('base generation did not finish');
  }

  const KONTEXT = 'https://fal.run/fal-ai/flux-pro/kontext';
  const BASE_URL = 'https://bucket.example/scene-sets/approved-base.jpg';
  const approve = (setId) => auth(request(app).post(`/api/v1/scene-sets/${setId}/approve-base`)).send({});
  const unapprove = (setId) => auth(request(app).delete(`/api/v1/scene-sets/${setId}/approve-base`));
  const locationRow = async () => (await run('SELECT approved_base_scene_set_id, approved_base_image_url, approved_base_at FROM world_locations WHERE id = :location', ids))[0][0];

  async function approvedSet() {
    const set = await makeSet();
    await set.update({ base_still_url: BASE_URL, generation_status: 'complete', base_runway_seed: 'uploaded-1' });
    const res = await approve(set.id);
    expect(res.status).toBe(200);
    return set;
  }

  afterEach(async () => {
    await run('UPDATE world_locations SET approved_base_scene_set_id = NULL, approved_base_image_url = NULL, approved_base_at = NULL WHERE id = :location', ids);
  });

  it('nothing is approved by itself; Evoni approves a base, one per location, and can un-approve it', async () => {
    const set = await makeSet();
    await sceneGen.generateBaseScene(set, models, { skipAnalysis: true });
    expect((await locationRow()).approved_base_scene_set_id).toBeNull();

    expect((await approve(uuid())).status).toBe(404);
    const noBase = await makeSet();
    expect((await approve(noBase.id)).status).toBe(400);
    const noLocation = await models.SceneSet.create({ name: 'Nowhere', scene_type: 'OTHER', show_id: ids.show, base_still_url: BASE_URL });
    createdSetIds.push(noLocation.id);
    expect((await approve(noLocation.id)).status).toBe(400);

    const fresh = await models.SceneSet.findByPk(set.id);
    expect((await approve(set.id)).status).toBe(200);
    const row = await locationRow();
    expect(row.approved_base_scene_set_id).toBe(set.id);
    expect(row.approved_base_image_url).toBe(fresh.base_still_url);
    expect(row.approved_base_at).toBeTruthy();

    // GET /:id's Show and Episode includes need columns the test database's
    // dead migration trees would add; the list reads the same approvals.
    const listed = (await auth(request(app).get('/api/v1/scene-sets'))).body.data.find((x) => x.id === set.id);
    expect(listed.base_approved).toBe(true);
    expect(listed.location_approved_base).toEqual({ scene_set_id: set.id, image_url: fresh.base_still_url });

    const other = await makeSet();
    await other.update({ base_still_url: 'https://bucket.example/other.jpg' });
    expect((await approve(other.id)).status).toBe(409);
    expect((await unapprove(other.id)).status).toBe(409);
    const all = (await auth(request(app).get('/api/v1/scene-sets'))).body.data;
    expect(all.find((x) => x.id === other.id)).toMatchObject({ base_approved: false, location_approved_base: { scene_set_id: set.id } });

    expect((await unapprove(set.id)).status).toBe(200);
    expect((await locationRow()).approved_base_scene_set_id).toBeNull();
  });

  it('an approved base is not replaced: regenerate, cascade, promote, upload and restyle are refused until un-approved', async () => {
    const set = await approvedSet();
    const angle = await models.SceneAngle.create({ scene_set_id: set.id, angle_label: 'WINDOW', angle_name: 'Window', still_image_url: 'https://bucket.example/w.jpg' });
    const post = (path, body = {}) => auth(request(app).post(`/api/v1/scene-sets/${set.id}${path}`)).send(body);

    for (const [path, body] of [
      ['/generate-base', { force: true }],
      ['/cascade-regenerate', {}],
      ['/promote-to-base', { angle_id: angle.id }],
      ['/upload-base', {}],
      ['/regenerate-background', { mood: 'cozy' }],
    ]) {
      const res = await post(path, body);
      expect([path, res.status]).toEqual([path, 409]);
      expect(res.body.error).toMatch(/approved base of The Glasshouse/);
    }
    await expect(sceneGen.generateBaseScene(await models.SceneSet.findByPk(set.id), models, { skipAnalysis: true }))
      .rejects.toBeInstanceOf(ApprovedBaseError);
    expect(axios.post).not.toHaveBeenCalled();
    const row = await models.SceneSet.findByPk(set.id, { attributes: ['base_still_url'] });
    expect(row.base_still_url).toBe(BASE_URL);

    expect((await unapprove(set.id)).status).toBe(200);
    const again = await post('/generate-base', { force: true });
    expect(again.status).toBe(202);
    await waitForBase(set.id);
  });

  it('an event-dressed version: the approved base edited with only the event layer, priced as Flux Kontext in the brief', async () => {
    const approved = await approvedSet();
    const set = await makeSet();

    const plain = (await brief(set.id)).body.data;
    expect(plain.brief.mode).toBe('full');

    const shown = (await brief(set.id, { event_id: ids.event })).body.data;
    expect(shown.brief.mode).toBe('event_dressing');
    expect(shown.brief.approved_base).toEqual({ scene_set_id: approved.id, image_url: BASE_URL });
    expect(shown.prompt.startsWith(DRESSING_KEEP)).toBe(true);
    expect(shown.prompt).toContain('No people present');
    expect(shown.prompt).toContain(DRESSING_KEEP);
    expect(shown.prompt).toContain('Dressed for Velour Launch');
    expect(shown.prompt).not.toContain('iron-and-glass');
    expect(shown.prompt).not.toContain('Wide establishing shot');
    expect(shown.estimate).toMatchObject({ base_model: 'flux-kontext', model: 'fal-ai/flux-pro/kontext' });

    // The approved set's own brief is never a dressed version.
    expect((await brief(approved.id, { event_id: ids.event })).body.data.brief.mode).toBe('full');

    const res = await auth(request(app).post(`/api/v1/scene-sets/${set.id}/generate-base`)).send({ event_id: ids.event });
    expect(res.status).toBe(202);
    const row = await waitForBase(set.id);
    expect(row.generation_status).toBe('complete');
    const call = axios.post.mock.calls.find(([u]) => u === KONTEXT);
    expect(call[1]).toMatchObject({ image_url: BASE_URL, prompt: briefToPrompt(row.base_generation.brief) });
    expect(axios.post.mock.calls.filter(([u]) => u !== KONTEXT)).toEqual([]);
    expect(row.base_generation).toMatchObject({ model_key: 'flux-kontext', brief: { mode: 'event_dressing' } });
  });

  it('venue generation at a venue with an approved base: the interior is its event-dressed version; the exterior is not', async () => {
    await approvedSet();
    await run('UPDATE world_events SET venue_location_id = :location WHERE id = :event', ids);
    try {
      const d = (await auth(request(app).post(`/api/v1/world/${ids.show}/events/${ids.event}/venue-brief`)).send({})).body.data;
      expect(d.brief.mode).toBe('event_dressing');
      expect(d.brief.approved_base.image_url).toBe(BASE_URL);
      expect(d.exterior_brief.mode).toBe('full');
      expect(d.estimate).toMatchObject({ images: 2, interior_model: 'fal-ai/flux-pro/kontext' });
    } finally {
      await run('UPDATE world_events SET venue_location_id = NULL WHERE id = :event', ids);
    }
  });
});
