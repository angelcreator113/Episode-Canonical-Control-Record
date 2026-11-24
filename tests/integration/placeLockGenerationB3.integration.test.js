/**
 * Generation B3 (Evoni, 2026-11-23;
 * docs/audit/F-AUTH-1_PlaceLockGenerationB3_Amendment_2026-11-23.md): the
 * episode Locations save and Start Episode's locations take the Place
 * finalizer's rows in its order.
 *
 *   - a Locations save that moves its event to another set is committed by
 *     finalizePlaceWrite (the strict Place lock; the event still at the set
 *     the save read);
 *   - any other Locations save is one transaction in the same order (the
 *     episode FOR SHARE, the event row, the sets FOR KEY SHARE NOWAIT), and
 *     never rewrites the event's set;
 *   - Start Episode says which set its Locations step showed for the event,
 *     is refused when the event has another, and saves its locations after
 *     its commit through the finalizer; a refusal there is a failed setup
 *     step, not a silent overwrite.
 *
 * On the migrated test database, through the real app, against the real
 * acceptance (completeEpisode, a real two-part completion), the real event
 * PUT and the real makeEventVersion and makeEveryday.
 *
 * REAL LOCKS and INJECTED ERRORS. Every case marked [real lock] holds a real
 * PostgreSQL row lock in another transaction (or races two real writers) and
 * observes the conflict the database raises (55P03) or the wait
 * (pg_stat_activity). The cases marked [injected] make one statement throw,
 * to prove the rollback: no lock is involved in them. Nothing here sleeps to
 * wait for a lock, and nothing sends DDL.
 */
jest.unmock('uuid');

const mockAnthropic = jest.fn(async () => { throw new Error('the model is not called in the Generation B3 races'); });
jest.mock('@anthropic-ai/sdk', () => jest.fn(() => ({ messages: { create: mockAnthropic } })));
jest.mock('axios', () => {
  const actual = jest.requireActual('axios');
  return { ...actual, post: jest.fn(async () => { throw new Error('no provider in this suite'); }), get: jest.fn(async () => { throw new Error('no provider in this suite'); }), create: actual.create };
});
const mockS3Send = jest.fn(async () => ({}));
jest.mock('@aws-sdk/client-s3', () => {
  const actual = jest.requireActual('@aws-sdk/client-s3');
  return { ...actual, S3Client: jest.fn(() => ({ send: mockS3Send })) };
});

const request = require('supertest');
const app = require('../../src/app');
const TokenService = require('../../src/services/tokenService');
const models = require('../../src/models');
const placeLock = require('../../src/utils/placeLock');
const { isLockConflict } = require('../../src/utils/episodeLocks');
const { completeEpisode } = require('../../src/services/episodeCompletionService');
const { seedArc } = require('../../src/services/arcProgressionService');
const { makeEventVersion, makeEveryday } = require('../../src/services/sceneSetVersionService');
const sceneGen = require('../../src/services/sceneGenerationService');
const lockTrace = require('../helpers/lockTrace');
const networkGuard = require('../networkGuard/core');
const { placeLockFixtures, waitForLockWait } = require('../helpers/placeLockFixtures');

const { sequelize } = models;
const { PLACE_LOCKED_CODE, PLACE_LOCKED_MESSAGE } = placeLock;
const DELAY = sceneGen.PLACE_FINALIZE_RETRY_DELAY_MS;

const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const STALE_MESSAGE = "This event's scene set changed while this was being made. Nothing was saved over the newer choice.";
const EXHAUSTED_MESSAGE = 'This could not be saved: the event or its episode was busy on every try. Nothing was saved.';
const BUSY_MESSAGE = 'Someone else changed this at the same moment. Nothing was saved: try again.';
const ACCEPTED = { success: false, code: 'EPISODE_ACCEPTED', error: 'This episode is accepted: its locations are locked' };
const LOCKED = { success: false, code: PLACE_LOCKED_CODE, error: PLACE_LOCKED_MESSAGE };
const STALE = { success: false, code: 'STALE_SOURCE_SET', error: STALE_MESSAGE };
const databaseError = () => Object.assign(new Error('violates foreign key constraint "x_fkey"'), { name: 'SequelizeForeignKeyConstraintError', original: { code: '23503' } });

const open = [];
const settle = (promise) => promise.then(
  (value) => ({ ok: true, value }),
  (error) => ({ ok: false, error, lock: isLockConflict(error) ? (error.original?.code || error.parent?.code || error.code) : null }));
const send = (req) => req.then((res) => res);
const flat = (sql) => String(sql).replace(/\s+/g, ' ').trim();

(shouldSkip ? describe.skip : describe)('Generation B3: the Locations save and Start Episode take the Place finalizer\'s rows in its order', () => {
  jest.setTimeout(Number(process.env.GENB3_TEST_TIMEOUT_MS) || 90000);
  const fx = placeLockFixtures(sequelize, models);
  const { run, rows, mkShow, mkEpisode, mkEvent, mkBrief, mkSet, evaluationOf, eventRow } = fx;
  const TAG = fx.uuid().slice(0, 8);
  let show;
  let editorToken;
  let trace = null;
  let pause = null;
  let guardEventsAtStart = 0;
  let w; // the sets of the test's show

  let admins = 0;
  const adminToken = () => {
    admins += 1;
    return TokenService.generateTokenPair({ id: `genb3-admin-${TAG}-${admins}`, email: `admin${admins}@genb3.dev`, name: 'Admin', groups: ['ADMIN'], role: 'ADMIN' }).accessToken;
  };
  const asAdmin = (r) => r.set('X-Forwarded-For', `10.96.${Math.floor(admins / 250)}.${(admins % 250) + 1}`).set('Authorization', `Bearer ${adminToken()}`);
  const save = (ep, locations) => asAdmin(request(app).put(`/api/v1/episodes/${ep}/locations`)).send({ locations });
  const start = (ev, body = {}, showId = show) => asAdmin(request(app).post(`/api/v1/world/${showId}/events/${ev}/generate-episode`)).send({ draft_script: false, ...body });
  const putEvent = (ev, body, showId = show) => asAdmin(request(app).put(`/api/v1/world/${showId}/events/${ev}`)).send(body);
  const loc = (role, id, name = null) => ({ role, scene_set_id: id, ...(name ? { name } : {}) });

  // ── Fixtures ───────────────────────────────────────────────────────────
  const set = (name, type, showId = show) => mkSet(showId, `${name} ${fx.uuid().slice(0, 6)}`, { scene_type: type, base_still_url: `https://cdn.example/${fx.uuid()}.jpg` });
  async function world(showId = show) {
    return {
      home: await set('Home', 'HOME_BASE', showId), home2: await set('Second home', 'HOME_BASE', showId), closet: await set('Closet', 'CLOSET', showId),
      a: await set('Hall A', 'EVENT_LOCATION', showId), b: await set('Hall B', 'EVENT_LOCATION', showId), c: await set('Hall C', 'EVENT_LOCATION', showId),
    };
  }
  /** A draft episode and its primary event (stamp and Brief) at set A, with its locations and two beats at home. */
  async function primary({ evaluation = 'pending' } = {}) {
    const ep = await mkEpisode(show);
    const ev = await mkEvent(show, { stamp: ep, set: w.a });
    await mkBrief(show, ep, ev);
    await place(ep);
    if (evaluation === 'accepted') await fx.setEvaluation(ep, 'accepted');
    return { ep, ev };
  }
  async function stampOnly() {
    const ep = await mkEpisode(show);
    const ev = await mkEvent(show, { stamp: ep, set: w.a });
    await place(ep);
    return { ep, ev };
  }
  /** The episode's stored locations (event A, home) and two beats at home: one free, one locked. */
  async function place(ep, sets = w) {
    for (const [i, [role, id]] of [['event', sets.a], ['home', sets.home]].entries()) {
      await run(`INSERT INTO scene_set_episodes (id, scene_set_id, episode_id, sort_order, role, created_at, updated_at)
                 VALUES (:id, :set, :ep, :i, :role, NOW(), NOW())`, { id: fx.uuid(), set: id, ep, i, role });
    }
    for (const [n, locked] of [[1, false], [2, true]]) {
      await run(`INSERT INTO scene_plans (id, episode_id, beat_number, beat_name, scene_set_id, angle_label, locked, chosen_by_user, sort_order, ai_suggested, created_at, updated_at)
                 VALUES (:id, :ep, :n, 'Beat', :at, 'WIDE', :locked, false, :n, false, NOW(), NOW())`, { id: fx.uuid(), ep, n, at: sets.home, locked });
    }
  }
  const links = (ep) => rows('SELECT scene_set_id, role, role_name FROM scene_set_episodes WHERE episode_id = :ep AND deleted_at IS NULL ORDER BY sort_order', { ep });
  const beats = (ep) => rows('SELECT beat_number, scene_set_id, angle_label FROM scene_plans WHERE episode_id = :ep AND deleted_at IS NULL AND beat_number IN (1, 2) ORDER BY beat_number', { ep });
  const episodeOf = async (ev) => (await eventRow(ev)).used_in_episode_id;
  const episodeRow = async (ep) => (await rows('SELECT * FROM episodes WHERE id = :ep', { ep }))[0] || null;
  async function snapshot(showId = show) {
    const by = { showId };
    return {
      events: await rows('SELECT * FROM world_events WHERE show_id = :showId ORDER BY id', by),
      sets: await rows('SELECT * FROM scene_sets WHERE show_id = :showId ORDER BY id', by),
      links: await rows('SELECT l.* FROM scene_set_episodes l JOIN episodes e ON e.id = l.episode_id WHERE e.show_id = :showId ORDER BY l.id', by),
      plans: await rows('SELECT p.* FROM scene_plans p JOIN episodes e ON e.id = p.episode_id WHERE e.show_id = :showId ORDER BY p.id', by),
      episodes: await rows('SELECT id, evaluation_status, deleted_at FROM episodes WHERE show_id = :showId ORDER BY id', by),
    };
  }
  async function accept(ep, showId = show) {
    const a = await settle(completeEpisode(ep, showId, sequelize));
    if (!a.ok) throw a.error;
    expect(await evaluationOf(ep)).toBe('accepted');
  }
  async function holdTransaction() {
    const transaction = await sequelize.transaction();
    open.push(async () => { if (!transaction.finished) await transaction.rollback(); });
    return transaction;
  }
  /** [real lock] Another transaction holding a set row, with its backend pid. */
  async function holdSetRow(id, how = 'FOR UPDATE') {
    const holder = await holdTransaction();
    const [[me]] = await sequelize.query('SELECT pg_backend_pid() AS pid', { transaction: holder });
    if (how === 'UPDATE') await sequelize.query('UPDATE scene_sets SET updated_at = updated_at WHERE id = :id', { replacements: { id }, transaction: holder });
    else await sequelize.query(`SELECT id FROM scene_sets WHERE id = :id ${how}`, { replacements: { id }, transaction: holder });
    return { holder, pid: me.pid };
  }
  const inTransaction = (pid) => rows(
    `SELECT pid FROM pg_stat_activity
      WHERE datname = current_database() AND pid NOT IN (pg_backend_pid(), :pid) AND state LIKE 'idle in transaction%'`, { pid });
  function tracing() {
    trace = lockTrace.install(sequelize);
    return trace;
  }
  function gateOn(predicate) {
    const g = (trace || tracing()).gate(predicate);
    open.push(async () => g.open());
    return g;
  }
  const lockErrors = (records) => records.filter((r) => r.error === '55P03' || r.error === '40P01').map((r) => r.error);
  const acceptanceHoldsEpisode = () => gateOn((rec) => Boolean(rec.txId) && rec.kind === 'lock' && rec.table === 'episodes' && rec.mode === 'update');
  /** The save (or Start) holding the event row, before it takes its set rows. */
  const holdsEventRow = () => gateOn((rec) => Boolean(rec.txId) && rec.kind === 'lock' && rec.table === 'world_events');
  /** The save holding its set rows too. */
  const holdsSetRows = () => gateOn((rec) => Boolean(rec.txId) && rec.kind === 'lock' && rec.table === 'scene_sets');
  /** The Locations save just after it read its event (its snapshot), before any lock. */
  const readItsEvent = () => gateOn((rec, sql) => !rec.txId && /^SELECT id, scene_set_id FROM world_events WHERE id = \(SELECT COALESCE/.test(sql));
  /** [injected] Makes the first statement in a transaction whose text matches throw as the database would. */
  function failStatement(pattern) {
    const real = sequelize.query.bind(sequelize);
    return jest.spyOn(sequelize, 'query').mockImplementation((sql, options) => {
      if (options?.transaction && pattern.test(flat(sql))) return Promise.reject(databaseError());
      return real(sql, options);
    });
  }
  async function twoParter() {
    const seasonShow = await mkShow('Generation B3 season');
    const { arc_id: arcId } = await seedArc(seasonShow, models);
    const sets = await world(seasonShow);
    const ev = await mkEvent(seasonShow, { name: 'The Finale Gala', set: sets.a });
    const slotId = async (n) => (await rows('SELECT id FROM season_slots WHERE arc_id = :arcId AND slot_number = :n', { arcId, n }))[0].id;
    const asEditor = (r) => r.set('Authorization', `Bearer ${editorToken}`);
    expect((await asEditor(request(app).put(`/api/v1/world/${seasonShow}/season/slots/${await slotId(12)}/event`)).send({ event_id: ev })).status).toBe(200);
    const made = await asEditor(request(app).post(`/api/v1/world/${seasonShow}/season/two-parters`)).send({ slot_id: await slotId(12) });
    expect(made.status).toBe(201);
    const one = await start(ev, {}, seasonShow);
    expect(one.status).toBe(201);
    const two = await asEditor(request(app).post(`/api/v1/world/${seasonShow}/season/two-parters/${made.body.data.id}/part-two`));
    expect(two.status).toBe(201);
    return { show: seasonShow, sets, ev, partOne: one.body.data.episode.id, partTwo: two.body.data.episode.id };
  }

  beforeAll(async () => {
    guardEventsAtStart = networkGuard.getState().events.length;
    editorToken = TokenService.generateTokenPair({ id: `genb3-editor-${TAG}`, email: 'editor@genb3.dev', name: 'Editor', groups: ['USER', 'EDITOR'], role: 'USER' }).accessToken;
  });
  beforeEach(async () => {
    show = await mkShow('Generation B3');
    w = await world();
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    pause = jest.spyOn(placeLock.finalizePlaceWrite.retryPause, 'sleep');
  });
  afterEach(async () => {
    for (const close of open.splice(0).reverse()) await close();
    if (trace) {
      trace.uninstall();
      trace = null;
    }
    jest.restoreAllMocks();
  });
  afterAll(async () => {
    await new Promise((resolve) => setTimeout(resolve, 500)); // after-commit work of completions and Starts
    if (fx.made.sets.length) await run('DELETE FROM scene_angles WHERE scene_set_id IN (:ids)', { ids: fx.made.sets });
    await fx.cleanup();
  });

  // ══ The Locations save ═════════════════════════════════════════════════
  describe('a Locations save that leaves the event\'s set as it is (home, closet, extras)', () => {
    test('saved with the same 200 body; one transaction: the episode FOR SHARE, the event row, the sets FOR KEY SHARE NOWAIT, then the writes; the event row is not rewritten', async () => {
      const { ep, ev } = await primary();
      const event = await eventRow(ev);
      const t = tracing();
      const res = await save(ep, [loc('event', w.a), loc('home', w.home2), loc('closet', w.closet), loc('extra', w.c, 'Car')]);
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ success: true, data: { locations: [
        { role: 'event', scene_set_id: w.a, name: null, scene_set: expect.objectContaining({ id: w.a }), angle_count: 0 },
        { role: 'home', scene_set_id: w.home2, name: null, scene_set: expect.objectContaining({ id: w.home2 }), angle_count: 0 },
        { role: 'closet', scene_set_id: w.closet, name: null, scene_set: expect.objectContaining({ id: w.closet }), angle_count: 0 },
        { role: 'extra', scene_set_id: w.c, name: 'Car', scene_set: expect.objectContaining({ id: w.c }), angle_count: 0 },
      ] } });
      // The free beat moved with the home, its angle cleared; the locked beat stayed.
      expect(await beats(ep)).toEqual([
        { beat_number: 1, scene_set_id: w.home2, angle_label: null },
        { beat_number: 2, scene_set_id: w.home, angle_label: 'WIDE' },
      ]);
      expect(await eventRow(ev)).toEqual(event); // updated_at included
      const write = t.records.find((r) => r.kind === 'write' && r.table === 'scene_plans');
      const inTx = t.records.filter((r) => r.txId === write.txId);
      expect(lockTrace.classSequence(inTx).slice(0, 3)).toEqual(['E:episodes:share', 'W:world_events:update', 'X:scene_sets:share']);
      const setLock = inTx.find((r) => r.kind === 'lock' && r.table === 'scene_sets');
      expect(setLock.sql).toMatch(/ORDER BY id FOR KEY SHARE NOWAIT$/);
      expect(setLock.ids).toEqual([w.a, w.home2, w.closet, w.c].sort());
      expect(inTx.filter((r) => r.kind === 'write' && r.table === 'world_events')).toEqual([]);
      expect(inTx.at(-1).kind).toBe('commit');
      expect(pause).not.toHaveBeenCalled();
    });

    test('an episode with no event: saved, with no event lock', async () => {
      const ep = await mkEpisode(show);
      const t = tracing();
      const res = await save(ep, [loc('home', w.home)]);
      expect(res.status).toBe(200);
      const insert = t.records.find((r) => r.kind === 'insert' && r.table === 'scene_set_episodes');
      expect(lockTrace.classSequence(t.records.filter((r) => r.txId === insert.txId))).toEqual(['E:episodes:share', 'X:scene_sets:share', 'X:scene_set_episodes:write']);
    });

    test('on a draft whose event\'s Place is locked by another, accepted episode: the home edit is saved and the event is untouched; moving the event is 409 PLACE_LOCKED and writes nothing', async () => {
      const { ep, ev } = await primary();
      // Another episode's Brief names the event, and that episode is accepted: the Place is locked.
      const other = await mkEpisode(show, { evaluation: 'accepted' });
      await mkBrief(show, other, ev, { agoMinutes: 10 });
      expect(await placeLock.isPlaceLocked(sequelize, ev)).toBe(true);
      const event = await eventRow(ev);
      const home = await save(ep, [loc('event', w.a), loc('home', w.home2)]);
      expect(home.status).toBe(200);
      expect(await links(ep)).toEqual([{ scene_set_id: w.a, role: 'event', role_name: null }, { scene_set_id: w.home2, role: 'home', role_name: null }]);
      expect(await eventRow(ev)).toEqual(event);

      const before = await snapshot();
      const moved = await save(ep, [loc('event', w.b), loc('home', w.home)]);
      expect(moved.status).toBe(409);
      expect(moved.body).toEqual(LOCKED);
      expect(await snapshot()).toEqual(before);
    });
  });

  describe('a Locations save that moves the event to another set', () => {
    test('saved through the Place finalizer: the linked episode FOR SHARE, the event row, the set rows, then the writes with the event\'s move', async () => {
      const { ep, ev } = await primary();
      const t = tracing();
      const res = await save(ep, [loc('event', w.b), loc('home', w.home)]);
      expect(res.status).toBe(200);
      expect(res.body.data.locations.map((l) => [l.role, l.scene_set_id])).toEqual([['event', w.b], ['home', w.home]]);
      expect((await eventRow(ev)).scene_set_id).toBe(w.b);
      const move = t.records.find((r) => r.kind === 'write' && r.table === 'world_events');
      const inTx = t.records.filter((r) => r.txId === move.txId);
      expect(lockTrace.classSequence(inTx).slice(0, 3)).toEqual(['E:episodes:share', 'W:world_events:update', 'X:scene_sets:share']);
      expect(inTx.filter((r) => ['insert', 'write'].includes(r.kind) && r.table === 'scene_set_episodes').length).toBeGreaterThan(0);
      expect(inTx.at(-1).kind).toBe('commit');
    });

    test.each([
      ['the beats', /UPDATE scene_plans SET scene_set_id/],
      ['the links no longer chosen', /UPDATE scene_set_episodes SET deleted_at/],
      ['the links', /INSERT INTO scene_set_episodes/],
      ['the event', /UPDATE world_events SET scene_set_id/],
    ])('[injected] the save failing at %s: everything rolled back, the route\'s 500', async (_name, pattern) => {
      const { ep } = await primary();
      const before = await snapshot();
      failStatement(pattern);
      const res = await save(ep, [loc('event', w.b), loc('home', w.home2)]); // moves the event, the home and its beat; drops no link but rewrites all
      jest.restoreAllMocks();
      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
      expect(await snapshot()).toEqual(before);
    });
  });

  // ══ Acceptance ═════════════════════════════════════════════════════════
  describe.each([
    ['its primary event (stamp and Brief)', primary],
    ['an event linked by its stamp alone (non-primary)', stampOnly],
  ])('a real acceptance and a Locations save, for %s', (_name, make) => {
    test('accepted before the save: 409 EPISODE_ACCEPTED in the same words, for a home edit and for an event move; nothing written', async () => {
      const { ep } = await make();
      await accept(ep);
      const before = await snapshot();
      for (const body of [[loc('event', w.a), loc('home', w.home2)], [loc('event', w.b), loc('home', w.home)]]) {
        const res = await save(ep, body);
        expect(res.status).toBe(409);
        expect(res.body).toEqual(ACCEPTED);
      }
      expect(await snapshot()).toEqual(before);
    });

    test('[real lock] the acceptance holding its episode when the save begins: the save waits for it, then answers EPISODE_ACCEPTED (not PLACE_LOCKED), for both kinds of save', async () => {
      for (const body of [(s) => [loc('event', s.a), loc('home', s.home2)], (s) => [loc('event', s.b), loc('home', s.home)]]) {
        const { ep } = await make();
        const g = acceptanceHoldsEpisode();
        const acceptance = settle(completeEpisode(ep, show, sequelize));
        await Promise.race([g.reached, acceptance]);
        const pending = send(save(ep, body(w)));
        await waitForLockWait(sequelize, `%FROM episodes WHERE id IN%${ep}%FOR SHARE%`);
        g.open();
        const [res, a] = await Promise.all([pending, acceptance]);
        if (!a.ok) throw a.error;
        expect(res.status).toBe(409);
        expect(res.body).toEqual(ACCEPTED);
        expect(await links(ep)).toEqual([{ scene_set_id: w.a, role: 'event', role_name: null }, { scene_set_id: w.home, role: 'home', role_name: null }]);
        trace.uninstall();
        trace = null;
      }
    });

    test('[real lock] the save first: it commits; the acceptance waits for it and then succeeds; no lock conflict', async () => {
      const { ep, ev } = await make();
      const g = holdsSetRows();
      const pending = send(save(ep, [loc('event', w.b), loc('home', w.home2)]));
      await g.reached; // the episode FOR SHARE, the event row and the set rows are held
      const acceptance = settle(completeEpisode(ep, show, sequelize));
      await waitForLockWait(sequelize, `%episodes%${ep}%`);
      expect(await evaluationOf(ep)).not.toBe('accepted');
      g.open();
      const [res, a] = await Promise.all([pending, acceptance]);
      expect(a.lock).toBeFalsy();
      if (!a.ok) throw a.error;
      expect(res.status).toBe(200);
      expect((await eventRow(ev)).scene_set_id).toBe(w.b);
      expect(await evaluationOf(ep)).toBe('accepted');
      expect(lockErrors(trace.records)).toEqual([]);
    });
  });

  test('[real lock] a real two-part special: a home edit on Part 2 is saved before any acceptance; with Part 1 accepted and Part 2 not yet, moving the event is 409 PLACE_LOCKED; once both are accepted, 409 EPISODE_ACCEPTED', async () => {
    const t = await twoParter();
    const s = t.sets;
    const home = await save(t.partTwo, [loc('event', s.a), loc('home', s.home2)]);
    expect(home.status).toBe(200);
    // The real window: Part 2's bare UPDATE waits on a share lock on Part 2 while Part 1's completion is committed.
    const holder = await holdTransaction();
    await sequelize.query('SELECT id FROM episodes WHERE id = :id FOR SHARE', { replacements: { id: t.partTwo }, transaction: holder });
    const acceptance = settle(completeEpisode(t.partTwo, t.show, sequelize));
    await waitForLockWait(sequelize, `%UPDATE episodes SET evaluation_status = %accepted%${t.partTwo}%`);
    expect(await evaluationOf(t.partOne)).toBe('accepted');
    expect(await evaluationOf(t.partTwo)).not.toBe('accepted');
    const before = await snapshot(t.show);
    const moved = await save(t.partTwo, [loc('event', s.b), loc('home', s.home2)]);
    expect(moved.status).toBe(409);
    expect(moved.body).toEqual(LOCKED);
    expect(await snapshot(t.show)).toEqual(before);
    // A home edit on Part 2 is still its own, while it is a draft.
    const stillDraft = await save(t.partTwo, [loc('event', s.a), loc('home', s.home)]);
    expect(stillDraft.status).toBe(200);
    await holder.rollback();
    const a = await acceptance;
    if (!a.ok) throw a.error;
    const after = await save(t.partTwo, [loc('event', s.a), loc('home', s.home2)]);
    expect(after.status).toBe(409);
    expect(after.body).toEqual(ACCEPTED);
  });

  // ══ The event's set changing ═══════════════════════════════════════════
  describe('an event edit that changes the event\'s set (a real event PUT)', () => {
    test('before the save: the save is made against the set the event has when it reads it; choosing that set leaves the event alone, choosing another moves it', async () => {
      const { ep, ev } = await primary();
      expect((await putEvent(ev, { scene_set_id: w.b })).status).toBe(200);
      const event = await eventRow(ev);
      const same = await save(ep, [loc('event', w.b), loc('home', w.home2)]);
      expect(same.status).toBe(200);
      expect(await eventRow(ev)).toEqual(event);
      const back = await save(ep, [loc('event', w.a), loc('home', w.home2)]);
      expect(back.status).toBe(200);
      expect((await eventRow(ev)).scene_set_id).toBe(w.a);
    });

    test.each([
      ['a save that moves the event (the finalizer\'s source check)', (s) => [loc('event', s.b), loc('home', s.home2)]],
      ['a save that leaves the event\'s set (the re-read under the event lock)', (s) => [loc('event', s.a), loc('home', s.home2)]],
    ])('during %s: 409 STALE_SOURCE_SET; nothing written, not run again against the newer set', async (_name, body) => {
      const { ep, ev } = await primary();
      const g = readItsEvent();
      const pending = send(save(ep, body(w)));
      await g.reached; // the save has read "the event is at A"
      expect((await putEvent(ev, { scene_set_id: w.c })).status).toBe(200);
      const before = await snapshot();
      g.open();
      const res = await pending;
      expect(res.status).toBe(409);
      expect(res.body).toEqual(STALE);
      expect(await snapshot()).toEqual(before);
      expect((await eventRow(ev)).scene_set_id).toBe(w.c);
      expect(pause).not.toHaveBeenCalled(); // a refusal is not tried again
    });
  });

  // ══ The set rows: FOR KEY SHARE NOWAIT ═════════════════════════════════
  // C1 PR 2 (Evoni, 2026-11-24;
  // docs/audit/F-AUTH-1_EventWritersEpisodeFirst_Amendment_2026-11-24.md):
  // makeEventVersion and makeEveryday no longer take a set row and then wait
  // for the event row. They take the event's linked episodes (FOR SHARE),
  // then the event row, then their set rows without waiting. The four cases
  // below pinned the old order (the writer seen waiting for the event while
  // holding a set row, the save stepping back from that set row with one
  // 55P03, or the writer waiting for a set row). They now hold the same two
  // real writers against each other and assert what the new order does:
  // the version writer waits for the EVENT row, holding no set row; the two
  // take turns; a set row held elsewhere is stepped back from, never waited
  // for. The safety they asserted is kept: no deadlock, and the state one
  // serial order leaves.
  describe('[real lock] the set rows against the version writers, which take the event row before their set rows', () => {
    /** Whether another session can take this row lock right now (NOWAIT, rolled back at once). */
    async function free(table, id, how = 'FOR UPDATE') {
      const t = await sequelize.transaction();
      try {
        await sequelize.query(`SELECT id FROM ${table} WHERE id = :id ${how} NOWAIT`, { replacements: { id }, transaction: t });
        return true;
      } catch (err) {
        if (isLockConflict(err)) return false;
        throw err;
      } finally {
        await t.rollback();
      }
    }
    const versionOf = async (id) => (await rows('SELECT version_of_set_id FROM scene_sets WHERE id = :id', { id }))[0].version_of_set_id;
    const waitsForEvent = (ev) => waitForLockWait(sequelize, `%FROM world_events WHERE id = %${ev}%FOR UPDATE%`);

    test('makeEventVersion against a save that moves the event (the finalizer), the save holding the event row: the version waits for the event row holding no set row; no deadlock and no lock conflict; the save commits, then the version', async () => {
      const { ep, ev } = await primary();
      const g = holdsEventRow();
      const pending = send(save(ep, [loc('event', w.b), loc('home', w.home)])); // the finalizer path
      await g.reached;
      const version = settle(makeEventVersion(sequelize, { setId: w.b, everydaySetId: w.c, eventId: ev }));
      await waitsForEvent(ev); // episode-first: it holds the episode FOR SHARE (as the save does) and waits here
      // It holds neither of its set rows while it waits.
      expect(await free('scene_sets', w.b)).toBe(true);
      expect(await free('scene_sets', w.c)).toBe(true);
      g.open();
      const [res, v] = await Promise.all([pending, version]);
      expect(v.lock).toBeFalsy();
      if (!v.ok) throw v.error;
      expect(lockErrors(trace.records)).toEqual([]); // no 40P01, and no 55P03 either
      expect(pause).not.toHaveBeenCalled();
      // In turn: the save moved the event to B; the version then made B that event's version of C.
      expect(res.status).toBe(200);
      expect((await eventRow(ev)).scene_set_id).toBe(w.b);
      expect(await versionOf(w.b)).toBe(w.c);
      expect(await links(ep)).toEqual([{ scene_set_id: w.b, role: 'event', role_name: null }, { scene_set_id: w.home, role: 'home', role_name: null }]);
    });

    test('the same against a save that leaves the event\'s set (its own transaction): the version waits for the event row; no deadlock; the save commits, then the version moves the event', async () => {
      const { ep, ev } = await primary();
      const g = holdsEventRow();
      const pending = send(save(ep, [loc('event', w.a), loc('home', w.home2)]));
      await g.reached;
      const version = settle(makeEventVersion(sequelize, { setId: w.home2, everydaySetId: w.c, eventId: ev }));
      await waitsForEvent(ev);
      expect(await free('scene_sets', w.home2)).toBe(true);
      g.open();
      const [res, v] = await Promise.all([pending, version]);
      if (!v.ok) throw v.error;
      expect(lockErrors(trace.records)).toEqual([]);
      expect(pause).not.toHaveBeenCalled();
      expect(res.status).toBe(200);
      // Then the version: the event is held at the set it was made the version of.
      expect((await eventRow(ev)).scene_set_id).toBe(w.home2);
      expect(await versionOf(w.home2)).toBe(w.c);
    });

    test('the save holding the event row and its set rows first: makeEventVersion waits for the event row (not for a set row), then commits; no lock conflict. And a set row held by another episode\'s save: the version steps back from it (55P03, never a wait) and commits on its second try', async () => {
      const { ep, ev } = await primary();
      const g = holdsSetRows();
      const pending = send(save(ep, [loc('event', w.a), loc('home', w.home2)]));
      await g.reached;
      const version = settle(makeEventVersion(sequelize, { setId: w.home2, everydaySetId: w.c, eventId: ev }));
      await waitsForEvent(ev);
      expect(await rows(
        "SELECT pid FROM pg_stat_activity WHERE datname = current_database() AND wait_event_type = 'Lock' AND query ILIKE '%FROM scene_sets%'")).toEqual([]);
      g.open();
      const [res, v] = await Promise.all([pending, version]);
      if (!v.ok) throw v.error;
      expect(res.status).toBe(200);
      expect(lockErrors(trace.records)).toEqual([]);
      expect(pause).not.toHaveBeenCalled();
      expect((await eventRow(ev)).scene_set_id).toBe(w.home2);
      trace.uninstall();
      trace = null;

      // Another episode's Locations save holds a set row (FOR KEY SHARE) the version needs FOR UPDATE.
      const other = await primary();
      const mine = await primary();
      const held = holdsSetRows();
      const saving = send(save(other.ep, [loc('event', w.a), loc('home', w.b)]));
      await held.reached;
      let during = null;
      pause.mockImplementation(async () => {
        during = lockErrors(trace.records);
        held.open();
        await saving;
      });
      const stepped = await settle(makeEventVersion(sequelize, { setId: w.b, everydaySetId: w.c, eventId: mine.ev }));
      if (!stepped.ok) throw stepped.error;
      expect(during).toEqual(['55P03']); // the set row was not waited for
      expect(pause.mock.calls).toEqual([[DELAY]]);
      expect(lockErrors(trace.records)).toEqual(['55P03']);
      expect((await saving).status).toBe(200);
      expect((await eventRow(mine.ev)).scene_set_id).toBe(w.b);
      expect(await versionOf(w.b)).toBe(w.c);
    });

    test('makeEveryday (return to the everyday set) against a save, the save holding the event row, and then the save holding its set rows too: it waits for the event row both times, holding no set row; no deadlock, no lock conflict; the save commits, then the event is returned', async () => {
      const { ep, ev } = await primary();
      // Set A is the event's own version of the everyday set C.
      expect((await settle(makeEventVersion(sequelize, { setId: w.a, everydaySetId: w.c, eventId: ev }))).ok).toBe(true);
      const g = holdsEventRow();
      const pending = send(save(ep, [loc('event', w.a), loc('home', w.home2)]));
      await g.reached;
      const everyday = settle(makeEveryday(sequelize, w.a, { returnEvent: true }));
      await waitsForEvent(ev);
      expect(await free('scene_sets', w.a)).toBe(true); // it has not taken the version's row yet
      g.open();
      const [res, e] = await Promise.all([pending, everyday]);
      if (!e.ok) throw e.error;
      expect(lockErrors(trace.records)).toEqual([]);
      expect(pause).not.toHaveBeenCalled();
      expect(res.status).toBe(200);
      expect((await eventRow(ev)).scene_set_id).toBe(w.c); // returned to the everyday set
      expect(await versionOf(w.a)).toBeNull();
      expect((await links(ep)).find((l) => l.role === 'event')).toEqual({ scene_set_id: w.c, role: 'event', role_name: null });
      trace.uninstall();
      trace = null;

      const second = await primary();
      expect((await settle(makeEventVersion(sequelize, { setId: w.b, everydaySetId: w.c, eventId: second.ev }))).ok).toBe(true);
      const held = holdsSetRows();
      const saving = send(save(second.ep, [loc('event', w.b), loc('home', w.home2)]));
      await held.reached;
      const later = settle(makeEveryday(sequelize, w.b, { returnEvent: true }));
      await waitsForEvent(second.ev);
      held.open();
      const [saved, done] = await Promise.all([saving, later]);
      if (!done.ok) throw done.error;
      expect(saved.status).toBe(200);
      expect(lockErrors(trace.records)).toEqual([]);
      expect((await eventRow(second.ev)).scene_set_id).toBe(w.c);
    });

    test('a plain update of a set held open in another transaction does not conflict with FOR KEY SHARE: the save commits at once, with no conflict and no pause; a FOR UPDATE on the same row does conflict', async () => {
      const { ep } = await primary();
      const updating = await holdSetRow(w.home2, 'UPDATE'); // a non-key UPDATE: FOR NO KEY UPDATE on the row
      const t = tracing();
      const res = await save(ep, [loc('event', w.a), loc('home', w.home2)]);
      expect(res.status).toBe(200);
      expect(lockErrors(t.records)).toEqual([]);
      expect(pause).not.toHaveBeenCalled();
      await updating.holder.rollback();

      await holdSetRow(w.home, 'FOR UPDATE');
      pause.mockImplementation(async () => {});
      const blocked = await save(ep, [loc('event', w.a), loc('home', w.home)]);
      expect(blocked.status).toBe(409);
      expect(t.records.filter((r) => r.error === '55P03')).toHaveLength(3);
    });
  });

  describe('[real lock] a set row held by another transaction (a real 55P03, never waited for)', () => {
    test('let go during the pause (transient): saved on the second try after one pause, during which no session but the holder\'s is inside a transaction', async () => {
      const { ep } = await primary();
      const { holder, pid } = await holdSetRow(w.home2);
      const t = tracing();
      const seen = [];
      pause.mockImplementation(async (ms) => {
        const ends = [...t.byTransaction().entries()].filter(([id]) => id !== holder.id).map(([, recs]) => recs.at(-1).kind);
        seen.push({ ms, ends, open: await inTransaction(pid) });
        await holder.rollback();
      });
      const res = await save(ep, [loc('event', w.a), loc('home', w.home2)]);
      expect(res.status).toBe(200);
      expect(seen).toEqual([{ ms: DELAY, ends: ['rollback'], open: [] }]);
      expect(t.records.filter((r) => r.error === '55P03')).toHaveLength(1);
      expect(t.records.filter((r) => r.kind === 'begin')).toHaveLength(2);
    });

    test('held throughout (persistent), a save that leaves the event\'s set: three tries, two pauses, 409 with the existing "try again" answer (RETRY); nothing written', async () => {
      const { ep } = await primary();
      await holdSetRow(w.home2);
      const before = await snapshot();
      pause.mockImplementation(async () => {});
      const t = tracing();
      const res = await save(ep, [loc('event', w.a), loc('home', w.home2)]);
      expect(res.status).toBe(409);
      expect(res.body).toEqual({ success: false, code: 'RETRY', error: BUSY_MESSAGE });
      expect(pause.mock.calls).toEqual([[DELAY], [DELAY]]);
      expect(t.records.filter((r) => r.error === '55P03')).toHaveLength(3);
      expect(t.records.filter((r) => r.kind === 'begin')).toHaveLength(3);
      expect(await snapshot()).toEqual(before);
    });

    test('held throughout, a save that moves the event: 409 PLACE_FINALIZE_RETRY_EXHAUSTED after three tries and two pauses; let go during the pause: saved', async () => {
      const { ep, ev } = await primary();
      const { holder } = await holdSetRow(w.b);
      const before = await snapshot();
      pause.mockImplementation(async () => {});
      const res = await save(ep, [loc('event', w.b), loc('home', w.home)]);
      expect(res.status).toBe(409);
      expect(res.body).toEqual({ success: false, code: 'PLACE_FINALIZE_RETRY_EXHAUSTED', error: EXHAUSTED_MESSAGE });
      expect(pause.mock.calls).toEqual([[DELAY], [DELAY]]);
      expect(await snapshot()).toEqual(before);
      pause.mockClear();
      pause.mockImplementation(async () => { await holder.rollback(); });
      const again = await save(ep, [loc('event', w.b), loc('home', w.home)]);
      expect(again.status).toBe(200);
      expect(pause.mock.calls).toEqual([[DELAY]]);
      expect((await eventRow(ev)).scene_set_id).toBe(w.b);
    });
  });

  // ══ Start Episode ══════════════════════════════════════════════════════
  describe('Start Episode and the set its Locations step showed for the event', () => {
    const startable = (setId = w.a) => mkEvent(show, { set: setId });
    const proposal = async (ev) => (await asAdmin(request(app).get(`/api/v1/world/${show}/events/${ev}/episode-locations`))).body.data;

    test('the step is told the event\'s set (event_scene_set_id), null when it has none', async () => {
      expect((await proposal(await startable())).event_scene_set_id).toBe(w.a);
      expect((await proposal(await startable(null))).event_scene_set_id).toBeNull();
    });

    test('sent with the value the step showed: 201, the locations saved through the finalizer, the setup complete', async () => {
      const ev = await startable();
      const t = tracing();
      const res = await start(ev, { locations: [loc('event', w.a), loc('home', w.home)], event_scene_set_id: w.a });
      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({ success: true, setup_complete: true });
      expect(res.body.message).not.toMatch(/locations were not saved/);
      const ep = res.body.data.episode.id;
      expect(res.body.data.setup_status.steps.locations).toEqual({ status: 'complete', count: 2 });
      expect(await links(ep)).toEqual([{ scene_set_id: w.a, role: 'event', role_name: null }, { scene_set_id: w.home, role: 'home', role_name: null }]);
      const link = t.records.find((r) => r.kind === 'insert' && r.table === 'scene_set_episodes');
      expect(lockTrace.classSequence(t.records.filter((r) => r.txId === link.txId)).slice(0, 3)).toEqual(['E:episodes:share', 'W:world_events:update', 'X:scene_sets:share']);
    });

    test('null is a real value: an event with no set started with null; null sent for an event that has a set is stale; a value sent for an event with none is stale', async () => {
      const none = await startable(null);
      const ok = await start(none, { locations: [loc('home', w.home)], event_scene_set_id: null });
      expect(ok.status).toBe(201);
      const has = await startable();
      const nullForSet = await start(has, { locations: [loc('event', w.a), loc('home', w.home)], event_scene_set_id: null });
      expect(nullForSet.status).toBe(409);
      expect(nullForSet.body).toEqual(STALE);
      const other = await startable(null);
      const setForNone = await start(other, { locations: [loc('home', w.home)], event_scene_set_id: w.a });
      expect(setForNone.status).toBe(409);
      expect(setForNone.body).toEqual(STALE);
      expect(await episodeOf(has)).toBeNull();
      expect(await episodeOf(other)).toBeNull();
    });

    test('an outdated displayed set (the event was moved since the step loaded): 409 STALE_SOURCE_SET; no episode, the event not stamped, nothing written', async () => {
      const ev = await startable();
      const shown = (await proposal(ev)).event_scene_set_id;
      expect((await putEvent(ev, { scene_set_id: w.b })).status).toBe(200);
      const before = await snapshot();
      const res = await start(ev, { locations: [loc('event', w.a), loc('home', w.home)], event_scene_set_id: shown });
      expect(res.status).toBe(409);
      expect(res.body).toEqual(STALE);
      expect(await snapshot()).toEqual(before);
      expect(await episodeOf(ev)).toBeNull();
    });

    test('locations sent without the field: 400, nothing created; no locations and no field (a regenerate, a multi-event Start): started on the event\'s set as it is', async () => {
      const ev = await startable();
      const before = await snapshot();
      const res = await start(ev, { locations: [loc('event', w.a), loc('home', w.home)] });
      expect(res.status).toBe(400);
      expect(res.body).toEqual({ success: false, code: 'EPISODE_LOCATIONS_INVALID', error: expect.stringMatching(/^event_scene_set_id is required with locations/) });
      expect(await snapshot()).toEqual(before);
      const bad = await start(ev, { locations: [loc('home', w.home)], event_scene_set_id: 7 });
      expect(bad.status).toBe(400);
      const plain = await start(ev, {});
      expect(plain.status).toBe(201);
      expect((await links(plain.body.data.episode.id)).find((l) => l.role === 'event')).toEqual({ scene_set_id: w.a, role: 'event', role_name: null });
    });

    test('the event moved between Start\'s first read and its lock: with the field, 409 STALE_SOURCE_SET and nothing created; with no locations, the episode is placed at the set the event has under the lock', async () => {
      const ev = await startable();
      const begun = gateOn((rec) => rec.kind === 'begin'); // Start's own transaction is open; the event row is not locked yet
      const pending = send(start(ev, { locations: [loc('event', w.a), loc('home', w.home)], event_scene_set_id: w.a }));
      await begun.reached;
      await run('UPDATE world_events SET scene_set_id = :b WHERE id = :ev', { b: w.b, ev });
      begun.open();
      const res = await pending;
      expect(res.status).toBe(409);
      expect(res.body).toEqual(STALE);
      expect(await episodeOf(ev)).toBeNull();
      expect(await rows('SELECT id FROM episodes WHERE show_id = :show', { show })).toEqual([]);
      trace.uninstall();
      trace = null;

      const other = await startable();
      const again = gateOn((rec) => rec.kind === 'begin');
      const plain = send(start(other, {}));
      await again.reached;
      await run('UPDATE world_events SET scene_set_id = :b WHERE id = :ev', { b: w.b, ev: other });
      again.open();
      const started = await plain;
      expect(started.status).toBe(201);
      const ep = started.body.data.episode.id;
      expect((await links(ep)).find((l) => l.role === 'event')).toEqual({ scene_set_id: w.b, role: 'event', role_name: null });
      expect(started.body.data.setup_status.steps.locations.status).toBe('complete');
      expect((await eventRow(other)).scene_set_id).toBe(w.b);
    });

    test('the event moved after Start\'s commit and before its locations are saved (a real event PUT): the step fails with its reason, the Start says its setup is not complete, and the older set is not put back', async () => {
      const ev = await startable();
      const committed = gateOn((rec) => !rec.txId && rec.kind === 'insert' && rec.table === 'scene_plans'); // after the commit
      const pending = send(start(ev, { locations: [loc('event', w.a), loc('home', w.home)], event_scene_set_id: w.a }));
      await committed.reached;
      expect((await putEvent(ev, { scene_set_id: w.c })).status).toBe(200);
      committed.open();
      const res = await pending;
      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.setup_complete).toBe(false);
      expect(res.body.message).toMatch(/Its locations were not saved: This event's scene set changed/);
      const step = res.body.data.setup_status.steps.locations;
      expect(step).toEqual({
        status: 'failed', code: 'STALE_SOURCE_SET', reason: `${STALE_MESSAGE} The episode's locations were not saved: set them in the episode's Locations.`,
        roles: [{ role: 'event', name: null }, { role: 'home', name: null }],
      });
      expect(res.body.data.setup_status.complete).toBe(false);
      const ep = res.body.data.episode.id;
      expect((await episodeRow(ep)).setup_status).toMatchObject({ complete: false, steps: { locations: { status: 'failed', code: 'STALE_SOURCE_SET' } } });
      expect((await eventRow(ev)).scene_set_id).toBe(w.c); // the newer choice stands
      expect((await links(ep)).filter((l) => l.scene_set_id === w.a)).toEqual([]);
      // What Resume setup then asks of the episode: the describe below.
    });

    test('three at once: a Start past its commit, a Locations save on the new episode moving the event, and an event edit: each takes its turn, the last choice stands, the Start does not write over it; no deadlock', async () => {
      const ev = await startable();
      const committed = gateOn((rec) => !rec.txId && rec.kind === 'insert' && rec.table === 'scene_plans');
      const pending = send(start(ev, { locations: [loc('event', w.a), loc('home', w.home)], event_scene_set_id: w.a }));
      await committed.reached;
      const ep = await episodeOf(ev);
      const saved = await save(ep, [loc('event', w.b), loc('home', w.home2)]); // through the finalizer: the event moves to B
      expect(saved.status).toBe(200);
      expect((await putEvent(ev, { scene_set_id: w.c })).status).toBe(200); // then the event's own edit
      committed.open();
      const res = await pending;
      expect(res.status).toBe(201);
      expect(res.body.setup_complete).toBe(false);
      expect(res.body.data.setup_status.steps.locations).toMatchObject({ status: 'failed', code: 'STALE_SOURCE_SET' });
      expect((await eventRow(ev)).scene_set_id).toBe(w.c);
      expect(await links(ep)).toEqual([{ scene_set_id: w.c, role: 'event', role_name: null }, { scene_set_id: w.home2, role: 'home', role_name: null }]);
      expect(lockErrors(trace.records)).toEqual([]);
    });

    test('[real lock] a set row held while Start saves its locations: let go during the pause, saved; held throughout, a failed step PLACE_FINALIZE_RETRY_EXHAUSTED after two pauses, with no database text in its reason', async () => {
      // The row is taken once Start's locations save holds the event row (its
      // beats, made before that, name the same set and would wait for it).
      const savingLocations = () => {
        let plansMade = false;
        return gateOn((rec) => {
          if (!rec.txId && rec.kind === 'insert' && rec.table === 'scene_plans') plansMade = true;
          return plansMade && Boolean(rec.txId) && rec.kind === 'lock' && rec.table === 'world_events';
        });
      };
      const ev = await startable();
      const first = savingLocations();
      const pending = send(start(ev, { locations: [loc('event', w.a), loc('home', w.home)], event_scene_set_id: w.a }));
      await first.reached;
      const { holder } = await holdSetRow(w.home);
      pause.mockImplementation(async () => { await holder.rollback(); });
      first.open();
      const res = await pending;
      expect(res.status).toBe(201);
      expect(res.body.setup_complete).toBe(true);
      expect(pause.mock.calls).toEqual([[DELAY]]);
      expect(trace.records.filter((r) => r.error === '55P03')).toHaveLength(1);
      trace.uninstall();
      trace = null;

      const other = await startable();
      const second = savingLocations();
      const later = send(start(other, { locations: [loc('event', w.a), loc('home', w.home2)], event_scene_set_id: w.a }));
      await second.reached;
      await holdSetRow(w.home2);
      pause.mockClear();
      pause.mockImplementation(async () => {});
      second.open();
      const held = await later;
      expect(trace.records.filter((r) => r.error === '55P03')).toHaveLength(3);
      expect(held.status).toBe(201);
      expect(held.body.setup_complete).toBe(false);
      expect(pause.mock.calls).toEqual([[DELAY], [DELAY]]);
      const step = held.body.data.setup_status.steps.locations;
      expect(step).toMatchObject({ status: 'failed', code: 'PLACE_FINALIZE_RETRY_EXHAUSTED' });
      expect(step.reason).toMatch(/^This could not be saved: the event or its episode was busy on every try\./);
      expect(await links(held.body.data.episode.id)).toEqual([]);
    });

    test('[injected] Start\'s locations failing for another reason: a failed step with a fixed reason and no database text; the episode exists', async () => {
      const ev = await startable();
      failStatement(/INSERT INTO scene_set_episodes/);
      const res = await start(ev, { locations: [loc('event', w.a), loc('home', w.home)], event_scene_set_id: w.a });
      jest.restoreAllMocks();
      expect(res.status).toBe(201);
      expect(res.body.setup_complete).toBe(false);
      expect(res.body.data.setup_status.steps.locations).toEqual({
        status: 'failed', code: 'SAVE_FAILED', reason: "The episode's locations could not be saved. Set them in the episode's Locations.",
        roles: [{ role: 'event', name: null }, { role: 'home', name: null }],
      });
      expect(JSON.stringify(res.body.data.setup_status)).not.toMatch(/violates|constraint|INSERT/);
      expect(await links(res.body.data.episode.id)).toEqual([]);
    });
  });

  // ══ Resume setup and a failed locations step ═══════════════════════════
  // Resume setup does not save locations. For a locations step that failed at
  // Start it only reads the episode, its event, its live locations and its
  // live beats, and calls the step done when they agree. The corrections
  // below go through the routes a user has: the Locations save and the beat
  // editor's save. Where a row is written directly, the test says why.
  describe('Resume setup and a locations step that failed at Start', () => {
    const startable = (setId = w.a) => mkEvent(show, { set: setId });
    const resume = (ep) => asAdmin(request(app).post(`/api/v1/episode-brief/${ep}/setup/resume`)).send({});
    const moveBeat = (ep, n, setId) => asAdmin(request(app).put(`/api/v1/episode-brief/${ep}/plan/${n}`)).send({ scene_set_id: setId });
    const beatSets = async (ep) => Object.fromEntries((await rows(
      'SELECT beat_number, scene_set_id FROM scene_plans WHERE episode_id = :ep AND deleted_at IS NULL ORDER BY beat_number', { ep })).map((b) => [b.beat_number, b.scene_set_id]));
    const stepOf = async (ep) => (await episodeRow(ep)).setup_status.steps.locations;
    const INCOMPLETE = 'LOCATIONS_INCOMPLETE';
    const noDatabaseText = (step) => expect(JSON.stringify(step)).not.toMatch(/violates|constraint|SELECT|INSERT|UPDATE|scene_set_episodes|scene_plans/);

    /**
     * A Start whose locations were refused as stale: the event was moved to C
     * by a real event PUT after Start's commit and before its beats were
     * made. Left behind: one location (the event's, at C, made by the event
     * edit's sync), home beats at home, and the event's beats (10, 11, 12)
     * at A, the set Start was made against.
     */
    async function staleStart({ locations = [loc('event', w.a), loc('home', w.home)], key = null } = {}) {
      const ev = await startable();
      const committed = gateOn((rec) => !rec.txId && rec.kind === 'insert' && rec.table === 'scene_plans');
      const req = asAdmin(request(app).post(`/api/v1/world/${show}/events/${ev}/generate-episode`));
      if (key) req.set('Idempotency-Key', key);
      const pending = send(req.send({ draft_script: false, locations, event_scene_set_id: w.a }));
      await committed.reached;
      expect((await putEvent(ev, { scene_set_id: w.c })).status).toBe(200);
      committed.open();
      const res = await pending;
      expect(res.status).toBe(201);
      expect(res.body.data.setup_status.steps.locations).toMatchObject({ status: 'failed', code: 'STALE_SOURCE_SET' });
      trace.uninstall();
      trace = null;
      return { ev, ep: res.body.data.episode.id, res };
    }
    /** [injected] A Start whose locations save failed outright: no location at all; its beats are at the sets it chose. */
    async function failedStart(locations = [loc('event', w.a), loc('home', w.home)]) {
      const ev = await startable();
      failStatement(/INSERT INTO scene_set_episodes/);
      const res = await start(ev, { locations, event_scene_set_id: w.a });
      jest.restoreAllMocks();
      jest.spyOn(console, 'log').mockImplementation(() => {});
      jest.spyOn(console, 'warn').mockImplementation(() => {});
      jest.spyOn(console, 'error').mockImplementation(() => {});
      expect(res.status).toBe(201);
      expect(res.body.data.setup_status.steps.locations).toMatchObject({ status: 'failed', code: 'SAVE_FAILED' });
      return { ev, ep: res.body.data.episode.id, res };
    }
    const stillFailed = async (ep, pattern) => {
      const res = await resume(ep);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(false);
      expect(res.body.data.setup_status.complete).toBe(false);
      const step = res.body.data.setup_status.steps.locations;
      expect(step).toMatchObject({ status: 'failed', code: INCOMPLETE });
      if (pattern) expect(step.reason).toMatch(pattern);
      noDatabaseText(step);
      // The route's sentence is the step's reason (every beat exists here), not "0 beats missing ()".
      expect(res.body.code).toBe('SETUP_INCOMPLETE');
      expect(res.body.error).toBe(step.reason);
      expect(await stepOf(ep)).toEqual(step);
      return step;
    };
    const nowComplete = async (ep, count) => {
      const res = await resume(ep);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.error).toBeUndefined();
      expect(res.body.code).toBeUndefined();
      expect(res.body.data.setup_status.complete).toBe(true);
      expect(res.body.data.setup_status.steps.locations).toEqual({ status: 'complete', count });
      expect((await episodeRow(ep)).setup_status.complete).toBe(true);
    };

    test('the failed step records the roles Start tried to save (extras by name)', async () => {
      const { res } = await failedStart([loc('event', w.a), loc('home', w.home), loc('closet', w.closet), loc('extra', w.b, 'Car')]);
      expect(res.body.data.setup_status.steps.locations.roles).toEqual([
        { role: 'event', name: null }, { role: 'home', name: null }, { role: 'closet', name: null }, { role: 'extra', name: 'Car' },
      ]);
    });

    test('Resume with nothing corrected: still failed and incomplete, and nothing but setup_status is written', async () => {
      const { ep } = await failedStart();
      const before = await snapshot();
      const step = await stillFailed(ep, /Missing: Event, Home\./);
      expect(step.roles).toEqual([{ role: 'event', name: null }, { role: 'home', name: null }]);
      expect(await snapshot()).toEqual(before);
      expect(await links(ep)).toEqual([]);
    });

    test('the event edit\'s sync made only an Event location after Start\'s stale refusal: one location does not clear the step', async () => {
      const { ep } = await staleStart();
      expect(await links(ep)).toEqual([{ scene_set_id: w.c, role: 'event', role_name: null }]);
      // No home location, so the home beats have none either; the event's beats are at the older set.
      const step = await stillFailed(ep, /Missing: Home\./);
      expect(step.reason).toMatch(/14 beats name a scene set that is not their location \(beats 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14\)/);
      expect(await beatSets(ep)).toMatchObject({ 10: w.a, 11: w.a, 12: w.a, 1: w.home });
      expect(await links(ep)).toEqual([{ scene_set_id: w.c, role: 'event', role_name: null }]);
    });

    test('the locations set again from the episode, but the event\'s beats still at the older set: failed until the beats are moved in the beat editor; then complete', async () => {
      const { ep } = await staleStart();
      expect((await save(ep, [loc('event', w.c), loc('home', w.home)])).status).toBe(200);
      // The Locations save moves beats only from a location it replaces: there was none at A.
      expect(await beatSets(ep)).toMatchObject({ 10: w.a, 11: w.a, 12: w.a, 1: w.home });
      const step = await stillFailed(ep, /^The episode's locations are not complete\. 3 beats name a scene set that is not their location \(beats 10, 11, 12\)\./);
      expect(step.reason).not.toMatch(/Missing|Event location/);
      // Two of the three moved: still failed, naming the one left.
      expect((await moveBeat(ep, 10, w.c)).status).toBe(200);
      expect((await moveBeat(ep, 11, w.c)).status).toBe(200);
      await stillFailed(ep, /1 beat names a scene set that is not its location \(beat 12\)/);
      expect((await moveBeat(ep, 12, w.c)).status).toBe(200);
      await nowComplete(ep, 2);
      expect(await beatSets(ep)).toMatchObject({ 10: w.c, 11: w.c, 12: w.c });
    });

    test('a role Start was asked for is missing (closet): failed with the reason; complete once it is set', async () => {
      const { ep } = await failedStart([loc('event', w.a), loc('home', w.home), loc('closet', w.closet)]);
      expect((await save(ep, [loc('event', w.a), loc('home', w.home)])).status).toBe(200);
      const step = await stillFailed(ep, /Missing: Closet\./);
      expect(step.reason).toMatch(/1 beat names a scene set that is not its location \(beat 8\)/); // the closet beat is at the closet set
      expect((await save(ep, [loc('event', w.a), loc('home', w.home), loc('closet', w.closet)])).status).toBe(200);
      await nowComplete(ep, 3);
    });

    test('a missing home, and a missing named extra: each is said; another extra\'s name does not stand in for it', async () => {
      const { ep } = await failedStart([loc('event', w.a), loc('home', w.home), loc('extra', w.b, 'Car')]);
      expect((await save(ep, [loc('event', w.a), loc('extra', w.b, 'Cafe')])).status).toBe(200);
      await stillFailed(ep, /Missing: Home, "Car"\./);
      expect((await save(ep, [loc('event', w.a), loc('home', w.home), loc('extra', w.b, 'Car')])).status).toBe(200);
      await nowComplete(ep, 3);
    });

    test('the Event location at another set than the event has: failed', async () => {
      const { ep, ev } = await failedStart();
      expect((await save(ep, [loc('event', w.a), loc('home', w.home)])).status).toBe(200);
      // Written directly: every route that changes an event's set also moves its draft
      // episode's Event location, so no route leaves the two apart.
      await run('UPDATE world_events SET scene_set_id = :b WHERE id = :ev', { b: w.b, ev });
      const step = await stillFailed(ep, /The Event location is not the event's current scene set\./);
      expect(step.reason).not.toMatch(/Missing/);
      await run('UPDATE world_events SET scene_set_id = :a WHERE id = :ev', { a: w.a, ev });
      await nowComplete(ep, 2);
    });

    test('an unrelated extra at the older set does not make the event\'s beats right: failed', async () => {
      const { ep } = await staleStart();
      expect((await save(ep, [loc('event', w.c), loc('home', w.home), loc('extra', w.a, 'Old hall')])).status).toBe(200);
      const step = await stillFailed(ep, /3 beats name a scene set that is not their location \(beats 10, 11, 12\)/);
      expect(step.reason).not.toMatch(/Missing/);
    });

    test('a location removed again (its link soft-deleted) does not count, and its beats are named; a set removed from Scene Sets likewise', async () => {
      const { ep } = await failedStart();
      expect((await save(ep, [loc('event', w.a), loc('home', w.home)])).status).toBe(200);
      expect((await save(ep, [loc('event', w.a)])).status).toBe(200); // the home link is soft-deleted by the save
      expect(await rows('SELECT role FROM scene_set_episodes WHERE episode_id = :ep AND deleted_at IS NOT NULL', { ep })).toEqual([{ role: 'home' }]);
      const step = await stillFailed(ep, /Missing: Home\./);
      expect(step.reason).toMatch(/beats name a scene set that is not their location \(beats 1, /);

      const other = await failedStart();
      expect((await save(other.ep, [loc('event', w.a), loc('home', w.home2)])).status).toBe(200);
      // Removed from Scene Sets (soft-deleted), written directly: the link row stays, the set is gone.
      await run('UPDATE scene_sets SET deleted_at = NOW() WHERE id = :id', { id: w.home2 });
      await stillFailed(other.ep, /Missing: Home\./);
      await run('UPDATE scene_sets SET deleted_at = NULL WHERE id = :id', { id: w.home2 });
    });

    test('a beat the user locked or chose keeps its set, as the writers leave it: right at any live location of the episode, wrong at a set that is not one', async () => {
      const { ep } = await staleStart();
      expect((await save(ep, [loc('event', w.c), loc('home', w.home), loc('extra', w.a, 'Old hall')])).status).toBe(200);
      // Chosen in the beat editor (chosen: true), at the extra: the user's own placement.
      for (const n of [10, 11]) {
        expect((await asAdmin(request(app).put(`/api/v1/episode-brief/${ep}/plan/${n}`)).send({ scene_set_id: w.a, chosen: true })).status).toBe(200);
      }
      await stillFailed(ep, /1 beat names a scene set that is not its location \(beat 12\)/);
      expect((await moveBeat(ep, 12, w.c)).status).toBe(200);
      await nowComplete(ep, 3);

      // A chosen beat whose set is no longer a location is named.
      const other = await staleStart();
      expect((await save(other.ep, [loc('event', w.c), loc('home', w.home), loc('extra', w.a, 'Old hall')])).status).toBe(200);
      for (const n of [10, 11, 12]) {
        expect((await asAdmin(request(app).put(`/api/v1/episode-brief/${other.ep}/plan/${n}`)).send({ scene_set_id: w.a, chosen: true })).status).toBe(200);
      }
      expect((await save(other.ep, [loc('event', w.c), loc('home', w.home)])).status).toBe(200); // the extra is removed; chosen beats stay at A
      expect(await beatSets(other.ep)).toMatchObject({ 10: w.a, 11: w.a, 12: w.a });
      await stillFailed(other.ep, /3 beats name a scene set that is not their location \(beats 10, 11, 12\)/);
    });

    test('a failed step from before roles were recorded: home, and the event when the event has a set; what Start was asked for beyond that is not known', async () => {
      const { ep } = await failedStart([loc('event', w.a), loc('home', w.home), loc('extra', w.b, 'Car')]);
      // As an older failed step reads: no roles. Written directly: no route writes a step.
      await run("UPDATE episodes SET setup_status = setup_status #- '{steps,locations,roles}' WHERE id = :ep", { ep });
      expect((await stepOf(ep)).roles).toBeUndefined();
      const step = await stillFailed(ep, /Missing: Event, Home\./);
      expect(step.roles).toBeUndefined();
      expect((await save(ep, [loc('event', w.a)])).status).toBe(200);
      await stillFailed(ep, /Missing: Home\./);
      // Without the extra Start was asked for: complete all the same (the fallback cannot know of it).
      expect((await save(ep, [loc('event', w.a), loc('home', w.home)])).status).toBe(200);
      await nowComplete(ep, 2);

      // With the roles recorded, the same correction is not enough.
      const recorded = await failedStart([loc('event', w.a), loc('home', w.home), loc('extra', w.b, 'Car')]);
      expect((await save(recorded.ep, [loc('event', w.a), loc('home', w.home)])).status).toBe(200);
      await stillFailed(recorded.ep, /Missing: "Car"\./);
    });

    test('an accepted episode: Resume leaves its evaluation, locations, beats and saved scenes as they were; the step stays failed', async () => {
      const { ep } = await staleStart();
      await fx.setEvaluation(ep, 'accepted');
      const read = async () => ({
        episode: (({ setup_status: _s, updated_at: _u, ...rest }) => rest)(await episodeRow(ep)),
        links: await rows('SELECT * FROM scene_set_episodes WHERE episode_id = :ep ORDER BY id', { ep }),
        plans: await rows('SELECT * FROM scene_plans WHERE episode_id = :ep ORDER BY id', { ep }),
        scenes: await rows('SELECT * FROM scenes WHERE episode_id = :ep ORDER BY id', { ep }),
        events: await rows('SELECT * FROM world_events WHERE show_id = :show ORDER BY id', { show }),
      });
      const before = await read();
      expect(before.plans).toHaveLength(14);
      expect(before.scenes.length).toBeGreaterThan(0);
      await stillFailed(ep, /Missing: Home\./);
      expect(await read()).toEqual(before);
      expect(await evaluationOf(ep)).toBe('accepted');
    });

    test('Start, its replay, the episode\'s record and Resume agree: incomplete while the step is failed, complete only after the check passes', async () => {
      const key = `genb3-${fx.uuid()}`;
      const { ev, ep, res } = await staleStart({ key });
      expect(res.body.setup_complete).toBe(false);
      expect(res.body.data.setup_status.complete).toBe(false);
      const replay = () => asAdmin(request(app).post(`/api/v1/world/${show}/events/${ev}/generate-episode`)).set('Idempotency-Key', key)
        .send({ draft_script: false, locations: [loc('event', w.a), loc('home', w.home)], event_scene_set_id: w.a });
      const again = await replay();
      expect(again.status).toBe(200);
      expect(again.body).toMatchObject({ replayed: true, setup_complete: false });
      expect(again.body.data.setup_status.steps.locations).toMatchObject({ status: 'failed', code: 'STALE_SOURCE_SET' });
      expect((await episodeRow(ep)).setup_status.complete).toBe(false);

      await stillFailed(ep);
      const afterResume = await replay();
      expect(afterResume.body).toMatchObject({ replayed: true, setup_complete: false });
      expect(afterResume.body.data.setup_status.steps.locations).toMatchObject({ status: 'failed', code: INCOMPLETE });

      expect((await save(ep, [loc('event', w.c), loc('home', w.home)])).status).toBe(200);
      for (const n of [10, 11, 12]) expect((await moveBeat(ep, n, w.c)).status).toBe(200);
      // Corrected, but not yet checked: still recorded as failed.
      expect((await replay()).body.setup_complete).toBe(false);
      await nowComplete(ep, 2);
      const done = await replay();
      expect(done.body).toMatchObject({ replayed: true, setup_complete: true });
      expect(done.body.data.setup_status).toMatchObject({ complete: true, steps: { locations: { status: 'complete', count: 2 } } });
    });
  });

  // ══ A set removed from Scene Sets around Start's locations write ═══════
  // Removing a scene set is a soft delete (DELETE /api/v1/scene-sets/:id:
  // UPDATE scene_sets SET deleted_at): the row stays and every foreign key
  // still passes. Start's locations write checks its sets again inside the
  // finalizer's transaction, after locking their rows. The removals here are
  // the real route (confirm_orphan=true where the set is in use, as the
  // page's "delete anyway" sends). Each ordering's outcome is what was
  // observed; the last two are NOT prevented by this change and are written
  // down as they are.
  //
  // C1 PR 1 (Evoni, 2026-11-24;
  // docs/audit/F-AUTH-1_SceneSetDeleteLockOrder_Amendment_2026-11-24.md)
  // changed the delete route: it now takes the episodes and events that
  // reference the set, and the set's row FOR UPDATE, before it writes. So
  // the route can no longer commit inside Start's locations write, and the
  // two orderings this file recorded as known remaining races are closed:
  // the removal and the write take turns. The cases below are rewritten to
  // what happens now. The write's own check stays, and is shown with a set
  // removed by a statement (as any path other than that route leaves it).
  describe('a scene set removed from Scene Sets around Start\'s locations write', () => {
    const startable = (setId = w.a) => mkEvent(show, { set: setId });
    const remove = (id, confirm = true) => asAdmin(request(app).delete(`/api/v1/scene-sets/${id}${confirm ? '?confirm_orphan=true' : ''}`)).send({});
    const resume = (ep) => asAdmin(request(app).post(`/api/v1/episode-brief/${ep}/setup/resume`)).send({});
    const removedAt = async (id) => (await rows('SELECT deleted_at FROM scene_sets WHERE id = :id', { id }))[0].deleted_at;
    /** A set removed without the delete route (a soft delete, as the row is left by it). */
    const softRemove = (id) => run('UPDATE scene_sets SET deleted_at = NOW(), updated_at = NOW() WHERE id = :id', { id });
    const waitingForLock = async () => (await rows(
      "SELECT count(*)::int AS n FROM pg_stat_activity WHERE datname = current_database() AND pid <> pg_backend_pid() AND wait_event_type = 'Lock'"))[0].n;
    /** [real lock] Until another session really waits for a row lock. */
    async function untilWaiting() {
      const end = Date.now() + 8000;
      while (await waitingForLock() === 0 && Date.now() < end) await new Promise((resolve) => setTimeout(resolve, 15));
      expect(await waitingForLock()).toBeGreaterThan(0);
    }
    const NOT_SAVED = "The episode's locations were not saved: set them in the episode's Locations.";
    /**
     * What a locations write writes, for the whole show: every link, each
     * event's set, each beat's set and angle. (Start's later steps write
     * other columns of its beats, which is why this is not the full snapshot.)
     */
    const placeState = async () => ({
      links: await rows('SELECT l.id, l.scene_set_id, l.episode_id, l.role, l.role_name, l.sort_order, l.deleted_at FROM scene_set_episodes l JOIN episodes e ON e.id = l.episode_id WHERE e.show_id = :show ORDER BY l.id', { show }),
      events: await rows('SELECT id, scene_set_id, deleted_at FROM world_events WHERE show_id = :show ORDER BY id', { show }),
      beats: await rows('SELECT p.id, p.beat_number, p.scene_set_id, p.angle_label, p.locked, p.chosen_by_user, p.deleted_at FROM scene_plans p JOIN episodes e ON e.id = p.episode_id WHERE e.show_id = :show ORDER BY p.id', { show }),
      sets: await rows('SELECT id, deleted_at IS NOT NULL AS removed, version_of_set_id FROM scene_sets WHERE show_id = :show ORDER BY id', { show }),
    });
    /** Start's locations write holding the event row, its beats already made, before it locks its set rows. */
    const savingLocations = () => {
      let plansMade = false;
      return gateOn((rec) => {
        if (!rec.txId && rec.kind === 'insert' && rec.table === 'scene_plans') plansMade = true;
        return plansMade && Boolean(rec.txId) && rec.kind === 'lock' && rec.table === 'world_events';
      });
    };
    /** Start past its commit and its beats, stopped before its locations write locks a set; `during` runs there. */
    async function startWith(locations, during, { key = null } = {}) {
      const ev = await startable();
      const gate = savingLocations();
      const req = asAdmin(request(app).post(`/api/v1/world/${show}/events/${ev}/generate-episode`));
      if (key) req.set('Idempotency-Key', key);
      const pending = send(req.send({ draft_script: false, locations, event_scene_set_id: w.a }));
      await gate.reached;
      const ep = await episodeOf(ev);
      const before = await during({ ev, ep });
      gate.open();
      const res = await pending;
      return { ev, ep, res, before };
    }

    test('the event\'s set found removed by the locations write\'s check (removed after Start\'s commit, by a statement): nothing written by the write, a failed step with the check\'s code, not tried again; the Start, its replay and Resume say incomplete', async () => {
      const key = `genb3-${fx.uuid()}`;
      const locations = [loc('event', w.a), loc('home', w.home)];
      const { ev, ep, res, before } = await startWith(locations, async () => {
        await softRemove(w.a);
        expect(await removedAt(w.a)).not.toBeNull();
        return placeState();
      }, { key });
      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.setup_complete).toBe(false);
      const step = res.body.data.setup_status.steps.locations;
      expect(step).toEqual({
        status: 'failed', code: 'SCENE_SET_NOT_FOUND', reason: `The event scene set no longer exists. ${NOT_SAVED}`,
        roles: [{ role: 'event', name: null }, { role: 'home', name: null }],
      });
      expect(res.body.message).toMatch(/Its locations were not saved: The event scene set no longer exists\./);
      // The write left nothing: no link, the event and every beat as they were when the removal committed.
      expect(before.beats).toHaveLength(14);
      expect(await placeState()).toEqual(before);
      expect(await links(ep)).toEqual([]);
      expect(pause).not.toHaveBeenCalled();
      expect(lockErrors(trace.records)).toEqual([]);
      const finalizations = [...trace.byTransaction().values()].filter((t) => t.some((r) => r.kind === 'lock' && r.table === 'scene_sets'));
      expect(finalizations).toHaveLength(1); // one try
      trace.uninstall();
      trace = null;

      const replay = await asAdmin(request(app).post(`/api/v1/world/${show}/events/${ev}/generate-episode`)).set('Idempotency-Key', key)
        .send({ draft_script: false, locations, event_scene_set_id: w.a });
      expect(replay.status).toBe(200);
      expect(replay.body).toMatchObject({ replayed: true, setup_complete: false });
      expect(replay.body.data.setup_status.steps.locations).toEqual(step);
      const resumed = await resume(ep);
      expect(resumed.body.success).toBe(false);
      expect(resumed.body.data.setup_status.steps.locations).toMatchObject({ status: 'failed', code: 'LOCATIONS_INCOMPLETE' });
      expect(resumed.body.data.setup_status.steps.locations.reason).toMatch(/Missing: Event, Home\./);
    });

    test.each([
      // Home and closet: Start's beats already name them, so the route would wait for the write (below); removed by a statement.
      ['home', () => [loc('event', w.a), loc('home', w.home2)], () => w.home2, 'home', softRemove],
      ['closet', () => [loc('event', w.a), loc('home', w.home), loc('closet', w.closet)], () => w.closet, 'closet', softRemove],
      // An extra nothing of the episode names yet: the real route removes it at once.
      ['extra', () => [loc('event', w.a), loc('home', w.home), loc('extra', w.b, 'Car')], () => w.b, 'extra', async (id) => expect((await remove(id)).status).toBe(200)],
    ])('a removed %s set (not the event\'s) among Start\'s locations: the same refusal, and nothing partial (no link at all, the event not written)', async (_name, locationsOf, setOf, role, removeIt) => {
      const { ep, res, before } = await startWith(locationsOf(), async () => {
        await removeIt(setOf());
        expect(await removedAt(setOf())).not.toBeNull();
        return placeState();
      });
      expect(res.status).toBe(201);
      expect(res.body.setup_complete).toBe(false);
      expect(res.body.data.setup_status.steps.locations).toMatchObject({
        status: 'failed', code: 'SCENE_SET_NOT_FOUND', reason: `The ${role} scene set no longer exists. ${NOT_SAVED}`,
      });
      expect(await placeState()).toEqual(before);
      expect(await links(ep)).toEqual([]);
      expect(pause).not.toHaveBeenCalled();
    });

    test('removed before Start entirely: with locations naming it, Start is refused as before (404 SCENE_SET_NOT_FOUND, nothing created); with none sent, the removed set is left out of the episode\'s locations', async () => {
      const ev = await startable();
      expect((await remove(w.a)).status).toBe(200);
      const before = await snapshot();
      const res = await start(ev, { locations: [loc('event', w.a), loc('home', w.home)], event_scene_set_id: w.a });
      expect(res.status).toBe(404);
      expect(res.body).toEqual({ success: false, code: 'SCENE_SET_NOT_FOUND', error: 'The event scene set no longer exists' });
      expect(await snapshot()).toEqual(before);
      expect(await episodeOf(ev)).toBeNull();

      const plain = await start(ev, {});
      expect(plain.status).toBe(201);
      const ep = plain.body.data.episode.id;
      expect((await links(ep)).map((l) => l.role)).toEqual(['home']);
      expect((await links(ep)).some((l) => l.scene_set_id === w.a)).toBe(false);
      expect(plain.body.data.setup_status.steps.locations.status).toBe('complete');
    });

    test('Start\'s locations write first, then the removal: the route says the set is in use (409 SET_IN_USE); "delete anyway" removes it and leaves the episode\'s uses on the removed set, as that route always has', async () => {
      const ev = await startable();
      const res = await start(ev, { locations: [loc('event', w.a), loc('home', w.home)], event_scene_set_id: w.a });
      expect(res.status).toBe(201);
      expect(res.body.setup_complete).toBe(true);
      const ep = res.body.data.episode.id;
      const refused = await remove(w.a, false);
      expect(refused.status).toBe(409);
      expect(refused.body.code).toBe('SET_IN_USE');
      expect(await removedAt(w.a)).toBeNull();
      const anyway = await remove(w.a);
      expect(anyway.status).toBe(200);
      expect(await removedAt(w.a)).not.toBeNull();
      // What "delete anyway" leaves (existing behaviour, not this change's): the link, the event and the beats still name it.
      expect((await rows('SELECT role FROM scene_set_episodes WHERE episode_id = :ep AND scene_set_id = :a AND deleted_at IS NULL', { ep, a: w.a }))).toEqual([{ role: 'event' }]);
      expect((await eventRow(ev)).scene_set_id).toBe(w.a);
    });

    test('[real lock] the real delete route during Start\'s locations write (after its commit, before the write locks a set): the removal waits for the write, which is saved; then "delete anyway" removes the set and leaves the episode\'s uses on it, as that route does (C1 PR 1: the two take turns)', async () => {
      const ev = await startable();
      const gate = savingLocations();
      const pending = send(start(ev, { locations: [loc('event', w.a), loc('home', w.home)], event_scene_set_id: w.a }));
      await gate.reached;
      const removal = send(remove(w.a));
      await untilWaiting(); // the delete needs the episode and event rows the write holds
      expect(await removedAt(w.a)).toBeNull();
      gate.open();
      const [res, removed] = await Promise.all([pending, removal]);
      expect(res.status).toBe(201);
      expect(res.body.setup_complete).toBe(true);
      expect(removed.status).toBe(200);
      expect(lockErrors(trace.records)).toEqual([]);
      const ep = res.body.data.episode.id;
      expect(await removedAt(w.a)).not.toBeNull();
      // "Delete anyway": the uses are left on the removed set (existing behaviour of that choice).
      expect((await rows('SELECT role FROM scene_set_episodes WHERE episode_id = :ep AND scene_set_id = :a AND deleted_at IS NULL', { ep, a: w.a }))).toEqual([{ role: 'event' }]);
      expect((await eventRow(ev)).scene_set_id).toBe(w.a);
    });

    test('[real lock] a removal in flight when Start begins (the real route, held after its soft delete, its locks held): Start waits for the event row; its locations write then finds the set removed and saves nothing (was a KNOWN REMAINING RACE before C1 PR 1: closed)', async () => {
      const ev = await startable();
      const softDeleted = gateOn((rec, sql) => Boolean(rec.txId) && /^UPDATE "scene_sets" SET "deleted_at"/.test(sql));
      const removal = send(remove(w.a));
      await softDeleted.reached;
      expect(await removedAt(w.a)).toBeNull(); // not committed
      const pending = send(start(ev, { locations: [loc('event', w.a), loc('home', w.home)], event_scene_set_id: w.a }));
      await untilWaiting(); // Start waits for the event row the delete holds
      softDeleted.open();
      const [removed, res] = await Promise.all([removal, pending]);
      expect(removed.status).toBe(200);
      expect(res.status).toBe(201);
      expect(res.body.setup_complete).toBe(false);
      expect(res.body.data.setup_status.steps.locations).toMatchObject({ status: 'failed', code: 'SCENE_SET_NOT_FOUND', reason: `The event scene set no longer exists. ${NOT_SAVED}` });
      expect(lockErrors(trace.records).filter((e) => e === '40P01')).toEqual([]);
      expect(await links(res.body.data.episode.id)).toEqual([]);
    });

    test('[real lock] the removal arriving after the write has checked its sets, before the write commits: it waits for the write, then "delete anyway" removes the set (was a KNOWN REMAINING RACE before C1 PR 1: the two now take turns)', async () => {
      const ev = await startable();
      // Start's locations write stopped after its check read the sets as live (its first link written, not committed).
      const checked = gateOn((rec) => Boolean(rec.txId) && rec.kind === 'insert' && rec.table === 'scene_set_episodes');
      const pending = send(start(ev, { locations: [loc('event', w.a), loc('home', w.home)], event_scene_set_id: w.a }));
      await checked.reached;
      const ep = await episodeOf(ev);
      const removal = send(remove(w.a));
      await untilWaiting();
      expect(await removedAt(w.a)).toBeNull();
      checked.open();
      const [res, removed] = await Promise.all([pending, removal]);
      expect(res.status).toBe(201);
      expect(res.body.data.setup_status.steps.locations).toEqual({ status: 'complete', count: 2 });
      expect(removed.status).toBe(200);
      expect(lockErrors(trace.records)).toEqual([]);
      expect(await removedAt(w.a)).not.toBeNull();
      expect((await rows('SELECT role FROM scene_set_episodes WHERE episode_id = :ep AND scene_set_id = :a AND deleted_at IS NULL', { ep, a: w.a }))).toEqual([{ role: 'event' }]);
    });

    test('a valid Start and its replay are as they were: the sets checked in the write\'s transaction, after their rows are locked and before the first write', async () => {
      const ev = await startable();
      const key = `genb3-${fx.uuid()}`;
      const body = { draft_script: false, locations: [loc('event', w.a), loc('home', w.home), loc('closet', w.closet), loc('extra', w.b, 'Car')], event_scene_set_id: w.a };
      const t = tracing();
      const res = await asAdmin(request(app).post(`/api/v1/world/${show}/events/${ev}/generate-episode`)).set('Idempotency-Key', key).send(body);
      expect(res.status).toBe(201);
      expect(res.body.setup_complete).toBe(true);
      expect(res.body.data.setup_status.steps.locations).toEqual({ status: 'complete', count: 4 });
      const ep = res.body.data.episode.id;
      expect((await links(ep)).map((l) => [l.role, l.scene_set_id, l.role_name])).toEqual([['event', w.a, null], ['home', w.home, null], ['closet', w.closet, null], ['extra', w.b, 'Car']]);
      const link = t.records.find((r) => r.kind === 'insert' && r.table === 'scene_set_episodes');
      const write = t.records.filter((r) => r.txId === link.txId);
      const lockAt = write.findIndex((r) => r.kind === 'lock' && r.table === 'scene_sets');
      const checkAt = write.findIndex((r, i) => i > lockAt && r.kind === 'other' && /^SELECT s\.id, s\.name, s\.show_id, s\.scene_type/.test(r.sql));
      const firstWrite = write.findIndex((r) => r.kind === 'insert' || r.kind === 'write');
      expect(lockAt).toBeGreaterThan(-1);
      expect(checkAt).toBeGreaterThan(lockAt);
      expect(firstWrite).toBeGreaterThan(checkAt);
      trace.uninstall();
      trace = null;

      const before = await snapshot();
      const replay = await asAdmin(request(app).post(`/api/v1/world/${show}/events/${ev}/generate-episode`)).set('Idempotency-Key', key).send(body);
      expect(replay.status).toBe(200);
      expect(replay.body).toMatchObject({ replayed: true, setup_complete: true });
      expect(replay.body.data.episode.id).toBe(ep);
      expect(await snapshot()).toEqual(before);
    });
  });

  describe('the network guard', () => {
    test('no external network attempt in this file', () => {
      const mine = networkGuard.getState().events.slice(guardEventsAtStart);
      expect(mine.filter((e) => e.type === 'attempt')).toEqual([]);
    });
  });
});
