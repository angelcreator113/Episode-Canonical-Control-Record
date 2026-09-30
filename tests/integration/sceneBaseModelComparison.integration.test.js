/**
 * Integration Tests — per-scene-set base model, recorded costs, and the
 * base-model comparison (Task #2396; migration
 * 20261001140000-add-scene-sets-base-model).
 *
 * Against the test database, with the providers (axios), S3 and sharp
 * mocked: the migration is re-runnable; generateBaseScene writes the set's
 * base_generation and the logged cost for each model; POST
 * /scene-sets/model-comparison refuses a non-ADMIN and a request without
 * confirm (answering with the estimate), and with confirm creates one set
 * per model per prompt (6), generates base stills only, and GET
 * /scene-sets/model-comparison/:group lays them out with the cost read back
 * from ai_usage_logs.
 *
 * The test database predates some scene_sets columns the model declares
 * (style_reference_url, negative_prompt, variation_count, cover_angle_id; all
 * present in the canon capture). beforeAll adds them IF NOT EXISTS so
 * SceneSet.create works here; that is test-database setup, not a migration.
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

async function waitFor(fn, timeoutMs = 20000) {
  const start = Date.now();
  // eslint-disable-next-line no-constant-condition
  while (true) {
    if (await fn()) return;
    if (Date.now() - start > timeoutMs) throw new Error('timed out waiting');
    await new Promise((r) => setTimeout(r, 100));
  }
}

(shouldSkip ? describe.skip : describe)('Scene base model choice + comparison (Task #2396)', () => {
  let adminToken;
  let userToken;
  const createdSetIds = [];
  const saved = {};

  beforeAll(async () => {
    const qi = sequelize.getQueryInterface();
    await sequelize.query(`ALTER TABLE scene_sets
      ADD COLUMN IF NOT EXISTS style_reference_url text,
      ADD COLUMN IF NOT EXISTS negative_prompt text,
      ADD COLUMN IF NOT EXISTS variation_count integer DEFAULT 1,
      ADD COLUMN IF NOT EXISTS cover_angle_id uuid`);
    await migration.up(qi, Sequelize);
    await migration.up(qi, Sequelize); // guarded: a re-run is a no-op
    adminToken = TokenService.generateTokenPair({
      id: 'test-admin-scene-compare', email: 'admin@scene-compare.dev', name: 'Evoni', groups: ['ADMIN'], role: 'ADMIN',
    }).accessToken;
    userToken = TokenService.generateTokenPair({
      id: 'test-user-scene-compare', email: 'user@scene-compare.dev', name: 'Editor', groups: ['USER', 'EDITOR'], role: 'USER',
    }).accessToken;
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
      const [rows] = await sequelize.query(
        `SELECT base_generation FROM scene_sets WHERE id IN (:ids)`, { replacements: { ids: createdSetIds } },
      );
      const logIds = rows.flatMap((r) => (r.base_generation && r.base_generation.usage_log_ids) || []);
      if (logIds.length) await sequelize.query('DELETE FROM ai_usage_logs WHERE id IN (:ids)', { replacements: { ids: logIds } });
      await sequelize.query('DELETE FROM scene_sets WHERE id IN (:ids)', { replacements: { ids: createdSetIds } });
    }
    await sequelize.close();
  });

  it('the two columns exist and are nullable', async () => {
    const cols = await sequelize.query(
      `SELECT column_name, data_type, is_nullable FROM information_schema.columns
        WHERE table_name = 'scene_sets' AND column_name IN ('base_model', 'base_generation') ORDER BY column_name`,
      { type: sequelize.QueryTypes.SELECT },
    );
    expect(cols).toEqual([
      { column_name: 'base_generation', data_type: 'jsonb', is_nullable: 'YES' },
      { column_name: 'base_model', data_type: 'character varying', is_nullable: 'YES' },
    ]);
  });

  it.each([
    ['flux-dev', 'fal-ai/flux/dev', 0.025],
    ['flux-pro-1.1', 'fal-ai/flux-pro/v1.1', 0.04],
    ['gpt-image-1.5', 'gpt-image-1.5', 0.2],
  ])('generateBaseScene with %s writes base_generation and the logged cost', async (key, model, cost) => {
    const set = await models.SceneSet.create({
      name: `itest-2396 ${key}`, scene_type: 'OTHER', canonical_description: 'A cream bedroom with gold hardware.', base_model: key,
    });
    createdSetIds.push(set.id);

    await sceneGen.generateBaseScene(set, models, { skipAnalysis: true });

    const row = await models.SceneSet.findByPk(set.id, {
      attributes: ['base_model', 'base_generation', 'generation_cost', 'generation_status', 'base_still_url'],
    });
    expect(row.base_model).toBe(key);
    expect(row.generation_status).toBe('complete');
    expect(Number(row.generation_cost)).toBeCloseTo(cost, 4);
    expect(row.base_generation).toMatchObject({ model_key: key, model, cost_usd: cost, estimate_usd: cost });
    const [logs] = await sequelize.query('SELECT model_name, cost_usd FROM ai_usage_logs WHERE id IN (:ids)', {
      replacements: { ids: row.base_generation.usage_log_ids },
    });
    expect(logs).toEqual([{ model_name: model, cost_usd: cost.toFixed(6) }]);
  });

  it('PUT base_model validates the value; null means the default', async () => {
    const set = await models.SceneSet.create({ name: 'itest-2396 put', scene_type: 'OTHER' });
    createdSetIds.push(set.id);
    const bad = await request(app).put(`/api/v1/scene-sets/${set.id}`)
      .set('Authorization', `Bearer ${userToken}`).send({ base_model: 'midjourney' });
    expect(bad.status).toBe(400);
    const ok = await request(app).put(`/api/v1/scene-sets/${set.id}`)
      .set('Authorization', `Bearer ${userToken}`).send({ base_model: 'gpt-image-1.5' });
    expect(ok.status).toBe(200);
    const cleared = await request(app).put(`/api/v1/scene-sets/${set.id}`)
      .set('Authorization', `Bearer ${userToken}`).send({ base_model: '' });
    expect(cleared.status).toBe(200);
    expect((await models.SceneSet.findByPk(set.id, { attributes: ['base_model'] })).base_model).toBeNull();
  });

  it('GET /base-models lists the three with estimates and the default', async () => {
    const res = await request(app).get('/api/v1/scene-sets/base-models').set('Authorization', `Bearer ${userToken}`);
    expect(res.status).toBe(200);
    expect(res.body.default_model).toBe('flux-dev');
    expect(res.body.models.map((m) => [m.key, m.estimate_usd])).toEqual([
      ['flux-dev', 0.025], ['flux-pro-1.1', 0.04], ['gpt-image-1.5', 0.2],
    ]);
  });

  it('POST /model-comparison: 403 for a non-ADMIN, 400 with the estimate without confirm, nothing generated', async () => {
    const body = { prompts: ['A cream bedroom with gold hardware.', 'A glass closet with warm light.'] };
    const before = await models.SceneSet.count();

    const forbidden = await request(app).post('/api/v1/scene-sets/model-comparison')
      .set('Authorization', `Bearer ${userToken}`).send({ ...body, confirm: true });
    expect(forbidden.status).toBe(403);

    const noConfirm = await request(app).post('/api/v1/scene-sets/model-comparison')
      .set('Authorization', `Bearer ${adminToken}`).send(body);
    expect(noConfirm.status).toBe(400);
    expect(noConfirm.body.code).toBe('CONFIRM_REQUIRED');
    expect(noConfirm.body.estimate.total_usd).toBe(0.53);
    expect(noConfirm.body.estimate.per_model.map((m) => [m.model_key, m.usd])).toEqual([
      ['flux-dev', 0.05], ['flux-pro-1.1', 0.08], ['gpt-image-1.5', 0.4],
    ]);

    expect(axios.post).not.toHaveBeenCalled();
    expect(await models.SceneSet.count()).toBe(before);
  });

  it('POST /model-comparison with confirm creates 6 sets, generates base stills only, and the view shows logged costs', async () => {
    const prompts = ['A cream bedroom with gold hardware.', 'A glass closet with warm light.'];
    const res = await request(app).post('/api/v1/scene-sets/model-comparison')
      .set('Authorization', `Bearer ${adminToken}`).send({ prompts, confirm: true });
    expect(res.status).toBe(202);
    const { group, sets } = res.body.data;
    expect(sets).toHaveLength(6);
    createdSetIds.push(...sets.map((s) => s.id));
    expect(sets.map((s) => [s.base_model, s.prompt_index])).toEqual([
      ['flux-dev', 0], ['flux-dev', 1], ['flux-pro-1.1', 0], ['flux-pro-1.1', 1], ['gpt-image-1.5', 0], ['gpt-image-1.5', 1],
    ]);

    await waitFor(async () => {
      const n = await models.SceneSet.count({ where: { id: sets.map((s) => s.id), generation_status: 'complete' } });
      return n === 6;
    });

    // Six image calls, no angles.
    const urls = axios.post.mock.calls.map((c) => c[0]);
    expect(urls.filter((u) => u === 'https://fal.run/fal-ai/flux/dev')).toHaveLength(2);
    expect(urls.filter((u) => u === 'https://fal.run/fal-ai/flux-pro/v1.1')).toHaveLength(2);
    expect(urls.filter((u) => u === 'https://api.openai.com/v1/images/generations')).toHaveLength(2);
    expect(urls).toHaveLength(6);

    const view = await request(app).get(`/api/v1/scene-sets/model-comparison/${group}`)
      .set('Authorization', `Bearer ${userToken}`);
    expect(view.status).toBe(200);
    const cols = view.body.data.columns;
    expect(cols.map((c) => [c.model_key, c.width, c.height, c.logged_total_usd, c.logged_complete])).toEqual([
      ['flux-dev', 1024, 576, 0.05, true],
      ['flux-pro-1.1', 1024, 576, 0.08, true],
      ['gpt-image-1.5', 1536, 1024, 0.4, true],
    ]);
    for (const col of cols) {
      expect(col.sets.map((s) => s.prompt)).toEqual(prompts);
      expect(col.sets.every((s) => s.base_still_url && s.generation_status === 'complete')).toBe(true);
    }
    expect(view.body.data.columns[2].sets.map((s) => s.logged_cost_usd)).toEqual([0.2, 0.2]);

    const list = await request(app).get('/api/v1/scene-sets/model-comparison').set('Authorization', `Bearer ${userToken}`);
    expect(list.status).toBe(200);
    expect(list.body.groups.find((g) => g.group === group)).toMatchObject({ set_count: 6 });
  });
});
