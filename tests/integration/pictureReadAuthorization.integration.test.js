/**
 * The picture library and the camera roll are the studio's to read (Evoni's
 * ruling of 2026-11-15: "non-admin accounts must not receive internal,
 * private, unapproved or unreleased pictures, or production metadata"),
 * against the test database.
 *
 * Their read routes return the stored row (how a picture was made, its usage
 * rights, everything it is linked to) and showed "internal" pictures to any
 * signed-in account. Every caller is a production screen, so the five reads
 * are an ADMIN's. The audience's pictures still reach it where they always
 * did: The Pulse's profile, which gives approved, public pictures only.
 *
 * Four pictures of one character are seeded, each with a marker in its
 * caption, usage rights and details: public, internal, private (all
 * approved) and an unapproved draft.
 */
jest.unmock('uuid');

const request = require('supertest');
const crypto = require('crypto');
const app = require('../../src/app');
const TokenService = require('../../src/services/tokenService');
const models = require('../../src/models');
const media = require('../../src/services/mediaLibrary');

const { sequelize } = models;

const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const MARK = 'ZZPIC';

(shouldSkip ? describe.skip : describe)('the picture library and the camera roll: who reads them', () => {
  const tag = crypto.randomUUID().slice(0, 8);
  const HANDLE = `pic.${tag}`;
  const ids = { show: crypto.randomUUID(), reg: crypto.randomUUID(), char: crypto.randomUUID() };
  const assets = {};
  const tokens = {};
  let profileId;
  let ipN = 0;
  const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });
  const url = (kind) => `https://img.test/${kind}-${tag}.png`;
  const get = (who, path) => {
    ipN += 1;
    const r = request(app).get(path).set('X-Forwarded-For', `198.51.110.${(ipN % 200) + 1}`);
    return tokens[who] ? r.set('Authorization', `Bearer ${tokens[who]}`) : r;
  };
  const reads = () => [
    `/api/v1/media?entity_type=character&entity_id=${ids.char}`,
    `/api/v1/media/${assets.public}`,
    `/api/v1/media/${assets.internal}`,
    `/api/v1/media/${assets.private}`,
    `/api/v1/media/${assets.draft}`,
    `/api/v1/media/${assets.public}/family`,
    `/api/v1/media/${assets.public}/sources`,
    `/api/v1/camera-roll/characters/${ids.char}`,
  ];

  beforeAll(async () => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    const token = (id, groups, role) => TokenService.generateTokenPair({ id, email: `${id}@pictures.dev`, name: id, groups, role }).accessToken;
    tokens.viewer = token(`viewer-${tag}`, ['viewer'], 'USER');
    tokens.editor = token(`editor-${tag}`, ['USER', 'EDITOR'], 'USER');
    tokens.admin = token(`admin-${tag}`, ['ADMIN'], 'ADMIN');
    await run('INSERT INTO shows (id, name, slug, created_at, updated_at) VALUES (:show, :name, :slug, NOW(), NOW())', { ...ids, name: `Pictures ${tag}`, slug: `pictures-${tag}` });
    const [[p]] = await run(
      `INSERT INTO social_profiles (handle, platform, vibe_sentence, feed_layer, display_name, created_at, updated_at)
       VALUES (:h, 'pulse', 'Bakes.', 'lalaverse', :name, NOW(), NOW()) RETURNING id`, { h: HANDLE, name: `Pic ${tag}` });
    profileId = p.id;
    await run('INSERT INTO character_registries (id, title, show_id, created_at, updated_at) VALUES (:reg, :t, :show, NOW(), NOW())', { ...ids, t: `Pictures ${tag}` });
    await run(`INSERT INTO registry_characters (id, registry_id, character_key, display_name, feed_profile_id, created_at, updated_at)
               VALUES (:char, :reg, :key, :name, :pid, NOW(), NOW())`, { ...ids, key: `pic-${tag}`, name: `Pic ${tag}`, pid: profileId });
    const link = [{ entity_type: 'character', entity_id: ids.char, role: 'pictured' }];
    for (const [kind, status, visibility] of [['public', 'approved', 'public'], ['internal', 'approved', 'internal'], ['private', 'approved', 'private'], ['draft', 'draft', 'internal']]) {
      const made = await media.createAsset(models, {
        url: url(kind), caption: `${MARK}:caption:${kind}`, usageRights: `${MARK}:rights:${kind}`, details: { objects: [`${MARK}:details:${kind}`] },
        status, visibility, links: link,
      });
      assets[kind] = made.asset.id;
    }
  });

  afterAll(async () => {
    await run('DELETE FROM media_asset_links WHERE asset_id IN (:a)', { a: Object.values(assets) });
    await run('DELETE FROM media_assets WHERE id IN (:a)', { a: Object.values(assets) });
    await run('DELETE FROM registry_characters WHERE registry_id = :reg', ids);
    await run('DELETE FROM character_registries WHERE id = :reg', ids);
    await run('DELETE FROM social_profiles WHERE id = :pid', { pid: profileId });
    await run('DELETE FROM shows WHERE id = :show', ids);
  });

  test('no token: every read answers 401 with nothing of a picture in it', async () => {
    for (const path of reads()) {
      const res = await get('anon', path);
      expect([path, res.status]).toEqual([path, 401]);
      expect(JSON.stringify(res.body)).not.toMatch(new RegExp(`${MARK}|img\\.test`));
    }
  });

  test.each(['viewer', 'editor'])('%s: every read answers 403 with nothing of a picture in it, the public one included', async (who) => {
    for (const path of reads()) {
      const res = await get(who, path);
      expect([path, res.status]).toEqual([path, 403]);
      expect(res.body.items).toBeUndefined();
      expect(res.body.asset).toBeUndefined();
      expect(res.body.data).toBeUndefined();
      expect(JSON.stringify(res.body)).not.toMatch(new RegExp(`${MARK}|img\\.test`));
    }
  });

  test('an ADMIN reads the library as before: every picture, with its metadata and links', async () => {
    const list = await get('admin', `/api/v1/media?entity_type=character&entity_id=${ids.char}`);
    expect(list.status).toBe(200);
    expect(list.body.items.map((a) => a.url).sort()).toEqual(['draft', 'internal', 'private', 'public'].map(url).sort());
    for (const kind of Object.keys(assets)) {
      const one = await get('admin', `/api/v1/media/${assets[kind]}`);
      expect(one.status).toBe(200);
      expect(one.body.asset).toMatchObject({ id: assets[kind], caption: `${MARK}:caption:${kind}`, usage_rights: `${MARK}:rights:${kind}` });
      expect(one.body.asset.links.map((l) => l.entity_id)).toContain(ids.char);
    }
    expect((await get('admin', `/api/v1/media/${assets.public}/family`)).status).toBe(200);
    expect((await get('admin', `/api/v1/media/${assets.public}/sources`)).status).toBe(200);
    const roll = await get('admin', `/api/v1/camera-roll/characters/${ids.char}`);
    expect(roll.status).toBe(200);
    expect(roll.body.data).toEqual(expect.any(Object));
  });

  test('The Pulse\'s profile still answers a viewer, and never with an internal, private or unapproved picture or any stored metadata', async () => {
    const page = await get('viewer', `/api/v1/pulse-follows/profile/${HANDLE}?show_id=${ids.show}`);
    expect(page.status).toBe(200);
    expect(page.body.data.profile.handle).toBe(HANDLE);
    const pictures = await get('viewer', `/api/v1/pulse-follows/profile/${HANDLE}/media`);
    expect(pictures.status).toBe(200);
    expect(pictures.body.data).toEqual(expect.objectContaining({ tagged: expect.any(Array), highlights: expect.any(Array) }));
    const raw = JSON.stringify(pictures.body);
    for (const kind of ['internal', 'private', 'draft']) expect(raw).not.toContain(url(kind));
    expect(raw).not.toMatch(new RegExp(`${MARK}:(rights|details)`));
    expect((await get('viewer', `/api/v1/feed-posts?show_id=${ids.show}&status=live`)).status).toBe(200);
  });

  test('the library\'s own rule for a reader who is not an ADMIN is unchanged (it still governs the feed and profiles)', async () => {
    const member = await media.listFor(models, { entityType: 'character', entityId: ids.char, audience: 'member' });
    expect(member.map((a) => a.url).sort()).toEqual([url('internal'), url('public')].sort());
    const audience = await media.listFor(models, { entityType: 'character', entityId: ids.char, audience: 'public' });
    expect(audience.map((a) => a.url)).toEqual([url('public')]);
    await expect(media.getAsset(models, assets.private, { audience: 'member' })).rejects.toMatchObject({ status: 404 });
    await expect(media.getAsset(models, assets.draft, { audience: 'public' })).rejects.toMatchObject({ status: 404 });
  });
});
