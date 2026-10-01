/**
 * Ruling S3 (Evoni, 2026-09-30; EVENT_EPISODE_FLOW.md §8(dd)): "Generating
 * for an event requires choosing that event explicitly; never the first
 * match." Through POST /scene-sets/:id/brief, generate-base and
 * cascade-regenerate on the test database: the base brief takes the event
 * named in event_id (an event of the set's show), keeps the event its base
 * was last made for when none is named, and never takes an event because it
 * is linked to the set. Providers, S3 and sharp are mocked as in
 * sceneBriefShown.integration.test.js.
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

(shouldSkip ? describe.skip : describe)('The event chosen for a scene image (S3)', () => {
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
    token = TokenService.generateTokenPair({
      id: 'test-user-scene-event-s3', email: 'user@scene-event-s3.dev', name: 'Editor', groups: ['USER', 'EDITOR'], role: 'USER',
    }).accessToken;
    for (const [id, name] of [[ids.show, `S3 show ${ids.show.slice(0, 8)}`], [ids.otherShow, `S3 other ${ids.otherShow.slice(0, 8)}`]]) {
      await run(`INSERT INTO shows (id, name, slug, created_at, updated_at) VALUES (:id, :name, :slug, NOW(), NOW())`,
        { id, name, slug: `s3-${id.slice(0, 8)}` });
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

  const eventLines = (b) => b.lines.filter((l) => l.layer === 'event');

  it('the base brief has no event until one is chosen, even when an event names the set', async () => {
    const set = await makeSet();
    // The first-match path S3 forbids: an event that already uses this set.
    await run('UPDATE world_events SET scene_set_id = :set WHERE id = :event', { set: set.id, event: ids.event });
    try {
      const b = (await brief(set.id)).body.data.brief;
      expect(b.event_id).toBeNull();
      expect(eventLines(b)).toEqual([]);

      const chosen = (await brief(set.id, { event_id: ids.event })).body.data;
      expect(chosen.brief.event_id).toBe(ids.event);
      expect(line(chosen.brief, 'concept')).toMatchObject({ layer: 'event', source: 'event' });
      expect(line(chosen.brief, 'concept').text).toMatch(/^Dressed for Velour Launch, themed "Midnight Garden"/);
      expect(chosen.prompt).toContain('Velour Launch');
    } finally {
      await run('UPDATE world_events SET scene_set_id = NULL WHERE id = :event', { event: ids.event });
    }
    expect(axios.post).not.toHaveBeenCalled();
  });

  it('an event of another show, or not an id, is refused; nothing is generated', async () => {
    const set = await makeSet();
    expect((await brief(set.id, { event_id: ids.foreignEvent })).status).toBe(404);
    expect((await brief(set.id, { event_id: uuid() })).status).toBe(404);
    expect((await brief(set.id, { event_id: 'first' })).status).toBe(400);
    expect((await brief(set.id, { event_id: 7 })).status).toBe(400);
    const gen = await auth(request(app).post(`/api/v1/scene-sets/${set.id}/generate-base`)).send({ event_id: ids.foreignEvent });
    expect(gen.status).toBe(404);
    const cascade = await auth(request(app).post(`/api/v1/scene-sets/${set.id}/cascade-regenerate`)).send({ event_id: 'x' });
    expect(cascade.status).toBe(400);
    expect(axios.post).not.toHaveBeenCalled();
    const row = await models.SceneSet.findByPk(set.id, { attributes: ['generation_status'] });
    expect(row.generation_status).toBe('pending');
  });

  it('generate-base makes the base for the chosen event; the base keeps it until another choice or none', async () => {
    const set = await makeSet();
    const res = await auth(request(app).post(`/api/v1/scene-sets/${set.id}/generate-base`)).send({ event_id: ids.event });
    expect(res.status).toBe(202);
    const row = await waitForBase(set.id);
    expect(row.generation_status).toBe('complete');
    expect(row.base_generation.brief.event_id).toBe(ids.event);
    expect(row.base_runway_prompt).toContain('Velour Launch');

    // The next brief, with no event named, shows the base's event.
    expect((await brief(set.id)).body.data.brief.event_id).toBe(ids.event);
    // Choosing none removes it from the brief shown.
    const none = (await brief(set.id, { event_id: null })).body.data.brief;
    expect(none.event_id).toBeNull();
    expect(eventLines(none)).toEqual([]);

    // A regenerate with none named keeps the base's event; with null, none.
    await sceneGen.generateBaseScene(await models.SceneSet.findByPk(set.id), models, { skipAnalysis: true });
    let after = await models.SceneSet.findByPk(set.id, { attributes: ['base_generation'] });
    expect(after.base_generation.brief.event_id).toBe(ids.event);
    await sceneGen.generateBaseScene(await models.SceneSet.findByPk(set.id), models, { skipAnalysis: true, eventId: null });
    after = await models.SceneSet.findByPk(set.id, { attributes: ['base_generation', 'base_runway_prompt'] });
    expect(after.base_generation.brief.event_id).toBeNull();
    expect(after.base_runway_prompt).not.toContain('Velour Launch');
  });

  it('an angle\'s brief takes its base\'s event; an event_id sent for an angle is not taken', async () => {
    const set = await makeSet();
    await sceneGen.generateBaseScene(set, models, { skipAnalysis: true, eventId: ids.event });
    const angle = await models.SceneAngle.create({ scene_set_id: set.id, angle_label: 'WINDOW', angle_name: 'Window' });
    let b = (await brief(set.id, { angle_id: angle.id })).body.data.brief;
    expect(b.event_id).toBe(ids.event);
    b = (await brief(set.id, { angle_id: angle.id, event_id: ids.foreignEvent })).body.data.brief;
    expect(b.event_id).toBe(ids.event);
  });

  it('cascade-regenerate carries the event chosen on the brief to its job', async () => {
    const set = await makeSet();
    const res = await auth(request(app).post(`/api/v1/scene-sets/${set.id}/cascade-regenerate`)).send({ event_id: ids.event });
    expect(res.status).toBe(202);
    const job = await models.GenerationJob.findByPk(res.body.data.jobId);
    expect(job.payload).toEqual({ force: true, event_id: ids.event });
    await job.destroy();
    const none = await auth(request(app).post(`/api/v1/scene-sets/${set.id}/cascade-regenerate`)).send({});
    const noneJob = await models.GenerationJob.findByPk(none.body.data.jobId);
    expect(noneJob.payload).toEqual({ force: true });
    await noneJob.destroy();
  });
});
