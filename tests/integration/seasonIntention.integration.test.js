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

  // The house retry (planner PR 4): a budget refusal is final; a 529 is asked again after a pause.
  test('a budget refusal is not retried and answers 429; an overloaded model is asked twice', async () => {
    const ai = require('../../src/services/seasonAiContext');
    const { show, arcId } = await seedSeason();
    const id = await slotId(arcId, 3);
    const refused = jest.fn(async () => { throw Object.assign(new Error('AI daily budget exceeded.'), { status: 429, code: 'AI_BUDGET_EXCEEDED' }); });
    await expect(intentions.draftIntention(sequelize, show, id, { anthropic: { messages: { create: refused } } }))
      .rejects.toMatchObject({ status: 429, code: 'AI_BUDGET_EXCEEDED' });
    expect(refused).toHaveBeenCalledTimes(1);

    ai.setRetryPause(0);
    try {
      const busy = jest.fn()
        .mockRejectedValueOnce(Object.assign(new Error('Overloaded'), { status: 529 }))
        .mockResolvedValueOnce({ content: [{ text: JSON.stringify(DRAFT) }] });
      const result = await intentions.draftIntention(sequelize, show, id, { anthropic: { messages: { create: busy } } });
      expect(busy).toHaveBeenCalledTimes(2);
      expect(result.intention).toEqual({ ...DRAFT, source: 'auto-drafted' });
    } finally {
      ai.setRetryPause(ai.RETRY_PAUSE_MS);
    }
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
  // Q12 as amended (Evoni, 2026-11-12): the automatic draft on acceptance
  // fills an empty intention only. Empty is all six fields empty; a source
  // label alone counts as written. The buttons are as before.
  describe('the automatic draft fills only an empty intention (Q12 as amended)', () => {
    const FULL = `SELECT id, story_purpose, story_purposes, story_thread_id, career_focus, desired_pressure, outcome_range, intention_source,
                         event_id, episode_id, locked_at, accepted_at, updated_at
                    FROM season_slots WHERE arc_id = :arcId ORDER BY slot_number`;
    const allSlots = (arcId) => rows(FULL, { arcId });
    const threads = [];
    afterAll(async () => {
      for (const show of shows) {
        await run('UPDATE season_slots SET story_thread_id = NULL WHERE show_id = :show', { show }).catch((err) => console.error('[cleanup] slots:', err.message));
        await run('DELETE FROM season_twists WHERE show_id = :show', { show }).catch((err) => console.error('[cleanup] twists:', err.message));
      }
      if (threads.length) await run('DELETE FROM show_story_threads WHERE id IN (:threads)', { threads }).catch((err) => console.error('[cleanup] threads:', err.message));
    });
    const thread = async (show) => {
      const id = uuid();
      threads.push(id);
      await run(`INSERT INTO show_story_threads (id, show_id, title, created_at, updated_at) VALUES (:id, :show, 'Model or designer', NOW(), NOW())`, { id, show });
      return id;
    };
    // A season whose slot 1 holds an episode, so slot 2 is the next open one.
    const seasonWithNext = async () => {
      const { show, arcId } = await seedSeason();
      const ep = uuid();
      await run(`INSERT INTO episodes (id, show_id, title, episode_number, status, script_content, created_at, updated_at)
                 VALUES (:ep, :show, 'One', 1, 'draft', 'Lala: "Hi."', NOW(), NOW())`, { ep, show });
      await auth(request(app).put(`/api/v1/world/${show}/season/slots/${await slotId(arcId, 1)}/episode`)).send({ episode_id: ep });
      return { show, arcId, ep, next: await slotId(arcId, 2) };
    };
    const set = (id, sql, replacements = {}) => run(`UPDATE season_slots SET ${sql} WHERE id = :id`, { id, ...replacements });

    test('an empty next slot is drafted, as before: the four drafted fields, labelled Auto-drafted, and only that slot', async () => {
      const { show, arcId, next } = await seasonWithNext();
      const before = await allSlots(arcId);
      const { client, create } = fakeClient(DRAFT);
      expect(await intentions.draftNextSlot(sequelize, show, { anthropic: client })).toBe(2);
      expect(create).toHaveBeenCalledTimes(1);
      expect(await slot(arcId, 2)).toEqual({ ...DRAFT, intention_source: 'auto-drafted' });
      const after = await allSlots(arcId);
      expect(after.filter((r) => r.id !== next)).toEqual(before.filter((r) => r.id !== next));
    });

    test('an existing Auto-draft is left exactly as it is: the model is not asked, and no later slot is drafted instead', async () => {
      const { show, arcId } = await seasonWithNext();
      const first = fakeClient(DRAFT);
      expect(await intentions.draftNextSlot(sequelize, show, { anthropic: first.client })).toBe(2);
      const before = await allSlots(arcId);
      const second = fakeClient({ ...DRAFT, story_purpose: 'A DIFFERENT DRAFT THAT MUST NOT LAND' });
      for (let i = 0; i < 2; i += 1) {
        // eslint-disable-next-line no-await-in-loop
        expect(await intentions.draftNextSlot(sequelize, show, { anthropic: second.client })).toBeNull();
      }
      expect(second.create).not.toHaveBeenCalled();
      expect(await allSlots(arcId)).toEqual(before);
    });

    // Each of the six fields alone, with no source label, as a partly written slot holds them.
    test.each([
      ['a primary purpose', () => ["story_purpose = 'Mine'", {}]],
      ['a secondary purpose only', () => ['story_purposes = CAST(:p AS jsonb)', { p: JSON.stringify([{ text: 'A side story', primary: false, story_thread_id: null }]) }]],
      ['a story thread', async (show) => ['story_thread_id = :t', { t: await thread(show) }]],
      ['a career focus', () => ["career_focus = 'reputation'", {}]],
      ['a pressure', () => ["desired_pressure = 'High'", {}]],
      ['an outcome range', () => ['outcome_range = CAST(:r AS jsonb)', { r: JSON.stringify({ min: 'pass', max: 'slay' }) }]],
      ['an Auto-drafted label and nothing else', () => ["intention_source = 'auto-drafted'", {}]],
      ['an Edited label and nothing else', () => ["intention_source = 'edited'", {}]],
      ['a label that is neither', () => ["intention_source = 'imported'", {}]],
      ['purposes stored as something that is not a list', () => ['story_purposes = CAST(:p AS jsonb)', { p: JSON.stringify({ text: 'odd' }) }]],
    ])('a slot holding only %s is left alone: nothing asked, nothing written, slot 3 not drafted', async (_name, make) => {
      const { show, arcId, next } = await seasonWithNext();
      const [sql, replacements] = await make(show);
      await set(next, sql, replacements);
      const before = await allSlots(arcId);
      const { client, create } = fakeClient(DRAFT);
      expect(await intentions.draftNextSlot(sequelize, show, { anthropic: client })).toBeNull();
      expect(create).not.toHaveBeenCalled();
      expect(await allSlots(arcId)).toEqual(before);
    });

    test.each([
      ['an empty list of purposes', "story_purposes = '[]'::jsonb"],
      ['an empty range', "outcome_range = '{}'::jsonb"],
      ['a JSON null range', "outcome_range = 'null'::jsonb"],
      ['blank text in the text fields', "story_purpose = '  ', career_focus = '', desired_pressure = ''"],
    ])('a slot with %s is still empty, and is drafted', async (_name, sql) => {
      const { show, arcId, next } = await seasonWithNext();
      await set(next, sql);
      const { client, create } = fakeClient(DRAFT);
      expect(await intentions.draftNextSlot(sequelize, show, { anthropic: client })).toBe(2);
      expect(create).toHaveBeenCalledTimes(1);
      expect(await slot(arcId, 2)).toEqual({ ...DRAFT, intention_source: 'auto-drafted' });
    });

    test('an intention Evoni edited is left alone, as before', async () => {
      const { show, arcId, next } = await seasonWithNext();
      await save(show, next, { story_purpose: 'Mine', desired_pressure: 'Peak' });
      const before = await allSlots(arcId);
      const { client, create } = fakeClient(DRAFT);
      expect(await intentions.draftNextSlot(sequelize, show, { anthropic: client })).toBeNull();
      expect(create).not.toHaveBeenCalled();
      expect(await allSlots(arcId)).toEqual(before);
    });

    // The model is asked outside any transaction; the slot is read again under its lock before the write.
    const clientThat = (during) => {
      const create = jest.fn(async () => { await during(); return { content: [{ text: JSON.stringify(DRAFT) }] }; });
      return { client: { messages: { create } }, create };
    };

    test('saved by Evoni while the model answered: her intention is kept and the draft discarded', async () => {
      const { show, arcId, next } = await seasonWithNext();
      const { client, create } = clientThat(async () => { expect((await save(show, next, { story_purpose: 'Saved meanwhile', desired_pressure: 'Low' })).status).toBe(200); });
      expect(await intentions.draftNextSlot(sequelize, show, { anthropic: client })).toBeNull();
      expect(create).toHaveBeenCalledTimes(1);
      expect(await slot(arcId, 2)).toEqual({ story_purpose: 'Saved meanwhile', career_focus: null, desired_pressure: 'Low', outcome_range: null, intention_source: 'edited' });
    });

    test('one field written while the model answered (a pressure, no label): the slot is kept as it is now', async () => {
      const { show, arcId, next } = await seasonWithNext();
      const { client } = clientThat(() => set(next, "desired_pressure = 'Peak'"));
      expect(await intentions.draftNextSlot(sequelize, show, { anthropic: client })).toBeNull();
      expect(await slot(arcId, 2)).toEqual({ story_purpose: null, career_focus: null, desired_pressure: 'Peak', outcome_range: null, intention_source: null });
    });

    test('another draft landed while the model answered (two acceptances at once): the first is kept', async () => {
      const { show, arcId } = await seasonWithNext();
      const inner = fakeClient({ ...DRAFT, story_purpose: 'The first draft to land' });
      const { client } = clientThat(async () => { expect(await intentions.draftNextSlot(sequelize, show, { anthropic: inner.client })).toBe(2); });
      expect(await intentions.draftNextSlot(sequelize, show, { anthropic: client })).toBeNull();
      expect((await slot(arcId, 2)).story_purpose).toBe('The first draft to land');
    });

    test('the slot started while the model answered: nothing is drafted into it', async () => {
      const { show, arcId, next } = await seasonWithNext();
      const ep2 = uuid();
      await run(`INSERT INTO episodes (id, show_id, title, episode_number, status, created_at, updated_at) VALUES (:ep2, :show, 'Two', 2, 'draft', NOW(), NOW())`, { ep2, show });
      const { client } = clientThat(async () => {
        expect((await auth(request(app).put(`/api/v1/world/${show}/season/slots/${next}/episode`)).send({ episode_id: ep2 })).status).toBe(200);
      });
      jest.spyOn(console, 'error').mockImplementation(() => {});
      // Left alone, or stopped by the slot's own "changed while saving" refusal: either way nothing is written.
      const outcome = await intentions.draftNextSlot(sequelize, show, { anthropic: client }).then((n) => ({ n }), (err) => ({ err }));
      if (outcome.err) expect(outcome.err.code).toBe('SEASON_CHANGED_RETRY');
      else expect(outcome.n).toBeNull();
      expect(await slot(arcId, 2)).toEqual({ story_purpose: null, career_focus: null, desired_pressure: null, outcome_range: null, intention_source: null });
    });

    test('only the next slot\'s intention changes: episodes, briefs, events, goals, threads, twists, the arc and every other slot are as they were', async () => {
      const { show, arcId, ep, next } = await seasonWithNext();
      const event = uuid();
      await run(`INSERT INTO world_events (id, show_id, name, event_type, status, narrative_stakes, created_at, updated_at)
                 VALUES (:event, :show, 'Pencilled Gala', 'invite', 'ready', 'Be seen.', NOW(), NOW())`, { event, show });
      expect((await auth(request(app).put(`/api/v1/world/${show}/season/slots/${next}/event`)).send({ event_id: event })).status).toBe(200);
      await run(`INSERT INTO episode_briefs (id, episode_id, show_id, narrative_purpose, forward_hook, created_at, updated_at)
                 VALUES (:id, :ep, :show, 'The first visit.', 'They want her as a model.', NOW(), NOW())`, { id: uuid(), ep, show });
      await run(`INSERT INTO career_goals (id, show_id, title, target_metric, created_at, updated_at) VALUES (:id, :show, 'First Impressions', 'reputation', NOW(), NOW())`, { id: uuid(), show });
      await thread(show);
      await run(`INSERT INTO season_twists (id, show_id, arc_id, title, plant_slot_id, payoff_slot_id, status, created_at, updated_at)
                 VALUES (:id, :show, :arcId, 'Sable wants a model', :plant, :next, 'planted', NOW(), NOW())`, { id: uuid(), show, arcId, plant: await slotId(arcId, 1), next });
      const related = async () => ({
        episodes: await rows('SELECT * FROM episodes WHERE show_id = :show ORDER BY id', { show }),
        briefs: await rows('SELECT * FROM episode_briefs WHERE show_id = :show ORDER BY id', { show }),
        events: await rows('SELECT * FROM world_events WHERE show_id = :show ORDER BY id', { show }),
        goals: await rows('SELECT * FROM career_goals WHERE show_id = :show ORDER BY id', { show }),
        threads: await rows('SELECT * FROM show_story_threads WHERE show_id = :show ORDER BY id', { show }),
        twists: await rows('SELECT * FROM season_twists WHERE show_id = :show ORDER BY id', { show }),
        arcs: await rows('SELECT * FROM show_arcs WHERE show_id = :show ORDER BY id', { show }),
      });
      const before = { related: await related(), slots: await allSlots(arcId) };
      const { client } = fakeClient(DRAFT);
      expect(await intentions.draftNextSlot(sequelize, show, { anthropic: client })).toBe(2);
      expect(await related()).toEqual(before.related);
      const after = await allSlots(arcId);
      expect(after.filter((r) => r.id !== next)).toEqual(before.slots.filter((r) => r.id !== next));
      const drafted = after.find((r) => r.id === next);
      const was = before.slots.find((r) => r.id === next);
      // The slot's event, episode and lock are as they were; only its intention was written.
      expect([drafted.event_id, drafted.episode_id, drafted.locked_at, drafted.accepted_at]).toEqual([was.event_id, was.episode_id, was.locked_at, was.accepted_at]);
      expect(drafted.intention_source).toBe('auto-drafted');
    });

    test('the buttons are as before: a manual draft replaces an earlier Auto-draft, and force replaces an edit', async () => {
      const { show, arcId, next } = await seasonWithNext();
      const first = fakeClient(DRAFT);
      await intentions.draftNextSlot(sequelize, show, { anthropic: first.client });
      const manual = fakeClient({ ...DRAFT, story_purpose: 'Redrafted on demand' });
      const out = await intentions.draftIntention(sequelize, show, next, { anthropic: manual.client });
      expect(out.skipped).toBeUndefined();
      expect((await slot(arcId, 2)).story_purpose).toBe('Redrafted on demand');
      await save(show, next, { story_purpose: 'Mine' });
      await expect(intentions.draftIntention(sequelize, show, next, { anthropic: manual.client })).rejects.toMatchObject({ code: 'SEASON_INTENTION_EDITED' });
      await intentions.draftIntention(sequelize, show, next, { anthropic: manual.client, force: true });
      expect((await slot(arcId, 2)).story_purpose).toBe('Redrafted on demand');
      // force does not lift the automatic draft's rule.
      const forced = await intentions.draftIntention(sequelize, show, next, { anthropic: manual.client, force: true, onlyIfEmpty: true });
      expect(forced).toEqual({ slot_number: 2, skipped: 'occupied' });
    });

    test('accepting an episode with a written next slot: the real completion leaves that slot untouched', async () => {
      const { show, arcId, ep } = await seasonWithNext();
      await run(`INSERT INTO character_state (id, show_id, character_key, coins, reputation, brand_trust, influence, stress, created_at, updated_at)
                 VALUES (:id, :show, 'lala', 1000, 3, 3, 3, 2, NOW(), NOW())`, { id: uuid(), show });
      const first = fakeClient(DRAFT);
      await intentions.draftNextSlot(sequelize, show, { anthropic: first.client });
      const before = (await allSlots(arcId)).slice(1);
      const spy = jest.spyOn(intentions, 'draftNextSlot');
      const result = await completeEpisode(ep, show, sequelize);
      expect(result.season.slot_number).toBe(1);
      expect(spy).toHaveBeenCalledWith(sequelize, show);
      await expect(spy.mock.results[0].value).resolves.toBeNull();
      expect((await allSlots(arcId)).slice(1)).toEqual(before);
    });
  });
});
