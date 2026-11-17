/**
 * What a feed post and a comment give a reader who is not an ADMIN (Evoni's
 * approval of 2026-11-15, scope B; src/services/publicFeedPost.js), against
 * the test database.
 *
 * One live post is seeded with a marker in every free-text and JSON column
 * that is not part of what The Pulse draws, in its author's profile, in its
 * photos' extra keys and in its comment. Then, as a request with no token, a
 * viewer, an editor and an ADMIN, across the list, the timeline, the direct
 * read, the comments and the episode view:
 *   - anyone but an ADMIN gets exactly the listed fields, nested ones
 *     included, and no marker; a private column is not a filter;
 *   - what The Pulse draws is all there (the feed, a city's feed, a profile's
 *     grid and the direct read);
 *   - an ADMIN reads the production material as before;
 *   - the seven operational reads are an ADMIN's.
 */
jest.unmock('uuid');

const request = require('supertest');
const crypto = require('crypto');
const { DataTypes } = require('sequelize');
const app = require('../../src/app');
const TokenService = require('../../src/services/tokenService');
const models = require('../../src/models');
const pub = require('../../src/services/publicFeedPost');

const { sequelize } = models;

const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const MARK = 'ZZFEED';
const markersIn = (body) => [...new Set((JSON.stringify(body || {}).match(new RegExp(`${MARK}:[a-z_0-9]+`, 'g')) || []).map((m) => m.slice(MARK.length + 1)))];

function markerValues(Model, skip) {
  const out = {};
  for (const [name, attr] of Object.entries(Model.rawAttributes)) {
    if (skip.includes(name) || attr.primaryKey || attr.references) continue;
    if (/(_id|_at|_url|_urls|_key)$/.test(name)) continue;
    const tag = `${MARK}:${name}`;
    if (attr.type instanceof DataTypes.TEXT) out[name] = tag;
    else if (attr.type instanceof DataTypes.STRING) { if ((attr.type._length || 255) >= tag.length && !attr.validate) out[name] = tag; }
    else if (attr.type instanceof DataTypes.JSONB || attr.type instanceof DataTypes.JSON) out[name] = { nested: { note: tag }, list: [tag] };
  }
  return out;
}
async function createMarked(Model, base, marked) {
  const values = { ...marked, ...base };
  for (let i = 0; i < 300; i += 1) {
    try { return await Model.create(values); } catch (err) {
      const all = `${err.parent?.message || ''} ${err.message || ''}`;
      const bad = (err.errors || []).map((e) => e.path).filter((p) => p && !(p in base));
      const named = new RegExp(`${MARK}:([a-z_0-9]+)`).exec(all) || /column "([a-z_0-9]+)"/.exec(all);
      if (named && !(named[1] in base)) bad.push(named[1]);
      if (!bad.length) { const next = Object.keys(values).find((k) => !(k in base)); if (!next) throw err; bad.push(next); }
      for (const p of bad) delete values[p];
    }
  }
  throw new Error('the marked row could not be made');
}

const POST_KEYS = [...pub.PUBLIC_POST_FIELDS, 'photos', 'place', 'socialProfile', 'comments'];
const within = (obj, allowed) => Object.keys(obj).filter((k) => !allowed.includes(k));

(shouldSkip ? describe.skip : describe)('feed posts and comments for a reader who is not an ADMIN', () => {
  const tag = crypto.randomUUID().slice(0, 8);
  const HANDLE = `feed.${tag}`;
  const ids = { show: crypto.randomUUID(), episode: crypto.randomUUID(), reg: crypto.randomUUID(), char: crypto.randomUUID() };
  const tokens = {};
  let profile; let post; let comment;
  let ipN = 0;
  const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });
  const get = (who, path) => {
    ipN += 1;
    const r = request(app).get(path).set('X-Forwarded-For', `198.51.120.${(ipN % 200) + 1}`);
    return tokens[who] ? r.set('Authorization', `Bearer ${tokens[who]}`) : r;
  };
  const NOT_ADMIN = ['anon', 'viewer', 'editor'];

  beforeAll(async () => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    const token = (id, groups, role) => TokenService.generateTokenPair({ id, email: `${id}@fields.dev`, name: id, groups, role }).accessToken;
    tokens.viewer = token(`viewer-${tag}`, ['viewer'], 'USER');
    tokens.editor = token(`editor-${tag}`, ['USER', 'EDITOR'], 'USER');
    tokens.admin = token(`admin-${tag}`, ['ADMIN'], 'ADMIN');
    await run('INSERT INTO shows (id, name, slug, created_at, updated_at) VALUES (:show, :name, :slug, NOW(), NOW())', { ...ids, name: `Fields ${tag}`, slug: `fields-${tag}` });
    await run(`INSERT INTO episodes (id, show_id, title, episode_number, status, created_at, updated_at) VALUES (:episode, :show, :title, 1, 'published', NOW(), NOW())`,
      { ...ids, title: `${MARK}:episode_title` });
    profile = await createMarked(models.SocialProfile,
      { handle: HANDLE, platform: 'lalaverse', display_name: `Author ${tag}`, vibe_sentence: 'Posts.', feed_layer: 'lalaverse', status: 'generated', city: 'echo_park', follower_tier: 'micro' },
      markerValues(models.SocialProfile, ['handle', 'display_name', 'vibe_sentence', 'follower_tier', 'platform', 'city', 'feed_layer', 'status']));
    await run('INSERT INTO character_registries (id, title, show_id, created_at, updated_at) VALUES (:reg, :t, :show, NOW(), NOW())', { ...ids, t: `Fields ${tag}` });
    await run(`INSERT INTO registry_characters (id, registry_id, character_key, display_name, feed_profile_id, portrait_url, created_at, updated_at)
               VALUES (:char, :reg, :key, :name, :pid, :portrait, NOW(), NOW())`,
    { ...ids, key: `fields-${tag}`, name: `Author ${tag}`, pid: profile.id, portrait: `https://img.test/portrait-${tag}.png` });
    post = await createMarked(models.FeedPost, {
      show_id: ids.show, episode_id: ids.episode, social_profile_id: profile.id, poster_handle: HANDLE, poster_display_name: `Author ${tag}`,
      poster_platform: 'lalaverse', content_text: `What the audience reads ${tag}`, status: 'live', post_type: 'post', posted_at: new Date(),
      likes: 12, comments_count: 1, shares: 3, sort_order: 0, timeline_position: 'during_episode', place_city: 'echo_park',
      image_url: `https://img.test/one-${tag}.png`, image_description: 'A loaf on a board',
      photos: [{ url: `https://img.test/one-${tag}.png`, alt: 'A loaf on a board', asset_id: `${MARK}:photo_asset`, prompt: `${MARK}:photo_prompt` }],
    }, markerValues(models.FeedPost, ['poster_handle', 'poster_display_name', 'poster_platform', 'content_text', 'status', 'post_type', 'post_format',
      'timeline_position', 'place_city', 'image_description', 'photos', 'release_state', 'teaser_style']));
    comment = await createMarked(models.FeedComment,
      { feed_post_id: post.id, show_id: ids.show, social_profile_id: profile.id, handle: HANDLE, display_name: `Author ${tag}`, text: `A reply ${tag}`, status: 'live', posted_at: new Date(), sort_order: 0 },
      markerValues(models.FeedComment, ['handle', 'display_name', 'text', 'status']));
  });

  afterAll(async () => {
    await run('DELETE FROM feed_comments WHERE show_id = :show', ids);
    await run('DELETE FROM feed_posts WHERE show_id = :show', ids);
    await run('DELETE FROM registry_characters WHERE registry_id = :reg', ids);
    await run('DELETE FROM character_registries WHERE id = :reg', ids);
    if (profile) await run('DELETE FROM social_profiles WHERE id = :id', { id: profile.id });
    await run('DELETE FROM episodes WHERE show_id = :show', ids);
    await run('DELETE FROM shows WHERE id = :show', ids);
  });

  test('the seed carries production material in the post, its photos, its author and its comment', async () => {
    const stored = (await models.FeedPost.findByPk(post.id)).get({ plain: true });
    expect(markersIn(stored)).toEqual(expect.arrayContaining(['lala_internal_thought', 'lala_reaction', 'narrative_function', 'photo_prompt']));
    expect(markersIn((await models.SocialProfile.findByPk(profile.id)).get({ plain: true }))).toEqual(expect.arrayContaining(['private_reality', 'aesthetic_dna']));
  });

  describe('the helpers', () => {
    test('publicPost keeps the listed fields, cuts the nested ones the same way, and drops everything else', () => {
      const cut = pub.publicPost({
        id: 1, content_text: 'hi', lala_internal_thought: 'x', gate_json: { flags: ['y'] }, episode_id: 'e', brand_new: 'later',
        photos: [{ url: 'u', alt: 'a', asset_id: 'z', prompt: 'p' }, 'not an object'],
        place: { city: 'c', city_name: 'C', name: 'N', location_id: 'l' },
        socialProfile: { id: 2, handle: 'h', archetype: 'q', aesthetic_dna: { r: 1 }, private_reality: 's' },
        comments: [{ id: 3, text: 't', gate_json: {}, social_profile_id: 9, story_order: 4 }],
        episode: { id: 'e', episode_number: 1 },
      });
      expect(cut).toEqual({
        id: 1, content_text: 'hi',
        photos: [{ url: 'u', alt: 'a' }], place: { city: 'c', city_name: 'C', name: 'N' },
        socialProfile: { id: 2, handle: 'h' }, comments: [{ id: 3, text: 't' }],
      });
      expect(pub.publicComment({ id: 1, text: 't', gate_json: { a: 1 }, ai_generated: true })).toEqual({ id: 1, text: 't' });
      expect(pub.publicPost(null)).toBeNull();
    });
  });

  describe.each(NOT_ADMIN)('%s', (who) => {
    const expectPublicPost = (p) => {
      expect(within(p, POST_KEYS)).toEqual([]);
      if (p.socialProfile) expect(within(p.socialProfile, pub.PUBLIC_AUTHOR_FIELDS)).toEqual([]);
      if (p.place) expect(within(p.place, pub.PUBLIC_PLACE_FIELDS)).toEqual([]);
      for (const ph of p.photos || []) expect(within(ph, pub.PUBLIC_PHOTO_FIELDS)).toEqual([]);
      for (const c of p.comments || []) expect(within(c, pub.PUBLIC_COMMENT_FIELDS)).toEqual([]);
    };

    test('the feed list: the listed fields only, nested ones included, and everything The Pulse draws', async () => {
      const res = await get(who, `/api/v1/feed-posts?show_id=${ids.show}&status=live&with=comments`);
      expect(res.status).toBe(200);
      expect(res.body.total).toBe(1);
      const [p] = res.body.data;
      expectPublicPost(p);
      expect(markersIn(res.body)).toEqual([]);
      expect(p).toMatchObject({
        id: post.id, poster_handle: HANDLE, poster_display_name: `Author ${tag}`, content_text: `What the audience reads ${tag}`,
        status: 'live', likes: expect.any(Number), shares: expect.any(Number), author_portrait_url: `https://img.test/portrait-${tag}.png`,
        photos: [{ url: `https://img.test/one-${tag}.png`, alt: 'A loaf on a board' }],
        place: { city: 'echo_park', city_name: expect.any(String) },
        socialProfile: { id: profile.id, handle: HANDLE, display_name: `Author ${tag}`, city: 'echo_park' },
        comments: [{ id: comment.id, handle: HANDLE, text: `A reply ${tag}`, portrait_url: `https://img.test/portrait-${tag}.png` }],
      });
      expect(p.posted_at).toEqual(expect.any(String));
      for (const gone of ['episode_id', 'episode', 'story_order', 'event_id', 'tags', 'gate_json', 'lala_internal_thought', 'narrative_function', 'poster_creator_name', 'picture_job']) {
        expect(p).not.toHaveProperty(gone);
      }
    });

    test('a city\'s feed and a profile\'s grid read the same public post', async () => {
      for (const qs of [`show_id=${ids.show}&city=echo_park&status=live&with=comments`, `show_id=${ids.show}&profile_id=${profile.id}&status=live`]) {
        const res = await get(who, `/api/v1/feed-posts?${qs}`);
        expect([qs, res.status]).toEqual([qs, 200]);
        expect(res.body.data.map((x) => x.id)).toEqual([post.id]);
        res.body.data.forEach(expectPublicPost);
        expect(markersIn(res.body)).toEqual([]);
      }
    });

    test('the timeline and the direct read: public fields, no beats, no marker', async () => {
      const timeline = await get(who, `/api/v1/feed-posts/${ids.show}/timeline?status=live`);
      expect(timeline.status).toBe(200);
      expect(timeline.body.data.map((x) => x.id)).toEqual([post.id]);
      timeline.body.data.forEach(expectPublicPost);
      expect(markersIn(timeline.body)).toEqual([]);

      const one = await get(who, `/api/v1/feed-posts/post/${post.id}`);
      expect(one.status).toBe(200);
      expectPublicPost(one.body.data);
      expect(one.body.data).not.toHaveProperty('beats');
      expect(one.body.data).toMatchObject({ id: post.id, content_text: `What the audience reads ${tag}`, comments: [{ id: comment.id, text: `A reply ${tag}` }] });
      expect(markersIn(one.body)).toEqual([]);
      expect(JSON.stringify(one.body)).not.toContain(ids.episode);
    });

    test('the comments: the listed fields only', async () => {
      const res = await get(who, `/api/v1/feed-posts/${post.id}/comments`);
      expect(res.status).toBe(200);
      expect(res.body.count).toBe(1);
      expect(within(res.body.data[0], pub.PUBLIC_COMMENT_FIELDS)).toEqual([]);
      expect(res.body.data[0]).toMatchObject({ id: comment.id, handle: HANDLE, text: `A reply ${tag}` });
      expect(markersIn(res.body)).toEqual([]);
    });

    test('the episode view: the public posts and two totals; not how the episode places them or what they are for', async () => {
      const res = await get(who, `/api/v1/feed-posts/episode/${ids.episode}`);
      expect(res.status).toBe(200);
      expect(Object.keys(res.body).sort()).toEqual(['count', 'data', 'stats']);
      expect(Object.keys(res.body.stats).sort()).toEqual(['total_comments', 'total_likes']);
      expect(res.body.count).toBe(1);
      res.body.data.forEach(expectPublicPost);
      expect(markersIn(res.body)).toEqual([]);
    });

    test('a private column is not a filter: asking by story purpose changes nothing', async () => {
      for (const path of [`/api/v1/feed-posts?show_id=${ids.show}&status=live`, `/api/v1/feed-posts/${ids.show}/timeline?status=live`]) {
        const res = await get(who, `${path}&narrative_function=${encodeURIComponent('no such purpose')}`);
        expect([path, res.body.total]).toEqual([path, 1]);
        expect(markersIn(res.body)).toEqual([]);
      }
    });
  });

  describe('an ADMIN', () => {
    test('reads the production material as before, on each of the five reads', async () => {
      const list = await get('admin', `/api/v1/feed-posts?show_id=${ids.show}&status=live&with=comments`);
      expect(list.status).toBe(200);
      expect(markersIn(list.body)).toEqual(expect.arrayContaining(['lala_internal_thought', 'lala_reaction', 'narrative_function', 'photo_prompt']));
      expect(list.body.data[0].episode_id).toBe(ids.episode);
      expect(list.body.data[0].socialProfile).toHaveProperty('archetype');

      const one = await get('admin', `/api/v1/feed-posts/post/${post.id}`);
      expect(one.body.data.beats).toEqual(expect.any(Array));
      expect(markersIn(one.body)).toEqual(expect.arrayContaining(['lala_internal_thought']));

      const comments = await get('admin', `/api/v1/feed-posts/${post.id}/comments`);
      expect(comments.body.data[0]).toHaveProperty('social_profile_id');
      expect(comments.body.data[0]).toHaveProperty('status', 'live');

      const episode = await get('admin', `/api/v1/feed-posts/episode/${ids.episode}`);
      expect(Object.keys(episode.body).sort()).toEqual(['count', 'data', 'grouped', 'stats']);
      expect(episode.body.grouped.during_episode.map((x) => x.id)).toEqual([post.id]);
      expect(episode.body.stats).toHaveProperty('narrative_functions');

      const timeline = await get('admin', `/api/v1/feed-posts/${ids.show}/timeline?status=live`);
      expect(markersIn(timeline.body)).toEqual(expect.arrayContaining(['narrative_function']));
    });

    test('filters by story purpose, as before', async () => {
      const none = await get('admin', `/api/v1/feed-posts?show_id=${ids.show}&status=live&narrative_function=${encodeURIComponent('no such purpose')}`);
      expect(none.body.total).toBe(0);
    });
  });

  describe('the operational reads are an ADMIN\'s', () => {
    const reads = () => [
      `/api/v1/feed-posts/deleted?show_id=${ids.show}`,
      `/api/v1/feed-posts/comments/pending?show_id=${ids.show}`,
      `/api/v1/feed-posts/release-plan?show_id=${ids.show}`,
      `/api/v1/feed-posts/release-calendar?show_id=${ids.show}`,
      `/api/v1/feed-posts/${post.id}/release-time/suggest`,
      `/api/v1/feed-posts/${post.id}/comments/reactors`,
      `/api/v1/feed-posts/episodes/${ids.episode}/script-drafts`,
    ];

    test('no token 401; viewer and editor 403 with nothing of the post in the answer; an ADMIN is let through', async () => {
      for (const path of reads()) {
        expect([path, (await get('anon', path)).status]).toEqual([path, 401]);
        for (const who of ['viewer', 'editor']) {
          const res = await get(who, path);
          expect([who, path, res.status]).toEqual([who, path, 403]);
          expect(markersIn(res.body)).toEqual([]);
          expect(JSON.stringify(res.body)).not.toContain(HANDLE);
        }
        expect([path, [401, 403].includes((await get('admin', path)).status)]).toEqual([path, false]);
      }
    });

    test('the place picker stays a signed-in read (the composer uses it)', async () => {
      expect((await get('viewer', '/api/v1/feed-posts/places')).status).toBe(200);
    });
  });
});
