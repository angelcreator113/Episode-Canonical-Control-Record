/**
 * A1.3-0 (C4d): applyPlacement checks the season under its locks, so a
 * placement that changed after the preview is never silently overwritten.
 * On the test database, through the real services, each race holds the Save
 * just after its first lock (tests/helpers/lockTrace's gate), lets another
 * writer commit, then lets the Save go:
 *   P1  an event pencilled into the target slot since the preview: before,
 *       the Save replaced it (reproduced on d9a57ff6); now 409
 *       SEASON_SLOT_CHANGED, the newer pencil kept, the Save's event unplaced;
 *   P2  the same, with the other pencil holding the slot lock while the Save
 *       waits for it;
 *   P3  an episode placement into a slot that has had an event pencilled
 *       since: before, the episode overwrote it; now 409, both kept as they were;
 *   P4  the Save's event pencilled into another slot since the preview: 409,
 *       not moved out of it;
 *   P5  an explicitly reviewed replacement (expected_event_id) still
 *       replaces, for an event and for an episode; a different event than
 *       the one reviewed is refused;
 *   P6  one conflicting placement rolls the whole Save back: an episode
 *       placed earlier in the same request is not placed;
 *   P7  omitted and explicit null expected_event_id both mean "reviewed
 *       empty" (the only state the Season Planning preview offers): an event
 *       found there refuses the Save, so omission never bypasses the check.
 */
jest.unmock('uuid');

const { Sequelize } = require('sequelize');
const crypto = require('crypto');
const models = require('../../src/models');
const slotsMigration = require('../../src/migrations/20261001230000-create-season-slots');
const specialsMigration = require('../../src/migrations/20261026150000-create-season-specials');
const { seedArc } = require('../../src/services/arcProgressionService');
const slots = require('../../src/services/seasonSlotService');
const setup = require('../../src/services/seasonSetupService');
const lockTrace = require('../helpers/lockTrace');

const { sequelize } = models;
const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const uuid = () => crypto.randomUUID();
const run = (sql, replacements = {}) => sequelize.query(sql, { replacements });
const rows = async (sql, replacements = {}) => (await sequelize.query(sql, { replacements }))[0];
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function outcome(fn) {
  try {
    return { ok: true, value: await fn() };
  } catch (error) {
    return { ok: false, error, code: error?.code || null, status: error?.status || null };
  }
}

(shouldSkip ? describe.skip : describe)('A1.3-0 (C4d): apply placement never overwrites a placement that changed after the preview', () => {
  jest.setTimeout(60000);
  const shows = [];
  let trace = null;

  async function seedShow() {
    const show = uuid();
    shows.push(show);
    await run(`INSERT INTO shows (id, name, slug, created_at, updated_at) VALUES (:show, :n, :n, NOW(), NOW())`, { show, n: `stale-${show.slice(0, 8)}` });
    const { arc_id: arcId } = await seedArc(show, models);
    return { show, arcId };
  }
  async function addEvent(show, name) {
    const id = uuid();
    await run(`INSERT INTO world_events (id, show_id, name, event_type, status, canon_consequences, created_at, updated_at)
               VALUES (:id, :show, :name, 'invite', 'draft', '{}'::jsonb, NOW(), NOW())`, { id, show, name });
    return id;
  }
  async function addEpisode(show) {
    const id = uuid();
    await run(`INSERT INTO episodes (id, show_id, title, episode_number, status, created_at, updated_at)
               VALUES (:id, :show, 'Placed episode', 1, 'draft', NOW(), NOW())`, { id, show });
    await run(`INSERT INTO episode_briefs (id, episode_id, show_id, status, created_at, updated_at)
               VALUES (:bid, :id, :show, 'draft', NOW(), NOW())`, { bid: uuid(), id, show });
    return id;
  }
  const slotId = async (arcId, n) => (await rows('SELECT id FROM season_slots WHERE arc_id = :arcId AND slot_number = :n', { arcId, n }))[0].id;
  const slotRow = async (id) => (await rows('SELECT event_id, episode_id, locked_at FROM season_slots WHERE id = :id', { id }))[0];
  const placedIn = async (episodeId) => (await rows('SELECT id FROM season_slots WHERE episode_id = :episodeId AND deleted_at IS NULL', { episodeId })).map((r) => r.id);

  /** Runs save() until its first lock that gateOn picks, lets meanwhile() commit, then lets save() go. */
  async function raceWith(save, meanwhile, gateOn) {
    trace = lockTrace.install(sequelize);
    const g = trace.gate(gateOn);
    try {
      const s = outcome(save);
      await Promise.race([g.reached, s]);
      const m = await outcome(meanwhile);
      g.open();
      return [await s, m];
    } finally {
      g.open();
      trace.uninstall();
      trace = null;
    }
  }
  // The Save's last unlocked read of the slots before it locks them (before:
  // the preview check; now: the holder lookup, re-read under the locks).
  const atSlotRead = (r, text) => r.kind === 'other' && /^SELECT\b.*\bFROM season_slots\b/i.test(text);
  const atEpisodeLock = (r) => r.kind === 'lock' && r.table === 'episodes';

  beforeAll(async () => {
    await slotsMigration.up(sequelize.getQueryInterface(), Sequelize);
    if (!(await rows("SELECT to_regclass('public.season_specials') AS t"))[0].t) {
      await specialsMigration.up(sequelize.getQueryInterface(), Sequelize);
    }
  });
  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => {
    if (trace) trace.uninstall();
    jest.restoreAllMocks();
  });
  afterAll(async () => {
    for (const show of shows) {
      await run('DELETE FROM episode_briefs WHERE show_id = :show', { show }).catch(() => {});
      for (const t of ['season_specials', 'season_slots', 'show_arcs']) await run(`DELETE FROM ${t} WHERE show_id = :show`, { show }).catch(() => {});
      await run('DELETE FROM episodes WHERE show_id = :show', { show }).catch(() => {});
      await run('DELETE FROM world_events WHERE show_id = :show', { show }).catch(() => {});
      await run('DELETE FROM shows WHERE id = :show', { show }).catch(() => {});
    }
    await sequelize.close();
  });

  test('P1: an event pencilled into the target since the preview: 409, the newer pencil kept', async () => {
    const { show, arcId } = await seedShow();
    const x = await addEvent(show, 'Reviewed X');
    const y = await addEvent(show, 'Pencilled since Y');
    const t = await slotId(arcId, 7);
    const [save, pencil] = await raceWith(
      () => setup.applyPlacement(sequelize, show, [{ slot_id: t, event_id: x }]),
      () => slots.pencilEvent(sequelize, show, t, y),
      atSlotRead);
    expect(pencil.ok).toBe(true);
    expect(save).toMatchObject({ ok: false, status: 409, code: 'SEASON_SLOT_CHANGED' });
    expect((await slotRow(t)).event_id).toBe(y);
    expect(await rows('SELECT id FROM season_slots WHERE arc_id = :arcId AND event_id = :x', { arcId, x })).toEqual([]);
  });

  test('P2: the other pencil holds the slot while the Save waits: 409, the newer pencil kept', async () => {
    const { show, arcId } = await seedShow();
    const x = await addEvent(show, 'Reviewed X');
    const y = await addEvent(show, 'Holding Y');
    const t = await slotId(arcId, 8);
    trace = lockTrace.install(sequelize);
    const g = trace.gate((r) => r.kind === 'lock' && r.table === 'season_slots');
    let pencil;
    let save;
    try {
      pencil = outcome(() => slots.pencilEvent(sequelize, show, t, y));
      await g.reached; // the pencil holds slot 8
      save = outcome(() => setup.applyPlacement(sequelize, show, [{ slot_id: t, event_id: x }]));
      await wait(500);
      g.open();
      pencil = await pencil;
      save = await save;
    } finally {
      g.open();
      trace.uninstall();
      trace = null;
    }
    expect(pencil.ok).toBe(true);
    expect(save).toMatchObject({ ok: false, status: 409, code: 'SEASON_SLOT_CHANGED' });
    expect((await slotRow(t)).event_id).toBe(y);
  });

  test('P3: an episode placement into a slot that has had an event pencilled since: 409, both kept', async () => {
    const { show, arcId } = await seedShow();
    const ep = await addEpisode(show);
    const y = await addEvent(show, 'Pencilled since Y');
    const t = await slotId(arcId, 5);
    const [save, pencil] = await raceWith(
      () => setup.applyPlacement(sequelize, show, [{ slot_id: t, episode_id: ep }]),
      () => slots.pencilEvent(sequelize, show, t, y),
      atEpisodeLock);
    expect(pencil.ok).toBe(true);
    expect(save).toMatchObject({ ok: false, status: 409, code: 'SEASON_SLOT_CHANGED' });
    expect(await slotRow(t)).toMatchObject({ event_id: y, episode_id: null, locked_at: null });
    expect(await placedIn(ep)).toEqual([]);
  });

  test('P4: the Save\'s event pencilled into another slot since: 409, not moved out of it', async () => {
    const { show, arcId } = await seedShow();
    const t = await slotId(arcId, 9);
    const k = await slotId(arcId, 15);
    // The Save locks its events before any read of the season, so a pencil of
    // the same event cannot commit inside its window: it waits for the Save.
    // Pencilled before the Save runs, it is a change the preview never showed
    // (the preview offers no event that is already in the season).
    const x2 = await addEvent(show, 'Already elsewhere');
    await slots.pencilEvent(sequelize, show, k, x2);
    const res = await outcome(() => setup.applyPlacement(sequelize, show, [{ slot_id: t, event_id: x2 }]));
    expect(res).toMatchObject({ ok: false, status: 409, code: 'SEASON_SLOT_CHANGED' });
    expect((await slotRow(k)).event_id).toBe(x2);
  });

  test('P5: an explicitly reviewed replacement still replaces; a different event than the one reviewed is refused', async () => {
    const { show, arcId } = await seedShow();
    const y = await addEvent(show, 'Reviewed Y');
    const x = await addEvent(show, 'Replaces Y');
    const t = await slotId(arcId, 4);
    await slots.pencilEvent(sequelize, show, t, y);
    expect(await outcome(() => setup.applyPlacement(sequelize, show, [{ slot_id: t, event_id: x, expected_event_id: y }])))
      .toMatchObject({ ok: true, value: { placed: 1, events: 1 } });
    expect((await slotRow(t)).event_id).toBe(x);

    // Reviewed with Y, but Z is there now: refused, Z kept.
    const z = await addEvent(show, 'Z since');
    const w = await addEvent(show, 'W');
    const t2 = await slotId(arcId, 12);
    await slots.pencilEvent(sequelize, show, t2, z);
    expect(await outcome(() => setup.applyPlacement(sequelize, show, [{ slot_id: t2, event_id: w, expected_event_id: y }])))
      .toMatchObject({ ok: false, status: 409, code: 'SEASON_SLOT_CHANGED' });
    expect((await slotRow(t2)).event_id).toBe(z);

    // An episode replacing the event it was reviewed with.
    const ep = await addEpisode(show);
    const v = await addEvent(show, 'Reviewed V');
    const t3 = await slotId(arcId, 13);
    await slots.pencilEvent(sequelize, show, t3, v);
    expect(await outcome(() => setup.applyPlacement(sequelize, show, [{ slot_id: t3, episode_id: ep, expected_event_id: v }])))
      .toMatchObject({ ok: true, value: { placed: 1, episodes: 1 } });
    expect(await slotRow(t3)).toMatchObject({ episode_id: ep });
  });

  test('P6: one conflicting placement rolls the whole Save back, the earlier episode placement included', async () => {
    const { show, arcId } = await seedShow();
    const ep = await addEpisode(show);
    const x = await addEvent(show, 'Second item X');
    const y = await addEvent(show, 'Pencilled since Y');
    const t1 = await slotId(arcId, 2);
    const t2 = await slotId(arcId, 3);
    const [save, pencil] = await raceWith(
      () => setup.applyPlacement(sequelize, show, [{ slot_id: t1, episode_id: ep }, { slot_id: t2, event_id: x }]),
      () => slots.pencilEvent(sequelize, show, t2, y),
      atSlotRead);
    expect(pencil.ok).toBe(true);
    expect(save).toMatchObject({ ok: false, status: 409, code: 'SEASON_SLOT_CHANGED' });
    expect(await slotRow(t1)).toMatchObject({ episode_id: null, event_id: null, locked_at: null });
    expect(await placedIn(ep)).toEqual([]);
    expect((await slotRow(t2)).event_id).toBe(y);
    const [{ season_context: ctx }] = await rows('SELECT season_context FROM episodes WHERE id = :ep', { ep });
    expect(ctx).toBeNull();
  });
  test('P7: omitted and explicit null expected_event_id both mean "reviewed empty": an event found there refuses the Save', async () => {
    const { show, arcId } = await seedShow();
    const z = await addEvent(show, 'Pencilled since Z');
    const ep = await addEpisode(show);
    const x = await addEvent(show, 'X');
    const t = await slotId(arcId, 16);
    await slots.pencilEvent(sequelize, show, t, z);
    for (const item of [
      { slot_id: t, event_id: x },
      { slot_id: t, event_id: x, expected_event_id: null },
      { slot_id: t, episode_id: ep },
      { slot_id: t, episode_id: ep, expected_event_id: null },
    ]) {
      expect(await outcome(() => setup.applyPlacement(sequelize, show, [item])))
        .toMatchObject({ ok: false, status: 409, code: 'SEASON_SLOT_CHANGED' });
      expect(await slotRow(t)).toMatchObject({ event_id: z, episode_id: null });
    }
    // Reviewed empty and still empty: placed, either way of saying it.
    const open1 = await slotId(arcId, 17);
    const open2 = await slotId(arcId, 18);
    expect((await outcome(() => setup.applyPlacement(sequelize, show, [{ slot_id: open1, event_id: x }]))).ok).toBe(true);
    expect((await outcome(() => setup.applyPlacement(sequelize, show, [{ slot_id: open2, episode_id: ep, expected_event_id: null }]))).ok).toBe(true);
  });
});
