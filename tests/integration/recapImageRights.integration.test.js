/**
 * The recap image rule (Evoni, 2026-11-15), against the test database. The
 * download and the bucket are stood in for; "copied" is what putObject was
 * given. A recap post's image is copied to the public bucket, and served
 * from it, only while BOTH hold:
 * - its media-library record exists, is not deleted, approved and public;
 * - an ADMIN has declared its rights in one of the four cleared categories
 *   (details.rights). Nothing clears on its own: not an AI-generated
 *   picture, not the free-text usage_rights.
 * Otherwise the recap still publishes and that post is text only. The rule
 * is checked again on every public read; a copy that may no longer be served
 * is hidden at once and shown to an ADMIN as revocation 'pending' with its
 * key and address (no file is deleted or moved, and no GET writes). A copy
 * is bound to its library picture by id and URL. The public responses carry
 * no note, declarer, library id or storage key of a hidden copy.
 */
jest.unmock('uuid');

const request = require('supertest');
const crypto = require('crypto');
const sharp = require('sharp');
const app = require('../../src/app');
const TokenService = require('../../src/services/tokenService');
const models = require('../../src/models');
const recaps = require('../../src/services/pulseRecap');
const media = require('../../src/services/mediaLibrary');
const slots = require('../../src/services/websiteSlotService');

const { sequelize } = models;

const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const uuid = () => crypto.randomUUID();
const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });

(shouldSkip ? describe.skip : describe)('The recap image rule: visibility and rights (2026-11-15)', () => {
  const tag = uuid().slice(0, 8);
  const ids = { show: uuid(), ep1: uuid() };
  const WEEK = recaps.weekStartOf(new Date('2026-09-30T12:00:00Z'));
  const at = (day) => new Date(new Date(`${WEEK}T00:00:00Z`).getTime() + (day * 24 + 12) * 3600 * 1000);
  const env = { bucket: process.env.SITE_PUBLIC_BUCKET, cdn: process.env.SITE_PUBLIC_CDN };
  const ADMIN_EMAIL = `evoni-${tag}@rights.dev`;
  const NOTE = `SECRET-NOTE-${tag} licence held on file`;
  let admin;
  let editor;
  let viewer;
  let png;
  let stored;
  let downloads;
  let n = 0;
  // Each test writes from its own address, so the app's 60-writes-a-minute
  // limit (app.js writeLimiter) counts each test apart.
  let ip = 0;
  const as = (token, req) => {
    req.set('X-Forwarded-For', `10.83.${ip}.1`);
    return token ? req.set('Authorization', `Bearer ${token}`) : req;
  };

  /** A live post with its own image URL; with `asset`, a library record of that URL; with `rights`, a declaration on it. */
  const scene = async (name, { asset = { status: 'approved', visibility: 'public' }, rights = null, post = {} } = {}) => {
    n += 1;
    const url = `https://studio.example/rights-${tag}/${name}-${n}.png`;
    const row = await models.FeedPost.create({
      show_id: ids.show, poster_handle: `${name}${n}${tag}`, poster_display_name: `${name}${n}`, poster_platform: 'lalaverse', post_type: 'post',
      content_text: `${name}${n} words`, status: 'live', story_order: 15, likes: 100, comments_count: 0, shares: 0, sample_comments: [], sort_order: 0,
      posted_at: at(1), image_url: url, image_description: `${name} alt`, ...post,
    });
    let assetId = null;
    if (asset) {
      const made = await media.createAsset(models, { url, source: 'post', by: 'seed', ...asset });
      expect(made.reused).toBe(false);
      assetId = made.asset.id;
      if (rights) await media.declareRights(models, assetId, rights, 'seed@rights.dev');
    }
    return { postId: row.id, url, assetId, name: `${name}${n}`, text: `${name}${n} words` };
  };
  const recapFor = (...scenes) => models.PulseRecap.create({ show_id: ids.show, week_start: WEEK, status: 'draft', title: `Week ${tag}`, post_ids: scenes.map((s) => s.postId) });
  const publish = (recap) => as(admin, request(app).post(`/api/v1/pulse-recaps/${recap.id}/publish`));
  const unpublish = (recap) => as(admin, request(app).post(`/api/v1/pulse-recaps/${recap.id}/unpublish`));
  const declare = (recap, s, body, token = admin) => as(token, request(app).put(`/api/v1/pulse-recaps/${recap.id}/posts/${s.postId}/image-rights`)).send(body);
  const publicRecap = async (recap) => {
    const res = await request(app).get(`/api/v1/public/recaps/${recap.id}`);
    expect(res.status).toBe(200);
    return res.body.recap;
  };
  const publicPost = async (recap, s) => (await publicRecap(recap)).posts.find((x) => x.poster_display_name === s.name);
  const adminRecap = async (recap, token = admin) => {
    const res = await as(token, request(app).get(`/api/v1/pulse-recaps?show_id=${ids.show}`));
    expect(res.status).toBe(200);
    return res.body.recaps.find((r) => r.id === recap.id);
  };
  const adminPost = async (recap, s) => (await adminRecap(recap)).posts.find((x) => x.id === s.postId);
  const assetRow = async (id) => (await run('SELECT * FROM media_assets WHERE id = :id', { id }))[0][0];
  const recapRow = async (id) => (await run('SELECT * FROM pulse_recaps WHERE id = :id', { id }))[0][0];
  const snap = (row) => JSON.stringify(row);
  const SERVED = { url: expect.stringMatching(/^https:\/\/site\.cdn\.test\/site-public\/recaps\//), alt: expect.any(String) };

  beforeAll(async () => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    admin = TokenService.generateTokenPair({ id: `admin-${tag}`, email: ADMIN_EMAIL, name: 'Evoni', groups: ['ADMIN'], role: 'ADMIN' }).accessToken;
    editor = TokenService.generateTokenPair({ id: `editor-${tag}`, email: `ed-${tag}@rights.dev`, name: 'Ed', groups: ['USER', 'EDITOR'], role: 'USER' }).accessToken;
    viewer = TokenService.generateTokenPair({ id: `viewer-${tag}`, email: `vi-${tag}@rights.dev`, name: 'Vi', groups: ['VIEWER'], role: 'VIEWER' }).accessToken;
    png = await sharp({ create: { width: 40, height: 30, channels: 3, background: { r: 200, g: 150, b: 46 } } }).png().toBuffer();
    await run(`INSERT INTO shows (id, name, slug, created_at, updated_at) VALUES (:show, :name, :slug, NOW(), NOW())`,
      { show: ids.show, name: `RecapRights ${tag}`, slug: `recaprights-${tag}` });
    await run(`INSERT INTO episodes (id, show_id, title, episode_number, status, created_at, updated_at) VALUES (:ep1, :show, 'One', 1, 'published', NOW(), NOW())`, ids);
  });

  beforeEach(() => {
    ip += 1;
    process.env.SITE_PUBLIC_BUCKET = 'lalaverse-site-test';
    process.env.SITE_PUBLIC_CDN = 'site.cdn.test';
    stored = [];
    downloads = [];
    jest.spyOn(slots, 'putObject').mockImplementation(async (cfg, key, buffer, type) => { stored.push({ bucket: cfg.bucket, key, buffer, type }); });
    jest.spyOn(recaps, 'imageBytes').mockImplementation(async (url) => { downloads.push(url); return png; });
  });

  afterEach(async () => {
    jest.restoreAllMocks();
    jest.spyOn(console, 'log').mockImplementation(() => {});
    await run('DELETE FROM pulse_recaps WHERE show_id = :show', ids);
  });

  afterAll(async () => {
    for (const [name, value] of [['SITE_PUBLIC_BUCKET', env.bucket], ['SITE_PUBLIC_CDN', env.cdn]]) {
      if (value === undefined) delete process.env[name]; else process.env[name] = value;
    }
    await run('DELETE FROM media_assets WHERE url LIKE :like', { like: `https://studio.example/rights-${tag}/%` });
    await run('DELETE FROM feed_posts WHERE show_id = :show', ids);
    await run('DELETE FROM episodes WHERE show_id = :show', ids);
    await run('DELETE FROM shows WHERE id = :show', ids);
  });

  test.each(['original', 'licensed', 'retailer', 'ai_cleared'])('an approved, public picture declared "%s" is copied and served, bound to its library record', async (category) => {
    const s = await scene('ok');
    const recap = await recapFor(s);
    const declared = await declare(recap, s, { category });
    expect(declared.status).toBe(200);
    expect(declared.body.recap.posts[0].image_rights).toMatchObject({ cleared: true, ready: true, public_now: false, revocation: null, rights: { category, declared_by: ADMIN_EMAIL } });
    expect(stored).toHaveLength(0);   // declaring copies nothing

    const res = await publish(recap);
    expect(res.status).toBe(200);
    expect(res.body.recap.public_images).toEqual({ copied: 1, failed: 0 });
    expect(downloads).toEqual([s.url]);
    expect(stored).toHaveLength(1);
    expect(stored[0].key).toMatch(new RegExp(`^site-public/recaps/${recap.id}/[0-9a-f-]{36}\\.jpg$`));
    expect(await publicPost(recap, s)).toMatchObject({ content_text: s.text, image: { url: `https://site.cdn.test/${stored[0].key}`, alt: 'ok alt' } });

    // The copy record: the key, the source URL, the library id, and the declaration it was copied under.
    const copy = (await recapRow(recap.id)).images[s.postId];
    expect(copy).toEqual({
      key: stored[0].key, source: s.url, asset_id: s.assetId,
      rights: { category, declared_by: ADMIN_EMAIL, declared_at: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/) },
    });
    expect(await adminPost(recap, s)).toMatchObject({ image_rights: { public_now: true, revocation: null, copy: { key: stored[0].key, url: `https://site.cdn.test/${stored[0].key}` } } });
  });

  test('"unknown" and no declaration: not copied, not served; the recap still publishes with the words', async () => {
    const unknown = await scene('unknown', { rights: { category: 'unknown' } });
    const none = await scene('none');
    const recap = await recapFor(unknown, none);
    const res = await publish(recap);
    expect(res.status).toBe(200);
    expect(res.body.recap.status).toBe('published');
    expect(res.body.recap.public_images).toEqual({ copied: 0, failed: 0 });
    expect(stored).toHaveLength(0);
    expect(downloads).toHaveLength(0);
    expect(slots.putObject).not.toHaveBeenCalled();
    const pub = await publicRecap(recap);
    expect(pub.posts.map((x) => [x.content_text, x.image])).toEqual([[unknown.text, null], [none.text, null]]);
    const adminView = await adminRecap(recap);
    expect(adminView.posts[0].image_rights).toMatchObject({ cleared: false, ready: false, public_now: false, copy: null, revocation: null, why: ['rights_not_cleared'], rights: { category: 'unknown', label: 'Unknown / not cleared' } });
    expect(adminView.posts[1].image_rights).toMatchObject({ cleared: false, ready: false, rights: null, why: ['no_rights_declared'] });
    expect(adminView.pending_revocations).toEqual([]);
  });

  test.each([
    ['private', { status: 'approved', visibility: 'private' }, ['not_public']],
    ['internal', { status: 'approved', visibility: 'internal' }, ['not_public']],
    ['draft', { status: 'draft', visibility: 'public' }, ['not_approved']],
    ['archived', { status: 'archived', visibility: 'public' }, ['not_approved']],
  ])('a %s picture, even with cleared rights, is not copied and not served', async (label, asset, why) => {
    const s = await scene(label, { asset, rights: { category: 'original' } });
    const recap = await recapFor(s);
    expect((await publish(recap)).body.recap).toMatchObject({ status: 'published', public_images: { copied: 0, failed: 0 } });
    expect(stored).toHaveLength(0);
    expect(downloads).toHaveLength(0);
    expect(await publicPost(recap, s)).toMatchObject({ content_text: s.text, image: null });
    expect((await adminPost(recap, s)).image_rights).toMatchObject({ library: { id: s.assetId, ...asset }, cleared: true, ready: false, public_now: false, why });
  });

  test('a deleted library record, and no library record at all: not copied, not served', async () => {
    const gone = await scene('gone', { rights: { category: 'original' } });
    await media.removeAsset(models, gone.assetId);
    const never = await scene('never', { asset: null });
    const recap = await recapFor(gone, never);
    expect((await publish(recap)).body.recap).toMatchObject({ status: 'published', public_images: { copied: 0, failed: 0 } });
    expect(stored).toHaveLength(0);
    expect(downloads).toHaveLength(0);
    expect((await publicRecap(recap)).posts.map((x) => [x.content_text, x.image])).toEqual([[gone.text, null], [never.text, null]]);
    for (const p of (await adminRecap(recap)).posts) expect(p.image_rights).toMatchObject({ library: null, rights: null, ready: false, why: ['no_library_record'] });
  });

  test('an AI-generated picture is never cleared on its own: only an explicit ai_cleared declaration serves it', async () => {
    const s = await scene('ai', { asset: { status: 'approved', visibility: 'public', source: 'generated', generation: { model: 'image-model', prompt: 'a gown' } } });
    const recap = await recapFor(s);
    await publish(recap);
    expect(stored).toHaveLength(0);
    expect((await publicPost(recap, s)).image).toBeNull();
    expect((await adminPost(recap, s)).image_rights).toMatchObject({ library: { source: 'generated' }, rights: null, cleared: false, ready: false });

    await unpublish(recap);
    const declared = await declare(recap, s, { category: 'ai_cleared', note: 'made in the studio' });
    expect(declared.status).toBe(200);
    expect(declared.body.recap.posts[0].image_rights.rights).toMatchObject({ category: 'ai_cleared', label: 'AI-generated image — cleared for public use', note: 'made in the studio' });
    await publish(recap);
    expect(stored).toHaveLength(1);
    expect((await publicPost(recap, s)).image).toEqual(SERVED);
  });

  test('a private camera-roll photo is never public, even marked approved, public and cleared; one that was posted is', async () => {
    const hidden = await scene('roll', {
      asset: { status: 'approved', visibility: 'public', source: 'generated', generation: { camera_roll: { purpose: 'private' } } },
      rights: { category: 'original' },
    });
    const posted = await scene('rollposted', {
      asset: { status: 'approved', visibility: 'public', source: 'generated', generation: { camera_roll: { purpose: 'posted' } } },
      rights: { category: 'original' },
    });
    const recap = await recapFor(hidden, posted);
    await publish(recap);
    expect(stored).toHaveLength(1);
    expect((await publicPost(recap, hidden)).image).toBeNull();
    expect((await publicPost(recap, posted)).image).toEqual(SERVED);
  });

  test('free-text usage_rights is not approval, is shown to the ADMIN as context, and is not changed by a declaration; other details are kept', async () => {
    const s = await scene('freetext', { asset: { status: 'approved', visibility: 'public', usageRights: 'ours, all uses', details: { style: 'editorial', notes: 'stairs' } } });
    const recap = await recapFor(s);
    await publish(recap);
    expect(stored).toHaveLength(0);
    expect((await publicPost(recap, s)).image).toBeNull();
    expect((await adminPost(recap, s)).image_rights).toMatchObject({ library: { usage_rights: 'ours, all uses' }, rights: null, cleared: false, ready: false });

    await unpublish(recap);
    expect((await declare(recap, s, { category: 'licensed', note: NOTE })).status).toBe(200);
    let row = await assetRow(s.assetId);
    expect(row.usage_rights).toBe('ours, all uses');
    expect(row.details).toEqual({
      style: 'editorial', notes: 'stairs',
      rights: { category: 'licensed', note: NOTE, declared_by: ADMIN_EMAIL, declared_at: expect.any(String) },
    });
    // The library's own edit of details (a whitelist that replaces) keeps the declaration, and cannot set one.
    await media.updateAsset(models, s.assetId, { details: { style: 'street', rights: { category: 'original' } }, usage_rights: 'ours, all uses' });
    row = await assetRow(s.assetId);
    expect(row.details).toEqual({ style: 'street', rights: expect.objectContaining({ category: 'licensed', note: NOTE }) });
    const fresh = await scene('fresh');
    await media.updateAsset(models, fresh.assetId, { details: { rights: { category: 'original' }, style: 'x' } });
    expect((await assetRow(fresh.assetId)).details).toEqual({ style: 'x' });
    expect(media.rightsCleared(await assetRow(fresh.assetId))).toBe(false);
    expect(media.rightsCleared({ usage_rights: 'original', details: {} })).toBe(false);
    expect(media.rightsCleared({ details: { rights: 'original' } })).toBe(false);
    expect(media.rightsCleared({ details: { rights: { category: 'cleared' } } })).toBe(false);
  });

  test('after publishing, a picture made private leaves the public responses at once; the ADMIN sees revocation pending with the key and address; public again, it is served again', async () => {
    const s = await scene('vis', { rights: { category: 'original' } });
    const text = await scene('other', { rights: { category: 'original' } });
    const recap = await recapFor(s, text);
    await publish(recap);
    expect(stored).toHaveLength(2);
    const key = (await recapRow(recap.id)).images[s.postId].key;
    expect((await publicPost(recap, s)).image).toEqual({ url: `https://site.cdn.test/${key}`, alt: 'vis alt' });
    const before = snap(await recapRow(recap.id));

    for (const change of [{ visibility: 'private' }, { visibility: 'internal' }, { status: 'draft' }, { status: 'archived' }]) {
      await media.updateAsset(models, s.assetId, change);
      const pub = await publicRecap(recap);
      expect(pub.posts.find((x) => x.poster_display_name === s.name)).toMatchObject({ content_text: s.text, image: null });
      expect(pub.posts.find((x) => x.poster_display_name === text.name).image).toEqual(SERVED);   // the other post is untouched
      expect(JSON.stringify(pub)).not.toContain(key);
      const view = await adminRecap(recap);
      expect(view.posts.find((x) => x.id === s.postId).image_rights).toMatchObject({
        public_now: false, revocation: 'pending', copy: { key, url: `https://site.cdn.test/${key}` }, cleared: true, ready: false,
      });
      expect(view.pending_revocations).toEqual([{ post_id: s.postId, key, url: `https://site.cdn.test/${key}` }]);
      expect(view.revocation_note).toMatch(/still in the public bucket/);
      expect(JSON.stringify(view)).not.toMatch(/revoked/i);   // nothing claims access is revoked
      await media.updateAsset(models, s.assetId, { status: 'approved', visibility: 'public' });
      expect((await publicPost(recap, s)).image).toEqual({ url: `https://site.cdn.test/${key}`, alt: 'vis alt' });
      expect((await adminPost(recap, s)).image_rights).toMatchObject({ public_now: true, revocation: null });
    }
    // Reads derive the state: the recap row is as publishing left it, and nothing more was stored or removed.
    expect(snap(await recapRow(recap.id))).toBe(before);
    expect(slots.putObject).toHaveBeenCalledTimes(2);
    expect(stored).toHaveLength(2);
  });

  test('after publishing, rights changed to unknown, or the declaration removed: hidden at once, revocation pending; cleared again, served again', async () => {
    const s = await scene('rights', { rights: { category: 'retailer', note: NOTE } });
    const recap = await recapFor(s);
    await publish(recap);
    const key = stored[0].key;
    expect((await publicPost(recap, s)).image).toEqual(SERVED);
    const before = snap(await recapRow(recap.id));

    expect((await declare(recap, s, { category: 'unknown' })).status).toBe(200);
    expect(await publicPost(recap, s)).toMatchObject({ content_text: s.text, image: null });
    expect((await adminPost(recap, s)).image_rights).toMatchObject({ public_now: false, revocation: 'pending', copy: { key }, cleared: false, why: ['rights_not_cleared'] });

    // Another cleared category serves it again, with no new copy: the picture is the same one.
    expect((await declare(recap, s, { category: 'licensed' })).status).toBe(200);
    expect((await publicPost(recap, s)).image).toEqual(SERVED);

    await run("UPDATE media_assets SET details = details - 'rights' WHERE id = :id", { id: s.assetId });
    expect(await publicPost(recap, s)).toMatchObject({ content_text: s.text, image: null });
    const view = await adminRecap(recap);
    expect(view.posts[0].image_rights).toMatchObject({ public_now: false, revocation: 'pending', rights: null, why: ['no_rights_declared'] });
    expect(view.pending_revocations).toEqual([{ post_id: s.postId, key, url: `https://site.cdn.test/${key}` }]);

    expect(snap(await recapRow(recap.id))).toBe(before);
    expect(slots.putObject).toHaveBeenCalledTimes(1);
  });

  test('identity: a declaration does not pass to another library record of the same URL; the old copy stays hidden until a republish copies under the new record', async () => {
    const s = await scene('same', { rights: { category: 'original' } });
    const recap = await recapFor(s);
    await publish(recap);
    const oldKey = stored[0].key;
    expect((await publicPost(recap, s)).image).toEqual(SERVED);

    await media.removeAsset(models, s.assetId);
    expect((await publicPost(recap, s)).image).toBeNull();
    const again = await media.createAsset(models, { url: s.url, source: 'upload', status: 'approved', visibility: 'public', by: 'seed' });
    expect(again.reused).toBe(false);
    expect(again.asset.id).not.toBe(s.assetId);
    // The new row starts with no declaration: the old one was the old picture's.
    expect(media.rightsOf(again.asset)).toBeNull();
    expect((await publicPost(recap, s)).image).toBeNull();
    await media.declareRights(models, again.asset.id, { category: 'licensed' }, 'seed@rights.dev');
    expect(await publicPost(recap, s)).toMatchObject({ content_text: s.text, image: null });   // cleared, but the copy is the old record's
    expect((await adminPost(recap, s)).image_rights).toMatchObject({
      library: { id: again.asset.id }, cleared: true, ready: true, public_now: false, revocation: 'pending', copy: { key: oldKey }, why: ['copy_of_another_picture'],
    });
    expect(stored).toHaveLength(1);

    await unpublish(recap);
    await publish(recap);
    expect(stored).toHaveLength(2);
    const newKey = stored[1].key;
    expect(newKey).not.toBe(oldKey);
    expect((await publicPost(recap, s)).image).toEqual({ url: `https://site.cdn.test/${newKey}`, alt: 'same alt' });
    expect((await recapRow(recap.id)).images[s.postId]).toMatchObject({ key: newKey, asset_id: again.asset.id, rights: { category: 'licensed' }, earlier: [{ key: oldKey, source: s.url, asset_id: s.assetId }] });
    // The replaced copy is still in the bucket: listed for revocation, never deleted here.
    const view = await adminRecap(recap);
    expect(view.pending_revocations).toEqual([{ post_id: s.postId, key: oldKey, url: `https://site.cdn.test/${oldKey}` }]);
    expect(view.posts[0].image_rights).toMatchObject({ public_now: true, revocation: null, copy: { key: newKey } });
    expect(JSON.stringify(await publicRecap(recap))).not.toContain(oldKey);
  });

  test('a copy made before the rule (no library id on it) is not served; republishing copies it under its record', async () => {
    const s = await scene('legacy', { rights: { category: 'original' } });
    const recap = await recapFor(s);
    const key = `site-public/recaps/${recap.id}/${uuid()}.jpg`;
    await recap.update({ status: 'published', published_at: new Date(), images: { [s.postId]: { key, source: s.url } } });
    expect((await publicPost(recap, s)).image).toBeNull();
    expect((await adminPost(recap, s)).image_rights).toMatchObject({ ready: true, public_now: false, revocation: 'pending', copy: { key } });
    await unpublish(recap);
    await publish(recap);
    expect(stored).toHaveLength(1);
    expect((await publicPost(recap, s)).image).toEqual({ url: `https://site.cdn.test/${stored[0].key}`, alt: 'legacy alt' });
  });

  test('the public responses carry no note, declarer, library id, revocation state or key of a hidden copy; nor does a signed-in non-admin read', async () => {
    const shown = await scene('shown', { rights: { category: 'licensed', note: NOTE } });
    const hidden = await scene('hidden', { rights: { category: 'retailer', note: NOTE } });
    const recap = await recapFor(shown, hidden);
    expect((await declare(recap, shown, { category: 'licensed', note: NOTE })).status).toBe(200);
    await publish(recap);
    const hiddenKey = (await recapRow(recap.id)).images[hidden.postId].key;
    await media.updateAsset(models, hidden.assetId, { visibility: 'private' });

    const one = await request(app).get(`/api/v1/public/recaps/${recap.id}`);
    const list = await request(app).get('/api/v1/public/recaps');
    expect(one.body.recap.posts.map((x) => Object.keys(x).sort())).toEqual(Array(2).fill(['comments_count', 'content_text', 'image', 'likes', 'moment', 'poster_display_name', 'poster_handle']));
    expect(one.body.recap.posts[0].image).toEqual({ url: expect.stringMatching(/^https:\/\/site\.cdn\.test\//), alt: 'shown alt' });
    expect(Object.keys(one.body.recap.posts[0].image).sort()).toEqual(['alt', 'url']);
    expect(one.body.recap.posts[1].image).toBeNull();
    expect(list.body.recaps.find((r) => r.id === recap.id)).toEqual({ id: recap.id, title: `Week ${tag}`, week_start: WEEK });
    for (const raw of [JSON.stringify(one.body), JSON.stringify(list.body)]) {
      for (const secret of [NOTE, `SECRET-NOTE-${tag}`, ADMIN_EMAIL, 'seed@rights.dev', shown.assetId, hidden.assetId, hiddenKey, shown.url, hidden.url,
        'revocation', 'asset_id', 'declared', 'image_rights', 'usage_rights', 'licensed', 'retailer']) {
        expect(raw).not.toContain(secret);
      }
    }

    // GET /pulse-recaps is an ADMIN's since 2026-11-15 (The Pulse's production reads, #3849): a signed-in reader
    // who is not one is refused, and the refusal carries none of the review's fields or the recap's own.
    for (const token of [editor, viewer]) {
      const res = await as(token, request(app).get(`/api/v1/pulse-recaps?show_id=${ids.show}`));
      expect(res.status).toBe(403);
      expect(res.body.data).toBeUndefined();
      expect(res.body.recaps).toBeUndefined();
      const raw = JSON.stringify(res.body);
      for (const secret of [NOTE, 'declared_by', 'seed@rights.dev', ADMIN_EMAIL, shown.assetId, hidden.assetId, hiddenKey, shown.url, hidden.url,
        'image_rights', 'pending_revocations', 'rights_categories', 'published_by']) expect(raw).not.toContain(secret);
    }
    const adminList = await as(admin, request(app).get(`/api/v1/pulse-recaps?show_id=${ids.show}`));
    expect(adminList.body.rights_categories.map((c) => [c.key, c.label, c.cleared])).toEqual([
      ['original', 'Original photograph — owned or controlled', true],
      ['licensed', 'Licensed image — permission held', true],
      ['retailer', 'Retailer image — permission held', true],
      ['ai_cleared', 'AI-generated image — cleared for public use', true],
      ['unknown', 'Unknown / not cleared', false],
    ]);
    expect(adminList.body.recaps[0].posts[0].image_rights.rights).toMatchObject({ note: NOTE, declared_by: ADMIN_EMAIL });
  });

  test('the rights route: signed out 401, viewer and editor 403, a bad body 400, an unknown post 404, no record 409; none of them writes or copies', async () => {
    const s = await scene('guard', { rights: { category: 'unknown' } });
    const bare = await scene('bare', { asset: null });
    const outside = await scene('outside', { rights: { category: 'unknown' } });
    const recap = await recapFor(s, bare);
    const before = { asset: snap(await assetRow(s.assetId)), outside: snap(await assetRow(outside.assetId)), recap: snap(await recapRow(recap.id)) };
    const assetCount = async () => Number((await run('SELECT COUNT(*) AS n FROM media_assets WHERE url LIKE :like', { like: `https://studio.example/rights-${tag}/%` }))[0][0].n);
    const count = await assetCount();

    expect((await declare(recap, s, { category: 'original' }, null)).status).toBe(401);
    expect((await declare(recap, s, { category: 'original' }, viewer)).status).toBe(403);
    expect((await declare(recap, s, { category: 'original' }, editor)).status).toBe(403);
    expect((await declare(recap, bare, { category: 'original', create: true }, editor)).status).toBe(403);
    for (const body of [
      { category: 'cleared' }, { category: 'ORIGINAL' }, { category: '' }, {}, { category: ['original'] }, { category: 'toString' }, { category: null },
      { category: 'licensed', note: 'x'.repeat(501) }, { category: 'licensed', note: { a: 1 } }, { category: 'original', note: 'a note' }, { category: 'unknown', note: 'a note' },
      { category: 'original', create: 'yes' },
    ]) {
      const res = await declare(recap, s, body);
      expect([JSON.stringify(body).slice(0, 60), res.status]).toEqual([JSON.stringify(body).slice(0, 60), 400]);
      expect(res.body.success).toBe(false);
    }
    expect((await declare(recap, bare, { category: 'cleared', create: true })).status).toBe(400);
    expect((await declare(recap, outside, { category: 'original' })).status).toBe(404);   // not a post of this recap
    expect((await as(admin, request(app).put(`/api/v1/pulse-recaps/${recap.id}/posts/not-a-post/image-rights`)).send({ category: 'original' })).status).toBe(404);
    expect((await as(admin, request(app).put(`/api/v1/pulse-recaps/${uuid()}/posts/${s.postId}/image-rights`)).send({ category: 'original' })).status).toBe(404);
    expect((await declare(recap, bare, { category: 'original' })).status).toBe(409);       // no library record, and none asked for
    expect((await declare(recap, bare, { category: 'original', create: false })).status).toBe(409);

    expect(snap(await assetRow(s.assetId))).toBe(before.asset);
    expect(snap(await assetRow(outside.assetId))).toBe(before.outside);
    expect(snap(await recapRow(recap.id))).toBe(before.recap);
    expect(await assetCount()).toBe(count);
    expect(stored).toHaveLength(0);
    expect(downloads).toHaveLength(0);
    expect(slots.putObject).not.toHaveBeenCalled();

    // A 500-character note is the most that is taken; the declaration changes the asset and nothing else.
    const ok = await declare(recap, s, { category: 'licensed', note: 'y'.repeat(500) });
    expect(ok.status).toBe(200);
    expect((await assetRow(s.assetId)).details.rights).toMatchObject({ category: 'licensed', note: 'y'.repeat(500), declared_by: ADMIN_EMAIL });
    expect(snap(await recapRow(recap.id))).toBe(before.recap);
    expect(slots.putObject).not.toHaveBeenCalled();
  });

  test('a picture with no library record: the ADMIN may create one for that exact URL; it is a private draft, cleared only as declared, and not public until approved', async () => {
    const s = await scene('create', { asset: null });
    const recap = await recapFor(s);
    const res = await declare(recap, s, { category: 'original', create: true });
    expect(res.status).toBe(200);
    const view = res.body.recap.posts[0].image_rights;
    expect(view).toMatchObject({ library: { status: 'draft', visibility: 'private', source: 'post', usage_rights: null }, rights: { category: 'original' }, cleared: true, ready: false, why: ['not_approved', 'not_public'] });
    const row = await assetRow(view.library.id);
    expect(row).toMatchObject({ url: s.url, status: 'draft', visibility: 'private', usage_rights: null, storage_key: null, created_by: ADMIN_EMAIL, deleted_at: null });
    expect(stored).toHaveLength(0);
    expect(downloads).toHaveLength(0);   // no file was read, copied or moved

    await publish(recap);
    expect(stored).toHaveLength(0);
    expect((await publicPost(recap, s)).image).toBeNull();

    // Approved and public in the library (its own screens), then a republish copies it.
    await media.updateAsset(models, view.library.id, { status: 'approved', visibility: 'public' });
    expect((await publicPost(recap, s)).image).toBeNull();   // nothing was copied yet
    await unpublish(recap);
    await publish(recap);
    expect(stored).toHaveLength(1);
    expect((await publicPost(recap, s)).image).toEqual(SERVED);

    // Created with "unknown": a record, but nothing cleared.
    const u = await scene('createunknown', { asset: null });
    await unpublish(recap);
    await recap.update({ post_ids: [u.postId] });
    const made = await declare(recap, u, { category: 'unknown', create: true });
    expect(made.body.recap.posts[0].image_rights).toMatchObject({ library: { status: 'draft', visibility: 'private' }, rights: { category: 'unknown' }, cleared: false, ready: false });
  });

  test('without SITE_PUBLIC_BUCKET a recap of cleared pictures still publishes, text only', async () => {
    delete process.env.SITE_PUBLIC_BUCKET;
    const s = await scene('nobucket', { rights: { category: 'original' } });
    const words = await scene('words', { asset: null, post: { image_url: null, image_description: null } });
    const recap = await recapFor(s, words);
    const res = await publish(recap);
    expect(res.status).toBe(200);
    expect(res.body.recap.posts.map((x) => x.image_rights)).toEqual([expect.objectContaining({ ready: true, public_now: false, copy: null, revocation: null }), null]);
    expect(slots.putObject).not.toHaveBeenCalled();
    expect(downloads).toHaveLength(0);
    expect((await publicRecap(recap)).posts.map((x) => [x.content_text, x.image])).toEqual([[s.text, null], [words.text, null]]);
  });

  test('no storage delete exists or is called: the only storage write is putObject', () => {
    const src = require('fs').readFileSync(require('path').join(__dirname, '../../src/services/pulseRecap.js'), 'utf8');
    expect(src).not.toMatch(/DeleteObject|deleteObject|CopyObject|removeObject/);
    expect(Object.keys(slots).filter((k) => /delete|remove/i.test(k) && /object/i.test(k))).toEqual([]);
  });
});
