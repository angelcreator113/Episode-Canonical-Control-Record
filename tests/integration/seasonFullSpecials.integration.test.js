/**
 * Automatic specials when the season is full (Evoni, 2026-10-26: "So I want
 * to be sure that if I start creating any events that is over the 24
 * episodes, they will be known as the special episodes automatically?" …
 * "Yes placed events should be seen as full, they should have both options,
 * no limit"; services/seasonFullSpecials). A season whose 24 weekly slots
 * all have an event pencilled (one started, one two-parter):
 *   - before the specials' migration: today's behaviour, said plainly;
 *   - a new event "will be a special": Make it a special puts it in story
 *     order (after E4, midweek between E4 and E5), or Swap it into E5 makes
 *     E5's event the special at its own story position, and Swap back undoes it;
 *   - a started slot and a two-parter's slot refuse the swap, in plain words;
 *   - an event with no date goes after the part in progress, then moves to
 *     its story position once it has a date;
 *   - Start Episode on a full season makes the special, never an episode
 *     outside the season; its episode can still swap in or move to Season 2;
 *   - a released Sunday is passed for the first gap still to come.
 * On the test database, through the routes.
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
const { ensureSeasonSlots } = require('../../src/services/seasonSlotService');

const { sequelize } = models;

const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const uuid = () => crypto.randomUUID();
const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });
const rows = async (sql, replacements = {}) => (await sequelize.query(sql, { replacements }))[0];
const SCHEDULE = { day: 'sun', time: '10:00', cadence: 'weekly', first_release: '2030-11-03', paused: false, platforms: ['youtube'], tz: 'America/New_York' };
// E_n's event is in-world on 2026-03-01 + 7(n−1): E4 Mar 22, E5 Mar 29, E6 Apr 5.
const storyDay = (n) => new Date(Date.UTC(2026, 2, 1 + 7 * (n - 1))).toISOString().slice(0, 10);
const addDays = (iso, n) => new Date(Date.parse(`${iso}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10);

(shouldSkip ? describe.skip : describe)('A full season: new events become specials (2026-10-26)', () => {
  const shows = [];
  let token;
  const auth = (r) => r.set('Authorization', `Bearer ${token}`);

  async function addEvent(show, name, date = null) {
    const id = uuid();
    await run(`INSERT INTO world_events (id, show_id, name, event_type, status, prestige, strictness, cost_coins, event_date, canon_consequences, created_at, updated_at)
               VALUES (:id, :show, :name, 'invite', 'draft', 5, 5, 0, :date, '{}'::jsonb, NOW(), NOW())`, { id, show, name, date });
    return id;
  }
  const slotId = async (arcId, n) => (await rows('SELECT id FROM season_slots WHERE arc_id = :arcId AND slot_number = :n', { arcId, n }))[0].id;
  const slot = async (arcId, n) => (await rows('SELECT event_id, episode_id, locked_at FROM season_slots WHERE arc_id = :arcId AND slot_number = :n', { arcId, n }))[0];
  const live = async (arcId) => rows(
    `SELECT id, kind, after_slot_number, event_id, episode_id, title, to_char(release_date, 'YYYY-MM-DD') AS release_date, release_time
       FROM season_specials WHERE arc_id = :arcId AND deleted_at IS NULL AND kind = 'bonus' ORDER BY created_at`, { arcId });
  const choice = async (show, ev) => (await auth(request(app).get(`/api/v1/world/${show}/season/full/events/${ev}`))).body;
  const make = (show, ev) => auth(request(app).post(`/api/v1/world/${show}/season/full/events/${ev}/special`)).send({});
  const swap = (show, ev, slot_id) => auth(request(app).post(`/api/v1/world/${show}/season/full/events/${ev}/swap`)).send({ slot_id });
  const roadmap = async (show) => (await auth(request(app).get(`/api/v1/world/${show}/season/roadmap`))).body.roadmap;
  const startEpisode = (show, eventId) => auth(request(app).post(`/api/v1/world/${show}/events/${eventId}/generate-episode`)).send({ draft_script: false });
  const context = async (show, ev) => (await auth(request(app).get(`/api/v1/world/${show}/season/event/${ev}`))).body.context;

  /**
   * A show whose season is full: 24 events pencilled, E_n's dated storyDay(n);
   * E10–E11 a two-parter (after the migration) and E2 started when asked.
   */
  async function fullSeason({ twoParter = true, startE2 = false, schedule = SCHEDULE } = {}) {
    const show = uuid();
    shows.push(show);
    await run(`INSERT INTO shows (id, name, slug, metadata, created_at, updated_at)
               VALUES (:show, :name, :slug, CAST('{"starting_balance": 1000}' AS jsonb), NOW(), NOW())`,
      { show, name: `Full ${show.slice(0, 8)}`, slug: `full-${show.slice(0, 8)}` });
    await run(`INSERT INTO character_state (id, show_id, character_key, coins, reputation, brand_trust, influence, stress, created_at, updated_at)
               VALUES (:id, :show, 'lala', 1000, 3, 3, 3, 2, NOW(), NOW())`, { id: uuid(), show });
    const { arc_id: arcId } = await seedArc(show, models);
    const events = {};
    for (let n = 1; n <= 24; n += 1) {
      if (twoParter && n === 11) continue;
      events[n] = await addEvent(show, `Week ${n} event`, storyDay(n));
      await run('UPDATE season_slots SET event_id = :ev WHERE arc_id = :arcId AND slot_number = :n', { ev: events[n], arcId, n });
    }
    if (twoParter) {
      const two = await auth(request(app).post(`/api/v1/world/${show}/season/two-parters`)).send({ slot_id: await slotId(arcId, 10) });
      expect(two.status).toBe(201);
      events[11] = events[10];
    }
    if (schedule) await auth(request(app).put(`/api/v1/world/${show}/release-schedule`)).send({ release_schedule: schedule });
    if (startE2) expect((await startEpisode(show, events[2])).status).toBe(201);
    return { show, arcId, events };
  }

  beforeAll(async () => {
    await slotsMigration.up(sequelize.getQueryInterface(), Sequelize);
    // The first test reads the app before the specials' migration has run.
    await specialsMigration.down(sequelize.getQueryInterface(), Sequelize);
    token = TokenService.generateTokenPair({
      id: 'test-user-full-specials', email: 'user@full-specials.dev', name: 'Editor', groups: ['USER', 'EDITOR'], role: 'USER',
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

  test('before the migration: full is known, nothing is written, Start Episode keeps today\'s behaviour, and it says why', async () => {
    const { show, arcId } = await fullSeason({ twoParter: false });
    const ev = await addEvent(show, 'Over the 24', '2026-03-27');
    const map = await roadmap(show);
    expect(map.season_full).toBe(true);
    expect(map.specials_ready).toBe(false);

    const c = await choice(show, ev);
    expect(c.data.full).toBe(true);
    expect(c.data.ready).toBe(false);
    expect(c.data.needs_migration).toBe(true);
    expect(c.data.message).toMatch(/need their migration first/);
    const ctx = await context(show, ev);
    expect(ctx).toMatchObject({ in_slot: false, in_special: false, season_full: true, specials_ready: false, next_open: null });

    const refused = await make(show, ev);
    expect(refused.status).toBe(409);
    expect(refused.body.code).toBe('SEASON_SPECIALS_MIGRATION_PENDING');

    const started = await startEpisode(show, ev);
    expect(started.status).toBe(201);
    const after = await roadmap(show);
    expect(after.unslotted_episodes.map((e) => e.id)).toContain(started.body.data.episode.id);
    for (let n = 1; n <= 24; n += 1) expect((await slot(arcId, n)).episode_id).toBeNull();

    await specialsMigration.up(sequelize.getQueryInterface(), Sequelize);
  });

  test('a new event on a full season: both options, story order between E4 and E5, a started slot and a two-parter refuse the swap', async () => {
    const { show, arcId, events } = await fullSeason({ startE2: true });
    const ev = await addEvent(show, 'Midnight Gala', '2026-03-27');
    const map = await roadmap(show);
    expect(map.season_full).toBe(true);

    const { data } = await choice(show, ev);
    expect(data).toMatchObject({ ready: true, full: true, where: 'none', open_slots: 0 });
    expect(data.special_place).toMatchObject({ after: 4, label: 'Special · after E4', by: 'date' });
    // Midweek between E4's Sunday (2030-11-24) and E5's (2030-12-01).
    expect(data.special_place.release).toMatchObject({ date: '2030-11-27', time: '10:00' });
    expect(data.start_note).toMatch(/Start Episode makes it Special · after E4/);
    const e5 = data.swap.options.find((o) => o.slot_number === 5);
    expect(data.swap.suggested_slot_id).toBe(e5.slot_id);
    expect(e5).toMatchObject({ can_swap: true, becomes: { after: 5, label: 'Special · after E5' } });
    expect(data.swap.options.find((o) => o.slot_number === 2)).toMatchObject({ can_swap: false, reason: 'E2 has started: it is locked to its episode.' });
    expect(data.swap.options.find((o) => o.slot_number === 11).reason).toMatch(/E11 is Part 2 of a two-parter: a swap would split it/);
    expect(data.next_season).toBeNull();

    const twoPart = await swap(show, ev, await slotId(arcId, 10));
    expect(twoPart.status).toBe(409);
    expect(twoPart.body.error).toMatch(/E10 is Part 1 of a two-parter/);
    const started = await swap(show, ev, await slotId(arcId, 2));
    expect(started.status).toBe(409);
    expect(started.body.error).toMatch(/E2 has started/);

    const made = await make(show, ev);
    expect(made.status).toBe(201);
    expect(made.body.data).toMatchObject({ label: 'Special · after E4', after_slot_number: 4 });
    const [sp] = await live(arcId);
    expect(sp).toMatchObject({ after_slot_number: 4, event_id: ev, title: 'Midnight Gala', release_date: '2030-11-27', release_time: '10:00' });
    const again = await make(show, ev);
    expect(again.status).toBe(409);
    expect((await context(show, ev))).toMatchObject({ in_special: true, special: { label: 'Special · after E4', started: false } });
    // No limit: a second event between the same weeks is a second special.
    const ev2 = await addEvent(show, 'After-party', '2026-03-28');
    expect((await make(show, ev2)).status).toBe(201);
    expect((await live(arcId)).map((s) => s.after_slot_number)).toEqual([4, 4]);
    // The weekly slots are untouched.
    expect((await slot(arcId, 5)).event_id).toBe(events[5]);
  });

  test('Swap it into E5: E5\'s event becomes a special at its own story position, and Swap back undoes it', async () => {
    const { show, arcId, events } = await fullSeason();
    const ev = await addEvent(show, 'Rooftop Launch', '2026-03-27');
    const e5 = await slotId(arcId, 5);
    const res = await swap(show, ev, e5);
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ slot_number: 5, replaced: { id: events[5], name: 'Week 5 event', special: { label: 'Special · after E5', after_slot_number: 5 } } });
    expect((await slot(arcId, 5)).event_id).toBe(ev);
    let specials = await live(arcId);
    expect(specials).toHaveLength(1);
    expect(specials[0]).toMatchObject({ event_id: events[5], after_slot_number: 5, release_date: '2030-12-04' });
    const rowId = specials[0].id;

    const back = await swap(show, events[5], e5);
    expect(back.status).toBe(200);
    expect(back.body.data.replaced).toMatchObject({ id: ev, special: { label: 'Special · after E4' } });
    expect((await slot(arcId, 5)).event_id).toBe(events[5]);
    specials = await live(arcId);
    // The same row, now the new event's: nothing was deleted.
    expect(specials).toEqual([expect.objectContaining({ id: rowId, event_id: ev, after_slot_number: 4, title: 'Rooftop Launch' })]);
    const all = await rows('SELECT COUNT(*)::int AS n FROM season_specials WHERE arc_id = :arcId AND kind = \'bonus\'', { arcId });
    expect(all[0].n).toBe(1);
  });

  test('no date yet: after the part in progress, then to its story position once it has a date; Remove leaves it unplaced', async () => {
    const { show, arcId } = await fullSeason({ twoParter: false });
    const ev = await addEvent(show, 'Someday Soirée', null);
    const { data } = await choice(show, ev);
    expect(data.special_place).toMatchObject({ after: 8, by: 'no_date', label: 'Special · after E8' });
    expect(data.swap.suggested_slot_id).toBe(data.swap.options.find((o) => o.can_swap).slot_id);
    expect((await make(show, ev)).status).toBe(201);
    const [sp] = await live(arcId);
    expect(sp.after_slot_number).toBe(8);

    await run('UPDATE world_events SET event_date = :d WHERE id = :ev', { d: '2026-03-27', ev });
    const later = (await choice(show, ev)).data;
    expect(later).toMatchObject({ where: 'special', at_story_position: false, special_place: { after: 4 } });
    const moved = await auth(request(app).post(`/api/v1/world/${show}/season/specials/${sp.id}/story-position`)).send({});
    expect(moved.status).toBe(200);
    expect(moved.body.data).toMatchObject({ label: 'Special · after E4', after_slot_number: 4 });
    expect((await live(arcId))[0]).toMatchObject({ after_slot_number: 4, release_date: '2030-11-27' });
    expect((await choice(show, ev)).data.at_story_position).toBe(true);

    const removed = await auth(request(app).delete(`/api/v1/world/${show}/season/specials/${sp.id}`));
    expect(removed.status).toBe(200);
    expect((await choice(show, ev)).data.where).toBe('none');
    const [kept] = await rows('SELECT deleted_at FROM world_events WHERE id = :ev', { ev });
    expect(kept.deleted_at).toBeNull();
  });

  test('Start Episode on a full season makes the special; its episode can swap into a weekly slot or move to Season 2', async () => {
    const { show, arcId, events } = await fullSeason({ twoParter: false });
    const ev = await addEvent(show, 'Surprise Premiere', '2026-03-27');
    expect((await choice(show, ev)).data.start_note).toMatch(/Special · after E4/);
    const started = await startEpisode(show, ev);
    expect(started.status).toBe(201);
    const episodeId = started.body.data.episode.id;
    const [sp] = await live(arcId);
    expect(sp).toMatchObject({ event_id: ev, episode_id: episodeId, after_slot_number: 4, release_date: '2030-11-27' });
    const map = await roadmap(show);
    expect(map.unslotted_episodes.map((e) => e.id)).not.toContain(episodeId);
    expect(map.specials.find((s) => s.id === sp.id)).toMatchObject({ label: 'Special · after E4', state: 'in_production' });
    const [ep] = await rows("SELECT season_context->'special'->>'label' AS label, to_char(air_date AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS air FROM episodes WHERE id = :id", { id: episodeId });
    expect(ep).toEqual({ label: 'Special · after E4', air: '2030-11-27' });
    expect(await context(show, ev)).toMatchObject({ in_special: true, special: { started: true } });

    // Swap: the episode takes E7, and E7's event becomes the special.
    const c = (await choice(show, ev)).data;
    expect(c.where).toBe('special');
    const res = await swap(show, ev, await slotId(arcId, 7));
    expect(res.status).toBe(200);
    expect(await slot(arcId, 7)).toMatchObject({ event_id: ev, episode_id: episodeId });
    // E7's event (Apr 12) goes in story order: after E6 (Apr 5), the latest
    // event before it now that E7 holds the Mar 27 premiere.
    expect((await live(arcId))[0]).toMatchObject({ id: sp.id, event_id: events[7], episode_id: null, after_slot_number: 6 });
    const [moved] = await rows("SELECT season_context->>'label' AS label, air_date FROM episodes WHERE id = :id", { id: episodeId });
    expect(moved).toEqual({ label: 'S1 · E7', air_date: null });

    // Move to Season 2 instead: refused with no Season 2, then into its first open slot.
    const ev2 = await addEvent(show, 'Encore', '2026-04-20');
    const none = await auth(request(app).post(`/api/v1/world/${show}/season/full/events/${ev2}/next-season`)).send({});
    expect(none.status).toBe(409);
    expect(none.body.error).toMatch(/no next season yet/);
    const arc2 = uuid();
    await run(`INSERT INTO show_arcs (id, show_id, arc_number, title, season_number, episode_start, episode_end, phases, current_phase, status, created_at, updated_at)
               VALUES (:arc2, :show, 2, 'Season 2', 2, 1, 24, '[]'::jsonb, 1, 'planned', NOW(), NOW())`, { arc2, show });
    await ensureSeasonSlots(sequelize, { id: arc2, show_id: show, season_number: 2, phases: [] });
    expect((await choice(show, ev2)).data.next_season).toMatchObject({ season_number: 2, open_slot_number: 1 });
    expect((await make(show, ev2)).status).toBe(201);
    const next = await auth(request(app).post(`/api/v1/world/${show}/season/full/events/${ev2}/next-season`)).send({});
    expect(next.status).toBe(200);
    expect(next.body.data).toMatchObject({ season_number: 2, slot_number: 1, label: 'S2 · E1' });
    expect((await rows('SELECT event_id FROM season_slots WHERE arc_id = :arc2 AND slot_number = 1', { arc2 }))[0].event_id).toBe(ev2);
    expect((await live(arcId)).map((s) => s.event_id)).toEqual([events[7]]);
  });

  test('a started special\'s episode moves to Season 2 instead: into its first open slot, its special set aside', async () => {
    const { show, arcId } = await fullSeason({ twoParter: false });
    const ev = await addEvent(show, 'Late Arrival', '2026-03-27');
    const started = await startEpisode(show, ev);
    const episodeId = started.body.data.episode.id;
    const arc2 = uuid();
    await run(`INSERT INTO show_arcs (id, show_id, arc_number, title, season_number, episode_start, episode_end, phases, current_phase, status, created_at, updated_at)
               VALUES (:arc2, :show, 2, 'Season 2', 2, 1, 24, '[]'::jsonb, 1, 'planned', NOW(), NOW())`, { arc2, show });
    await ensureSeasonSlots(sequelize, { id: arc2, show_id: show, season_number: 2, phases: [] });
    const res = await auth(request(app).post(`/api/v1/world/${show}/season/full/events/${ev}/next-season`)).send({});
    expect(res.status).toBe(200);
    expect(res.body.data.label).toBe('S2 · E1');
    expect((await rows('SELECT event_id, episode_id FROM season_slots WHERE arc_id = :arc2 AND slot_number = 1', { arc2 }))[0]).toEqual({ event_id: ev, episode_id: episodeId });
    expect(await live(arcId)).toEqual([]);
    const [ep] = await rows("SELECT season_context->>'label' AS label, air_date FROM episodes WHERE id = :id", { id: episodeId });
    expect(ep).toEqual({ label: 'S2 · E1', air_date: null });
  });

  test('a released Sunday is passed: the special takes the first gap still to come', async () => {
    // The show releases on yesterday's weekday, from two weeks before
    // yesterday: E1–E3 are out, E4 is a week away (whatever day the test runs).
    const today = new Date().toISOString().slice(0, 10);
    const yesterday = addDays(today, -1);
    const day = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][new Date(`${yesterday}T00:00:00Z`).getUTCDay()];
    const firstRelease = addDays(yesterday, -14);
    const { show } = await fullSeason({ twoParter: false, schedule: { ...SCHEDULE, day, first_release: firstRelease } });
    const ev = await addEvent(show, 'Flashback Brunch', '2026-03-10'); // between E2 (Mar 8) and E3 (Mar 15)
    const { data } = await choice(show, ev);
    expect(data.special_place).toMatchObject({ after: 3, skipped_released: 1, label: 'Special · after E3' });
    expect(data.special_place.release.date).toBe(addDays(firstRelease, 14 + 3));
  });
});
