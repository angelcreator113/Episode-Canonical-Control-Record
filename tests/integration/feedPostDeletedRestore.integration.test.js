/**
 * Lala's Feed → Deleted (Evoni, 2026-10-05): a deleted post is listed
 * under the show's deleted posts and can be restored as it was; a live
 * post cannot be redrafted.
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

(shouldSkip ? describe.skip : describe)('deleted feed posts', () => {
  let token;
  const showId = crypto.randomUUID();

  beforeAll(async () => {
    token = TokenService.generateTokenPair({
      id: 'test-user-feed-deleted', email: 'test@feed.dev', name: 'Feed Test', groups: ['USER', 'EDITOR'], role: 'USER',
    }).accessToken;
    await run(`INSERT INTO shows (id, name, slug, created_at, updated_at) VALUES (:id, :name, :slug, NOW(), NOW())`,
      { id: showId, name: `Feed ${showId.slice(0, 8)}`, slug: `fd-${showId.slice(0, 8)}` });
  });

  afterAll(async () => {
    await run(`DELETE FROM feed_posts WHERE show_id = :showId`, { showId });
    await run(`DELETE FROM shows WHERE id = :showId`, { showId });
  });

  const auth = (r) => r.set('Authorization', `Bearer ${token}`);

  it('lists a deleted post and restores it; it is back on the show\'s drafts', async () => {
    const post = await models.FeedPost.create({ show_id: showId, poster_handle: 'lala', content_text: 'Gone for now.', status: 'draft' });
    expect((await auth(request(app).delete(`/api/v1/feed-posts/${post.id}`))).status).toBe(200);

    const drafts = await auth(request(app).get(`/api/v1/feed-posts?show_id=${showId}&status=draft`));
    expect(drafts.body.data.map((p) => p.id)).not.toContain(post.id);
    const deleted = await auth(request(app).get(`/api/v1/feed-posts/deleted?show_id=${showId}`));
    expect(deleted.status).toBe(200);
    expect(deleted.body.data.map((p) => p.id)).toEqual([post.id]);

    const restored = await auth(request(app).post(`/api/v1/feed-posts/${post.id}/restore`));
    expect(restored.status).toBe(200);
    expect((await auth(request(app).get(`/api/v1/feed-posts?show_id=${showId}&status=draft`))).body.data.map((p) => p.id)).toContain(post.id);
    expect((await auth(request(app).get(`/api/v1/feed-posts/deleted?show_id=${showId}`))).body.data).toEqual([]);
    expect((await auth(request(app).post(`/api/v1/feed-posts/${post.id}/restore`))).status).toBe(409);
  });

  it('the deleted list needs a show; a live post cannot be redrafted', async () => {
    expect((await auth(request(app).get('/api/v1/feed-posts/deleted'))).status).toBe(400);
    const live = await models.FeedPost.create({ show_id: showId, poster_handle: 'lala', content_text: 'Posted.', status: 'live', posted_at: new Date() });
    expect((await auth(request(app).post(`/api/v1/feed-posts/${live.id}/redraft`).send({}))).status).toBe(409);
  });
});
