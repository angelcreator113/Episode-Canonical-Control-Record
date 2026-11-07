/**
 * #3714 follow-up: one paid camera-roll Make at a time, fenced, and a paid
 * outcome that is not known is never made again on its own (migration
 * 20261107150000-camera-roll-make-claims; services/cameraRoll make,
 * resolve), against the test database through the routes. The image tool
 * and the storage upload are faked; nothing goes to the network.
 */
jest.unmock('uuid');

// Many Makes in one file: lift the AI route limiter (read when the app loads).
process.env.AI_RATE_LIMIT_PER_IP = '100000';

const mockCreate = jest.fn();
jest.mock('@anthropic-ai/sdk', () => jest.fn().mockImplementation(() => ({ messages: { create: mockCreate } })));

const crypto = require('crypto');
const request = require('supertest');
const axios = require('axios');
const app = require('../../src/app');
const TokenService = require('../../src/services/tokenService');
const models = require('../../src/models');
const cameraRoll = require('../../src/services/cameraRoll');
const postPictures = require('../../src/services/postPictures');
const pulseImage = require('../../src/services/pulseImageService');
const mediaLibrary = require('../../src/services/mediaLibrary');
const variations = require('../../src/services/mediaVariations');
const appearance = require('../../src/services/characterAppearance');
const migration = require('../../src/migrations/20261107150000-camera-roll-make-claims');

const { sequelize } = models;
const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const uuid = () => crypto.randomUUID();
const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });
const q = (sql, replacements = {}) => sequelize.query(sql, { replacements, type: sequelize.QueryTypes.SELECT });
const sleep = (ms) => new Promise((r) => { setTimeout(r, ms); });
const OK_IMAGE = async () => ({ data: { data: [{ b64_json: 'iVBORw0KGgo=' }] } });

(shouldSkip ? describe.skip : describe)('#3714: camera-roll Make safety', () => {
  const tag = uuid().slice(0, 8);
  const ids = { show: uuid(), reg: uuid(), maren: uuid() };
  const pids = {};
  const moments = [];
  const posts = [];
  let admin;
  let stored = 0;
  const as = (req) => req.set('Authorization', `Bearer ${admin}`);
  const imageCalls = () => axios.post.mock.calls.map((c) => c[0]).filter((u) => /images\/(edits|generations)/.test(String(u)));
  // The services directly (the app's write limiter allows 60 writes a minute;
  // this file makes far more); the routes are covered in 'the routes' below.
  const viaService = async (fn, okStatus) => {
    try {
      return { status: okStatus, body: { data: await fn() } };
    } catch (err) {
      return { status: err.status || 500, body: { code: err.code, error: err.message } };
    }
  };
  const make = (id, body = {}) => viaService(() => cameraRoll.make(models, id, { by: 'test', authorizationId: body.authorization_id || null }), 201);
  const resolve = (id, action, note) => viaService(async () => ({ moment: await cameraRoll.resolve(models, id, { action, by: 'test', note }) }), 200);
  const makeKept = () => viaService(() => cameraRoll.makeKept(models, ids.maren, { by: 'test' }), 200);
  const setStatus = (id, action) => viaService(() => cameraRoll[action](models, id), 200);
  const edit = (id, fields) => viaService(() => cameraRoll.updateMoment(models, id, fields), 200);
  const rowOf = async (id) => (await q(`SELECT status, error, make_claim_token, make_claimed_at, make_previous_status, make_attempted_at, make_resolution, asset_id
    FROM camera_roll_moments WHERE id = :id`, { id }))[0];
  const moment = async ({ status = 'kept', extra = '' } = {}) => {
    const id = uuid();
    await run(`INSERT INTO camera_roll_moments (id, character_id, status, moment, purpose, taken_by, shows_face, outfit, album, people, created_at, updated_at)
               VALUES (:id, :c, 'kept', :m, 'private', 'friend', false, 'none', 'everyday', '[]'::jsonb, NOW(), NOW())`,
    { id, c: ids.maren, m: `coffee on the step ${tag} ${moments.length}` });
    moments.push(id);
    // The making-claim constraint needs the claim columns in the same statement as the status.
    if (status !== 'kept' || extra) await run(`UPDATE camera_roll_moments SET status = :status${extra ? `, ${extra}` : ''} WHERE id = :id`, { id, status });
    return id;
  };
  const withImageCap = async (cap, fn) => {
    const saved = process.env.AI_DAILY_IMAGE_BUDGET_USD;
    process.env.AI_DAILY_IMAGE_BUDGET_USD = cap;
    try { return await fn(); } finally {
      if (saved === undefined) delete process.env.AI_DAILY_IMAGE_BUDGET_USD; else process.env.AI_DAILY_IMAGE_BUDGET_USD = saved;
    }
  };

  beforeAll(async () => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || 'test-key';
    process.env.POST_PICTURES_AUTO_ENABLED = 'true';
    admin = TokenService.generateTokenPair({ id: 'test-admin-crs', email: 'evoni@crs.dev', name: 'Evoni', groups: ['ADMIN'], role: 'ADMIN' }).accessToken;
    await run('INSERT INTO shows (id, name, slug, created_at, updated_at) VALUES (:show, :name, :slug, NOW(), NOW())',
      { show: ids.show, name: `CRS show ${tag}`, slug: `crs-show-${tag}` });
    await run("INSERT INTO character_registries (id, title, show_id, created_at, updated_at) VALUES (:reg, 'CRS reg', :show, NOW(), NOW())", ids);
    const [[p]] = await run(`INSERT INTO social_profiles (handle, platform, vibe_sentence, display_name, feed_layer, full_profile, created_at, updated_at)
      VALUES (:h, 'pulse', 'test', 'CRS Maren', 'lalaverse', '{}'::jsonb, NOW(), NOW()) RETURNING id`, { h: `crsmaren${tag}` });
    pids.maren = p.id;
    await run(`INSERT INTO registry_characters (id, registry_id, character_key, display_name, world, feed_profile_id, extra_fields, created_at, updated_at)
       VALUES (:id, :reg, :key, 'CRS Maren', 'lalaverse', :pid, '{}'::jsonb, NOW(), NOW())`, { id: ids.maren, reg: ids.reg, key: `crs-maren-${tag}`, pid: pids.maren });
    jest.spyOn(axios, 'post').mockImplementation(OK_IMAGE);
    jest.spyOn(axios, 'get').mockImplementation(async () => ({ data: Buffer.from('iVBORw0KGgo=', 'base64'), headers: { 'content-type': 'image/png' } }));
    jest.spyOn(pulseImage, 'storePulseImage').mockImplementation(async () => {
      stored += 1;
      return { url: `https://cdn.test/${tag}/made-${stored}.jpg`, key: `crs/${tag}-${stored}.jpg`, width: 1024, height: 1536 };
    });
    const head = await as(request(app).put(`/api/v1/camera-roll/characters/${ids.maren}/headshot`)).send({ url: `https://cdn.test/${tag}/headshot.jpg` });
    expect(head.status).toBe(200);
  });

  afterAll(async () => {
    jest.restoreAllMocks();
    delete process.env.POST_PICTURES_AUTO_ENABLED;
    await run('DELETE FROM camera_roll_moments WHERE character_id = :maren', ids);
    await run('DELETE FROM media_asset_sources WHERE asset_id IN (SELECT id FROM media_assets WHERE url LIKE :pre)', { pre: `https://cdn.test/${tag}/%` });
    await run('DELETE FROM media_asset_links WHERE asset_id IN (SELECT id FROM media_assets WHERE url LIKE :pre)', { pre: `https://cdn.test/${tag}/%` });
    await run('DELETE FROM media_assets WHERE url LIKE :pre', { pre: `https://cdn.test/${tag}/%` });
    await run("DELETE FROM ai_usage_logs WHERE route_name IN ('pulse-post-picture', 'camera-roll') AND created_at > NOW() - INTERVAL '1 hour'");
    if (posts.length) await run('DELETE FROM feed_posts WHERE id IN (:posts)', { posts });
    await run('DELETE FROM registry_characters WHERE id = :maren', ids);
    await run('DELETE FROM social_profiles WHERE id = :p', { p: pids.maren });
    await run('DELETE FROM character_registries WHERE id = :reg', ids);
    await run('DELETE FROM shows WHERE id = :show', ids);
  });

  beforeEach(() => {
    axios.post.mockReset().mockImplementation(OK_IMAGE);
  });

  describe('normal behaviour is kept', () => {
    test('a kept photo is made: one image call, made, claim cleared', async () => {
      const id = await moment();
      const r = await make(id);
      expect(r.status).toBe(201);
      expect(imageCalls()).toHaveLength(1);
      expect(await rowOf(id)).toMatchObject({ status: 'made', make_claim_token: null, make_previous_status: null });
    });

    test('a refusal before any request (the image budget) restores the previous status; Make works again later', async () => {
      const id = await moment();
      const r = await withImageCap('0.01', () => make(id));
      expect(r.status).toBe(429);
      expect(imageCalls()).toEqual([]);
      expect(await rowOf(id)).toMatchObject({ status: 'kept', make_attempted_at: null, make_claim_token: null, error: expect.stringMatching(/budget/i) });
      expect((await make(id)).status).toBe(201);
      expect(imageCalls()).toHaveLength(1);
    });

    test('make-kept makes genuinely kept photos, and skips making and uncertain ones', async () => {
      const kept = await moment();
      const making = await moment({ status: 'making', extra: "make_claim_token = gen_random_uuid(), make_claimed_at = NOW(), make_previous_status = 'kept'" });
      const unsure = await moment({ status: 'uncertain', extra: "make_attempted_at = NOW() - INTERVAL '1 hour'" });
      const r = await makeKept();
      expect(r.status).toBe(200);
      expect((await rowOf(kept)).status).toBe('made');
      expect((await rowOf(making)).status).toBe('making');
      expect((await rowOf(unsure)).status).toBe('uncertain');
      // Every kept photo of hers (this one and any left from other tests) was made once; none of the other two.
      expect(imageCalls().length).toBe(r.body.data.made);
    });
  });

  describe('after a paid request: uncertain, never made again on its own', () => {
    test.each([
      ['storage fails after the call', () => pulseImage.storePulseImage.mockRejectedValueOnce(Object.assign(new Error('Upload refused: too large'), { status: 413 }))],
      ['the library asset cannot be created', () => jest.spyOn(mediaLibrary, 'createAsset').mockRejectedValueOnce(Object.assign(new Error('library down'), { status: 500 }))],
      ['the picture comes back blank (blocked)', () => jest.spyOn(appearance, 'isBlank').mockResolvedValueOnce(true)],
      ['the request times out', () => axios.post.mockImplementationOnce(async () => { throw Object.assign(new Error('timeout'), { code: 'ECONNABORTED' }); })],
    ])('%s: uncertain with its attempt marker; Make, make-kept, Keep, Drop and Edit do not re-send', async (_label, arrange) => {
      const id = await moment();
      arrange();
      const r = await make(id);
      expect(r.status).toBe(502);
      expect(r.body.code).toBe('PHOTO_OUTCOME_UNKNOWN');
      const row = await rowOf(id);
      expect(row).toMatchObject({ status: 'uncertain', make_claim_token: null });
      expect(row.make_attempted_at).not.toBeNull();
      expect(imageCalls()).toHaveLength(1);

      const again = await make(id);
      expect(again.status).toBe(409);
      expect(again.body.code).toBe('PHOTO_OUTCOME_UNKNOWN');
      for (const action of ['keep', 'drop']) expect((await setStatus(id, action)).status).toBe(409);
      expect((await edit(id, { moment: 'changed' })).status).toBe(409);
      expect((await rowOf(id)).status).toBe('uncertain');
      expect(imageCalls()).toHaveLength(1);
      jest.restoreAllMocks();
      jest.spyOn(console, 'log').mockImplementation(() => {});
      jest.spyOn(console, 'error').mockImplementation(() => {});
      jest.spyOn(axios, 'post').mockImplementation(OK_IMAGE);
      jest.spyOn(axios, 'get').mockImplementation(async () => ({ data: Buffer.from('iVBORw0KGgo=', 'base64'), headers: { 'content-type': 'image/png' } }));
      jest.spyOn(pulseImage, 'storePulseImage').mockImplementation(async () => {
        stored += 1;
        return { url: `https://cdn.test/${tag}/made-${stored}.jpg`, key: `crs/${tag}-${stored}.jpg`, width: 1024, height: 1536 };
      });
    });
  });

  describe('one Make at a time', () => {
    test('concurrent Makes for the same photo: exactly one image request, the other refused', async () => {
      const id = await moment();
      let release;
      axios.post.mockImplementationOnce(() => new Promise((r) => { release = () => r({ data: { data: [{ b64_json: 'iVBORw0KGgo=' }] } }); }));
      const first = make(id);
      for (let i = 0; i < 40 && !release; i += 1) await sleep(25);
      const second = await make(id);
      expect(second.status).toBe(409);
      expect(second.body.code).toBe('PHOTO_BEING_MADE');
      release();
      expect((await first).status).toBe(201);
      expect(imageCalls()).toHaveLength(1);
      expect((await rowOf(id)).status).toBe('made');
    });

    test('the claim itself is atomic: ten simultaneous claims of one photo, exactly one wins', async () => {
      const id = await moment();
      const tokens = await Promise.all(Array.from({ length: 10 }, () => cameraRoll.claimForMake(models, id)));
      const won = tokens.filter(Boolean);
      expect(won).toHaveLength(1);
      expect(await rowOf(id)).toMatchObject({ status: 'making', make_claim_token: won[0], make_previous_status: 'kept' });
      // A second claim while it is making: refused.
      expect(await cameraRoll.claimForMake(models, id)).toBeNull();
    });

    test('ten Makes at once: one request', async () => {
      const id = await moment();
      const results = await Promise.all(Array.from({ length: 10 }, () => make(id)));
      expect(results.filter((r) => r.status === 201)).toHaveLength(1);
      expect(imageCalls()).toHaveLength(1);
    });

    test('repeated Makes after it is made are refused with no request', async () => {
      const id = await moment();
      expect((await make(id)).status).toBe(201);
      for (let i = 0; i < 3; i += 1) expect((await make(id)).status).toBe(409);
      expect(imageCalls()).toHaveLength(1);
    });
  });

  describe('restarts, stale claims and fencing', () => {
    test('a stale making photo with no attempt marker (nothing sent) is restored when acted on, then made by that explicit Make', async () => {
      const id = await moment({ status: 'making', extra: "make_claim_token = gen_random_uuid(), make_claimed_at = NOW() - INTERVAL '30 minutes', make_previous_status = 'kept'" });
      expect(await cameraRoll.reconcileStale(models, id)).toBe('kept');
      expect(await rowOf(id)).toMatchObject({ status: 'kept', make_claim_token: null, error: expect.stringMatching(/nothing was sent/) });
      expect(imageCalls()).toEqual([]);
      expect((await make(id)).status).toBe(201);
      expect(imageCalls()).toHaveLength(1);
    });

    test('a stale making photo with its attempt marker becomes uncertain and is not re-sent', async () => {
      const id = await moment({ status: 'making', extra: "make_claim_token = gen_random_uuid(), make_claimed_at = NOW() - INTERVAL '30 minutes', make_previous_status = 'kept', make_attempted_at = NOW() - INTERVAL '29 minutes'" });
      const r = await make(id);
      expect(r.status).toBe(409);
      expect(r.body.code).toBe('PHOTO_OUTCOME_UNKNOWN');
      expect((await rowOf(id)).status).toBe('uncertain');
      expect(imageCalls()).toEqual([]);
    });

    test('a fresh making photo (another Make holds it) is refused, not taken over', async () => {
      const id = await moment({ status: 'making', extra: "make_claim_token = gen_random_uuid(), make_claimed_at = NOW(), make_previous_status = 'kept'" });
      const r = await make(id);
      expect(r.status).toBe(409);
      expect(r.body.code).toBe('PHOTO_BEING_MADE');
      expect(imageCalls()).toEqual([]);
    });

    test('a Make whose claim was taken before its request sends nothing (the attempt marker is fenced)', async () => {
      const id = await moment();
      const real = variations.editImage;
      const spy = jest.spyOn(variations, 'editImage').mockImplementationOnce(async (...args) => {
        await run('UPDATE camera_roll_moments SET make_claim_token = gen_random_uuid() WHERE id = :id', { id });
        return real(...args);
      });
      const r = await make(id);
      spy.mockRestore();
      expect(r.status).toBe(409);
      expect(r.body.code).toBe('CLAIM_LOST');
      expect(imageCalls()).toEqual([]);
    });

    test('an older Make cannot overwrite a newer claim: its result is not written', async () => {
      const id = await moment();
      let release;
      axios.post.mockImplementationOnce(() => new Promise((r) => { release = () => r({ data: { data: [{ b64_json: 'iVBORw0KGgo=' }] } }); }));
      const older = make(id);
      for (let i = 0; i < 40 && !release; i += 1) await sleep(25);
      const newer = uuid();
      await run('UPDATE camera_roll_moments SET make_claim_token = :t, make_claimed_at = NOW() WHERE id = :id', { id, t: newer });
      release();
      const r = await older;
      expect(r.status).toBe(409);
      expect(r.body.code).toBe('CLAIM_LOST');
      expect(await rowOf(id)).toMatchObject({ status: 'making', make_claim_token: newer, asset_id: null });
    });
  });

  describe('resolving an uncertain photo', () => {
    const uncertain = () => moment({ status: 'uncertain', extra: "make_attempted_at = NOW() - INTERVAL '1 hour', error = 'may already be made'" });

    test('acknowledge and abandon send nothing; acknowledged stays uncertain; abandoned cannot be kept again', async () => {
      const a = await uncertain();
      const ack = await resolve(a, 'acknowledge', 'Checked: nothing in the library');
      expect(ack.status).toBe(200);
      expect(await rowOf(a)).toMatchObject({ status: 'uncertain', make_resolution: { acknowledged: { action: 'acknowledge', note: 'Checked: nothing in the library' } } });
      expect((await make(a)).status).toBe(409);

      const b = await uncertain();
      expect((await resolve(b, 'abandon')).status).toBe(200);
      expect((await rowOf(b)).status).toBe('dropped');
      const keep = await setStatus(b, 'keep');
      expect(keep.status).toBe(409);
      expect(keep.body.code).toBe('PHOTO_ABANDONED');
      expect(imageCalls()).toEqual([]);
    });

    test('authorize: one Make that passes its id, once; without it, with a wrong one, or again, refused', async () => {
      const id = await uncertain();
      const auth = await resolve(id, 'authorize', 'Checked: not made');
      expect(auth.status).toBe(200);
      const authorization = auth.body.data.moment.make_resolution.authorization;
      expect(authorization).toMatchObject({ id: expect.any(String), used_at: null });
      expect(imageCalls()).toEqual([]);

      expect((await make(id)).status).toBe(409);
      const wrong = await make(id, { authorization_id: uuid() });
      expect(wrong.status).toBe(409);
      expect(wrong.body.code).toBe('AUTHORIZATION_INVALID');
      expect(imageCalls()).toEqual([]);

      const ok = await make(id, { authorization_id: authorization.id });
      expect(ok.status).toBe(201);
      expect(imageCalls()).toHaveLength(1);
      const row = await rowOf(id);
      expect(row.status).toBe('made');
      expect(row.make_resolution.authorization.used_at).not.toBeNull();
      expect((await make(id, { authorization_id: authorization.id })).status).toBe(409);
      expect(imageCalls()).toHaveLength(1);
    });

    test('an authorization is consumed even when its attempt sends nothing; a second use is refused', async () => {
      const id = await uncertain();
      const authorization = (await resolve(id, 'authorize')).body.data.moment.make_resolution.authorization;
      const r = await withImageCap('0.01', () => make(id, { authorization_id: authorization.id }));
      expect(r.status).toBe(429);
      expect(imageCalls()).toEqual([]);
      expect(await rowOf(id)).toMatchObject({ status: 'uncertain', make_claim_token: null });
      const again = await make(id, { authorization_id: authorization.id });
      expect(again.status).toBe(409);
      expect(again.body.code).toBe('AUTHORIZATION_INVALID');
    });

    test('an expired authorization is refused; a new one replaces an unused one', async () => {
      const id = await uncertain();
      const first = (await resolve(id, 'authorize')).body.data.moment.make_resolution.authorization;
      await run(`UPDATE camera_roll_moments SET make_resolution = jsonb_set(make_resolution, '{authorization,expires_at}', to_jsonb((NOW() - INTERVAL '1 minute')::text)) WHERE id = :id`, { id });
      expect((await make(id, { authorization_id: first.id })).body.code).toBe('AUTHORIZATION_INVALID');
      const second = (await resolve(id, 'authorize')).body.data.moment.make_resolution.authorization;
      expect(second.id).not.toBe(first.id);
      expect((await make(id, { authorization_id: first.id })).body.code).toBe('AUTHORIZATION_INVALID');
      expect(imageCalls()).toEqual([]);
      const history = (await rowOf(id)).make_resolution.history.map((h) => h.action);
      expect(history).toEqual(['authorize', 'authorize']);
    });

    test('make-kept never consumes an authorization', async () => {
      const id = await uncertain();
      await resolve(id, 'authorize');
      await makeKept();
      const row = await rowOf(id);
      expect(row.status).toBe('uncertain');
      expect(row.make_resolution.authorization.used_at).toBeNull();
    });

    test('only an uncertain photo is resolved', async () => {
      const id = await moment();
      expect((await resolve(id, 'acknowledge')).status).toBe(409);
      expect((await resolve(id, 'bogus')).status).toBe(400);
    });
  });

  describe('post pictures and the camera roll together', () => {
    const livePost = async (format = 'post') => {
      const id = uuid();
      await run(`INSERT INTO feed_posts (id, show_id, poster_handle, social_profile_id, content_text, status, post_format, posted_at, created_at, updated_at)
                 VALUES (:id, :show, :handle, :pid, 'market morning, three looks', 'live', :format, NOW(), NOW(), NOW())`,
      { id, show: ids.show, handle: `crs${tag}`, pid: pids.maren, format });
      posts.push(id);
      return id;
    };
    const momentsOf = (postId) => q('SELECT id, status FROM camera_roll_moments WHERE post_id = :p ORDER BY created_at', { p: postId });

    test('a post picture whose storage failed after the call: its photo is uncertain, and a direct camera-roll Make does not re-send', async () => {
      const postId = await livePost();
      pulseImage.storePulseImage.mockRejectedValueOnce(Object.assign(new Error('Upload refused'), { status: 413 }));
      const r = await as(request(app).post(`/api/v1/post-media/posts/${postId}/picture`)).send({ make_now: true });
      expect(r.status).toBeGreaterThanOrEqual(400);
      const [photo] = await momentsOf(postId);
      expect(photo.status).toBe('uncertain');
      moments.push(photo.id);
      expect(imageCalls()).toHaveLength(1);
      const direct = await make(photo.id);
      expect(direct.status).toBe(409);
      expect(direct.body.code).toBe('PHOTO_OUTCOME_UNKNOWN');
      expect(imageCalls()).toHaveLength(1);
    });

    test('a carousel failing on its second picture: first photo made, second uncertain, neither re-sent by a direct Make', async () => {
      const postId = await livePost('carousel');
      let n = 0;
      axios.post.mockImplementation(async () => {
        n += 1;
        if (n === 2) throw Object.assign(new Error('socket hang up'), { code: 'ECONNRESET' });
        return { data: { data: [{ b64_json: 'iVBORw0KGgo=' }] } };
      });
      await as(request(app).post(`/api/v1/post-media/posts/${postId}/picture`)).send({ make_now: true });
      const photos = await momentsOf(postId);
      photos.forEach((p) => moments.push(p.id));
      expect(photos.map((p) => p.status)).toEqual(['made', 'uncertain']);
      expect(n).toBe(2);
      for (const p of photos) expect((await make(p.id)).status).toBe(409);
      expect(n).toBe(2);
      const job = (await q('SELECT picture_job FROM feed_posts WHERE id = :id', { id: postId }))[0].picture_job;
      expect(job).toMatchObject({ state: 'uncertain', paid_attempts: 2 });
    });

    test('a post picture is still made normally, and reused photos are still used', async () => {
      const postId = await livePost();
      const r = await as(request(app).post(`/api/v1/post-media/posts/${postId}/picture`)).send({ make_now: true });
      expect(r.status).toBe(200);
      expect(r.body.job).toMatchObject({ state: 'made' });
      expect(postPictures.UNKNOWN_STATES).toEqual(['interrupted', 'uncertain']);
    });
  });

  describe('the routes', () => {
    test('POST /moments/:id/make answers an uncertain photo with 409 PHOTO_OUTCOME_UNKNOWN; /resolve authorizes; make with authorization_id makes it once', async () => {
      const id = await moment({ status: 'uncertain', extra: "make_attempted_at = NOW() - INTERVAL '1 hour'" });
      const refused = await as(request(app).post(`/api/v1/camera-roll/moments/${id}/make`)).send({});
      expect(refused.status).toBe(409);
      expect(refused.body.code).toBe('PHOTO_OUTCOME_UNKNOWN');
      const auth = await as(request(app).post(`/api/v1/camera-roll/moments/${id}/resolve`)).send({ action: 'authorize', note: 'checked' });
      expect(auth.status).toBe(200);
      const authId = auth.body.data.moment.make_resolution.authorization.id;
      const ok = await as(request(app).post(`/api/v1/camera-roll/moments/${id}/make`)).send({ authorization_id: authId });
      expect(ok.status).toBe(201);
      expect(imageCalls()).toHaveLength(1);
      const again = await as(request(app).post(`/api/v1/camera-roll/moments/${id}/make`)).send({ authorization_id: authId });
      expect(again.status).toBe(409);
      expect(imageCalls()).toHaveLength(1);
    });

    test('/resolve refuses an unknown action (400) and a photo that is not uncertain (409)', async () => {
      const id = await moment();
      expect((await as(request(app).post(`/api/v1/camera-roll/moments/${id}/resolve`)).send({ action: 'bogus' })).status).toBe(400);
      expect((await as(request(app).post(`/api/v1/camera-roll/moments/${id}/resolve`)).send({ action: 'abandon' })).status).toBe(409);
    });
  });

  describe('planning counts and the migration', () => {
    test('making and uncertain photos count toward the planned number', async () => {
      const id = await moment({ status: 'uncertain', extra: "make_attempted_at = NOW()" });
      const live = await sequelize.query('SELECT count(*)::int AS n FROM camera_roll_moments WHERE character_id = :c AND deleted_at IS NULL AND status IN (:s)',
        { replacements: { c: ids.maren, s: ['proposed', 'kept', 'made', 'failed', 'making', 'uncertain'] }, type: sequelize.QueryTypes.SELECT });
      expect(live[0].n).toBeGreaterThan(0);
      expect(cameraRoll.STATUSES).toEqual(expect.arrayContaining(['making', 'uncertain']));
      expect((await rowOf(id)).status).toBe('uncertain');
    });

    test('down refuses while any photo, a soft-deleted one included, is making or uncertain; nothing is changed', async () => {
      // Only soft-deleted rows use the new statuses when this runs alone? Make sure one does.
      const id = await moment({ status: 'uncertain', extra: "make_attempted_at = NOW(), deleted_at = NOW()" });
      await expect(migration.down(sequelize.getQueryInterface())).rejects.toThrow(/Refusing to remove the 'making' and 'uncertain' statuses/);
      const cols = await q("SELECT count(*)::int AS n FROM information_schema.columns WHERE table_name = 'camera_roll_moments' AND column_name LIKE 'make_%'");
      expect(cols[0].n).toBe(5);
      expect((await rowOf(id)).status).toBe('uncertain');
    });
  });
});
