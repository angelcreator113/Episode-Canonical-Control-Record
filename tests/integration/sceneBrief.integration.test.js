/**
 * The Scene Brief (ruling S1, Evoni 2026-09-30; EVENT_EPISODE_FLOW.md
 * §8(dd)). Through generateBaseScene and the preview route, on the test
 * database: the place from the scene set's World Location, the event only
 * when chosen explicitly (and only from the set's show), the brief kept on
 * base_generation.brief, and no generic style text in the prompt. The image
 * providers, S3 and sharp are mocked, as in
 * sceneBaseModelComparison.integration.test.js.
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

(shouldSkip ? describe.skip : describe)('The Scene Brief (S1)', () => {
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
    await migration.up(sequelize.getQueryInterface(), Sequelize);
    token = TokenService.generateTokenPair({
      id: 'test-user-scene-brief', email: 'user@scene-brief.dev', name: 'Editor', groups: ['USER', 'EDITOR'], role: 'USER',
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

  it('generateBaseScene sends the brief: place from the World Location, the chosen event, no generic text', async () => {
    const set = await makeSet();
    await sceneGen.generateBaseScene(set, models, { skipAnalysis: true, eventId: ids.event });
    const row = await models.SceneSet.findByPk(set.id, { attributes: ['base_runway_prompt', 'base_generation'] });
    const prompt = row.base_runway_prompt;
    expect(prompt).toContain('No people present');
    expect(prompt).not.toMatch(/empty (space|room)/i);
    expect(prompt).toContain('Architecture: Victorian iron-and-glass conservatory.');
    expect(prompt).toContain('Materials: black wrought iron metal fixtures.');
    expect(prompt).toContain('Outside, through windows and doorways: Echo Park, Los Angeles.');
    expect(prompt).toContain('Dressed for Velour Launch, themed "Midnight Garden".');
    expect(prompt).toContain('never on the building: plum, gold.');
    expect(prompt).not.toMatch(/feminine aesthetic|Soft natural lighting/);
    const brief = row.base_generation.brief;
    expect(brief).toMatchObject({ version: 1, world_location_id: ids.location, event_id: ids.event, angle: 'WIDE', missing: [] });
    // The prompt sent to the provider is the brief's.
    const body = axios.post.mock.calls.find(([url]) => url.startsWith('https://fal.run/'))[1];
    expect(body.prompt).toBe(prompt);
  });

  it('without a chosen event there is no event layer; another show\'s event is never used', async () => {
    const set = await makeSet();
    await sceneGen.generateBaseScene(set, models, { skipAnalysis: true });
    let row = await models.SceneSet.findByPk(set.id, { attributes: ['base_generation'] });
    expect(row.base_generation.brief.event_id).toBeNull();
    expect(row.base_generation.brief.lines.some((l) => l.layer === 'event')).toBe(false);

    await sceneGen.generateBaseScene(await models.SceneSet.findByPk(set.id), models, { skipAnalysis: true, eventId: ids.foreignEvent });
    row = await models.SceneSet.findByPk(set.id, { attributes: ['base_generation'] });
    expect(row.base_generation.brief.event_id).toBeNull();
  });

  it('the preview route returns the brief, with the event named in the query', async () => {
    const set = await makeSet();
    const res = await request(app).get(`/api/v1/scene-sets/${set.id}/preview-prompt?event_id=${ids.event}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.brief).toMatchObject({ event_id: ids.event, world_location_id: ids.location });
    const sources = new Set(res.body.data.brief.lines.map((l) => l.source));
    expect([...sources].sort()).toEqual(['event', 'venue']);
    expect(res.body.data.prompt).toContain('Velour Launch');
  });
});
