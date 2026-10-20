/**
 * Lala's posts always go to Review (Task #3047; The Pulse spec, "Always to
 * Review: Lala's posts, posts or comments about Lala"). Evoni, 2026-10-13
 * (Task #3103): ALWAYS, even an admin's. A Lala post, or a post about her,
 * is saved as a draft for Review whoever sends it; only an admin releases
 * one (her Approve in Review), anyone else's release is refused. Other
 * posters are unchanged. Lala's finance posts and ripple replies about her
 * are drafts too.
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

  test('a non-admin cannot release a held post; an admin approves it, but her own post as Lala is held too', async () => {
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

    // Task #3103: an admin's post as Lala, or about her, waits in Review like anyone's.
    for (const body of [{ content_text: 'Posting this myself.', poster_handle: 'lala', status: 'live' }, { content_text: 'Look at @lala tonight.', poster_handle: 'mayaxo' }]) {
      const now = await create(admin, body);
      expect(now.body).toMatchObject({ held_for_review: true, data: { status: 'draft', posted_at: null } });
      expect(await wall()).not.toContain(now.body.data.id);
    }
    // An admin's everyday post as someone else still goes live.
    expect((await create(admin, { content_text: 'Coffee first.', poster_handle: 'mayaxo', status: 'live' })).body.data.status).toBe('live');
  });

  test("Lala's finance posts are drafts for Review, with or without an episode (Task #3103)", async () => {
    const finance = require('../../src/services/financialFeedService');
    const res = await finance.postMilestoneReached(sequelize, showId, [{ goal: { label: '10K coins', reward_coins: 50 } }]);
    expect(res.posted).toBe(1);
    const [rows] = await run("SELECT status, poster_handle, post_format FROM feed_posts WHERE show_id = :showId AND narrative_function = 'flex'", { showId });
    // A milestone is a thought in words, not a photo post (Evoni, 2026-10-20).
    expect(rows).toEqual([{ status: 'draft', poster_handle: 'lala', post_format: 'text' }]);
  });

  test('a ripple reply about Lala is a draft for Review; one about anyone else follows its live parent (Task #3103)', async () => {
    const { generateRippleEffects } = require('../../src/services/feedEngagementService');
    const reactors = [];
    for (const archetype of ['chaos_creator', 'the_peer', 'polished_curator']) {
      const [[row]] = await run(`INSERT INTO social_profiles (handle, platform, vibe_sentence, display_name, feed_layer, status, archetype, created_at, updated_at)
        VALUES (:handle, 'instagram', 'test', :handle, 'lalaverse', 'finalized', :archetype, NOW(), NOW()) RETURNING id`,
      { handle: `rip${archetype.slice(0, 4)}${showId.slice(0, 6)}`, archetype });
      reactors.push(row.id);
    }
    const parent = async (handle) => models.FeedPost.create({
      show_id: showId, poster_handle: handle, poster_platform: 'lalaverse', post_type: 'post', content_text: 'big night',
      status: 'live', posted_at: new Date(), likes: 50000, comments_count: 900, shares: 3000, sample_comments: [], sort_order: 0,
    });
    const random = jest.spyOn(Math, 'random').mockReturnValue(0.1);   // every reactor posts
    // The reactors are these three (the engine picks any finalized profiles at random).
    const scoped = jest.spyOn(models.SocialProfile, 'findAll').mockResolvedValue(await models.SocialProfile.findAll({ where: { id: reactors } }));
    try {
      const lalaPost = await parent('lala');
      await generateRippleEffects(lalaPost.id, models);
      const [lalaReplies] = await run('SELECT content_text, status FROM feed_posts WHERE parent_post_id = :id', { id: lalaPost.id });
      const mentions = lalaReplies.filter((r) => r.content_text.includes('@lala'));
      expect(mentions.length).toBeGreaterThan(0);
      expect(mentions.every((r) => r.status === 'draft')).toBe(true);

      const otherPost = await parent('mayaxo');
      await generateRippleEffects(otherPost.id, models);
      const [otherReplies] = await run('SELECT status FROM feed_posts WHERE parent_post_id = :id', { id: otherPost.id });
      expect(otherReplies.length).toBeGreaterThan(0);
      expect(otherReplies.every((r) => r.status === 'live')).toBe(true);
    } finally {
      random.mockRestore();
      scoped.mockRestore();
      await run('DELETE FROM feed_posts WHERE social_profile_id IN (:ids)', { ids: reactors });
      await run('DELETE FROM social_profiles WHERE id IN (:ids)', { ids: reactors });
    }
  });
});
