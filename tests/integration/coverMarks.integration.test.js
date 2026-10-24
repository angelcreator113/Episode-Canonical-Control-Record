/**
 * Her marks on the Script tab's must-cover list (Script tab audit 6,
 * 2026-10-24; Evoni: "smarter matching + manual override"): PUT
 * /episode-brief/:episodeId/cover-marks keeps each in
 * episode_briefs.event_metadata.cover_marks, leaves the rest of
 * event_metadata as it was, takes one back with covered: null, and two
 * marks at once both stay. On the test database.
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
const TAG = uuid().slice(0, 8);
const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });

(shouldSkip ? describe.skip : describe)('cover marks', () => {
  const show = uuid();
  const ep = uuid();
  let token;
  const url = `/api/v1/episode-brief/${ep}/cover-marks`;
  const put = (body, t = token) => {
    const r = request(app).put(url);
    return (t ? r.set('Authorization', `Bearer ${t}`) : r).send(body);
  };
  const meta = async () => {
    const [[row]] = await run('SELECT event_metadata FROM episode_briefs WHERE episode_id = :ep', { ep });
    return row.event_metadata;
  };

  beforeAll(async () => {
    token = TokenService.generateTokenPair({ id: 'test-user-cover', email: 'user@cover.dev', name: 'Editor', groups: ['USER'], role: 'USER' }).accessToken;
    await run(`INSERT INTO shows (id, name, slug, metadata, created_at, updated_at) VALUES (:show, :name, :slug, CAST('{}' AS jsonb), NOW(), NOW())`,
      { show, name: `Cover ${TAG}`, slug: `cover-${TAG}` });
    await run(`INSERT INTO episodes (id, show_id, title, episode_number, status, created_at, updated_at) VALUES (:ep, :show, 'The Gala', 3, 'draft', NOW(), NOW())`, { ep, show });
    await run(`INSERT INTO episode_briefs (id, episode_id, show_id, status, event_metadata, created_at, updated_at)
      VALUES (:id, :ep, :show, 'locked', CAST(:meta AS jsonb), NOW(), NOW())`, { id: uuid(), ep, show, meta: JSON.stringify({ feed_moment_save: { ok: true } }) });
  });
  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => jest.restoreAllMocks());
  afterAll(async () => {
    await run('DELETE FROM episode_briefs WHERE episode_id = :ep', { ep });
    await run('DELETE FROM episodes WHERE id = :ep', { ep });
    await run('DELETE FROM shows WHERE id = :show', { show });
    await sequelize.close();
  });

  test('signed in only; a bad key, covered or beat is a 400', async () => {
    expect((await put({ key: 'hook', covered: true }, null)).status).toBe(401);
    expect((await put({ key: 'nope', covered: true })).status).toBe(400);
    expect((await put({ key: 'hook', covered: 'yes' })).status).toBe(400);
    expect((await put({ key: 'hook', covered: true, beat: 15 })).status).toBe(400);
  });

  test('a mark is kept by key, on a locked brief too, and the rest of event_metadata stays', async () => {
    const res = await put({ key: 'goal:relationship_guest:get-to-know-truthville', covered: true, beat: 11 });
    expect(res.status).toBe(200);
    expect(res.body.data.cover_marks['goal:relationship_guest:get-to-know-truthville']).toMatchObject({ covered: true, beat: 11, by: 'test-user-cover' });
    const m = await meta();
    expect(m.feed_moment_save).toEqual({ ok: true });
    expect(m.cover_marks['goal:relationship_guest:get-to-know-truthville'].at).toEqual(expect.any(String));
  });

  test('two marks at once both stay; covered: null takes one back', async () => {
    await Promise.all([put({ key: 'hook', covered: false }), put({ key: 'opportunity', covered: true })]);
    let m = await meta();
    expect(m.cover_marks.hook).toMatchObject({ covered: false });
    expect(m.cover_marks.opportunity).toMatchObject({ covered: true });
    expect(m.cover_marks.hook.beat).toBeUndefined();
    await put({ key: 'hook', covered: null });
    m = await meta();
    expect(m.cover_marks.hook).toBeUndefined();
    expect(m.cover_marks.opportunity).toMatchObject({ covered: true });
  });

  test('no brief, a 404', async () => {
    const res = await request(app).put(`/api/v1/episode-brief/${uuid()}/cover-marks`).set('Authorization', `Bearer ${token}`).send({ key: 'hook', covered: true });
    expect(res.status).toBe(404);
  });
});
