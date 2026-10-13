/**
 * Event-triggered posting (Task #2970; The Pulse spec §7), with the
 * Anthropic calls mocked:
 * - completing an episode queues `event` jobs for who would post (the
 *   event's guests, closeness to Lala, temperament), once, only while the
 *   engine is on, and never fails completion;
 * - the event job drafts the post through the gate and queues comment jobs;
 * - a comment job drafts in voice; a passing everyday comment on a live
 *   post goes live and is counted, one about Lala waits for Review;
 * - Task #3049: a completed episode whose posts were never queued (engine
 *   off, or skipped by the cap before #3049) is listed in Engine and can be
 *   queued from there, once, whatever the switch; a job skipped for another
 *   reason still counts as queued.
 */
jest.unmock('uuid');

const mockCreate = jest.fn();
jest.mock('@anthropic-ai/sdk', () => jest.fn().mockImplementation(() => ({ messages: { create: mockCreate } })));

const crypto = require('crypto');
const request = require('supertest');
const app = require('../../src/app');
const TokenService = require('../../src/services/tokenService');
const models = require('../../src/models');
const queue = require('../../src/services/pulseQueue');
const posting = require('../../src/services/pulseEventPosting');
const { completeEpisode } = require('../../src/services/episodeCompletionService');
const { lalaProfileId } = require('../../src/services/lalaFeedProfile');

const { sequelize } = models;

const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const uuid = () => crypto.randomUUID();
const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });
const say = (obj) => ({ content: [{ type: 'text', text: JSON.stringify(obj) }] });

(shouldSkip ? describe.skip : describe)('The Pulse event-triggered posting (Task #2970)', () => {
  const tag = uuid().slice(0, 8);
  const ids = { show: uuid(), reg: uuid(), ep: uuid(), ev: uuid() };
  const c = {};
  const p = {};
  let lala;
  let madeLala = false;
  const was = process.env.PULSE_ENGINE_ENABLED;

  beforeAll(async () => {
    process.env.PULSE_ENGINE_ENABLED = 'true';
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    await run(`INSERT INTO shows (id, name, slug, metadata, created_at, updated_at) VALUES (:show, :name, :slug, CAST(:meta AS json), NOW(), NOW())`,
      { show: ids.show, name: `Event posts ${tag}`, slug: `evposts-${tag}`, meta: JSON.stringify({ starting_balance: 1000 }) });
    await run(`INSERT INTO character_state (id, show_id, character_key, coins, reputation, brand_trust, influence, stress, created_at, updated_at)
               VALUES (:id, :show, 'lala', 1000, 3, 3, 3, 2, NOW(), NOW())`, { id: uuid(), show: ids.show });
    await run(`INSERT INTO episodes (id, show_id, title, episode_number, status, created_at, updated_at) VALUES (:ep, :show, 'The Gala', 2, 'draft', NOW(), NOW())`, ids);
    await run(`INSERT INTO character_registries (id, title, show_id, created_at, updated_at) VALUES (:reg, 'Event registry', :show, NOW(), NOW())`, ids);
    lala = await lalaProfileId(sequelize);
    if (!lala) {
      const [[row]] = await run(`INSERT INTO social_profiles (handle, platform, vibe_sentence, display_name, feed_layer, created_at, updated_at)
        VALUES ('lala', 'instagram', 'test', 'Lala', 'lalaverse', NOW(), NOW()) RETURNING id`);
      lala = row.id;
      madeLala = true;
    }
    const temperaments = { marcus: 'oversharer', kim: 'lurker', nia: 'regular', quiet: 'regular' };
    for (const key of Object.keys(temperaments)) {
      const [[row]] = await run(`INSERT INTO social_profiles (handle, platform, vibe_sentence, display_name, feed_layer, created_at, updated_at)
        VALUES (:handle, 'instagram', 'test', :display, 'lalaverse', NOW(), NOW()) RETURNING id`, { handle: `${key}${tag}`, display: `${key}${tag}` });
      p[key] = row.id;
      c[key] = uuid();
      await run(`INSERT INTO registry_characters (id, registry_id, character_key, display_name, depth_level, feed_profile_id, created_at, updated_at)
                 VALUES (:id, :reg, :key, :name, 'alive', :feed, NOW(), NOW())`, { id: c[key], reg: ids.reg, key: `${key}-${tag}`, name: key, feed: p[key] });
      await models.PulseVoice.create({ registry_character_id: c[key], social_profile_id: p[key], habits_json: { case: 'lowercase', temperament: temperaments[key] }, examples_json: [], status: 'built', approved_at: new Date(), approved_by: 'evoni' });  // approved: the worker posts only for approved voices (Task #3029)
    }
    // Marcus and Kim were guests at the gala; Nia is Lala's bestie; Quiet is neither.
    await run(`INSERT INTO world_events (id, show_id, name, status, used_in_episode_id, cost_coins, prestige, canon_consequences, created_at, updated_at)
               VALUES (:ev, :show, :name, 'used', :ep, 0, 5, CAST(:cc AS jsonb), NOW(), NOW())`,
    { ...ids, name: `Gala ${tag}`, cc: JSON.stringify({ automation: { guest_profiles: [{ profile_id: p.marcus }, { profile_id: p.kim }] } }) });
    await run(`INSERT INTO social_profile_relationships (source_profile_id, target_profile_id, relationship_type, created_at, updated_at)
               VALUES (:lala, :nia, 'bestie', NOW(), NOW())`, { lala, nia: p.nia });
  });

  afterAll(async () => {
    process.env.PULSE_ENGINE_ENABLED = was;
    for (const kind of queue.KINDS) queue.unregister(kind);
    await new Promise((r) => { setTimeout(r, 300); });
    await run('DELETE FROM social_profile_relationships WHERE target_profile_id = :nia AND source_profile_id = :lala', { nia: p.nia, lala });
    await run('DELETE FROM pulse_jobs WHERE show_id = :show', ids);
    await run('DELETE FROM pulse_post_numbers WHERE show_id = :show', ids);
    await run('DELETE FROM feed_comments WHERE show_id = :show', ids);
    await run('DELETE FROM franchise_knowledge WHERE show_id = :show', ids);
    for (const t of ['pulse_followers', 'feed_posts', 'financial_transactions', 'character_state_history', 'character_state', 'world_events']) {
      await run(`DELETE FROM ${t} WHERE show_id = :show`, ids);
    }
    await run('DELETE FROM pulse_voices WHERE registry_character_id IN (:a)', { a: Object.values(c) });
    await run('DELETE FROM registry_characters WHERE registry_id = :reg', ids);
    await run('DELETE FROM character_registries WHERE id = :reg', ids);
    await run('DELETE FROM episodes WHERE show_id = :show', ids);
    await run('DELETE FROM social_profiles WHERE id IN (:a)', { a: [...Object.values(p), ...(madeLala ? [lala] : [])] });
    await run('DELETE FROM shows WHERE id = :show', ids);
  });

  test('who posts: the attending oversharer posts; the lurker guest and Lala\'s bestie comment; nobody else; stable', async () => {
    const plan = await posting.whoPosts(models, { showId: ids.show, episodeId: ids.ep });
    expect(plan.posters.map((x) => x.characterId)).toEqual([c.marcus]);
    expect(plan.commenters.map((x) => x.characterId).sort()).toEqual([c.kim, c.nia].sort());
    expect(plan).toMatchObject({ order: 27, eventId: ids.ev, about: `Gala ${tag}, which just happened` });
    expect(await posting.whoPosts(models, { showId: ids.show, episodeId: ids.ep })).toEqual(plan);
  });

  test('event reactions are for Alive characters: an Active guest neither posts nor comments (Task #3030)', async () => {
    await run(`UPDATE registry_characters SET depth_level = 'active' WHERE id IN (:a)`, { a: [c.marcus, c.kim] });
    try {
      const plan = await posting.whoPosts(models, { showId: ids.show, episodeId: ids.ep });
      expect(plan.posters).toEqual([]);
      expect(plan.commenters.map((x) => x.characterId)).toEqual([c.nia]);
    } finally {
      await run(`UPDATE registry_characters SET depth_level = 'alive' WHERE id IN (:a)`, { a: [c.marcus, c.kim] });
    }
  });

  test('completing the episode queues the event posts once, never calls AI in the request, and nothing while the engine is off', async () => {
    process.env.PULSE_ENGINE_ENABLED = 'false';
    expect(await posting.enqueueForEpisode(models, { showId: ids.show, episodeId: ids.ep })).toEqual([]);
    process.env.PULSE_ENGINE_ENABLED = 'true';
    mockCreate.mockReset();
    const result = await completeEpisode(ids.ep, ids.show, sequelize);
    expect(result.pulse_posts_queued).toBe(1);
    expect(mockCreate).not.toHaveBeenCalled();
    const jobs = await models.PulseJob.findAll({ where: { show_id: ids.show } });
    expect(jobs).toHaveLength(1);
    expect(jobs[0]).toMatchObject({ kind: 'event', status: 'queued' });
    expect(jobs[0].payload_json).toMatchObject({ episode_id: ids.ep, posters: [c.marcus], moment: 27, event_id: ids.ev });
    expect(await posting.enqueueForEpisode(models, { showId: ids.show, episodeId: ids.ep })).toEqual([]);
  });

  test('a failure while queueing never fails completion', async () => {
    const ep = uuid();
    await run(`INSERT INTO episodes (id, show_id, title, episode_number, status, created_at, updated_at) VALUES (:ep, :show, 'Three', 3, 'draft', NOW(), NOW())`, { ep, show: ids.show });
    jest.spyOn(posting, 'enqueueForEpisode').mockRejectedValueOnce(new Error('queue down'));
    const errors = jest.spyOn(console, 'error').mockImplementation(() => {});
    const result = await completeEpisode(ep, ids.show, sequelize);
    expect(result.pulse_posts_queued).toBe(0);
    expect(errors).toHaveBeenCalledWith('[EpisodeCompletion] Queueing event posts failed (non-blocking):', 'queue down');
    errors.mockRestore();
  });

  test('the worker drafts the posts in one request through the gate, then the comments in one; a passing comment goes live, one about Lala waits', async () => {
    posting.registerHandlers();
    mockCreate.mockReset();
    mockCreate.mockResolvedValueOnce(say({ items: [{ n: 1, text: 'the gala was a whole moment', hashtag: null, reveals_story: false }] }));
    mockCreate.mockResolvedValueOnce(say({ score: 0.9, why: 'them' }));
    const eventJob = await queue.runOne(models);
    await eventJob.reload();
    expect(eventJob).toMatchObject({ kind: 'event', status: 'done' });
    const [postId] = eventJob.draft_ids;
    const post = await models.FeedPost.findByPk(postId);
    expect(post).toMatchObject({ status: 'live', social_profile_id: p.marcus, story_order: 27, episode_id: ids.ep });

    // One comment job for the post: both commenters' replies in one request (Task #3032).
    const commentJobs = await models.PulseJob.findAll({ where: { show_id: ids.show, kind: 'comment' }, order: [['created_at', 'ASC']] });
    expect(commentJobs.map((j) => j.payload_json.post_id)).toEqual([postId]);
    const order = commentJobs[0].payload_json.character_ids;
    expect([...order].sort()).toEqual([c.kim, c.nia].sort());
    const texts = { [c.kim]: 'ok this is cute', [c.nia]: 'lala would have loved this' };
    mockCreate.mockResolvedValueOnce(say({ items: order.map((id, i) => ({ n: i + 1, text: texts[id] })) }));
    mockCreate.mockResolvedValueOnce(say({ score: 0.85, why: 'them' }));
    mockCreate.mockResolvedValueOnce(say({ score: 0.85, why: 'them' }));
    const job = await queue.runOne(models);
    expect(await job.reload()).toMatchObject({ kind: 'comment', status: 'done', error: null });
    expect(job.draft_ids).toHaveLength(2);
    expect(mockCreate).toHaveBeenCalledTimes(5);   // posts batch + its gate, comments batch + two gates
    const ledger = await models.PulseRequest.findAll({ where: { show_id: ids.show }, order: [['created_at', 'ASC']] });
    expect(ledger.map((r) => `${r.lane}:${r.kind}`)).toEqual(['automated:event', 'automated:comments']);
    const comments = await models.FeedComment.findAll({ where: { feed_post_id: postId } });
    const byWho = Object.fromEntries(comments.map((x) => [x.social_profile_id, x.status]));
    expect(byWho).toEqual({ [p.kim]: 'live', [p.nia]: 'draft' });
    expect((await post.reload()).comments_count).toBe(1);
    expect(await queue.draftsToday(models, ids.show)).toBe(3);
  });

  test('Engine lists a completed episode with no posts queued and queues them once, whatever the switch (Task #3049)', async () => {
    const ep = uuid();
    const ev = uuid();
    const admin = TokenService.generateTokenPair({ id: 'test-admin-evq', email: 'evoni@evq.dev', name: 'Evoni', groups: ['ADMIN'], role: 'ADMIN' }).accessToken;
    const editor = TokenService.generateTokenPair({ id: 'test-editor-evq', email: 'ed@evq.dev', name: 'Ed', groups: ['USER', 'EDITOR'], role: 'USER' }).accessToken;
    const queueIt = (token) => request(app).post(`/api/v1/pulse-engine/episodes/${ep}/queue`).set('Authorization', `Bearer ${token}`).send({ show_id: ids.show });
    const waiting = async () => (await posting.episodesWithoutPosts(models, ids.show)).map((e) => e.id);
    await run(`INSERT INTO episodes (id, show_id, title, episode_number, status, evaluation_status, created_at, updated_at)
               VALUES (:ep, :show, 'The After Party', 9, 'published', 'accepted', NOW(), NOW())`, { ep, show: ids.show });
    await run(`INSERT INTO world_events (id, show_id, name, status, used_in_episode_id, cost_coins, prestige, canon_consequences, created_at, updated_at)
               VALUES (:ev, :show, :name, 'used', :ep, 0, 5, CAST(:cc AS jsonb), NOW(), NOW())`,
    { ev, ep, show: ids.show, name: `After party ${tag}`, cc: JSON.stringify({ automation: { guest_profiles: [{ profile_id: p.marcus }] } }) });
    process.env.PULSE_ENGINE_ENABLED = 'false';
    try {
      // Completed while the engine was off: nothing queued, so Engine lists it.
      expect(await posting.enqueueForEpisode(models, { showId: ids.show, episodeId: ep })).toEqual([]);
      expect(await waiting()).toContain(ep);
      // A job the cap skipped before #3049 does not count as queued.
      await models.PulseJob.create({ show_id: ids.show, kind: 'event', status: 'skipped', payload_json: { episode_id: ep },
        error: "Today's 5 automated requests are used; they reset at midnight UTC.", max_attempts: 3 });
      expect(await waiting()).toContain(ep);

      expect((await queueIt(editor)).status).toBe(403);
      const res = await queueIt(admin);
      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({ success: true, queued: 1, posts: 1 });
      expect(res.body.episodes_without_posts.map((e) => e.id)).not.toContain(ep);
      const jobs = await models.PulseJob.findAll({ where: { show_id: ids.show, kind: 'event', status: 'queued' } });
      expect(jobs.filter((j) => j.payload_json.episode_id === ep)).toHaveLength(1);
      expect((await queueIt(admin)).status).toBe(409);
      // A job skipped for another reason (a voice not approved) still counts.
      await models.PulseJob.update({ status: 'skipped', error: 'marcus: voice not approved yet.' }, { where: { show_id: ids.show, kind: 'event', status: 'queued' } });
      expect(await waiting()).not.toContain(ep);
    } finally {
      process.env.PULSE_ENGINE_ENABLED = 'true';
      await run(`DELETE FROM pulse_jobs WHERE show_id = :show AND payload_json->>'episode_id' = :ep`, { show: ids.show, ep });
      await run('DELETE FROM world_events WHERE id = :ev', { ev });
    }
  });
});
