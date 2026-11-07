/**
 * #3714 recovery: a camera-roll photo that was made and stored, but not
 * recorded on its photo (a crash, a lost claim), is found by its photo and
 * claim and attached by hand, never made again (services/cameraRoll make,
 * resolve 'attach'; services/pulseImageService storedImage). The image tool,
 * the upload and storage reads are faked; nothing goes to the network, and
 * no attach ever reaches an image service.
 */
jest.unmock('uuid');

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
const pulseImage = require('../../src/services/pulseImageService');
const mediaLibrary = require('../../src/services/mediaLibrary');
const variations = require('../../src/services/mediaVariations');

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

(shouldSkip ? describe.skip : describe)('#3714 recovery: attach a camera-roll photo that was already made', () => {
  const tag = uuid().slice(0, 8);
  const ids = { show: uuid(), reg: uuid(), maren: uuid() };
  const pids = {};
  let admin;
  let member;
  // What the fake storage holds: key -> { url, metadata }.
  const bucket = new Map();
  const as = (req, token = admin) => req.set('Authorization', `Bearer ${token}`);
  const imageCalls = () => axios.post.mock.calls.map((c) => c[0]).filter((u) => /images\/(edits|generations)/.test(String(u)));
  const viaService = async (fn, okStatus) => {
    try {
      return { status: okStatus, body: { data: await fn() } };
    } catch (err) {
      return { status: err.status || 500, body: { code: err.code, error: err.message } };
    }
  };
  const make = (id) => viaService(() => cameraRoll.make(models, id, { by: 'test' }), 201);
  const attach = (id, { assetId = null, storageKey = null, note = null } = {}) =>
    viaService(() => cameraRoll.resolve(models, id, { action: 'attach', by: 'test', note, assetId, storageKey }), 200);
  const rowOf = async (id) => (await q(`SELECT status, error, asset_id, make_claim_token, make_attempted_at, make_resolution
    FROM camera_roll_moments WHERE id = :id`, { id }))[0];
  const assetOf = async (id) => (await q('SELECT id, url, storage_key, generation FROM media_assets WHERE id = :id', { id }))[0];
  const moment = async ({ status = 'kept', extra = '' } = {}) => {
    const id = uuid();
    await run(`INSERT INTO camera_roll_moments (id, character_id, status, moment, purpose, taken_by, shows_face, outfit, album, people, created_at, updated_at)
               VALUES (:id, :c, 'kept', :m, 'private', 'friend', false, 'none', 'everyday', '[]'::jsonb, NOW(), NOW())`,
    { id, c: ids.maren, m: `rain on the window ${tag} ${id.slice(0, 6)}` });
    if (status !== 'kept' || extra) await run(`UPDATE camera_roll_moments SET status = :status${extra ? `, ${extra}` : ''} WHERE id = :id`, { id, status });
    return id;
  };
  // Make a photo, then leave it uncertain the way a failure after storing does.
  const storedThenFailed = async () => {
    const id = await moment();
    jest.spyOn(mediaLibrary, 'createAsset').mockRejectedValueOnce(Object.assign(new Error('library down'), { status: 500 }));
    const r = await make(id);
    expect(r.status).toBe(502);
    expect(r.body.code).toBe('PHOTO_OUTCOME_UNKNOWN');
    const row = await rowOf(id);
    expect(row.status).toBe('uncertain');
    const [attempt] = row.make_resolution.attempts;
    return { id, attempt };
  };
  const fakeStorage = () => {
    jest.spyOn(pulseImage, 'storePulseImage').mockImplementation(async (_file, opts) => {
      const key = opts.key || `${opts.keyPrefix}/${uuid()}.jpg`;
      const url = `https://cdn.test/${tag}/${key}`;
      bucket.set(key, { url, metadata: opts.metadata || {} });
      return { url, key, width: 1024, height: 1536 };
    });
    jest.spyOn(pulseImage, 'storedImage').mockImplementation(async (key) => {
      const o = bucket.get(key);
      return o ? { url: o.url, metadata: o.metadata, contentType: 'image/jpeg', size: 1000 } : null;
    });
  };

  beforeAll(async () => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || 'test-key';
    admin = TokenService.generateTokenPair({ id: 'test-admin-crr', email: 'evoni@crr.dev', name: 'Evoni', groups: ['ADMIN'], role: 'ADMIN' }).accessToken;
    member = TokenService.generateTokenPair({ id: 'test-member-crr', email: 'member@crr.dev', name: 'Member', groups: [], role: 'USER' }).accessToken;
    await run('INSERT INTO shows (id, name, slug, created_at, updated_at) VALUES (:show, :name, :slug, NOW(), NOW())',
      { show: ids.show, name: `CRR show ${tag}`, slug: `crr-show-${tag}` });
    await run("INSERT INTO character_registries (id, title, show_id, created_at, updated_at) VALUES (:reg, 'CRR reg', :show, NOW(), NOW())", ids);
    const [[p]] = await run(`INSERT INTO social_profiles (handle, platform, vibe_sentence, display_name, feed_layer, full_profile, created_at, updated_at)
      VALUES (:h, 'pulse', 'test', 'CRR Maren', 'lalaverse', '{}'::jsonb, NOW(), NOW()) RETURNING id`, { h: `crrmaren${tag}` });
    pids.maren = p.id;
    await run(`INSERT INTO registry_characters (id, registry_id, character_key, display_name, world, feed_profile_id, extra_fields, created_at, updated_at)
       VALUES (:id, :reg, :key, 'CRR Maren', 'lalaverse', :pid, '{}'::jsonb, NOW(), NOW())`, { id: ids.maren, reg: ids.reg, key: `crr-maren-${tag}`, pid: pids.maren });
    jest.spyOn(axios, 'post').mockImplementation(OK_IMAGE);
    jest.spyOn(axios, 'get').mockImplementation(async () => ({ data: Buffer.from('iVBORw0KGgo=', 'base64'), headers: { 'content-type': 'image/png' } }));
    fakeStorage();
    const head = await as(request(app).put(`/api/v1/camera-roll/characters/${ids.maren}/headshot`)).send({ url: `https://cdn.test/${tag}/headshot.jpg` });
    expect(head.status).toBe(200);
  });

  afterAll(async () => {
    jest.restoreAllMocks();
    await run('DELETE FROM camera_roll_moments WHERE character_id = :maren', ids);
    await run('DELETE FROM media_asset_sources WHERE asset_id IN (SELECT id FROM media_assets WHERE url LIKE :pre)', { pre: `https://cdn.test/${tag}/%` });
    await run('DELETE FROM media_asset_links WHERE asset_id IN (SELECT id FROM media_assets WHERE url LIKE :pre)', { pre: `https://cdn.test/${tag}/%` });
    await run('DELETE FROM media_assets WHERE url LIKE :pre', { pre: `https://cdn.test/${tag}/%` });
    await run("DELETE FROM ai_usage_logs WHERE route_name = 'camera-roll' AND created_at > NOW() - INTERVAL '1 hour'");
    await run('DELETE FROM registry_characters WHERE id = :maren', ids);
    await run('DELETE FROM social_profiles WHERE id = :p', { p: pids.maren });
    await run('DELETE FROM character_registries WHERE id = :reg', ids);
    await run('DELETE FROM shows WHERE id = :show', ids);
  });

  beforeEach(() => {
    axios.post.mockReset().mockImplementation(OK_IMAGE);
  });

  afterEach(() => {
    // No attach may ever reach an image service or upload anything new.
    jest.restoreAllMocks();
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(axios, 'post').mockImplementation(OK_IMAGE);
    jest.spyOn(axios, 'get').mockImplementation(async () => ({ data: Buffer.from('iVBORw0KGgo=', 'base64'), headers: { 'content-type': 'image/png' } }));
    fakeStorage();
  });

  describe('where a photo is stored is decided before its request', () => {
    test('the key names the photo and the claim, the stored metadata says so, and the attempt is recorded with the marker', async () => {
      const id = await moment();
      const r = await make(id);
      expect(r.status).toBe(201);
      const row = await rowOf(id);
      expect(row.status).toBe('made');
      expect(row.make_resolution.attempts).toHaveLength(1);
      const [attempt] = row.make_resolution.attempts;
      expect(attempt.storage_key).toBe(`characters/${ids.maren}/camera-roll/${id}/${attempt.claim_token}.jpg`);
      expect(attempt.storage_key).toBe(cameraRoll.photoStorageKey(ids.maren, id, attempt.claim_token));
      expect(bucket.get(attempt.storage_key).metadata).toEqual({ 'moment-id': id, 'claim-token': attempt.claim_token, 'character-id': ids.maren });
      const asset = await assetOf(row.asset_id);
      expect(asset.storage_key).toBe(attempt.storage_key);
      expect(asset.generation.camera_roll).toMatchObject({ moment_id: id, claim_token: attempt.claim_token, storage_key: attempt.storage_key });
    });

    test('a budget refusal records no attempt (nothing was sent)', async () => {
      const id = await moment();
      const saved = process.env.AI_DAILY_IMAGE_BUDGET_USD;
      process.env.AI_DAILY_IMAGE_BUDGET_USD = '0.01';
      try { expect((await make(id)).status).toBe(429); } finally {
        if (saved === undefined) delete process.env.AI_DAILY_IMAGE_BUDGET_USD; else process.env.AI_DAILY_IMAGE_BUDGET_USD = saved;
      }
      const row = await rowOf(id);
      expect(row.status).toBe('kept');
      expect(row.make_resolution?.attempts || []).toEqual([]);
    });
  });

  describe('crash recovery, no paid call', () => {
    test('stored, then the library record failed: attach by its storage key makes it, once, with no image request', async () => {
      const { id, attempt } = await storedThenFailed();
      expect(bucket.has(attempt.storage_key)).toBe(true);
      axios.post.mockClear();
      const editSpy = jest.spyOn(variations, 'editImage');
      const storeSpy = pulseImage.storePulseImage;
      storeSpy.mockClear();
      const r = await attach(id, { storageKey: attempt.storage_key, note: 'Looked at it: the right photo' });
      expect(r.status).toBe(200);
      expect(r.body.data.attach).toBe('attached');
      expect(imageCalls()).toEqual([]);
      expect(editSpy).not.toHaveBeenCalled();
      expect(storeSpy).not.toHaveBeenCalled();
      const row = await rowOf(id);
      expect(row).toMatchObject({ status: 'made', error: null });
      const asset = await assetOf(row.asset_id);
      expect(asset.storage_key).toBe(attempt.storage_key);
      expect(asset.url).toBe(bucket.get(attempt.storage_key).url);
      expect(asset.generation.camera_roll).toMatchObject({ moment_id: id, claim_token: attempt.claim_token });
      expect(asset.generation.recovered).toMatchObject({ by: 'test', from: 'storage' });
      expect(row.make_resolution.history.map((h) => h.action)).toEqual(['attach']);
    });

    test('the process died after storing (the make never returned): once stale it is uncertain, and attach by key works; the old run cannot overwrite it', async () => {
      const id = await moment();
      let releaseLibrary;
      jest.spyOn(mediaLibrary, 'createAsset').mockImplementationOnce(() => new Promise((_res, rej) => {
        releaseLibrary = () => rej(Object.assign(new Error('the process is gone'), { status: 500 }));
      }));
      const dying = make(id);
      for (let i = 0; i < 80 && !releaseLibrary; i += 1) await sleep(25);
      expect(releaseLibrary).toBeDefined();
      const [attempt] = (await rowOf(id)).make_resolution.attempts;
      expect(bucket.has(attempt.storage_key)).toBe(true);
      // The claim goes stale (a restart, 15 minutes).
      await run("UPDATE camera_roll_moments SET make_claimed_at = NOW() - INTERVAL '20 minutes' WHERE id = :id", { id });
      axios.post.mockClear();
      const r = await attach(id, { storageKey: attempt.storage_key });
      expect(r.status).toBe(200);
      expect(imageCalls()).toEqual([]);
      const made = await rowOf(id);
      expect(made.status).toBe('made');
      // The old run wakes up and fails: its fenced writes no longer hold the photo.
      releaseLibrary();
      await dying;
      const after = await rowOf(id);
      expect(after).toMatchObject({ status: 'made', asset_id: made.asset_id });
    });

    test('the library record was written, then the claim was lost: attach by its library id', async () => {
      const id = await moment();
      const real = mediaLibrary.createAsset;
      jest.spyOn(mediaLibrary, 'createAsset').mockImplementationOnce(async (...args) => {
        const out = await real(...args);
        await run('UPDATE camera_roll_moments SET make_claim_token = gen_random_uuid() WHERE id = :id', { id });
        return out;
      });
      const r = await make(id);
      expect(r.status).toBe(409);
      expect(r.body.code).toBe('CLAIM_LOST');
      const [found] = await q("SELECT id FROM media_assets WHERE generation->'camera_roll'->>'moment_id' = :id", { id });
      expect(found).toBeDefined();
      await run("UPDATE camera_roll_moments SET make_claimed_at = NOW() - INTERVAL '20 minutes' WHERE id = :id", { id });
      axios.post.mockClear();
      const ok = await attach(id, { assetId: found.id });
      expect(ok.status).toBe(200);
      expect(imageCalls()).toEqual([]);
      expect(await rowOf(id)).toMatchObject({ status: 'made', asset_id: found.id });
    });

    test('an unused one-time authorization is revoked by attach', async () => {
      const { id, attempt } = await storedThenFailed();
      await cameraRoll.resolve(models, id, { action: 'authorize', by: 'test' });
      expect((await rowOf(id)).make_resolution.authorization).toMatchObject({ used_at: null });
      expect((await attach(id, { storageKey: attempt.storage_key })).status).toBe(200);
      expect((await rowOf(id)).make_resolution.authorization).toBeNull();
    });
  });

  describe('ownership and claim identity', () => {
    test('another photo\'s image, key or attempt is refused, and nothing changes', async () => {
      const a = await storedThenFailed();
      const b = await storedThenFailed();
      const done = await moment();
      expect((await make(done)).status).toBe(201);
      const doneAsset = (await rowOf(done)).asset_id;
      axios.post.mockClear();
      // b's key on a.
      const crossKey = await attach(a.id, { storageKey: b.attempt.storage_key });
      expect(crossKey.status).toBe(409);
      expect(crossKey.body.code).toBe('ATTACH_CONFLICT');
      // A made photo's library record on a.
      const crossAsset = await attach(a.id, { assetId: doneAsset });
      expect(crossAsset.status).toBe(409);
      expect(crossAsset.body.code).toBe('ATTACH_CONFLICT');
      // A key under a's own folder but not from one of its attempts.
      const forged = await attach(a.id, { storageKey: cameraRoll.photoStorageKey(ids.maren, a.id, uuid()) });
      expect(forged.status).toBe(409);
      // a's key under another character's folder is not a's key.
      const otherChar = await attach(a.id, { storageKey: a.attempt.storage_key.replace(ids.maren, uuid()) });
      expect(otherChar.status).toBe(409);
      for (const x of [a, b]) expect((await rowOf(x.id)).status).toBe('uncertain');
      expect(imageCalls()).toEqual([]);
    });

    test('stored metadata that does not name this photo and claim is refused', async () => {
      const { id, attempt } = await storedThenFailed();
      bucket.set(attempt.storage_key, { ...bucket.get(attempt.storage_key), metadata: { 'moment-id': id, 'claim-token': uuid() } });
      const r = await attach(id, { storageKey: attempt.storage_key });
      expect(r.status).toBe(409);
      expect(r.body.code).toBe('ATTACH_CONFLICT');
      expect((await rowOf(id)).status).toBe('uncertain');
      expect(await q('SELECT id FROM media_assets WHERE storage_key = :k', { k: attempt.storage_key })).toEqual([]);
    });

    test('nothing stored under the key: 404, nothing written', async () => {
      const { id, attempt } = await storedThenFailed();
      bucket.delete(attempt.storage_key);
      const r = await attach(id, { storageKey: attempt.storage_key });
      expect(r.status).toBe(404);
      expect((await rowOf(id)).status).toBe('uncertain');
    });

    test('an image another photo already has is refused', async () => {
      const { id, attempt } = await storedThenFailed();
      // Record the orphan, then give it to another photo first.
      const recorded = await mediaLibrary.createAsset(models, {
        url: bucket.get(attempt.storage_key).url, storageKey: attempt.storage_key, source: 'generated',
        generation: { camera_roll: { moment_id: id, claim_token: attempt.claim_token, storage_key: attempt.storage_key } },
        links: [{ entity_type: 'character', entity_id: ids.maren, role: 'owner' }], by: 'test',
      });
      const other = await moment({ status: 'made' });
      await run('UPDATE camera_roll_moments SET asset_id = :a WHERE id = :o', { a: recorded.asset.id, o: other });
      const r = await attach(id, { assetId: recorded.asset.id });
      expect(r.status).toBe(409);
      expect(r.body.error).toMatch(/Another photo already has that image/);
      expect((await rowOf(id)).status).toBe('uncertain');
    });

    test('a library record with no claim (not from a recorded attempt) is refused', async () => {
      const { id } = await storedThenFailed();
      const legacy = await mediaLibrary.createAsset(models, {
        url: `https://cdn.test/${tag}/legacy-${uuid()}.jpg`, storageKey: `characters/${ids.maren}/camera-roll/${uuid()}.jpg`, source: 'generated',
        generation: { camera_roll: { moment_id: id } },
        links: [{ entity_type: 'character', entity_id: ids.maren, role: 'owner' }], by: 'test',
      });
      const r = await attach(id, { assetId: legacy.asset.id });
      expect(r.status).toBe(409);
      expect((await rowOf(id)).status).toBe('uncertain');
    });

    test('only an uncertain photo; exactly one of asset_id and storage_key', async () => {
      const kept = await moment();
      expect((await attach(kept, { storageKey: cameraRoll.photoStorageKey(ids.maren, kept, uuid()) })).status).toBe(409);
      expect((await attach(kept, {})).status).toBe(400);
      expect((await attach(kept, { assetId: uuid(), storageKey: 'x' })).status).toBe(400);
      expect((await attach(kept, { assetId: 'not-an-id' })).status).toBe(400);
    });
  });

  describe('repeating and racing', () => {
    test('a repeated attach changes nothing; a different image after it is refused', async () => {
      const { id, attempt } = await storedThenFailed();
      const first = await attach(id, { storageKey: attempt.storage_key });
      expect(first.body.data.attach).toBe('attached');
      const row = await rowOf(id);
      const again = await attach(id, { storageKey: attempt.storage_key });
      expect(again.status).toBe(200);
      expect(again.body.data.attach).toBe('already_attached');
      const byId = await attach(id, { assetId: row.asset_id });
      expect(byId.body.data.attach).toBe('already_attached');
      const after = await rowOf(id);
      expect(after.make_resolution.history).toHaveLength(1);
      expect(after.asset_id).toBe(row.asset_id);

      const other = await storedThenFailed();
      const wrong = await attach(id, { storageKey: other.attempt.storage_key });
      expect(wrong.status).toBe(409);
      expect((await rowOf(id)).asset_id).toBe(row.asset_id);
    });

    test('five attaches at once: one library record, the photo made once', async () => {
      const { id, attempt } = await storedThenFailed();
      axios.post.mockClear();
      const results = await Promise.all(Array.from({ length: 5 }, () => attach(id, { storageKey: attempt.storage_key })));
      expect(results.map((r) => r.status)).toEqual([200, 200, 200, 200, 200]);
      expect(results.filter((r) => r.body.data.attach === 'attached')).toHaveLength(1);
      const records = await q('SELECT id FROM media_assets WHERE storage_key = :k AND deleted_at IS NULL', { k: attempt.storage_key });
      expect(records).toHaveLength(1);
      expect((await rowOf(id))).toMatchObject({ status: 'made', asset_id: records[0].id });
      expect(imageCalls()).toEqual([]);
    });

    test('existing images and keys are left as they were', async () => {
      const id = await moment();
      expect((await make(id)).status).toBe(201);
      const { asset_id: assetId } = await rowOf(id);
      const before = await assetOf(assetId);
      // A failed attach attempt on another photo that names this image.
      const { id: other } = await storedThenFailed();
      await attach(other, { assetId });
      expect(await assetOf(assetId)).toEqual(before);
    });
  });

  describe('the route', () => {
    test('ADMIN only; attach by storage key through POST /moments/:id/resolve', async () => {
      const { id, attempt } = await storedThenFailed();
      const url = `/api/v1/camera-roll/moments/${id}/resolve`;
      axios.post.mockClear();
      expect((await request(app).post(url).send({ action: 'attach', storage_key: attempt.storage_key })).status).toBe(401);
      expect((await as(request(app).post(url), member).send({ action: 'attach', storage_key: attempt.storage_key })).status).toBe(403);
      expect((await rowOf(id)).status).toBe('uncertain');
      const ok = await as(request(app).post(url)).send({ action: 'attach', storage_key: attempt.storage_key, note: 'checked' });
      expect(ok.status).toBe(200);
      expect(ok.body.data.moment).toMatchObject({ status: 'made', attach: 'attached' });
      expect(imageCalls()).toEqual([]);
    });
  });
});
