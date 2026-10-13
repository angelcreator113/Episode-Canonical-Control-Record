/**
 * Voices build themselves at Active; Evoni's edits become examples (Task
 * #3070; Evoni, 2026-10-13), against the test database with Anthropic mocked:
 * - an Active character with a Feed profile and no voice gets one `voice`
 *   job, once; a character with a voice, or below Active, gets none;
 * - the job builds the voice through the automated lane, unapproved;
 * - an AI draft (post or comment) Evoni edited, once approved, adds an
 *   "edit" example to the poster's voice; one approved unchanged adds none.
 */
jest.unmock('uuid');

const mockCreate = jest.fn();
jest.mock('@anthropic-ai/sdk', () => jest.fn().mockImplementation(() => ({ messages: { create: mockCreate } })));

const request = require('supertest');
const crypto = require('crypto');
const app = require('../../src/app');
const TokenService = require('../../src/services/tokenService');
const models = require('../../src/models');
const voices = require('../../src/services/pulseVoices');

const { sequelize } = models;

const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const uuid = () => crypto.randomUUID();
const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });
const say = (obj) => ({ content: [{ type: 'text', text: JSON.stringify(obj) }], usage: { input_tokens: 10, output_tokens: 10 } });

(shouldSkip ? describe.skip : describe)('The Pulse voices: auto build and edits as examples (Task #3070)', () => {
  const tag = uuid().slice(0, 8);
  const ids = { show: uuid(), reg: uuid() };
  const p = {};
  const c = {};
  const queued = [];
  const savedKey = process.env.ANTHROPIC_API_KEY;
  let token;
  const as = (req) => req.set('Authorization', `Bearer ${token}`);
  const examplesOf = async (key) => (await models.PulseVoice.findOne({ where: { registry_character_id: c[key] } })).examples_json;

  beforeAll(async () => {
    process.env.ANTHROPIC_API_KEY = 'test-key';
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    token = TokenService.generateTokenPair({ id: 'test-user-voice-auto', email: 'evoni@voice-auto.dev', name: 'Evoni', groups: ['ADMIN'], role: 'ADMIN' }).accessToken;
    await run(`INSERT INTO shows (id, name, slug, created_at, updated_at) VALUES (:show, :name, :slug, NOW(), NOW())`,
      { show: ids.show, name: `Voice auto ${tag}`, slug: `voice-auto-${tag}` });
    await run(`INSERT INTO character_registries (id, title, show_id, created_at, updated_at) VALUES (:reg, 'Voice auto', :show, NOW(), NOW())`, ids);
    // ama: Active, no voice; bo: Alive, with a voice; cy: below Active.
    for (const [key, depth] of [['ama', 'active'], ['bo', 'alive'], ['cy', 'breathing']]) {
      const [[row]] = await run(`INSERT INTO social_profiles (handle, platform, vibe_sentence, display_name, feed_layer, created_at, updated_at)
        VALUES (:handle, 'instagram', 'test', :display, 'lalaverse', NOW(), NOW()) RETURNING id`, { handle: `${key}${tag}`, display: key });
      p[key] = row.id;
      c[key] = uuid();
      await run(`INSERT INTO registry_characters (id, registry_id, character_key, display_name, depth_level, feed_profile_id, created_at, updated_at)
                 VALUES (:id, :reg, :key, :name, :depth, :feed, NOW(), NOW())`,
      { id: c[key], reg: ids.reg, key: `${key}-${tag}`, name: key, depth, feed: p[key] });
    }
    await models.PulseVoice.create({ registry_character_id: c.bo, social_profile_id: p.bo, habits_json: { case: 'lowercase' },
      examples_json: [{ id: uuid(), text: 'ok but who approved beige', kind: 'pinned' }], status: 'built' });
  });

  afterAll(async () => {
    if (savedKey === undefined) delete process.env.ANTHROPIC_API_KEY; else process.env.ANTHROPIC_API_KEY = savedKey;
    if (queued.length) await run('DELETE FROM pulse_jobs WHERE id IN (:ids)', { ids: queued });
    await run('DELETE FROM pulse_requests WHERE show_id = :show', ids);
    await run('DELETE FROM pulse_closeness WHERE show_id = :show', ids);
    await run('DELETE FROM pulse_post_numbers WHERE show_id = :show', ids);
    await run('DELETE FROM feed_comments WHERE show_id = :show', ids);
    await run('DELETE FROM feed_posts WHERE show_id = :show', ids);
    await run('DELETE FROM pulse_voices WHERE registry_character_id IN (:a)', { a: Object.values(c) });
    await run('DELETE FROM registry_characters WHERE registry_id = :reg', ids);
    await run('DELETE FROM character_registries WHERE id = :reg', ids);
    await run('DELETE FROM social_profiles WHERE id IN (:a)', { a: Object.values(p) });
    await run('DELETE FROM shows WHERE id = :show', ids);
  });

  test('an Active character with no voice gets one voice job, once; one with a voice or below Active gets none', async () => {
    const first = await voices.queueVoiceBuilds(models);
    queued.push(...first.map((j) => j.id));
    const ours = first.filter((j) => j.show_id === ids.show);
    expect(ours.map((j) => j.payload_json.character_id)).toEqual([c.ama]);
    expect(ours[0]).toMatchObject({ kind: 'voice', status: 'queued' });
    const again = await voices.queueVoiceBuilds(models);
    queued.push(...again.map((j) => j.id));
    expect(again.filter((j) => j.show_id === ids.show)).toEqual([]);
  });

  test('the job builds the voice through the automated lane, unapproved', async () => {
    const job = await models.PulseJob.findOne({ where: { show_id: ids.show, kind: 'voice' } });
    mockCreate.mockResolvedValueOnce(say({ case: 'lowercase', temperament: 'regular', topics: ['studio'] }));
    expect(await voices.handleVoiceJob(models, job)).toEqual({ draftIds: [] });
    const voice = await models.PulseVoice.findOne({ where: { registry_character_id: c.ama } });
    expect(voice).toMatchObject({ status: 'built', approved_at: null });
    const ledger = await models.PulseRequest.findAll({ where: { show_id: ids.show } });
    expect(ledger.map((r) => [r.lane, r.kind, r.job_id])).toEqual([['automated', 'voice', job.id]]);
    // A second run finds the voice and skips.
    expect(await voices.handleVoiceJob(models, job)).toEqual({ skipped: 'This character already has a voice.' });
  });

  test("an edited AI post, once approved, teaches the voice; one approved unchanged does not", async () => {
    const draft = (text) => models.FeedPost.create({ show_id: ids.show, social_profile_id: p.ama, poster_handle: `ama${tag}`, content_text: text, status: 'draft', ai_generated: true, story_order: 11 });
    const edited = await draft('the gala was a moment');
    expect((await as(request(app).put(`/api/v1/feed-posts/${edited.id}`)).send({ content_text: 'ok the gala was unreal' })).status).toBe(200);
    expect((await edited.reload()).edited_at).not.toBeNull();
    expect((await as(request(app).put(`/api/v1/feed-posts/${edited.id}`)).send({ status: 'live' })).status).toBe(200);
    expect((await examplesOf('ama')).map((e) => [e.kind, e.text, e.post_id])).toEqual([['edit', 'ok the gala was unreal', edited.id]]);

    const plain = await draft('a quiet day');
    await as(request(app).put(`/api/v1/feed-posts/${plain.id}`)).send({ status: 'live' });
    expect(await examplesOf('ama')).toHaveLength(1);
  });

  test('an edited AI comment, once approved, teaches the commenter\'s voice; pinned examples stay', async () => {
    const post = await models.FeedPost.create({ show_id: ids.show, poster_handle: 'mayaxo', content_text: 'the look', status: 'live', story_order: 11 });
    const comment = await models.FeedComment.create({ feed_post_id: post.id, show_id: ids.show, social_profile_id: p.bo, handle: `bo${tag}`, text: 'love this', status: 'draft', ai_generated: true });
    await as(request(app).patch(`/api/v1/feed-posts/comments/${comment.id}`)).send({ text: 'ok who styled this' });
    expect((await as(request(app).patch(`/api/v1/feed-posts/comments/${comment.id}`)).send({ status: 'live' })).status).toBe(200);
    const examples = await examplesOf('bo');
    expect(examples.map((e) => [e.kind, e.text])).toEqual([['edit', 'ok who styled this'], ['pinned', 'ok but who approved beige']]);
    expect(examples[0].comment_id).toBe(comment.id);
  });
});
