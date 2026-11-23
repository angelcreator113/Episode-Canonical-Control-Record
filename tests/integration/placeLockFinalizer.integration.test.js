/**
 * Foundation A: finalizePlaceWrite (utils/placeLock), the short transaction
 * that commits a write to an event's Place only while the Place is not
 * locked (Evoni, 2026-11-23). No route calls it yet; this suite is its only
 * caller.
 *
 * On the migrated test database, against the real acceptance
 * (episodeCompletionService.completeEpisode, a real two-part completion) and
 * a real event-first writer (the event PUT). The interleavings are held open
 * with a latch inside `work`, tests/helpers/lockTrace's gate, or a second
 * transaction, and a wait is seen in pg_stat_activity, never slept for.
 *
 * This file sends no DDL and calls no provider or object storage.
 */
jest.unmock('uuid');

// A real completion writes its story record with the model after it commits;
// that call is answered here with a refusal, which completion logs and
// survives. The finalizer itself never reaches a provider (asserted below).
const mockAnthropic = jest.fn(async () => { throw new Error('the model is not called in the Place lock races'); });
jest.mock('@anthropic-ai/sdk', () => jest.fn(() => ({ messages: { create: mockAnthropic } })));

const request = require('supertest');
const app = require('../../src/app');
const TokenService = require('../../src/services/tokenService');
const models = require('../../src/models');
const placeLock = require('../../src/utils/placeLock');
const { findTermsLockEpisode } = require('../../src/utils/eventTermsLock');
const { lockEpisodes, LOCK_TIMEOUT, RetryableConflictError, isLockConflict } = require('../../src/utils/episodeLocks');
const { EVENT_DELETED_CODE } = require('../../src/utils/eventEpisodeLink');
const { completeEpisode } = require('../../src/services/episodeCompletionService');
const { seedArc } = require('../../src/services/arcProgressionService');
const lockTrace = require('../helpers/lockTrace');
const networkGuard = require('../networkGuard/core');
const { placeLockFixtures, waitForLockWait } = require('../helpers/placeLockFixtures');

const { sequelize } = models;
const { finalizePlaceWrite, isPlaceLocked, PLACE_FINALIZE_OUTCOMES: O } = placeLock;

const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

// Filled per test: what a failing test must not leave open (transactions, gates, latches).
const open = [];
const latch = () => {
  let release;
  const wait = new Promise((resolve) => { release = resolve; });
  open.push(async () => release());
  return { wait, open: release };
};
/** What a call ended in, never an unhandled rejection: { ok, value } or { ok: false, error, lock }. */
const settle = (promise) => promise.then(
  (value) => ({ ok: true, value }),
  (error) => ({ ok: false, error, lock: isLockConflict(error) ? (error.original?.code || error.parent?.code || error.code) : null }));

(shouldSkip ? describe.skip : describe)('Foundation A: finalizePlaceWrite', () => {
  jest.setTimeout(60000);
  const fx = placeLockFixtures(sequelize, models);
  const { rows, mkShow, mkEpisode, mkEvent, mkBrief, mkSet, evaluationOf, eventRow } = fx;
  let show;
  let setA;
  let setB;
  let token;
  let editorToken;
  let trace = null;
  const auth = (r) => r.set('Authorization', `Bearer ${token}`);

  /** `work` that writes one column in the finalizer's transaction and counts its calls. */
  function writer(value = 'Finalised') {
    const calls = [];
    const work = async (ctx) => {
      calls.push(ctx);
      await sequelize.query('UPDATE world_events SET venue_name = :value WHERE id = :id', { replacements: { value, id: ctx.event.id }, transaction: ctx.transaction });
      return { saved: value };
    };
    return { work, calls };
  }
  const venueName = async (ev) => (await eventRow(ev)).venue_name;

  /** A draft episode and its primary event (stamp and Brief), held at setA. */
  async function primary({ evaluation = 'pending', set = setA } = {}) {
    const ep = await mkEpisode(show, { evaluation });
    const ev = await mkEvent(show, { stamp: ep, set });
    await mkBrief(show, ep, ev);
    return { ep, ev };
  }
  /**
   * A draft episode and an event linked to it by its stamp alone: no Brief
   * names the event (the link a non-primary event has). The episode has no
   * Brief here: a completion refuses an episode whose Brief names another,
   * unstamped event (409 EPISODE_EVENT_LINK_INCONSISTENT), and the unique
   * index on used_in_episode_id lets only one event be stamped on an episode.
   */
  async function stampOnly() {
    const ep = await mkEpisode(show);
    const ev = await mkEvent(show, { stamp: ep, set: setA });
    return { ep, ev };
  }
  async function holdTransaction() {
    const transaction = await sequelize.transaction();
    open.push(async () => { if (!transaction.finished) await transaction.rollback(); });
    return transaction;
  }
  function tracing() {
    trace = lockTrace.install(sequelize);
    return trace;
  }
  function gateOn(predicate) {
    const g = (trace || tracing()).gate(predicate);
    open.push(async () => g.open());
    return g;
  }

  beforeAll(async () => {
    token = TokenService.generateTokenPair({ id: 'test-admin-place-finalizer', email: 'admin@placefinalizer.dev', name: 'Admin', groups: ['ADMIN'], role: 'ADMIN' }).accessToken;
    editorToken = TokenService.generateTokenPair({ id: 'test-editor-place-finalizer', email: 'editor@placefinalizer.dev', name: 'Editor', groups: ['USER', 'EDITOR'], role: 'USER' }).accessToken;
    show = await mkShow('Place finalizer');
    setA = await mkSet(show, 'Finalizer A');
    setB = await mkSet(show, 'Finalizer B');
  });
  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(async () => {
    for (const close of open.splice(0).reverse()) await close();
    if (trace) { trace.uninstall(); trace = null; }
    jest.restoreAllMocks();
  });
  afterAll(async () => {
    await new Promise((resolve) => setTimeout(resolve, 500)); // completion's and Start Episode's after-commit work
    await fx.cleanup();
  });

  describe('what it exports', () => {
    test('the outcome codes, the attempts, and the Place lock\'s own exports', () => {
      expect(O).toEqual({
        OK: 'OK',
        PLACE_LOCKED: 'PLACE_LOCKED',
        STALE_SOURCE_SET: 'STALE_SOURCE_SET',
        EVENT_DELETED: 'EVENT_DELETED',
        RETRY_EXHAUSTED: 'PLACE_FINALIZE_RETRY_EXHAUSTED',
      });
      expect(Object.isFrozen(O)).toBe(true);
      expect(O.PLACE_LOCKED).toBe(placeLock.PLACE_LOCKED_CODE);
      expect(O.EVENT_DELETED).toBe(EVENT_DELETED_CODE);
      expect(placeLock.PLACE_FINALIZE_MAX_ATTEMPTS).toBe(3);
      expect(Object.keys(placeLock).sort()).toEqual([
        'PLACE_FINALIZE_MAX_ATTEMPTS', 'PLACE_FINALIZE_OUTCOMES', 'PLACE_LOCKED_CODE', 'PLACE_LOCKED_MESSAGE', 'finalizePlaceWrite', 'isPlaceLocked',
      ]);
    });

    test('it needs an event id, a work function and a plain timeout', async () => {
      const { ev } = await primary();
      await expect(finalizePlaceWrite(sequelize, null, { work: async () => {} })).rejects.toThrow(/event id/);
      await expect(finalizePlaceWrite(sequelize, ev, {})).rejects.toThrow(/work/);
      await expect(finalizePlaceWrite(sequelize, ev, { work: async () => {}, lockTimeout: "1s'; DROP" })).rejects.toThrow(/lockTimeout/);
    });
  });

  describe('one attempt', () => {
    test('OK: work is called once with the transaction and the locked event; its write commits; episodes are locked FOR SHARE before the event row', async () => {
      const { ep, ev } = await primary();
      const { work, calls } = writer();
      const t = tracing();
      const res = await finalizePlaceWrite(sequelize, ev, { sourceSetId: setA, work });
      expect(res).toEqual({ outcome: O.OK, code: 'OK', value: { saved: 'Finalised' }, attempts: 1 });
      expect(calls).toHaveLength(1);
      expect(calls[0].event).toEqual({ id: ev, used_in_episode_id: ep, deleted_at: null, scene_set_id: setA });
      expect(calls[0].transaction.finished).toBe('commit');
      expect(await venueName(ev)).toBe('Finalised');
      // One transaction, committed: episodes (share) first, then the event row (update), then the write.
      const mine = t.byTransaction().get(calls[0].transaction.id);
      expect(mine[0].kind).toBe('begin');
      expect(mine[mine.length - 1].kind).toBe('commit');
      expect(lockTrace.classSequence(mine)).toEqual(['E:episodes:share', 'W:world_events:update', 'W:world_events:write']);
      expect(lockTrace.checkOrder(mine)).toEqual([]);
      expect(mine.find((r) => r.kind === 'lock' && r.table === 'episodes').ids).toEqual([ep]);
    });

    test('two linked episodes are locked in id order, in one ordered statement', async () => {
      const one = await mkEpisode(show);
      const two = await mkEpisode(show);
      const ev = await mkEvent(show, { stamp: one, set: setA });
      await mkBrief(show, one, ev, { agoMinutes: 5 });
      await mkBrief(show, two, ev);
      const { work, calls } = writer();
      const t = tracing();
      expect((await finalizePlaceWrite(sequelize, ev, { work })).outcome).toBe(O.OK);
      const lock = t.byTransaction().get(calls[0].transaction.id).find((r) => r.kind === 'lock' && r.table === 'episodes');
      expect(lock).toMatchObject({ mode: 'share', ordered: true, ids: [one, two].sort() });
    });

    test('no linked episode: still OK, and the lock wait is bounded by the real LOCK_TIMEOUT', async () => {
      const ev = await mkEvent(show, { set: setA });
      const seen = [];
      tracing().gate((rec, sql) => { if (rec.txId) seen.push(sql); return false; });
      const { work, calls } = writer();
      expect(await finalizePlaceWrite(sequelize, ev, { sourceSetId: setA, work })).toMatchObject({ outcome: O.OK, attempts: 1 });
      expect(calls).toHaveLength(1);
      expect(LOCK_TIMEOUT).toBe('10s');
      const timeoutAt = seen.indexOf(`SET LOCAL lock_timeout = '${LOCK_TIMEOUT}'`);
      const eventLockAt = seen.findIndex((s) => /FROM world_events WHERE id = .* FOR UPDATE$/.test(s));
      expect(timeoutAt).toBeGreaterThanOrEqual(0);
      expect(eventLockAt).toBeGreaterThan(timeoutAt);
      expect(seen.some((s) => /FROM episodes WHERE id IN/.test(s))).toBe(false);
    });

    test('PLACE_LOCKED: work is not called and nothing is written', async () => {
      const { ev } = await primary({ evaluation: 'accepted' });
      const { work, calls } = writer();
      const before = JSON.stringify(await eventRow(ev));
      const res = await finalizePlaceWrite(sequelize, ev, { sourceSetId: setA, work });
      expect(res).toEqual({ outcome: O.PLACE_LOCKED, code: 'PLACE_LOCKED', message: placeLock.PLACE_LOCKED_MESSAGE, attempts: 1 });
      expect(calls).toHaveLength(0);
      expect(JSON.stringify(await eventRow(ev))).toBe(before);
    });

    test('PLACE_LOCKED in a state only the strict rule locks: a draft names the event of an accepted episode', async () => {
      const accepted = await mkEpisode(show, { evaluation: 'accepted' });
      const draft = await mkEpisode(show);
      const ev = await mkEvent(show, { stamp: accepted, set: setA });
      await mkBrief(show, draft, ev);
      const { work, calls } = writer();
      expect((await finalizePlaceWrite(sequelize, ev, { sourceSetId: setA, work })).outcome).toBe(O.PLACE_LOCKED);
      expect(calls).toHaveLength(0);
    });

    test('STALE_SOURCE_SET: the event\'s set changed, was chosen since, or was cleared since; work is not called', async () => {
      const changed = await primary({ set: setB });
      const { work, calls } = writer();
      expect(await finalizePlaceWrite(sequelize, changed.ev, { sourceSetId: setA, work })).toEqual({
        outcome: O.STALE_SOURCE_SET, code: 'STALE_SOURCE_SET', message: expect.stringMatching(/scene set changed/), source_set_id: setA, scene_set_id: setB, attempts: 1,
      });
      // null is a real value: the work began when the event had no set.
      expect(await finalizePlaceWrite(sequelize, changed.ev, { sourceSetId: null, work })).toMatchObject({ outcome: O.STALE_SOURCE_SET, source_set_id: null, scene_set_id: setB });
      const cleared = await primary({ set: null });
      expect(await finalizePlaceWrite(sequelize, cleared.ev, { sourceSetId: setA, work })).toMatchObject({ outcome: O.STALE_SOURCE_SET, source_set_id: setA, scene_set_id: null });
      expect(calls).toHaveLength(0);
      expect(await venueName(changed.ev)).toBeNull();
      // null against null is not stale.
      expect(await finalizePlaceWrite(sequelize, cleared.ev, { sourceSetId: null, work })).toMatchObject({ outcome: O.OK });
      expect(calls).toHaveLength(1);
      expect(calls[0].event.scene_set_id).toBeNull();
    });

    test('sourceSetId undefined skips the set check', async () => {
      const { ev } = await primary({ set: setB });
      const { work, calls } = writer();
      expect(await finalizePlaceWrite(sequelize, ev, { work })).toMatchObject({ outcome: O.OK, attempts: 1 });
      expect(await finalizePlaceWrite(sequelize, ev, { sourceSetId: undefined, work })).toMatchObject({ outcome: O.OK, attempts: 1 });
      expect(calls).toHaveLength(2);
    });

    test('the Place lock is asked before the set: an accepted event with a changed set answers PLACE_LOCKED', async () => {
      const { ev } = await primary({ evaluation: 'accepted', set: setB });
      const { work } = writer();
      expect((await finalizePlaceWrite(sequelize, ev, { sourceSetId: setA, work })).outcome).toBe(O.PLACE_LOCKED);
    });

    test('EVENT_DELETED: a soft-deleted event and an event that is not there; nothing is written', async () => {
      const ep = await mkEpisode(show);
      const gone = await mkEvent(show, { stamp: ep, set: setA, deleted: true });
      const { work, calls } = writer();
      expect(await finalizePlaceWrite(sequelize, gone, { sourceSetId: setA, work })).toEqual({
        outcome: O.EVENT_DELETED, code: 'EVENT_DELETED', message: expect.any(String), attempts: 1,
      });
      expect(await finalizePlaceWrite(sequelize, fx.uuid(), { work })).toMatchObject({ outcome: O.EVENT_DELETED, attempts: 1 });
      expect(calls).toHaveLength(0);
      expect(await venueName(gone)).toBeNull();
    });

    test('an error from work that is no lock conflict: rolled back, thrown as it is, not tried again', async () => {
      const { ev } = await primary();
      const { work, calls } = writer('Never kept');
      const boom = new Error('the write failed');
      await expect(finalizePlaceWrite(sequelize, ev, { sourceSetId: setA, work: async (ctx) => { await work(ctx); throw boom; } })).rejects.toBe(boom);
      expect(calls).toHaveLength(1);
      expect(calls[0].transaction.finished).toBe('rollback');
      expect(await venueName(ev)).toBeNull();
    });

    test('a retryable conflict thrown by work: that attempt wrote nothing, the next one commits; work once per attempt', async () => {
      const { ev } = await primary();
      const first = writer('First try');
      const second = writer('Second try');
      let n = 0;
      const res = await finalizePlaceWrite(sequelize, ev, {
        sourceSetId: setA,
        work: async (ctx) => {
          n += 1;
          if (n === 1) { await first.work(ctx); throw new RetryableConflictError(); }
          return second.work(ctx);
        },
      });
      expect(res).toMatchObject({ outcome: O.OK, attempts: 2, value: { saved: 'Second try' } });
      expect(n).toBe(2);
      expect(first.calls[0].transaction.finished).toBe('rollback');
      expect(await venueName(ev)).toBe('Second try');
    });

    test('it makes no network or provider call (the network guard records no attempt)', async () => {
      const state = networkGuard.getState();
      const before = state.events.length;
      const ok = await primary();
      const locked = await primary({ evaluation: 'accepted' });
      const { work } = writer();
      expect((await finalizePlaceWrite(sequelize, ok.ev, { sourceSetId: setA, work })).outcome).toBe(O.OK);
      expect((await finalizePlaceWrite(sequelize, locked.ev, { sourceSetId: setA, work })).outcome).toBe(O.PLACE_LOCKED);
      expect((await finalizePlaceWrite(sequelize, ok.ev, { sourceSetId: setB, work })).outcome).toBe(O.STALE_SOURCE_SET);
      expect((await finalizePlaceWrite(sequelize, fx.uuid(), { work })).outcome).toBe(O.EVENT_DELETED);
      const mine = state.events.slice(before);
      expect(mine.filter((e) => e.type === 'attempt')).toEqual([]);
      expect(mockAnthropic).not.toHaveBeenCalled(); // no completion has run yet in this file
    });
  });

  describe('retries', () => {
    const isLinkedRead = (rec, sql) => Boolean(rec.txId) && /FROM episodes e WHERE e\.deleted_at IS NULL AND \(e\.id = \(SELECT w\.used_in_episode_id/.test(sql);

    test('the links change between the read and the locks: tried again, then OK; work called once', async () => {
      const { ep, ev } = await primary();
      const later = await mkEpisode(show);
      const { work, calls } = writer();
      const g = gateOn(isLinkedRead);
      const fin = settle(finalizePlaceWrite(sequelize, ev, { sourceSetId: setA, work }));
      await g.reached; // attempt 1 has read [ep]
      await mkBrief(show, later, ev); // a draft's Brief now names the event
      g.open();
      const res = await fin;
      expect(res.value).toMatchObject({ outcome: O.OK, attempts: 2 });
      expect(calls).toHaveLength(1);
      // Attempt 1 locked only what it read, found the new link unheld, and rolled back.
      const txs = [...trace.byTransaction().values()].filter((recs) => recs.some((r) => r.kind === 'lock' && r.table === 'episodes'));
      expect(txs).toHaveLength(2);
      expect(txs[0].find((r) => r.kind === 'lock' && r.table === 'episodes').ids).toEqual([ep]);
      expect(txs[0][txs[0].length - 1].kind).toBe('rollback');
      expect(txs[1].find((r) => r.kind === 'lock' && r.table === 'episodes').ids).toEqual([ep, later].sort());
      expect(txs[1][txs[1].length - 1].kind).toBe('commit');
    });

    test('the link that appeared is an accepted episode\'s: the retry checks the Place lock again and refuses', async () => {
      const { ev } = await primary();
      const accepted = await mkEpisode(show, { evaluation: 'accepted' });
      const { work, calls } = writer();
      const g = gateOn(isLinkedRead);
      const fin = settle(finalizePlaceWrite(sequelize, ev, { sourceSetId: setA, work }));
      await g.reached;
      await mkBrief(show, accepted, ev);
      g.open();
      expect((await fin).value).toMatchObject({ outcome: O.PLACE_LOCKED, attempts: 2 });
      expect(calls).toHaveLength(0);
    });

    test('with one attempt allowed, a changed link is retry exhaustion: nothing saved', async () => {
      const { ev } = await primary();
      const later = await mkEpisode(show);
      const { work, calls } = writer();
      const g = gateOn(isLinkedRead);
      const fin = settle(finalizePlaceWrite(sequelize, ev, { sourceSetId: setA, work, maxAttempts: 1 }));
      await g.reached;
      await mkBrief(show, later, ev);
      g.open();
      expect((await fin).value).toEqual({
        outcome: O.RETRY_EXHAUSTED, code: 'PLACE_FINALIZE_RETRY_EXHAUSTED', message: expect.stringMatching(/Nothing was saved/), attempts: 1, last_conflict: 'EVENT_LINK_CHANGED',
      });
      expect(calls).toHaveLength(0);
    });

    test('no linked episode and the event row held elsewhere: every wait ends at the timeout; exhausted after 3 attempts; work never called', async () => {
      const ev = await mkEvent(show, { set: setA });
      const holder = await holdTransaction();
      await sequelize.query('SELECT id FROM world_events WHERE id = :ev FOR UPDATE', { replacements: { ev }, transaction: holder });
      const { work, calls } = writer();
      const t = tracing();
      const started = Date.now();
      // lockTimeout is the helper's test seam; it defaults to LOCK_TIMEOUT (10s), asserted above.
      const res = await finalizePlaceWrite(sequelize, ev, { sourceSetId: setA, work, lockTimeout: '300ms' });
      const elapsed = Date.now() - started;
      expect(res).toEqual({
        outcome: O.RETRY_EXHAUSTED, code: 'PLACE_FINALIZE_RETRY_EXHAUSTED', message: expect.stringMatching(/Nothing was saved/), attempts: 3, last_conflict: '55P03',
      });
      expect(calls).toHaveLength(0);
      expect(t.records.filter((r) => r.error === '55P03')).toHaveLength(3);
      expect(elapsed).toBeGreaterThanOrEqual(850);
      expect(elapsed).toBeLessThan(8000);
      await holder.rollback();
      expect(await venueName(ev)).toBeNull();
      // Free again: it saves.
      expect(await finalizePlaceWrite(sequelize, ev, { sourceSetId: setA, work })).toMatchObject({ outcome: O.OK, attempts: 1 });
    });

    test('a real lock timeout (55P03) on attempt 1, then success on attempt 2: work called once in all', async () => {
      const { ev } = await primary();
      const holder = await holdTransaction();
      await sequelize.query('SELECT id FROM world_events WHERE id = :ev FOR UPDATE', { replacements: { ev }, transaction: holder });
      const { work, calls } = writer();
      const t = tracing();
      const fin = settle(finalizePlaceWrite(sequelize, ev, { sourceSetId: setA, work, lockTimeout: '1500ms' }));
      await waitForLockWait(sequelize, `%FROM world_events WHERE id = %${ev}%FOR UPDATE%`);
      // Attempt 1 times out; the holder lets go as soon as it has.
      const end = Date.now() + 10000;
      while (!t.records.some((r) => r.error === '55P03')) {
        if (Date.now() > end) throw new Error('attempt 1 never timed out');
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
      await holder.rollback();
      const res = await fin;
      expect(res.value).toMatchObject({ outcome: O.OK, attempts: 2 });
      expect(t.records.filter((r) => r.error === '55P03')).toHaveLength(1);
      expect(calls).toHaveLength(1);
      expect(await venueName(ev)).toBe('Finalised');
    });
  });

  describe.each([
    ['its primary event (stamp and Brief)', primary],
    ['an event linked by its stamp alone (no Brief names it)', stampOnly],
  ])('against a real acceptance of the episode, for %s', (_name, make) => {
    test('the finalizer first: it commits, the acceptance waits for it and then succeeds', async () => {
      const { ep, ev } = await make();
      const inWork = latch();
      const hold = latch();
      const { work, calls } = writer();
      const fin = settle(finalizePlaceWrite(sequelize, ev, {
        sourceSetId: setA,
        work: async (ctx) => { inWork.open(); await hold.wait; return work(ctx); },
      }));
      await inWork.wait; // the episode is held FOR SHARE, the event row FOR UPDATE
      const acceptance = settle(completeEpisode(ep, show, sequelize));
      const waiter = await waitForLockWait(sequelize, `%episodes%${ep}%`);
      expect(waiter.query).toMatch(/episodes/);
      expect(await evaluationOf(ep)).not.toBe('accepted');
      hold.open();
      const [f, a] = await Promise.all([fin, acceptance]);
      expect(f.value).toMatchObject({ outcome: O.OK, attempts: 1 });
      expect(a.lock).toBeFalsy();
      if (!a.ok) throw a.error;
      expect(calls).toHaveLength(1);
      expect(await venueName(ev)).toBe('Finalised');
      expect(await evaluationOf(ep)).toBe('accepted');
      expect(await isPlaceLocked(sequelize, ev)).toBe(true);
    });

    test('the acceptance first: the finalizer waits for it, then answers PLACE_LOCKED; work not called', async () => {
      const { ep, ev } = await make();
      const { work, calls } = writer();
      const g = gateOn((rec) => Boolean(rec.txId) && rec.kind === 'lock' && rec.table === 'episodes' && rec.mode === 'update');
      const acceptance = settle(completeEpisode(ep, show, sequelize));
      await Promise.race([g.reached, acceptance]); // the acceptance holds its episode FOR UPDATE
      const fin = settle(finalizePlaceWrite(sequelize, ev, { sourceSetId: setA, work }));
      await waitForLockWait(sequelize, `%FROM episodes WHERE id IN%${ep}%FOR SHARE%`);
      g.open();
      const [f, a] = await Promise.all([fin, acceptance]);
      if (!a.ok) throw a.error;
      expect(f.value).toMatchObject({ outcome: O.PLACE_LOCKED, attempts: 1 });
      expect(calls).toHaveLength(0);
      expect(await venueName(ev)).not.toBe('Finalised');
      expect(await evaluationOf(ep)).toBe('accepted');
    });
  });

  describe('against a real two-part special', () => {
    /** Made by the season routes and Start Episode: { show, ev, partOne, partTwo }. */
    async function twoParter() {
      const seasonShow = await mkShow('Place finalizer season');
      const { arc_id: arcId } = await seedArc(seasonShow, models);
      const set = await mkSet(seasonShow, 'Two-part set');
      const ev = await mkEvent(seasonShow, { name: 'The Finale Gala', set });
      const slotId = async (n) => (await rows('SELECT id FROM season_slots WHERE arc_id = :arcId AND slot_number = :n', { arcId, n }))[0].id;
      const asEditor = (r) => r.set('Authorization', `Bearer ${editorToken}`);
      expect((await asEditor(request(app).put(`/api/v1/world/${seasonShow}/season/slots/${await slotId(12)}/event`)).send({ event_id: ev })).status).toBe(200);
      const made = await asEditor(request(app).post(`/api/v1/world/${seasonShow}/season/two-parters`)).send({ slot_id: await slotId(12) });
      expect(made.status).toBe(201);
      const one = await auth(request(app).post(`/api/v1/world/${seasonShow}/events/${ev}/generate-episode`)).send({ draft_script: false });
      expect(one.status).toBe(201);
      const two = await asEditor(request(app).post(`/api/v1/world/${seasonShow}/season/two-parters/${made.body.data.id}/part-two`));
      expect(two.status).toBe(201);
      return { show: seasonShow, set, ev, partOne: one.body.data.episode.id, partTwo: two.body.data.episode.id };
    }

    test('Part 2\'s bare UPDATE waits on a FOR SHARE lock on Part 2; the window (Part 1 accepted, Part 2 not) is locked, and the finalizer refuses in it', async () => {
      const w = await twoParter();
      // The lock the finalizer takes on every linked episode, held here on Part 2 alone.
      const holder = await holdTransaction();
      await lockEpisodes(sequelize, [w.partTwo], { transaction: holder, mode: 'share' });
      const acceptance = settle(completeEpisode(w.partTwo, w.show, sequelize));
      const waiter = await waitForLockWait(sequelize, `%UPDATE episodes SET evaluation_status = %accepted%${w.partTwo}%`);
      expect(waiter.query).toMatch(/WHERE id = '?[0-9a-f-]{36}'? AND deleted_at IS NULL AND evaluation_status IS DISTINCT FROM 'accepted'/);
      // The real window: Part 1's completion is committed, Part 2's UPDATE is waiting.
      expect(await evaluationOf(w.partOne)).toBe('accepted');
      expect(await evaluationOf(w.partTwo)).not.toBe('accepted');
      expect((await findTermsLockEpisode(sequelize, w.ev)).id).toBe(w.partTwo); // the one episode the old rule asked: a draft
      expect(await isPlaceLocked(sequelize, w.ev)).toBe(true);
      const { work, calls } = writer();
      expect(await finalizePlaceWrite(sequelize, w.ev, { sourceSetId: w.set, work })).toMatchObject({ outcome: O.PLACE_LOCKED, attempts: 1 });
      expect(calls).toHaveLength(0);
      await holder.rollback();
      const a = await acceptance;
      if (!a.ok) throw a.error;
      expect(await evaluationOf(w.partTwo)).toBe('accepted');
    });

    test('the finalizer first, both parts drafts: it commits; the two-part completion waits for it and then accepts both', async () => {
      const w = await twoParter();
      const inWork = latch();
      const hold = latch();
      const { work, calls } = writer();
      const fin = settle(finalizePlaceWrite(sequelize, w.ev, {
        sourceSetId: w.set,
        work: async (ctx) => { inWork.open(); await hold.wait; return work(ctx); },
      }));
      await inWork.wait;
      const acceptance = settle(completeEpisode(w.partTwo, w.show, sequelize));
      await waitForLockWait(sequelize, `%episodes%${w.partOne}%`);
      expect([await evaluationOf(w.partOne), await evaluationOf(w.partTwo)]).not.toContain('accepted');
      hold.open();
      const [f, a] = await Promise.all([fin, acceptance]);
      expect(f.value).toMatchObject({ outcome: O.OK, attempts: 1 });
      expect(a.lock).toBeFalsy();
      if (!a.ok) throw a.error;
      expect(calls).toHaveLength(1);
      expect([await evaluationOf(w.partOne), await evaluationOf(w.partTwo)]).toEqual(['accepted', 'accepted']);
      expect((await finalizePlaceWrite(sequelize, w.ev, { sourceSetId: w.set, work })).outcome).toBe(O.PLACE_LOCKED);
    });
  });

  describe('against an event-first writer: the event PUT changing the scene set (its INSERT of the episode\'s Event location)', () => {
    const put = (ev, body) => settle(auth(request(app).put(`/api/v1/world/${show}/events/${ev}`)).send(body).then((res) => res));
    const eventLocations = (ep) => rows("SELECT scene_set_id FROM scene_set_episodes WHERE episode_id = :ep AND role = 'event' AND deleted_at IS NULL", { ep });

    test('the PUT first (holding the event row and its foreign-key lock on the episode): no deadlock; the finalizer then refuses the stale set', async () => {
      const { ep, ev } = await primary();
      expect(await eventLocations(ep)).toEqual([]);
      const { work, calls } = writer();
      const g = gateOn((rec, sql) => Boolean(rec.txId) && /^INSERT INTO scene_set_episodes/.test(sql));
      const saving = put(ev, { scene_set_id: setB });
      await Promise.race([g.reached, saving]);
      const fin = settle(finalizePlaceWrite(sequelize, ev, { sourceSetId: setA, work }));
      // The episode's FOR SHARE did not wait on the foreign-key lock: the finalizer is at the event row.
      await waitForLockWait(sequelize, `%FROM world_events WHERE id = %${ev}%FOR UPDATE%`);
      g.open();
      const [f, s] = await Promise.all([fin, saving]);
      expect(s.ok && s.value.status).toBe(200);
      expect(f.lock).toBeFalsy();
      expect(f.value).toMatchObject({ outcome: O.STALE_SOURCE_SET, source_set_id: setA, scene_set_id: setB, attempts: 1 });
      expect(calls).toHaveLength(0);
      expect((await eventRow(ev)).scene_set_id).toBe(setB);
      expect(await eventLocations(ep)).toEqual([{ scene_set_id: setB }]);
    });

    test('the finalizer first: no deadlock; it commits, then the PUT saves', async () => {
      const { ep, ev } = await primary();
      const inWork = latch();
      const hold = latch();
      const { work, calls } = writer();
      const fin = settle(finalizePlaceWrite(sequelize, ev, {
        sourceSetId: setA,
        work: async (ctx) => { inWork.open(); await hold.wait; return work(ctx); },
      }));
      await inWork.wait;
      const saving = put(ev, { scene_set_id: setB });
      await waitForLockWait(sequelize, `%world_events%${ev}%`);
      hold.open();
      const [f, s] = await Promise.all([fin, saving]);
      expect(f.value).toMatchObject({ outcome: O.OK, attempts: 1 });
      expect(s.ok && s.value.status).toBe(200);
      expect(calls).toHaveLength(1);
      expect(await eventRow(ev)).toMatchObject({ scene_set_id: setB, venue_name: 'Finalised' });
      expect(await eventLocations(ep)).toEqual([{ scene_set_id: setB }]);
    });
  });
});
