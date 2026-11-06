/**
 * A1.3-0 (C2, C3, C4, C4b, C6): the gated races, on the real migrated test
 * database, through the real service functions and routes. Each race holds
 * the first transaction just after it took a lock (tests/helpers/lockTrace's
 * gate), starts the second, lets it reach its own locks, then lets the first
 * go. Neither side may end in a deadlock (40P01) or a lock timeout (55P03,
 * or a route's 409 RETRY), and the season must be consistent afterwards.
 *
 *   T5   two Starts of different events race for the earliest slot: both
 *        get a weekly slot. Measured on main before A1.3-0: already true
 *        (Postgres locks rows under LIMIT until the limit is met, so a slot
 *        filled while the second waited is skipped); kept as a regression;
 *   T5a  every slot taken, then a Start: the full-season path, as before;
 *   T5b  two Starts for the last open slot: one gets it, the other takes the
 *        full-season path decided under the locks; never a false "placed";
 *   T5c  a lock timeout in the assignment: the setup step is "failed", the
 *        episode exists and is in no slot (Start is not atomic: A1.3b);
 *   T6   a pencilled event keeps its own slot against an unpencilled Start;
 *   T7   the swap against an update re-setting a special's own event (C3);
 *   T8   two pencils swapping events between two slots (C4);
 *   T8a  season setup against a pencil and against a Start's assignment (C4b);
 *   T9   the swap against a pencil of the same event into the same slot, and
 *   T9a  apply placement against the swap of the event it pencils (C4c);
 * and the Start pairs (swap, make and create special, placement, setup,
 * intention, event and Brief relinks, inject, clip attach on a regenerate,
 * delete, Start of the same event), each in both orders.
 */
jest.unmock('uuid');

const mockCreate = jest.fn(async () => { throw new Error('no model call is expected in the lock races'); });
jest.mock('@anthropic-ai/sdk', () => jest.fn(() => ({ messages: { create: mockCreate } })));

const { Sequelize } = require('sequelize');
const crypto = require('crypto');
const request = require('supertest');
const app = require('../../src/app');
const TokenService = require('../../src/services/tokenService');
const models = require('../../src/models');
const slotsMigration = require('../../src/migrations/20261001230000-create-season-slots');
const specialsMigration = require('../../src/migrations/20261026150000-create-season-specials');
const { seedArc } = require('../../src/services/arcProgressionService');
const slots = require('../../src/services/seasonSlotService');
const intentions = require('../../src/services/seasonIntentionService');
const setup = require('../../src/services/seasonSetupService');
const specials = require('../../src/services/seasonSpecials');
const full = require('../../src/services/seasonFullSpecials');
const clips = require('../../src/services/rawClipsService');
const { generateEpisodeFromEvent } = require('../../src/services/episodeGeneratorService');
const { isLockConflict } = require('../../src/utils/episodeLocks');
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

/** What a call ended in: { ok, value } or { ok: false, error, lock } with lock the deadlock or timeout code. */
async function outcome(fn) {
  try {
    const value = await fn();
    if (value && typeof value === 'object' && 'status' in value && 'body' in value) {
      const lock = value.body?.code === 'RETRY' || value.status >= 500 ? (value.body?.code || `HTTP ${value.status}`) : null;
      return { ok: value.status < 400, value, status: value.status, code: value.body?.code || null, lock };
    }
    return { ok: true, value };
  } catch (error) {
    const lock = isLockConflict(error) ? (error.original?.code || error.parent?.code || error.code) : null;
    return { ok: false, error, code: error?.code || null, status: error?.status || null, lock };
  }
}

const isFirstLock = (r) => Boolean(r.txId) && (r.kind === 'lock' || r.kind === 'write') && !r.error;

(shouldSkip ? describe.skip : describe)('A1.3-0: lock-order races on the real schema', () => {
  jest.setTimeout(60000);
  const shows = [];
  let trace = null;
  let token;
  const auth = (r) => r.set('Authorization', `Bearer ${token}`);

  async function seedShow() {
    const show = uuid();
    shows.push(show);
    await run(`INSERT INTO shows (id, name, slug, metadata, created_at, updated_at)
               VALUES (:show, :name, :slug, CAST('{"starting_balance": 1000}' AS jsonb), NOW(), NOW())`,
      { show, name: `Races ${show.slice(0, 8)}`, slug: `races-${show.slice(0, 8)}` });
    const { arc_id: arcId } = await seedArc(show, models);
    return { show, arcId };
  }
  async function addEpisode(show, n = 1) {
    const id = uuid();
    await run(`INSERT INTO episodes (id, show_id, title, episode_number, status, created_at, updated_at)
               VALUES (:id, :show, :title, :n, 'draft', NOW(), NOW())`, { id, show, title: `Race episode ${n}`, n });
    await run(`INSERT INTO episode_briefs (id, episode_id, show_id, status, created_at, updated_at)
               VALUES (:bid, :id, :show, 'draft', NOW(), NOW())`, { bid: uuid(), id, show });
    return id;
  }
  async function addEvent(show, name, { usedIn = null, status = 'draft' } = {}) {
    const id = uuid();
    await run(`INSERT INTO world_events (id, show_id, name, event_type, status, prestige, strictness, cost_coins, used_in_episode_id, canon_consequences, created_at, updated_at)
               VALUES (:id, :show, :name, 'invite', :status, 5, 5, 0, :usedIn, '{}'::jsonb, NOW(), NOW())`, { id, show, name, usedIn, status });
    return id;
  }
  const slotId = async (arcId, n) => (await rows('SELECT id FROM season_slots WHERE arc_id = :arcId AND slot_number = :n', { arcId, n }))[0].id;
  const eventRow = async (id) => (await rows('SELECT * FROM world_events WHERE id = :id', { id }))[0];
  const start = async (show, ev, extra = {}) => generateEpisodeFromEvent(await eventRow(ev), models, { showId: show, wardrobeItems: [], ...extra });
  const episodeOf = async (ev) => (await rows('SELECT used_in_episode_id AS id FROM world_events WHERE id = :ev', { ev }))[0]?.id || null;
  async function placeOf(episodeId) {
    const [slot] = await rows('SELECT slot_number FROM season_slots WHERE episode_id = :episodeId AND deleted_at IS NULL', { episodeId });
    const [sp] = await rows('SELECT kind FROM season_specials WHERE episode_id = :episodeId AND deleted_at IS NULL', { episodeId });
    const [ep] = await rows('SELECT setup_status FROM episodes WHERE id = :episodeId', { episodeId });
    return { slot: slot ? Number(slot.slot_number) : null, special: sp ? sp.kind : null, step: ep?.setup_status?.steps?.season_slot || null };
  }
  /** The season is consistent: no episode in two places, no slot or special with a deleted or foreign episode. */
  async function expectConsistent(show) {
    const placed = await rows(`SELECT episode_id FROM season_slots WHERE show_id = :show AND episode_id IS NOT NULL AND deleted_at IS NULL
                               UNION ALL SELECT episode_id FROM season_specials WHERE show_id = :show AND episode_id IS NOT NULL AND deleted_at IS NULL`, { show });
    const ids = placed.map((r) => String(r.episode_id));
    expect(new Set(ids).size).toBe(ids.length);
    const links = await rows(`SELECT used_in_episode_id FROM world_events WHERE show_id = :show AND used_in_episode_id IS NOT NULL AND deleted_at IS NULL`, { show });
    const linked = links.map((r) => String(r.used_in_episode_id));
    expect(new Set(linked).size).toBe(linked.length);
  }

  /**
   * Runs first() until it has taken its first lock, then second(), then lets
   * first() go. Returns both outcomes. gateOn picks the statement to hold at.
   */
  async function race(first, second, { gateOn = isFirstLock, holdMs = 600 } = {}) {
    trace = lockTrace.install(sequelize);
    const g = trace.gate(gateOn);
    try {
      const a = outcome(first);
      await Promise.race([g.reached, a]);
      const b = outcome(second);
      await wait(holdMs);
      g.open();
      const [ra, rb] = await Promise.all([a, b]);
      return [ra, rb];
    } finally {
      g.open();
      trace.uninstall();
      trace = null;
    }
  }
  const expectNoLockConflict = (...outs) => outs.forEach((o) => {
    if (o.lock) throw new Error(`lock conflict ${o.lock}: ${o.error?.message || JSON.stringify(o.value?.body || null)}`);
  });

  const expectOk = (...outs) => outs.forEach((o) => {
    if (!o.ok) throw new Error(`expected success, got ${o.status || ''} ${o.code || ''}: ${o.error?.message || JSON.stringify(o.value?.body || null)}`);
  });

  beforeAll(async () => {
    token = TokenService.generateTokenPair({ id: 'test-user-lock-races', email: 'races@lock.dev', name: 'Races', groups: ['USER', 'EDITOR'], role: 'USER' }).accessToken;
    await slotsMigration.up(sequelize.getQueryInterface(), Sequelize);
    if (!(await rows("SELECT to_regclass('public.season_specials') AS t"))[0].t) {
      await specialsMigration.up(sequelize.getQueryInterface(), Sequelize);
    }
  });
  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => {
    if (trace) trace.uninstall();
    jest.restoreAllMocks();
  });
  afterAll(async () => {
    await wait(800); // Start's after-commit work
    expect(mockCreate).not.toHaveBeenCalled();
    for (const show of shows) {
      const eps = '(SELECT id FROM episodes WHERE show_id = :show)';
      for (const t of ['episode_raw_clips', 'episode_briefs', 'scene_plans', 'episode_todo_lists', 'episode_spending_lines', 'episode_wardrobe', 'feed_posts', 'episode_scripts']) {
        await run(`DELETE FROM ${t} WHERE episode_id IN ${eps}`, { show }).catch(() => {});
      }
      for (const t of ['season_specials', 'season_slots', 'financial_transactions', 'character_state_history', 'character_state', 'show_arcs']) {
        await run(`DELETE FROM ${t} WHERE show_id = :show`, { show }).catch(() => {});
      }
      await run('UPDATE world_events SET used_in_episode_id = NULL WHERE show_id = :show', { show }).catch(() => {});
      await run('DELETE FROM episodes WHERE show_id = :show', { show }).catch(() => {});
      await run('DELETE FROM world_events WHERE show_id = :show', { show }).catch(() => {});
      await run('DELETE FROM shows WHERE id = :show', { show }).catch(() => {});
    }
    await sequelize.close();
  });

  // The assignment's slot lock (Start's second transaction).
  const atSlotPick = (r) => r.kind === 'lock' && r.table === 'season_slots' && !r.error;

  describe('C2: the Start assignment under contention (regression: correct on main too)', () => {
    test.each([['first', 'second'], ['second', 'first']])('T5: two Starts of different events (%s held) both get a weekly slot', async (held) => {
      const { show } = await seedShow();
      const evs = { first: await addEvent(show, 'Race One'), second: await addEvent(show, 'Race Two') };
      const other = held === 'first' ? 'second' : 'first';
      const [ra, rb] = await race(() => start(show, evs[held]), () => start(show, evs[other]), { gateOn: atSlotPick });
      expectNoLockConflict(ra, rb);
      expectOk(ra, rb);
      const pa = await placeOf(await episodeOf(evs[held]));
      const pb = await placeOf(await episodeOf(evs[other]));
      expect(pa).toMatchObject({ slot: 1, special: null, step: { status: 'complete' } });
      expect(pb).toMatchObject({ slot: 2, special: null, step: { status: 'complete' } });
      await expectConsistent(show);
    });

    test('T5a: every slot taken, then a Start: the full-season path, as before', async () => {
      const { show, arcId } = await seedShow();
      await run('UPDATE season_slots SET episode_id = NULL, locked_at = NOW() WHERE arc_id = :arcId', { arcId });
      const ev = await addEvent(show, 'Race Full');
      const r = await outcome(() => start(show, ev));
      expect(r.ok).toBe(true);
      const p = await placeOf(await episodeOf(ev));
      expect(p.slot).toBeNull();
      expect(p.step).toMatchObject({ status: 'complete' });
      await expectConsistent(show);
    });

    test('T5b: two Starts for the last open slot: one gets it, the other takes the path decided under the locks', async () => {
      const { show, arcId } = await seedShow();
      const last = await slotId(arcId, 24);
      await run('UPDATE season_slots SET locked_at = NOW() WHERE arc_id = :arcId AND id <> :last', { arcId, last });
      const a = await addEvent(show, 'Race Last A');
      const b = await addEvent(show, 'Race Last B');
      const [ra, rb] = await race(() => start(show, a), () => start(show, b), { gateOn: atSlotPick });
      expectNoLockConflict(ra, rb);
      const pa = await placeOf(await episodeOf(a));
      const pb = await placeOf(await episodeOf(b));
      expect(pa).toMatchObject({ slot: 24, step: { status: 'complete' } });
      expect(pb.slot).toBeNull();
      // Never a false "placed": a step naming a slot has that slot committed.
      for (const p of [pa, pb]) {
        if (p.step?.slot && /E\d+/.test(String(p.step.slot)) && !/bonus|special/i.test(String(p.step.slot))) expect(p.slot).not.toBeNull();
      }
      await expectConsistent(show);
    });

    test('T5c: a lock timeout in the assignment is a failed setup step; the episode exists in no slot', async () => {
      const { show, arcId } = await seedShow();
      const ev = await addEvent(show, 'Race Timeout');
      const t = await sequelize.transaction();
      try {
        await sequelize.query('SELECT id FROM season_slots WHERE arc_id = :arcId ORDER BY id FOR UPDATE', { replacements: { arcId }, transaction: t });
        const r = await outcome(() => start(show, ev));
        expect(r.ok).toBe(true);
      } finally {
        await t.rollback();
      }
      const episodeId = await episodeOf(ev);
      expect(episodeId).toBeTruthy();
      const p = await placeOf(episodeId);
      expect(p.slot).toBeNull();
      expect(p.special).toBeNull();
      expect(p.step).toMatchObject({ status: 'failed' });
      await expectConsistent(show);
    });

    test.each([['pencilled', 'unpencilled'], ['unpencilled', 'pencilled']])('T6: a pencilled event keeps its slot (%s held)', async (held) => {
      const { show, arcId } = await seedShow();
      const evs = { pencilled: await addEvent(show, 'Race Pencilled'), unpencilled: await addEvent(show, 'Race Loose') };
      await slots.pencilEvent(sequelize, show, await slotId(arcId, 3), evs.pencilled);
      const other = held === 'pencilled' ? 'unpencilled' : 'pencilled';
      const [ra, rb] = await race(() => start(show, evs[held]), () => start(show, evs[other]), { gateOn: atSlotPick });
      expectNoLockConflict(ra, rb);
      expect((await placeOf(await episodeOf(evs.pencilled))).slot).toBe(3);
      expect((await placeOf(await episodeOf(evs.unpencilled))).slot).toBe(1);
      await expectConsistent(show);
    });
  });

  describe('C3, C4, C4b: lock order', () => {
    test.each([['update', 'swap'], ['swap', 'update']])('T7: the swap and an update re-setting the special\'s own event (%s held)', async (held) => {
      const { show, arcId } = await seedShow();
      const ev = await addEvent(show, 'Race Special');
      const sp = await specials.createSpecial(sequelize, show, { kind: 'bonus', event_id: ev, after_slot_number: 3 });
      const target = await slotId(arcId, 10);
      const ops = {
        update: () => specials.updateSpecial(sequelize, show, sp.id, { event_id: ev }),
        swap: () => full.swapIntoSlot(sequelize, show, ev, target),
      };
      const other = held === 'update' ? 'swap' : 'update';
      // Held right after the special's lock (update) or the event's (swap).
      const gateOn = held === 'update'
        ? (r) => r.kind === 'lock' && r.table === 'season_specials'
        : (r) => r.kind === 'lock' && r.table === 'world_events';
      const [ra, rb] = await race(ops[held], ops[other], { gateOn });
      expectNoLockConflict(ra, rb);
      await expectConsistent(show);
    });

    test.each([['one', 'two'], ['two', 'one']])('T8: two pencils swapping events between two slots (%s held)', async (held) => {
      const { show, arcId } = await seedShow();
      const s3 = await slotId(arcId, 3);
      const s9 = await slotId(arcId, 9);
      const x = await addEvent(show, 'Race X');
      const y = await addEvent(show, 'Race Y');
      await slots.pencilEvent(sequelize, show, s3, x);
      await slots.pencilEvent(sequelize, show, s9, y);
      const ops = { one: () => slots.pencilEvent(sequelize, show, s9, x), two: () => slots.pencilEvent(sequelize, show, s3, y) };
      const other = held === 'one' ? 'two' : 'one';
      const [ra, rb] = await race(ops[held], ops[other], { gateOn: (r) => r.kind === 'lock' && r.table === 'season_slots' });
      expectNoLockConflict(ra, rb);
      expect(ra.ok).toBe(true);
      // The second either lands or is refused as a season change: nothing half-written.
      if (!rb.ok) expect(rb.code).toBe('SEASON_CHANGED_RETRY');
      const evs = await rows('SELECT slot_number, event_id FROM season_slots WHERE id IN (:ids) ORDER BY slot_number', { ids: [s3, s9] });
      const held3 = evs.map((r) => r.event_id).filter(Boolean);
      expect(new Set(held3).size).toBe(held3.length);
      await expectConsistent(show);
    });

    const SETUP = { title: 'Raced season', tagline: 'Raced', phases: [1, 2, 3].map((n) => ({ title: `Part ${n}`, tagline: `T ${n}` })) };

    test.each([['pencil', 'setup'], ['setup', 'pencil']])('T8a: season setup against a pencil moving an event down the season (%s held)', async (held) => {
      const { show, arcId } = await seedShow();
      const x = await addEvent(show, 'Race Setup Pencil');
      await slots.pencilEvent(sequelize, show, await slotId(arcId, 3), x);
      const s9 = await slotId(arcId, 9);
      const ops = { pencil: () => slots.pencilEvent(sequelize, show, s9, x), setup: () => setup.updateSetup(sequelize, show, SETUP) };
      const other = held === 'pencil' ? 'setup' : 'pencil';
      const gateOn = held === 'pencil'
        ? (r) => r.kind === 'lock' && r.table === 'season_slots'
        : (r) => r.kind === 'lock' && r.table === 'season_slots' && r.ids.length > 1;
      const [ra, rb] = await race(ops[held], ops[other], { gateOn });
      expectNoLockConflict(ra, rb);
      expectOk(ra, rb);
      await expectConsistent(show);
    });

    test.each([['start', 'setup'], ['setup', 'start']])('T8a: season setup against a Start\'s assignment (%s held)', async (held) => {
      const { show } = await seedShow();
      const ev = await addEvent(show, 'Race Setup Start');
      const ops = { start: () => start(show, ev), setup: () => setup.updateSetup(sequelize, show, SETUP) };
      const other = held === 'start' ? 'setup' : 'start';
      const gateOn = held === 'start' ? atSlotPick : (r) => r.kind === 'lock' && r.table === 'season_slots' && r.ids.length > 1;
      const [ra, rb] = await race(ops[held], ops[other], { gateOn });
      expectNoLockConflict(ra, rb);
      const res = { [held]: ra, [other]: rb };
      expectOk(res.start);
      // A setup that waited on the Start finds a started draft it did not lock
      // (A1.1's re-check): refused whole, as a season change; nothing written.
      if (!res.setup.ok) expect(res.setup.code).toBe('SEASON_CHANGED_RETRY');
      expect((await placeOf(await episodeOf(ev))).slot).toBe(1);
      await expectConsistent(show);
    });
  });

  describe('C4c: the swap against a pencil of the same event (the pencil locks the event first)', () => {
    // Before: the pencil took the slot, then cleared the event from its
    // special (S -> P); the swap took the event, the special, then the slot
    // (W -> P -> S): 40P01 in both orders (reproduced on bb8450eb). Now the
    // pencil locks the event first (W -> S -> P), so the two queue on it.
    test.each([['swap', 'pencil'], ['pencil', 'swap']])('T9: %s held: no deadlock, the slot ends with the event', async (held) => {
      const { show, arcId } = await seedShow();
      const ev = await addEvent(show, 'Pencil vs swap');
      await specials.createSpecial(sequelize, show, { kind: 'bonus', event_id: ev, after_slot_number: 3 });
      const target = await slotId(arcId, 10);
      const ops = { swap: () => full.swapIntoSlot(sequelize, show, ev, target), pencil: () => slots.pencilEvent(sequelize, show, target, ev) };
      const other = held === 'swap' ? 'pencil' : 'swap';
      const gateOn = held === 'swap'
        ? (r) => r.kind === 'lock' && r.table === 'season_specials'
        : (r) => r.kind === 'lock' && r.table === 'season_slots';
      const [ra, rb] = await race(ops[held], ops[other], { gateOn });
      expectNoLockConflict(ra, rb);
      expectOk(ra);
      // The second either lands too, or is refused by its own rule after the first: nothing half-written.
      if (!rb.ok) expect(rb.status).toBe(409);
      await expectConsistent(show);
      const [slot] = await rows('SELECT event_id FROM season_slots WHERE id = :target', { target });
      expect(slot.event_id).toBe(ev);
      const live = await rows('SELECT id FROM season_specials WHERE show_id = :show AND event_id = :ev AND deleted_at IS NULL', { show, ev });
      expect(live).toHaveLength(0); // the event is in the slot, not also in a special
    });

    test.each([['placement', 'swap'], ['swap', 'placement']])('T9a: apply placement (an episode, then the event) against the swap of that event (%s held)', async (held) => {
      const { show, arcId } = await seedShow();
      const ev = await addEvent(show, 'Placement vs swap');
      await specials.createSpecial(sequelize, show, { kind: 'bonus', event_id: ev, after_slot_number: 3 });
      const ep = await addEpisode(show);
      const sEp = await slotId(arcId, 6);
      const sEv = await slotId(arcId, 11);
      const ops = {
        placement: () => setup.applyPlacement(sequelize, show, [{ slot_id: sEp, episode_id: ep }, { slot_id: sEv, event_id: ev }]),
        swap: () => full.swapIntoSlot(sequelize, show, ev, sEp),
      };
      const other = held === 'placement' ? 'swap' : 'placement';
      const gateOn = held === 'placement'
        ? (r) => r.kind === 'lock' && r.table === 'season_slots'
        : (r) => r.kind === 'lock' && r.table === 'season_specials';
      const [ra, rb] = await race(ops[held], ops[other], { gateOn });
      expectNoLockConflict(ra, rb);
      expectOk(ra);
      if (!rb.ok) expect(rb.status).toBe(409);
      await expectConsistent(show);
    });
  });

  describe('Start against the other writers, both orders', () => {
    /** Each pair: a fixture, the Start (or regenerate) and the other operation. */
    const PAIRS = {
      'swap (same event)': async () => {
        const { show, arcId } = await seedShow();
        const ev = await addEvent(show, 'Pair Swap');
        await specials.createSpecial(sequelize, show, { kind: 'bonus', event_id: ev, after_slot_number: 3 });
        const target = await slotId(arcId, 10);
        return { show, startOp: () => start(show, ev), otherOp: () => full.swapIntoSlot(sequelize, show, ev, target) };
      },
      'make special (same event)': async () => {
        const { show } = await seedShow();
        const ev = await addEvent(show, 'Pair Make');
        return { show, startOp: () => start(show, ev), otherOp: () => full.makeSpecial(sequelize, show, ev) };
      },
      'create special (same event)': async () => {
        const { show } = await seedShow();
        const ev = await addEvent(show, 'Pair Create');
        return { show, startOp: () => start(show, ev), otherOp: () => specials.createSpecial(sequelize, show, { kind: 'bonus', event_id: ev, after_slot_number: 2 }) };
      },
      'placement into the earliest slot': async () => {
        const { show, arcId } = await seedShow();
        const ev = await addEvent(show, 'Pair Place');
        const ep = await addEpisode(show);
        const s1 = await slotId(arcId, 1);
        return { show, startOp: () => start(show, ev), otherOp: () => slots.placeEpisode(sequelize, show, s1, ep) };
      },
      'season setup': async () => {
        const { show } = await seedShow();
        const ev = await addEvent(show, 'Pair Setup');
        const body = { title: 'Paired', tagline: 'Paired', phases: [1, 2, 3].map((n) => ({ title: `Part ${n}`, tagline: `T ${n}` })) };
        return { show, startOp: () => start(show, ev), otherOp: () => setup.updateSetup(sequelize, show, body) };
      },
      'intention save on the earliest slot': async () => {
        const { show, arcId } = await seedShow();
        const ev = await addEvent(show, 'Pair Intention');
        const s1 = await slotId(arcId, 1);
        return { show, startOp: () => start(show, ev), otherOp: () => intentions.saveIntention(sequelize, show, s1, { story_purpose: 'Paired purpose' }) };
      },
      'event PUT linking the same event elsewhere': async () => {
        const { show } = await seedShow();
        const ev = await addEvent(show, 'Pair Event PUT');
        const ep = await addEpisode(show);
        return { show, startOp: () => start(show, ev), otherOp: () => auth(request(app).put(`/api/v1/world/${show}/events/${ev}`)).send({ used_in_episode_id: ep }) };
      },
      'Brief PUT naming the same event': async () => {
        const { show } = await seedShow();
        const ev = await addEvent(show, 'Pair Brief PUT');
        const ep = await addEpisode(show);
        return { show, startOp: () => start(show, ev), otherOp: () => auth(request(app).put(`/api/v1/episode-brief/${ep}`)).send({ event_id: ev }) };
      },
      'inject of the same event': async () => {
        const { show } = await seedShow();
        const ev = await addEvent(show, 'Pair Inject');
        const ep = await addEpisode(show);
        return { show, startOp: () => start(show, ev), otherOp: () => auth(request(app).post(`/api/v1/world/${show}/events/${ev}/inject`)).send({ episode_id: ep }) };
      },
      'Start of the same event': async () => {
        const { show } = await seedShow();
        const ev = await addEvent(show, 'Pair Same');
        return { show, startOp: () => start(show, ev), otherOp: () => start(show, ev) };
      },
      'clip attach on a regenerate\'s episode': async () => {
        const { show } = await seedShow();
        const ep = await addEpisode(show);
        const ev = await addEvent(show, 'Pair Clip', { usedIn: ep, status: 'used' });
        const clip = { id: uuid(), episode_id: ep, show_id: show, performer: 'lala', s3_key_raw: `episodes/${ep}/raw-clips/${uuid()}/original.mp4` };
        return { show, startOp: () => start(show, ev, { replacingEpisodeId: ep }), otherOp: () => clips.createClip(sequelize, clip) };
      },
      'delete of a regenerate\'s episode': async () => {
        const { show } = await seedShow();
        const ep = await addEpisode(show);
        const ev = await addEvent(show, 'Pair Delete', { usedIn: ep, status: 'used' });
        return { show, startOp: () => start(show, ev, { replacingEpisodeId: ep }), otherOp: () => auth(request(app).delete(`/api/v1/episodes/${ep}`)) };
      },
    };
    const cases = [];
    for (const name of Object.keys(PAIRS)) {
      cases.push([name, 'Start held']);
      cases.push([name, 'other held']);
    }
    test.each(cases)('Start × %s (%s): no deadlock, no lock timeout, a consistent season', async (name, order) => {
      const f = await PAIRS[name]();
      const [first, second] = order === 'Start held' ? [f.startOp, f.otherOp] : [f.otherOp, f.startOp];
      const [ra, rb] = await race(first, second);
      expectNoLockConflict(ra, rb);
      await expectConsistent(f.show);
    });
  });
});
