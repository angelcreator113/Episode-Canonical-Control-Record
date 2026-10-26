/**
 * Special episodes (Evoni, 2026-10-26: "Seems like sometimes we will have
 * special episodes to keep up with our events what's do you think?" — "All
 * three and on YouTube, show me first"; services/seasonSpecials):
 *   - before the migration: the roadmap and the release schedule read as
 *     before, and every special action refuses ("needs its migration first");
 *   - a bonus episode sits after a weekly one with its own date and time,
 *     takes its event's Start Episode, and moves no weekly number or date;
 *   - a stand-alone special counts toward no part and no goal;
 *   - a two-parter: Part 1 is the event's episode, Part 2 is made from it,
 *     Part 1 alone is "to be continued", and completing Part 2 completes the
 *     event once (one evaluation, one set of ledger rows).
 * On the test database, through the routes and completeEpisode.
 */
jest.unmock('uuid');

const { Sequelize } = require('sequelize');
const request = require('supertest');
const crypto = require('crypto');
const app = require('../../src/app');
const TokenService = require('../../src/services/tokenService');
const models = require('../../src/models');
const slotsMigration = require('../../src/migrations/20261001230000-create-season-slots');
const specialsMigration = require('../../src/migrations/20261026150000-create-season-specials');
const { seedArc } = require('../../src/services/arcProgressionService');
const { completeEpisode } = require('../../src/services/episodeCompletionService');

const { sequelize } = models;

const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const uuid = () => crypto.randomUUID();
const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });
const rows = async (sql, replacements = {}) => (await sequelize.query(sql, { replacements }))[0];
const SCHEDULE = { day: 'sun', time: '10:00', cadence: 'weekly', first_release: '2026-11-01', paused: false, platforms: ['youtube'], tz: 'America/New_York' };

(shouldSkip ? describe.skip : describe)('Special episodes: bonus, stand-alone, two-parter (2026-10-26)', () => {
  const shows = [];
  let token;
  const auth = (r) => r.set('Authorization', `Bearer ${token}`);

  async function seedSeason() {
    const show = uuid();
    shows.push(show);
    await run(`INSERT INTO shows (id, name, slug, metadata, created_at, updated_at)
               VALUES (:show, :name, :slug, CAST('{"starting_balance": 1000}' AS jsonb), NOW(), NOW())`,
      { show, name: `Specials ${show.slice(0, 8)}`, slug: `specials-${show.slice(0, 8)}` });
    await run(`INSERT INTO character_state (id, show_id, character_key, coins, reputation, brand_trust, influence, stress, created_at, updated_at)
               VALUES (:id, :show, 'lala', 1000, 3, 3, 3, 2, NOW(), NOW())`, { id: uuid(), show });
    const { arc_id: arcId } = await seedArc(show, models);
    return { show, arcId };
  }
  async function addEvent(show, name, { date = null, prestige = 5, canon = {} } = {}) {
    const id = uuid();
    await run(`INSERT INTO world_events (id, show_id, name, event_type, status, prestige, strictness, cost_coins, event_date, canon_consequences, created_at, updated_at)
               VALUES (:id, :show, :name, 'invite', 'draft', :prestige, 5, 0, :date, CAST(:canon AS jsonb), NOW(), NOW())`,
      { id, show, name, prestige, date, canon: JSON.stringify(canon) });
    return id;
  }
  async function goal(show, title) {
    const id = uuid();
    await run(`INSERT INTO career_goals (id, show_id, title, type, target_metric, current_value, target_value, starting_value, status, created_at, updated_at)
               VALUES (:id, :show, :title, 'secondary', 'reputation', 0, 10, 0, 'active', NOW(), NOW())`, { id, show, title });
    return id;
  }
  const slotId = async (arcId, n) => (await rows('SELECT id FROM season_slots WHERE arc_id = :arcId AND slot_number = :n', { arcId, n }))[0].id;
  const slot = async (arcId, n) => (await rows(
    'SELECT event_id, episode_id, locked_at, actual_outcome, accepted_at FROM season_slots WHERE arc_id = :arcId AND slot_number = :n', { arcId, n }))[0];
  const pencil = async (show, arcId, n, eventId) => auth(request(app).put(`/api/v1/world/${show}/season/slots/${await slotId(arcId, n)}/event`)).send({ event_id: eventId });
  const roadmap = async (show) => (await auth(request(app).get(`/api/v1/world/${show}/season/roadmap`))).body.roadmap;
  const releaseView = async (show) => (await auth(request(app).get(`/api/v1/world/${show}/release-schedule`))).body.data;
  const startEpisode = (show, eventId) => auth(request(app).post(`/api/v1/world/${show}/events/${eventId}/generate-episode`)).send({ draft_script: false });
  const addSpecial = (show, body) => auth(request(app).post(`/api/v1/world/${show}/season/specials`)).send(body);
  const allSlots = (map) => map.phases.flatMap((p) => p.slots);

  beforeAll(async () => {
    await slotsMigration.up(sequelize.getQueryInterface(), Sequelize);
    // The first test reads the app before the specials' migration has run.
    await specialsMigration.down(sequelize.getQueryInterface(), Sequelize);
    token = TokenService.generateTokenPair({
      id: 'test-user-season-specials', email: 'user@season-specials.dev', name: 'Editor', groups: ['USER', 'EDITOR'], role: 'USER',
    }).accessToken;
  });
  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => jest.restoreAllMocks());

  afterAll(async () => {
    await new Promise((resolve) => setTimeout(resolve, 300)); // Start Episode's after-commit work
    for (const show of shows) {
      for (const table of ['season_specials', 'feed_posts', 'financial_transactions', 'character_state_history', 'character_state', 'career_goals', 'franchise_knowledge', 'season_slots', 'show_arcs']) {
        await run(`DELETE FROM ${table} WHERE show_id = :show`, { show }).catch(() => {});
      }
      for (const table of ['episode_spending_lines', 'episode_briefs', 'episode_todo_lists', 'scene_plans', 'episode_wardrobe']) {
        await run(`DELETE FROM ${table} WHERE episode_id IN (SELECT id FROM episodes WHERE show_id = :show)`, { show }).catch(() => {});
      }
      await run('UPDATE world_events SET used_in_episode_id = NULL WHERE show_id = :show', { show });
      await run('DELETE FROM episodes WHERE show_id = :show', { show }).catch(() => {});
      await run('DELETE FROM world_events WHERE show_id = :show', { show }).catch(() => {});
      await run('DELETE FROM shows WHERE id = :show', { show }).catch(() => {});
    }
    await sequelize.close();
  });

  test('before the migration: the roadmap and the schedule read as before; every special action refuses politely', async () => {
    const { show, arcId } = await seedSeason();
    const ev = await addEvent(show, 'Gala');
    expect((await pencil(show, arcId, 12, ev)).status).toBe(200);

    const map = await roadmap(show);
    expect(map.specials_ready).toBe(false);
    expect(map.specials).toEqual([]);
    expect(map.two_parters).toEqual([]);
    expect(allSlots(map).every((s) => s.two_part === null)).toBe(true);
    expect(allSlots(map)).toHaveLength(24);

    const add = await addSpecial(show, { kind: 'bonus', after_slot_number: 7, event_id: ev });
    expect(add.status).toBe(409);
    expect(add.body.code).toBe('SEASON_SPECIALS_MIGRATION_PENDING');
    expect(add.body.error).toMatch(/need their migration first/);
    const two = await auth(request(app).post(`/api/v1/world/${show}/season/two-parters`)).send({ slot_id: await slotId(arcId, 12) });
    expect(two.status).toBe(409);
    expect(two.body.code).toBe('SEASON_SPECIALS_MIGRATION_PENDING');

    await auth(request(app).put(`/api/v1/world/${show}/release-schedule`)).send({ release_schedule: SCHEDULE });
    const view = await releaseView(show);
    expect(view.specials).toEqual([]);
    expect(view.slots['12'].date).toBe('2027-01-17');

    // A Start Episode still lands in the weekly slot the event is pencilled into.
    const started = await startEpisode(show, ev);
    expect(started.status).toBe(201);
    expect((await slot(arcId, 12)).episode_id).toBe(started.body.data.episode.id);

    await specialsMigration.up(sequelize.getQueryInterface(), Sequelize);
    expect((await roadmap(show)).specials_ready).toBe(true);
  });

  test('a bonus episode: after E7 with its own day and time; it takes its event\'s Start; no weekly number or date moves', async () => {
    const { show, arcId } = await seedSeason();
    await auth(request(app).put(`/api/v1/world/${show}/release-schedule`)).send({ release_schedule: SCHEDULE });
    const datesBefore = (await releaseView(show)).slots;
    const ev = await addEvent(show, 'Midweek Rooftop', { date: '2026-12-16', prestige: 9 });
    expect((await pencil(show, arcId, 8, ev)).status).toBe(200);

    const add = await addSpecial(show, { kind: 'bonus', after_slot_number: 7, event_id: ev, release_date: '2026-12-16', release_time: '18:00' });

    expect(add.status).toBe(201);
    expect(add.body.data).toEqual(expect.objectContaining({ label: 'Special · after E7', moved_from: 8 }));
    let map = await roadmap(show);
    expect(map.specials).toHaveLength(1);
    expect(map.specials[0]).toEqual(expect.objectContaining({
      kind: 'bonus', label: 'Special · after E7', after_slot_number: 7, phase: 1, state: 'event_ready', title: 'Midweek Rooftop',
      release: { date: '2026-12-16', time: '18:00' },
    }));
    expect(allSlots(map).find((s) => s.slot_number === 8).state).toBe('needs_event');
    expect(map.available_events.map((e) => e.id)).not.toContain(ev);

    const started = await startEpisode(show, ev);
    expect(started.status).toBe(201);
    const episodeId = started.body.data.episode.id;
    map = await roadmap(show);
    expect(map.specials[0].episode.id).toBe(episodeId);
    expect(map.specials[0].state).toBe('in_production');
    expect(allSlots(map).filter((s) => s.episode)).toEqual([]);
    expect(map.unslotted_episodes.map((e) => e.id)).not.toContain(episodeId);
    const [ep] = await rows(`SELECT season_context, to_char(air_date AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS day FROM episodes WHERE id = :episodeId`, { episodeId });
    expect(ep.season_context.label).toBe('S1 · Special · after E7');
    expect(ep.season_context.special).toEqual(expect.objectContaining({ kind: 'bonus', after_slot_number: 7, counts_toward_parts: true }));
    expect(ep.day).toBe('2026-12-16');

    const view = await releaseView(show);
    expect(view.slots).toEqual(datesBefore);
    const row = view.episodes.find((r) => r.episode_id === episodeId);
    expect(row).toEqual(expect.objectContaining({ number: null, date: '2026-12-16', time: '18:00', source: 'special' }));
    expect(row.special).toEqual(expect.objectContaining({ kind: 'bonus', label: 'Special · after E7' }));
    expect(view.specials[0]).toEqual(expect.objectContaining({ special_id: map.specials[0].id, date: '2026-12-16', suggested: expect.objectContaining({ date: '2026-12-16', from: 'event' }) }));
    // In order, between E7 and E8.
    const order = view.episodes.map((r) => r.special?.label || `E${r.number}`);
    expect(order).toEqual(['Special · after E7']);

    // Its date moves with an edit, and so does its episode's release date.
    const edit = await auth(request(app).patch(`/api/v1/world/${show}/season/specials/${map.specials[0].id}`)).send({ release_date: '2026-12-17' });
    expect(edit.status).toBe(200);
    const [moved] = await rows(`SELECT to_char(air_date AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS day FROM episodes WHERE id = :episodeId`, { episodeId });
    expect(moved.day).toBe('2026-12-17');
    expect((await releaseView(show)).slots).toEqual(datesBefore);

    // Accepting it records the result on the special; no weekly slot changes.
    const result = await completeEpisode(episodeId, show, sequelize);
    expect(result.season).toBeNull();
    const [sp] = await rows('SELECT actual_outcome, accepted_at FROM season_specials WHERE id = :id', { id: map.specials[0].id });
    expect(sp.actual_outcome).toBe(result.evaluation.tier);
    expect(sp.accepted_at).not.toBeNull();
    expect((await roadmap(show)).specials[0].state).toBe('done');
  });

  test('goal coverage counts a bonus\'s event like any other; a stand-alone special counts toward no goal', async () => {
    const { show, arcId } = await seedSeason();
    const g = await goal(show, 'Reputation 10');
    const bonusEvent = await addEvent(show, 'Bonus Gala', { canon: { pinned_goal_ids: [g] } });
    const holidayEvent = await addEvent(show, 'Holiday Party', { canon: { pinned_goal_ids: [g] } });
    expect((await addSpecial(show, { kind: 'special', special_type: 'holiday', after_slot_number: 3, event_id: holidayEvent, title: 'Holiday at the Penthouse' })).status).toBe(201);
    let cov = (await auth(request(app).get(`/api/v1/world/${show}/season/goal-coverage`))).body;
    expect(cov.slots).toEqual([]);
    expect(cov.parts.find((p) => p.phase === 1).gaps.map((x) => x.goal_id)).toContain(g);

    const add = await addSpecial(show, { kind: 'bonus', after_slot_number: 3, event_id: bonusEvent });
    expect(add.status).toBe(201);
    cov = (await auth(request(app).get(`/api/v1/world/${show}/season/goal-coverage`))).body;
    expect(cov.slots).toHaveLength(1);
    expect(cov.slots[0]).toEqual(expect.objectContaining({ slot_id: add.body.data.id, phase: 1, event_id: bonusEvent }));
    expect(cov.parts.find((p) => p.phase === 1).gaps.map((x) => x.goal_id)).not.toContain(g);
    const mover = cov.goals.find((x) => x.id === g).movers.find((m) => m.event_id === bonusEvent);
    expect(mover.code).toBe('Special · after E3');
    expect(arcId).toBeTruthy();
  });

  test('a stand-alone special: a title and a date, outside the parts; removed while it has no episode', async () => {
    const { show } = await seedSeason();
    const add = await addSpecial(show, { kind: 'special', special_type: 'holiday', after_slot_number: 12, title: 'Holiday at the Penthouse' });
    expect(add.status).toBe(201);
    expect(add.body.data.label).toBe('Holiday special');
    const map = await roadmap(show);
    expect(map.specials[0]).toEqual(expect.objectContaining({ kind: 'special', special_type: 'holiday', label: 'Holiday special', title: 'Holiday at the Penthouse', phase: null, counts_toward_parts: false, state: 'needs_event' }));
    expect(map.counts.needs_event).toBe(24);

    expect((await addSpecial(show, { kind: 'bonus', after_slot_number: 3 })).status).toBe(400);
    expect((await addSpecial(show, { kind: 'special', special_type: 'birthday', after_slot_number: 3 })).status).toBe(400);
    expect((await addSpecial(show, { kind: 'special', special_type: 'recap', after_slot_number: 30 })).status).toBe(400);

    const removed = await auth(request(app).delete(`/api/v1/world/${show}/season/specials/${map.specials[0].id}`));
    expect(removed.status).toBe(200);
    expect((await roadmap(show)).specials).toEqual([]);
  });

  test('pencilling a bonus\'s event into a weekly slot takes it out of the bonus', async () => {
    const { show, arcId } = await seedSeason();
    const ev = await addEvent(show, 'Pop-up');
    expect((await addSpecial(show, { kind: 'bonus', after_slot_number: 2, event_id: ev })).status).toBe(201);
    expect((await pencil(show, arcId, 5, ev)).status).toBe(200);
    const map = await roadmap(show);
    expect(map.specials[0].event).toBeNull();
    expect(allSlots(map).find((s) => s.slot_number === 5).event.id).toBe(ev);
  });

  test('a two-parter: Part 1 is the event\'s episode, Part 2 is made from it, and the event completes once, with Part 2', async () => {
    const { show, arcId } = await seedSeason();
    const ev = await addEvent(show, 'The Finale Gala', { prestige: 9 });
    expect((await pencil(show, arcId, 12, ev)).status).toBe(200);

    const made = await auth(request(app).post(`/api/v1/world/${show}/season/two-parters`)).send({ slot_id: await slotId(arcId, 12) });
    expect(made.status).toBe(201);
    expect(made.body.data).toEqual(expect.objectContaining({ part_one: 'E12 · Part 1/2', part_two: 'E13 · Part 2/2' }));
    expect((await slot(arcId, 13)).event_id).toBe(ev);
    let map = await roadmap(show);
    const s12 = allSlots(map).find((s) => s.slot_number === 12);
    const s13 = allSlots(map).find((s) => s.slot_number === 13);
    expect(s12.two_part).toEqual(expect.objectContaining({ part: 1, of: 2, other_slot_number: 13, label: 'E12 · Part 1/2' }));
    expect(s13.two_part).toEqual(expect.objectContaining({ part: 2, label: 'E13 · Part 2/2' }));
    expect(s13.state).toBe('event_ready');
    expect(map.two_parters[0]).toEqual(expect.objectContaining({ can_start_part_two: false, can_undo: true }));

    // Part 2 takes Part 1's event: it cannot be given another.
    const other = await addEvent(show, 'Other');
    const refused = await pencil(show, arcId, 13, other);
    expect(refused.status).toBe(409);
    expect(refused.body.code).toBe('SEASON_SLOT_TWO_PART');
    // Part 2 cannot start before Part 1.
    const early = await auth(request(app).post(`/api/v1/world/${show}/season/two-parters/${made.body.data.id}/part-two`));
    expect(early.status).toBe(409);

    // Start Episode on the event starts Part 1, in E12.
    const one = await startEpisode(show, ev);
    expect(one.status).toBe(201);
    const partOne = one.body.data.episode.id;
    expect((await slot(arcId, 12)).episode_id).toBe(partOne);
    expect((await slot(arcId, 13)).episode_id).toBeNull();
    map = await roadmap(show);
    expect(map.two_parters[0].can_start_part_two).toBe(true);

    const two = await auth(request(app).post(`/api/v1/world/${show}/season/two-parters/${made.body.data.id}/part-two`));
    expect(two.status).toBe(201);
    const partTwo = two.body.data.episode.id;
    expect(two.body.data.episode.title).toBe('The Finale Gala (Part 2)');
    expect((await slot(arcId, 13)).episode_id).toBe(partTwo);
    const [brief] = await rows('SELECT event_id FROM episode_briefs WHERE episode_id = :partTwo AND deleted_at IS NULL', { partTwo });
    expect(brief.event_id).toBe(ev);
    const [evRow] = await rows('SELECT used_in_episode_id FROM world_events WHERE id = :ev', { ev });
    expect(evRow.used_in_episode_id).toBe(partOne);
    const contexts = await rows('SELECT id, season_context FROM episodes WHERE id IN (:ids)', { ids: [partOne, partTwo] });
    const ctx = Object.fromEntries(contexts.map((r) => [r.id, r.season_context]));
    expect(ctx[partOne].label).toBe('S1 · E12 · Part 1/2');
    expect(ctx[partTwo].label).toBe('S1 · E13 · Part 2/2');
    expect(ctx[partTwo].two_part).toEqual({ part: 2, of: 2, other_slot_number: 12 });
    expect(map.two_parters[0].can_undo).toBe(true);

    // The goal coverage counts the event once.
    const cov = (await auth(request(app).get(`/api/v1/world/${show}/season/goal-coverage`))).body;
    expect(cov.slots.filter((s) => s.event_id === ev).length).toBeLessThanOrEqual(1);

    // Part 1 alone: to be continued.
    const p1 = await auth(request(app).post(`/api/v1/world/${show}/episodes/${partOne}/complete`));
    expect(p1.status).toBe(409);
    expect(p1.body.code).toBe('TWO_PART_TO_BE_CONTINUED');
    expect(p1.body.error).toMatch(/Part 1 of a two-parter: to be continued/);
    const [stillOpen] = await rows('SELECT evaluation_status FROM episodes WHERE id = :partOne', { partOne });
    expect(stillOpen.evaluation_status).not.toBe('accepted');

    // Part 2 completes the event: one completion, on Part 1; both done.
    const p2 = await auth(request(app).post(`/api/v1/world/${show}/episodes/${partTwo}/complete`));
    expect(p2.status).toBe(200);
    expect(p2.body.data.two_part).toEqual(expect.objectContaining({ completed: true, part_one_episode_id: partOne, part_two_episode_id: partTwo }));
    const done = await rows('SELECT id, evaluation_status, evaluation_json FROM episodes WHERE id IN (:ids)', { ids: [partOne, partTwo] });
    expect(done.every((r) => r.evaluation_status === 'accepted')).toBe(true);
    const evalTwo = done.find((r) => r.id === partTwo).evaluation_json;
    expect(evalTwo.two_part).toEqual(expect.objectContaining({ part: 2, completed_with_episode_id: partOne }));
    const history = await rows('SELECT episode_id FROM character_state_history WHERE show_id = :show', { show });
    // Every history row is Part 1's (the one completion); none is Part 2's.
    expect(history.length).toBeGreaterThan(0);
    expect(history.every((h) => h.episode_id === partOne)).toBe(true);
    const ledger = await rows('SELECT DISTINCT episode_id FROM financial_transactions WHERE show_id = :show AND episode_id IS NOT NULL', { show });
    expect(ledger.map((r) => r.episode_id).filter((id) => id === partTwo)).toEqual([]);
    const [a, b] = [await slot(arcId, 12), await slot(arcId, 13)];
    expect(a.actual_outcome).toBeTruthy();
    expect(b.actual_outcome).toBe(a.actual_outcome);
    expect(b.accepted_at).not.toBeNull();
    map = await roadmap(show);
    expect(['done', 'done']).toEqual([12, 13].map((n) => allSlots(map).find((s) => s.slot_number === n).state));

    // Completing it again changes nothing.
    const again = await completeEpisode(partTwo, show, sequelize);
    expect(again.already_completed).toBe(true);
    expect((await rows('SELECT episode_id FROM character_state_history WHERE show_id = :show', { show }))).toHaveLength(history.length);
  });

  test('a two-parter is undone while Part 2 has no episode; Part 2\'s slot is open again', async () => {
    const { show, arcId } = await seedSeason();
    const ev = await addEvent(show, 'Big Night');
    await pencil(show, arcId, 4, ev);
    const blocker = await addEvent(show, 'Already there');
    await pencil(show, arcId, 9, blocker);
    await pencil(show, arcId, 8, await addEvent(show, 'Next week'));
    const refusedNext = await auth(request(app).post(`/api/v1/world/${show}/season/two-parters`)).send({ slot_id: await slotId(arcId, 8) });
    expect(refusedNext.status).toBe(409);
    expect(refusedNext.body.error).toMatch(/E9 has "Already there" pencilled/);

    const made = await auth(request(app).post(`/api/v1/world/${show}/season/two-parters`)).send({ slot_id: await slotId(arcId, 4) });
    expect(made.status).toBe(201);
    const undo = await auth(request(app).delete(`/api/v1/world/${show}/season/two-parters/${made.body.data.id}`));
    expect(undo.status).toBe(200);
    expect((await slot(arcId, 5)).event_id).toBeNull();
    expect((await slot(arcId, 4)).event_id).toBe(ev);
    const map = await roadmap(show);
    expect(map.two_parters).toEqual([]);
    expect(allSlots(map).find((s) => s.slot_number === 4).two_part).toBeNull();
  });

  test('every route needs sign-in', async () => {
    const { show } = await seedSeason();
    expect((await request(app).post(`/api/v1/world/${show}/season/specials`).send({ kind: 'bonus' })).status).toBe(401);
    expect((await request(app).post(`/api/v1/world/${show}/season/two-parters`).send({})).status).toBe(401);
    expect((await request(app).delete(`/api/v1/world/${show}/season/specials/${uuid()}`)).status).toBe(401);
  });
});
