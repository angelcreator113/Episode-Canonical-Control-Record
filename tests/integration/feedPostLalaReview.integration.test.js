/**
 * Lala's posts always go to Review (Task #3047; The Pulse spec, "Always to
 * Review: Lala's posts, posts or comments about Lala"). Evoni, 2026-10-13:
 * an admin may still post as Lala live (Producer Mode's "Post now") and
 * approve in Review; anyone else's Lala post, or post about her, is saved
 * as a draft for Review, and releasing one is refused. Other posters are
 * unchanged.
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

(shouldSkip ? describe.skip : describe)("Lala's posts go to Review (Task #3047)", () => {
  const showId = crypto.randomUUID();
  let editor;
  let admin;
  const as = (token, req) => req.set('Authorization', `Bearer ${token}`);
  const create = (token, body) => as(token, request(app).post('/api/v1/feed-posts')).send({ show_id: showId, ...body });
  const wall = async () => (await request(app).get(`/api/v1/feed-posts?show_id=${showId}`)).body.data.map((p) => p.id);

  beforeAll(async () => {
    editor = TokenService.generateTokenPair({ id: 'test-user-lala-review', email: 'editor@lala-review.dev', name: 'Editor', groups: ['USER', 'EDITOR'], role: 'USER' }).accessToken;
    admin = TokenService.generateTokenPair({ id: 'test-admin-lala-review', email: 'evoni@lala-review.dev', name: 'Evoni', groups: ['ADMIN'], role: 'ADMIN' }).accessToken;
    await run('INSERT INTO shows (id, name, slug, created_at, updated_at) VALUES (:id, :name, :slug, NOW(), NOW())',
      { id: showId, name: `Lala review ${showId.slice(0, 8)}`, slug: `lala-review-${showId.slice(0, 8)}` });
  });

  afterAll(async () => {
    await run('DELETE FROM pulse_post_numbers WHERE post_id IN (SELECT id FROM feed_posts WHERE show_id = :showId)', { showId }).catch((err) => console.error(err.message));
    await run('DELETE FROM feed_posts WHERE show_id = :showId', { showId });
    await run('DELETE FROM shows WHERE id = :showId', { showId });
  });

  test("a non-admin's Lala post, sent live or with no status, is held as a draft and is not on the wall", async () => {
    for (const body of [{ content_text: 'Studio day.', poster_handle: 'lala', status: 'live' }, { content_text: 'Studio night.' }]) {
      const res = await create(editor, body);
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ held_for_review: true, review_reasons: ['lala'], data: { status: 'draft', posted_at: null } });
      expect(await wall()).not.toContain(res.body.data.id);
    }
  });

  test("a non-admin's post about Lala is held; another poster's everyday post goes live as before", async () => {
    const about = await create(editor, { content_text: 'Did anyone see what @lala wore?', poster_handle: 'mayaxo', status: 'live' });
    expect(about.body).toMatchObject({ held_for_review: true, review_reasons: ['about_lala'], data: { status: 'draft' } });
    const everyday = await create(editor, { content_text: 'Coffee first.', poster_handle: 'mayaxo', status: 'live' });
    expect(everyday.body.held_for_review).toBeUndefined();
    expect(everyday.body.data.status).toBe('live');
    // "lalaverse" is not Lala.
    const word = await create(editor, { content_text: 'Best week in the lalaverse.', poster_handle: 'mayaxo' });
    expect(word.body.data.status).toBe('live');
  });

  test('a non-admin cannot release a held post; an admin approves it, and may post as Lala live', async () => {
    const held = (await create(editor, { content_text: 'New look.', poster_handle: 'lala', status: 'live' })).body.data;
    const refused = await as(editor, request(app).put(`/api/v1/feed-posts/${held.id}`)).send({ status: 'live' });
    expect(refused.status).toBe(403);
    expect(refused.body).toMatchObject({ code: 'REVIEW_REQUIRED', review_reasons: ['lala'] });
    // Editing a draft is still allowed, and an edit that brings Lala in cannot be released either.
    const other = (await create(editor, { content_text: 'Quiet day.', poster_handle: 'mayaxo', status: 'draft' })).body.data;
    expect((await as(editor, request(app).put(`/api/v1/feed-posts/${other.id}`)).send({ content_text: 'Quiet day with Lala.', status: 'live' })).status).toBe(403);
    expect((await models.FeedPost.findByPk(other.id)).status).toBe('draft');

    const approved = await as(admin, request(app).put(`/api/v1/feed-posts/${held.id}`)).send({ status: 'live' });
    expect(approved.status).toBe(200);
    expect(approved.body.data.status).toBe('live');
    expect(await wall()).toContain(held.id);

    const now = await create(admin, { content_text: 'Posting this myself.', poster_handle: 'lala', status: 'live' });
    expect(now.body.held_for_review).toBeUndefined();
    expect(now.body.data.status).toBe('live');
  });
});
