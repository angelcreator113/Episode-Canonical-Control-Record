/**
 * Pulse profiles and follows (Evoni, 2026-10-19; services/pulseFollows.js,
 * routes/pulseFollowsRoutes.js, migrations 20261019190000/190001):
 * - someone crossing from the feed follows Lala, one way; a character made
 *   some other way (created_from, migration 20261019200001) does not;
 * - the seed makes Lala's old friends mutual follows and feed people
 *   followers of Lala, idempotently; down removes only its own rows;
 * - Evoni sets either direction; anyone else gets a 403;
 * - Lala's friends are the people she and they both follow;
 * - a profile read gives the person, their audience number and the relation.
 */
jest.unmock('uuid');

const request = require('supertest');
const crypto = require('crypto');
const app = require('../../src/app');
const TokenService = require('../../src/services/tokenService');
const models = require('../../src/models');
const follows = require('../../src/services/pulseFollows');
const seed = require('../../src/migrations/20261019190001-pulse-follows-seed');

const { sequelize } = models;

const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const uuid = () => crypto.randomUUID();
const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });

(shouldSkip ? describe.skip : describe)('Pulse profiles and follows (Evoni, 2026-10-19)', () => {
  const tag = uuid().slice(0, 8);
  const ids = { show: uuid(), reg: uuid(), lalaChar: uuid() };
  const p = {};
  let admin;
  let editor;
  const as = (token, req) => req.set('Authorization', `Bearer ${token}`);
  const live = async (a, b) => (await run(
    'SELECT source FROM pulse_follows WHERE follower_profile_id = :a AND followed_profile_id = :b AND deleted_at IS NULL', { a, b }))[0];

  beforeAll(async () => {
    admin = TokenService.generateTokenPair({ id: 'test-admin-follows', email: 'evoni@follows.dev', name: 'Evoni', groups: ['ADMIN'], role: 'ADMIN' }).accessToken;
    editor = TokenService.generateTokenPair({ id: 'test-editor-follows', email: 'ed@follows.dev', name: 'Ed', groups: ['USER'], role: 'USER' }).accessToken;
    await run('INSERT INTO shows (id, name, slug, created_at, updated_at) VALUES (:show, :name, :slug, NOW(), NOW())',
      { show: ids.show, name: `Follows ${tag}`, slug: `follows-${tag}` });
    await run("INSERT INTO character_registries (id, title, show_id, created_at, updated_at) VALUES (:reg, 'Follows registry', :show, NOW(), NOW())", ids);
    const profile = async (key, extra = {}) => {
      const [[row]] = await run(`INSERT INTO social_profiles (handle, platform, vibe_sentence, display_name, feed_layer, status, lala_relationship, public_persona, city, created_at, updated_at)
        VALUES (:handle, 'instagram', 'dry wit', :display, 'lalaverse', CAST(:status AS enum_social_profiles_status),
          CAST(:rel AS enum_social_profiles_lala_relationship), :persona, CAST(:city AS enum_social_profiles_city), NOW(), NOW()) RETURNING id`,
      { handle: `${extra.at ? '@' : ''}${key}-${tag}`, display: key, status: extra.status || 'finalized', rel: extra.rel || null, persona: extra.persona || null, city: extra.city || null });
      p[key] = row.id;
    };
    await profile('lala');
    await profile('friend', { rel: 'direct' });       // an old friend of Lala's
    await profile('crossed', { status: 'crossed' });  // came from the feed before follows existed
    await profile('maren', { status: 'finalized', persona: 'baker and early riser', city: 'velour_city' });
    await profile('stranger');
    await profile('sable', { at: true });          // stored as "@sable-…", the way real handles are
    await profile('made', { status: 'generated' });   // "Make one for me": their character was made on The Cast
    // Lala's registry character links her profile: lalaFeedProfile finds her through it.
    await run(`INSERT INTO registry_characters (id, registry_id, character_key, display_name, feed_profile_id, created_at, updated_at)
               VALUES (:id, :reg, 'lala', 'Lala', :feed, NOW(), NOW() + interval '1 day')`, { id: ids.lalaChar, reg: ids.reg, feed: p.lala });
    await run(`INSERT INTO registry_characters (id, registry_id, character_key, display_name, feed_profile_id, created_from, created_at, updated_at)
               VALUES (:id, :reg, :key, 'Made', :feed, 'cast_generate', NOW(), NOW())`, { id: uuid(), reg: ids.reg, key: `made_${tag}`, feed: p.made });
  });

  afterAll(async () => {
    await run('DELETE FROM pulse_follows WHERE follower_profile_id IN (:a) OR followed_profile_id IN (:a)', { a: Object.values(p) });
    await run('DELETE FROM registry_characters WHERE registry_id = :reg', ids);
    await run('DELETE FROM character_registries WHERE id = :reg', ids);
    await run('DELETE FROM social_profiles WHERE id IN (:a)', { a: Object.values(p) });
    await run('DELETE FROM shows WHERE id = :show', ids);
  });

  test('the seed: old friends follow each other with Lala, feed people follow her one way; again adds nothing; down removes only its rows', async () => {
    expect(await follows.lalaProfile(models)).toBe(p.lala);
    const qi = sequelize.getQueryInterface();
    await seed.up(qi);
    expect((await live(p.friend, p.lala))[0]?.source).toBe('seed_friends');
    expect((await live(p.lala, p.friend))[0]?.source).toBe('seed_friends');
    expect((await live(p.crossed, p.lala))[0]?.source).toBe('auto_feed');
    expect(await live(p.lala, p.crossed)).toHaveLength(0);
    expect(await live(p.stranger, p.lala)).toHaveLength(0);
    const [[before]] = await run("SELECT COUNT(*)::int AS n FROM pulse_follows WHERE created_by = 'migration:20261019190001'");
    await seed.up(qi);
    const [[again]] = await run("SELECT COUNT(*)::int AS n FROM pulse_follows WHERE created_by = 'migration:20261019190001'");
    expect(again.n).toBe(before.n);

    // A follow Evoni set stays when the seed is undone.
    await follows.follow(models, p.stranger, p.lala, { source: 'evoni', by: 'test' });
    await seed.down(qi);
    expect(await live(p.friend, p.lala)).toHaveLength(0);
    expect((await live(p.stranger, p.lala))[0]?.source).toBe('evoni');
    await follows.unfollow(models, p.stranger, p.lala);
    await seed.up(qi);
  });

  test('crossing from the feed: they follow Lala, Lala does not follow back', async () => {
    const res = await as(admin, request(app).post(`/api/v1/social-profiles/${p.maren}/cross`).send({ show_id: ids.show, registry_id: ids.reg }));
    expect(res.status).toBe(200);
    expect(res.body.followed_lala).toBe(1);
    expect((await live(p.maren, p.lala))[0]?.source).toBe('auto_feed');
    expect(await live(p.lala, p.maren)).toHaveLength(0);
    expect(await follows.relationToLala(models, p.maren)).toEqual({ follows_lala: true, lala_follows: false, friends: false });
  });

  // created_from (Evoni, 2026-10-19): only someone made from the feed follows
  // Lala on their own; a "Make one for me" person crossed later does not.
  test('a character made some other way does not follow Lala when its profile is crossed', async () => {
    expect(await follows.followLalaFromFeed(models, [p.made])).toBe(0);
    expect(await live(p.made, p.lala)).toHaveLength(0);
    // Their origin is what decides: recorded as from the feed, they follow her.
    await run("UPDATE registry_characters SET created_from = 'feed_cross' WHERE feed_profile_id = :id", { id: p.made });
    expect(await follows.followLalaFromFeed(models, [p.made])).toBe(1);
    expect((await live(p.made, p.lala))[0]?.source).toBe('auto_feed');
  });

  test('Evoni sets either direction; friends are both; anyone else is refused', async () => {
    expect((await as(editor, request(app).put(`/api/v1/pulse-follows/${p.maren}/lala-follows`))).status).toBe(403);
    expect((await as(editor, request(app).delete(`/api/v1/pulse-follows/${p.maren}/follows-lala`))).status).toBe(403);
    expect(await live(p.lala, p.maren)).toHaveLength(0);

    const on = await as(admin, request(app).put(`/api/v1/pulse-follows/${p.maren}/lala-follows`));
    expect(on.status).toBe(200);
    expect(on.body.data).toEqual({ follows_lala: true, lala_follows: true, friends: true });
    expect((await live(p.lala, p.maren))[0]?.source).toBe('evoni');
    // Twice is the same follow.
    expect((await as(admin, request(app).put(`/api/v1/pulse-follows/${p.maren}/lala-follows`))).status).toBe(200);
    expect(await live(p.lala, p.maren)).toHaveLength(1);

    const friends = await follows.friendsOfLala(models);
    expect(friends.list.map((f) => f.id)).toEqual(expect.arrayContaining([p.friend, p.maren]));
    expect(friends.list.map((f) => f.id)).not.toContain(p.crossed);   // follows her, she doesn't follow back

    const off = await as(admin, request(app).delete(`/api/v1/pulse-follows/${p.maren}/follows-lala`));
    expect(off.body.data).toEqual({ follows_lala: false, lala_follows: true, friends: false });
    expect((await follows.friendsOfLala(models)).list.map((f) => f.id)).not.toContain(p.maren);

    expect((await as(admin, request(app).put(`/api/v1/pulse-follows/${p.lala}/lala-follows`))).status).toBe(400);
    expect((await as(admin, request(app).put('/api/v1/pulse-follows/0/lala-follows'))).status).toBe(400);
  });

  test("Lala's Pulse profile reads her friends from the follows", async () => {
    const res = await as(editor, request(app).get(`/api/v1/social-profiles/lala?show_id=${ids.show}&friends=all`));
    expect(res.status).toBe(200);
    const listed = res.body.data.friends.list.map((f) => f.id);
    expect(listed).toContain(p.friend);
    expect(listed).not.toContain(p.crossed);
  });

  // Real handles are stored with their "@" (Evoni's live 404s, 2026-10-19:
  // /pulse-follows/profile/studiobysable). The URL may carry it or not.
  test('a profile stored as "@handle" is found with or without the @, and its media too', async () => {
    for (const h of [`sable-${tag}`, `@sable-${tag}`, `SABLE-${tag}`]) {
      const res = await as(editor, request(app).get(`/api/v1/pulse-follows/profile/${encodeURIComponent(h)}?show_id=${ids.show}`));
      expect(res.status).toBe(200);
      expect(res.body.data.profile.handle).toBe(`sable-${tag}`);
    }
    expect((await as(editor, request(app).get(`/api/v1/pulse-follows/profile/sable-${tag}/media`))).status).toBe(200);
    expect((await as(editor, request(app).get(`/api/v1/pulse-follows/profile/nobody-${tag}`))).status).toBe(404);
  });

  test('a profile read: who they are, their audience number, the relation; the character id for an admin only', async () => {
    expect((await request(app).get(`/api/v1/pulse-follows/profile/maren-${tag}`)).status).toBe(401);
    const res = await as(editor, request(app).get(`/api/v1/pulse-follows/profile/@maren-${tag}?show_id=${ids.show}`));
    expect(res.status).toBe(200);
    expect(res.body.data.profile).toMatchObject({ id: p.maren, handle: `maren-${tag}`, display_name: 'maren', bio: 'baker and early riser', city: 'velour_city' });
    expect(res.body.data.relation).toEqual({ follows_lala: false, lala_follows: true, friends: false });
    expect(res.body.data.is_lala).toBe(false);
    expect(res.body.data).not.toHaveProperty('character_id');
    const asAdmin = await as(admin, request(app).get(`/api/v1/pulse-follows/profile/maren-${tag}`));
    expect(asAdmin.body.data.character_id).toEqual(expect.any(String));
    expect((await as(editor, request(app).get(`/api/v1/pulse-follows/profile/lala-${tag}`))).body.data.is_lala).toBe(true);
    expect((await as(editor, request(app).get('/api/v1/pulse-follows/profile/nobody-here-zz'))).status).toBe(404);
    expect((await as(editor, request(app).get('/api/v1/pulse-follows/profile/maren?show_id=nope'))).status).toBe(400);
  });
});
