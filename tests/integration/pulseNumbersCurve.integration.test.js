/**
 * Locked numbers grow along a story-time curve, then settle (Task #2955; The
 * Pulse spec §8). GET /feed-posts?at= shows each post's likes and shares as
 * they stand at that moment, and viral flags from them; without ?at= (the
 * Director view) the final numbers. Comments stay the real count, and a
 * post with no numbers row is unchanged.
 */
jest.unmock('uuid');

const request = require('supertest');
const crypto = require('crypto');
const app = require('../../src/app');
const models = require('../../src/models');

const { sequelize } = models;

const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const uuid = () => crypto.randomUUID();
const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });

(shouldSkip ? describe.skip : describe)('The Pulse numbers on the story-time curve (Task #2955)', () => {
  const tag = uuid().slice(0, 8);
  const ids = { show: uuid(), locked: uuid(), waiting: uuid(), plain: uuid() };
  const feed = async (at) => {
    const res = await request(app).get(`/api/v1/feed-posts?show_id=${ids.show}${at ? `&at=${at}` : ''}`);
    expect(res.status).toBe(200);
    return Object.fromEntries(res.body.data.map((p) => [p.id, p]));
  };

  beforeAll(async () => {
    await run(`INSERT INTO shows (id, name, slug, created_at, updated_at) VALUES (:show, :name, :slug, NOW(), NOW())`,
      { show: ids.show, name: `Curve ${tag}`, slug: `curve-${tag}` });
    // Three live posts after episode 1 (story order 17): two with numbers, one without.
    await run(`INSERT INTO feed_posts (id, show_id, poster_handle, content_text, likes, shares, comments_count, story_order, status, posted_at, created_at, updated_at) VALUES
      (:locked, :show, 'rival', 'Locked', 0, 0, 3, 17, 'live', NOW(), NOW(), NOW()),
      (:waiting, :show, 'lala', 'Waiting', 0, 0, 0, 17, 'live', NOW(), NOW(), NOW()),
      (:plain, :show, 'old', 'Old numbers', 42, 7, 1, 17, 'live', NOW(), NOW(), NOW())`, ids);
    await models.PulsePostNumber.bulkCreate([
      { post_id: ids.locked, show_id: ids.show, proposed_likes: 900, proposed_shares: 90, seed: 1, status: 'accepted', final_likes: 1000, final_shares: 100, story_order: 17 },
      { post_id: ids.waiting, show_id: ids.show, proposed_likes: 400, proposed_shares: 40, seed: 2, status: 'proposed', flag: 'lala', story_order: 17 },
    ]);
  });

  afterAll(async () => {
    await run('DELETE FROM pulse_post_numbers WHERE show_id = :show', ids);
    await run('DELETE FROM feed_posts WHERE show_id = :show', ids);
    await run('DELETE FROM shows WHERE id = :show', ids);
  });

  test('the same post at three moments grows, then settles; viral flags from the shown likes', async () => {
    const at17 = (await feed('ep:1:after_episode'))[ids.locked];
    expect(at17).toMatchObject({ likes: 550, shares: 55, is_viral: true, viral_reach: 1100 });
    expect((await feed('ep:1:next_day'))[ids.locked]).toMatchObject({ likes: 850, shares: 85 });
    expect((await feed('ep:1:week_later'))[ids.locked]).toMatchObject({ likes: 1000, shares: 100, is_viral: true, viral_reach: 2000 });
    expect((await feed('ep:3:during_episode'))[ids.locked]).toMatchObject({ likes: 1000, shares: 100 });
  });

  test('before its moment the post is not on the feed at all', async () => {
    expect((await feed('ep:1:during_episode'))[ids.locked]).toBeUndefined();
  });

  test('a proposal not yet decided grows on the same curve to its proposed numbers, never more; under the viral line it is not viral', async () => {
    expect((await feed('ep:1:after_episode'))[ids.waiting]).toMatchObject({ likes: 220, shares: 22, is_viral: false, viral_reach: 0 });
    expect((await feed('ep:1:week_later'))[ids.waiting]).toMatchObject({ likes: 400, shares: 40 });
  });

  test('the Director view (no ?at=) shows the final numbers; comments stay the real count; a post with no numbers is unchanged', async () => {
    const posts = await feed();
    expect(posts[ids.locked]).toMatchObject({ likes: 1000, shares: 100, comments_count: 3 });
    expect(posts[ids.waiting]).toMatchObject({ likes: 400, shares: 40 });
    expect(posts[ids.plain]).toMatchObject({ likes: 42, shares: 7, comments_count: 1 });
    expect((await feed('ep:1:after_episode'))[ids.locked].comments_count).toBe(3);
    expect((await feed('ep:1:after_episode'))[ids.plain]).toMatchObject({ likes: 42, shares: 7 });
    const [[stored]] = await run('SELECT likes, shares FROM feed_posts WHERE id = :locked', ids);
    expect(stored).toEqual({ likes: 0, shares: 0 });
  });
});
