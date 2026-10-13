/**
 * Beat pinning (Task #3111; Evoni, 2026-10-13: "pinning a moment per Phone
 * beat is the next small step"), against the test database:
 * - PUT /feed-enhanced/:showId/moments/:momentId/phase pins a moment to a
 *   story moment of its episode, or back to During (null); an unknown phase
 *   is a 400, another show's moment a 404;
 * - a pin earlier than the post the moment shows is refused (409);
 * - linking a post checks it against the moment's pin, not During;
 * - the GET returns each moment's pin.
 */
jest.unmock('uuid');

const request = require('supertest');
const crypto = require('crypto');
const app = require('../../src/app');
const TokenService = require('../../src/services/tokenService');
const models = require('../../src/models');
const { checkAtBeat } = require('../../src/services/storyClock');

const { sequelize } = models;

const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const uuid = () => crypto.randomUUID();
const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });

(shouldSkip ? describe.skip : describe)('Beat pinning (Task #3111)', () => {
  const tag = uuid().slice(0, 8);
  const ids = { show: uuid(), other: uuid(), ep3: uuid() };
  let token;
  let moment;
  let afterPost;
  const as = (req) => req.set('Authorization', `Bearer ${token}`);
  const pin = (momentId, story_phase, show = ids.show) => as(request(app).put(`/api/v1/feed-enhanced/${show}/moments/${momentId}/phase`)).send({ story_phase });
  const link = (momentId, feed_post_id) => as(request(app).put(`/api/v1/feed-enhanced/${ids.show}/moments/${momentId}/post`)).send({ feed_post_id });

  beforeAll(async () => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    token = TokenService.generateTokenPair({ id: 'test-beat-pin', email: 'evoni@beatpin.dev', name: 'Evoni', groups: ['ADMIN'], role: 'ADMIN' }).accessToken;
    await run(`INSERT INTO shows (id, name, slug, created_at, updated_at) VALUES (:show, :n1, :s1, NOW(), NOW()), (:other, :n2, :s2, NOW(), NOW())`,
      { ...ids, n1: `Beat ${tag}`, s1: `beat-${tag}`, n2: `Beat other ${tag}`, s2: `beat-other-${tag}` });
    await run(`INSERT INTO episodes (id, show_id, title, episode_number, status, created_at, updated_at) VALUES (:ep3, :show, 'Three', 3, 'draft', NOW(), NOW())`, ids);
    moment = await models.FeedMoment.create({ show_id: ids.show, episode_id: ids.ep3, beat_number: 2, phone_screen_type: 'dm', screen_content: 'are you coming?' });
    // A live post at After Ep 3 (37): a beat at During (35) is too early for it.
    afterPost = await models.FeedPost.create({
      show_id: ids.show, poster_handle: `p${tag}`, poster_platform: 'lalaverse', post_type: 'post', content_text: 'after the gala',
      status: 'live', story_order: 37, likes: 0, comments_count: 0, shares: 0, sample_comments: [], sort_order: 0,
    });
  });

  afterAll(async () => {
    await run('DELETE FROM feed_moments WHERE show_id = :show', ids);
    await run('DELETE FROM feed_posts WHERE show_id = :show', ids);
    await run('DELETE FROM episodes WHERE show_id = :show', ids);
    await run('DELETE FROM shows WHERE id IN (:a)', { a: [ids.show, ids.other] });
  });

  test('a moment is pinned to a story moment, and back to During; bad input is refused', async () => {
    let res = await pin(moment.id, 'lala_arrives');
    expect(res.status).toBe(200);
    expect(res.body.data.story_phase).toBe('lala_arrives');
    const list = await as(request(app).get(`/api/v1/feed-enhanced/${ids.show}/moments/${ids.ep3}`));
    expect(list.body.data.find((m) => m.id === moment.id).story_phase).toBe('lala_arrives');
    res = await pin(moment.id, 'during_episode');
    expect(res.body.data.story_phase).toBeNull();
    expect((await pin(moment.id, 'last_tuesday')).status).toBe(400);
    expect((await pin(moment.id, 'after_episode', ids.other)).status).toBe(404);
    expect((await request(app).put(`/api/v1/feed-enhanced/${ids.show}/moments/${moment.id}/phase`).send({ story_phase: null })).status).toBe(401);
  });

  test("linking a post checks the moment's pin: an After post fits a beat pinned After, not one at During", async () => {
    expect((await link(moment.id, afterPost.id)).status).toBe(409);   // During, as before
    expect((await pin(moment.id, 'after_episode')).status).toBe(200);
    const linked = await link(moment.id, afterPost.id);
    expect(linked.status).toBe(200);
    expect(linked.body.data.feed_post_id).toBe(afterPost.id);
    // Pinning it earlier than its post is refused, and the pin stays.
    const earlier = await pin(moment.id, 'lala_arrives');
    expect(earlier.status).toBe(409);
    expect(earlier.body.error).toMatch(/After Ep 3; a beat at Lala arrives Ep 3 is earlier in story time/);
    expect((await models.FeedMoment.findByPk(moment.id)).story_phase).toBe('after_episode');
  });

  test('checkAtBeat reads a pinned phase; without one, During as before', () => {
    expect(checkAtBeat(37, 3)).toMatchObject({ ok: false });
    expect(checkAtBeat(37, 3, 'after_episode')).toEqual({ ok: true, check: 'ok' });
    expect(checkAtBeat(34, 3, 'lala_arrives')).toEqual({ ok: true, check: 'ok' });
    expect(checkAtBeat(35, 3, 'lala_arrives').message).toMatch(/During Ep 3; a beat at Lala arrives Ep 3/);
  });
});
