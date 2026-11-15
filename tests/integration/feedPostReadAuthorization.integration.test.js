/**
 * Who reads unpublished Pulse posts (Evoni, 2026-11-15).
 *
 * The feed's read routes are open to anyone (optionalAuth), and they used to
 * honour ?status=draft and ?status=all from a request with no token: draft
 * and scheduled posts, and draft comments, were readable by anyone who knew
 * a show, episode or post id. Five routes:
 *
 *   GET /api/v1/feed-posts                    (the list; ?status=)
 *   GET /api/v1/feed-posts/:showId/timeline   (?status=)
 *   GET /api/v1/feed-posts/post/:postId       (one post; it had no status test)
 *   GET /api/v1/feed-posts/:postId/comments   (?status=)
 *   GET /api/v1/feed-posts/episode/:episodeId (drafts by default)
 *
 * Now: live posts stay public; unpublished ones are an ADMIN's. A post and a
 * comment record no author account, so nobody else has "their own" drafts:
 * a signed-in user who is not an ADMIN reads what an anonymous reader does,
 * even a post they created. Counts and pages are of what the reader may see,
 * and an unpublished post's id answers as an unknown id does.
 */
jest.unmock('uuid');

const request = require('supertest');
const crypto = require('crypto');
const app = require('../../src/app');
const TokenService = require('../../src/services/tokenService');
const models = require('../../src/models');
const { readableStatusWhere, statusWhere } = require('../../src/services/feedPostStatus');

const { sequelize } = models;

const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });
const SECRET = 'UNPUBLISHED-SENTINEL-7f3a';

describe('readableStatusWhere', () => {
  it('someone who may read unpublished posts gets what statusWhere gives', () => {
    for (const s of [undefined, '', 'live', 'draft', 'all']) expect(readableStatusWhere(s, true)).toEqual(statusWhere(s));
  });
  it('anyone else reads live only: all is the live ones, draft is none', () => {
    for (const s of [undefined, null, '', 'live', 'all']) expect(readableStatusWhere(s, false)).toEqual({ status: 'live' });
    const none = readableStatusWhere('draft', false);
    expect(Object.getOwnPropertySymbols(none.status)).toHaveLength(1);
    expect(none.status[Object.getOwnPropertySymbols(none.status)[0]]).toEqual([]);
  });
  it('an unknown status is still refused, for everyone, and only true opens anything', () => {
    for (const can of [true, false, undefined]) expect(readableStatusWhere('scheduled', can)).toEqual({ error: 'status must be draft, live or all' });
    for (const can of [undefined, null, 'yes', 1, {}]) expect(readableStatusWhere('all', can)).toEqual({ status: 'live' });
  });
});

(shouldSkip ? describe.skip : describe)('reading unpublished feed posts', () => {
  const showId = crypto.randomUUID();
  const episodeId = crypto.randomUUID();
  const ids = {};
  const tokens = {};
  let n = 0;

  const token = (user) => TokenService.generateTokenPair(user).accessToken;
  // Each kind of reader, with its own address so one test's requests do not use up another's rate limit.
  const as = (who) => (r) => {
    n += 1;
    const req = r.set('X-Forwarded-For', `10.83.${Math.floor(n / 250)}.${(n % 250) + 1}`);
    return tokens[who] ? req.set('Authorization', `Bearer ${tokens[who]}`) : req;
  };
  const READERS = ['anonymous', 'user', 'creator'];
  const get = (who, url) => as(who)(request(app).get(url));
  const idsOf = (res) => (res.body.data || []).map((p) => p.id).sort();
  const sorted = (...list) => [...list].sort();

  beforeAll(async () => {
    tokens.admin = token({ id: 'test-admin-feed-read', email: 'admin@feed.dev', name: 'Admin', groups: ['ADMIN'], role: 'ADMIN' });
    tokens.user = token({ id: 'test-user-feed-read', email: 'user@feed.dev', name: 'Unrelated', groups: ['USER', 'EDITOR'], role: 'USER' });
    tokens.creator = token({ id: 'test-creator-feed-read', email: 'creator@feed.dev', name: 'Creator', groups: ['USER', 'EDITOR'], role: 'USER' });
    await run(`INSERT INTO shows (id, name, slug, created_at, updated_at) VALUES (:id, :name, :slug, NOW(), NOW())`,
      { id: showId, name: `Read ${showId.slice(0, 8)}`, slug: `rd-${showId.slice(0, 8)}` });
    // The server decides the story moment a reader who is not an ADMIN reads at (2026-11-15, pulseReaderStoryMoment).
    // This suite is about drafts and live posts, so its episode is out: its live posts are released.
    await run(`INSERT INTO episodes (id, show_id, title, episode_number, status, created_at, updated_at) VALUES (:id, :showId, 'Gala Night', 1, 'published', NOW(), NOW())`,
      { id: episodeId, showId });
    const post = (fields) => models.FeedPost.create({ show_id: showId, poster_handle: 'lala', poster_display_name: 'Lala', ...fields });
    ids.live = (await post({ status: 'live', content_text: 'Out in the world.', posted_at: new Date(), episode_id: episodeId, likes: 3 })).id;
    ids.live2 = (await post({ status: 'live', content_text: 'Also out.', posted_at: new Date(Date.now() - 1000) })).id;
    ids.draft = (await post({ status: 'draft', content_text: `${SECRET} wall draft` })).id;
    ids.scheduled = (await post({ status: 'draft', release_state: 'scheduled', release_at: new Date(Date.now() + 864e5), content_text: `${SECRET} scheduled`, episode_id: episodeId, likes: 900 })).id;
    ids.held = (await post({ status: 'draft', release_state: 'held', content_text: `${SECRET} held`, episode_id: episodeId })).id;
    const comment = (fields) => models.FeedComment.create({ show_id: showId, handle: 'nia', display_name: 'Nia', ...fields });
    ids.liveComment = (await comment({ feed_post_id: ids.live, text: 'Lovely.', status: 'live' })).id;
    ids.draftComment = (await comment({ feed_post_id: ids.live, text: `${SECRET} draft comment`, status: 'draft' })).id;
    ids.commentOnDraft = (await comment({ feed_post_id: ids.draft, text: `${SECRET} comment on a draft`, status: 'live' })).id;
    // A post this non-admin made through the app's own write route. Nothing records who made it.
    const made = await as('creator')(request(app).post('/api/v1/feed-posts')).send({ show_id: showId, content_text: `${SECRET} made by a non-admin`, poster_handle: 'lala' });
    if (made.status < 300 && made.body?.data?.id) ids.made = made.body.data.id;
  });

  afterAll(async () => {
    await run(`DELETE FROM feed_comments WHERE show_id = :showId`, { showId }).catch(() => {});
    await run(`DELETE FROM feed_posts WHERE show_id = :showId`, { showId });
    await run(`DELETE FROM episodes WHERE id = :episodeId`, { episodeId });
    await run(`DELETE FROM shows WHERE id = :showId`, { showId });
  });

  const unpublished = () => [ids.draft, ids.scheduled, ids.held, ids.made].filter(Boolean);
  const clean = (res) => {
    const body = JSON.stringify(res.body);
    expect(body).not.toContain(SECRET);
    for (const id of unpublished()) expect(body).not.toContain(id);
    expect(body).not.toContain(ids.draftComment);
    expect(body).not.toContain(ids.commentOnDraft);
  };

  describe('the list', () => {
    it.each(READERS)('%s: live posts whatever status is asked for; the count and the page are of those', async (who) => {
      for (const status of ['', '&status=live', '&status=all']) {
        const res = await get(who, `/api/v1/feed-posts?show_id=${showId}${status}`);
        expect(res.status).toBe(200);
        expect(idsOf(res)).toEqual(sorted(ids.live, ids.live2));
        expect(res.body).toMatchObject({ count: 2, total: 2, hasMore: false });
        clean(res);
      }
      const drafts = await get(who, `/api/v1/feed-posts?show_id=${showId}&status=draft`);
      expect(drafts.status).toBe(200);
      expect(drafts.body).toMatchObject({ data: [], count: 0, total: 0, hasMore: false });
      clean(drafts);
    });

    it.each(READERS)('%s: paging through "all" never reaches an unpublished post, nor counts one', async (who) => {
      const first = await get(who, `/api/v1/feed-posts?show_id=${showId}&status=all&limit=1`);
      expect(first.body).toMatchObject({ count: 1, total: 2, hasMore: true });
      const second = await get(who, `/api/v1/feed-posts?show_id=${showId}&status=all&limit=1&offset=1`);
      expect(second.body).toMatchObject({ count: 1, total: 2, hasMore: false });
      const third = await get(who, `/api/v1/feed-posts?show_id=${showId}&status=all&limit=1&offset=2`);
      expect(third.body).toMatchObject({ data: [], count: 0, total: 2, hasMore: false });
      for (const res of [first, second, third]) clean(res);
    });

    it.each(READERS)('%s: the other filters do not open it (from, episode_id, with=comments, the day window)', async (who) => {
      const day = `day_from=${encodeURIComponent(new Date(Date.now() - 3 * 864e5).toISOString())}&day_to=${encodeURIComponent(new Date(Date.now() + 3 * 864e5).toISOString())}`;
      for (const q of [
        `show_id=${showId}&status=draft&from=wall`, `show_id=${showId}&status=draft&from=episode`, `show_id=${showId}&status=all&from=episode`,
        `show_id=${showId}&episode_id=${episodeId}&status=all&with=comments&limit=30`, `show_id=${showId}&status=all&with=comments`, `show_id=${showId}&status=all&${day}`,
      ]) {
        const res = await get(who, `/api/v1/feed-posts?${q}`);
        expect(res.status).toBe(200);
        clean(res);
        expect(res.body.total).toBe(res.body.data.length);
      }
    });

    it('an ADMIN reads drafts, scheduled and held posts as before, with their counts', async () => {
      const all = await get('admin', `/api/v1/feed-posts?show_id=${showId}&status=all`);
      expect(idsOf(all)).toEqual(sorted(ids.live, ids.live2, ...unpublished()));
      expect(all.body.total).toBe(2 + unpublished().length);
      const drafts = await get('admin', `/api/v1/feed-posts?show_id=${showId}&status=draft`);
      expect(idsOf(drafts)).toEqual(sorted(...unpublished()));
      expect(drafts.body.total).toBe(unpublished().length);
      const live = await get('admin', `/api/v1/feed-posts?show_id=${showId}`);
      expect(idsOf(live)).toEqual(sorted(ids.live, ids.live2));
      const fromEpisode = await get('admin', `/api/v1/feed-posts?show_id=${showId}&status=draft&from=episode`);
      expect(idsOf(fromEpisode)).toEqual(sorted(ids.scheduled, ids.held));
    });

    it('a status that is not one is refused for everyone, with nothing in the answer', async () => {
      for (const who of [...READERS, 'admin']) {
        const res = await get(who, `/api/v1/feed-posts?show_id=${showId}&status=scheduled`);
        expect(res.status).toBe(400);
        clean(res);
      }
    });
  });

  describe('the timeline', () => {
    it.each(READERS)('%s: live only, with a count of the live ones', async (who) => {
      for (const status of ['', '?status=all', '?status=draft']) {
        const res = await get(who, `/api/v1/feed-posts/${showId}/timeline${status}`);
        expect(res.status).toBe(200);
        const want = status === '?status=draft' ? [] : sorted(ids.live, ids.live2);
        expect(idsOf(res)).toEqual(want);
        expect(res.body).toMatchObject({ count: want.length, total: want.length, hasMore: false });
        clean(res);
      }
    });
    it('an ADMIN: as before', async () => {
      const res = await get('admin', `/api/v1/feed-posts/${showId}/timeline?status=all`);
      expect(idsOf(res)).toEqual(sorted(ids.live, ids.live2, ...unpublished()));
      expect(res.body.total).toBe(2 + unpublished().length);
    });
  });

  describe('one post by its id', () => {
    it.each(READERS)('%s: an unpublished post answers exactly as an id that does not exist', async (who) => {
      const missing = await get(who, `/api/v1/feed-posts/post/${crypto.randomUUID()}`);
      expect(missing.status).toBe(404);
      for (const id of unpublished()) {
        const res = await get(who, `/api/v1/feed-posts/post/${id}`);
        expect(res.status).toBe(404);
        expect(res.body).toEqual(missing.body);
        expect(res.headers['content-length']).toBe(missing.headers['content-length']);
      }
      const live = await get(who, `/api/v1/feed-posts/post/${ids.live}`);
      expect(live.status).toBe(200);
      expect(live.body.data.id).toBe(ids.live);
      // Its live comment, and not its draft one.
      expect((live.body.data.comments || []).map((c) => c.id)).toEqual([ids.liveComment]);
      clean(live);
    });
    it('an ADMIN reads a draft by its id', async () => {
      for (const id of unpublished()) {
        const res = await get('admin', `/api/v1/feed-posts/post/${id}`);
        expect(res.status).toBe(200);
        expect(res.body.data.id).toBe(id);
      }
    });
  });

  describe('a post\'s comments', () => {
    it.each(READERS)('%s: live comments of a live post; a draft comment and an unpublished post\'s comments are not there', async (who) => {
      for (const status of ['', '?status=live', '?status=all']) {
        const res = await get(who, `/api/v1/feed-posts/${ids.live}/comments${status}`);
        expect(res.status).toBe(200);
        expect(res.body.data.map((c) => c.id)).toEqual([ids.liveComment]);
        expect(res.body.count).toBe(1);
        clean(res);
      }
      const drafts = await get(who, `/api/v1/feed-posts/${ids.live}/comments?status=draft`);
      expect(drafts.body).toEqual({ data: [], count: 0 });
      // An unpublished post's comments answer as an unknown post's do.
      const unknown = await get(who, `/api/v1/feed-posts/${crypto.randomUUID()}/comments?status=all`);
      for (const status of ['', '?status=all', '?status=draft']) {
        const res = await get(who, `/api/v1/feed-posts/${ids.draft}/comments${status}`);
        expect(res.status).toBe(200);
        expect(res.body).toEqual(unknown.body);
        clean(res);
      }
    });
    it('an ADMIN: draft comments, and the comments of a draft, as before', async () => {
      const all = await get('admin', `/api/v1/feed-posts/${ids.live}/comments?status=all`);
      expect(all.body.data.map((c) => c.id).sort()).toEqual(sorted(ids.liveComment, ids.draftComment));
      const drafts = await get('admin', `/api/v1/feed-posts/${ids.live}/comments?status=draft`);
      expect(drafts.body.data.map((c) => c.id)).toEqual([ids.draftComment]);
      const onDraft = await get('admin', `/api/v1/feed-posts/${ids.draft}/comments`);
      expect(onDraft.body.data.map((c) => c.id)).toEqual([ids.commentOnDraft]);
    });
  });

  describe('an episode\'s posts', () => {
    it.each(READERS)('%s: its live posts by default and whatever is asked; the groups and totals are of those', async (who) => {
      for (const status of ['', '?status=all', '?status=live']) {
        const res = await get(who, `/api/v1/feed-posts/episode/${episodeId}${status}`);
        expect(res.status).toBe(200);
        expect(idsOf(res)).toEqual([ids.live]);
        expect(res.body.count).toBe(1);
        // The scheduled draft's 900 likes are not in the total.
        expect(res.body.stats.total_likes).toBe(3);
        expect(Object.values(res.body.grouped).flat().map((p) => p.id).filter(Boolean).every((id) => id === ids.live)).toBe(true);
        clean(res);
      }
      const drafts = await get(who, `/api/v1/feed-posts/episode/${episodeId}?status=draft`);
      expect(drafts.body.data).toEqual([]);
      expect(drafts.body.count).toBe(0);
      expect(drafts.body.stats.total_likes).toBe(0);
      clean(drafts);
    });
    it('an ADMIN: the episode\'s own view, drafts and live alike, as before', async () => {
      const res = await get('admin', `/api/v1/feed-posts/episode/${episodeId}`);
      expect(idsOf(res)).toEqual(sorted(ids.live, ids.scheduled, ids.held));
      expect(res.body.stats.total_likes).toBe(903);
      const drafts = await get('admin', `/api/v1/feed-posts/episode/${episodeId}?status=draft`);
      expect(idsOf(drafts)).toEqual(sorted(ids.scheduled, ids.held));
    });
  });

  it('a non-admin who made a post has no more reach to it than anyone: nothing records an author', async () => {
    // The write went through (the route needs only a signed-in user); it is a draft.
    expect(ids.made).toBeTruthy();
    const row = await models.FeedPost.findByPk(ids.made);
    expect(row.status).toBe('draft');
    expect((await get('creator', `/api/v1/feed-posts/post/${ids.made}`)).status).toBe(404);
    expect(idsOf(await get('creator', `/api/v1/feed-posts?show_id=${showId}&status=draft`))).toEqual([]);
    expect((await get('admin', `/api/v1/feed-posts/post/${ids.made}`)).status).toBe(200);
  });

  it('a token that cannot be read is an anonymous reader, not an error that says more', async () => {
    n += 1;
    const res = await request(app).get(`/api/v1/feed-posts?show_id=${showId}&status=all`).set('X-Forwarded-For', `10.83.9.${n % 250}`).set('Authorization', 'Bearer not-a-token');
    if (res.status === 200) { expect(idsOf(res)).toEqual(sorted(ids.live, ids.live2)); expect(res.body.total).toBe(2); }
    else expect(res.status).toBe(401);
    clean(res);
  });
});
