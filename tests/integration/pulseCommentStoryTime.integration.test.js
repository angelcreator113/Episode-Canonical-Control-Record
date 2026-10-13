/**
 * Comments carry story time (Task #3064; The Pulse spec §2 rule 2; Evoni,
 * 2026-10-13), against the test database with the Anthropic call mocked:
 * - a comment is stamped with the present story moment when it is made
 *   (by hand, or drafted as a reaction), never earlier than its post;
 * - The Pulse at a moment (GET /feed-posts?with=comments&at=) leaves out a
 *   comment later than the moment; Director view (no at) shows it;
 * - a comment with no story time (one made before this change and not
 *   backfilled) shows with its post.
 */
jest.unmock('uuid');

const mockCreate = jest.fn();
jest.mock('@anthropic-ai/sdk', () => jest.fn().mockImplementation(() => ({ messages: { create: mockCreate } })));

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
const say = (obj) => ({ content: [{ type: 'text', text: JSON.stringify(obj) }], usage: { input_tokens: 10, output_tokens: 10 } });

(shouldSkip ? describe.skip : describe)('The Pulse comment story time (Task #3064)', () => {
  const tag = uuid().slice(0, 8);
  const ids = { show: uuid(), ep1: uuid(), early: uuid(), later: uuid() };
  const savedKey = process.env.ANTHROPIC_API_KEY;
  let fan;
  let admin;
  const as = (req) => req.set('Authorization', `Bearer ${admin}`);
  /** The comments The Pulse sends with the early post, at a moment (or Director view). */
  const commentsAt = async (at) => {
    const res = await as(request(app).get(`/api/v1/feed-posts?show_id=${ids.show}&with=comments${at === undefined ? '' : `&at=${at}`}`));
    expect(res.status).toBe(200);
    return (res.body.data.find((p) => p.id === ids.early)?.comments || []).map((c) => c.text).sort();
  };

  beforeAll(async () => {
    process.env.ANTHROPIC_API_KEY = 'test-key';
    jest.spyOn(console, 'log').mockImplementation(() => {});
    admin = TokenService.generateTokenPair({ id: 'test-admin-cst', email: 'evoni@cst.dev', name: 'Evoni', groups: ['ADMIN'], role: 'ADMIN' }).accessToken;
    await run(`INSERT INTO shows (id, name, slug, created_at, updated_at) VALUES (:show, :name, :slug, NOW(), NOW())`,
      { show: ids.show, name: `Comment time ${tag}`, slug: `ctime-${tag}` });
    // Episode 1 is published: the present is After Ep 1 (17).
    await run(`INSERT INTO episodes (id, show_id, title, episode_number, status, created_at, updated_at) VALUES (:ep1, :show, 'One', 1, 'published', NOW(), NOW())`, ids);
    const [[row]] = await run(`INSERT INTO social_profiles (handle, platform, vibe_sentence, display_name, feed_layer, created_at, updated_at)
      VALUES (:handle, 'instagram', 'test', 'Fan', 'lalaverse', NOW(), NOW()) RETURNING id`, { handle: `fan${tag}` });
    fan = row.id;
    // A post during Ep 1 (15), and one set later in the story (27).
    for (const [id, order] of [[ids.early, 15], [ids.later, 27]]) {
      await run(`INSERT INTO feed_posts (id, show_id, poster_handle, content_text, status, story_order, posted_at, created_at, updated_at)
                 VALUES (:id, :show, 'mayaxo', 'the gala', 'live', :order, NOW(), NOW(), NOW())`, { id, show: ids.show, order });
    }
  });

  afterAll(async () => {
    if (savedKey === undefined) delete process.env.ANTHROPIC_API_KEY; else process.env.ANTHROPIC_API_KEY = savedKey;
    await run('DELETE FROM feed_comments WHERE show_id = :show', ids);
    await run('DELETE FROM pulse_requests WHERE show_id = :show', ids);
    await run('DELETE FROM pulse_closeness WHERE show_id = :show', ids);
    await run('DELETE FROM pulse_post_numbers WHERE show_id = :show', ids);
    await run('DELETE FROM feed_posts WHERE show_id = :show', ids);
    await run('DELETE FROM episodes WHERE show_id = :show', ids);
    await run('DELETE FROM social_profiles WHERE id = :fan', { fan });
    await run('DELETE FROM shows WHERE id = :show', ids);
  });

  test('a comment written now is stamped with the present, and waits until it in Lala\'s view', async () => {
    const res = await as(request(app).post(`/api/v1/feed-posts/${ids.early}/comments`)).send({ handle: `fan${tag}`, social_profile_id: fan, text: 'still thinking about this', status: 'live' });
    expect(res.status).toBe(200);
    expect(res.body.data.story_order).toBe(17);
    expect(await commentsAt(15)).toEqual([]);                              // the post shows; the later comment does not
    expect(await commentsAt(17)).toEqual(['still thinking about this']);
    expect(await commentsAt()).toEqual(['still thinking about this']);     // Director view
  });

  test('a comment with no story time shows with its post', async () => {
    await models.FeedComment.create({ feed_post_id: ids.early, show_id: ids.show, handle: `fan${tag}`, text: 'from before', status: 'live', sort_order: 9, story_order: null });
    expect(await commentsAt(15)).toEqual(['from before']);
  });

  test('a drafted reaction is stamped too; a comment is never earlier than its post', async () => {
    mockCreate.mockResolvedValueOnce(say([{ handle: `fan${tag}`, text: 'obsessed' }]));
    const drafted = await as(request(app).post(`/api/v1/feed-posts/${ids.early}/comments/draft`)).send({ reactor_ids: [fan] });
    expect(drafted.status).toBe(200);
    const reaction = await models.FeedComment.findOne({ where: { feed_post_id: ids.early, text: 'obsessed' } });
    expect(reaction.story_order).toBe(17);
    // The later post is at 27, after the present: its comment is at 27, not 17.
    const late = await as(request(app).post(`/api/v1/feed-posts/${ids.later}/comments`)).send({ handle: `fan${tag}`, text: 'called it', status: 'live' });
    expect(late.body.data.story_order).toBe(27);
  });
});
