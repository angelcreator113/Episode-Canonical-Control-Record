/**
 * Admin › The Pulse › Calendar (Task #2988; The Pulse spec §4), against the
 * test database: GET /api/v1/pulse-calendar puts posts (drafts marked),
 * reveals, events (their free-text date as written), and closeness changes
 * on one story-time line, in order; from/to narrow it; posts and reveals
 * with no story time yet are counted apart; rejected closeness is left out.
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

(shouldSkip ? describe.skip : describe)('The Pulse calendar (Task #2988)', () => {
  const tag = uuid().slice(0, 8);
  const ids = { show: uuid(), ep1: uuid(), ep2: uuid(), gala: uuid() };
  const p = {};
  const posts = {};
  let token;
  const get = (qs = '') => request(app).get(`/api/v1/pulse-calendar?show_id=${ids.show}${qs}`).set('Authorization', `Bearer ${token}`);
  const post = (key, fields) => models.FeedPost.create({
    show_id: ids.show, social_profile_id: p.marcus, poster_handle: `marcus${tag}`, poster_display_name: 'marcus', poster_platform: 'lalaverse',
    post_type: 'post', likes: 0, comments_count: 0, shares: 0, sample_comments: [], sort_order: 0, ...fields,
  }).then((row) => { posts[key] = row.id; return row; });

  beforeAll(async () => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    token = TokenService.generateTokenPair({ id: 'test-cal', email: 'evoni@cal.dev', name: 'Evoni', groups: ['ADMIN'], role: 'ADMIN' }).accessToken;
    await run(`INSERT INTO shows (id, name, slug, created_at, updated_at) VALUES (:show, :name, :slug, NOW(), NOW())`,
      { show: ids.show, name: `Calendar ${tag}`, slug: `calendar-${tag}` });
    await run(`INSERT INTO episodes (id, show_id, title, episode_number, status, created_at, updated_at) VALUES
      (:ep1, :show, 'One', 1, 'published', NOW(), NOW()), (:ep2, :show, 'Two', 2, 'draft', NOW(), NOW())`, ids);
    await run(`INSERT INTO world_events (id, show_id, name, status, used_in_episode_id, event_date, venue_name, created_at, updated_at)
               VALUES (:gala, :show, :name, 'used', :ep1, 'Friday, March 15th', 'The Glasshouse', NOW(), NOW())`, { ...ids, name: `Gala ${tag}` });
    for (const key of ['marcus', 'kim']) {
      const [[row]] = await run(`INSERT INTO social_profiles (handle, platform, vibe_sentence, display_name, feed_layer, created_at, updated_at)
        VALUES (:handle, 'instagram', 'test', :display, 'lalaverse', NOW(), NOW()) RETURNING id`, { handle: `${key}${tag}`, display: key });
      p[key] = row.id;
    }
    await post('live17', { content_text: 'the gala was a whole moment', status: 'live', story_order: 17 });
    await post('draft15', { content_text: 'getting ready', status: 'draft', story_order: 15 });
    await post('fromEpisode', { content_text: 'from the episode', status: 'live', episode_id: ids.ep1, timeline_position: 'after_episode' });
    await post('unplaced', { content_text: 'no story time yet', status: 'live' });
    await post('deleted', { content_text: 'gone', status: 'live', story_order: 17 });
    await models.FeedPost.destroy({ where: { id: posts.deleted } });
    await models.PulseReveal.create({ show_id: ids.show, item_type: 'post', item_id: posts.live17, moment: 'story_time', story_order: 27, mode: 'teaser', source: 'set' });
    await models.PulseReveal.create({ show_id: ids.show, item_type: 'event', item_id: ids.gala, event_id: ids.gala, moment: 'announced', mode: 'hidden', source: 'set' });
    await models.PulseReveal.create({ show_id: ids.show, item_type: 'image', item_id: 'cover', image_kind: 'cover', moment: 'story_time', story_order: null, mode: 'teaser', source: 'set' });
    const [x, y] = p.marcus < p.kim ? [p.marcus, p.kim] : [p.kim, p.marcus];
    await models.PulseCloseness.create({ show_id: ids.show, profile_a_id: x, profile_b_id: y, story_order: 17, delta: 0.03, closeness_after: 0.73, cause: 'comment', status: 'accepted' });
    await models.PulseCloseness.create({ show_id: ids.show, profile_a_id: x, profile_b_id: y, story_order: 17, delta: -0.02, closeness_after: 0.71, cause: 'ignored', status: 'rejected' });
  });

  afterAll(async () => {
    await run('DELETE FROM pulse_closeness WHERE show_id = :show', ids);
    await run('DELETE FROM pulse_reveals WHERE show_id = :show', ids);
    await run('DELETE FROM pulse_post_numbers WHERE show_id = :show', ids);
    await run('DELETE FROM feed_posts WHERE show_id = :show', ids);
    await run('DELETE FROM world_events WHERE show_id = :show', ids);
    await run('DELETE FROM episodes WHERE show_id = :show', ids);
    await run('DELETE FROM social_profiles WHERE id IN (:a)', { a: Object.values(p) });
    await run('DELETE FROM shows WHERE id = :show', ids);
  });

  test('every post, reveal, event and closeness change on one story-time line, in order', async () => {
    const res = await get();
    expect(res.status).toBe(200);
    const byOrder = Object.fromEntries(res.body.moments.map((m) => [m.order, m]));
    expect(res.body.moments.map((m) => m.order)).toEqual([12, 15, 17, 27]);
    expect(byOrder[12]).toMatchObject({ label: 'Announced Ep 1' });
    expect(byOrder[12].reveals).toEqual([expect.objectContaining({ item_type: 'event', item_id: ids.gala, moment: 'announced', mode: 'hidden' })]);
    expect(byOrder[15].posts).toEqual([expect.objectContaining({ id: posts.draft15, status: 'draft', text: 'getting ready' })]);
    expect(byOrder[15].events).toEqual([{ id: ids.gala, name: `Gala ${tag}`, episode_number: 1, date: 'Friday, March 15th', time: null, venue: 'The Glasshouse' }]);
    expect(byOrder[17].label).toBe('After Ep 1');
    expect(byOrder[17].posts.map((x) => x.id).sort()).toEqual([posts.live17, posts.fromEpisode].sort());
    expect(byOrder[17].closeness).toEqual([expect.objectContaining({ cause: 'comment', status: 'accepted', delta: 0.03 })]);
    expect([byOrder[17].closeness[0].a, byOrder[17].closeness[0].b].sort()).toEqual([`kim${tag}`, `marcus${tag}`].sort());
    expect(byOrder[27].reveals).toEqual([expect.objectContaining({ item_type: 'post', item_id: posts.live17, mode: 'teaser' })]);
    expect(res.body.unplaced).toEqual({ posts: 1, reveals: 1 });
  });

  test('from and to narrow the line, as orders or episode moments; bad bounds are a 400; it needs a login', async () => {
    const res = await get('&from=15&to=ep:1:after_episode');
    expect(res.body.moments.map((m) => m.order)).toEqual([15, 17]);
    expect(res.body).toMatchObject({ from: 15, to: 17 });
    expect((await get('&from=soon')).status).toBe(400);
    expect((await request(app).get(`/api/v1/pulse-calendar?show_id=${ids.show}`)).status).toBe(401);
    expect((await get().query({ show_id: 'nope' })).status).toBe(400);
  });
});
