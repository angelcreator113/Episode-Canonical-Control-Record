/**
 * Comments by Lala, or about her, go to Review like her posts (Task #3135;
 * The Pulse spec §7, "posts or comments about Lala … only Evoni's Approve in
 * Review puts it live"). Against the test database:
 * - a Lala comment, or one about her, sent live is saved as a draft whoever
 *   sends it, and is not among the post's live comments;
 * - only an admin releases a held comment (her Approve in Review); anyone
 *   else gets 403 REVIEW_REQUIRED, including for an edit that brings Lala in;
 * - other commenters are unchanged: live when sent live, approvable by any
 *   signed-in user.
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

(shouldSkip ? describe.skip : describe)('Comments about Lala go to Review (Task #3135)', () => {
  const showId = crypto.randomUUID();
  let editor;
  let admin;
  let post;
  const as = (token, req) => req.set('Authorization', `Bearer ${token}`);
  const comment = (token, body) => as(token, request(app).post(`/api/v1/feed-posts/${post.id}/comments`)).send(body);
  const approve = (token, id, body = {}) => as(token, request(app).patch(`/api/v1/feed-posts/comments/${id}`)).send({ status: 'live', ...body });
  const liveIds = async () => (await request(app).get(`/api/v1/feed-posts/${post.id}/comments`)).body.data.map((c) => c.id);

  beforeAll(async () => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    editor = TokenService.generateTokenPair({ id: 'test-user-lala-comments', email: 'editor@lala-comments.dev', name: 'Editor', groups: ['USER', 'EDITOR'], role: 'USER' }).accessToken;
    admin = TokenService.generateTokenPair({ id: 'test-admin-lala-comments', email: 'evoni@lala-comments.dev', name: 'Evoni', groups: ['ADMIN'], role: 'ADMIN' }).accessToken;
    await run('INSERT INTO shows (id, name, slug, created_at, updated_at) VALUES (:id, :name, :slug, NOW(), NOW())',
      { id: showId, name: `Lala comments ${showId.slice(0, 8)}`, slug: `lala-comments-${showId.slice(0, 8)}` });
    post = await models.FeedPost.create({
      show_id: showId, poster_handle: 'mayaxo', poster_platform: 'lalaverse', post_type: 'post', content_text: 'Gala tonight.',
      status: 'live', likes: 0, comments_count: 0, shares: 0, sample_comments: [], sort_order: 0, posted_at: new Date(),
    });
  });

  afterAll(async () => {
    await run('DELETE FROM pulse_closeness WHERE show_id = :showId', { showId }).catch((err) => console.error(err.message));
    await run('DELETE FROM feed_comments WHERE show_id = :showId', { showId });
    await run('DELETE FROM pulse_post_numbers WHERE post_id IN (SELECT id FROM feed_posts WHERE show_id = :showId)', { showId }).catch((err) => console.error(err.message));
    await run('DELETE FROM feed_posts WHERE show_id = :showId', { showId });
    await run('DELETE FROM shows WHERE id = :showId', { showId });
  });

  test("Lala's comment, or one about her, sent live is held as a draft, even an admin's", async () => {
    for (const [token, body, reason] of [
      [editor, { handle: 'lala', text: 'See you there!' }, 'lala'],
      [admin, { handle: '@Lala', text: 'Wearing the blue one.' }, 'lala'],
      [editor, { handle: 'mayaxo', text: 'Is @lala coming?' }, 'about_lala'],
    ]) {
      const res = await comment(token, { ...body, status: 'live' });
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ held_for_review: true, review_reasons: [reason], data: { status: 'draft', posted_at: null } });
      expect(await liveIds()).not.toContain(res.body.data.id);
    }
  });

  test('another commenter is unchanged: live when sent live, a draft by default', async () => {
    const live = await comment(editor, { handle: 'jules', text: 'Count me in.', status: 'live' });
    expect(live.body.held_for_review).toBeUndefined();
    expect(live.body.data.status).toBe('live');
    expect(await liveIds()).toContain(live.body.data.id);
    // "lalaverse" is not Lala.
    const word = await comment(editor, { handle: 'jules', text: 'Best night in the lalaverse.', status: 'live' });
    expect(word.body.data.status).toBe('live');
    const draft = await comment(editor, { handle: 'jules', text: 'Maybe.' });
    expect(draft.body.data.status).toBe('draft');
    expect(draft.body.held_for_review).toBeUndefined();
  });

  test('only an admin releases a held comment; anyone else gets REVIEW_REQUIRED', async () => {
    const held = (await comment(editor, { handle: 'lala', text: 'Almost ready.', status: 'live' })).body.data;
    const refused = await approve(editor, held.id);
    expect(refused.status).toBe(403);
    expect(refused.body).toMatchObject({ code: 'REVIEW_REQUIRED', review_reasons: ['lala'] });
    expect((await models.FeedComment.findByPk(held.id)).status).toBe('draft');

    const approved = await approve(admin, held.id);
    expect(approved.status).toBe(200);
    expect(approved.body.data.status).toBe('live');
    expect(await liveIds()).toContain(held.id);
    expect((await models.FeedPost.findByPk(post.id)).comments_count).toBeGreaterThanOrEqual(1);
  });

  test("an edit that brings Lala in can't be released by a non-admin; an everyday draft still can", async () => {
    const draft = (await comment(editor, { handle: 'jules', text: 'Running late.' })).body.data;
    const refused = await approve(editor, draft.id, { text: 'Running late, tell Lala.' });
    expect(refused.status).toBe(403);
    expect(refused.body.review_reasons).toEqual(['about_lala']);
    const stored = await models.FeedComment.findByPk(draft.id);
    expect([stored.status, stored.text]).toEqual(['draft', 'Running late.']);

    const everyday = (await comment(editor, { handle: 'jules', text: 'On my way.' })).body.data;
    expect((await approve(editor, everyday.id)).body.data.status).toBe('live');
  });
});
