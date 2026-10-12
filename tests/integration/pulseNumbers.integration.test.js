/**
 * Post numbers on The Pulse (Task #2953; The Pulse spec §8): a post going
 * live gets likes and shares proposed after the response.
 * - a draft released through PUT /feed-posts/:id, and a post created live;
 * - followers come from the ledger at the post's story time;
 * - other characters' everyday numbers are accepted; posts about Lala,
 *   spikes over 3× the poster's median, posters with no count, and Lala's
 *   own posts wait with a flag;
 * - comments and the post's own columns are untouched.
 */
jest.unmock('uuid');

const request = require('supertest');
const crypto = require('crypto');
const app = require('../../src/app');
const TokenService = require('../../src/services/tokenService');
const models = require('../../src/models');
const numbers = require('../../src/services/pulseNumbers');

const { sequelize } = models;

const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const uuid = () => crypto.randomUUID();
const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });

/** The post's numbers row once the after-response proposal has run. */
async function rowFor(postId) {
  for (let i = 0; i < 40; i += 1) {
    const row = await models.PulsePostNumber.findOne({ where: { post_id: postId } });
    if (row) return row;
    await new Promise((r) => { setTimeout(r, 50); });
  }
  return null;
}

(shouldSkip ? describe.skip : describe)('The Pulse post numbers (Task #2953)', () => {
  const tag = uuid().slice(0, 8);
  const ids = { show: uuid(), ep1: uuid() };
  const p = {};
  let admin;
  const as = (req) => req.set('Authorization', `Bearer ${admin}`);
  const draft = async (fields) => {
    const id = uuid();
    await run(`INSERT INTO feed_posts (id, show_id, poster_handle, social_profile_id, episode_id, post_type, content_text, image_url,
                 trending_topic, timeline_position, story_order, comments_count, status, created_at, updated_at)
               VALUES (:id, :show, :handle, :profile, :episode, :type, :text, :image, :topic, :position, :order, :comments, 'draft', NOW(), NOW())`,
    {
      id, show: ids.show, handle: `poster-${tag}`, profile: p.poster, episode: null, type: 'post', text: 'Just a day.',
      image: null, topic: null, position: null, order: 17, comments: 0, ...fields,
    });
    return id;
  };
  const release = (id) => as(request(app).put(`/api/v1/feed-posts/${id}`)).send({ status: 'live' });

  beforeAll(async () => {
    admin = TokenService.generateTokenPair({ id: 'test-admin-numbers', email: 'evoni@numbers.dev', name: 'Evoni', groups: ['ADMIN'], role: 'ADMIN' }).accessToken;
    await run(`INSERT INTO shows (id, name, slug, created_at, updated_at) VALUES (:show, :name, :slug, NOW(), NOW())`,
      { show: ids.show, name: `Numbers ${tag}`, slug: `numbers-${tag}` });
    await run(`INSERT INTO episodes (id, show_id, title, episode_number, status, evaluation_json, created_at, updated_at)
               VALUES (:ep1, :show, 'One', 1, 'published', CAST(:ev AS jsonb), NOW(), NOW())`, { ...ids, ev: JSON.stringify({ tier_final: 'slay' }) });
    for (const key of ['poster', 'fresh']) {
      const [[row]] = await run(`INSERT INTO social_profiles (handle, platform, vibe_sentence, display_name, feed_layer, follower_count_approx, created_at, updated_at)
        VALUES (:handle, 'instagram', 'test', :display, 'lalaverse', '20k', NOW(), NOW()) RETURNING id`, { handle: `${key}-${tag}`, display: `${key} ${tag}` });
      p[key] = row.id;
    }
    // The poster has 100,000 followers from the start, and 200,000 after episode 2.
    await models.PulseFollower.bulkCreate([
      { show_id: ids.show, social_profile_id: p.poster, story_order: 0, change: 100000, count_after: 100000, cause: 'start', status: 'accepted', decided_at: new Date() },
      { show_id: ids.show, social_profile_id: p.poster, story_order: 27, change: 100000, count_after: 200000, cause: 'override', reason: 'x', status: 'accepted', decided_at: new Date() },
    ]);
  });

  afterAll(async () => {
    await run('DELETE FROM pulse_post_numbers WHERE show_id = :show', ids);
    await run('DELETE FROM pulse_followers WHERE show_id = :show', ids);
    await run('DELETE FROM feed_posts WHERE show_id = :show', ids);
    await run('DELETE FROM episodes WHERE show_id = :show', ids);
    await run('DELETE FROM social_profiles WHERE id IN (:a)', { a: Object.values(p) });
    await run('DELETE FROM shows WHERE id = :show', ids);
  });

  test('a released draft gets numbers from the ledger at its story time, accepted; comments and its own columns untouched', async () => {
    const id = await draft({ comments: 3 });
    const res = await release(id);
    expect(res.status).toBe(200);
    const row = await rowFor(id);
    expect(row).not.toBeNull();
    expect(row.factors_json).toMatchObject({ followers: 100000, followers_from: 'ledger', kind: 'status', trending: false, episode_tier: null });
    const expected = numbers.numbersFrom(row.factors_json);
    expect(row.factors_json.random).toBe(numbers.randomFactor(row.seed));
    expect([row.proposed_likes, row.proposed_shares]).toEqual([expected.likes, expected.shares]);
    expect(row).toMatchObject({ status: 'accepted', decided_by: 'auto', flag: null, story_order: 17, final_likes: expected.likes, final_shares: expected.shares });

    const [[post]] = await run('SELECT likes, shares, comments_count FROM feed_posts WHERE id = :id', { id });
    expect(post).toEqual({ likes: 0, shares: 0, comments_count: 3 });
  });

  test('stable: proposing again returns the same row and numbers', async () => {
    const id = await draft({});
    await release(id);
    const first = await rowFor(id);
    const post = await models.FeedPost.findByPk(id);
    const again = await numbers.propose(models, post);
    expect(again.id).toBe(first.id);
    expect(again.proposed_likes).toBe(first.proposed_likes);
    const [[{ n }]] = await run('SELECT COUNT(*)::int AS n FROM pulse_post_numbers WHERE post_id = :id', { id });
    expect(n).toBe(1);
  });

  test("an episode's fit post on a trend: the later count, the episode's tier and the trend boost", async () => {
    await draft({ topic: '#GalaNight' });
    const other = await draft({ topic: '#galanight' });
    await release(other);
    await rowFor(other);
    const id = await draft({ episode: ids.ep1, type: 'reel', image: 'fit.jpg', topic: '#GalaNight', order: 28 });
    await release(id);
    const row = await rowFor(id);
    expect(row.factors_json).toMatchObject({ followers: 200000, kind: 'fit', trending: true, episode_tier: 'slay' });
    expect(row.story_order).toBe(28);
  });

  test('a post created live is proposed; a draft created is not', async () => {
    const live = await as(request(app).post('/api/v1/feed-posts')).send({ show_id: ids.show, content_text: 'Hello', poster_handle: `poster-${tag}`, social_profile_id: p.poster });
    expect(live.status).toBe(200);
    expect(await rowFor(live.body.data.id)).not.toBeNull();
    const kept = await as(request(app).post('/api/v1/feed-posts')).send({ show_id: ids.show, content_text: 'Later', social_profile_id: p.poster, status: 'draft' });
    await new Promise((r) => { setTimeout(r, 200); });
    expect(await models.PulsePostNumber.findOne({ where: { post_id: kept.body.data.id } })).toBeNull();
  });

  test('about Lala, no follower count yet, and Lala\'s own posts wait with a flag', async () => {
    const about = await draft({ text: 'Saw @lala tonight, wow.' });
    await release(about);
    expect(await rowFor(about)).toMatchObject({ status: 'proposed', flag: 'about_lala', final_likes: null, decided_by: null });

    const fresh = await draft({ profile: p.fresh, handle: `fresh-${tag}` });
    await release(fresh);
    const row = await rowFor(fresh);
    expect(row).toMatchObject({ status: 'proposed', flag: 'no_followers' });
    expect(row.factors_json).toMatchObject({ followers: 20000, followers_from: 'estimate "20k" (no ledger count yet)' });

    const own = await draft({ profile: p.fresh, handle: `fresh-${tag}` });
    await run("UPDATE feed_posts SET status = 'live' WHERE id = :own", { own });
    const lalaRow = await numbers.propose(models, await models.FeedPost.findByPk(own), { lalaProfileId: p.fresh });
    expect(lalaRow).toMatchObject({ status: 'proposed', flag: 'lala' });
  });

  test("a spike over 3× the poster's median waits", async () => {
    // The poster's decided posts so far had about 2,000 likes; a mega-trend post at 200,000 followers is far over.
    await run("UPDATE pulse_post_numbers SET final_likes = 100 WHERE show_id = :show AND social_profile_id = :poster AND status = 'accepted'",
      { show: ids.show, poster: p.poster });
    const id = await draft({ type: 'reel', image: 'big.jpg', order: 29 });
    await release(id);
    const row = await rowFor(id);
    expect(row).toMatchObject({ status: 'proposed', flag: 'spike' });
    expect(row.factors_json.poster_median).toBe(100);
  });
});
