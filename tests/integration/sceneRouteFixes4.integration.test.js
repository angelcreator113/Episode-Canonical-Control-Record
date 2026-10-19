/**
 * Scene Sets fourth audit (2026-10-15), route findings, on the test database:
 *  - post-process sent the body's options to Sharp, Cloudinary and the
 *    FFmpeg filter graph as given, with no rate limit;
 *  - spec/validate-angle sent any URL to Claude Vision, with no rate limit;
 *  - a budget refusal read as a 500;
 *  - Delete all angles ran while angles were being generated;
 *  - a long or wrong-typed value was a 500;
 *  - a set another show uses could move to this show;
 *  - creating a set linked episodes that did not exist or were another show's;
 *  - a PUT wrote back the whole visual_language it had read, dropping what
 *    was written meanwhile;
 *  - the event look routes cast bad ids in the database (500).
 */
jest.unmock('uuid');

const request = require('supertest');
const crypto = require('crypto');
const app = require('../../src/app');
const TokenService = require('../../src/services/tokenService');
const models = require('../../src/models');
const postProcessService = require('../../src/services/postProcessingService');
const sceneSpecService = require('../../src/services/sceneSpecService');

const { sequelize } = models;
const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const uuid = () => crypto.randomUUID();
const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });
const rows = async (sql, replacements = {}) => (await sequelize.query(sql, { replacements }))[0];

(shouldSkip ? describe.skip : describe)('Scene Sets route fixes (fourth audit)', () => {
  let token;
  const setIds = [];
  const auth = (r) => r.set('Authorization', `Bearer ${token}`);
  const api = (method, path) => auth(request(app)[method](`/api/v1/scene-sets${path}`));

  async function makeSet(fields = {}) {
    const set = await models.SceneSet.create({ name: `Routes4 ${uuid().slice(0, 8)}`, scene_type: 'HOME_BASE', base_still_url: 'https://x/base.jpg', generation_status: 'complete', ...fields });
    setIds.push(set.id);
    return set;
  }
  const angle = (setId, fields = {}) => models.SceneAngle.create({ scene_set_id: setId, angle_label: 'VANITY', angle_name: 'Vanity', generation_status: 'complete', still_image_url: 'https://x/vanity.jpg', ...fields });
  async function show() {
    const id = uuid();
    await run(`INSERT INTO shows (id, name, slug, metadata, created_at, updated_at) VALUES (:id, :name, :slug, '{}', NOW(), NOW())`,
      { id, name: `Routes4 ${id.slice(0, 8)}`, slug: `routes4-${id.slice(0, 8)}` });
    return id;
  }
  async function episode(showId) {
    const id = uuid();
    await run(`INSERT INTO episodes (id, show_id, title, episode_number, status, created_at, updated_at)
               VALUES (:id, :showId, 'Routes4 episode', 1, 'draft', NOW(), NOW())`, { id, showId });
    return id;
  }

  beforeAll(async () => {
    await sequelize.query(`ALTER TABLE scene_angles
      ADD COLUMN IF NOT EXISTS quality_review jsonb,
      ADD COLUMN IF NOT EXISTS enhanced_still_url text`);
    token = TokenService.generateTokenPair({
      // Scene-set writes are ADMIN only (Evoni, 2026-10-19: this whole part of the site is admin only).
      id: 'test-admin-routes4', email: 'admin@routes4.dev', name: 'Admin', groups: ['ADMIN'], role: 'ADMIN',
    }).accessToken;
  });
  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => jest.restoreAllMocks());
  afterAll(async () => {
    if (setIds.length) {
      await run('DELETE FROM scene_set_episodes WHERE scene_set_id IN (:ids)', { ids: setIds });
      await run('DELETE FROM scene_angles WHERE scene_set_id IN (:ids)', { ids: setIds });
      await run('DELETE FROM scene_sets WHERE id IN (:ids)', { ids: setIds });
    }
  });

  describe('post-process', () => {
    it('refuses options that are not numbers in range, or not options, before any work', async () => {
      const set = await makeSet();
      const a = await angle(set.id);
      const process = jest.spyOn(postProcessService, 'processAngleAssets').mockResolvedValue({ ok: true });
      const post = (body) => api('post', `/${set.id}/angles/${a.id}/post-process`).send(body);

      const injected = await post({ ffmpegOptions: { brightness: "0:contrast=1,movie=/etc/passwd" } });
      expect(injected.status).toBe(400);
      expect(injected.body.error).toMatch(/ffmpegOptions.brightness must be a number/);
      expect((await post({ sharpOptions: { targetWidth: 100000 } })).status).toBe(400);
      expect((await post({ cloudinarySettings: { e_overlay: 'x' } })).status).toBe(400);
      expect((await post({ skipSharp: 'yes' })).status).toBe(400);
      expect(process).not.toHaveBeenCalled();

      const ok = await post({ skipCloudinary: true, ffmpegOptions: { brightness: 0.05, vignette: false } });
      expect(ok.status).toBe(200);
      expect(process.mock.calls[0][3]).toEqual({
        skipSharp: false, skipCloudinary: true, skipFFmpeg: false,
        sharpOptions: {}, cloudinarySettings: {}, ffmpegOptions: { brightness: 0.05, vignette: false },
      });
    });

    it('the FFmpeg step refuses a value that is not a number, whatever the caller', async () => {
      await expect(postProcessService.ffmpegEnhanceVideo('https://x/v.mp4', { brightness: '0,movie=x' }))
        .rejects.toThrow(/brightness must be a number/);
    });
  });

  describe('spec/validate-angle', () => {
    it("checks only this set's own pictures", async () => {
      const set = await makeSet({ scene_spec: { camera_contracts: [] } });
      await angle(set.id);
      const check = jest.spyOn(sceneSpecService, 'validateAngleAgainstSpec').mockResolvedValue({ ok: true });
      const post = (image_url) => api('post', `/${set.id}/spec/validate-angle`).send({ image_url, angle_label: 'VANITY' });
      expect((await post('https://elsewhere/any.jpg')).status).toBe(400);
      expect(check).not.toHaveBeenCalled();
      expect((await post('https://x/vanity.jpg')).status).toBe(200);
      expect((await post('https://x/base.jpg')).status).toBe(200);
      expect(check).toHaveBeenCalledTimes(2);
    });

    it('a budget refusal is a 429 with its reason, not a 500', async () => {
      const set = await makeSet({ scene_spec: { camera_contracts: [] } });
      const refusal = Object.assign(new Error('AI daily budget exceeded ($50.00 / $50). Call blocked.'), { status: 429, code: 'AI_BUDGET_EXCEEDED' });
      jest.spyOn(sceneSpecService, 'validateAngleAgainstSpec').mockRejectedValue(refusal);
      const res = await api('post', `/${set.id}/spec/validate-angle`).send({ image_url: 'https://x/base.jpg', angle_label: 'WIDE' });
      expect(res.status).toBe(429);
      expect(res.body).toMatchObject({ code: 'AI_BUDGET_EXCEEDED', error: expect.stringMatching(/budget exceeded/) });
    });
  });

  it('Delete all angles waits while the base or an angle is being generated', async () => {
    const set = await makeSet();
    const busy = await angle(set.id, { angle_label: 'WINDOW', generation_status: 'generating' });
    await angle(set.id);
    const refused = await api('delete', `/${set.id}/angles`);
    expect(refused.status).toBe(409);
    expect(refused.body.code).toBe('ALREADY_GENERATING');
    expect((await rows('SELECT COUNT(*)::int n FROM scene_angles WHERE scene_set_id = :id AND deleted_at IS NULL', { id: set.id }))[0].n).toBe(2);

    await busy.update({ generation_status: 'complete' });
    await set.update({ generation_status: 'generating' });
    expect((await api('delete', `/${set.id}/angles`)).status).toBe(409);
    await set.update({ generation_status: 'complete' });
    expect((await api('delete', `/${set.id}/angles`)).status).toBe(200);
  });

  describe('fields', () => {
    it('a long or wrong-typed value is a 400 with its reason', async () => {
      const set = await makeSet();
      const put = (body) => api('put', `/${set.id}`).send(body);
      expect((await put({ name: 'x'.repeat(256) })).body.error).toMatch(/name is 255 characters at most/);
      expect((await put({ name: '  ' })).status).toBe(400);
      expect((await put({ time_of_day: 'the golden hour after the rain' })).status).toBe(400);
      expect((await put({ mood_tags: 'cosy' })).status).toBe(400);
      expect((await put({ canonical_description: { text: 'x' } })).status).toBe(400);
      expect((await put({ room_properties: ['wide'] })).status).toBe(400);
      expect((await put({ name: 'Fine name', mood_tags: ['cosy'] })).status).toBe(200);

      const post = (body) => api('post', '/').send({ scene_type: 'HOME_BASE', ...body });
      expect((await post({ name: 'x'.repeat(300) })).status).toBe(400);
      expect((await post({ name: 'New', show_id: 'not-an-id' })).status).toBe(400);
      expect((await post({ name: 'New', show_id: uuid() })).body.error).toMatch(/existing show/);
    });

    it('creating a set links only episodes that exist and are its show\'s', async () => {
      const mine = await show();
      const other = await show();
      const ep = await episode(mine);
      const theirs = await episode(other);
      const post = (body) => api('post', '/').send({ name: `Linked ${uuid().slice(0, 6)}`, scene_type: 'HOME_BASE', ...body });
      expect((await post({ show_id: mine, episode_ids: [uuid()] })).body.error).toMatch(/not found/);
      expect((await post({ show_id: mine, episode_ids: [theirs] })).body.error).toMatch(/another show/);
      const ok = await post({ show_id: mine, episode_ids: [ep] });
      expect(ok.status).toBe(201);
      setIds.push(ok.body.data.id);
    });
  });

  it('a signed-in non-admin may not edit a set or make it a version', async () => {
    const set = await makeSet();
    const editor = TokenService.generateTokenPair({
      id: 'test-user-routes4', email: 'user@routes4.dev', name: 'Editor', groups: ['USER', 'EDITOR'], role: 'USER',
    }).accessToken;
    const as = (r) => r.set('Authorization', `Bearer ${editor}`);
    expect((await as(request(app).put(`/api/v1/scene-sets/${set.id}`)).send({ name: 'Not allowed' })).status).toBe(403);
    expect((await as(request(app).put(`/api/v1/scene-sets/${set.id}/version`)).send({})).status).toBe(403);
    expect((await models.SceneSet.findByPk(set.id)).name).toBe(set.name);
  });

  it('a set another show uses does not move to this show; it can be left with no show', async () => {
    const a = await show();
    const b = await show();
    const set = await makeSet({ show_id: a });
    await run(`INSERT INTO scene_set_episodes (id, scene_set_id, episode_id, created_at, updated_at) VALUES (:id, :set, :ep, NOW(), NOW())`,
      { id: uuid(), set: set.id, ep: await episode(a) });
    // Moving to show b: show a's episode uses it.
    const moved = await api('put', `/${set.id}`).send({ show_id: b });
    expect(moved.status).toBe(409);
    expect(moved.body.code).toBe('USED_BY_ANOTHER_SHOW');
    expect((await rows('SELECT show_id FROM scene_sets WHERE id = :id', { id: set.id }))[0].show_id).toBe(a);
    // Staying with show a, or sharing it with no show, is fine.
    expect((await api('put', `/${set.id}`).send({ show_id: a })).status).toBe(200);
    expect((await api('put', `/${set.id}`).send({ show_id: null })).status).toBe(200);
    // A set used only by its own show's episodes moves to that show.
    expect((await api('put', `/${set.id}`).send({ show_id: a })).status).toBe(200);
  });

  it('a PUT changes only its own visual_language keys, keeping what was written meanwhile', async () => {
    const set = await makeSet({ visual_language: { image_analysis: { lighting: 'warm' }, description_review: { pending: true }, palette: ['gold'] } });
    // Written after the route would have read the set (a generation finishing).
    const writeMeanwhile = jest.spyOn(models.SceneSet.prototype, 'update');
    writeMeanwhile.mockImplementationOnce(async function update(values) {
      await run(`UPDATE scene_sets SET visual_language = visual_language || '{"style_lock": {"seed": 7}}'::jsonb WHERE id = :id`, { id: this.id });
      writeMeanwhile.mockRestore();
      return this.update(values);
    });
    const res = await api('put', `/${set.id}`).send({ room_properties: { size: 'large' } });
    expect(res.status).toBe(200);
    let vl = (await rows('SELECT visual_language FROM scene_sets WHERE id = :id', { id: set.id }))[0].visual_language;
    expect(vl).toMatchObject({ style_lock: { seed: 7 }, room_properties: { size: 'large' }, room_properties_manual: true, palette: ['gold'] });

    // A new description drops the analysis and the review, nothing else.
    expect((await api('put', `/${set.id}`).send({ canonical_description: 'A pink room.' })).status).toBe(200);
    vl = (await rows('SELECT visual_language FROM scene_sets WHERE id = :id', { id: set.id }))[0].visual_language;
    expect(vl.image_analysis).toBeUndefined();
    expect(vl.description_review).toBeUndefined();
    expect(vl).toMatchObject({ style_lock: { seed: 7 }, room_properties: { size: 'large' }, palette: ['gold'] });
  });

  it('the event look routes refuse bad ids with a 400', async () => {
    const showId = await show();
    const w = (method, path) => auth(request(app)[method](`/api/v1/world/${path}`));
    expect((await w('get', `${showId}/events/not-an-id/look`)).status).toBe(400);
    expect((await w('get', `nope/events/${uuid()}/venue-look`)).status).toBe(400);
    const brief = await w('post', `${showId}/events/${uuid()}/look/brief`).send({ scene_set_id: 'nope' });
    expect(brief.status).toBe(400);
    expect(brief.body.error).toMatch(/scene_set_id must be an id/);
  });

  it('cascade: a refused regenerate (already generating) leaves the description as it was', async () => {
    const set = await makeSet({ canonical_description: 'Old words.', generation_status: 'generating' });
    const refused = await api('post', `/${set.id}/cascade-regenerate`).send({ canonical_description: 'New words.' });
    expect(refused.status).toBe(409);
    expect((await rows('SELECT canonical_description FROM scene_sets WHERE id = :id', { id: set.id }))[0].canonical_description).toBe('Old words.');

    await set.update({ generation_status: 'complete' });
    const queued = await api('post', `/${set.id}/cascade-regenerate`).send({ canonical_description: 'New words.' });
    expect(queued.status).toBe(202);
    expect((await rows('SELECT canonical_description, generation_status FROM scene_sets WHERE id = :id', { id: set.id }))[0])
      .toEqual({ canonical_description: 'New words.', generation_status: 'generating' });
    await run('DELETE FROM generation_jobs WHERE scene_set_id = :id', { id: set.id });
  });
});
