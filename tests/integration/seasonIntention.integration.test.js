/**
 * Season Arc build PR 5: slot intentions (Evoni's rulings and answers,
 * 2026-10-01; docs/EVENT_EPISODE_FLOW.md §8(ff)).
 *   A3. "Each future slot can carry an intention: story purpose, career
 *       focus, desired pressure, the story thread it continues, and the
 *       outcome range hoped for. Intentions are auto-drafted from the phase
 *       and the season so far, labelled, and editable."
 *   Q10. The outcome range "also sets the brief's designed_intent and
 *       allowed_outcomes at Start Episode".
 *   Q12. "draft only the next open slot, on acceptance and on demand".
 * On the test database. The AI client is a fake: no network call is made.
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

function fakeClient(json) {
  const create = jest.fn(async () => ({ content: [{ text: `Here it is:\n${JSON.stringify(json)}` }] }));
  return { client: { messages: { create } }, create };
}
const DRAFT = { story_purpose: 'Lala is tested by her first paid invite', career_focus: 'reputation', desired_pressure: 'Medium', outcome_range: { min: 'safe', max: 'pass' } };

(shouldSkip ? describe.skip : describe)('Season slot intentions (§8(ff) A3, PR 5)', () => {
  const shows = [];
  let token;
  const auth = (r) => r.set('Authorization', `Bearer ${token}`);

  async function seedSeason() {
    const show = uuid();
    shows.push(show);
    await run(`INSERT INTO shows (id, name, slug, metadata, created_at, updated_at)
               VALUES (:show, :name, :slug, CAST('{"starting_balance": 1000}' AS jsonb), NOW(), NOW())`,
      { show, name: `Intent ${show.slice(0, 8)}`, slug: `intent-${show.slice(0, 8)}` });
    const { arc_id: arcId } = await seedArc(show, models);
    return { show, arcId };
  }
  const slotId = async (arcId, n) => (await rows('SELECT id FROM season_slots WHERE arc_id = :arcId AND slot_number = :n', { arcId, n }))[0].id;
  const slot = async (arcId, n) => (await rows(
    `SELECT story_purpose, career_focus, desired_pressure, outcome_range, intention_source
       FROM season_slots WHERE arc_id = :arcId AND slot_number = :n`, { arcId, n }))[0];
  const save = (show, id, body) => auth(request(app).put(`/api/v1/world/${show}/season/slots/${id}/intention`)).send(body);

  beforeAll(async () => {
    await slotsMigration.up(sequelize.getQueryInterface(), Sequelize);
    await contextMigration.up(sequelize.getQueryInterface(), Sequelize);
    token = TokenService.generateTokenPair({
      id: 'test-user-season-intent', email: 'user@season-intent.dev', name: 'Editor', groups: ['USER', 'EDITOR'], role: 'USER',
    }).accessToken;
  });
  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => jest.restoreAllMocks());

  afterAll(async () => {
    await new Promise((resolve) => setTimeout(resolve, 200));
    for (const show of shows) {
      for (const table of ['feed_posts', 'financial_transactions', 'character_state_history', 'character_state', 'career_goals', 'franchise_knowledge', 'season_slots', 'show_arcs']) {
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

  test('an intention is saved and labelled Edited; a bad pressure or range is refused', async () => {
    const { show, arcId } = await seedSeason();
    const id = await slotId(arcId, 3);

    const res = await save(show, id, { story_purpose: ' Lala bluffs her way in ', career_focus: 'reputation', desired_pressure: 'High', outcome_range: { min: 'pass', max: 'slay' } });

    expect(res.status).toBe(200);
    expect(await slot(arcId, 3)).toEqual({
      story_purpose: 'Lala bluffs her way in', career_focus: 'reputation', desired_pressure: 'High',
      outcome_range: { min: 'pass', max: 'slay' }, intention_source: 'edited',
    });
    expect((await save(show, id, { desired_pressure: 'Extreme' })).status).toBe(400);
    expect((await save(show, id, { outcome_range: { min: 'slay', max: 'fail' } })).status).toBe(400);

    const map = (await auth(request(app).get(`/api/v1/world/${show}/season/roadmap`))).body.roadmap;
    expect(map.phases[0].slots[2].intention).toEqual(expect.objectContaining({ story_purpose: 'Lala bluffs her way in', source: 'edited' }));
  });

  // A9 (Evoni, 2026-10-01) replaces PR 5's lock on a started slot's
  // intention: "A started slot's intention stays editable while its episode
  // is a draft [...]. It locks for good when the episode is accepted."
  test('a started slot\'s intention is editable while its episode is a draft, and locks once it is accepted (A9)', async () => {
    const { show, arcId } = await seedSeason();
    const ep = uuid();
    await run(`INSERT INTO episodes (id, show_id, title, episode_number, status, created_at, updated_at) VALUES (:ep, :show, 'Started', 1, 'draft', NOW(), NOW())`, { ep, show });
    await auth(request(app).put(`/api/v1/world/${show}/season/slots/${await slotId(arcId, 1)}/episode`)).send({ episode_id: ep });

    const res = await save(show, await slotId(arcId, 1), { story_purpose: 'Still a draft' });
    expect(res.status).toBe(200);

    await run("UPDATE episodes SET evaluation_status = 'accepted' WHERE id = :ep", { ep });
    const late = await save(show, await slotId(arcId, 1), { story_purpose: 'Too late' });
    expect(late.status).toBe(409);
    expect(late.body.code).toBe('SEASON_SLOT_ACCEPTED');
  });

  test('a draft comes from the phase and the season so far, and is labelled Auto-drafted', async () => {
    const { show, arcId } = await seedSeason();
    await run(`UPDATE season_slots SET story_purpose = 'Lala arrives uninvited', actual_outcome = 'fail', actual_pressure = 'High'
               WHERE arc_id = :arcId AND slot_number = 1`, { arcId });
    const { client, create } = fakeClient(DRAFT);

    const result = await intentions.draftIntention(sequelize, show, await slotId(arcId, 2), { anthropic: client });

    expect(result.intention).toEqual({ ...DRAFT, source: 'auto-drafted' });
    expect(await slot(arcId, 2)).toEqual({ ...DRAFT, intention_source: 'auto-drafted' });
    const { model, messages } = create.mock.calls[0][0];
    expect(model).toBe('claude-haiku-4-5-20251001');
    expect(messages[0].content).toContain('S1 · E2');
    expect(messages[0].content).toContain('Phase 1: Foundation');
    expect(messages[0].content).toContain('E1: result fail, pressure High; purpose: Lala arrives uninvited');
  });

  test('a draft never replaces an edit unless Evoni confirms (force)', async () => {
    const { show, arcId } = await seedSeason();
    const id = await slotId(arcId, 5);
    await save(show, id, { story_purpose: 'Mine' });
    const { client, create } = fakeClient(DRAFT);

    await expect(intentions.draftIntention(sequelize, show, id, { anthropic: client }))
      .rejects.toMatchObject({ status: 409, code: 'SEASON_INTENTION_EDITED' });
    expect(create).not.toHaveBeenCalled();
    expect((await slot(arcId, 5)).story_purpose).toBe('Mine');

    const route = await auth(request(app).post(`/api/v1/world/${show}/season/slots/${id}/intention/draft`)).send({});
    expect(route.status).toBe(409);

    await intentions.draftIntention(sequelize, show, id, { anthropic: client, force: true });
    expect(await slot(arcId, 5)).toEqual({ ...DRAFT, intention_source: 'auto-drafted' });
  });

  test('draftNextSlot drafts only the next open slot, and never over an edit (Q12)', async () => {
    const { show, arcId } = await seedSeason();
    const ep = uuid();
    await run(`INSERT INTO episodes (id, show_id, title, episode_number, status, created_at, updated_at) VALUES (:ep, :show, 'One', 1, 'draft', NOW(), NOW())`, { ep, show });
    await auth(request(app).put(`/api/v1/world/${show}/season/slots/${await slotId(arcId, 1)}/episode`)).send({ episode_id: ep });
    const { client, create } = fakeClient(DRAFT);

    expect(await intentions.draftNextSlot(sequelize, show, { anthropic: client })).toBe(2);
    expect(create).toHaveBeenCalledTimes(1);
    expect((await slot(arcId, 2)).intention_source).toBe('auto-drafted');
    expect((await slot(arcId, 3)).intention_source).toBeNull();

    await save(show, await slotId(arcId, 2), { story_purpose: 'Mine' });
    expect(await intentions.draftNextSlot(sequelize, show, { anthropic: client })).toBeNull();
    expect(create).toHaveBeenCalledTimes(1);
  });

  test('Start Episode sets the brief\'s designed intent and allowed outcomes from the slot\'s range (Q10)', async () => {
    const { show, arcId } = await seedSeason();
    const event = uuid();
    await run(`INSERT INTO world_events (id, show_id, name, event_type, status, created_at, updated_at)
               VALUES (:event, :show, 'Ranged Gala', 'invite', 'ready', NOW(), NOW())`, { event, show });
    const id = await slotId(arcId, 1);
    await save(show, id, { story_purpose: 'Win the room', outcome_range: { min: 'pass', max: 'slay' } });
    await auth(request(app).put(`/api/v1/world/${show}/season/slots/${id}/event`)).send({ event_id: event });

    const res = await auth(request(app).post(`/api/v1/world/${show}/events/${event}/generate-episode`)).send({ draft_script: false });

    expect(res.status).toBe(201);
    const episodeId = res.body.data?.episode?.id || res.body.episode?.id;
    const [brief] = await rows('SELECT designed_intent, allowed_outcomes FROM episode_briefs WHERE episode_id = :episodeId', { episodeId });
    expect(brief).toEqual({ designed_intent: 'slay', allowed_outcomes: ['pass', 'slay'] });
  });

  test('accepting an episode readies the next slot (Q12)', async () => {
    const { show, arcId } = await seedSeason();
    await run(`INSERT INTO character_state (id, show_id, character_key, coins, reputation, brand_trust, influence, stress, created_at, updated_at)
               VALUES (:id, :show, 'lala', 1000, 3, 3, 3, 2, NOW(), NOW())`, { id: uuid(), show });
    const ep = uuid();
    await run(`INSERT INTO episodes (id, show_id, title, episode_number, status, created_at, updated_at) VALUES (:ep, :show, 'One', 1, 'draft', NOW(), NOW())`, { ep, show });
    await auth(request(app).put(`/api/v1/world/${show}/season/slots/${await slotId(arcId, 1)}/episode`)).send({ episode_id: ep });
    const spy = jest.spyOn(intentions, 'draftNextSlot').mockResolvedValue(2);

    const result = await completeEpisode(ep, show, sequelize);

    expect(result.season.slot_number).toBe(1);
    expect(spy).toHaveBeenCalledWith(sequelize, show);
  });
});
