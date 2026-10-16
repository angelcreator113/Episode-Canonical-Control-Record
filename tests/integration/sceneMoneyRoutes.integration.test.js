/**
 * Scene Sets audit #3 (2026-10-15), money, through the routes on the test
 * database:
 *   - generate-object billed two images for a scene set that does not exist;
 *   - auto-refine queued a paid chain on an angle being generated;
 *   - an angle video job retried after a billed Runway job.
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

(shouldSkip ? describe.skip : describe)('Scene Sets money routes (audit #3)', () => {
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
      id: 'test-user-scene-money', email: 'user@scene-money.dev', name: 'Editor', groups: ['USER', 'EDITOR'], role: 'USER',
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
    if (setIds.length) {
      await sequelize.query('DELETE FROM generation_jobs WHERE scene_set_id IN (:ids)', { replacements: { ids: setIds } });
      await sequelize.query('DELETE FROM scene_angles WHERE scene_set_id IN (:ids)', { replacements: { ids: setIds } });
      await sequelize.query('DELETE FROM scene_sets WHERE id IN (:ids)', { replacements: { ids: setIds } });
    }
    await sequelize.close();
  });

  async function makeSet() {
    const set = await models.SceneSet.create({ name: 'Money set', scene_type: 'HOME_BASE', base_still_url: 'https://bucket.example/base.jpg', generation_status: 'complete' });
    setIds.push(set.id);
    const angle = await models.SceneAngle.create({
      scene_set_id: set.id, angle_label: 'VANITY', angle_name: 'Vanity', still_image_url: 'https://bucket.example/v.jpg',
      generation_status: 'complete', quality_score: 40, artifact_flags: [{ category: 'distorted_hands' }], generation_attempt: 1,
    });
    return { set, angle };
  }

  it('generate-object for a set that does not exist is a 404, with no image call', async () => {
    const res = await post(`/${crypto.randomUUID()}/generate-object`, { prompt: 'a lamp' });
    expect(res.status).toBe(404);
    expect(axios.post).not.toHaveBeenCalled();
  });

  it('auto-refine of an angle being generated is a 409, before anything is queued', async () => {
    const { set, angle } = await makeSet();
    await angle.update({ generation_status: 'generating' });
    const res = await post(`/${set.id}/angles/${angle.id}/auto-refine`, {});
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('ALREADY_GENERATING');
  });

  it('an angle video job gets one attempt', async () => {
    const { set, angle } = await makeSet();
    const res = await post(`/${set.id}/angles/${angle.id}/generate-video`, {});
    expect(res.status).toBe(202);
    const [[job]] = await sequelize.query('SELECT max_attempts FROM generation_jobs WHERE id = :id', { replacements: { id: res.body.data.jobId } });
    expect(job.max_attempts).toBe(1);
  });
});
