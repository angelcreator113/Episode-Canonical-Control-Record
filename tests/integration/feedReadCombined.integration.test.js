/**
 * The two feed-read rules together (Evoni, 2026-11-16), against the test
 * database: the public-field allow-list (services/publicFeedPost) and the
 * server-decided story moment (services/storyClock readerAt), on one read.
 *
 * Each rule has its own suite (feedPostPublicFields, pulseReaderStoryMoment).
 * This one reads the same four endpoints as each of the four readers and holds
 * both at once: a reader who is not an ADMIN gets released posts only, cut to
 * the public fields, a first look as a first look, counts and paging of those,
 * and nothing of another show; an ADMIN previews any moment with the studio's
 * fields.
 *
 * The show has episode 1 published and episode 2 not. Posts: early (released,
 * carrying studio-only words), later (episode 2), hidden and first look (by a
 * reveal that lifts later), and one in another show.
 */
jest.unmock('uuid');

const request = require('supertest');
const crypto = require('crypto');
const app = require('../../src/app');
const TokenService = require('../../src/services/tokenService');
const models = require('../../src/models');
const clock = require('../../src/services/storyClock');
const { PUBLIC_POST_FIELDS, PUBLIC_COMMENT_FIELDS, PUBLIC_PHOTO_FIELDS } = require('../../src/services/publicFeedPost');

const { sequelize } = models;

const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

(shouldSkip ? describe.skip : describe)('Feed reads: public fields and the server\'s story moment together', () => {
  const tag = crypto.randomUUID().slice(0, 8);
  const uuid = () => crypto.randomUUID();
  const ids = { show: uuid(), other: uuid(), ep1: uuid(), ep2: uuid(), otherEp: uuid() };
  const post = {}; const comment = {}; const tokens = {};
  let pid;
  let ipN = 0;
  const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });
  const EARLY = clock.orderOf(1, 'during_episode');
  const LATER = clock.orderOf(2, 'during_episode');
  const STUDIO = `studio-only-${tag}`;
  const get = (who, path) => {
    ipN += 1;
    const r = request(app).get(path).set('X-Forwarded-For', `198.51.141.${(ipN % 200) + 1}`);
    return tokens[who] ? r.set('Authorization', `Bearer ${tokens[who]}`) : r;
  };
  const idsOf = (res) => res.body.data.map((p) => p.id).sort();
  const RELEASED = () => [post.early, post.teaser].sort();
  const ALL = () => [post.early, post.teaser, post.hidden, post.later].sort();
  // What only the studio reads, and what the story has not released.
  const STUDIO_KEYS = ['episode_id', 'story_order', 'timeline_position', 'narrative_function', 'lala_internal_thought', 'lala_reaction', 'is_viral', 'viral_reach', 'beats'];
  const UNRELEASED = ['later words', 'hidden words', 'teaser words', 'elsewhere words', 'onLater reply', 'onEarlyLater reply', 'onTeaser reply'];
  const holdsBoth = (body) => {
    const raw = JSON.stringify(body);
    expect(raw).not.toContain(STUDIO);
    for (const gone of UNRELEASED) expect([gone, raw.includes(gone)]).toEqual([gone, false]);
  };
  const PAST = ['', `at=${LATER}`, 'at=ep:2:week_later', 'at=ep:99:week_later'];

  beforeAll(async () => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    const token = (id, groups, role) => TokenService.generateTokenPair({ id, email: `${id}@both.dev`, name: id, groups, role }).accessToken;
    tokens.viewer = token(`viewer-${tag}`, ['viewer'], 'USER');
    tokens.editor = token(`editor-${tag}`, ['USER', 'EDITOR'], 'USER');
    tokens.admin = token(`admin-${tag}`, ['ADMIN'], 'ADMIN');
    for (const [id, name] of [[ids.show, 'Both'], [ids.other, 'Elseboth']]) {
      await run('INSERT INTO shows (id, name, slug, created_at, updated_at) VALUES (:id, :name, :slug, NOW(), NOW())', { id, name: `${name} ${tag}`, slug: `${name.toLowerCase()}-${tag}` });
    }
    await run(`INSERT INTO episodes (id, show_id, title, episode_number, status, created_at, updated_at) VALUES
                 (:ep1, :show, 'One', 1, 'published', NOW(), NOW()), (:ep2, :show, 'Two', 2, 'draft', NOW(), NOW()),
                 (:otherEp, :other, 'Other one', 1, 'published', NOW(), NOW())`, ids);
    pid = (await run(`INSERT INTO social_profiles (handle, platform, vibe_sentence, feed_layer, display_name, created_at, updated_at)
                      VALUES (:h, 'pulse', 'Posts.', 'lalaverse', :name, NOW(), NOW()) RETURNING id`, { h: `both.${tag}`, name: `Both ${tag}` }))[0][0].id;
    const makePost = async (name, { show = ids.show, episode, order }) => {
      post[name] = uuid();
      await run(`INSERT INTO feed_posts (id, show_id, episode_id, social_profile_id, poster_handle, content_text, status, story_order, timeline_position, posted_at, likes,
                                         narrative_function, lala_internal_thought, lala_reaction, created_at, updated_at)
                 VALUES (:id, :show, :episode, :pid, :h, :text, 'live', :order, 'during_episode', NOW(), 5, :studio, :studio, :studio, NOW(), NOW())`,
      { id: post[name], show, episode, pid, h: `both.${tag}`, text: `${name} words ${tag}`, order, studio: STUDIO });
    };
    await makePost('early', { episode: ids.ep1, order: EARLY });
    await makePost('later', { episode: ids.ep2, order: LATER });
    await makePost('hidden', { episode: ids.ep1, order: EARLY });
    await makePost('teaser', { episode: ids.ep1, order: EARLY });
    await makePost('elsewhere', { show: ids.other, episode: ids.otherEp, order: EARLY });
    const makeComment = async (name, on, order) => {
      comment[name] = uuid();
      await run(`INSERT INTO feed_comments (id, feed_post_id, show_id, social_profile_id, handle, text, status, story_order, sort_order, posted_at, created_at, updated_at)
                 VALUES (:id, :on, :show, :pid, :h, :text, 'live', :order, :sort, NOW(), NOW(), NOW())`,
      { id: comment[name], on: post[on], show: ids.show, pid, h: `both.${tag}`, text: `${name} reply ${tag}`, order, sort: Object.keys(comment).length });
    };
    await makeComment('onEarly', 'early', null);
    await makeComment('onEarlyLater', 'early', LATER);
    await makeComment('onLater', 'later', LATER);
    await makeComment('onTeaser', 'teaser', null);
    const reveal = (name, mode) => run(
      `INSERT INTO pulse_reveals (id, show_id, item_type, item_id, moment, story_order, mode, source, teaser_style, created_at, updated_at)
       VALUES (:id, :show, 'post', :item, 'story_time', :order, :mode, 'set', 'crop', NOW(), NOW())`,
      { id: uuid(), show: ids.show, item: post[name], order: LATER, mode });
    await reveal('hidden', 'hidden');
    await reveal('teaser', 'teaser');
  });

  afterAll(async () => {
    const shows = [ids.show, ids.other];
    await run('DELETE FROM pulse_reveals WHERE show_id IN (:shows)', { shows });
    await run('DELETE FROM feed_comments WHERE show_id IN (:shows)', { shows });
    await run('DELETE FROM feed_posts WHERE show_id IN (:shows)', { shows });
    await run('DELETE FROM social_profiles WHERE id = :pid', { pid });
    await run('DELETE FROM episodes WHERE show_id IN (:shows)', { shows });
    await run('DELETE FROM shows WHERE id IN (:shows)', { shows });
  });

  describe.each(['anon', 'viewer', 'editor'])('%s', (who) => {
    test('the list: released posts, public fields, a first look, counts and paging; whatever moment or filter is sent', async () => {
      for (const at of PAST) {
        const res = await get(who, `/api/v1/feed-posts?show_id=${ids.show}&status=live&with=comments&${at}`);
        expect([at, res.status, idsOf(res)]).toEqual([at, 200, RELEASED()]);
        expect([at, res.body.count, res.body.total, res.body.hasMore]).toEqual([at, 2, 2, false]);
        holdsBoth(res.body);
        const byId = Object.fromEntries(res.body.data.map((p) => [p.id, p]));
        for (const p of res.body.data) {
          for (const key of STUDIO_KEYS) expect([p.id, key, key in p]).toEqual([p.id, key, false]);
          // Nothing but the allow-list's fields and its four cut-down parts (photos, place, socialProfile, comments).
          expect(Object.keys(p).filter((key) => !PUBLIC_POST_FIELDS.includes(key) && !['photos', 'place', 'socialProfile', 'comments'].includes(key))).toEqual([]);
          for (const photo of p.photos || []) expect(Object.keys(photo).filter((k) => !PUBLIC_PHOTO_FIELDS.includes(k))).toEqual([]);
        }
        expect(byId[post.early].content_text).toContain('early words');
        expect(byId[post.early].comments.map((c) => c.id)).toEqual([comment.onEarly]);
        for (const c of byId[post.early].comments) expect(Object.keys(c).every((k) => PUBLIC_COMMENT_FIELDS.includes(k))).toBe(true);
        expect(byId[post.teaser]).toMatchObject({ teaser: true, content_text: null, comments: [] });
      }
      // Paging counts the released posts only.
      const pages = [];
      for (const offset of [0, 1, 2]) {
        const page = await get(who, `/api/v1/feed-posts?show_id=${ids.show}&status=live&limit=1&offset=${offset}&at=${LATER}`);
        expect([offset, page.status, page.body.total, page.body.count]).toEqual([offset, 200, 2, offset < 2 ? 1 : 0]);
        holdsBoth(page.body);
        pages.push(...idsOf(page));
      }
      expect(pages.sort()).toEqual(RELEASED());
      // The studio's filter is not the reader's: it neither narrows nor opens the list.
      const filtered = await get(who, `/api/v1/feed-posts?show_id=${ids.show}&status=live&narrative_function=${encodeURIComponent(STUDIO)}&at=${LATER}`);
      expect([filtered.status, idsOf(filtered)]).toEqual([200, RELEASED()]);
      holdsBoth(filtered.body);
    });

    test('the timeline, a post by its id and its comments hold both rules', async () => {
      for (const at of PAST) {
        const timeline = await get(who, `/api/v1/feed-posts/${ids.show}/timeline?${at}`);
        expect([at, timeline.status, idsOf(timeline), timeline.body.total]).toEqual([at, 200, RELEASED(), 2]);
        holdsBoth(timeline.body);
        for (const p of timeline.body.data) for (const key of STUDIO_KEYS) expect([key, key in p]).toEqual([key, false]);

        const early = await get(who, `/api/v1/feed-posts/post/${post.early}?${at}`);
        expect([at, early.status]).toEqual([at, 200]);
        holdsBoth(early.body);
        for (const key of STUDIO_KEYS) expect([key, key in early.body.data]).toEqual([key, false]);
        expect(early.body.data.comments.map((c) => c.id)).toEqual([comment.onEarly]);
        const teased = await get(who, `/api/v1/feed-posts/post/${post.teaser}?${at}`);
        expect(teased.body.data).toMatchObject({ teaser: true, content_text: null, comments: [] });
        holdsBoth(teased.body);
        for (const name of ['later', 'hidden']) expect([at, name, (await get(who, `/api/v1/feed-posts/post/${post[name]}?${at}`)).status]).toEqual([at, name, 404]);

        const comments = await get(who, `/api/v1/feed-posts/${post.early}/comments?${at}`);
        expect([at, comments.status, comments.body.count, comments.body.data.map((c) => c.id)]).toEqual([at, 200, 1, [comment.onEarly]]);
        for (const c of comments.body.data) expect(Object.keys(c).every((k) => PUBLIC_COMMENT_FIELDS.includes(k))).toBe(true);
        for (const name of ['later', 'hidden', 'teaser']) expect((await get(who, `/api/v1/feed-posts/${post[name]}/comments?${at}`)).body).toEqual({ data: [], count: 0 });
      }
    });

    test('another show stays its own: its post is not in this show\'s reads, and this show\'s are not in its', async () => {
      const mine = await get(who, `/api/v1/feed-posts?show_id=${ids.show}&status=live`);
      expect(idsOf(mine)).not.toContain(post.elsewhere);
      const theirs = await get(who, `/api/v1/feed-posts?show_id=${ids.other}&status=live`);
      expect([theirs.status, idsOf(theirs)]).toEqual([200, [post.elsewhere]]);
      expect(JSON.stringify(theirs.body)).not.toContain(STUDIO);
      expect(JSON.stringify(theirs.body)).not.toMatch(/early words|later words/);
      const timeline = await get(who, `/api/v1/feed-posts/${ids.other}/timeline`);
      expect(idsOf(timeline)).toEqual([post.elsewhere]);
    });
  });

  describe('admin: the preview is unchanged', () => {
    test('no moment is the director\'s view: every post of the show, with the studio\'s fields', async () => {
      const res = await get('admin', `/api/v1/feed-posts?show_id=${ids.show}&status=live`);
      expect([res.status, idsOf(res), res.body.total]).toEqual([200, ALL(), 4]);
      const early = res.body.data.find((p) => p.id === post.early);
      expect(early).toMatchObject({ narrative_function: STUDIO, lala_internal_thought: STUDIO, story_order: EARLY, episode_id: ids.ep1 });
      expect(idsOf(res)).not.toContain(post.elsewhere);
    });

    test('a named moment is read as asked: the present, a later one, and the studio\'s filter', async () => {
      const present = await get('admin', `/api/v1/feed-posts?show_id=${ids.show}&status=live&at=ep:1:after_episode`);
      expect(idsOf(present)).toEqual(RELEASED());
      expect(present.body.data.find((p) => p.id === post.teaser)).toMatchObject({ teaser: true });
      const later = await get('admin', `/api/v1/feed-posts?show_id=${ids.show}&status=live&at=${LATER}`);
      expect(idsOf(later)).toEqual(ALL());
      expect(later.body.data.find((p) => p.id === post.early).narrative_function).toBe(STUDIO);
      const none = await get('admin', `/api/v1/feed-posts?show_id=${ids.show}&status=live&narrative_function=${encodeURIComponent('no such purpose')}`);
      expect(idsOf(none)).toEqual([]);
      const one = await get('admin', `/api/v1/feed-posts/post/${post.later}`);
      expect([one.status, one.body.data.narrative_function]).toEqual([200, STUDIO]);
      const comments = await get('admin', `/api/v1/feed-posts/${post.early}/comments`);
      expect(comments.body.data.map((c) => c.id).sort()).toEqual([comment.onEarly, comment.onEarlyLater].sort());
    });
  });
});
