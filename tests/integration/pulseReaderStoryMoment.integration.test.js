/**
 * The Pulse reads at the server's story moment, not the page's (Evoni's
 * approval of 2026-11-15; services/storyClock readerAt, services/readerMoment),
 * against the test database.
 *
 * Every read took `?at=` as sent: left out there was no story boundary, and a
 * later moment was honoured for anyone. Now anyone but an ADMIN reads at the
 * present at the latest, on every read, whatever is sent or left out; an
 * ADMIN reads as asked, so the director's view and previews work as before.
 *
 * The show has episode 1 published and episode 2 not, so the present is after
 * episode 1. Posts: early (released), later (episode 2), hidden and first look
 * (early, by a reveal that lifts at the later moment), and one in another show.
 */
jest.unmock('uuid');

const request = require('supertest');
const crypto = require('crypto');
const app = require('../../src/app');
const TokenService = require('../../src/services/tokenService');
const models = require('../../src/models');
const clock = require('../../src/services/storyClock');

const { sequelize } = models;

const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

(shouldSkip ? describe.skip : describe)('The Pulse reads at the server\'s story moment', () => {
  const tag = crypto.randomUUID().slice(0, 8);
  const uuid = () => crypto.randomUUID();
  const ids = { show: uuid(), other: uuid(), ep1: uuid(), ep2: uuid(), otherEp: uuid(), fitEarly: uuid(), fitLater: uuid() };
  const post = {}; const comment = {}; const tokens = {};
  let pid;
  let ipN = 0;
  const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });
  const EARLY = clock.orderOf(1, 'during_episode');
  const LATER = clock.orderOf(2, 'during_episode');
  const BEFORE = 'ep:1:before_episode';
  const get = (who, path) => {
    ipN += 1;
    const r = request(app).get(path).set('X-Forwarded-For', `198.51.140.${(ipN % 200) + 1}`);
    return tokens[who] ? r.set('Authorization', `Bearer ${tokens[who]}`) : r;
  };
  const idsOf = (res) => res.body.data.map((p) => p.id).sort();
  // Ways a reader might try to get past the present.
  const PAST = ['', '&at=', `&at=${LATER}`, '&at=ep:2:week_later', '&at=ep:99:week_later', '&at=present'];
  const READERS = ['anon', 'viewer', 'editor'];
  const SIGNED_IN = ['viewer', 'editor'];

  beforeAll(async () => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    const token = (id, groups, role) => TokenService.generateTokenPair({ id, email: `${id}@clock.dev`, name: id, groups, role }).accessToken;
    tokens.viewer = token(`viewer-${tag}`, ['viewer'], 'USER');
    tokens.editor = token(`editor-${tag}`, ['USER', 'EDITOR'], 'USER');
    tokens.admin = token(`admin-${tag}`, ['ADMIN'], 'ADMIN');
    for (const [id, name] of [[ids.show, 'Clock'], [ids.other, 'Elseclock']]) {
      await run('INSERT INTO shows (id, name, slug, created_at, updated_at) VALUES (:id, :name, :slug, NOW(), NOW())', { id, name: `${name} ${tag}`, slug: `${name.toLowerCase()}-${tag}` });
    }
    await run(`INSERT INTO episodes (id, show_id, title, episode_number, status, created_at, updated_at) VALUES
                 (:ep1, :show, 'One', 1, 'published', NOW(), NOW()), (:ep2, :show, 'Two', 2, 'draft', NOW(), NOW()),
                 (:otherEp, :other, 'Other one', 1, 'published', NOW(), NOW())`, ids);
    pid = (await run(`INSERT INTO social_profiles (handle, platform, vibe_sentence, feed_layer, display_name, created_at, updated_at)
                      VALUES (:h, 'pulse', 'Posts.', 'lalaverse', :name, NOW(), NOW()) RETURNING id`, { h: `clock.${tag}`, name: `Clock ${tag}` }))[0][0].id;
    const makePost = async (name, { show = ids.show, episode, order, text }) => {
      post[name] = uuid();
      await run(`INSERT INTO feed_posts (id, show_id, episode_id, social_profile_id, poster_handle, content_text, status, story_order, timeline_position, posted_at, likes, created_at, updated_at)
                 VALUES (:id, :show, :episode, :pid, :h, :text, 'live', :order, 'during_episode', NOW(), 5, NOW(), NOW())`,
      { id: post[name], show, episode, pid, h: `clock.${tag}`, text: text || `${name} words ${tag}`, order });
    };
    await makePost('early', { episode: ids.ep1, order: EARLY, text: `early words ${tag} #early${tag}` });
    await makePost('later', { episode: ids.ep2, order: LATER, text: `later words ${tag} #later${tag}` });
    await makePost('hidden', { episode: ids.ep1, order: EARLY });
    await makePost('teaser', { episode: ids.ep1, order: EARLY });
    await makePost('elsewhere', { show: ids.other, episode: ids.otherEp, order: EARLY });
    const makeComment = async (name, on, order) => {
      comment[name] = uuid();
      await run(`INSERT INTO feed_comments (id, feed_post_id, show_id, social_profile_id, handle, text, status, story_order, sort_order, posted_at, created_at, updated_at)
                 VALUES (:id, :on, :show, :pid, :h, :text, 'live', :order, :sort, NOW(), NOW(), NOW())`,
      { id: comment[name], on: post[on], show: ids.show, pid, h: `clock.${tag}`, text: `${name} reply ${tag}`, order, sort: Object.keys(comment).length });
    };
    await makeComment('onEarly', 'early', null);
    await makeComment('onEarlyLater', 'early', LATER);
    await makeComment('onLater', 'later', LATER);
    await makeComment('onTeaser', 'teaser', null);
    await makeComment('onHidden', 'hidden', null);
    const reveal = (name, mode) => run(
      `INSERT INTO pulse_reveals (id, show_id, item_type, item_id, moment, story_order, mode, source, teaser_style, created_at, updated_at)
       VALUES (:id, :show, 'post', :item, 'story_time', :order, :mode, 'set', 'crop', NOW(), NOW())`,
      { id: uuid(), show: ids.show, item: post[name], order: LATER, mode });
    await reveal('hidden', 'hidden');
    await reveal('teaser', 'teaser');
    await run(`INSERT INTO pulse_fits (id, show_id, image_url, caption, story_order, created_at, updated_at) VALUES
                 (:fitEarly, :show, :u1, 'Early fit', :early, NOW(), NOW()), (:fitLater, :show, :u2, 'Later fit', :later, NOW(), NOW())`,
    { ...ids, u1: `https://img.test/fit-early-${tag}.png`, u2: `https://img.test/fit-later-${tag}.png`, early: EARLY, later: LATER });
  });

  afterAll(async () => {
    const shows = [ids.show, ids.other];
    await run('DELETE FROM pulse_reveals WHERE show_id IN (:shows)', { shows });
    await run('DELETE FROM pulse_fits WHERE show_id IN (:shows)', { shows });
    await run('DELETE FROM feed_comments WHERE show_id IN (:shows)', { shows });
    await run('DELETE FROM feed_posts WHERE show_id IN (:shows)', { shows });
    await run('DELETE FROM social_profiles WHERE id = :pid', { pid });
    await run('DELETE FROM episodes WHERE show_id IN (:shows)', { shows });
    await run('DELETE FROM shows WHERE id IN (:shows)', { shows });
  });

  const RELEASED = () => [post.early, post.teaser].sort();

  describe.each(READERS)('%s: the feed', (who) => {
    test('the list: released posts only, a first look as one, counts and paging of those; the moment cannot be got past', async () => {
      for (const at of PAST) {
        const res = await get(who, `/api/v1/feed-posts?show_id=${ids.show}&status=live&with=comments${at}`);
        expect([at, res.status]).toEqual([at, 200]);
        expect([at, idsOf(res)]).toEqual([at, RELEASED()]);
        expect([at, res.body.count, res.body.total, res.body.hasMore]).toEqual([at, 2, 2, false]);
        const byId = Object.fromEntries(res.body.data.map((p) => [p.id, p]));
        expect(byId[post.early].content_text).toContain('early words');
        expect(byId[post.early].comments.map((c) => c.id)).toEqual([comment.onEarly]);
        expect(byId[post.teaser]).toMatchObject({ teaser: true, content_text: null, comments: [] });
        const raw = JSON.stringify(res.body);
        for (const gone of ['later words', 'hidden words', 'teaser words', 'onEarlyLater reply', 'onTeaser reply']) expect([at, gone, raw.includes(gone)]).toEqual([at, gone, false]);
      }
      const paged = await get(who, `/api/v1/feed-posts?show_id=${ids.show}&status=live&limit=1&offset=1`);
      expect([paged.body.count, paged.body.total, paged.body.hasMore]).toEqual([1, 2, false]);
    });

    test('an earlier moment shows less; a moment that cannot be read is a 400; a show must be named', async () => {
      const before = await get(who, `/api/v1/feed-posts?show_id=${ids.show}&status=live&at=${BEFORE}`);
      expect([before.status, before.body.total, idsOf(before)]).toEqual([200, 0, []]);
      expect((await get(who, `/api/v1/feed-posts?show_id=${ids.show}&at=soon`)).status).toBe(400);
      const noShow = await get(who, `/api/v1/feed-posts?episode_id=${ids.ep2}&status=live`);
      expect(noShow.status).toBe(400);
      expect(JSON.stringify(noShow.body)).not.toContain('later words');
    });

    test('other filters do not open it: by episode, by profile, by city', async () => {
      for (const qs of [`episode_id=${ids.ep2}`, `profile_id=${pid}`, `episode_id=${ids.ep1}`]) {
        const res = await get(who, `/api/v1/feed-posts?show_id=${ids.show}&status=live&${qs}`);
        expect([qs, res.status]).toEqual([qs, 200]);
        expect(idsOf(res).every((id) => RELEASED().includes(id))).toBe(true);
        expect(JSON.stringify(res.body)).not.toMatch(/later words|hidden words/);
      }
      const ep2 = await get(who, `/api/v1/feed-posts?show_id=${ids.show}&status=live&episode_id=${ids.ep2}`);
      expect([ep2.body.total, idsOf(ep2)]).toEqual([0, []]);
    });

    test('the timeline: the same posts and counts', async () => {
      for (const at of ['', `?at=${LATER}`, '?at=ep:99:week_later']) {
        const res = await get(who, `/api/v1/feed-posts/${ids.show}/timeline${at}`);
        expect([at, res.status, idsOf(res), res.body.total]).toEqual([at, 200, RELEASED(), 2]);
        const teased = res.body.data.find((p) => p.id === post.teaser);
        expect(teased).toMatchObject({ teaser: true, content_text: null });
        expect(JSON.stringify(res.body)).not.toMatch(/later words|hidden words|teaser words/);
      }
      expect((await get(who, `/api/v1/feed-posts/${ids.show}/timeline?at=${BEFORE}`)).body.total).toBe(0);
    });

    test('a post by its id: released reads, a first look reads as one, the rest are the unknown-id 404', async () => {
      const unknown = await get(who, `/api/v1/feed-posts/post/${uuid()}`);
      expect(unknown.status).toBe(404);
      for (const at of ['', `?at=${LATER}`, '?at=ep:99:week_later']) {
        const early = await get(who, `/api/v1/feed-posts/post/${post.early}${at}`);
        expect([at, early.status]).toEqual([at, 200]);
        expect(early.body.data.comments.map((c) => c.id)).toEqual([comment.onEarly]);
        const teased = await get(who, `/api/v1/feed-posts/post/${post.teaser}${at}`);
        expect([at, teased.status]).toEqual([at, 200]);
        expect(teased.body.data).toMatchObject({ teaser: true, content_text: null, comments: [] });
        for (const name of ['later', 'hidden']) {
          const res = await get(who, `/api/v1/feed-posts/post/${post[name]}${at}`);
          expect([at, name, res.status]).toEqual([at, name, 404]);
          expect(res.body).toEqual(unknown.body);
        }
      }
      expect((await get(who, `/api/v1/feed-posts/post/${post.early}?at=${BEFORE}`)).status).toBe(404);
    });

    test('comments: those of a released post, at or before the moment; none for a later, hidden or first-look post', async () => {
      for (const at of ['', `?at=${LATER}`, '?status=live&at=ep:99:week_later']) {
        const early = await get(who, `/api/v1/feed-posts/${post.early}/comments${at}`);
        expect([at, early.status, early.body.count, early.body.data.map((c) => c.id)]).toEqual([at, 200, 1, [comment.onEarly]]);
        for (const name of ['later', 'hidden', 'teaser']) {
          const res = await get(who, `/api/v1/feed-posts/${post[name]}/comments${at}`);
          expect([at, name, res.status, res.body]).toEqual([at, name, 200, { data: [], count: 0 }]);
        }
      }
    });

    test('an episode\'s posts: only what is released, none for an episode not yet out', async () => {
      for (const at of ['', `?at=${LATER}`]) {
        const one = await get(who, `/api/v1/feed-posts/episode/${ids.ep1}${at}`);
        expect([at, one.status, idsOf(one), one.body.count]).toEqual([at, 200, [post.early], 1]);
        expect(one.body.stats.total_likes).toBe(5);
        expect(JSON.stringify(one.body)).not.toMatch(/hidden words|teaser words/);
        const two = await get(who, `/api/v1/feed-posts/episode/${ids.ep2}${at}`);
        expect([at, two.status, two.body.count, idsOf(two)]).toEqual([at, 200, 0, []]);
        expect(JSON.stringify(two.body)).not.toContain('later words');
      }
    });

    test('another show stays its own', async () => {
      const here = await get(who, `/api/v1/feed-posts?show_id=${ids.show}&status=live`);
      expect(idsOf(here)).not.toContain(post.elsewhere);
      const there = await get(who, `/api/v1/feed-posts?show_id=${ids.other}&status=live`);
      expect(idsOf(there)).toEqual([post.elsewhere]);
    });
  });

  describe.each(SIGNED_IN)('%s: the rest of The Pulse', (who) => {
    test('trending counts released posts only, whatever moment is sent', async () => {
      for (const at of ['', '?at=', `?at=${LATER}`, '?at=ep:99:week_later']) {
        const res = await get(who, `/api/v1/feed-enhanced/${ids.show}/trending${at}`);
        expect([at, res.status]).toEqual([at, 200]);
        const raw = JSON.stringify(res.body).toLowerCase();
        expect([at, raw.includes(`#later${tag}`)]).toEqual([at, false]);
        expect([at, raw.includes(`early${tag}`)]).toEqual([at, true]);
      }
    });

    test('the latest fit is the latest released one', async () => {
      for (const at of ['', `&at=${LATER}`, '&at=ep:99:week_later']) {
        const res = await get(who, `/api/v1/pulse-fits/latest?show_id=${ids.show}${at}`);
        expect([at, res.status]).toEqual([at, 200]);
        expect([at, res.body.latest?.id]).toEqual([at, ids.fitEarly]);
        expect(JSON.stringify(res.body)).not.toContain('Later fit');
      }
    });

    test('the sidebar, Lala\'s profile, her stats, the cities, the cover and her messages read as at the present, sent or not', async () => {
      const present = await clock.presentOrder(models, ids.show);
      for (const path of [
        `/api/v1/social-profiles/lala/sidebar?show_id=${ids.show}`,
        `/api/v1/social-profiles/lala?show_id=${ids.show}&friends=all`,
        `/api/v1/shows/${ids.show}/lala-stats?x=1`,
        `/api/v1/pulse-reveals/cities?show_id=${ids.show}`,
        `/api/v1/shows/${ids.show}/pulse-cover?x=1`,
        `/api/v1/pulse-dms?show_id=${ids.show}&profile_id=lala`,
      ]) {
        const atPresent = await get(who, `${path}&at=present`);
        expect([path, [401, 403, 500].includes(atPresent.status)]).toEqual([path, false]);
        for (const at of ['', '&at=', `&at=${LATER}`, '&at=ep:99:week_later']) {
          const res = await get(who, `${path}${at}`);
          expect([path, at, res.status]).toEqual([path, at, atPresent.status]);
          expect([path, at, res.body]).toEqual([path, at, atPresent.body]);
        }
        expect([path, (await get(who, `${path}&at=soon`)).status]).toEqual([path, 400]);
      }
      const cities = await get(who, `/api/v1/pulse-reveals/cities?show_id=${ids.show}&at=${LATER}`);
      expect(cities.body.at).toBe(present);
    });
  });

  describe('an ADMIN', () => {
    test('with no moment reads everything: the director\'s view', async () => {
      const list = await get('admin', `/api/v1/feed-posts?show_id=${ids.show}&status=live&with=comments`);
      expect(idsOf(list)).toEqual([post.early, post.later, post.hidden, post.teaser].sort());
      expect(list.body.total).toBe(4);
      const byId = Object.fromEntries(list.body.data.map((p) => [p.id, p]));
      expect(byId[post.teaser].content_text).toContain('teaser words');
      expect(byId[post.early].comments.map((c) => c.id).sort()).toEqual([comment.onEarly, comment.onEarlyLater].sort());
      expect((await get('admin', `/api/v1/feed-posts/post/${post.later}`)).status).toBe(200);
      expect((await get('admin', `/api/v1/feed-posts/post/${post.hidden}`)).status).toBe(200);
      expect((await get('admin', `/api/v1/feed-posts/${post.later}/comments`)).body.count).toBe(1);
      expect(idsOf(await get('admin', `/api/v1/feed-posts/${ids.show}/timeline`))).toEqual([post.early, post.later, post.hidden, post.teaser].sort());
      expect((await get('admin', `/api/v1/feed-posts/episode/${ids.ep2}`)).body.count).toBe(1);
      expect((await get('admin', `/api/v1/pulse-reveals/cities?show_id=${ids.show}`)).body.at).toBeNull();
    });

    test('can preview a later moment, the reveals lifted; and reads the present as a viewer does', async () => {
      const later = await get('admin', `/api/v1/feed-posts?show_id=${ids.show}&status=live&at=${LATER}`);
      expect(idsOf(later)).toEqual([post.early, post.later, post.hidden, post.teaser].sort());
      expect(later.body.data.find((p) => p.id === post.teaser).teaser).toBeUndefined();
      expect((await get('admin', `/api/v1/feed-posts/post/${post.later}?at=${LATER}`)).status).toBe(200);
      expect((await get('admin', `/api/v1/pulse-fits/latest?show_id=${ids.show}&at=${LATER}`)).body.latest.id).toBe(ids.fitLater);
      expect((await get('admin', `/api/v1/pulse-reveals/cities?show_id=${ids.show}&at=${LATER}`)).body.at).toBe(LATER);
      const present = await get('admin', `/api/v1/feed-posts?show_id=${ids.show}&status=live&at=present`);
      expect(idsOf(present)).toEqual(RELEASED());
      expect((await get('admin', `/api/v1/feed-posts/post/${post.later}?at=present`)).status).toBe(404);
    });
  });
});
