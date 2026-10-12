/**
 * City feeds (Task #2987; The Pulse spec §3 "each Dream City has its own feed
 * and local trends"), against the test database:
 * - GET /feed-posts?city= keeps the live posts of that city's profiles (a
 *   post's city is its poster's), with ?at= as before;
 * - GET /feed-enhanced/:showId/trending?at= counts only posts at or before
 *   the moment, leaving out a character Lala has not met yet; ?city= counts
 *   one city's posts;
 * - an unknown city is a 400.
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

(shouldSkip ? describe.skip : describe)('The Pulse city feeds (Task #2987)', () => {
  const tag = uuid().slice(0, 8);
  const ids = { show: uuid(), ep1: uuid() };
  const p = {};
  let token;
  const as = (req) => req.set('Authorization', `Bearer ${token}`);
  const post = (key, order, text, status = 'live') => models.FeedPost.create({
    show_id: ids.show, social_profile_id: p[key], poster_handle: `${key}${tag}`, poster_display_name: key, poster_platform: 'lalaverse',
    post_type: 'post', content_text: text, status, story_order: order, likes: 0, comments_count: 0, shares: 0, sample_comments: [], sort_order: 0,
  });
  const handles = (res) => res.body.data.map((x) => x.poster_handle).sort();
  const topics = (res) => res.body.data.map((t) => t.topic).sort();

  beforeAll(async () => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    token = TokenService.generateTokenPair({ id: 'test-city', email: 'evoni@city.dev', name: 'Evoni', groups: ['ADMIN'], role: 'ADMIN' }).accessToken;
    await run(`INSERT INTO shows (id, name, slug, created_at, updated_at) VALUES (:show, :name, :slug, NOW(), NOW())`,
      { show: ids.show, name: `Cities ${tag}`, slug: `cities-${tag}` });
    await run(`INSERT INTO episodes (id, show_id, title, episode_number, status, created_at, updated_at)
               VALUES (:ep1, :show, 'One', 1, 'published', NOW(), NOW())`, ids);
    for (const [key, city] of [['marcus', 'dazzle_district'], ['kim', 'dazzle_district'], ['nia', 'echo_park'], ['old', 'nova_prime']]) {
      const [[row]] = await run(`INSERT INTO social_profiles (handle, platform, vibe_sentence, display_name, feed_layer, city, created_at, updated_at)
        VALUES (:handle, 'instagram', 'test', :display, 'lalaverse', :city, NOW(), NOW()) RETURNING id`, { handle: `${key}${tag}`, display: key, city });
      p[key] = row.id;
    }
    await post('marcus', 11, 'that runway though #GalaNight');
    await post('kim', 12, 'front row #GalaNight');
    await post('marcus', 21, 'next week already #LaterTag');
    await post('marcus', 11, 'not yet #DraftTag', 'draft');
    await post('nia', 11, 'the club tonight #EchoNights');
    await post('old', 11, 'legacy city #OldTown');
    // Lala has not met Kim until long after: her posts are hidden at 15.
    await models.PulseReveal.create({ show_id: ids.show, item_type: 'character', item_id: String(p.kim), moment: 'story_time', story_order: 999, mode: 'hidden', source: 'set' });
  });

  afterAll(async () => {
    await run('DELETE FROM pulse_reveals WHERE show_id = :show', ids);
    await run('DELETE FROM pulse_post_numbers WHERE show_id = :show', ids);
    await run('DELETE FROM feed_posts WHERE show_id = :show', ids);
    await run('DELETE FROM episodes WHERE show_id = :show', ids);
    await run('DELETE FROM social_profiles WHERE id IN (:a)', { a: Object.values(p) });
    await run('DELETE FROM shows WHERE id = :show', ids);
  });

  test("a city's feed: its profiles' live posts only, with ?at= and reveals as before", async () => {
    const all = await request(app).get(`/api/v1/feed-posts?show_id=${ids.show}&city=dazzle_district`);
    expect(all.status).toBe(200);
    expect(handles(all)).toEqual([`kim${tag}`, `marcus${tag}`, `marcus${tag}`]);
    const at15 = await request(app).get(`/api/v1/feed-posts?show_id=${ids.show}&city=dazzle_district&at=15`);
    expect(handles(at15)).toEqual([`marcus${tag}`]);   // the later post and hidden Kim are left out
    expect(at15.body.total).toBe(1);
    const echo = await request(app).get(`/api/v1/feed-posts?show_id=${ids.show}&city=echo_park&at=15`);
    expect(handles(echo)).toEqual([`nia${tag}`]);
    expect((await request(app).get(`/api/v1/feed-posts?show_id=${ids.show}&city=nova_prime`)).status).toBe(400);
    expect((await request(app).get(`/api/v1/feed-posts?show_id=${ids.show}&city=x'; drop`)).status).toBe(400);
    // Without ?city= nothing changes.
    expect((await request(app).get(`/api/v1/feed-posts?show_id=${ids.show}&at=15`)).body.total).toBe(3);
  });

  test('trends as of a story moment, without a hidden character; local trends per city', async () => {
    const now = await as(request(app).get(`/api/v1/feed-enhanced/${ids.show}/trending`));
    expect(now.status).toBe(200);
    expect(topics(now)).toEqual(['#EchoNights', '#GalaNight', '#LaterTag', '#OldTown']);
    expect(now.body.data.find((t) => t.topic === '#GalaNight').post_count).toBe(2);
    const at15 = await as(request(app).get(`/api/v1/feed-enhanced/${ids.show}/trending?at=15`));
    expect(topics(at15)).toEqual(['#EchoNights', '#GalaNight', '#OldTown']);
    expect(at15.body.data.find((t) => t.topic === '#GalaNight').post_count).toBe(1);   // Kim's is hidden at 15
    const local = await as(request(app).get(`/api/v1/feed-enhanced/${ids.show}/trending?city=dazzle_district&at=ep:1:after_episode`));
    expect(topics(local)).toEqual(['#GalaNight']);
    expect((await as(request(app).get(`/api/v1/feed-enhanced/${ids.show}/trending?city=atlantis`))).status).toBe(400);
    expect((await as(request(app).get(`/api/v1/feed-enhanced/${ids.show}/trending?at=soon`))).status).toBe(400);
  });
});
