/**
 * Share saves a draft with story time; Release makes it live (Task #2748).
 * A draft shared on the wall carries its story time (story_order, after the
 * latest published episode) and no posted_at; Release sets it live and
 * posts it now; a live post can no longer be edited, only deleted, and a
 * deleted post stays listed for the signed-in author only.
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

const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });

(shouldSkip ? describe.skip : describe)('Share a draft, then Release it', () => {
  let token;
  const showId = crypto.randomUUID();

  beforeAll(async () => {
    token = TokenService.generateTokenPair({
      id: 'test-user-feed-release', email: 'test@feed-release.dev', name: 'Feed Release', groups: ['USER', 'EDITOR'], role: 'USER',
    }).accessToken;
    await run('INSERT INTO shows (id, name, slug, created_at, updated_at) VALUES (:id, :name, :slug, NOW(), NOW())',
      { id: showId, name: `Release ${showId.slice(0, 8)}`, slug: `rel-${showId.slice(0, 8)}` });
  });

  afterAll(async () => {
    await run('DELETE FROM feed_posts WHERE show_id = :showId', { showId });
    await run('DELETE FROM shows WHERE id = :showId', { showId });
  });

  const auth = (r) => r.set('Authorization', `Bearer ${token}`);

  it('a shared draft has story time and no posted_at; it is not on the wall', async () => {
    const res = await auth(request(app).post('/api/v1/feed-posts')).send({ show_id: showId, content_text: 'is not doing this again.', poster_handle: 'lala', status: 'draft' });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ status: 'draft', posted_at: null });
    expect(Number.isInteger(res.body.data.story_order)).toBe(true);
    const wall = await request(app).get(`/api/v1/feed-posts?show_id=${showId}`);
    expect(wall.body.data.map((p) => p.id)).not.toContain(res.body.data.id);
  });

  it('a draft can be edited; Release makes it live, posted now, and then it is locked', async () => {
    const draft = (await auth(request(app).post('/api/v1/feed-posts')).send({ show_id: showId, content_text: 'First words.', status: 'draft' })).body.data;
    const edited = await auth(request(app).put(`/api/v1/feed-posts/${draft.id}`)).send({ content_text: 'Better words.' });
    expect(edited.body.data).toMatchObject({ content_text: 'Better words.', status: 'draft', posted_at: null });

    const before = Date.now();
    const released = await auth(request(app).put(`/api/v1/feed-posts/${draft.id}`)).send({ status: 'live' });
    expect(released.status).toBe(200);
    expect(released.body.data.status).toBe('live');
    expect(new Date(released.body.data.posted_at).getTime()).toBeGreaterThanOrEqual(before - 1000);
    expect(released.body.data.story_order).toBe(draft.story_order);

    const wall = await request(app).get(`/api/v1/feed-posts?show_id=${showId}`);
    expect(wall.body.data.map((p) => p.id)).toContain(draft.id);
    expect((await auth(request(app).put(`/api/v1/feed-posts/${draft.id}`)).send({ content_text: 'Too late.' })).status).toBe(409);
  });

  it('a deleted post is kept, listed for the signed-in author only', async () => {
    const draft = (await auth(request(app).post('/api/v1/feed-posts')).send({ show_id: showId, content_text: 'Never mind.', status: 'draft' })).body.data;
    expect((await auth(request(app).delete(`/api/v1/feed-posts/${draft.id}`))).status).toBe(200);
    const [[row]] = await run('SELECT deleted_at FROM feed_posts WHERE id = :id', { id: draft.id });
    expect(row.deleted_at).not.toBeNull();
    expect((await auth(request(app).get(`/api/v1/feed-posts/deleted?show_id=${showId}`))).body.data.map((p) => p.id)).toContain(draft.id);
    expect((await request(app).get(`/api/v1/feed-posts/deleted?show_id=${showId}`)).status).toBe(401);
  });
});
