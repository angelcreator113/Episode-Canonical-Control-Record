/**
 * The feed ripple is an ADMIN's (Evoni, 2026-11-16), against the test database.
 *
 * POST /api/v1/feed-enhanced/post/:postId/ripple writes reply posts on The
 * Pulse for a viral post (services/feedEngagementService generateRippleEffects)
 * and marks that post with its thread and ripple. A reply follows its parent:
 * live under a live post, a draft under a draft, and a draft for Review when
 * it is about Lala. Any signed-in account could send it, so a viewer or an
 * editor could publish live posts.
 *
 * Now: no token 401; a viewer or an editor 403, refused before the handler,
 * so no reply is made (draft or live) and the post is not touched; an ADMIN
 * as before, with the same status rules. The engine, its templates and the
 * release logic are not changed.
 */
jest.unmock('uuid');

const request = require('supertest');
const crypto = require('crypto');
const app = require('../../src/app');
const TokenService = require('../../src/services/tokenService');
const models = require('../../src/models');
const engagement = require('../../src/services/feedEngagementService');

const { sequelize } = models;

const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

(shouldSkip ? describe.skip : describe)('the feed ripple is an ADMIN\'s', () => {
  const tag = crypto.randomUUID().slice(0, 8);
  const showId = crypto.randomUUID();
  const tokens = {};
  const reactors = [];
  const parents = [];
  let ipN = 0;
  const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });
  const ripple = (who, postId) => {
    ipN += 1;
    const r = request(app).post(`/api/v1/feed-enhanced/post/${postId}/ripple`).set('X-Forwarded-For', `198.51.170.${(ipN % 200) + 1}`);
    return tokens[who] ? r.set('Authorization', `Bearer ${tokens[who]}`) : r;
  };
  // A post well past the viral threshold, by someone who is not Lala.
  const parent = async (status, handle = `maya${tag}`) => {
    const row = await models.FeedPost.create({
      show_id: showId, poster_handle: handle, poster_platform: 'lalaverse', post_type: 'post', content_text: `big night ${tag}`,
      status, posted_at: new Date(), likes: 50000, comments_count: 900, shares: 3000, sample_comments: [], sort_order: 0,
    });
    parents.push(row.id);
    return row.id;
  };
  // Everything a ripple could change: every post of the show, and the parent's own row.
  const state = async () => (await run(
    `SELECT id, status, parent_post_id, thread_id, ripple_effect, updated_at FROM feed_posts WHERE show_id = :showId ORDER BY id`, { showId }))[0];
  const repliesOf = async (id) => (await run('SELECT status, content_text, parent_post_id, thread_id, generation_model FROM feed_posts WHERE parent_post_id = :id', { id }))[0];

  beforeAll(async () => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    const token = (id, groups, role) => TokenService.generateTokenPair({ id, email: `${id}@ripple.dev`, name: id, groups, role }).accessToken;
    tokens.viewer = token(`viewer-${tag}`, ['viewer'], 'USER');
    tokens.editor = token(`editor-${tag}`, ['USER', 'EDITOR'], 'USER');
    tokens.admin = token(`admin-${tag}`, ['ADMIN'], 'ADMIN');
    await run('INSERT INTO shows (id, name, slug, created_at, updated_at) VALUES (:showId, :name, :slug, NOW(), NOW())', { showId, name: `Ripple ${tag}`, slug: `ripple-${tag}` });
    for (const archetype of ['chaos_creator', 'the_peer', 'polished_curator']) {
      const [[row]] = await run(`INSERT INTO social_profiles (handle, platform, vibe_sentence, display_name, feed_layer, status, archetype, created_at, updated_at)
        VALUES (:handle, 'instagram', 'test', :handle, 'lalaverse', 'finalized', :archetype, NOW(), NOW()) RETURNING id`,
      { handle: `rip${archetype.slice(0, 4)}${tag}`, archetype });
      reactors.push(row.id);
    }
  });

  afterAll(async () => {
    await run('DELETE FROM feed_posts WHERE show_id = :showId', { showId });
    await run('DELETE FROM social_profiles WHERE id IN (:ids)', { ids: reactors });
    await run('DELETE FROM shows WHERE id = :showId', { showId });
  });

  afterEach(() => { jest.restoreAllMocks(); jest.spyOn(console, 'log').mockImplementation(() => {}); });

  test('no token: 401 for a live post and a draft one; the engine is not run and nothing changes', async () => {
    const live = await parent('live');
    const draft = await parent('draft');
    const engine = jest.spyOn(engagement, 'generateRippleEffects');
    const before = await state();
    for (const id of [live, draft]) expect([id, (await ripple('anon', id)).status]).toEqual([id, 401]);
    expect(engine).not.toHaveBeenCalled();
    expect(await state()).toEqual(before);
  });

  describe.each(['viewer', 'editor'])('%s', (who) => {
    test('403 for a live post and a draft one, however often; no reply is made, live or draft, and the post is not marked', async () => {
      const live = await parent('live');
      const draft = await parent('draft');
      const engine = jest.spyOn(engagement, 'generateRippleEffects');
      const before = await state();
      for (let i = 0; i < 3; i += 1) {
        for (const id of [live, draft]) {
          const res = await ripple(who, id);
          expect([id, res.status]).toEqual([id, 403]);
          expect(res.body.data).toBeUndefined();
          expect(res.body.success).not.toBe(true);
        }
      }
      expect(engine).not.toHaveBeenCalled();
      expect(await state()).toEqual(before);
      for (const id of [live, draft]) expect(await repliesOf(id)).toEqual([]);
      // A post that does not exist says nothing either: the same refusal, before any lookup.
      expect((await ripple(who, crypto.randomUUID())).status).toBe(403);
    });
  });

  describe('an ADMIN: as before', () => {
    // Every reactor posts, and the reactors are the three seeded ones (the engine picks any finalized profiles at random).
    const fixed = async () => {
      jest.spyOn(Math, 'random').mockReturnValue(0.1);
      jest.spyOn(models.SocialProfile, 'findAll').mockResolvedValue(await models.SocialProfile.findAll({ where: { id: reactors } }));
    };

    test('a live post: its replies are made and are live, in its thread, and the post is marked', async () => {
      const live = await parent('live');
      await fixed();
      const res = await ripple('admin', live);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      const replies = await repliesOf(live);
      expect(replies).toHaveLength(3);
      expect(replies.every((r) => r.status === 'live')).toBe(true);
      expect(replies.every((r) => r.thread_id === live && r.generation_model === 'ripple_engine')).toBe(true);
      const [[marked]] = await run('SELECT thread_id, ripple_effect FROM feed_posts WHERE id = :id', { id: live });
      expect(marked.thread_id).toBe(live);
      expect(marked.ripple_effect).toMatchObject({ spawned_posts: 3 });
    });

    test('a draft post: its replies are drafts, and go live with it, not before', async () => {
      const draft = await parent('draft');
      await fixed();
      const res = await ripple('admin', draft);
      expect(res.status).toBe(200);
      const replies = await repliesOf(draft);
      expect(replies).toHaveLength(3);
      expect(replies.every((r) => r.status === 'draft')).toBe(true);
    });

    test('a live post by Lala: a reply that names her waits in Review as a draft; the rule is the engine\'s, unchanged', async () => {
      const lala = await parent('live', 'lala');
      await fixed();
      const res = await ripple('admin', lala);
      expect(res.status).toBe(200);
      const replies = await repliesOf(lala);
      expect(replies).toHaveLength(3);
      const naming = replies.filter((r) => r.content_text.includes('@lala'));
      expect(naming.length).toBeGreaterThan(0);
      expect(naming.every((r) => r.status === 'draft')).toBe(true);
    });

    test('a post under the viral threshold makes nothing, as before', async () => {
      const quiet = await models.FeedPost.create({
        show_id: showId, poster_handle: `quiet${tag}`, poster_platform: 'lalaverse', post_type: 'post', content_text: 'hello',
        status: 'live', posted_at: new Date(Date.now() - 48 * 3600e3), likes: 1, comments_count: 0, shares: 0, sample_comments: [], sort_order: 0,
      });
      const res = await ripple('admin', quiet.id);
      expect(res.status).toBe(200);
      expect(res.body.data.ripples).toEqual([]);
      expect(await repliesOf(quiet.id)).toEqual([]);
    });
  });

  test('no other route runs the ripple: one caller of the engine, on one route, an ADMIN\'s', () => {
    const fs = require('fs');
    const path = require('path');
    const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]));
    const src = path.join(__dirname, '../../src');
    const users = walk(src).filter((f) => f.endsWith('.js') && /generateRippleEffects/.test(fs.readFileSync(f, 'utf8'))).map((f) => path.relative(src, f)).sort();
    expect(users).toEqual(['routes/feedEnhancedRoutes.js', 'services/feedEngagementService.js']);
    const routes = fs.readFileSync(path.join(src, 'routes/feedEnhancedRoutes.js'), 'utf8');
    expect(routes.match(/generateRippleEffects\(/g)).toHaveLength(1);
    expect(routes).toMatch(/router\.post\('\/post\/:postId\/ripple', requireAuth, authorize\(\['ADMIN'\]\), aiRateLimiter,/);
    // And it is a write on one method only: no GET, PUT or PATCH reaches it.
    expect(routes.match(/router\.\w+\('\/post\/:postId\/ripple'/g)).toHaveLength(1);
  });
});
