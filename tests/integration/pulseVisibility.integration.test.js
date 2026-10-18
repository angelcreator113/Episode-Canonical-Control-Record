/**
 * Why a character's posts are or aren't on The Pulse (Evoni, 2026-10-18:
 * "when a character has a voice and even makes post they are not showing up
 * on the pulse"; services/pulseVisibility, GET
 * /api/v1/cast/characters/:id/pulse-visibility). Against the test database:
 * live, waiting in Review, scheduled and held posts are counted apart;
 * whether Lala has met them is not a reason (Evoni, 2026-10-18: "it shouldnt
 * matter if lala has met them they should still be building themselves on
 * the pulse"); no Feed profile and no Voice Profile are said plainly; ADMIN
 * only.
 */
jest.unmock('uuid');

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

(shouldSkip ? describe.skip : describe)('On The Pulse: why their posts are or are not there', () => {
  const tag = uuid().slice(0, 8);
  const ids = { show: uuid(), reg: uuid(), maren: uuid(), ghost: uuid() };
  let profileId;
  let admin;
  let editor;
  const get = (id, token = admin) => request(app).get(`/api/v1/cast/characters/${id}/pulse-visibility`).set('Authorization', `Bearer ${token}`);
  const post = (status, extra = {}) => models.FeedPost.create({
    show_id: ids.show, social_profile_id: profileId, poster_handle: `maren${tag}`, poster_display_name: 'Maren', poster_platform: 'lalaverse',
    post_type: 'post', content_text: 'still here. the bread is rising.', status, likes: 0, comments_count: 0, shares: 0, sample_comments: [], sort_order: 0, ...extra,
  });

  beforeAll(async () => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    admin = TokenService.generateTokenPair({ id: 'test-admin-vis', email: 'evoni@vis.dev', name: 'Evoni', groups: ['ADMIN'], role: 'ADMIN' }).accessToken;
    editor = TokenService.generateTokenPair({ id: 'test-editor-vis', email: 'ed@vis.dev', name: 'Ed', groups: ['USER', 'EDITOR'], role: 'USER' }).accessToken;
    await run('INSERT INTO shows (id, name, slug, created_at, updated_at) VALUES (:show, :name, :slug, NOW(), NOW())', { show: ids.show, name: `Vis ${tag}`, slug: `vis-${tag}` });
    await run("INSERT INTO character_registries (id, title, show_id, created_at, updated_at) VALUES (:reg, 'Vis registry', :show, NOW(), NOW())", ids);
    const [[row]] = await run(`INSERT INTO social_profiles (handle, platform, vibe_sentence, display_name, feed_layer, created_at, updated_at)
      VALUES (:handle, 'pulse', 'test', 'Maren', 'lalaverse', NOW(), NOW()) RETURNING id`, { handle: `maren${tag}` });
    profileId = row.id;
    await run(`INSERT INTO registry_characters (id, registry_id, character_key, display_name, feed_profile_id, created_at, updated_at)
               VALUES (:maren, :reg, :key, 'Maren', :feed, NOW(), NOW())`, { ...ids, key: `maren-${tag}`, feed: profileId });
    await run(`INSERT INTO registry_characters (id, registry_id, character_key, display_name, created_at, updated_at)
               VALUES (:ghost, :reg, :key, 'No Account', NOW(), NOW())`, { ...ids, key: `ghost-${tag}` });
    // Maren meets Lala at story order 20; the show's present is before that.
    await models.PulseReveal.create({ show_id: ids.show, item_type: 'character', item_id: String(profileId), moment: 'story_time', story_order: 20, mode: 'hidden', source: 'set' });
    await post('live');
    await post('draft');
    await post('draft');
    await post('draft', { release_state: 'scheduled', release_at: new Date(Date.now() + 86400000) });
    await post('draft', { release_state: 'held' });
  });

  afterAll(async () => {
    await new Promise((r) => { setTimeout(r, 300); });
    await run('DELETE FROM pulse_post_numbers WHERE show_id = :show', ids).catch(() => {});
    await run('DELETE FROM feed_posts WHERE show_id = :show', ids);
    await run('DELETE FROM pulse_reveals WHERE show_id = :show', ids);
    await run('DELETE FROM registry_characters WHERE registry_id = :reg', ids);
    await run('DELETE FROM character_registries WHERE id = :reg', ids);
    await run('DELETE FROM social_profiles WHERE id = :id', { id: profileId });
    await run('DELETE FROM shows WHERE id = :show', ids);
  });

  it('counts live, waiting in Review, scheduled and held posts apart, and says they have no voice', async () => {
    const res = await get(ids.maren);
    expect(res.status).toBe(200);
    expect(res.body.show_id).toBe(ids.show);
    expect(res.body.live_count).toBe(1);
    expect(res.body.draft_count).toBe(2);
    expect(res.body.scheduled).toHaveLength(1);
    expect(res.body.held_count).toBe(1);
    expect(res.body.no_voice).toBe(true);
    expect(res.body.reasons.join(' ')).toMatch(/2 posts are waiting in Review/);
    expect(res.body.reasons.join(' ')).toMatch(/no Voice Profile/);
  });

  it('not meeting Lala yet is not a reason: their live post shows on The Pulse at the present', async () => {
    const res = await get(ids.maren);
    expect(res.body).not.toHaveProperty('hidden');
    expect(res.body.reasons.join(' ')).not.toMatch(/met/);
    const feed = await request(app).get(`/api/v1/feed-posts?show_id=${ids.show}&status=live&at=present`).set('Authorization', `Bearer ${admin}`);
    expect(feed.status).toBe(200);
    expect(feed.body.data.map((p) => p.social_profile_id)).toContain(profileId);
  });

  it('a character with no Feed profile is told so', async () => {
    const res = await get(ids.ghost);
    expect(res.status).toBe(200);
    expect(res.body.profile).toBeNull();
    expect(res.body.reasons[0]).toMatch(/has no Feed profile/);
  });

  it('is ADMIN only, and an unknown character is a 404', async () => {
    expect((await get(ids.maren, editor)).status).toBe(403);
    expect((await get(uuid())).status).toBe(404);
  });
});
