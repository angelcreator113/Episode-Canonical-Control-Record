/**
 * Scene Sets fourth audit (2026-10-15), HIGH findings, on the test database:
 *  - a cascade job retried (or was re-queued after a restart) and paid for
 *    the base and every angle again;
 *  - promote-to-base ran during a base run, and dropped the other angles'
 *    pictures with no history;
 *  - the Scene Studio restyle wrote one result into both the base and an
 *    angle, claimed nothing, and restyled any URL it was sent;
 *  - an angle could be generated while the base was being made;
 *  - a new base left the Inside angle (the base picture) on the old room.
 */
jest.unmock('uuid');

const mockRestyle = jest.fn();
jest.mock('../../src/services/imageRestyleService', () => ({ restyleBackground: (...a) => mockRestyle(...a) }));
jest.mock('@aws-sdk/client-s3', () => {
  const actual = jest.requireActual('@aws-sdk/client-s3');
  return { ...actual, S3Client: jest.fn(() => ({ send: jest.fn(async () => ({})) })) };
});

const request = require('supertest');
const crypto = require('crypto');
const app = require('../../src/app');
const TokenService = require('../../src/services/tokenService');
const models = require('../../src/models');

const { sequelize } = models;
const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const uuid = () => crypto.randomUUID();
const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });
const rows = async (sql, replacements = {}) => (await sequelize.query(sql, { replacements }))[0];
const PNG = Buffer.from('89504e470d0a1a0a', 'hex');

(shouldSkip ? describe.skip : describe)('Scene Sets HIGH fixes (fourth audit)', () => {
  let token;
  const setIds = [];
  const auth = (r) => r.set('Authorization', `Bearer ${token}`);
  const api = (method, path) => auth(request(app)[method](`/api/v1/scene-sets${path}`));

  async function makeSet(fields = {}) {
    const set = await models.SceneSet.create({ name: `High4 ${uuid().slice(0, 8)}`, scene_type: 'HOME_BASE', base_still_url: 'https://x/base.jpg', generation_status: 'complete', ...fields });
    setIds.push(set.id);
    return set;
  }
  const angle = (setId, fields = {}) => models.SceneAngle.create({ scene_set_id: setId, angle_label: 'VANITY', angle_name: 'Vanity', generation_status: 'complete', still_image_url: 'https://x/vanity.jpg', ...fields });

  beforeAll(async () => {
    await sequelize.query(`ALTER TABLE scene_sets ADD COLUMN IF NOT EXISTS cover_angle_id uuid`);
    await sequelize.query(`ALTER TABLE scene_angles
      ADD COLUMN IF NOT EXISTS angle_description text,
      ADD COLUMN IF NOT EXISTS camera_direction text,
      ADD COLUMN IF NOT EXISTS quality_score integer,
      ADD COLUMN IF NOT EXISTS artifact_flags jsonb DEFAULT '[]'::jsonb,
      ADD COLUMN IF NOT EXISTS quality_review jsonb,
      ADD COLUMN IF NOT EXISTS generation_attempt integer,
      ADD COLUMN IF NOT EXISTS post_processing_status text,
      ADD COLUMN IF NOT EXISTS enhanced_still_url text,
      ADD COLUMN IF NOT EXISTS enhanced_video_url text`);
    token = TokenService.generateTokenPair({
      id: 'test-user-high4', email: 'user@high4.dev', name: 'Editor', groups: ['USER', 'EDITOR'], role: 'USER',
    }).accessToken;
  });
  beforeEach(() => {
    mockRestyle.mockReset();
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => jest.restoreAllMocks());
  afterAll(async () => {
    if (setIds.length) {
      await run('DELETE FROM generation_jobs WHERE scene_set_id IN (:ids)', { ids: setIds });
      await run('DELETE FROM scene_angles WHERE scene_set_id IN (:ids)', { ids: setIds });
      await run('DELETE FROM scene_sets WHERE id IN (:ids)', { ids: setIds });
    }
  });

  it('a cascade job gets one attempt', async () => {
    const set = await makeSet();
    const res = await api('post', `/${set.id}/cascade-regenerate`).send({});
    expect(res.status).toBe(202);
    const [[job]] = await sequelize.query('SELECT max_attempts FROM generation_jobs WHERE id = :id', { replacements: { id: res.body.data.jobId } });
    expect(job.max_attempts).toBe(1);
  });

  it('promote waits for a base run, and keeps the other angles\' pictures in their history', async () => {
    const set = await makeSet();
    const front = await angle(set.id, { angle_label: 'WIDE', angle_name: 'Wide', still_image_url: 'https://x/wide.jpg' });
    const other = await angle(set.id, { enhanced_still_url: 'https://x/vanity-enhanced.jpg', quality_score: 80 });
    await set.update({ generation_status: 'generating' });
    const busy = await api('post', `/${set.id}/promote-to-base`).send({ angle_id: front.id });
    expect(busy.status).toBe(409);
    await set.update({ generation_status: 'complete' });
    expect((await api('post', `/${set.id}/promote-to-base`).send({ angle_id: front.id })).status).toBe(200);
    const [row] = await rows('SELECT still_image_url, enhanced_still_url, quality_score, quality_review FROM scene_angles WHERE id = :id', { id: other.id });
    expect(row).toMatchObject({ still_image_url: null, enhanced_still_url: null, quality_score: null });
    expect(row.quality_review.generation_history.map((h) => h.url)).toEqual(['https://x/vanity.jpg']);
  });

  it('an angle is not generated while its set\'s base is being made', async () => {
    const set = await makeSet({ generation_status: 'generating' });
    const a = await angle(set.id, { generation_status: 'pending', still_image_url: null });
    const res = await api('post', `/${set.id}/angles/${a.id}/generate`).send({});
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('ALREADY_GENERATING');
    expect((await api('post', `/${set.id}/generate-all-angles`).send({})).status).toBe(409);
  });

  it('the restyle changes only the angle shown, from its own picture; the base stays', async () => {
    const set = await makeSet();
    const a = await angle(set.id);
    mockRestyle.mockResolvedValue({ restyled_url: 'https://x/vanity-night.jpg' });
    expect((await api('post', `/${set.id}/regenerate-background`).send({ angle_id: 'nope' })).status).toBe(400);
    const res = await api('post', `/${set.id}/regenerate-background`).send({ angle_id: a.id, mood: 'night', current_background_url: 'https://elsewhere.example/x.jpg' });
    expect(res.status).toBe(200);
    expect(mockRestyle.mock.calls[0][0]).toBe('https://x/vanity.jpg');
    const [setRow] = await rows('SELECT base_still_url FROM scene_sets WHERE id = :id', { id: set.id });
    expect(setRow.base_still_url).toBe('https://x/base.jpg');
    const [angleRow] = await rows('SELECT still_image_url, generation_status, quality_review FROM scene_angles WHERE id = :id', { id: a.id });
    expect(angleRow).toMatchObject({ still_image_url: 'https://x/vanity-night.jpg', generation_status: 'complete' });
    expect(angleRow.quality_review.generation_history.map((h) => h.url)).toEqual(['https://x/vanity.jpg']);
  });

  it('the restyle of the base claims the set and moves the base picture\'s angle with it', async () => {
    const set = await makeSet();
    const inside = await angle(set.id, { angle_label: 'WIDE', angle_kind: 'inside', still_image_url: 'https://x/base.jpg', quality_review: { from_base: { url: 'https://x/base.jpg', source: 'base' } } });
    mockRestyle.mockResolvedValue({ restyled_url: 'https://x/base-night.jpg' });
    await set.update({ generation_status: 'generating' });
    expect((await api('post', `/${set.id}/regenerate-background`).send({ mood: 'night' })).status).toBe(409);
    expect(mockRestyle).not.toHaveBeenCalled();
    await set.update({ generation_status: 'complete' });
    expect((await api('post', `/${set.id}/regenerate-background`).send({ mood: 'night' })).status).toBe(200);
    const [setRow] = await rows('SELECT base_still_url, generation_status FROM scene_sets WHERE id = :id', { id: set.id });
    expect(setRow).toMatchObject({ base_still_url: 'https://x/base-night.jpg', generation_status: 'complete' });
    const [insideRow] = await rows('SELECT still_image_url FROM scene_angles WHERE id = :id', { id: inside.id });
    expect(insideRow.still_image_url).toBe('https://x/base-night.jpg');
  });

  it('an uploaded base moves the base picture\'s angle; a promoted angle keeps its own', async () => {
    const set = await makeSet();
    const inside = await angle(set.id, { angle_label: 'WIDE', angle_kind: 'inside', still_image_url: 'https://x/base.jpg', quality_review: { from_base: { url: 'https://x/base.jpg', source: 'base' } } });
    const promoted = await angle(set.id, { angle_label: 'CLOSE', angle_name: 'Close', still_image_url: 'https://x/base.jpg' });
    const res = await api('post', `/${set.id}/upload-base`).attach('image', PNG, { filename: 'b.png', contentType: 'image/png' });
    expect(res.status).toBe(200);
    const newBase = res.body.data.stillUrl;
    const [insideRow] = await rows('SELECT still_image_url, quality_review FROM scene_angles WHERE id = :id', { id: inside.id });
    expect(insideRow.still_image_url).toBe(newBase);
    expect(insideRow.quality_review.from_base.url).toBe(newBase);
    const [promotedRow] = await rows('SELECT still_image_url FROM scene_angles WHERE id = :id', { id: promoted.id });
    expect(promotedRow.still_image_url).toBe('https://x/base.jpg');
  });
});
