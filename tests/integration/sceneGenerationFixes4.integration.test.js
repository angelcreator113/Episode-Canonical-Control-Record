/**
 * Scene Sets fourth audit (2026-10-15), generation findings, on the test
 * database:
 *  - an uploaded base was stored as given (a portrait photo, a tiny image),
 *    and kept the last generated base's size as its own;
 *  - an edit to what an angle shows marked its picture stale only in the
 *    response, so a reload lost it;
 *  - a still and a video of one angle could run at once: the video's end
 *    marked the still run "complete" and kept a clip of the old picture.
 */
jest.unmock('uuid');

jest.mock('@aws-sdk/client-s3', () => {
  const actual = jest.requireActual('@aws-sdk/client-s3');
  return { ...actual, S3Client: jest.fn(() => ({ send: jest.fn(async () => ({})) })) };
});

const request = require('supertest');
const crypto = require('crypto');
const sharp = require('sharp');
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
const picture = (width, height) => sharp({ create: { width, height, channels: 3, background: '#c8a' } }).png().toBuffer();

(shouldSkip ? describe.skip : describe)('Scene Sets generation fixes (fourth audit)', () => {
  let token;
  const setIds = [];
  const saved = {};
  const auth = (r) => r.set('Authorization', `Bearer ${token}`);
  const api = (method, path) => auth(request(app)[method](`/api/v1/scene-sets${path}`));

  async function makeSet(fields = {}) {
    const set = await models.SceneSet.create({ name: `Gen4 ${uuid().slice(0, 8)}`, scene_type: 'HOME_BASE', base_still_url: 'https://x/base.jpg', generation_status: 'complete', ...fields });
    setIds.push(set.id);
    return set;
  }
  const angle = (setId, fields = {}) => models.SceneAngle.create({ scene_set_id: setId, angle_label: 'VANITY', angle_name: 'Vanity', generation_status: 'complete', still_image_url: 'https://x/vanity.jpg', ...fields });
  const videoJob = (set, a, status = 'processing') => models.GenerationJob.create({ job_type: 'generate_angle_video', scene_set_id: set.id, scene_angle_id: a.id, payload: {}, status, max_attempts: 1 });

  beforeAll(async () => {
    await sequelize.query(`ALTER TABLE scene_angles ADD COLUMN IF NOT EXISTS quality_review jsonb`);
    token = TokenService.generateTokenPair({
      id: 'test-user-gen4', email: 'user@gen4.dev', name: 'Editor', groups: ['USER', 'EDITOR'], role: 'USER',
    }).accessToken;
    saved.FAL_KEY = process.env.FAL_KEY;
    process.env.FAL_KEY = 'test-fal';
  });
  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => jest.restoreAllMocks());
  afterAll(async () => {
    if (saved.FAL_KEY === undefined) delete process.env.FAL_KEY; else process.env.FAL_KEY = saved.FAL_KEY;
    if (setIds.length) {
      await run('DELETE FROM generation_jobs WHERE scene_set_id IN (:ids)', { ids: setIds });
      await run('DELETE FROM scene_angles WHERE scene_set_id IN (:ids)', { ids: setIds });
      await run('DELETE FROM scene_sets WHERE id IN (:ids)', { ids: setIds });
    }
  });

  describe('upload-base', () => {
    it('stores a portrait photo as a 1920x1080 JPEG, and the base is the upload\'s size', async () => {
      const set = await makeSet({ base_generation: { width: 1024, height: 576, model: 'flux', comparison_group: 'g1' } });
      const res = await api('post', `/${set.id}/upload-base`).attach('image', await picture(1080, 1920), 'portrait.png');
      expect(res.status).toBe(200);
      const row = await models.SceneSet.findByPk(set.id);
      expect(row.base_still_url).toMatch(/\/still-\d+-0\.jpg$/);
      expect(row.base_generation).toMatchObject({ source: 'uploaded', width: 1920, height: 1080, comparison_group: 'g1' });
    });

    it('refuses an image under 640x360, and a file that is not an image, keeping the base', async () => {
      const set = await makeSet();
      const small = await api('post', `/${set.id}/upload-base`).attach('image', await picture(600, 400), 'small.png');
      expect(small.status).toBe(400);
      expect(small.body.error).toMatch(/600x400: a base needs at least 640x360/);
      const junk = await api('post', `/${set.id}/upload-base`).attach('image', Buffer.from('not an image'), { filename: 'junk.png', contentType: 'image/png' });
      expect(junk.status).toBe(400);
      expect(junk.body.error).toMatch(/not a readable image/);
      expect((await models.SceneSet.findByPk(set.id)).base_still_url).toBe('https://x/base.jpg');
    });
  });

  describe('editing an angle', () => {
    it('keeps the picture marked stale after an edit to what it shows, not after a rename', async () => {
      const set = await makeSet();
      const a = await angle(set.id, { quality_review: { from_base: true, notes: 'kept' } });
      const renamed = await api('patch', `/${set.id}/angles/${a.id}`).send({ angle_name: 'Mirror corner' });
      expect(renamed.body.image_stale).toBe(false);
      expect((await models.SceneAngle.findByPk(a.id)).quality_review.stale).toBeUndefined();

      const same = await api('patch', `/${set.id}/angles/${a.id}`).send({ angle_description: null });
      expect(same.body.image_stale).toBe(false);

      const edited = await api('patch', `/${set.id}/angles/${a.id}`).send({ angle_description: 'The vanity, from the bed' });
      expect(edited.body.image_stale).toBe(true);
      const row = await models.SceneAngle.findByPk(a.id);
      expect(row.quality_review).toMatchObject({ notes: 'kept', stale: { reason: 'edited', fields: ['angle_description'] } });
      expect(row.quality_review.from_base).toBeUndefined();
    });

    it('an angle with no picture yet is not marked', async () => {
      const set = await makeSet();
      const a = await angle(set.id, { still_image_url: null, generation_status: 'pending' });
      const res = await api('patch', `/${set.id}/angles/${a.id}`).send({ camera_direction: 'low, from the door' });
      expect(res.body.image_stale).toBe(false);
      expect((await models.SceneAngle.findByPk(a.id)).quality_review?.stale).toBeUndefined();
    });
  });

  describe('a still and a video of one angle', () => {
    it('no new still while its video is queued or being made', async () => {
      const set = await makeSet();
      const a = await angle(set.id);
      await videoJob(set, a, 'queued');
      const gen = await api('post', `/${set.id}/angles/${a.id}/generate`).send({});
      expect(gen.status).toBe(409);
      expect(gen.body.code).toBe('VIDEO_IN_PROGRESS');
      const refine = await api('post', `/${set.id}/angles/${a.id}/regenerate`).send({ categories: ['FURNITURE_DISTORTION'] });
      expect(refine.status).toBe(409);
      expect(refine.body.code).toBe('VIDEO_IN_PROGRESS');
      expect((await models.SceneAngle.findByPk(a.id)).generation_status).toBe('complete');
    });

    it('no video while its still, or the base it would move, is being made', async () => {
      const set = await makeSet();
      const a = await angle(set.id, { generation_status: 'generating' });
      const res = await api('post', `/${set.id}/angles/${a.id}/generate-video`).send({});
      expect(res.status).toBe(409);
      expect(res.body.code).toBe('ALREADY_GENERATING');

      const busyBase = await makeSet({ generation_status: 'generating' });
      const noStill = await angle(busyBase.id, { still_image_url: null, generation_status: 'pending' });
      const fromBase = await api('post', `/${busyBase.id}/angles/${noStill.id}/generate-video`).send({});
      expect(fromBase.status).toBe(409);
      expect(fromBase.body.code).toBe('ALREADY_GENERATING');
      expect(await models.GenerationJob.count({ where: { scene_set_id: [set.id, busyBase.id] } })).toBe(0);
    });
  });
});
