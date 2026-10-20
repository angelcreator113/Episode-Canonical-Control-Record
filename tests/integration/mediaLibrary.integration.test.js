/**
 * Visual Memory, phase 1 (services/mediaLibrary, migration
 * 20261019120000-media-library), against the test database through the routes:
 *   - one picture tagged with two characters shows in both galleries, stored once
 *   - adding the same URL again reuses the picture and only adds the new tag
 *   - a draft or private picture is not shown to a reader who is not ADMIN
 *   - untagging takes it out of that character's gallery only
 *   - every write is ADMIN only; tagging needs a real character
 *   - "Bring existing pictures" carries portraits and post pictures in, tagged,
 *     and a second run adds nothing; a draft post's picture stays private
 *   - the migration's down drops only its two tables, and up brings them back
 */
jest.unmock('uuid');

const request = require('supertest');
const crypto = require('crypto');
const app = require('../../src/app');
const TokenService = require('../../src/services/tokenService');
const { sequelize } = require('../../src/models');
const migration = require('../../src/migrations/20261019120000-media-library');
// Phase 4's tables point at media_assets, so they come down first and go back up after, as a rollback would.
const later = require('../../src/migrations/20261019160000-picture-suggestions');
// The camera roll's moments point at media_assets too: undone first, redone last.
const cameraRoll = require('../../src/migrations/20261019220000-camera-roll');
// A post's camera-roll moment (post_id) sits on that table: undone before it, redone after it.
const postPictures = require('../../src/migrations/20261019230001-post-pictures');

const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const uuid = () => crypto.randomUUID();
const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });
const q = (sql, replacements = {}) => sequelize.query(sql, { replacements, type: sequelize.QueryTypes.SELECT });

(shouldSkip ? describe.skip : describe)('Visual Memory: the shared picture library', () => {
  const tag = uuid().slice(0, 8);
  const ids = { reg: uuid(), maren: uuid(), sable: uuid(), livePost: uuid(), draftPost: uuid(), venue: uuid(), set: uuid() };
  const url = (name) => `https://cdn.test/${tag}/${name}.jpg`;
  let admin;
  let user;
  let pid;
  const as = (req, token = admin) => req.set('Authorization', `Bearer ${token}`);
  const gallery = async (id, token = admin) => (await as(request(app).get(`/api/v1/cast/characters/${id}/gallery`), token)).body;
  const tagged = (body) => body.groups.find((g) => g.key === 'tagged').items;

  beforeAll(async () => {
    admin = TokenService.generateTokenPair({ id: 'test-admin-media', email: 'evoni@media.dev', name: 'Evoni', groups: ['ADMIN'], role: 'ADMIN' }).accessToken;
    user = TokenService.generateTokenPair({ id: 'test-user-media', email: 'user@media.dev', name: 'User', groups: ['USER'], role: 'USER' }).accessToken;
    await run("INSERT INTO character_registries (id, title, created_at, updated_at) VALUES (:reg, 'Media registry', NOW(), NOW())", ids);
    const [[p]] = await run(`INSERT INTO social_profiles (handle, platform, vibe_sentence, display_name, feed_layer, created_at, updated_at)
      VALUES (:h, 'pulse', 'test', 'Media Maren', 'lalaverse', NOW(), NOW()) RETURNING id`, { h: `mediamaren${tag}` });
    pid = p.id;
    await run(`INSERT INTO registry_characters (id, registry_id, character_key, display_name, portrait_url, feed_profile_id, created_at, updated_at)
               VALUES (:maren, :reg, :key, 'Media Maren', :portrait, :pid, NOW(), NOW())`, { ...ids, key: `media-maren-${tag}`, portrait: url('maren-portrait'), pid });
    await run(`INSERT INTO registry_characters (id, registry_id, character_key, display_name, created_at, updated_at)
               VALUES (:sable, :reg, :key, 'Media Sable', NOW(), NOW())`, { ...ids, key: `media-sable-${tag}` });
    const [[show]] = await run('SELECT id FROM shows LIMIT 1');
    const showId = show ? show.id : null;
    if (!showId) throw new Error('the test database needs a show');
    ids.show = showId;
    await run(`INSERT INTO feed_posts (id, show_id, social_profile_id, poster_handle, content_text, status, image_url, posted_at, created_at, updated_at)
               VALUES (:livePost, :show, :pid, '@m', 'bread is rising', 'live', :live, NOW(), NOW(), NOW()),
                      (:draftPost, :show, :pid, '@m', 'not yet', 'draft', :draft, NULL, NOW(), NOW())`,
    { ...ids, pid, live: url('live-post'), draft: url('draft-post') });
    // A venue with its own photo, and a scene set there.
    await run('INSERT INTO world_locations (id, name, venue_photo_url) VALUES (:venue, :name, :photo)', { venue: ids.venue, name: `Media venue ${tag}`, photo: url('venue-photo') });
    await run(`INSERT INTO scene_sets (id, name, scene_type, world_location_id, created_at, updated_at)
               VALUES (:set, :name, 'EVENT_LOCATION', :venue, NOW(), NOW())`, { set: ids.set, name: `Media studio ${tag}`, venue: ids.venue });
  });

  afterAll(async () => {
    await run(`DELETE FROM media_asset_links WHERE asset_id IN (SELECT id FROM media_assets WHERE url LIKE :pre)`, { pre: `https://cdn.test/${tag}/%` });
    await run('DELETE FROM media_assets WHERE url LIKE :pre', { pre: `https://cdn.test/${tag}/%` });
    await run('DELETE FROM feed_posts WHERE id IN (:livePost, :draftPost)', ids);
    await run('DELETE FROM scene_sets WHERE id = :set', ids);
    await run('DELETE FROM world_locations WHERE id = :venue', ids);
    await run('DELETE FROM registry_characters WHERE id IN (:maren, :sable)', ids);
    await run('DELETE FROM social_profiles WHERE id = :pid', { pid });
    await run('DELETE FROM character_registries WHERE id = :reg', ids);
  });

  it('every write is ADMIN only, and a tag needs something real', async () => {
    const body = { url: url('x'), links: JSON.stringify([{ entity_type: 'character', entity_id: ids.maren }]) };
    expect((await as(request(app).post('/api/v1/media'), user).send(body)).status).toBe(403);
    expect((await as(request(app).post('/api/v1/media/bring-existing'), user)).status).toBe(403);
    const ghost = await as(request(app).post('/api/v1/media')).send({ url: url('ghost'), links: JSON.stringify([{ entity_type: 'character', entity_id: uuid() }]) });
    expect(ghost.status).toBe(404);
    const bad = await as(request(app).post('/api/v1/media')).send({ url: url('bad'), links: JSON.stringify([{ entity_type: 'planet', entity_id: ids.maren }]) });
    expect(bad.status).toBe(400);
  });

  it('one picture tagged with two characters shows in both galleries, stored once', async () => {
    const res = await as(request(app).post('/api/v1/media')).send({
      url: url('together'), caption: 'At the market', links: JSON.stringify([{ entity_type: 'character', entity_id: ids.maren }]),
    });
    expect(res.status).toBe(201);
    const again = await as(request(app).post('/api/v1/media')).send({
      url: url('together'), links: JSON.stringify([{ entity_type: 'character', entity_id: ids.sable }]),
    });
    expect(again.status).toBe(200);
    expect(again.body.reused).toBe(true);
    expect(again.body.asset.id).toBe(res.body.asset.id);
    expect(again.body.asset.links.map((l) => l.name).sort()).toEqual(['Media Maren', 'Media Sable']);
    const [{ n }] = await q('SELECT COUNT(*)::int AS n FROM media_assets WHERE url = :u AND deleted_at IS NULL', { u: url('together') });
    expect(n).toBe(1);

    const maren = await gallery(ids.maren);
    expect(maren.can_edit).toBe(true);
    expect(tagged(maren).map((i) => i.url)).toContain(url('together'));
    expect(tagged(maren).find((i) => i.url === url('together')).asset.links).toHaveLength(2);
    expect(tagged(await gallery(ids.sable)).map((i) => i.url)).toContain(url('together'));
  });

  it('a draft or private picture is not shown to a reader who is not ADMIN; approving it shows it', async () => {
    const res = await as(request(app).post('/api/v1/media')).send({
      url: url('secret'), status: 'draft', visibility: 'private', links: JSON.stringify([{ entity_type: 'character', entity_id: ids.sable }]),
    });
    const id = res.body.asset.id;
    expect(tagged(await gallery(ids.sable)).map((i) => i.url)).toContain(url('secret'));
    const asUser = await gallery(ids.sable, user);
    expect(asUser.can_edit).toBe(false);
    expect(tagged(asUser).map((i) => i.url)).not.toContain(url('secret'));
    expect(tagged(asUser).every((i) => i.asset === undefined)).toBe(true);
    expect((await as(request(app).get(`/api/v1/media/${id}`), user)).status).toBe(404);
    const list = await as(request(app).get(`/api/v1/media?entity_type=character&entity_id=${ids.sable}`), user);
    expect(list.body.items.map((a) => a.url)).not.toContain(url('secret'));

    await as(request(app).put(`/api/v1/media/${id}`)).send({ status: 'approved', visibility: 'internal', details: { objects: ['tea cup'], season: 'autumn', junk: 'x' } });
    expect(tagged(await gallery(ids.sable, user)).map((i) => i.url)).toContain(url('secret'));
    const [row] = await q('SELECT details FROM media_assets WHERE id = :id', { id });
    expect(row.details).toEqual({ objects: ['tea cup'], season: 'autumn' });
  });

  it('untagging takes it out of that character\'s gallery only', async () => {
    const asset = tagged(await gallery(ids.maren)).find((i) => i.url === url('together')).asset;
    const link = asset.links.find((l) => l.entity_id === ids.sable);
    const res = await as(request(app).delete(`/api/v1/media/${asset.id}/links/${link.id}`));
    expect(res.status).toBe(200);
    expect(res.body.asset.links.map((l) => l.entity_id)).toEqual([ids.maren]);
    expect(tagged(await gallery(ids.sable)).map((i) => i.url)).not.toContain(url('together'));
    expect(tagged(await gallery(ids.maren)).map((i) => i.url)).toContain(url('together'));
    expect((await as(request(app).delete(`/api/v1/media/${asset.id}/links/${link.id}`))).status).toBe(404);
  });

  it('brings existing pictures in, tagged, once; a draft post\'s picture stays private', async () => {
    const first = await as(request(app).post('/api/v1/media/bring-existing'));
    expect(first.status).toBe(200);
    const rows = await q('SELECT url, source, status, visibility FROM media_assets WHERE url IN (:urls) AND deleted_at IS NULL ORDER BY url',
      { urls: [url('maren-portrait'), url('live-post'), url('draft-post')] });
    expect(rows).toEqual([
      { url: url('draft-post'), source: 'post', status: 'draft', visibility: 'private' },
      { url: url('live-post'), source: 'post', status: 'approved', visibility: 'public' },
      { url: url('maren-portrait'), source: 'portrait', status: 'approved', visibility: 'internal' },
    ]);
    // The venue's own photo comes in too, tagged with the scene set at that venue.
    const [venue] = await q(`SELECT ma.source, ma.status, ma.visibility, l.entity_type, l.entity_id, l.role FROM media_assets ma
      JOIN media_asset_links l ON l.asset_id = ma.id AND l.deleted_at IS NULL WHERE ma.url = :u AND ma.deleted_at IS NULL`, { u: url('venue-photo') });
    expect(venue).toEqual({ source: 'venue', status: 'approved', visibility: 'internal', entity_type: 'scene_set', entity_id: ids.set, role: 'location' });
    const links = await q(`SELECT ma.url, l.entity_type, l.entity_id, l.role FROM media_asset_links l JOIN media_assets ma ON ma.id = l.asset_id
      WHERE ma.url IN (:urls) AND l.deleted_at IS NULL ORDER BY ma.url, l.entity_type`, { urls: [url('maren-portrait'), url('live-post')] });
    expect(links).toEqual([
      { url: url('live-post'), entity_type: 'character', entity_id: ids.maren, role: 'owner' },
      { url: url('live-post'), entity_type: 'post', entity_id: ids.livePost, role: 'owner' },
      { url: url('maren-portrait'), entity_type: 'character', entity_id: ids.maren, role: 'pictured' },
    ]);
    const before = await q('SELECT (SELECT COUNT(*)::int FROM media_assets) AS a, (SELECT COUNT(*)::int FROM media_asset_links) AS l');
    const second = await as(request(app).post('/api/v1/media/bring-existing'));
    expect(second.body).toMatchObject({ pictures: 0, tags: 0 });
    const after = await q('SELECT (SELECT COUNT(*)::int FROM media_assets) AS a, (SELECT COUNT(*)::int FROM media_asset_links) AS l');
    expect(after).toEqual(before);

    // The portrait was already shown in Portraits: not repeated under Tagged, but an ADMIN sees its tags.
    const maren = await gallery(ids.maren);
    expect(tagged(maren).map((i) => i.url)).not.toContain(url('maren-portrait'));
    expect(maren.groups.find((g) => g.key === 'portraits').items[0].asset.links[0]).toMatchObject({ entity_type: 'character', entity_id: ids.maren });
  });

  it('removing a picture takes it out with its tags', async () => {
    const asset = tagged(await gallery(ids.maren)).find((i) => i.url === url('together')).asset;
    expect((await as(request(app).delete(`/api/v1/media/${asset.id}`))).status).toBe(200);
    expect(tagged(await gallery(ids.maren)).map((i) => i.url)).not.toContain(url('together'));
    const [{ n }] = await q('SELECT COUNT(*)::int AS n FROM media_asset_links WHERE asset_id = :id AND deleted_at IS NULL', { id: asset.id });
    expect(n).toBe(0);
  });

  it('the migration\'s down drops only its two tables, and up brings them back', async () => {
    await run(`DELETE FROM media_asset_links WHERE asset_id IN (SELECT id FROM media_assets WHERE url LIKE :pre)`, { pre: `https://cdn.test/${tag}/%` });
    await run('DELETE FROM media_assets WHERE url LIKE :pre', { pre: `https://cdn.test/${tag}/%` });
    const qi = sequelize.getQueryInterface();
    await postPictures.down(qi, sequelize.constructor);
    await cameraRoll.down(qi, sequelize.constructor);
    await later.down(qi, sequelize.constructor);
    await migration.down(qi, sequelize.constructor);
    const gone = await q("SELECT to_regclass('public.media_assets') AS a, to_regclass('public.media_asset_links') AS l, to_regclass('public.feed_posts') AS f");
    expect(gone[0]).toMatchObject({ a: null, l: null });
    expect(gone[0].f).toBeTruthy();
    await migration.up(qi, sequelize.constructor);
    await later.up(qi, sequelize.constructor);
    await cameraRoll.up(qi, sequelize.constructor);
    await postPictures.up(qi, sequelize.constructor);
    const back = await q("SELECT to_regclass('public.media_assets') AS a, to_regclass('public.media_asset_links') AS l, to_regclass('public.media_asset_sources') AS s, to_regclass('public.camera_roll_moments') AS c");
    expect(back[0].a).toBeTruthy();
    expect(back[0].l).toBeTruthy();
    expect(back[0].s).toBeTruthy();
    expect(back[0].c).toBeTruthy();
  });
});
