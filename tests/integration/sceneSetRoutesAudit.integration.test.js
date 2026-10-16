/**
 * Scene Sets re-audit (2026-10-15), routes, through the real app on the
 * migrated test database (the AI client and S3 are stubbed):
 *  - malformed ids and values were 500s;
 *  - an edit could set an angle "generating" by hand;
 *  - an approved base could be replaced by edit, or its set deleted;
 *  - an upload or a promote landed under a running generation;
 *  - analyze-image and apply-template hard-deleted every angle (and
 *    analyze-image failed on a scene type the database refuses);
 *  - suggest-angles added bedroom angles when the AI failed;
 *  - apply-template never answered.
 */
jest.unmock('uuid');

const mockCreate = jest.fn();
jest.mock('@anthropic-ai/sdk', () => jest.fn(() => ({ messages: { create: mockCreate } })));
jest.mock('@aws-sdk/client-s3', () => {
  const actual = jest.requireActual('@aws-sdk/client-s3');
  return { ...actual, S3Client: jest.fn(() => ({ send: jest.fn(async () => ({})) })) };
});

const request = require('supertest');
const crypto = require('crypto');
const { Sequelize } = require('sequelize');
const app = require('../../src/app');
const TokenService = require('../../src/services/tokenService');
const models = require('../../src/models');
const approvedMigration = require('../../src/migrations/20261001220000-world-locations-approved-base');

const { sequelize } = models;
const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const uuid = () => crypto.randomUUID();
const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });
const rows = async (sql, replacements = {}) => (await sequelize.query(sql, { replacements }))[0];
const PNG = Buffer.from('89504e470d0a1a0a', 'hex');

(shouldSkip ? describe.skip : describe)('Scene set routes (re-audit)', () => {
  let token;
  const saved = {};
  const setIds = [];
  const auth = (r) => r.set('Authorization', `Bearer ${token}`);
  const api = (method, path) => auth(request(app)[method](`/api/v1/scene-sets${path}`));

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
    await approvedMigration.up(sequelize.getQueryInterface(), Sequelize);
    token = TokenService.generateTokenPair({
      id: 'test-user-routes-audit', email: 'user@routes-audit.dev', name: 'Editor', groups: ['USER', 'EDITOR'], role: 'USER',
    }).accessToken;
  });
  beforeEach(() => {
    saved.key = process.env.ANTHROPIC_API_KEY;
    process.env.ANTHROPIC_API_KEY = 'test-key';
    mockCreate.mockReset();
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => {
    if (saved.key === undefined) delete process.env.ANTHROPIC_API_KEY; else process.env.ANTHROPIC_API_KEY = saved.key;
    jest.restoreAllMocks();
  });
  afterAll(async () => {
    if (setIds.length) {
      await run('UPDATE world_locations SET approved_base_scene_set_id = NULL, approved_base_image_url = NULL WHERE approved_base_scene_set_id IN (:ids)', { ids: setIds });
      await run('DELETE FROM scene_angles WHERE scene_set_id IN (:ids)', { ids: setIds });
      await run('DELETE FROM scene_sets WHERE id IN (:ids)', { ids: setIds });
    }
  });

  async function makeSet(fields = {}) {
    const set = await models.SceneSet.create({ name: `Routes ${uuid().slice(0, 8)}`, scene_type: 'HOME_BASE', base_still_url: 'https://x/base.jpg', ...fields });
    setIds.push(set.id);
    return set;
  }
  const angle = (setId, fields = {}) => models.SceneAngle.create({ scene_set_id: setId, angle_label: 'CLOSE', angle_name: 'Close', generation_status: 'pending', ...fields });
  async function approve(set) {
    const loc = uuid();
    await run(`INSERT INTO world_locations (id, name, approved_base_scene_set_id, approved_base_image_url, created_at, updated_at)
               VALUES (:loc, 'The Glasshouse', :set, :url, NOW(), NOW())`, { loc, set: set.id, url: set.base_still_url });
    await set.update({ world_location_id: loc });
  }

  it('malformed ids and values are 400s, not 500s', async () => {
    const set = await makeSet();
    expect((await api('patch', `/${set.id}/angles/not-a-uuid`).send({ angle_name: 'x' })).status).toBe(400);
    expect((await api('get', '/jobs/not-a-uuid')).status).toBe(400);
    expect((await api('put', `/${set.id}`).send({ scene_type: 'EXTERIOR' })).status).toBe(400);
    expect((await api('put', `/${set.id}`).send({ variation_count: 'many' })).status).toBe(400);
    expect((await api('post', `/${set.id}/promote-to-base`).send({ angle_id: 'nope' })).status).toBe(400);
  });

  it('an edit cannot mark an angle generating', async () => {
    const set = await makeSet();
    const a = await angle(set.id);
    const res = await api('patch', `/${set.id}/angles/${a.id}`).send({ generation_status: 'generating' });
    expect(res.status).toBe(400);
    expect((await api('patch', `/${set.id}/angles/${a.id}`).send({ generation_status: 'failed' })).status).toBe(200);
  });

  it('an edit or a reject does not free the claim of a running generation', async () => {
    const set = await makeSet();
    const busy = await angle(set.id, { generation_status: 'generating' });
    expect((await api('patch', `/${set.id}/angles/${busy.id}`).send({ generation_status: 'pending' })).status).toBe(409);
    expect((await api('patch', `/${set.id}/angles/${busy.id}/reject`).send({ reason: 'wrong view' })).status).toBe(409);
    expect((await api('patch', `/${set.id}/angles/${busy.id}`).send({ angle_name: 'Bar stools' })).status).toBe(200);
    const [row] = await rows('SELECT generation_status FROM scene_angles WHERE id = :id', { id: busy.id });
    expect(row.generation_status).toBe('generating');
  });

  it('an approved base is not replaced by edit, and its set is not deleted until un-approved', async () => {
    const set = await makeSet();
    await approve(set);
    expect((await api('put', `/${set.id}`).send({ base_still_url: 'https://x/other.jpg' })).status).toBe(409);
    expect((await api('delete', `/${set.id}`)).status).toBe(409);
    const [row] = await rows('SELECT base_still_url, deleted_at FROM scene_sets WHERE id = :id', { id: set.id });
    expect(row).toMatchObject({ base_still_url: 'https://x/base.jpg', deleted_at: null });
  });

  it('an upload or a promote does not land under a running generation', async () => {
    const set = await makeSet({ generation_status: 'generating' });
    const up = await api('post', `/${set.id}/upload-base`).attach('image', PNG, { filename: 'b.png', contentType: 'image/png' });
    expect([up.status, up.body.code]).toEqual([409, 'ALREADY_GENERATING']);

    const other = await makeSet();
    const busy = await angle(other.id, { generation_status: 'generating' });
    const upAngle = await api('post', `/${other.id}/angles/${busy.id}/upload`).attach('image', PNG, { filename: 'a.png', contentType: 'image/png' });
    expect(upAngle.status).toBe(409);
    const done = await angle(other.id, { angle_label: 'WIDE', generation_status: 'complete', still_image_url: 'https://x/wide.jpg' });
    expect((await api('post', `/${other.id}/promote-to-base`).send({ angle_id: done.id })).status).toBe(409);
  });

  it('analyze-image keeps generated angles, skips a scene type the database refuses, and adds no label twice', async () => {
    const set = await makeSet();
    const made = await angle(set.id, { angle_label: 'WIDE', generation_status: 'complete', still_image_url: 'https://x/wide.jpg', sort_order: 0 });
    const waiting = await angle(set.id, { angle_label: 'DETAIL', sort_order: 1 });
    mockCreate.mockResolvedValue({ content: [{ text: JSON.stringify({
      description: 'A loft.', scene_type: 'EXTERIOR', mood_tags: ['calm'],
      suggested_angles: [{ label: 'WIDE', name: 'Wide' }, { label: 'BAR', name: 'Bar' }],
    }) }] });
    const res = await api('post', `/${set.id}/analyze-image`).send({});
    expect(res.status).toBe(200);
    expect(res.body.updated_fields).not.toContain('scene_type');
    const live = await rows('SELECT id, angle_label FROM scene_angles WHERE scene_set_id = :id AND deleted_at IS NULL ORDER BY sort_order', { id: set.id });
    expect(live.map((a) => a.angle_label)).toEqual(['WIDE', 'BAR']);
    expect(live[0].id).toBe(made.id);
    expect(live.map((a) => a.id)).not.toContain(waiting.id);
  });

  it('suggest-angles says it failed; no bedroom angles are added', async () => {
    const set = await makeSet({ scene_type: 'EVENT_LOCATION' });
    mockCreate.mockRejectedValue(new Error('overloaded'));
    const res = await api('post', `/${set.id}/suggest-angles-from-image`).send({});
    expect(res.status).toBe(500);
    expect(res.body.error).toMatch(/overloaded/);
    expect(await rows('SELECT id FROM scene_angles WHERE scene_set_id = :id', { id: set.id })).toHaveLength(0);
  });

  it('apply-template answers, keeps generated angles and adds only new labels', async () => {
    const set = await makeSet();
    const made = await angle(set.id, { angle_label: 'WIDE', generation_status: 'complete', still_image_url: 'https://x/wide.jpg', sort_order: 0 });
    const res = await api('post', `/${set.id}/apply-template`).send({ template_id: 'luxury_bedroom' });
    expect(res.status).toBe(200);
    expect(res.body.created).toBe(5);
    const labels = (await rows('SELECT id, angle_label FROM scene_angles WHERE scene_set_id = :id AND deleted_at IS NULL', { id: set.id }));
    expect(labels.filter((a) => a.angle_label === 'WIDE').map((a) => a.id)).toEqual([made.id]);
  });

  it('a mood variation is saved with the set; a second mood keeps the first', async () => {
    // Third audit (2026-10-15): the stored object changed in place compared
    // equal to itself, so nothing was written.
    const sceneGen = require('../../src/services/sceneGenerationService');
    jest.spyOn(sceneGen, 'generateMoodVariants')
      .mockResolvedValueOnce({ glam: 'https://x/glam.jpg' })
      .mockResolvedValueOnce({ cozy: 'https://x/cozy.jpg' })
      .mockResolvedValueOnce({});
    const set = await makeSet({ base_still_url: 'https://x/base.jpg' });
    const post = (moods) => auth(request(app).post(`/api/v1/scene-sets/${set.id}/mood-variants`)).send({ moods });
    expect((await post(['glam'])).status).toBe(200);
    expect((await post(['cozy'])).status).toBe(200);
    const [row] = await rows('SELECT visual_language FROM scene_sets WHERE id = :id', { id: set.id });
    expect(row.visual_language.mood_variants.base).toEqual({ glam: 'https://x/glam.jpg', cozy: 'https://x/cozy.jpg' });
    const none = await post(['glam']);
    expect(none.status).toBe(400);
    expect(none.body.error).toMatch(/No mood variant could be made/);
  });
});
