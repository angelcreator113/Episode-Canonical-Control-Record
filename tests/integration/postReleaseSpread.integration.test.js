/**
 * Every card suggested the same time (Evoni, 2026-10-17: "when getting
 * timing suggestions its giving me the same date and time ... same day").
 * Five undated backstory drafts by different posters, none scheduled:
 * - each card suggests its own time, its place in the Schedule all plan;
 * - whoever posts, they are an hour apart, at most four a day, the fifth on
 *   the next day;
 * - a post already scheduled for another poster is kept clear of too.
 */
jest.unmock('uuid');

const crypto = require('crypto');
const request = require('supertest');
const app = require('../../src/app');
const TokenService = require('../../src/services/tokenService');
const models = require('../../src/models');

const { sequelize } = models;

const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const HOUR = 60 * 60 * 1000;
const dayOf = (iso) => iso.slice(0, 10);

(shouldSkip ? describe.skip : describe)('release time suggestions are spread across the Feed', () => {
  const TAG = crypto.randomUUID().slice(0, 8);
  const show = crypto.randomUUID();
  let admin;
  const draft = (n, extra = {}) => models.FeedPost.create({
    show_id: show, poster_handle: `spread${TAG}${n}`, poster_display_name: `S${n}`, poster_platform: 'lalaverse', post_type: 'post',
    content_text: `backstory ${n}`, status: 'draft', story_order: 7, likes: 0, comments_count: 0, shares: 0, sample_comments: [], sort_order: 0, ...extra,
  });
  const suggest = (id) => request(app).get(`/api/v1/feed-posts/${id}/release-time/suggest?tz_offset=0`).set('Authorization', `Bearer ${admin}`);

  beforeAll(async () => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    admin = TokenService.generateTokenPair({ id: 'test-admin-spread', email: 'evoni@spread.dev', name: 'Evoni', groups: ['ADMIN'], role: 'ADMIN' }).accessToken;
    await sequelize.query('INSERT INTO shows (id, name, slug, created_at, updated_at) VALUES (:show, :name, :slug, NOW(), NOW())',
      { replacements: { show, name: `Spread ${TAG}`, slug: `spread-${TAG}` } });
  });

  afterAll(async () => {
    await sequelize.query('DELETE FROM feed_posts WHERE show_id = :show', { replacements: { show } });
    await sequelize.query('DELETE FROM shows WHERE id = :show', { replacements: { show } });
    await sequelize.close();
  });

  it('each card suggests its own time: an hour apart, four a day, clear of a scheduled post', async () => {
    const scheduled = await draft(0, { release_state: 'scheduled', release_at: null });
    const posts = [];
    for (let n = 1; n <= 5; n += 1) posts.push(await draft(n));
    // The scheduled one goes at the first suggestion's slot, to be kept clear of.
    const firstAlone = (await suggest(posts[0].id)).body.at;
    await scheduled.update({ release_at: new Date(firstAlone) });

    const times = [];
    for (const p of posts) {
      const res = await suggest(p.id);
      expect(res.status).toBe(200);
      times.push(res.body.at);
    }
    expect(new Set(times).size).toBe(5);
    const all = [...times, firstAlone].map((t) => new Date(t).getTime()).sort((a, b) => a - b);
    for (let i = 1; i < all.length; i += 1) expect(all[i] - all[i - 1]).toBeGreaterThanOrEqual(HOUR);
    const perDay = {};
    for (const t of [...times, firstAlone]) perDay[dayOf(t)] = (perDay[dayOf(t)] || 0) + 1;
    expect(Math.max(...Object.values(perDay))).toBeLessThanOrEqual(4);
    expect(Object.keys(perDay).length).toBeGreaterThanOrEqual(2);

    // The same plan as Schedule all.
    const plan = await request(app).get(`/api/v1/feed-posts/release-plan?show_id=${show}&tz_offset=0`).set('Authorization', `Bearer ${admin}`);
    expect(posts.map((p) => plan.body.items.find((i) => i.post_id === p.id).at)).toEqual(times);
  });
});
