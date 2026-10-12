/**
 * Post numbers in Review (Task #2954; The Pulse spec §8): the waiting
 * numbers are listed with their post and factors, and Evoni decides each
 * one: Accept, Adjust (a one-line reason), Make it viral, Make it flop.
 * A decision records who and when, and locks the numbers. Decisions are
 * admin only.
 */
jest.unmock('uuid');

const request = require('supertest');
const crypto = require('crypto');
const app = require('../../src/app');
const TokenService = require('../../src/services/tokenService');
const models = require('../../src/models');
const { VIRAL_MULTIPLE, FLOP_FRACTION } = require('../../src/services/pulseNumbers');

const { sequelize } = models;

const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const uuid = () => crypto.randomUUID();
const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });

(shouldSkip ? describe.skip : describe)('The Pulse numbers in Review (Task #2954)', () => {
  const tag = uuid().slice(0, 8);
  const ids = { show: uuid() };
  let admin;
  let editor;
  const as = (token, req) => req.set('Authorization', `Bearer ${token}`);
  const put = (id, action, body = {}, token = admin) => as(token, request(app).put(`/api/v1/pulse-numbers/${id}/${action}`)).send(body);

  /** A live post and its waiting numbers: 1,000 likes and 80 shares proposed. */
  const waiting = async (flag = 'lala') => {
    const postId = uuid();
    await run(`INSERT INTO feed_posts (id, show_id, poster_handle, post_type, content_text, image_url, status, created_at, updated_at)
               VALUES (:postId, :show, 'lala', 'post', :text, 'fit.jpg', 'live', NOW(), NOW())`, { postId, show: ids.show, text: `A look ${tag}` });
    const row = await models.PulsePostNumber.create({
      post_id: postId, show_id: ids.show, poster_handle: 'lala', proposed_likes: 1000, proposed_shares: 80,
      factors_json: { followers: 50000, followers_from: 'ledger', kind: 'fit', trending: true, episode_tier: 'pass', random: 1.02 },
      seed: 7, status: 'proposed', flag, story_order: 17,
    });
    return row.id;
  };

  beforeAll(async () => {
    admin = TokenService.generateTokenPair({ id: 'test-admin-numrev', email: 'evoni@numrev.dev', name: 'Evoni', groups: ['ADMIN'], role: 'ADMIN' }).accessToken;
    editor = TokenService.generateTokenPair({ id: 'test-editor-numrev', email: 'ed@numrev.dev', name: 'Ed', groups: ['USER', 'EDITOR'], role: 'USER' }).accessToken;
    await run(`INSERT INTO shows (id, name, slug, created_at, updated_at) VALUES (:show, :name, :slug, NOW(), NOW())`,
      { show: ids.show, name: `Numbers review ${tag}`, slug: `numrev-${tag}` });
  });

  afterAll(async () => {
    await run('DELETE FROM pulse_post_numbers WHERE show_id = :show', ids);
    await run('DELETE FROM feed_posts WHERE show_id = :show', ids);
    await run('DELETE FROM shows WHERE id = :show', ids);
  });

  test('the waiting numbers, with their post, poster and factors', async () => {
    const id = await waiting('about_lala');
    expect((await request(app).get(`/api/v1/pulse-numbers?show_id=${ids.show}`)).status).toBe(401);
    expect((await as(admin, request(app).get('/api/v1/pulse-numbers?show_id=nope'))).status).toBe(400);
    expect((await as(admin, request(app).get(`/api/v1/pulse-numbers?show_id=${ids.show}&status=maybe`))).status).toBe(400);
    const res = await as(editor, request(app).get(`/api/v1/pulse-numbers?show_id=${ids.show}`));
    expect(res.status).toBe(200);
    const row = res.body.numbers.find((n) => n.id === id);
    expect(res.body.total).toBeGreaterThanOrEqual(1);
    expect(row).toMatchObject({
      proposed: { likes: 1000, shares: 80 }, final: null, status: 'proposed', flag: 'about_lala',
      factors: { followers: 50000, kind: 'fit', trending: true, episode_tier: 'pass' },
      post: { content_text: `A look ${tag}`, poster_handle: 'lala', image_url: 'fit.jpg' },
    });
  });

  test('decisions are admin only', async () => {
    const id = await waiting();
    for (const action of ['accept', 'adjust', 'viral', 'flop']) {
      expect((await put(id, action, { likes: 1, shares: 1, reason: 'x' }, editor)).status).toBe(403);
    }
    expect((await request(app).put(`/api/v1/pulse-numbers/${id}/accept`)).status).toBe(401);
    expect((await put(uuid(), 'accept')).status).toBe(404);
  });

  test('Accept keeps the proposal, records who and when, and locks', async () => {
    const id = await waiting();
    const res = await put(id, 'accept');
    expect(res.status).toBe(200);
    expect(res.body.numbers).toMatchObject({ status: 'accepted', final: { likes: 1000, shares: 80 }, decided_by: 'evoni@numrev.dev' });
    expect(res.body.numbers.decided_at).toBeTruthy();
    for (const action of ['accept', 'viral', 'flop']) expect((await put(id, action)).status).toBe(409);
    expect((await put(id, 'adjust', { likes: 5, shares: 1, reason: 'Again' })).status).toBe(409);
    const listed = await as(admin, request(app).get(`/api/v1/pulse-numbers?show_id=${ids.show}`));
    expect(listed.body.numbers.map((n) => n.id)).not.toContain(id);
    const accepted = await as(admin, request(app).get(`/api/v1/pulse-numbers?show_id=${ids.show}&status=accepted`));
    expect(accepted.body.numbers.map((n) => n.id)).toContain(id);
  });

  test('Adjust needs whole numbers and a one-line reason', async () => {
    const id = await waiting();
    expect((await put(id, 'adjust', { likes: 1200, shares: 90 })).status).toBe(400);
    expect((await put(id, 'adjust', { likes: 1200, shares: 90, reason: '   ' })).status).toBe(400);
    expect((await put(id, 'adjust', { likes: 1200, shares: 90, reason: 'Two\nlines' })).status).toBe(400);
    expect((await put(id, 'adjust', { likes: -1, shares: 90, reason: 'x' })).status).toBe(400);
    expect((await put(id, 'adjust', { likes: '1200', shares: 90, reason: 'x' })).status).toBe(400);
    const res = await put(id, 'adjust', { likes: 1200, shares: 90, reason: ' Her first look after the gala. ' });
    expect(res.status).toBe(200);
    expect(res.body.numbers).toMatchObject({ status: 'adjusted', final: { likes: 1200, shares: 90 }, reason: 'Her first look after the gala.' });
  });

  test('Make it viral and Make it flop scale the proposal, with their reasons', async () => {
    const viral = await put(await waiting(), 'viral');
    expect(viral.body.numbers).toMatchObject({ status: 'viral', reason: 'Made viral', final: { likes: 1000 * VIRAL_MULTIPLE, shares: 80 * VIRAL_MULTIPLE } });
    const flop = await put(await waiting(), 'flop');
    expect(flop.body.numbers).toMatchObject({ status: 'flop', reason: 'Made a flop', final: { likes: Math.round(1000 * FLOP_FRACTION), shares: Math.round(80 * FLOP_FRACTION) } });
  });
});
