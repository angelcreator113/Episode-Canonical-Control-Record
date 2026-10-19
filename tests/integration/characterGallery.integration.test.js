/**
 * The Gallery tab (Evoni, 2026-10-18; services/characterGallery): every
 * picture already linked to a character, grouped. Against the test
 * database, through the route:
 *   - portraits: their photo, cover and the portraits made from their look
 *   - places: their linked scene sets' pictures
 *   - wardrobe: pieces whose character names them; someone else's are not here
 *   - events: the invitation and event set of an event they host
 *   - posts: their posts' photos, drafts marked; a post with no picture is not here
 *   - no feed profile: no events or posts, and linked is false
 *   - the library's pictures tagged with them come last (Tagged; mediaLibrary tests)
 */
jest.unmock('uuid');

const request = require('supertest');
const crypto = require('crypto');
const app = require('../../src/app');
const TokenService = require('../../src/services/tokenService');
const { sequelize } = require('../../src/models');

const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const uuid = () => crypto.randomUUID();
const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });

(shouldSkip ? describe.skip : describe)('Gallery: every picture already linked to a character', () => {
  const tag = uuid().slice(0, 8);
  const ids = {
    show: uuid(), reg: uuid(), maren: uuid(), loner: uuid(), set: uuid(), eventSet: uuid(), asset: uuid(), event: uuid(),
    w1: uuid(), w2: uuid(), post1: uuid(), post2: uuid(), post3: uuid(),
  };
  let token;
  let pid;

  beforeAll(async () => {
    token = TokenService.generateTokenPair({ id: 'test-gallery', email: 'evoni@gallery.dev', name: 'Evoni', groups: ['ADMIN'], role: 'ADMIN' }).accessToken;
    await run('INSERT INTO shows (id, name, slug, created_at, updated_at) VALUES (:show, :name, :slug, NOW(), NOW())', { show: ids.show, name: `Gallery ${tag}`, slug: `gallery-${tag}` });
    await run("INSERT INTO character_registries (id, title, show_id, created_at, updated_at) VALUES (:reg, 'Gallery', :show, NOW(), NOW())", ids);
    const [[row]] = await run(`INSERT INTO social_profiles (handle, platform, vibe_sentence, display_name, feed_layer, created_at, updated_at)
      VALUES (:h, 'pulse', 'test', 'Maren', 'lalaverse', NOW(), NOW()) RETURNING id`, { h: `slowsift${tag}` });
    pid = row.id;
    await run(`INSERT INTO registry_characters (id, registry_id, character_key, display_name, world, portrait_url, cover_url, appearance, feed_profile_id, created_at, updated_at)
      VALUES (:maren, :reg, :key, :name, 'lalaverse', 'https://img/photo.png', 'https://img/cover.png', CAST(:appearance AS jsonb), :pid, NOW(), NOW())`, {
      ...ids, key: `maren-${tag}`, name: `Maren ${tag}`, pid,
      appearance: JSON.stringify({ portraits: [{ url: 'https://img/portrait-1.png' }, { url: 'https://img/photo.png' }] }),
    });
    await run(`INSERT INTO registry_characters (id, registry_id, character_key, display_name, world, created_at, updated_at)
      VALUES (:loner, :reg, :key, 'Loner', 'lalaverse', NOW(), NOW())`, { ...ids, key: `loner-${tag}` });

    await run(`INSERT INTO scene_sets (id, name, scene_type, base_still_url, created_at, updated_at)
      VALUES (:set, 'Maren studio', 'HOME_BASE', 'https://img/studio.png', NOW(), NOW()),
             (:eventSet, 'Gallery night set', 'EVENT_LOCATION', 'https://img/event-set.png', NOW(), NOW())`, ids);
    await run(`INSERT INTO character_places (id, registry_character_id, scene_set_id, role, created_at, updated_at)
      VALUES (:id, :maren, :set, 'home', NOW(), NOW())`, { ...ids, id: uuid() });

    await run(`INSERT INTO wardrobe (id, name, clothing_category, character, s3_url, created_at, updated_at)
      VALUES (:w1, 'Linen set', 'top', :name, 'https://img/linen.png', NOW(), NOW()),
             (:w2, 'Not hers', 'top', 'Someone Else', 'https://img/other.png', NOW(), NOW())`, { ...ids, name: `maren ${tag}` });

    await run(`INSERT INTO assets (id, asset_type, s3_url_raw, created_at, updated_at)
      VALUES (:asset, 'INVITATION', 'https://img/invite.png', NOW(), NOW())`, ids);
    await run(`INSERT INTO world_events (id, show_id, name, source_profile_id, invitation_asset_id, scene_set_id, created_at, updated_at)
      VALUES (:event, :show, 'Gallery night', :pid, :asset, :eventSet, NOW(), NOW())`, { ...ids, pid });

    await run(`INSERT INTO feed_posts (id, show_id, poster_handle, social_profile_id, content_text, image_url, photos, status, created_at, updated_at)
      VALUES (:post1, :show, 'slowsift', :pid, 'Studio day', NULL, CAST(:photos AS jsonb), 'draft', NOW(), NOW()),
             (:post2, :show, 'slowsift', :pid, 'One look', 'https://img/look.png', NULL, 'live', NOW(), NOW()),
             (:post3, :show, 'slowsift', :pid, 'Words only', NULL, NULL, 'live', NOW(), NOW())`, {
      ...ids, pid, photos: JSON.stringify([{ url: 'https://img/a.png' }, { url: 'https://img/b.png' }]),
    });
  });

  afterAll(async () => {
    await run('DELETE FROM feed_posts WHERE id IN (:post1, :post2, :post3)', ids);
    await run('DELETE FROM world_events WHERE id = :event', ids);
    await run('DELETE FROM assets WHERE id = :asset', ids);
    await run('DELETE FROM wardrobe WHERE id IN (:w1, :w2)', ids);
    await run('DELETE FROM character_places WHERE registry_character_id = :maren', ids);
    await run('DELETE FROM scene_sets WHERE id IN (:set, :eventSet)', ids);
    await run('DELETE FROM registry_characters WHERE id IN (:maren, :loner)', ids);
    await run('DELETE FROM social_profiles WHERE id = :pid', { pid });
    await run('DELETE FROM character_registries WHERE id = :reg', ids);
    await run('DELETE FROM shows WHERE id = :show', ids);
  });

  const gallery = async (id) => {
    const res = await request(app).get(`/api/v1/cast/characters/${id}/gallery`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    return { ...res.body, by: Object.fromEntries(res.body.groups.map((g) => [g.key, g.items])) };
  };

  it('groups their portraits, places, wardrobe, events and posts', async () => {
    const { linked, groups, by } = await gallery(ids.maren);
    expect(linked).toBe(true);
    expect(groups.map((g) => g.key)).toEqual(['portraits', 'places', 'wardrobe', 'events', 'posts', 'tagged']);
    expect(by.portraits.map((i) => i.url)).toEqual(['https://img/photo.png', 'https://img/cover.png', 'https://img/portrait-1.png']);
    expect(by.places.map((i) => [i.url, i.caption])).toEqual([['https://img/studio.png', 'Home: Maren studio']]);
    expect(by.wardrobe.map((i) => i.caption)).toEqual(['Linen set']);
    expect(by.events.map((i) => i.url)).toEqual(['https://img/invite.png', 'https://img/event-set.png']);
    expect(by.events[1].caption).toBe('They host Gallery night');
    const posts = by.posts.map((i) => [i.url, i.caption]);
    expect(posts).toEqual(expect.arrayContaining([
      ['https://img/a.png', 'Draft: Studio day'], ['https://img/b.png', 'Draft: Studio day'], ['https://img/look.png', 'One look'],
    ]));
    expect(posts).toHaveLength(3);
  });

  it('a character with no feed profile has no events or posts', async () => {
    const { linked, by } = await gallery(ids.loner);
    expect(linked).toBe(false);
    expect(by.events).toEqual([]);
    expect(by.posts).toEqual([]);
    expect(by.portraits).toEqual([]);
  });

  it('an unknown character is a 404, a bad id a 400', async () => {
    const missing = await request(app).get(`/api/v1/cast/characters/${uuid()}/gallery`).set('Authorization', `Bearer ${token}`);
    expect(missing.status).toBe(404);
    const bad = await request(app).get('/api/v1/cast/characters/nope/gallery').set('Authorization', `Bearer ${token}`);
    expect(bad.status).toBe(400);
  });
});
