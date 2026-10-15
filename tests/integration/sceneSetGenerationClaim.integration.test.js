/**
 * Scene Sets audit (2026-10-15): a double click on Generate started, and
 * billed, two generations. The base, an angle, a cascade and a batch are
 * now claimed in one statement; a second start while one runs is a 409
 * (ALREADY_GENERATING), and a claim older than 15 minutes (a run that
 * died) can be taken again.
 */
jest.unmock('uuid');

jest.mock('axios', () => ({ post: jest.fn(), get: jest.fn(), create: jest.requireActual('axios').create }));
jest.mock('@aws-sdk/client-s3', () => {
  const actual = jest.requireActual('@aws-sdk/client-s3');
  return { ...actual, S3Client: jest.fn(() => ({ send: jest.fn(async () => ({})) })) };
});

const request = require('supertest');
const axios = require('axios');
const crypto = require('crypto');
const app = require('../../src/app');
const TokenService = require('../../src/services/tokenService');
const models = require('../../src/models');

const { sequelize } = models;
const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

(shouldSkip ? describe.skip : describe)('One generation at a time', () => {
  let token;
  const saved = {};
  const setIds = [];
  const auth = (r) => r.set('Authorization', `Bearer ${token}`);
  const post = (path, body = {}) => auth(request(app).post(`/api/v1/scene-sets${path}`)).send(body);

  beforeAll(async () => {
    await sequelize.query(`ALTER TABLE scene_sets
      ADD COLUMN IF NOT EXISTS style_reference_url text,
      ADD COLUMN IF NOT EXISTS negative_prompt text,
      ADD COLUMN IF NOT EXISTS variation_count integer DEFAULT 1,
      ADD COLUMN IF NOT EXISTS cover_angle_id uuid`);
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
    token = TokenService.generateTokenPair({
      id: 'test-user-generation-claim', email: 'user@generation-claim.dev', name: 'Editor', groups: ['USER', 'EDITOR'], role: 'USER',
    }).accessToken;
  });

  beforeEach(() => {
    for (const k of ['FAL_KEY', 'ANTHROPIC_API_KEY', 'AI_DAILY_IMAGE_BUDGET_USD', 'AI_DAILY_BUDGET_USD']) saved[k] = process.env[k];
    process.env.FAL_KEY = 'test-fal';
    delete process.env.ANTHROPIC_API_KEY;
    process.env.AI_DAILY_IMAGE_BUDGET_USD = '100000';
    process.env.AI_DAILY_BUDGET_USD = '100000';
    // The background runs fail fast: no provider is reached.
    axios.post.mockReset().mockRejectedValue(new Error('provider unavailable in this test'));
    axios.get.mockReset().mockRejectedValue(new Error('no downloads in this test'));
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    for (const [k, v] of Object.entries(saved)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; }
    jest.restoreAllMocks();
  });

  afterAll(async () => {
    // Let the background runs (failing at the provider) finish first.
    for (let i = 0; i < 50 && setIds.length; i += 1) {
      const [[{ n }]] = await sequelize.query(
        `SELECT COUNT(*)::int AS n FROM scene_angles WHERE scene_set_id IN (:ids) AND generation_status = 'generating'
           AND updated_at > NOW() - INTERVAL '10 minutes'`, { replacements: { ids: setIds } });
      if (n === 0) break;
      await new Promise((r) => setTimeout(r, 100));
    }
    if (setIds.length) {
      await sequelize.query('DELETE FROM scene_angles WHERE scene_set_id IN (:ids)', { replacements: { ids: setIds } });
      await sequelize.query('DELETE FROM scene_sets WHERE id IN (:ids)', { replacements: { ids: setIds } });
    }
  });

  async function makeSet(fields = {}) {
    const set = await models.SceneSet.create({ name: `Claim ${crypto.randomUUID().slice(0, 8)}`, scene_type: 'HOME_BASE', ...fields });
    setIds.push(set.id);
    return set;
  }
  const status = async (Model, id) => (await Model.findByPk(id, { attributes: ['generation_status'] })).generation_status;
  const age = (table, id, minutes) => sequelize.query(
    `UPDATE ${table} SET updated_at = NOW() - make_interval(mins => :minutes) WHERE id = :id`, { replacements: { id, minutes } });

  it('an angle being generated is not started again; a stuck claim is', async () => {
    const set = await makeSet({ base_still_url: 'https://bucket.example/base.jpg' });
    const angle = await models.SceneAngle.create({ scene_set_id: set.id, angle_label: 'CLOSE', angle_name: 'Close', generation_status: 'generating' });

    const again = await post(`/${set.id}/angles/${angle.id}/generate`);
    expect([again.status, again.body.code]).toEqual([409, 'ALREADY_GENERATING']);
    expect(axios.post).not.toHaveBeenCalled();

    await age('scene_angles', angle.id, 20);
    const retry = await post(`/${set.id}/angles/${angle.id}/generate`);
    expect(retry.status).toBe(202);
  });

  it('the base: a second start while one runs is refused', async () => {
    const set = await makeSet({ generation_status: 'generating' });
    const res = await post(`/${set.id}/generate-base`, { force: true });
    expect([res.status, res.body.code]).toEqual([409, 'ALREADY_GENERATING']);
    expect(await status(models.SceneSet, set.id)).toBe('generating');
  });

  it('two Generate-all requests at once start each angle once', async () => {
    const set = await makeSet({ base_still_url: 'https://bucket.example/base.jpg' });
    for (const label of ['CLOSE', 'VANITY']) {
      await models.SceneAngle.create({ scene_set_id: set.id, angle_label: label, angle_name: label, generation_status: 'pending' });
    }
    const [a, b] = await Promise.all([post(`/${set.id}/generate-all-angles`), post(`/${set.id}/generate-all-angles`)]);
    expect(a.body.queued + b.body.queued).toBe(2);
    expect([...a.body.angle_ids, ...b.body.angle_ids].sort()).toHaveLength(2);
    expect(new Set([...a.body.angle_ids, ...b.body.angle_ids]).size).toBe(2);
  });
});
