/**
 * Season Arc build PR 7: story threads (Evoni's rulings and answers,
 * 2026-10-01; docs/EVENT_EPISODE_FLOW.md §8(ff)).
 *   A3. A slot's intention includes "the story thread it continues".
 *   A6. Accepting an episode "updates [...] story threads".
 *   Q9. "you create and name them; drafts are offered from
 *       seeds_future_events. Acceptance can mark one "advanced", and only
 *       you close one."
 * On the test database, through the thread and slot routes, Start Episode
 * and completeEpisode.
 */
jest.unmock('uuid');

const { Sequelize } = require('sequelize');
const request = require('supertest');
const crypto = require('crypto');
const app = require('../../src/app');
const TokenService = require('../../src/services/tokenService');
const models = require('../../src/models');
const slotsMigration = require('../../src/migrations/20261001230000-create-season-slots');
const contextMigration = require('../../src/migrations/20261001240000-add-episode-season-context');
const threadsMigration = require('../../src/migrations/20261001250000-create-show-story-threads');
const { seedArc } = require('../../src/services/arcProgressionService');
const { seedText } = require('../../src/services/storyThreadService');
const { completeEpisode } = require('../../src/services/episodeCompletionService');
const intentions = require('../../src/services/seasonIntentionService');

const { sequelize } = models;

const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const uuid = () => crypto.randomUUID();
const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });
const rows = async (sql, replacements = {}) => (await sequelize.query(sql, { replacements }))[0];

(shouldSkip ? describe.skip : describe)('Story threads (§8(ff) A3, A6, Q9, PR 7)', () => {
  const shows = [];
  let token;
  const auth = (r) => r.set('Authorization', `Bearer ${token}`);

  async function seedSeason() {
    const show = uuid();
    shows.push(show);
    await run(`INSERT INTO shows (id, name, slug, metadata, created_at, updated_at)
               VALUES (:show, :name, :slug, CAST('{"starting_balance": 1000}' AS jsonb), NOW(), NOW())`,
      { show, name: `Threads ${show.slice(0, 8)}`, slug: `threads-${show.slice(0, 8)}` });
    await run(`INSERT INTO character_state (id, show_id, character_key, coins, reputation, brand_trust, influence, stress, created_at, updated_at)
               VALUES (:id, :show, 'lala', 1000, 3, 3, 3, 2, NOW(), NOW())`, { id: uuid(), show });
    const { arc_id: arcId } = await seedArc(show, models);
    return { show, arcId };
  }
  const slotId = async (arcId, n) => (await rows('SELECT id FROM season_slots WHERE arc_id = :arcId AND slot_number = :n', { arcId, n }))[0].id;
  const threadsOf = async (show) => (await auth(request(app).get(`/api/v1/world/${show}/season/threads`))).body;
  const create = (show, body) => auth(request(app).post(`/api/v1/world/${show}/season/threads`)).send(body);
  const thread = async (id) => (await rows('SELECT status, last_advanced_episode_id, closed_at, reopened_at FROM show_story_threads WHERE id = :id', { id }))[0];

  beforeAll(async () => {
    for (const m of [slotsMigration, contextMigration, threadsMigration]) await m.up(sequelize.getQueryInterface(), Sequelize);
    token = TokenService.generateTokenPair({
      id: 'test-user-story-threads', email: 'user@story-threads.dev', name: 'Editor', groups: ['USER', 'EDITOR'], role: 'USER',
    }).accessToken;
  });
  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(intentions, 'draftNextSlot').mockResolvedValue(null); // no AI call on acceptance
  });
  afterEach(() => jest.restoreAllMocks());

  afterAll(async () => {
    await new Promise((resolve) => setTimeout(resolve, 200));
    for (const show of shows) {
      for (const table of ['feed_posts', 'financial_transactions', 'character_state_history', 'character_state', 'career_goals', 'franchise_knowledge', 'season_slots', 'show_story_threads', 'show_arcs']) {
        await run(`DELETE FROM ${table} WHERE show_id = :show`, { show }).catch(() => {});
      }
      await run(`DELETE FROM episode_spending_lines WHERE episode_id IN (SELECT id FROM episodes WHERE show_id = :show)`, { show });
      await run(`DELETE FROM episode_briefs WHERE episode_id IN (SELECT id FROM episodes WHERE show_id = :show)`, { show });
      await run('UPDATE world_events SET used_in_episode_id = NULL WHERE show_id = :show', { show });
      await run('DELETE FROM episodes WHERE show_id = :show', { show });
      await run('DELETE FROM world_events WHERE show_id = :show', { show });
      await run('DELETE FROM shows WHERE id = :show', { show });
    }
    await sequelize.close();
  });

  test('seedText reads a string seed or an object seed\'s reason', () => {
    expect(seedText('  Maison Belle calls back ')).toBe('Maison Belle calls back');
    expect(seedText({ type: 'momentum_chain', from_event: 'Gala', reason: 'The rival returns' })).toBe('The rival returns');
    expect(seedText({})).toBeNull();
  });

  test('Evoni creates and names a thread; a title is required', async () => {
    const { show } = await seedSeason();

    const res = await create(show, { title: 'The rival from E1', description: 'She keeps showing up' });

    expect(res.status).toBe(201);
    expect(res.body.thread).toEqual(expect.objectContaining({ title: 'The rival from E1', status: 'open', source: 'evoni' }));
    expect((await create(show, { title: '  ' })).status).toBe(400);
    expect((await threadsOf(show)).threads.map((t) => t.title)).toEqual(['The rival from E1']);
  });

  test('drafts come from the episodes\' seeds, and a seed made into a thread is not offered again', async () => {
    const { show } = await seedSeason();
    const ep = uuid();
    await run(`INSERT INTO episodes (id, show_id, title, episode_number, status, created_at, updated_at) VALUES (:ep, :show, 'Gala Night', 1, 'draft', NOW(), NOW())`, { ep, show });
    await run(`INSERT INTO episode_briefs (id, episode_id, show_id, narrative_chain, created_at, updated_at)
               VALUES (:id, :ep, :show, CAST(:chain AS jsonb), NOW(), NOW())`,
      { id: uuid(), ep, show, chain: JSON.stringify({ seeds_future_events: ['Maison Belle calls back', { type: 'momentum_chain', reason: 'The rival returns' }] }) });

    const before = await threadsOf(show);
    expect(before.drafts.map((d) => [d.seed_text, d.episode_title])).toEqual([
      ['Maison Belle calls back', 'Gala Night'], ['The rival returns', 'Gala Night'],
    ]);
    expect(before.threads).toEqual([]); // nothing saved until Evoni names it

    const res = await create(show, { title: 'Maison Belle returns', seed_text: 'Maison Belle calls back', episode_id: ep });
    expect(res.body.thread).toEqual(expect.objectContaining({ source: 'seed', opened_episode_id: ep }));
    expect((await threadsOf(show)).drafts.map((d) => d.seed_text)).toEqual(['The rival returns']);
  });

  test('a slot\'s intention names the thread it continues; a closed thread cannot be chosen; only a close closes it', async () => {
    const { show, arcId } = await seedSeason();
    const open = (await create(show, { title: 'Open thread' })).body.thread;
    const toClose = (await create(show, { title: 'Done thread' })).body.thread;
    const id = await slotId(arcId, 4);

    const saved = await auth(request(app).put(`/api/v1/world/${show}/season/slots/${id}/intention`))
      .send({ story_purpose: 'Follow it up', story_thread_id: open.id });
    expect(saved.status).toBe(200);
    const map = (await auth(request(app).get(`/api/v1/world/${show}/season/roadmap`))).body.roadmap;
    expect(map.phases[0].slots[3].intention.story_thread).toEqual({ id: open.id, title: 'Open thread', status: 'open' });
    expect((await threadsOf(show)).threads.find((t) => t.id === open.id).slot_numbers).toEqual([4]);

    expect((await auth(request(app).post(`/api/v1/world/${show}/season/threads/${toClose.id}/close`))).status).toBe(200);
    expect((await thread(toClose.id)).status).toBe('closed');
    const refused = await auth(request(app).put(`/api/v1/world/${show}/season/slots/${await slotId(arcId, 5)}/intention`))
      .send({ story_purpose: 'x', story_thread_id: toClose.id });
    expect(refused.status).toBe(409);
    expect(refused.body.code).toBe('STORY_THREAD_CLOSED');
  });

  test('an AI draft of the intention keeps the slot\'s thread', async () => {
    const { show, arcId } = await seedSeason();
    const t = (await create(show, { title: 'Kept' })).body.thread;
    const id = await slotId(arcId, 2);
    await auth(request(app).put(`/api/v1/world/${show}/season/slots/${id}/intention`)).send({ story_purpose: 'Mine', story_thread_id: t.id });
    const client = { messages: { create: jest.fn(async () => ({ content: [{ text: JSON.stringify({ story_purpose: 'Drafted', desired_pressure: 'Low' }) }] })) } };

    await intentions.draftIntention(sequelize, show, id, { anthropic: client, force: true });

    const [s] = await rows('SELECT story_purpose, story_thread_id FROM season_slots WHERE id = :id', { id });
    expect(s).toEqual({ story_purpose: 'Drafted', story_thread_id: t.id });
  });

  test('Start Episode snapshots the thread; acceptance marks it advanced, and leaves a closed one closed', async () => {
    const { show, arcId } = await seedSeason();
    const t = (await create(show, { title: 'The rival' })).body.thread;
    const event = uuid();
    await run(`INSERT INTO world_events (id, show_id, name, event_type, status, created_at, updated_at)
               VALUES (:event, :show, 'Rival Gala', 'invite', 'ready', NOW(), NOW())`, { event, show });
    const id = await slotId(arcId, 1);
    await auth(request(app).put(`/api/v1/world/${show}/season/slots/${id}/intention`)).send({ story_purpose: 'Face her', story_thread_id: t.id });
    await auth(request(app).put(`/api/v1/world/${show}/season/slots/${id}/event`)).send({ event_id: event });

    const started = await auth(request(app).post(`/api/v1/world/${show}/events/${event}/generate-episode`)).send({ draft_script: false });
    expect(started.status).toBe(201);
    const episodeId = started.body.data?.episode?.id || started.body.episode?.id;
    const [{ season_context: sc }] = await rows('SELECT season_context FROM episodes WHERE id = :episodeId', { episodeId });
    expect(sc.story_thread).toBe('The rival');

    const result = await completeEpisode(episodeId, show, sequelize);

    expect(result.season.story_thread_advanced).toBe(t.id);
    expect(await thread(t.id)).toEqual(expect.objectContaining({ status: 'advanced', last_advanced_episode_id: episodeId }));

    // A closed thread stays closed when its slot's episode is accepted.
    const closed = (await create(show, { title: 'Closed one' })).body.thread;
    const ep2 = uuid();
    await run(`INSERT INTO episodes (id, show_id, title, episode_number, status, created_at, updated_at) VALUES (:ep2, :show, 'Two', 2, 'draft', NOW(), NOW())`, { ep2, show });
    await run('UPDATE season_slots SET episode_id = :ep2, story_thread_id = :tid, locked_at = NOW() WHERE arc_id = :arcId AND slot_number = 2', { ep2, tid: closed.id, arcId });
    await auth(request(app).post(`/api/v1/world/${show}/season/threads/${closed.id}/close`));
    const second = await completeEpisode(ep2, show, sequelize);
    expect(second.season.story_thread_advanced).toBeNull();
    expect((await thread(closed.id)).status).toBe('closed');
  });

  test('Evoni reopens a closed thread, keeping its history (PR 7 choice 1)', async () => {
    const { show, arcId } = await seedSeason();
    const plain = (await create(show, { title: 'Never advanced' })).body.thread;
    const advanced = (await create(show, { title: 'Advanced once' })).body.thread;
    const ep = uuid();
    await run(`INSERT INTO episodes (id, show_id, title, episode_number, status, created_at, updated_at) VALUES (:ep, :show, 'One', 1, 'draft', NOW(), NOW())`, { ep, show });
    await run("UPDATE show_story_threads SET status = 'advanced', last_advanced_episode_id = :ep, last_advanced_at = NOW() WHERE id = :id", { ep, id: advanced.id });
    const reopen = (id) => auth(request(app).post(`/api/v1/world/${show}/season/threads/${id}/reopen`));
    for (const t of [plain, advanced]) await auth(request(app).post(`/api/v1/world/${show}/season/threads/${t.id}/close`));

    expect((await reopen(plain.id)).status).toBe(200);
    expect((await reopen(advanced.id)).status).toBe(200);

    const p = await thread(plain.id);
    expect(p.status).toBe('open');
    expect(p.closed_at).not.toBeNull(); // history kept
    expect(p.reopened_at).not.toBeNull();
    expect(await thread(advanced.id)).toEqual(expect.objectContaining({ status: 'advanced', last_advanced_episode_id: ep }));
    const saved = await auth(request(app).put(`/api/v1/world/${show}/season/slots/${await slotId(arcId, 3)}/intention`))
      .send({ story_purpose: 'Back again', story_thread_id: plain.id });
    expect(saved.status).toBe(200); // choosable again
    expect((await threadsOf(show)).threads.find((t) => t.id === plain.id).reopened_at).toBeTruthy();
    expect((await reopen(uuid())).status).toBe(404);
  });
});
