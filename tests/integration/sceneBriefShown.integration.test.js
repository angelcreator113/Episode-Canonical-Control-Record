/**
 * The Scene Brief shown before a paid generation (ruling S2, Evoni
 * 2026-09-30; EVENT_EPISODE_FLOW.md §8(dd)): "each line labelled "From
 * venue", "From event", or "Your override", with missing essentials
 * flagged." Through POST /scene-sets/:id/brief and the generation routes on
 * the test database: the brief shown is the brief sent, overrides replace
 * or remove lines and are kept on the base for its angles, and a removed
 * essential is flagged. Providers, S3 and sharp are mocked as in
 * sceneBrief.integration.test.js.
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

(shouldSkip ? describe.skip : describe)('The Scene Brief, shown before generating (S2)', () => {
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
      id: 'test-user-scene-brief-s2', email: 'user@scene-brief-s2.dev', name: 'Editor', groups: ['USER', 'EDITOR'], role: 'USER',
    }).accessToken;
    for (const [id, name] of [[ids.show, 'Brief show'], [ids.otherShow, 'Other show']]) {
      await run(`INSERT INTO shows (id, name, slug, created_at, updated_at) VALUES (:id, :name, :slug, NOW(), NOW())`,
        { id, name, slug: `brief-${id.slice(0, 8)}` });
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

  it('the base brief: each line labelled by source, no event layer, the base estimate; nothing generated', async () => {
    const set = await makeSet();
    const res = await brief(set.id);
    expect(res.status).toBe(200);
    const { target, brief: b, prompt, estimate } = res.body.data;
    expect(target).toEqual({ kind: 'base' });
    expect(b.lines.every((l) => ['venue', 'event', 'override'].includes(l.source))).toBe(true);
    expect(line(b, 'architecture')).toMatchObject({ layer: 'place', source: 'venue' });
    expect(b.lines.some((l) => l.layer === 'event')).toBe(false);
    expect(b.missing).toEqual([]);
    expect(prompt.startsWith('An empty space with no people')).toBe(true);
    expect(estimate).toMatchObject({ base_model: 'flux-dev', priced: true });
    expect(typeof estimate.usd).toBe('number');
    expect(axios.post).not.toHaveBeenCalled();
  });

  it('overrides: an edited line is "Your override", a removed line goes, a removed essential is flagged', async () => {
    const set = await makeSet();
    const res = await brief(set.id, { overrides: { architecture: 'A brick warehouse with steel trusses', materials: '', description: '' } });
    const b = res.body.data.brief;
    expect(line(b, 'architecture')).toMatchObject({ source: 'override', text: 'A brick warehouse with steel trusses.' });
    expect(line(b, 'materials')).toBeUndefined();
    expect(line(b, 'description')).toMatchObject({ source: 'override', text: '', essential: true });
    expect(b.missing).toEqual([{ layer: 'place', key: 'description', label: 'Description' }]);
    expect(res.body.data.prompt).toContain('A brick warehouse with steel trusses.');
    expect(res.body.data.prompt).not.toContain('wrought iron');
  });

  it('generate-base sends the confirmed overrides; the base keeps them, and the next brief shows them', async () => {
    const set = await makeSet();
    const res = await auth(request(app).post(`/api/v1/scene-sets/${set.id}/generate-base`))
      .send({ overrides: { architecture: 'A brick warehouse with steel trusses' } });
    expect(res.status).toBe(202);
    const row = await waitForBase(set.id);
    expect(row.generation_status).toBe('complete');
    expect(row.base_runway_prompt).toContain('A brick warehouse with steel trusses.');
    expect(row.base_generation.brief.overrides).toEqual({ architecture: 'A brick warehouse with steel trusses' });

    const again = (await brief(set.id)).body.data.brief;
    expect(line(again, 'architecture').source).toBe('override');

    // A regenerate with no overrides keeps the base's.
    await sceneGen.generateBaseScene(await models.SceneSet.findByPk(set.id), models, { skipAnalysis: true });
    const after = await models.SceneSet.findByPk(set.id, { attributes: ['base_runway_prompt'] });
    expect(after.base_runway_prompt).toContain('A brick warehouse with steel trusses.');
  });

  it('an angle\'s brief: its own camera, the base\'s overrides; the refine brief is the regenerate\'s', async () => {
    const set = await makeSet();
    await sceneGen.generateBaseScene(set, models, { skipAnalysis: true, overrides: { architecture: 'A brick warehouse' } });
    const angle = await models.SceneAngle.create({
      scene_set_id: set.id, angle_label: 'WINDOW', angle_name: 'Window', camera_direction: 'Low angle toward the arched window',
    });
    let b = (await brief(set.id, { angle_id: angle.id })).body.data;
    expect(b.target).toMatchObject({ kind: 'angle', angle_id: angle.id, angle_label: 'WINDOW' });
    expect(b.estimate).toBeNull();
    expect(line(b.brief, 'camera').text).toBe('Low angle toward the arched window.');
    expect(line(b.brief, 'architecture')).toMatchObject({ source: 'override', text: 'A brick warehouse.' });
    expect(line(b.brief, 'continuity')).toBeTruthy();

    b = (await brief(set.id, { angle_id: angle.id, refine: true })).body.data;
    expect(line(b.brief, 'camera').text).toMatch(/^Camera facing the window wall/);
    expect(line(b.brief, 'continuity')).toBeTruthy();

    // Overrides given for the angle replace the base's.
    b = (await brief(set.id, { angle_id: angle.id, overrides: {} })).body.data;
    expect(line(b.brief, 'architecture').source).toBe('venue');
  });

  it('an edited, unsaved description is shown in the brief and not saved', async () => {
    const set = await makeSet();
    const b = (await brief(set.id, { canonical_description: 'A moonlit rooftop terrace.' })).body.data.brief;
    expect(line(b, 'description').text).toBe('A moonlit rooftop terrace.');
    const row = await models.SceneSet.findByPk(set.id, { attributes: ['canonical_description'] });
    expect(row.canonical_description).toBe('A greenhouse ballroom under a glass roof.');
  });

  it('bad overrides are refused before anything is generated; an unknown angle is 404; a login is needed', async () => {
    const set = await makeSet();
    expect((await brief(set.id, { overrides: ['x'] })).status).toBe(400);
    expect((await brief(set.id, { overrides: { 'bad key!': 'x' } })).status).toBe(400);
    expect((await brief(set.id, { overrides: { architecture: 'x'.repeat(1001) } })).status).toBe(400);
    const gen = await auth(request(app).post(`/api/v1/scene-sets/${set.id}/generate-base`)).send({ overrides: 'x' });
    expect(gen.status).toBe(400);
    expect(axios.post).not.toHaveBeenCalled();
    expect((await brief(set.id, { angle_id: uuid() })).status).toBe(404);
    expect((await request(app).post(`/api/v1/scene-sets/${set.id}/brief`).send({})).status).toBe(401);
  });
});
