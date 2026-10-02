/**
 * Evoni, 2026-10-02: "when a set's base image changes (upload or generate),
 * its stored description written by the image analysis should be refreshed
 * or flagged, since a description of an old image now drives every prompt."
 *
 * Against the test database, with the providers (axios, Anthropic), S3 and
 * sharp mocked:
 * - a new base (upload, promote, generate) records visual_language
 *   .description_review when the description could be stale;
 * - the new base's analysis rewrites a description the analysis wrote, and
 *   offers its description as a suggestion for one the person wrote;
 * - POST /scene-sets/:id/description-review uses the suggestion or keeps
 *   the description; saving a description clears the review.
 */
jest.unmock('uuid');

const mockCreate = jest.fn();
jest.mock('@anthropic-ai/sdk', () => jest.fn(() => ({ messages: { create: mockCreate } })));
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

const crypto = require('crypto');
const { Sequelize } = require('sequelize');
const request = require('supertest');
const axios = require('axios');
const app = require('../../src/app');
const TokenService = require('../../src/services/tokenService');
const models = require('../../src/models');
const sceneGen = require('../../src/services/sceneGenerationService');
const baseModelMigration = require('../../src/migrations/20261001140000-add-scene-sets-base-model');
const approvedMigration = require('../../src/migrations/20261001220000-world-locations-approved-base');

const { sequelize } = models;

const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const OLD = 'A cream bedroom with a brass bed and a green velvet chair.';
const NEW = 'A white bedroom with an oak bed and a rattan chair.';
const YOURS = 'Lala\'s bedroom, the way Evoni wrote it.';
const uuid = () => crypto.randomUUID();
const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });

(shouldSkip ? describe.skip : describe)('A set\'s description after its base image changes', () => {
  let token;
  const saved = {};
  const setIds = [];
  const auth = (r) => r.set('Authorization', `Bearer ${token}`);

  async function sceneSet(description, { analysed = true } = {}) {
    const id = uuid();
    const vl = analysed ? { image_analysis: { source_url: `https://x/${id}-old.jpg`, version: 7, description: OLD } } : {};
    await run(`INSERT INTO scene_sets (id, name, scene_type, canonical_description, base_still_url, visual_language, generation_status, created_at, updated_at)
               VALUES (:id, 'd-review set', 'HOME_BASE', :description, :base, CAST(:vl AS jsonb), 'complete', NOW(), NOW())`,
    { id, description, base: `https://x/${id}-old.jpg`, vl: JSON.stringify(vl) });
    setIds.push(id);
    return id;
  }
  const row = async (id) => models.SceneSet.findByPk(id, { attributes: ['id', 'name', 'canonical_description', 'base_still_url', 'visual_language', 'base_runway_prompt'] });
  const upload = (id) => auth(request(app).post(`/api/v1/scene-sets/${id}/upload-base`)).attach('image', Buffer.from('jpg'), { filename: 'new.jpg', contentType: 'image/jpeg' });
  const analyse = async (id) => {
    process.env.ANTHROPIC_API_KEY = 'test-anthropic';
    mockCreate.mockResolvedValueOnce({ content: [{ type: 'text', text: JSON.stringify({ description: NEW, anchor_objects: [] }) }] });
    await sceneGen.analyzeBaseImage(await row(id), models.SceneSet);
    delete process.env.ANTHROPIC_API_KEY;
  };

  beforeAll(async () => {
    const qi = sequelize.getQueryInterface();
    await sequelize.query(`ALTER TABLE scene_sets
      ADD COLUMN IF NOT EXISTS style_reference_url text,
      ADD COLUMN IF NOT EXISTS negative_prompt text,
      ADD COLUMN IF NOT EXISTS variation_count integer DEFAULT 1,
      ADD COLUMN IF NOT EXISTS cover_angle_id uuid`);
    for (const m of [baseModelMigration, approvedMigration]) await m.up(qi, Sequelize);
    token = TokenService.generateTokenPair({ id: 'test-user-desc-review', email: 'u@desc.dev', name: 'Editor', groups: ['USER'], role: 'USER' }).accessToken;
  });
  beforeEach(() => {
    for (const k of ['ANTHROPIC_API_KEY', 'FAL_KEY', 'AI_DAILY_IMAGE_BUDGET_USD', 'AI_DAILY_BUDGET_USD', 'SCENE_BASE_MODEL_DEFAULT']) saved[k] = process.env[k];
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.SCENE_BASE_MODEL_DEFAULT;
    process.env.FAL_KEY = 'test-fal';
    process.env.AI_DAILY_IMAGE_BUDGET_USD = '100000';
    process.env.AI_DAILY_BUDGET_USD = '100000';
    mockCreate.mockReset();
    axios.post.mockReset();
    axios.get.mockReset();
    axios.get.mockImplementation(async () => ({ data: Buffer.from('jpg') }));
    axios.post.mockImplementation(async (url) => {
      if (url.startsWith('https://fal.run/')) return { status: 200, data: { images: [{ url: 'https://fal.media/new.jpg' }] } };
      throw new Error(`unexpected provider call ${url}`);
    });
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
    if (setIds.length) {
      await run('DELETE FROM scene_angles WHERE scene_set_id IN (:ids)', { ids: setIds });
      await run('DELETE FROM scene_sets WHERE id IN (:ids)', { ids: setIds });
    }
    await sequelize.close();
  });

  it('upload: a description the analysis wrote is flagged, then rewritten from the new image\'s analysis', async () => {
    const id = await sceneSet(OLD);
    expect((await upload(id)).status).toBe(200);
    let set = await row(id);
    expect(set.base_still_url).not.toBe(`https://x/${id}-old.jpg`);
    expect(set.visual_language.description_review).toMatchObject({ reason: 'base_changed', origin: 'uploaded', base_url: set.base_still_url, machine_written: true });

    await analyse(id);

    set = await row(id);
    expect(set.canonical_description).toBe(NEW);
    expect(set.visual_language.description_review).toBeUndefined();
    expect(set.visual_language.description_source).toMatchObject({ kind: 'image_analysis', source_url: set.base_still_url, text: NEW });
  });

  it('upload: your description is kept and flagged, with the new image\'s description offered; Use it replaces yours', async () => {
    const id = await sceneSet(YOURS);
    await upload(id);
    await analyse(id);
    let set = await row(id);
    expect(set.canonical_description).toBe(YOURS);
    expect(set.visual_language.description_review).toMatchObject({ machine_written: false, suggested: NEW });

    const res = await auth(request(app).post(`/api/v1/scene-sets/${id}/description-review`)).send({ action: 'use_suggested' });

    expect(res.status).toBe(200);
    set = await row(id);
    expect(set.canonical_description).toBe(NEW);
    expect(set.visual_language.description_review).toBeUndefined();
    expect(set.visual_language.description_source).toMatchObject({ kind: 'image_analysis', text: NEW });
  });

  it('Keep mine clears the flag; saving a description clears it too; nothing to use is refused', async () => {
    const id = await sceneSet(YOURS);
    await upload(id);
    expect((await auth(request(app).post(`/api/v1/scene-sets/${id}/description-review`)).send({ action: 'use_suggested' })).status).toBe(409);
    const kept = await auth(request(app).post(`/api/v1/scene-sets/${id}/description-review`)).send({ action: 'keep' });
    expect(kept.status).toBe(200);
    expect((await row(id)).visual_language.description_review).toBeUndefined();
    expect((await row(id)).canonical_description).toBe(YOURS);

    await upload(id);
    expect((await row(id)).visual_language.description_review).toBeTruthy();
    await auth(request(app).put(`/api/v1/scene-sets/${id}`)).send({ canonical_description: 'Rewritten for the new image.' });
    expect((await row(id)).visual_language.description_review).toBeUndefined();
    expect((await auth(request(app).post(`/api/v1/scene-sets/${id}/description-review`)).send({ action: 'other' })).status).toBe(400);
  });

  it('promote: the analysis of the old base is kept, so a description it wrote is still recognised', async () => {
    const id = await sceneSet(OLD);
    const angle = uuid();
    await run(`INSERT INTO scene_angles (id, scene_set_id, angle_name, angle_label, generation_status, still_image_url, beat_affinity, sort_order, created_at, updated_at)
               VALUES (:angle, :id, 'Window', 'WINDOW', 'complete', 'https://x/window.jpg', '[]', 0, NOW(), NOW())`, { angle, id });

    expect((await auth(request(app).post(`/api/v1/scene-sets/${id}/promote-to-base`)).send({ angle_id: angle })).status).toBe(200);

    const set = await row(id);
    expect(set.visual_language.image_analysis).toMatchObject({ description: OLD });
    expect(set.visual_language.description_review).toMatchObject({ origin: 'promoted', base_url: 'https://x/window.jpg', machine_written: true });
  });

  it('generate: a description the analysis wrote is flagged; yours, which the base is made from, is not', async () => {
    const machine = await sceneSet(OLD);
    const yours = await sceneSet(YOURS);
    await sceneGen.generateBaseScene(await models.SceneSet.findByPk(machine), models, { skipAnalysis: true });
    await sceneGen.generateBaseScene(await models.SceneSet.findByPk(yours), models, { skipAnalysis: true });
    expect((await row(machine)).visual_language.description_review).toMatchObject({ origin: 'generated', machine_written: true });
    expect((await row(yours)).visual_language.description_review).toBeUndefined();
  });
});
