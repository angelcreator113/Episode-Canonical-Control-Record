/**
 * A2 release position on the migrated database (K15, Stage B; and the
 * identity rule of docs/design/2026-11-season-planning.md §4.1: "With every
 * position NULL, the dates are identical to today's"). Authorized by Evoni on
 * 2026-11-10.
 *
 * Here season_slots is the real table, built by the whole migration chain
 * (the Tests job migrates before it runs). The migration's own up, down and
 * up again run in seasonReleasePositionMigration.integration.test.js, on a
 * scratch database, so this file never takes the column away from the
 * suites running beside it.
 *
 * Nothing in the application writes release_position yet. Where a test needs
 * one it writes the column directly, as the future Move/Swap will inside its
 * own transaction.
 */
jest.unmock('uuid');

const crypto = require('crypto');
const models = require('../../src/models');
const rs = require('../../src/services/releaseSchedule');

const { sequelize } = models;

const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const uuid = () => crypto.randomUUID();
const run = (sql, replacements = {}, options = {}) => sequelize.query(sql, { replacements, ...options });
const rows = async (sql, replacements = {}) => (await sequelize.query(sql, { replacements }))[0];

const NOW = new Date('2026-10-25T12:00:00Z');
const SCHEDULE = {
  day: 'sun', time: '10:00', cadence: 'weekly', first_release: '2026-11-01', paused: false, platforms: ['youtube'],
  tz_offset: 240, tz: 'America/New_York', seasons: { 2: { first_release: '2027-03-01' } }, updated_at: '2026-10-25T00:00:00.000Z',
};

(shouldSkip ? describe.skip : describe)('A2: release positions on the migrated season_slots', () => {
  jest.setTimeout(60000);
  const shows = [];

  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => jest.restoreAllMocks());
  afterAll(async () => {
    for (const show of shows) {
      await run('DELETE FROM season_slots WHERE show_id = :show', { show });
      await run('DELETE FROM show_arcs WHERE show_id = :show', { show });
      await run('DELETE FROM episodes WHERE show_id = :show', { show });
      await run('DELETE FROM shows WHERE id = :show', { show });
    }
  });

  /**
   * A show on a weekly Sunday schedule. Season 1: 24 slots; episodes 1-5 in
   * slots 1-5 (episode 3's date set by hand, slot 1 started, slot 6
   * pencilled), and episode 7 in no slot, remembering slot 7 in its
   * season_context. Season 2 (active): 3 slots, episode 8 in slot 1.
   */
  async function seed() {
    const show = uuid();
    shows.push(show);
    await run(`INSERT INTO shows (id, name, slug, distribution_defaults, created_at, updated_at)
               VALUES (:show, :name, :slug, CAST(:defaults AS jsonb), NOW(), NOW())`,
      { show, name: `A2 ${show.slice(0, 8)}`, slug: `a2-${show.slice(0, 8)}`, defaults: JSON.stringify({ release_schedule: SCHEDULE }) });
    const arcs = {};
    for (const [n, status] of [[1, 'completed'], [2, 'active']]) {
      arcs[n] = uuid();
      await run(`INSERT INTO show_arcs (id, show_id, arc_number, title, season_number, episode_start, episode_end,
                   phases, current_phase, status, narrative_debt, progression_log, emotional_temperature, created_at, updated_at)
                 VALUES (:id, :show, :n, :title, :n, 1, 24, '[]', 1, :status, '[]', '[]', 'rising', NOW() + (:n || ' seconds')::interval, NOW())`,
        { id: arcs[n], show, n, title: `Season ${n}`, status });
    }
    const eps = {};
    const episode = async (n, { air = null, context = null, season = 1 } = {}) => {
      eps[n] = uuid();
      await run(`INSERT INTO episodes (id, show_id, title, episode_number, status, air_date, season_number, season_context, created_at, updated_at)
                 VALUES (:id, :show, :title, :n, 'draft', ${air ? "(CAST(:air AS date)::timestamp AT TIME ZONE 'UTC')" : 'NULL'}, :season,
                         CAST(:context AS jsonb), NOW(), NOW())`,
        { id: eps[n], show, title: `Episode ${n}`, n, air, season, context: context ? JSON.stringify(context) : null });
    };
    for (const n of [1, 2, 4, 5]) await episode(n);
    await episode(3, { air: '2026-11-22' });
    await episode(7, { context: { season_number: 1, slot_number: 7 } });
    await episode(8, { season: 2 });
    const event = uuid();
    for (let n = 1; n <= 24; n += 1) {
      await run(`INSERT INTO season_slots (id, show_id, arc_id, season_number, slot_number, phase, episode_id, event_id, locked_at, created_at, updated_at)
                 VALUES (gen_random_uuid(), :show, :arc, 1, :n, :phase, :episode, :event, ${n === 1 ? 'NOW()' : 'NULL'}, NOW(), NOW())`,
        { show, arc: arcs[1], n, phase: Math.ceil(n / 8), episode: n <= 5 ? eps[n] : null, event: n === 6 ? event : null });
    }
    for (let n = 1; n <= 3; n += 1) {
      await run(`INSERT INTO season_slots (id, show_id, arc_id, season_number, slot_number, phase, episode_id, created_at, updated_at)
                 VALUES (gen_random_uuid(), :show, :arc, 2, :n, 1, :episode, NOW(), NOW())`,
        { show, arc: arcs[2], n, episode: n === 1 ? eps[8] : null });
    }
    return { show, arcs, eps, event };
  }
  /** The release view at a fixed time. The schedule's updated_at is stamped on every read, so it is left out of comparisons. */
  const view = async (show) => {
    const v = await rs.viewFor(sequelize, show, { now: NOW });
    return { ...v, schedule: { ...v.schedule, updated_at: null } };
  };
  /** Everything about the slots except release_position (and updated_at). */
  const slotRows = (show) => rows(
    `SELECT id, arc_id, season_number, slot_number, phase, event_id, episode_id, story_purpose, story_purposes, career_focus, desired_pressure,
            story_thread_id, outcome_range, intention_source, actual_outcome, actual_pressure, accepted_at, locked_at, deleted_at
       FROM season_slots WHERE show_id = :show ORDER BY season_number, slot_number`, { show });
  /** Slots a and b of a season trade release positions, in one transaction (stored NULL when it is the slot's own number). */
  const trade = (arc, a, b) => sequelize.transaction(async (transaction) => {
    const [[x], [y]] = await Promise.all([a, b].map((n) => sequelize.query(
      'SELECT id, slot_number, COALESCE(release_position, slot_number) AS position FROM season_slots WHERE arc_id = :arc AND slot_number = :n AND deleted_at IS NULL',
      { replacements: { arc, n }, transaction, type: sequelize.QueryTypes.SELECT })));
    await run('UPDATE season_slots SET release_position = NULLIF(CAST(:p AS int), slot_number) WHERE id = :id', { p: y.position, id: x.id }, { transaction });
    await run('UPDATE season_slots SET release_position = NULLIF(CAST(:p AS int), slot_number) WHERE id = :id', { p: x.position, id: y.id }, { transaction });
  });
  const byEpisode = (v) => Object.fromEntries(v.episodes.map((e) => [e.episode_id, e]));

  it('K15: the migrated season_slots has the nullable column and the three rules, beside season_slots_arc_slot_live', async () => {
    const [column] = await rows(
      `SELECT data_type, is_nullable, column_default FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'season_slots' AND column_name = 'release_position'`);
    expect(column).toEqual({ data_type: 'integer', is_nullable: 'YES', column_default: null });

    const found = Object.fromEntries((await rows(
      `SELECT conname, pg_get_constraintdef(oid) AS def, condeferrable, condeferred, convalidated
         FROM pg_constraint WHERE conrelid = 'public.season_slots'::regclass AND contype IN ('c', 'x')`)).map((r) => [r.conname, r]));
    expect(Object.keys(found).sort()).toEqual(['season_slots_effective_position_live', 'season_slots_episode_live', 'season_slots_release_position_range']);
    expect(found.season_slots_release_position_range.def)
      .toBe('CHECK (((release_position IS NULL) OR ((release_position >= 1) AND (release_position <= 24))))');
    expect(found.season_slots_release_position_range.convalidated).toBe(true);
    expect(found.season_slots_effective_position_live).toMatchObject({
      def: 'EXCLUDE USING btree (arc_id WITH =, COALESCE(release_position, slot_number) WITH =) WHERE ((deleted_at IS NULL)) DEFERRABLE INITIALLY DEFERRED',
      condeferrable: true, condeferred: true,
    });
    expect(found.season_slots_episode_live).toMatchObject({
      def: 'EXCLUDE USING btree (episode_id WITH =) WHERE (((deleted_at IS NULL) AND (episode_id IS NOT NULL))) DEFERRABLE INITIALLY DEFERRED',
      condeferrable: true, condeferred: true,
    });

    const [live] = await rows("SELECT indexdef FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'season_slots_arc_slot_live'");
    expect(live.indexdef).toMatch(/UNIQUE INDEX season_slots_arc_slot_live ON public\.season_slots USING btree \(arc_id, slot_number\) WHERE \(deleted_at IS NULL\)/);
    expect(await rows("SELECT name FROM \"SequelizeMeta\" WHERE name = '20261110230000-add-season-slot-release-position.js'")).toHaveLength(1);
  });

  it('the SeasonSlot model reads the column; a new slot has no release position', async () => {
    const { show } = await seed();
    expect(models.SeasonSlot.rawAttributes.release_position).toMatchObject({ allowNull: true });
    const slot = await models.SeasonSlot.findOne({ where: { show_id: show, season_number: 1, slot_number: 4 } });
    expect(slot.release_position).toBeNull();
    expect(slot.slot_number).toBe(4);
    expect((await rows('SELECT COUNT(release_position)::int AS n FROM season_slots WHERE show_id = :show', { show }))[0].n).toBe(0);
  });

  it('identity: with every release position NULL the dates are what the schedule always gave', async () => {
    const { show, eps, arcs } = await seed();
    const v = await view(show);
    const row = byEpisode(v);
    // Season 1, Sundays from 2026-11-01; episode 3 is hand-set a week late and the rest follow it.
    expect(row[eps[1]]).toMatchObject({ season_number: 1, number: 1, date: '2026-11-01', time: '10:00', source: 'schedule' });
    expect(row[eps[2]]).toMatchObject({ season_number: 1, number: 2, date: '2026-11-08', source: 'schedule' });
    expect(row[eps[3]]).toMatchObject({ season_number: 1, number: 3, date: '2026-11-22', source: 'hand' });
    expect(row[eps[4]]).toMatchObject({ season_number: 1, number: 4, date: '2026-11-29', source: 'schedule' });
    expect(row[eps[5]]).toMatchObject({ season_number: 1, number: 5, date: '2026-12-06', source: 'schedule' });
    // In no slot: its stored slot number (season_context), as before.
    expect(row[eps[7]]).toMatchObject({ season_number: 1, number: 7, date: '2026-12-20', source: 'schedule' });
    expect(row[eps[8]]).toMatchObject({ season_number: 2, number: 1, date: '2027-03-07', source: 'schedule' });
    const one = v.seasons.find((x) => x.season_number === 1);
    expect(one.arc_id).toBe(arcs[1]);
    expect(Object.keys(one.slots).map(Number)).toEqual(Array.from({ length: 24 }, (_, i) => i + 1));
    expect(one.slots[6]).toEqual({ date: '2026-12-13', time: '10:00', source: 'schedule', episode_id: null });
    expect(one.slots[24].date).toBe('2027-04-18');
    // The inputs carry no positions at all.
    const input = await rs.loadInputs(sequelize, show);
    expect(input.seasons.some((x) => 'positions' in x)).toBe(false);
    expect(input.episodes.find((e) => e.id === eps[7])).toMatchObject({ season_number: 1, slot_number: 7 });
  });

  it('identity: each slot at its own number, or positions set and cleared again, gives the identical view', async () => {
    const { show, arcs } = await seed();
    const base = await view(show);
    const slotsBefore = await slotRows(show);

    // Every slot's position written as its own number: the same release order, so the same view.
    await run('UPDATE season_slots SET release_position = slot_number WHERE show_id = :show', { show });
    expect(await view(show)).toEqual(base);
    await run('UPDATE season_slots SET release_position = NULL WHERE show_id = :show', { show });

    await trade(arcs[1], 2, 5);
    expect(await view(show)).not.toEqual(base);
    await trade(arcs[1], 2, 5);
    expect((await rows('SELECT COUNT(release_position)::int AS n FROM season_slots WHERE show_id = :show', { show }))[0].n).toBe(0);
    expect(await view(show)).toEqual(base);
    expect(await slotRows(show)).toEqual(slotsBefore);
  });

  it('two slots that trade release positions trade dates; slot numbers, occupants, pencils, locks and labels do not move', async () => {
    const { show, arcs, eps, event } = await seed();
    const base = await view(show);
    const slotsBefore = await slotRows(show);
    const contextBefore = await rows('SELECT id, season_context, air_date, episode_number FROM episodes WHERE show_id = :show ORDER BY episode_number', { show });

    await trade(arcs[1], 2, 5);
    expect(await rows('SELECT slot_number, release_position FROM season_slots WHERE show_id = :show AND release_position IS NOT NULL ORDER BY slot_number', { show }))
      .toEqual([{ slot_number: 2, release_position: 5 }, { slot_number: 5, release_position: 2 }]);

    const v = await view(show);
    const row = byEpisode(v);
    const was = byEpisode(base);
    // The two episodes trade dates and keep their story numbers; neither became hand-set.
    expect(row[eps[2]]).toMatchObject({ number: 2, date: was[eps[5]].date, source: 'schedule' });
    expect(row[eps[5]]).toMatchObject({ number: 5, date: was[eps[2]].date, source: 'schedule' });
    // Everyone else is exactly as before, the unslotted episode included.
    for (const n of [1, 3, 4, 7, 8]) expect(row[eps[n]]).toEqual(was[eps[n]]);
    // Slot-keyed dates: slots 2 and 5 trade; every other slot, and the other season, is unchanged.
    const one = (x) => x.seasons.find((s) => s.season_number === 1).slots;
    expect(one(v)[2]).toEqual({ ...one(base)[5], episode_id: eps[2] });
    expect(one(v)[5]).toEqual({ ...one(base)[2], episode_id: eps[5] });
    for (let n = 1; n <= 24; n += 1) if (n !== 2 && n !== 5) expect(one(v)[n]).toEqual(one(base)[n]);
    expect(v.seasons.find((s) => s.season_number === 2)).toEqual(base.seasons.find((s) => s.season_number === 2));
    expect(Object.values(one(v)).map((s) => s.date).sort()).toEqual(Object.values(one(base)).map((s) => s.date).sort());

    // Nothing but release_position changed on any slot, and no episode was written.
    expect(await slotRows(show)).toEqual(slotsBefore);
    expect((await slotRows(show)).find((s) => s.slot_number === 6 && s.season_number === 1).event_id).toBe(event);
    expect(await rows('SELECT id, season_context, air_date, episode_number FROM episodes WHERE show_id = :show ORDER BY episode_number', { show }))
      .toEqual(contextBefore);
  });

  it('the rules refuse a broken release order on the real table, at COMMIT, and the dates stay as they were', async () => {
    const { show, arcs, eps } = await seed();
    const base = await view(show);
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    const codeOf = async (fn) => {
      try { await fn(); return null; } catch (err) { return err?.original?.code || err?.parent?.code || err?.code || 'no-code'; }
    };
    // Out of range: refused by the statement.
    expect(await codeOf(() => run('UPDATE season_slots SET release_position = 25 WHERE arc_id = :arc AND slot_number = 2', { arc: arcs[1] }))).toBe('23514');
    // A raw position that repeats slot 5's: the statement succeeds, the COMMIT is refused.
    expect(await codeOf(() => sequelize.transaction(async (transaction) => {
      await run('UPDATE season_slots SET release_position = 5 WHERE arc_id = :arc AND slot_number = 2', { arc: arcs[1] }, { transaction });
    }))).toBe('23P01');
    // One episode in two live slots: refused at COMMIT.
    expect(await codeOf(() => sequelize.transaction(async (transaction) => {
      await run('UPDATE season_slots SET episode_id = :episode WHERE arc_id = :arc AND slot_number = 9', { arc: arcs[1], episode: eps[2] }, { transaction });
    }))).toBe('23P01');
    expect(await view(show)).toEqual(base);
  });
});
