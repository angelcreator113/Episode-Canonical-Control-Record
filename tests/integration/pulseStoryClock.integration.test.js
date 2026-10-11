/**
 * The story clock in The Pulse's reads (Task #2937; The Pulse spec §12 step
 * 4; services/storyClock.js). ?at= ("present", an order, or ep:<n>:<phase>)
 * reads The Pulse as of a story moment:
 * - GET /api/v1/feed-posts keeps posts no later than it (the stamp, else
 *   the episode and phase) and those of unknown story time, newest story
 *   time first; without it nothing changes;
 * - GET /api/v1/pulse-fits/latest follows the story clock (default the
 *   present), a tie going to the fit;
 * - GET /api/v1/social-profiles/lala/sidebar lists an event until its
 *   episode has ended by then.
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

(shouldSkip ? describe.skip : describe)('The Pulse story clock (Task #2937)', () => {
  const tag = uuid().slice(0, 8);
  const ids = {
    show: uuid(), ep1: uuid(), ep2: uuid(), lb1: uuid(), ev1: uuid(), ev2: uuid(),
    wall17: uuid(), wall27: uuid(), ep1before: uuid(), ep2after: uuid(), unknown: uuid(),
  };
  let token;
  const get = (url) => request(app).get(url).set('Authorization', `Bearer ${token}`);

  beforeAll(async () => {
    token = TokenService.generateTokenPair({
      id: 'test-user-pulse-clock', email: 'evoni@clock.dev', name: 'Clock Test', groups: ['USER', 'EDITOR'], role: 'USER',
    }).accessToken;
    await run(`INSERT INTO shows (id, name, slug, created_at, updated_at) VALUES (:show, :name, :slug, NOW(), NOW())`,
      { show: ids.show, name: `Clock ${tag}`, slug: `clock-${tag}` });
    // Episode 1 is published (the present is 17, after it); episode 2 is not.
    await run(`INSERT INTO episodes (id, show_id, title, episode_number, status, created_at, updated_at) VALUES
      (:ep1, :show, 'One', 1, 'published', NOW(), NOW()),
      (:ep2, :show, 'Two', 2, 'draft', NOW(), NOW())`, ids);
    const post = (id, extra, minutesAgo) => run(
      `INSERT INTO feed_posts (id, show_id, poster_handle, content_text, status, story_order, episode_id, timeline_position, posted_at, created_at, updated_at)
       VALUES (:id, :show, 'lala', :text, 'live', :order, :episode, :position, NOW() - (:ago * INTERVAL '1 minute'), NOW(), NOW())`,
      { id, show: ids.show, text: `post ${id}`, order: null, episode: null, position: null, ago: minutesAgo, ...extra });
    await post(ids.wall17, { order: 17 }, 50);
    await post(ids.wall27, { order: 27 }, 40);
    await post(ids.ep1before, { episode: ids.ep1, position: 'before_episode' }, 30);
    await post(ids.ep2after, { episode: ids.ep2, position: 'after_episode' }, 20);
    await post(ids.unknown, {}, 10);
  });

  afterAll(async () => {
    await run('DELETE FROM feed_posts WHERE show_id = :show', ids);
    await run('DELETE FROM pulse_fits WHERE show_id = :show', ids);
    await run('DELETE FROM episode_lookbook_images WHERE episode_id IN (:ep1, :ep2)', ids);
    await run('DELETE FROM episode_lookbooks WHERE episode_id IN (:ep1, :ep2)', ids);
    await run('DELETE FROM world_events WHERE show_id = :show', ids);
    await run('DELETE FROM episodes WHERE show_id = :show', ids);
    await run('DELETE FROM shows WHERE id = :show', ids);
  });

  const postIds = (res) => res.body.data.map((p) => p.id);

  it('without at, every live post, newest posted first (unchanged)', async () => {
    const res = await get(`/api/v1/feed-posts?show_id=${ids.show}`);
    expect(res.status).toBe(200);
    expect(postIds(res)).toEqual([ids.unknown, ids.ep2after, ids.ep1before, ids.wall27, ids.wall17]);
  });

  it('at=present keeps posts no later than after the latest published episode, and unknown ones, newest story time first', async () => {
    const res = await get(`/api/v1/feed-posts?show_id=${ids.show}&at=present&with=comments`);
    expect(res.status).toBe(200);
    expect(postIds(res)).toEqual([ids.wall17, ids.ep1before, ids.unknown]);
    expect(res.body.total).toBe(3);
    expect(res.body.hasMore).toBe(false);
  });

  it('an order or ep:<n>:<phase> reads as of that moment; bad values are refused', async () => {
    let res = await get(`/api/v1/feed-posts?show_id=${ids.show}&at=ep:2:after_episode`);
    // Both at 27: the tie goes to the newer posted_at.
    expect(postIds(res)).toEqual([ids.ep2after, ids.wall27, ids.wall17, ids.ep1before, ids.unknown]);
    res = await get(`/api/v1/feed-posts?show_id=${ids.show}&at=11`);
    expect(postIds(res)).toEqual([ids.ep1before, ids.unknown]);
    res = await get(`/api/v1/feed-posts?show_id=${ids.show}&at=ep:1:lala_arrives`);
    expect(postIds(res)).toEqual([ids.ep1before, ids.unknown]);
    expect((await get(`/api/v1/feed-posts?show_id=${ids.show}&at=tomorrow`)).status).toBe(400);
    expect((await get(`/api/v1/feed-posts?episode_id=${ids.ep1}&at=present`)).status).toBe(400);
  });

  it('the latest fit follows the story clock: the episode photo once it has ended, a tie to the fit', async () => {
    await run('INSERT INTO episode_lookbooks (id, episode_id) VALUES (:lb1, :ep1)', ids);
    await run(`INSERT INTO episode_lookbook_images (lookbook_id, episode_id, category, image_url, created_at)
               VALUES (:lb1, :ep1, 'front', 'https://cdn/ep1-front.jpg', NOW())`, ids);
    const url = (at) => `/api/v1/pulse-fits/latest?show_id=${ids.show}${at ? `&at=${at}` : ''}`;

    let res = await get(url());
    expect(res.status).toBe(200);
    expect(res.body.at).toBe(17);
    expect(res.body.latest).toMatchObject({ source: 'episode', image_url: 'https://cdn/ep1-front.jpg', story_order: 17 });
    res = await get(url('15'));
    expect(res.body.latest).toBeNull();

    // A fit uploaded after episode 1 (17) wins the tie; one stamped later in story time waits for its moment.
    await run(`INSERT INTO pulse_fits (show_id, image_url, caption, story_order, created_at, updated_at) VALUES
      (:show, 'https://cdn/fit17.jpg', 'Coffee run', 17, NOW() - INTERVAL '1 day', NOW()),
      (:show, 'https://cdn/fit27.jpg', 'Gala prep', 27, NOW() - INTERVAL '2 days', NOW())`, ids);
    res = await get(url());
    expect(res.body.latest).toMatchObject({ source: 'fit', image_url: 'https://cdn/fit17.jpg' });
    res = await get(url('ep:2:after_episode'));
    expect(res.body.latest).toMatchObject({ source: 'fit', image_url: 'https://cdn/fit27.jpg' });
    expect((await get(url('soon'))).status).toBe(400);
  });

  it('the sidebar lists an event until its episode has ended by the moment it is read at', async () => {
    const event = (id, name, episode) => run(
      `INSERT INTO world_events (id, show_id, name, status, used_in_episode_id, created_at, updated_at)
       VALUES (:id, :show, :name, 'used', :episode, NOW(), NOW())`, { id, show: ids.show, name, episode });
    await event(ids.ev1, `Opening ${tag}`, ids.ep1);
    await event(ids.ev2, `Gala ${tag}`, ids.ep2);
    const names = (res) => res.body.data.upcoming.map((e) => e.name).sort();

    let res = await get(`/api/v1/social-profiles/lala/sidebar?show_id=${ids.show}`);
    expect(res.status).toBe(200);
    expect(names(res)).toEqual([`Gala ${tag}`]);
    res = await get(`/api/v1/social-profiles/lala/sidebar?show_id=${ids.show}&at=present`);
    expect(names(res)).toEqual([`Gala ${tag}`]);
    res = await get(`/api/v1/social-profiles/lala/sidebar?show_id=${ids.show}&at=ep:1:during_episode`);
    expect(names(res)).toEqual([`Gala ${tag}`, `Opening ${tag}`]);
    res = await get(`/api/v1/social-profiles/lala/sidebar?show_id=${ids.show}&at=27`);
    expect(names(res)).toEqual([]);
    expect((await get(`/api/v1/social-profiles/lala/sidebar?show_id=${ids.show}&at=x`)).status).toBe(400);
  });
});
