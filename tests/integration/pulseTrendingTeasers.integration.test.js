/**
 * Trending leaves teaser posts out (Task #3048; phase 11 read §2 item 4).
 * A teaser post is sent with no words and no topic (applyPostReveal), so
 * at a moment before its reveal its hashtags and trending_topic must not
 * reach GET /feed-enhanced/:showId/trending either. From its moment, and
 * in Director view (no moment), it counts as before. Hidden posts stay out
 * as they were.
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

(shouldSkip ? describe.skip : describe)('The Pulse trending leaves teasers out (Task #3048)', () => {
  const tag = uuid().slice(0, 8);
  const ids = { show: uuid() };
  let token;
  const as = (req) => req.set('Authorization', `Bearer ${token}`);
  const post = (text, extra = {}) => models.FeedPost.create({
    show_id: ids.show, poster_handle: `poster${tag}`, poster_platform: 'lalaverse', post_type: 'post', content_text: text,
    status: 'live', story_order: 11, likes: 5, comments_count: 0, shares: 0, sample_comments: [], sort_order: 0, ...extra,
  });
  const topics = async (q) => {
    const res = await as(request(app).get(`/api/v1/feed-enhanced/${ids.show}/trending${q}`));
    expect(res.status).toBe(200);
    return res.body.data.map((t) => t.topic.toLowerCase());
  };

  beforeAll(async () => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    token = TokenService.generateTokenPair({ id: 'test-trending-teasers', email: 'evoni@trending.dev', name: 'Evoni', groups: ['ADMIN'], role: 'ADMIN' }).accessToken;
    await run(`INSERT INTO shows (id, name, slug, created_at, updated_at) VALUES (:show, :name, :slug, NOW(), NOW())`,
      { show: ids.show, name: `Trending ${tag}`, slug: `trending-${tag}` });
    await post('front row #GalaNight');
    const teaser = await post('she said yes #TheProposal', { trending_topic: 'Engagement Rumours' });
    const hidden = await post('no one knows #SecretWedding');
    const reveal = (postId, mode) => models.PulseReveal.create({ show_id: ids.show, source: 'set', item_type: 'post', item_id: postId, moment: 'story_time', story_order: 30, mode });
    await reveal(teaser.id, 'teaser');
    await reveal(hidden.id, 'hidden');
  });

  afterAll(async () => {
    await run('DELETE FROM pulse_reveals WHERE show_id = :show', ids);
    await run('DELETE FROM pulse_post_numbers WHERE show_id = :show', ids);
    await run('DELETE FROM feed_posts WHERE show_id = :show', ids);
    await run('DELETE FROM shows WHERE id = :show', ids);
  });

  test("before its moment a teaser post's tags and topic are not in Trending; hidden stays out", async () => {
    const at = await topics('?at=15');
    expect(at).toContain('#galanight');
    expect(at).not.toContain('#theproposal');
    expect(at).not.toContain('engagement rumours');
    expect(at).not.toContain('#secretwedding');
  });

  test('from its moment, and in Director view, it counts as before', async () => {
    for (const q of ['?at=30', '']) {
      const all = await topics(q);
      expect(all).toEqual(expect.arrayContaining(['#galanight', '#theproposal', 'engagement rumours', '#secretwedding']));
    }
  });
});
