/**
 * The Pulse's daily request ledger (Task #3031; Evoni, 2026-10-12: "20 AI
 * text-generation requests per show … 5 automated … 15 for manual work …
 * Count regenerations"), with the Anthropic calls mocked:
 * - each lane counts on its own, per show, per UTC day; at the limit a take
 *   is refused with the reason, and two at once never both take the last;
 * - every drafting call takes exactly one request, and the quality gate
 *   takes none: event, ambient, comment and storyline drafts (automated);
 *   DMs, building a voice, storyline suggestions, draft reactions and
 *   redraft (manual);
 * - a refused automated draft makes no AI call and no post; a refused
 *   manual route answers 429 with the reason; a DM is refused before it is
 *   queued;
 * - the migration rewrites the old draft cap once, to the new shape.
 */
jest.unmock('uuid');

const mockCreate = jest.fn();
jest.mock('@anthropic-ai/sdk', () => jest.fn().mockImplementation(() => ({ messages: { create: mockCreate } })));

const request = require('supertest');
const crypto = require('crypto');
const { Sequelize } = require('sequelize');
const app = require('../../src/app');
const TokenService = require('../../src/services/tokenService');
const models = require('../../src/models');
const queue = require('../../src/services/pulseQueue');
const requests = require('../../src/services/pulseRequests');
const drafter = require('../../src/services/pulseDrafter');
const dms = require('../../src/services/pulseDms');
const migration = require('../../src/migrations/20261013010000-create-pulse-requests');

const { sequelize } = models;

const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const uuid = () => crypto.randomUUID();
const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });
const say = (obj) => ({ content: [{ type: 'text', text: typeof obj === 'string' ? obj : JSON.stringify(obj) }], usage: { input_tokens: 10, output_tokens: 10 } });
// One answer every Pulse parser reads: a draft's text, the gate's score, a voice's habits.
const ANY = say({ text: 'ok but the playlist tho', hashtag: null, reveals_story: false, score: 0.9, why: 'them', case: 'lowercase', temperament: 'regular' });

(shouldSkip ? describe.skip : describe)("The Pulse's daily requests (Task #3031)", () => {
  const tag = uuid().slice(0, 8);
  const ids = { show: uuid(), other: uuid(), reg: uuid() };
  const c = {};
  const p = {};
  let admin;
  const keyWas = process.env.ANTHROPIC_API_KEY;
  const as = (req) => req.set('Authorization', `Bearer ${admin}`);
  const ledger = (showId = ids.show) => models.PulseRequest.findAll({ where: { show_id: showId }, order: [['created_at', 'ASC']] });
  const lanesOf = async (showId = ids.show) => (await ledger(showId)).map((r) => `${r.lane}:${r.kind}`);
  const limits = (automated, manual) => queue.saveSettings(models, ids.show, { automated_requests: automated, manual_requests: manual });
  const draftPost = async (key = 'ama') => {
    const [[post]] = await run(`INSERT INTO feed_posts (id, show_id, social_profile_id, poster_handle, poster_display_name, poster_platform, post_type,
        content_text, status, story_order, likes, comments_count, shares, sample_comments, sort_order, created_at, updated_at)
      VALUES (:id, :show, :pid, :h, :h, 'lalaverse', 'post', 'a draft to work on', 'draft', 5, 0, 0, 0, '[]', 0, NOW(), NOW()) RETURNING id`,
    { id: uuid(), show: ids.show, pid: p[key], h: `${key}${tag}` });
    return post.id;
  };

  beforeAll(async () => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    process.env.ANTHROPIC_API_KEY = 'test';
    admin = TokenService.generateTokenPair({ id: 'test-admin-requests', email: 'evoni@requests.dev', name: 'Evoni', groups: ['ADMIN'], role: 'ADMIN' }).accessToken;
    for (const show of [ids.show, ids.other]) {
      await run(`INSERT INTO shows (id, name, slug, created_at, updated_at) VALUES (:show, :name, :slug, NOW(), NOW())`,
        { show, name: `Requests ${show.slice(0, 8)}`, slug: `requests-${show.slice(0, 8)}` });
    }
    await run(`INSERT INTO character_registries (id, title, show_id, created_at, updated_at) VALUES (:reg, 'Requests registry', :show, NOW(), NOW())`, ids);
    for (const key of ['ama', 'bo']) {
      const [[row]] = await run(`INSERT INTO social_profiles (handle, platform, vibe_sentence, display_name, feed_layer, created_at, updated_at)
        VALUES (:handle, 'instagram', 'test', :display, 'lalaverse', NOW(), NOW()) RETURNING id`, { handle: `${key}${tag}`, display: key });
      p[key] = row.id;
      c[key] = uuid();
      await run(`INSERT INTO registry_characters (id, registry_id, character_key, display_name, depth_level, feed_profile_id, created_at, updated_at)
                 VALUES (:id, :reg, :key, :name, 'alive', :feed, NOW(), NOW())`, { id: c[key], reg: ids.reg, key: `${key}-${tag}`, name: key, feed: p[key] });
      await models.PulseVoice.create({ registry_character_id: c[key], social_profile_id: p[key], habits_json: { temperament: 'regular' }, examples_json: [], status: 'built' });
    }
  });

  beforeEach(async () => {
    mockCreate.mockReset();
    mockCreate.mockResolvedValue(ANY);
    await run('DELETE FROM pulse_requests WHERE show_id IN (:show, :other)', ids);
    await limits(5, 15);
  });

  afterAll(async () => {
    process.env.ANTHROPIC_API_KEY = keyWas;
    await new Promise((r) => { setTimeout(r, 300); });
    for (const t of ['pulse_requests', 'pulse_jobs', 'pulse_dm_messages', 'pulse_dm_threads', 'pulse_storyline_beats', 'pulse_storylines', 'feed_comments', 'pulse_post_numbers', 'feed_posts']) {
      await run(`DELETE FROM ${t} WHERE show_id IN (:show, :other)`, ids);
    }
    await run('DELETE FROM pulse_voices WHERE registry_character_id IN (:a)', { a: Object.values(c) });
    await run('DELETE FROM registry_characters WHERE registry_id = :reg', ids);
    await run('DELETE FROM character_registries WHERE id = :reg', ids);
    await run('DELETE FROM social_profiles WHERE id IN (:a)', { a: Object.values(p) });
    await run('DELETE FROM shows WHERE id IN (:show, :other)', ids);
  });

  test('each lane counts on its own, per show and per UTC day; at the limit a take is refused with the reason', async () => {
    await limits(2, 1);
    await requests.take(models, { showId: ids.show, lane: 'automated', kind: 'event' });
    await requests.take(models, { showId: ids.show, lane: 'automated', kind: 'ambient' });
    await expect(requests.take(models, { showId: ids.show, lane: 'automated', kind: 'event' }))
      .rejects.toMatchObject({ status: 429, message: "Today's 2 automated requests are used; they reset at midnight UTC." });
    await requests.take(models, { showId: ids.show, lane: 'manual', kind: 'voice' });
    await expect(requests.take(models, { showId: ids.show, lane: 'manual', kind: 'voice' }))
      .rejects.toThrow("Today's 1 manual request is used; it resets at midnight UTC.");
    expect(await requests.usedToday(models, ids.show)).toEqual({ automated: 2, manual: 1 });
    // Another show's requests are its own; yesterday's do not count.
    await requests.take(models, { showId: ids.other, lane: 'automated', kind: 'event' });
    await run(`UPDATE pulse_requests SET created_at = NOW() - INTERVAL '1 day' WHERE show_id = :show AND lane = 'automated'`, ids);
    expect(await requests.usedToday(models, ids.show)).toEqual({ automated: 0, manual: 1 });
    await limits(0, 15);
    await expect(requests.take(models, { showId: ids.show, lane: 'automated', kind: 'event' }))
      .rejects.toThrow('Automated requests are set to 0 a day in Admin › The Pulse › Engine.');
  });

  test('two takes at once never both take the last request', async () => {
    await limits(1, 15);
    const results = await Promise.allSettled([1, 2, 3].map(() => requests.take(models, { showId: ids.show, lane: 'automated', kind: 'event' })));
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((r) => r.status === 'rejected').map((r) => r.reason.status)).toEqual([429, 429]);
    expect(await ledger()).toHaveLength(1);
  });

  test('automated drafts take one request each; the gate takes none; a refused draft calls no AI and makes no post', async () => {
    const job = await queue.enqueue(models, { showId: ids.show, kind: 'event' });
    const { post } = await drafter.draftAndRoute(models, { showId: ids.show, characterId: c.ama, moment: 5, request: { kind: 'event', jobId: job.id } });
    expect(mockCreate).toHaveBeenCalledTimes(2);   // the draft, then the gate's voice score
    expect((await ledger()).map((r) => [r.lane, r.kind, r.job_id])).toEqual([['automated', 'event', job.id]]);

    await drafter.draftCommentAndRoute(models, { postId: post.id, characterId: c.bo });
    expect(await lanesOf()).toEqual(['automated:event', 'automated:comment']);

    await limits(2, 15);
    mockCreate.mockClear();
    const [[{ before }]] = await run('SELECT COUNT(*)::int AS before FROM feed_posts WHERE show_id = :show', ids);
    await expect(drafter.draftAndRoute(models, { showId: ids.show, characterId: c.ama, moment: 5, request: { kind: 'ambient' } }))
      .rejects.toThrow("Today's 2 automated requests are used; they reset at midnight UTC.");
    expect(mockCreate).not.toHaveBeenCalled();
    const [[{ after }]] = await run('SELECT COUNT(*)::int AS after FROM feed_posts WHERE show_id = :show', ids);
    expect(after).toBe(before);
  });

  test('manual work takes one request each: building a voice, storyline suggestions, draft reactions, redraft', async () => {
    expect((await as(request(app).post(`/api/v1/pulse-voices/${c.ama}/build`))).status).toBe(200);

    const line = await models.PulseStoryline.create({ show_id: ids.show, title: 'The rumour', status: 'planned' });
    mockCreate.mockResolvedValueOnce(say({ beats: [{ kind: 'plant', story_order: 5, handle: `@bo${tag}`, brief: 'hint at it' }] }));
    expect((await as(request(app).post(`/api/v1/pulse-storylines/${line.id}/suggest`))).status).toBe(200);

    const postId = await draftPost('ama');
    mockCreate.mockResolvedValueOnce(say([{ handle: `bo${tag}`, text: 'obsessed' }]));
    const reactions = await as(request(app).post(`/api/v1/feed-posts/${postId}/comments/draft`)).send({ reactor_ids: [p.bo] });
    expect(reactions.status).toBe(200);
    expect(mockCreate).toHaveBeenCalledTimes(3);   // one call for the whole batch

    mockCreate.mockResolvedValueOnce(say('a rewrite in her voice'));
    expect((await as(request(app).post(`/api/v1/feed-posts/${postId}/redraft`)).send({})).status).toBe(200);
    mockCreate.mockResolvedValueOnce(say('and again'));
    expect((await as(request(app).post(`/api/v1/feed-posts/${postId}/redraft`)).send({})).status).toBe(200);

    expect(await lanesOf()).toEqual(['manual:voice', 'manual:suggestions', 'manual:reactions', 'manual:redraft', 'manual:redraft']);
    expect(await requests.usedToday(models, ids.show)).toEqual({ automated: 0, manual: 5 });
  });

  test('a refused manual route answers 429 with the reason and calls no AI', async () => {
    await limits(5, 1);
    await requests.take(models, { showId: ids.show, lane: 'manual', kind: 'voice' });
    const postId = await draftPost('ama');
    const reason = "Today's 1 manual request is used; it resets at midnight UTC.";
    for (const res of [
      await as(request(app).post(`/api/v1/pulse-voices/${c.ama}/build`)),
      await as(request(app).post(`/api/v1/feed-posts/${postId}/redraft`)).send({}),
      await as(request(app).post(`/api/v1/feed-posts/${postId}/comments/draft`)).send({ reactor_ids: [p.bo] }),
    ]) {
      expect(res.status).toBe(429);
      expect(res.body.error).toBe(reason);
    }
    expect(mockCreate).not.toHaveBeenCalled();
    expect(await ledger()).toHaveLength(1);
  });

  test('DMs: drafting takes a manual request; with none left a DM is refused before it is queued', async () => {
    const thread = await dms.openThread(models, { showId: ids.show, a: p.ama, b: p.bo });
    const job = await dms.enqueueMessage(models, { threadId: thread.id, senderProfileId: p.ama });
    await dms.handleDm(models, job);
    expect((await ledger()).map((r) => [r.lane, r.kind, r.job_id])).toEqual([['manual', 'dm', job.id]]);

    await limits(5, 1);
    const res = await as(request(app).post(`/api/v1/pulse-dms/${thread.id}/next`)).send({});
    expect(res.status).toBe(429);
    expect(res.body.error).toBe("Today's 1 manual request is used; it resets at midnight UTC.");
    expect(await models.PulseJob.count({ where: { show_id: ids.show, kind: 'dm' } })).toBe(1);
  });

  test('the migration rewrites the old draft cap once: a stricter cap is kept, others get 5; manual is 15', async () => {
    const strict = uuid();
    const loose = uuid();
    for (const [id, cap] of [[strict, 2], [loose, 30]]) {
      await run(`INSERT INTO shows (id, name, slug, metadata, created_at, updated_at) VALUES (:id, :name, :slug, CAST(:meta AS json), NOW(), NOW())`,
        { id, name: `Old ${id.slice(0, 8)}`, slug: `old-${id.slice(0, 8)}`, meta: JSON.stringify({ tagline: 'keep me', pulse_engine: { daily_draft_cap: cap, ambient_enabled: true } }) });
    }
    try {
      await migration.up(sequelize.getQueryInterface(), Sequelize);
      await migration.up(sequelize.getQueryInterface(), Sequelize);   // once: a second run changes nothing
      const [rows] = await run('SELECT id, metadata FROM shows WHERE id IN (:a)', { a: [strict, loose] });
      const meta = Object.fromEntries(rows.map((r) => [r.id, r.metadata]));
      expect(meta[strict]).toEqual({ tagline: 'keep me', pulse_engine: { automated_requests: 2, manual_requests: 15, ambient_enabled: true } });
      expect(meta[loose]).toEqual({ tagline: 'keep me', pulse_engine: { automated_requests: 5, manual_requests: 15, ambient_enabled: true } });
      expect(await queue.settingsOf(models, strict)).toEqual({ automated_requests: 2, manual_requests: 15, ambient_enabled: true });
    } finally {
      await run('DELETE FROM shows WHERE id IN (:a)', { a: [strict, loose] });
    }
  });
});
