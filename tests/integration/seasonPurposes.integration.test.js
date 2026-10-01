/**
 * Season Arc rulings A9 and A10 (Evoni, 2026-10-01; docs/EVENT_EPISODE_FLOW.md
 * §8(ff)).
 *   A9. "A started slot's intention stays editable while its episode is a
 *       draft; saving updates the episode's season snapshot (and the brief's
 *       intent/allowed outcomes per Q10). It locks for good when the episode
 *       is accepted."
 *   A10. "A slot can hold up to three story purposes, one marked primary,
 *       each optionally tied to a story thread. Desired pressure and the
 *       outcome range stay single per slot. The script writer receives all
 *       purposes, primary first; the roadmap card shows the primary with
 *       "+N more"."
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
const purposesMigration = require('../../src/migrations/20261001270000-add-season-slot-story-purposes');
const { seedArc } = require('../../src/services/arcProgressionService');
const intentions = require('../../src/services/seasonIntentionService');
const { completeEpisode } = require('../../src/services/episodeCompletionService');

const { sequelize } = models;

const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const uuid = () => crypto.randomUUID();
const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });
const rows = async (sql, replacements = {}) => (await sequelize.query(sql, { replacements }))[0];

(shouldSkip ? describe.skip : describe)('Season slot purposes and started-slot edits (§8(ff) A9, A10)', () => {
  const shows = [];
  let token;
  const auth = (r) => r.set('Authorization', `Bearer ${token}`);

  async function seedSeason() {
    const show = uuid();
    shows.push(show);
    await run(`INSERT INTO shows (id, name, slug, metadata, created_at, updated_at)
               VALUES (:show, :name, :slug, CAST('{"starting_balance": 1000}' AS jsonb), NOW(), NOW())`,
      { show, name: `Purposes ${show.slice(0, 8)}`, slug: `purposes-${show.slice(0, 8)}` });
    await run(`INSERT INTO character_state (id, show_id, character_key, coins, reputation, brand_trust, influence, stress, created_at, updated_at)
               VALUES (:id, :show, 'lala', 1000, 3, 3, 3, 2, NOW(), NOW())`, { id: uuid(), show });
    const { arc_id: arcId } = await seedArc(show, models);
    return { show, arcId };
  }
  const slotId = async (arcId, n) => (await rows('SELECT id FROM season_slots WHERE arc_id = :arcId AND slot_number = :n', { arcId, n }))[0].id;
  const save = (show, id, body) => auth(request(app).put(`/api/v1/world/${show}/season/slots/${id}/intention`)).send(body);
  const thread = async (show, title) => (await auth(request(app).post(`/api/v1/world/${show}/season/threads`)).send({ title })).body.thread;
  const roadmapSlot = async (show, n) => {
    const map = (await auth(request(app).get(`/api/v1/world/${show}/season/roadmap`))).body.roadmap;
    return map.phases.flatMap((p) => p.slots).find((s) => s.slot_number === n);
  };

  beforeAll(async () => {
    for (const m of [slotsMigration, contextMigration, threadsMigration, purposesMigration]) await m.up(sequelize.getQueryInterface(), Sequelize);
    token = TokenService.generateTokenPair({
      id: 'test-user-season-purposes', email: 'user@season-purposes.dev', name: 'Editor', groups: ['USER', 'EDITOR'], role: 'USER',
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
      await run('DELETE FROM episode_spending_lines WHERE episode_id IN (SELECT id FROM episodes WHERE show_id = :show)', { show });
      await run('DELETE FROM episode_briefs WHERE episode_id IN (SELECT id FROM episodes WHERE show_id = :show)', { show });
      await run('DELETE FROM episode_todo_lists WHERE episode_id IN (SELECT id FROM episodes WHERE show_id = :show)', { show }).catch(() => {});
      await run('UPDATE world_events SET used_in_episode_id = NULL WHERE show_id = :show', { show });
      await run('DELETE FROM episodes WHERE show_id = :show', { show });
      await run('DELETE FROM world_events WHERE show_id = :show', { show });
      await run('DELETE FROM shows WHERE id = :show', { show });
    }
    await sequelize.close();
  });

  test('a slot holds up to three purposes, one primary, each with an optional thread (A10)', async () => {
    const { show, arcId } = await seedSeason();
    const rival = await thread(show, 'The rival');
    const debt = await thread(show, 'Old debt');
    const id = await slotId(arcId, 3);

    const res = await save(show, id, {
      story_purposes: [
        { text: 'The rival notices', primary: false, story_thread_id: rival.id },
        { text: 'Lala bluffs her way in', primary: true },
        { text: '', primary: false, story_thread_id: debt.id },
      ],
      desired_pressure: 'High',
      outcome_range: { min: 'pass', max: 'slay' },
    });

    expect(res.status).toBe(200);
    const [stored] = await rows('SELECT story_purpose, story_thread_id, story_purposes, desired_pressure FROM season_slots WHERE id = :id', { id });
    expect(stored).toEqual({
      // The single columns mirror the primary.
      story_purpose: 'Lala bluffs her way in',
      story_thread_id: null,
      story_purposes: [
        { text: 'Lala bluffs her way in', primary: true, story_thread_id: null },
        { text: 'The rival notices', primary: false, story_thread_id: rival.id },
        { text: '', primary: false, story_thread_id: debt.id },
      ],
      desired_pressure: 'High',
    });

    const card = await roadmapSlot(show, 3);
    expect(card.intention.story_purpose).toBe('Lala bluffs her way in');
    expect(card.intention.story_purposes.map((p) => [p.text, p.primary, p.story_thread?.title || null])).toEqual([
      ['Lala bluffs her way in', true, null],
      ['The rival notices', false, 'The rival'],
      ['', false, 'Old debt'],
    ]);
    expect(card.intention_editable).toBe(true);

    const four = Array.from({ length: 4 }, (_, i) => ({ text: `P${i}` }));
    expect((await save(show, id, { story_purposes: four })).status).toBe(400);
    expect((await save(show, id, { story_purposes: [{ text: 'A', primary: true }, { text: 'B', primary: true }] })).status).toBe(400);

    // A single story_purpose (the old body, and the AI draft) replaces only the primary's text.
    expect((await save(show, id, { story_purpose: 'Lala walks in openly' })).status).toBe(200);
    const [{ story_purposes: after }] = await rows('SELECT story_purposes FROM season_slots WHERE id = :id', { id });
    expect(after.map((p) => p.text)).toEqual(['Lala walks in openly', 'The rival notices', '']);
  });

  test('editing a started slot updates its episode\'s snapshot and brief; acceptance advances every thread and locks it (A9, A10)', async () => {
    const { show, arcId } = await seedSeason();
    const rival = await thread(show, 'The rival');
    const mother = await thread(show, 'Her mother');
    const event = uuid();
    await run(`INSERT INTO world_events (id, show_id, name, event_type, status, created_at, updated_at)
               VALUES (:event, :show, 'Rival Gala', 'invite', 'ready', NOW(), NOW())`, { event, show });
    const id = await slotId(arcId, 1);
    await save(show, id, { story_purpose: 'Face her', story_thread_id: rival.id, outcome_range: { min: 'safe', max: 'pass' } });
    await auth(request(app).put(`/api/v1/world/${show}/season/slots/${id}/event`)).send({ event_id: event });

    const started = await auth(request(app).post(`/api/v1/world/${show}/events/${event}/generate-episode`)).send({ draft_script: false });
    expect(started.status).toBe(201);
    const ep = started.body.data?.episode?.id || started.body.episode?.id;
    expect((await roadmapSlot(show, 1)).intention_editable).toBe(true);

    const res = await save(show, id, {
      story_purposes: [
        { text: 'Face her', primary: true, story_thread_id: rival.id },
        { text: 'Her mother calls mid-gala', primary: false, story_thread_id: mother.id },
      ],
      outcome_range: { min: 'pass', max: 'slay' },
    });

    expect(res.status).toBe(200);
    expect(res.body.started).toBe(true);
    const [{ season_context: sc }] = await rows('SELECT season_context FROM episodes WHERE id = :ep', { ep });
    expect(sc.story_purposes).toEqual([
      { text: 'Face her', primary: true, story_thread: 'The rival' },
      { text: 'Her mother calls mid-gala', primary: false, story_thread: 'Her mother' },
    ]);
    expect(sc.outcome_range).toEqual({ min: 'pass', max: 'slay' });
    const [brief] = await rows('SELECT designed_intent, allowed_outcomes FROM episode_briefs WHERE episode_id = :ep AND deleted_at IS NULL', { ep });
    expect(brief).toEqual({ designed_intent: 'slay', allowed_outcomes: ['pass', 'slay'] });
    // Drafting stays future-only.
    await expect(intentions.draftIntention(sequelize, show, id, { anthropic: { messages: { create: jest.fn() } }, force: true }))
      .rejects.toMatchObject({ status: 409 });

    const result = await completeEpisode(ep, show, sequelize);

    expect(result.season.story_thread_advanced).toBe(rival.id);
    expect(result.season.story_threads_advanced).toEqual([rival.id, mother.id]);
    const statuses = await rows('SELECT id, status FROM show_story_threads WHERE show_id = :show ORDER BY title', { show });
    expect(statuses.map((t) => t.status)).toEqual(['advanced', 'advanced']);

    expect((await roadmapSlot(show, 1)).intention_editable).toBe(false);
    const late = await save(show, id, { story_purpose: 'Too late' });
    expect(late.status).toBe(409);
    expect(late.body.code).toBe('SEASON_SLOT_ACCEPTED');
  });

  test('the threads list names every slot whose purposes continue a thread', async () => {
    const { show, arcId } = await seedSeason();
    const rival = await thread(show, 'The rival');
    await save(show, await slotId(arcId, 4), { story_purposes: [{ text: 'Main' }, { text: 'Side', story_thread_id: rival.id }] });
    await save(show, await slotId(arcId, 6), { story_purpose: 'Primary', story_thread_id: rival.id });

    const { threads } = (await auth(request(app).get(`/api/v1/world/${show}/season/threads`))).body;

    expect(threads.find((t) => t.id === rival.id).slot_numbers).toEqual([4, 6]);
  });
});
