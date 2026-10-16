/**
 * Draft events (Character Consistency Engine step 6b; Evoni, 2026-10-16:
 * "button per episode"), with the Anthropic calls mocked:
 * - an episode not completed yet, with its event attached, is listed in
 *   Engine as one whose event posts can be drafted now;
 * - the button queues the event job once, marked early (admin only);
 * - an early job's drafts all wait in Review ('event_draft'), even when the
 *   gate passes them;
 * - completing the episode does not queue them again.
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

const { sequelize } = models;

const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const uuid = () => crypto.randomUUID();
const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });
const say = (obj) => ({ content: [{ type: 'text', text: JSON.stringify(obj) }] });

(shouldSkip ? describe.skip : describe)('draft events: posts before the episode is completed', () => {
  const tag = uuid().slice(0, 8);
  const ids = { show: uuid(), reg: uuid(), ep: uuid(), ev: uuid(), char: uuid() };
  let pid;
  let admin;
  let editor;
  const was = process.env.PULSE_ENGINE_ENABLED;
  const draftEvent = (token = admin) => request(app).post(`/api/v1/pulse-engine/episodes/${ids.ep}/draft-event`)
    .set('Authorization', `Bearer ${token}`).send({ show_id: ids.show });

  beforeAll(async () => {
    process.env.PULSE_ENGINE_ENABLED = 'true';
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    admin = TokenService.generateTokenPair({ id: 'test-admin-draftev', email: 'evoni@draftev.dev', name: 'Evoni', groups: ['ADMIN'], role: 'ADMIN' }).accessToken;
    editor = TokenService.generateTokenPair({ id: 'test-editor-draftev', email: 'e@draftev.dev', name: 'Editor', groups: ['USER', 'EDITOR'], role: 'USER' }).accessToken;
    await run('INSERT INTO shows (id, name, slug, created_at, updated_at) VALUES (:show, :name, :slug, NOW(), NOW())', { show: ids.show, name: `Draft events ${tag}`, slug: `draftev-${tag}` });
    await run(`INSERT INTO episodes (id, show_id, title, episode_number, status, created_at, updated_at) VALUES (:ep, :show, 'The Swap', 1, 'draft', NOW(), NOW())`, ids);
    await run(`INSERT INTO character_registries (id, title, show_id, created_at, updated_at) VALUES (:reg, 'Draft events registry', :show, NOW(), NOW())`, ids);
    const [[row]] = await run(`INSERT INTO social_profiles (handle, platform, vibe_sentence, display_name, feed_layer, created_at, updated_at)
      VALUES (:handle, 'instagram', 'test', :display, 'lalaverse', NOW(), NOW()) RETURNING id`, { handle: `maren${tag}`, display: `maren${tag}` });
    pid = row.id;
    await run(`INSERT INTO registry_characters (id, registry_id, character_key, display_name, depth_level, feed_profile_id, created_at, updated_at)
               VALUES (:char, :reg, :key, 'Maren', 'alive', :pid, NOW(), NOW())`, { ...ids, key: `maren-${tag}`, pid });
    await models.PulseVoice.create({ registry_character_id: ids.char, social_profile_id: pid, habits_json: { case: 'lowercase', temperament: 'oversharer' }, examples_json: [], status: 'built', approved_at: new Date(), approved_by: 'evoni' });
    // Maren is a guest at the swap, the event of Episode 1, which is not completed yet.
    await run(`INSERT INTO world_events (id, show_id, name, status, used_in_episode_id, cost_coins, prestige, canon_consequences, created_at, updated_at)
               VALUES (:ev, :show, :name, 'draft', :ep, 0, 5, CAST(:cc AS jsonb), NOW(), NOW())`,
    { ...ids, name: `Linen swap ${tag}`, cc: JSON.stringify({ automation: { guest_profiles: [{ profile_id: pid }] } }) });
  });

  beforeEach(() => mockCreate.mockReset());

  afterAll(async () => {
    process.env.PULSE_ENGINE_ENABLED = was;
    for (const kind of queue.KINDS) queue.unregister(kind);
    await new Promise((r) => { setTimeout(r, 300); });
    await run('DELETE FROM pulse_jobs WHERE show_id = :show', ids);
    await run('DELETE FROM pulse_requests WHERE show_id = :show', ids);
    await run('DELETE FROM feed_comments WHERE show_id = :show', ids);
    await run('DELETE FROM feed_posts WHERE show_id = :show', ids);
    await run('DELETE FROM world_events WHERE show_id = :show', ids);
    await run('DELETE FROM pulse_voices WHERE registry_character_id = :char', ids);
    await run('DELETE FROM registry_characters WHERE registry_id = :reg', ids);
    await run('DELETE FROM character_registries WHERE id = :reg', ids);
    await run('DELETE FROM episodes WHERE show_id = :show', ids);
    await run('DELETE FROM social_profiles WHERE id = :pid', { pid });
    await run('DELETE FROM shows WHERE id = :show', ids);
    await sequelize.close();
  });

  test('Engine lists the episode as one whose event posts can be drafted now; not as a completed one', async () => {
    const state = await queue.stateOf(models, ids.show);
    expect(state.episodes_with_draft_events).toEqual([expect.objectContaining({ id: ids.ep, episode_number: 1, event_id: ids.ev, event_name: `Linen swap ${tag}` })]);
    expect(state.episodes_without_posts.map((e) => e.id)).not.toContain(ids.ep);
  });

  test('the button queues the event job once, marked early; admin only', async () => {
    expect((await draftEvent(editor)).status).toBe(403);
    const res = await draftEvent();
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ queued: 1, posts: 1 });
    expect(res.body.episodes_with_draft_events).toEqual([]);
    const [[job]] = await run(`SELECT payload_json FROM pulse_jobs WHERE show_id = :show AND kind = 'event'`, ids);
    expect(job.payload_json).toMatchObject({ episode_id: ids.ep, event_id: ids.ev, early: true, posters: [ids.char] });
    expect((await draftEvent()).status).toBe(409);
  });

  test('an early job\'s drafts wait in Review even when the gate passes them; completion does not queue again', async () => {
    mockCreate.mockImplementation(async ({ messages }) => {
      const prompt = messages[0].content;
      if (prompt.startsWith('Score how well')) return say({ score: 0.95, why: 'her' });
      return say({ items: [{ n: 1, text: 'counting down to the swap.', hashtag: null, reveals_story: false }] });
    });
    const [[job]] = await run(`SELECT * FROM pulse_jobs WHERE show_id = :show AND kind = 'event'`, ids);
    const out = await posting.handleEvent(models, job);
    expect(out.draftIds).toHaveLength(1);
    const [[post]] = await run('SELECT status, gate_json, story_order, event_id FROM feed_posts WHERE id = :id', { id: out.draftIds[0] });
    expect(post.status).toBe('draft');
    expect(post.gate_json.pass).toBe(true);
    expect(post.gate_json.review).toContain('event_draft');
    expect(post.event_id).toBe(ids.ev);
    expect(post.story_order).toBe(17);
    expect(await posting.enqueueForEpisode(models, { showId: ids.show, episodeId: ids.ep })).toEqual([]);
  });
});
