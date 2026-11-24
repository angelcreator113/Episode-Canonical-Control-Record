/**
 * C1 PR 2 (Evoni, 2026-11-24;
 * docs/audit/F-AUTH-1_EventWritersEpisodeFirst_Amendment_2026-11-24.md): the
 * writers that move an event to a scene set take the episode first.
 *
 *   W1  the event edit (PUT /world/:showId/events/:eventId, a set change)
 *   W2  scene-set-link (POST …/scene-set-link)
 *   W3  makeEventVersion        W4  makeEveryday, returning the events
 *   inject (POST …/inject)
 *
 * Each now takes the event's linked live episodes in one ascending pass
 * (FOR SHARE; inject's own episode FOR UPDATE), then the event row, proves
 * under it that no episode was linked meanwhile, and takes a set's row live
 * only and without waiting. A transaction that lost to a lock is tried
 * again (three tries), then answers 409 RETRY.
 *
 * On the migrated test database, through the real routes and services.
 * REAL LOCKS: every race is two real writers, one held open at a statement
 * by the lock trace's gate, or a real row lock held by another transaction.
 * [injected] cases make one statement throw. Nothing sends DDL.
 *
 * THE DELETE ORDER IS SIMULATED HERE. The Scene Set delete that takes its
 * locks in the Place order (C1 PR 1) is not on this branch. Where a case
 * says "the delete's order", a raw session takes exactly that order (the
 * affected episodes FOR UPDATE ascending, the events FOR UPDATE ascending,
 * the set row FOR UPDATE NOWAIT), removes the set and commits. The real
 * combination is verified separately, outside this file.
 */
jest.unmock('uuid');
process.env.S3_PRIMARY_BUCKET = 'pr2-test-bucket';

const mockAnthropic = jest.fn(async () => { throw new Error('the model is not called in this suite'); });
jest.mock('@anthropic-ai/sdk', () => jest.fn(() => ({ messages: { create: mockAnthropic } })));
jest.mock('axios', () => {
  const actual = jest.requireActual('axios');
  return { ...actual, post: jest.fn(), get: jest.fn(), put: jest.fn(), delete: jest.fn(), request: jest.fn(), create: actual.create };
});
const mockS3Send = jest.fn(async () => ({}));
jest.mock('@aws-sdk/client-s3', () => {
  const actual = jest.requireActual('@aws-sdk/client-s3');
  return { ...actual, S3Client: jest.fn(() => ({ send: mockS3Send })) };
});

const request = require('supertest');
const sharp = require('sharp');
const axios = require('axios');
const app = require('../../src/app');
const TokenService = require('../../src/services/tokenService');
const models = require('../../src/models');
const placeLock = require('../../src/utils/placeLock');
const { isLockConflict } = require('../../src/utils/episodeLocks');
const { completeEpisode } = require('../../src/services/episodeCompletionService');
const { makeEventVersion, makeEveryday } = require('../../src/services/sceneSetVersionService');
const sceneGen = require('../../src/services/sceneGenerationService');
const lockTrace = require('../helpers/lockTrace');
const networkGuard = require('../networkGuard/core');
const { placeLockFixtures } = require('../helpers/placeLockFixtures');

const { sequelize } = models;
const { PLACE_LOCKED_CODE, PLACE_LOCKED_MESSAGE } = placeLock;
const DELAY = sceneGen.PLACE_FINALIZE_RETRY_DELAY_MS;

const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const RETRY = { success: false, error: 'Someone else changed this at the same moment. Nothing was saved: try again.', code: 'RETRY' };
const LOCKED = { success: false, code: PLACE_LOCKED_CODE, error: PLACE_LOCKED_MESSAGE };
const NOT_DATABASE_TEXT = /deadlock|violates|constraint|SELECT |UPDATE |INSERT |relation|syntax|sequelize|canceling statement|lock timeout|could not obtain lock/i;

const open = [];
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const settle = (promise) => promise.then(
  (value) => ({ ok: true, value }),
  (error) => ({ ok: false, error, status: error?.status, code: error?.code, lock: isLockConflict(error) }));
const send = (req) => req.then((res) => res);
const flat = (sql) => String(sql).replace(/\s+/g, ' ').trim();

(shouldSkip ? describe.skip : describe)('C1 PR 2: the writers of an event\'s Place take the episode first', () => {
  jest.setTimeout(Number(process.env.PR2_TEST_TIMEOUT_MS) || 90000);
  const fx = placeLockFixtures(sequelize, models);
  const { run, rows, mkShow, mkEpisode, mkEvent, mkBrief, mkSet, mkLocation, evaluationOf, eventRow } = fx;
  const TAG = fx.uuid().slice(0, 8);
  let show;
  let trace = null;
  let pause = null;
  let PNG;
  let guardEventsAtStart = 0;
  let w;
  const saved = {};
  const usageLogIds = [];
  let usageLog;

  let admins = 0;
  const adminToken = () => {
    admins += 1;
    return TokenService.generateTokenPair({ id: `pr2-admin-${TAG}-${admins}`, email: `admin${admins}@pr2.dev`, name: 'Admin', groups: ['ADMIN'], role: 'ADMIN' }).accessToken;
  };
  const asAdmin = (r) => r.set('X-Forwarded-For', `10.96.${100 + Math.floor(admins / 250)}.${(admins % 250) + 1}`).set('Authorization', `Bearer ${adminToken()}`);
  const putEvent = (ev, body) => asAdmin(request(app).put(`/api/v1/world/${show}/events/${ev}`)).send(body);
  const linkSet = (ev, setId) => asAdmin(request(app).post(`/api/v1/world/${show}/events/${ev}/scene-set-link`)).send(setId ? { scene_set_id: setId } : {});
  const inject = (ev, ep) => asAdmin(request(app).post(`/api/v1/world/${show}/events/${ev}/inject`)).send({ episode_id: ep });
  const version = (setId, body) => asAdmin(request(app).put(`/api/v1/scene-sets/${setId}/version`)).send(body);
  const save = (ep, locations) => asAdmin(request(app).put(`/api/v1/episodes/${ep}/locations`)).send({ locations });
  const start = (ev, body = {}) => asAdmin(request(app).post(`/api/v1/world/${show}/events/${ev}/generate-episode`)).send({ draft_script: false, ...body });
  const generateVenue = (ev) => asAdmin(request(app).post(`/api/v1/world/${show}/events/${ev}/generate-venue`)).send({});
  const loc = (role, id) => ({ role, scene_set_id: id });

  // ── Fixtures ───────────────────────────────────────────────────────────
  const set = (name, type = 'EVENT_LOCATION', fields = {}) => mkSet(show, `${name} ${fx.uuid().slice(0, 6)}`, { scene_type: type, base_still_url: `https://cdn.example/${fx.uuid()}.jpg`, ...fields });
  async function world() {
    return { s: await set('Hall S'), t: await set('Hall T'), u: await set('Hall U'), v: await set('Hall V'), home: await set('Home', 'HOME_BASE') };
  }
  /** A draft episode whose event is held at the set, with no location row of its own (the writers' sync inserts one). */
  async function eventOnly(setId = w.s, { brief = true } = {}) {
    const ep = await mkEpisode(show);
    const ev = await mkEvent(show, { stamp: ep, set: setId });
    if (brief) await mkBrief(show, ep, ev);
    return { ep, ev };
  }
  async function film(ep) {
    const id = fx.uuid();
    await run(`INSERT INTO episode_raw_clips (id, episode_id, show_id, performer, s3_key_raw, key_status, key_strength, created_at, updated_at)
               VALUES (:id, :ep, :show, :performer, :key, 'none', 'medium', NOW(), NOW())`,
    { id, ep, show, performer: require('../../src/services/rawClipsService').PERFORMERS?.[0] || 'lala', key: `raw/${id}.mp4` });
  }
  const linksOf = (ep) => rows('SELECT scene_set_id, role FROM scene_set_episodes WHERE episode_id = :ep AND deleted_at IS NULL ORDER BY role, scene_set_id', { ep });
  const setOf = async (ev) => (await eventRow(ev)).scene_set_id;
  const removedAt = async (id) => (await rows('SELECT deleted_at FROM scene_sets WHERE id = :id', { id }))[0].deleted_at;
  /** Every row these writers write, for the show. */
  async function snapshot() {
    const by = { show };
    return {
      events: await rows('SELECT id, scene_set_id, used_in_episode_id, status, deleted_at FROM world_events WHERE show_id = :show ORDER BY id', by),
      links: await rows('SELECT l.scene_set_id, l.episode_id, l.role, l.deleted_at FROM scene_set_episodes l JOIN episodes e ON e.id = l.episode_id WHERE e.show_id = :show ORDER BY l.episode_id, l.scene_set_id, l.created_at', by),
      sets: await rows('SELECT id, deleted_at, version_of_set_id FROM scene_sets WHERE show_id = :show ORDER BY id', by),
      episodes: await rows('SELECT id, evaluation_status FROM episodes WHERE show_id = :show ORDER BY id', by),
    };
  }
  /** No live location row and no event points at a removed set. */
  async function noReferenceToARemovedSet() {
    expect(await rows(`SELECT l.episode_id FROM scene_set_episodes l JOIN scene_sets s ON s.id = l.scene_set_id JOIN episodes e ON e.id = l.episode_id
                        WHERE e.show_id = :show AND l.deleted_at IS NULL AND s.deleted_at IS NOT NULL`, { show })).toEqual([]);
    expect(await rows(`SELECT v.id FROM world_events v JOIN scene_sets s ON s.id = v.scene_set_id
                        WHERE v.show_id = :show AND v.deleted_at IS NULL AND s.deleted_at IS NOT NULL`, { show })).toEqual([]);
  }

  // ── Locks, gates, races ────────────────────────────────────────────────
  async function holdTransaction() {
    const transaction = await sequelize.transaction();
    open.push(async () => { if (!transaction.finished) await transaction.rollback(); });
    return transaction;
  }
  async function holdRow(table, id, how = 'FOR UPDATE') {
    const holder = await holdTransaction();
    await sequelize.query(`SELECT id FROM ${table} WHERE id = :id ${how}`, { replacements: { id }, transaction: holder });
    return holder;
  }
  const othersInTransaction = async () => (await rows(
    'SELECT count(*)::int AS n FROM pg_stat_activity WHERE datname = current_database() AND pid <> pg_backend_pid() AND xact_start IS NOT NULL'))[0].n;
  const waiting = async () => (await rows(
    "SELECT count(*)::int AS n FROM pg_stat_activity WHERE datname = current_database() AND pid <> pg_backend_pid() AND wait_event_type = 'Lock'"))[0].n;
  function tracing() {
    trace = lockTrace.install(sequelize);
    return trace;
  }
  function gateOn(predicate) {
    const g = (trace || tracing()).gate(predicate);
    open.push(async () => g.open());
    return g;
  }
  const lockErrors = () => trace.records.filter((r) => r.error === '55P03' || r.error === '40P01').map((r) => r.error);
  /** A transaction that has just locked or written an event row. */
  const holdsEventRow = (rec) => Boolean(rec.txId) && rec.table === 'world_events' && (rec.kind === 'lock' || rec.kind === 'write');
  function failStatement(pattern, code) {
    const real = sequelize.query.bind(sequelize);
    return jest.spyOn(sequelize, 'query').mockImplementation((sql, options) => {
      if (options?.transaction && pattern.test(flat(typeof sql === 'string' ? sql : sql?.query || ''))) {
        return Promise.reject(Object.assign(new Error(code === '23503' ? 'violates foreign key constraint "x_fkey"' : 'deadlock detected'),
          { name: 'SequelizeDatabaseError', original: { code } }));
      }
      return real(sql, options);
    });
  }
  /**
   * [real locks] `first` runs until it holds an event row, then `second`
   * starts. The gate opens once the second is seen waiting for a lock, or
   * steps back from one (its retry pause), or has answered. A retry pause
   * here waits until no other session is inside a transaction.
   */
  async function race(first, second, gate = holdsEventRow) {
    const g = gateOn(gate);
    let how = null;
    pause.mockImplementation(async () => {
      how = how || 'paused';
      g.open();
      const end = Date.now() + 5000;
      while (await othersInTransaction() > 0 && Date.now() < end) await sleep(15);
    });
    const p1 = first();
    await g.reached;
    let done = false;
    const p2 = second();
    p2.then(() => { done = true; }, () => { done = true; });
    const end = Date.now() + 8000;
    while (!how && Date.now() < end) {
      if (done) how = 'done';
      else if (await waiting() > 0) how = 'blocked';
      else await sleep(15);
    }
    g.open();
    const [a, b] = await Promise.all([p1, p2]);
    const errors = lockErrors();
    trace.uninstall();
    trace = null;
    return { a, b, how, errors, pauses: pause.mock.calls.length };
  }
  /** No deadlock, no 500, no database text; a thrown service error is one of the service's own. */
  const clean = (out) => {
    expect(out.errors.filter((e) => e === '40P01')).toEqual([]);
    for (const x of [out.a, out.b]) {
      if (x && typeof x.status === 'number' && x.body) {
        expect(x.status).toBeLessThan(500);
        expect(JSON.stringify(x.body.error || '')).not.toMatch(NOT_DATABASE_TEXT);
      } else if (x && x.ok === false) {
        expect(x.lock).toBe(false);
        expect(String(x.error?.message || '')).not.toMatch(NOT_DATABASE_TEXT);
      }
    }
  };
  /**
   * THE DELETE'S ORDER, SIMULATED (see the header): the episodes FOR UPDATE
   * ascending, the events FOR UPDATE ascending, the set row FOR UPDATE
   * NOWAIT, the set removed, commit. `hold` resolves once it holds them all.
   */
  function deleteInItsOrder(setId, { episodes = [], events = [] } = {}) {
    let reached;
    let release;
    const held = new Promise((resolve) => { reached = resolve; });
    const go = new Promise((resolve) => { release = resolve; });
    const done = settle(sequelize.transaction(async (t) => {
      if (episodes.length) await sequelize.query('SELECT id FROM episodes WHERE id IN (:ids) ORDER BY id FOR UPDATE', { replacements: { ids: [...episodes].sort() }, transaction: t });
      for (const id of [...events].sort()) await sequelize.query('SELECT id FROM world_events WHERE id = :id FOR UPDATE', { replacements: { id }, transaction: t });
      await sequelize.query('SELECT id FROM scene_sets WHERE id = :id FOR UPDATE NOWAIT', { replacements: { id: setId }, transaction: t });
      reached();
      await go;
      await sequelize.query('UPDATE scene_sets SET deleted_at = NOW(), updated_at = NOW() WHERE id = :id', { replacements: { id: setId }, transaction: t });
    }));
    open.push(async () => release());
    return { held, release, done };
  }

  // The five writers, each moving the event of `x` ({ ep, ev }) to `to`.
  const WRITERS = {
    'W1 the event edit': (x, to) => send(putEvent(x.ev, { scene_set_id: to })),
    'W2 scene-set-link': (x, to) => send(linkSet(x.ev, to)),
    'W3 makeEventVersion': (x, to) => settle(makeEventVersion(sequelize, { setId: to, everydaySetId: w.v, eventId: x.ev })),
  };
  const okOf = (r) => (typeof r.status === 'number' && r.body ? r.status === 200 : r.ok === true);

  beforeAll(async () => {
    guardEventsAtStart = networkGuard.getState().events.length;
    PNG = await sharp({ create: { width: 4, height: 4, channels: 3, background: '#ffffff' } }).png().toBuffer();
  });
  beforeEach(async () => {
    show = await mkShow('PR 2');
    w = await world();
    for (const k of ['FAL_KEY', 'AI_DAILY_IMAGE_BUDGET_USD', 'AI_DAILY_BUDGET_USD', 'ANTHROPIC_API_KEY']) saved[k] = process.env[k];
    process.env.FAL_KEY = 'test-fal';
    process.env.AI_DAILY_IMAGE_BUDGET_USD = '100000';
    process.env.AI_DAILY_BUDGET_USD = '100000';
    delete process.env.ANTHROPIC_API_KEY;
    mockS3Send.mockReset();
    mockS3Send.mockImplementation(async () => ({}));
    axios.get.mockImplementation(async () => ({ data: PNG }));
    let n = 0;
    axios.post.mockImplementation(async (url) => {
      if (!String(url).startsWith('https://fal.run/')) throw new Error(`unexpected provider call ${url}`);
      n += 1;
      return { status: 200, data: { images: [{ url: `https://fal.media/pr2-${n}.jpg` }] } };
    });
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    usageLog = jest.spyOn(models.AIUsageLog, 'create');
    pause = jest.spyOn(placeLock.finalizePlaceWrite.retryPause, 'sleep');
  });
  afterEach(async () => {
    for (const result of usageLog?.mock.results || []) {
      const row = result.type === 'return' ? await Promise.resolve(result.value).catch(() => null) : null;
      if (row?.id != null) usageLogIds.push(row.id);
    }
    for (const close of open.splice(0).reverse()) await close();
    if (trace) {
      trace.uninstall();
      trace = null;
    }
    jest.restoreAllMocks();
    for (const k of Object.keys(saved)) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  });
  afterAll(async () => {
    await sleep(500);
    if (usageLogIds.length) await run('DELETE FROM ai_usage_logs WHERE id IN (:ids)', { ids: usageLogIds });
    for (const s of fx.made.shows) {
      await run('DELETE FROM episode_raw_clips WHERE episode_id IN (SELECT id FROM episodes WHERE show_id = :s)', { s });
      await run('DELETE FROM episode_scripts WHERE episode_id IN (SELECT id FROM episodes WHERE show_id = :s)', { s }).catch((err) => console.error('cleanup:', err.message));
    }
    if (fx.made.sets.length) await run('DELETE FROM scene_angles WHERE scene_set_id IN (:ids)', { ids: fx.made.sets });
    await fx.cleanup();
  });

  // ══ The order ══════════════════════════════════════════════════════════
  describe('the order each writer takes its locks in', () => {
    test.each(Object.keys(WRITERS))('%s: the linked episode FOR SHARE, then the event row, then a set row; and the move it makes is as before', async (name) => {
      const x = await eventOnly();
      const t = tracing();
      const res = await WRITERS[name](x, w.t);
      expect(okOf(res)).toBe(true);
      expect(await setOf(x.ev)).toBe(w.t);
      expect(await linksOf(x.ep)).toEqual([{ scene_set_id: w.t, role: 'event' }]);
      const moved = t.records.find((r) => r.txId && r.kind === 'write' && r.table === 'world_events');
      const locks = t.records.filter((r) => r.txId === moved.txId && r.kind === 'lock');
      expect(locks[0]).toMatchObject({ table: 'episodes', mode: 'share' });
      expect(locks[0].ids).toEqual([x.ep]);
      expect(locks[1]).toMatchObject({ table: 'world_events' });
      const firstSet = locks.findIndex((r) => r.table === 'scene_sets');
      expect(firstSet).toBeGreaterThan(1);
      expect(locks.slice(0, firstSet).every((r) => r.table === 'episodes' || r.table === 'world_events')).toBe(true);
      expect(lockErrors()).toEqual([]);
    });

    test('W4 makeEveryday returning three episodes\' events, held at one version through two events: ONE ascending episode statement before any event lock; the events ascending; then the set row', async () => {
      // Two events at the version set T; one has two linked episodes (its stamp and another episode's brief).
      const a = await eventOnly(w.s);
      expect((await settle(makeEventVersion(sequelize, { setId: w.t, everydaySetId: w.v, eventId: a.ev }))).ok).toBe(true);
      const extra = await mkEpisode(show);
      await mkBrief(show, extra, a.ev);
      const b = await eventOnly(w.t);
      const t = tracing();
      const res = await settle(makeEveryday(sequelize, w.t, { returnEvent: true }));
      if (!res.ok) throw res.error;
      const moved = t.records.find((r) => r.txId && r.kind === 'write' && r.table === 'world_events');
      const locks = t.records.filter((r) => r.txId === moved.txId && r.kind === 'lock');
      const episodes = [a.ep, extra, b.ep].sort();
      expect(locks[0]).toMatchObject({ table: 'episodes', mode: 'share' });
      expect([...locks[0].ids].sort()).toEqual(episodes);
      expect(locks.filter((r) => r.table === 'episodes')).toHaveLength(1);
      expect(locks.slice(1, 3).map((r) => [r.table, r.ids[0]])).toEqual([a.ev, b.ev].sort().map((id) => ['world_events', id]));
      expect(locks[3].table).toBe('scene_sets');
      expect(await setOf(a.ev)).toBe(w.v);
      expect(await setOf(b.ev)).toBe(w.v);
    });

    test('inject: its own episode FOR UPDATE, taken before the script save\'s own lock and before the event row; the episode is given its location at the event\'s set', async () => {
      const target = await mkEpisode(show);
      const ev = await mkEvent(show, { set: w.s });
      const t = tracing();
      const res = await inject(ev, target);
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ success: true, attached: true, scene_set_linked: true });
      const firstEvent = t.records.findIndex((r) => r.txId && r.kind === 'lock' && r.table === 'world_events');
      const tx = t.records[firstEvent].txId;
      const inTx = t.records.filter((r) => r.txId === tx);
      const firstLock = inTx.find((r) => r.kind === 'lock');
      expect(firstLock).toMatchObject({ table: 'episodes', mode: 'update' });
      expect(firstLock.ids).toEqual([target]);
      expect(firstLock.sql).toBe('SELECT id FROM episodes WHERE id IN (:ids) ORDER BY id FOR UPDATE'); // lockEpisodes, not the script save's own
      expect(inTx.indexOf(firstLock)).toBeLessThan(inTx.findIndex((r) => r.kind === 'lock' && r.table === 'world_events'));
      expect(await linksOf(target)).toEqual([{ scene_set_id: w.s, role: 'event' }]);
    });

    // The route refuses an event another episode already holds (the terms
    // lock) before it locks anything, so inject's union with OTHER linked
    // episodes cannot be reached through the route. It is exercised here on
    // the helper the route calls (services/eventPlaceSync
    // shareLinkedEpisodes with an exclusive episode), with real locks.
    test.each([['lowest', 0], ['in the middle', 1], ['highest', 2]])(
      'inject\'s union of episodes, its own episode\'s id the %s: one ascending pass, that episode FOR UPDATE and the others FOR SHARE; no row is shared first and strengthened later, the script save\'s own FOR UPDATE included',
      async (_where, at) => {
        const ids = [await mkEpisode(show), await mkEpisode(show), await mkEpisode(show)].sort();
        const target = ids[at];
        const others = ids.filter((id) => id !== target);
        const ev = await mkEvent(show, { set: w.s, stamp: others[0] });
        await mkBrief(show, others[1], ev);
        const t = tracing();
        const holder = await holdTransaction();
        await require('../../src/services/eventPlaceSync').shareLinkedEpisodes(sequelize, ev, { transaction: holder, exclusive: [target] });
        // What the script save does next, in the same transaction: its own FOR UPDATE on its episode.
        const ownLock = await models.Episode.findByPk(target, { transaction: holder, lock: holder.LOCK.UPDATE });
        const asked = t.records.filter((r) => r.kind === 'lock' && r.table === 'episodes').map((r) => [r.ids[0], r.mode]);
        // Ascending, each row in the mode it needs from the first.
        expect(asked.slice(0, 3)).toEqual(ids.map((id) => [id, id === target ? 'update' : 'share']));
        // Per row, the first mode asked is the strongest ever asked: nothing is strengthened in place.
        const first = new Map();
        for (const [id, mode] of asked) {
          if (!first.has(id)) first.set(id, mode);
          else expect([first.get(id), mode]).not.toEqual(['share', 'update']);
        }
        // The script save's own FOR UPDATE (the model's statement, run above after the pass) found its row already
        // held FOR UPDATE by this transaction: the row's first lock was the exclusive one.
        expect(first.get(target)).toBe('update');
        expect(ownLock.id).toBe(target);
        // Really held so: the target refuses a share lock; another gives a share lock (a clip upload's) and refuses an exclusive one.
        const probe = async (id, how) => {
          const tx = await sequelize.transaction();
          try {
            await sequelize.query(`SELECT id FROM episodes WHERE id = :id ${how} NOWAIT`, { replacements: { id }, transaction: tx });
            return true;
          } catch (err) {
            if (isLockConflict(err)) return false;
            throw err;
          } finally {
            await tx.rollback();
          }
        };
        expect(await probe(target, 'FOR SHARE')).toBe(false);
        for (const id of others) {
          expect(await probe(id, 'FOR SHARE')).toBe(true);
          expect(await probe(id, 'FOR UPDATE')).toBe(false);
        }
      });

    // An additional defect found in an already authorized writer: inject read
    // the event before its transaction and linked the episode at THAT set,
    // though the event could be moved before inject locked it.
    test('[real lock] inject and an event moved between inject\'s first read and its event lock: the episode\'s Event location is the set the event has, not the one inject read; no stale link, no deadlock', async () => {
      const ep = await mkEpisode(show);
      const ev = await mkEvent(show, { set: w.s });
      // Inject has read the event (held at S) and locked its episode; the event row is not locked yet.
      const g = gateOn((rec) => Boolean(rec.txId) && rec.kind === 'lock' && rec.table === 'episodes');
      const pending = send(inject(ev, ep));
      await g.reached;
      // Another request moves the event to T and commits.
      const moved = await putEvent(ev, { scene_set_id: w.t });
      expect(moved.status).toBe(200);
      expect(await setOf(ev)).toBe(w.t);
      g.open();
      const res = await pending;
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ success: true, attached: true, scene_set_linked: true, scene_set: { status: 'linked', scene_set_id: w.t } });
      expect(JSON.stringify(res.body)).not.toMatch(NOT_DATABASE_TEXT);
      expect(lockErrors()).toEqual([]);
      // The event is where the edit put it, attached to the episode; the episode's one location is there.
      expect(await eventRow(ev)).toMatchObject({ scene_set_id: w.t, used_in_episode_id: ep });
      expect(await linksOf(ep)).toEqual([{ scene_set_id: w.t, role: 'event' }]);
      expect(await rows('SELECT id FROM scene_set_episodes WHERE episode_id = :ep AND scene_set_id = :s', { ep, s: w.s })).toEqual([]);
    });
  });

  // ══ Writer against writer ══════════════════════════════════════════════
  describe('[real lock] two writers on one event, both orders: no deadlock, no 500, each answers for what it finds', () => {
    const PAIRS = [
      ['W1 the event edit', 'W3 makeEventVersion'], ['W2 scene-set-link', 'W3 makeEventVersion'],
      ['W1 the event edit', 'W2 scene-set-link'], ['W1 the event edit', 'W1 the event edit'], ['W3 makeEventVersion', 'W3 makeEventVersion'],
    ];
    test.each(PAIRS.flatMap(([a, b]) => (a === b ? [[a, b]] : [[a, b], [b, a]])))('%s first, then %s', async (first, second) => {
      const x = await eventOnly();
      const out = await race(() => WRITERS[first](x, w.t), () => WRITERS[second](x, w.u));
      clean(out);
      expect(okOf(out.a)).toBe(true);
      expect(out.how).toBe('blocked'); // the second waits for the event row
      // In turn: the event is where the second put it, or where the first did when the second was refused.
      const at = await setOf(x.ev);
      expect(at).toBe(okOf(out.b) ? w.u : w.t);
      expect((await linksOf(x.ep)).filter((l) => l.role === 'event')).toEqual([{ scene_set_id: at, role: 'event' }]);
      await noReferenceToARemovedSet();
    });

    test('W4 makeEveryday against W1 and W3, both orders', async () => {
      for (const other of ['W1 the event edit', 'W3 makeEventVersion']) {
        for (const everydayFirst of [true, false]) {
          const x = await eventOnly(w.s);
          const versionSet = await set('Version');
          expect((await settle(makeEventVersion(sequelize, { setId: versionSet, everydaySetId: w.v, eventId: x.ev }))).ok).toBe(true);
          await run('UPDATE scene_set_episodes SET deleted_at = NOW() WHERE episode_id = :ep', { ep: x.ep }); // no Event location row again
          const everyday = () => settle(makeEveryday(sequelize, versionSet, { returnEvent: true }));
          const writer = () => WRITERS[other](x, w.u);
          const out = everydayFirst ? await race(everyday, writer) : await race(writer, everyday);
          clean(out);
          expect([w.v, w.u]).toContain(await setOf(x.ev));
        }
      }
    });

    test('two relinking event edits on one event (the relink guard first, FOR UPDATE; then the share locks find those rows held): no deadlock', async () => {
      const one = await mkEpisode(show);
      const two = await mkEpisode(show);
      const ev = await mkEvent(show, { set: w.s });
      const out = await race(
        () => send(putEvent(ev, { used_in_episode_id: one, scene_set_id: w.t })),
        () => send(putEvent(ev, { used_in_episode_id: two, scene_set_id: w.u })));
      clean(out);
      expect(out.a.status).toBe(200);
    });
  });

  describe('[real lock] inject against the other writers on the same event, both orders', () => {
    test.each(Object.keys(WRITERS).flatMap((name) => [[name, true], [name, false]]))('%s (inject first: %s)', async (name, injectFirst) => {
      // The event is already attached to the episode (scene-set-link needs that); injecting it again is allowed.
      const x = await eventOnly(w.s);
      const { ep, ev } = x;
      const doInject = () => send(inject(ev, ep));
      const writer = () => WRITERS[name](x, w.t);
      const out = injectFirst ? await race(doInject, writer) : await race(writer, doInject);
      clean(out);
      expect(out.a.status === undefined ? out.a.ok : out.a.status < 500).toBe(true);
      await noReferenceToARemovedSet();
      // Whatever each answered, the episode has at most one Event location, and it is where the event is.
      const eventLinks = (await linksOf(ep)).filter((l) => l.role === 'event');
      expect(eventLinks.length).toBeLessThanOrEqual(1);
      if (eventLinks.length && (await eventRow(ev)).used_in_episode_id === ep) expect(eventLinks[0].scene_set_id).toBe(await setOf(ev));
    });

    test('two injects of one event into two episodes, and W4 against inject: no deadlock', async () => {
      const a = await mkEpisode(show);
      const b = await mkEpisode(show);
      const ev = await mkEvent(show, { set: w.s });
      const out = await race(() => send(inject(ev, a)), () => send(inject(ev, b)));
      clean(out);
      const x = await eventOnly(w.s);
      const versionSet = await set('Version');
      expect((await settle(makeEventVersion(sequelize, { setId: versionSet, everydaySetId: w.v, eventId: x.ev }))).ok).toBe(true);
      const late = await mkEpisode(show);
      const again = await race(() => settle(makeEveryday(sequelize, versionSet, { returnEvent: true })), () => send(inject(x.ev, late)));
      clean(again);
    });
  });

  // ══ An episode linked after discovery ══════════════════════════════════
  describe('[real lock] an episode linked to the event after its episodes were locked', () => {
    /** A brief for a new episode naming the event, committed once the writer has locked the episodes it knew of. */
    const afterEpisodeLocks = (rec) => Boolean(rec.txId) && rec.kind === 'lock' && rec.table === 'episodes';

    test.each(Object.keys(WRITERS))('%s: rolled back, one pause outside any transaction, and the second try holds the new episode too', async (name) => {
      const x = await eventOnly();
      const g = gateOn(afterEpisodeLocks);
      const pending = WRITERS[name](x, w.t);
      await g.reached;
      const late = await mkEpisode(show);
      await mkBrief(show, late, x.ev);
      let during = null;
      pause.mockImplementation(async () => { during = await othersInTransaction(); });
      g.open();
      const res = await pending;
      expect(okOf(res)).toBe(true);
      expect(pause.mock.calls).toEqual([[DELAY]]);
      expect(during).toBe(0);
      const tries = [...trace.byTransaction().values()].filter((t) => t.some((r) => r.kind === 'lock' && r.table === 'world_events'));
      expect(tries).toHaveLength(2);
      expect(tries[0].some((r) => r.kind === 'rollback')).toBe(true);
      expect(tries[0].some((r) => r.kind === 'write' || r.kind === 'insert')).toBe(false);
      expect([...tries[1].find((r) => r.kind === 'lock' && r.table === 'episodes').ids].sort()).toEqual([x.ep, late].sort());
      expect(await setOf(x.ev)).toBe(w.t);
    });

    test('an episode linked on every try (W1): three tries, two pauses, 409 RETRY in the existing shape, nothing written', async () => {
      const x = await eventOnly();
      const before = await snapshot();
      const real = sequelize.query;
      const made = [];
      jest.spyOn(sequelize, 'query').mockImplementation(async function wrapped(sql, options) {
        const out = await real.call(this, sql, options);
        if (options?.transaction && /^SELECT id FROM episodes WHERE id IN/.test(flat(sql))) {
          const late = await mkEpisode(show);
          await mkBrief(show, late, x.ev);
          made.push(late);
        }
        return out;
      });
      pause.mockImplementation(async () => {});
      const res = await putEvent(x.ev, { scene_set_id: w.t });
      expect(res.status).toBe(409);
      expect(res.body).toEqual(RETRY);
      expect(made).toHaveLength(3);
      expect(pause.mock.calls).toEqual([[DELAY], [DELAY]]);
      const after = await snapshot();
      expect(after.events).toEqual(before.events);
      expect(after.links).toEqual(before.links);
    });
  });

  // ══ A set removed, or held ═════════════════════════════════════════════
  describe('[real lock] the set the event is being moved to: removed in the delete\'s order (SIMULATED) while the writer waits, or held', () => {
    test.each([
      ['W1 the event edit', (r) => expect([r.status, r.body.code]).toEqual([400, 'INVALID_SCENE_SET_ID'])],
      ['W2 scene-set-link', (r) => expect([r.status, r.body.scene_set.status, r.body.scene_set.reason]).toEqual([200, 'needs_reconnecting', 'The event\'s scene set no longer exists.'])],
      ['W3 makeEventVersion', (r) => expect([r.ok, r.status, r.code]).toEqual([false, 404, 'SET_NOT_FOUND'])],
    ])('%s: it steps back from the held set row (never waits for it), and once the set is removed it is refused with the route\'s existing answer; the event is never pointed at the removed set', async (name, refused) => {
      const x = await eventOnly();
      tracing();
      const del = deleteInItsOrder(w.t);
      await del.held;
      pause.mockImplementation(async () => { del.release(); await del.done; });
      const res = await WRITERS[name](x, w.t);
      refused(res);
      expect(lockErrors()).toEqual(['55P03']);
      expect(pause.mock.calls).toEqual([[DELAY]]);
      expect(await removedAt(w.t)).not.toBeNull();
      expect(await setOf(x.ev)).toBe(w.s);
      expect(await linksOf(x.ep)).toEqual([]);
      await noReferenceToARemovedSet();
    });

    test.each(Object.keys(WRITERS))('%s: the set row held throughout: three tries, two pauses outside any transaction, then the retryable answer; nothing changed', async (name) => {
      const x = await eventOnly();
      const before = await snapshot();
      tracing();
      await holdRow('scene_sets', w.t);
      const during = [];
      pause.mockImplementation(async () => { during.push(await othersInTransaction()); });
      const res = await WRITERS[name](x, w.t);
      if (typeof res.status === 'number' && res.body) {
        expect(res.status).toBe(409);
        expect(res.body).toEqual(RETRY);
      } else {
        expect([res.ok, res.status, res.code, res.error.message]).toEqual([false, 409, 'RETRY', RETRY.error]);
      }
      expect(lockErrors()).toEqual(['55P03', '55P03', '55P03']);
      expect(pause.mock.calls).toEqual([[DELAY], [DELAY]]);
      expect(during).toEqual([1, 1]); // only the holder
      expect(await snapshot()).toEqual(before);
    });

    test('W4: the everyday set removed (SIMULATED delete order) while it waits for the event row: refused EVERYDAY_GONE, the event stays at its version', async () => {
      const x = await eventOnly(w.s);
      const everydaySet = await set('Everyday');
      expect((await settle(makeEventVersion(sequelize, { setId: w.t, everydaySetId: everydaySet, eventId: x.ev }))).ok).toBe(true);
      const del = deleteInItsOrder(everydaySet);
      await del.held;
      tracing();
      pause.mockImplementation(async () => { del.release(); await del.done; });
      const res = await settle(makeEveryday(sequelize, w.t, { returnEvent: true }));
      expect([res.ok, res.status, res.code]).toEqual([false, 409, 'EVERYDAY_GONE']);
      expect(await setOf(x.ev)).toBe(w.t);
      await noReferenceToARemovedSet();
    });

    test('inject with no set on the event and one set at its venue: that set removed (SIMULATED) while inject steps back from it: the event is attached, no link is made to the removed set', async () => {
      const place = await mkLocation('PR 2 venue');
      const only = await set('Only set', 'EVENT_LOCATION', { world_location_id: place });
      const ep = await mkEpisode(show);
      const ev = await mkEvent(show, { loc: place });
      const del = deleteInItsOrder(only);
      await del.held;
      tracing();
      pause.mockImplementation(async () => { del.release(); await del.done; });
      const res = await inject(ev, ep);
      expect(res.status).toBe(200);
      expect(res.body.scene_set_linked).toBe(false);
      expect(JSON.stringify(res.body.scene_set)).not.toMatch(NOT_DATABASE_TEXT);
      expect(await setOf(ev)).toBeNull();
      expect(await linksOf(ep)).toEqual([]);
      await noReferenceToARemovedSet();
    });
  });

  // ══ Against the delete's order (SIMULATED) ═════════════════════════════
  describe('[real lock] against a session in the delete\'s lock order (SIMULATED: episodes FOR UPDATE, events FOR UPDATE, the set row NOWAIT), removing the event\'s CURRENT set', () => {
    test.each(Object.keys(WRITERS))('%s, the delete first: the writer waits for the episode row (not the event), no deadlock; then it moves the event', async (name) => {
      const x = await eventOnly();
      tracing();
      const del = deleteInItsOrder(w.s, { episodes: [x.ep], events: [x.ev] });
      await del.held;
      const pending = WRITERS[name](x, w.t);
      const end = Date.now() + 8000;
      while (await waiting() === 0 && Date.now() < end) await sleep(15);
      expect(await rows("SELECT query FROM pg_stat_activity WHERE datname = current_database() AND wait_event_type = 'Lock' AND query ILIKE '%FROM episodes%'")).toHaveLength(1);
      del.release();
      const [res, deleted] = await Promise.all([pending, del.done]);
      expect(deleted.ok).toBe(true);
      expect(okOf(res)).toBe(true);
      expect(lockErrors().filter((e) => e === '40P01')).toEqual([]);
      expect(await setOf(x.ev)).toBe(w.t);
      await noReferenceToARemovedSet();
    });

    test.each(Object.keys(WRITERS))('%s, the writer first (holding the event row): the delete\'s session waits for the episode; no deadlock; both finish', async (name) => {
      const x = await eventOnly();
      const g = gateOn(holdsEventRow);
      const pending = WRITERS[name](x, w.t);
      await g.reached;
      const del = deleteInItsOrder(w.s, { episodes: [x.ep], events: [x.ev] });
      const end = Date.now() + 8000;
      while (await waiting() === 0 && Date.now() < end) await sleep(15);
      expect(await waiting()).toBe(1); // the delete's session, at the episode row the writer holds FOR SHARE
      del.release();
      g.open();
      const [res, deleted] = await Promise.all([pending, del.done]);
      expect(okOf(res)).toBe(true);
      expect(deleted.ok).toBe(true);
      expect(lockErrors().filter((e) => e === '40P01')).toEqual([]);
      expect(await setOf(x.ev)).toBe(w.t);
    });

    test('inject, both orders against the delete\'s order on the event\'s set: no deadlock', async () => {
      for (const deleteFirst of [true, false]) {
        const ep = await mkEpisode(show);
        const mine = await set('Mine');
        const ev = await mkEvent(show, { set: mine });
        tracing();
        let res;
        let deleted;
        if (deleteFirst) {
          const del = deleteInItsOrder(mine, { events: [ev] });
          await del.held;
          const pending = send(inject(ev, ep));
          const end = Date.now() + 8000;
          while (await waiting() === 0 && Date.now() < end) await sleep(15);
          del.release();
          [res, deleted] = await Promise.all([pending, del.done]);
        } else {
          const g = gateOn(holdsEventRow);
          const pending = send(inject(ev, ep));
          await g.reached;
          const del = deleteInItsOrder(mine, { episodes: [ep], events: [ev] });
          const end = Date.now() + 8000;
          while (await waiting() === 0 && Date.now() < end) await sleep(15);
          del.release();
          g.open();
          [res, deleted] = await Promise.all([pending, del.done]);
        }
        expect(res.status).toBeLessThan(500);
        expect(deleted.lock).toBeFalsy();
        expect(lockErrors().filter((e) => e === '40P01')).toEqual([]);
        trace.uninstall();
        trace = null;
      }
    });
  });

  // ══ Accepted and filmed ════════════════════════════════════════════════
  describe('an accepted episode keeps its Place; a filmed, not accepted one does not yet (RECORDED GAP)', () => {
    test('each writer on an event whose episode is accepted: 409 PLACE_LOCKED, decided inside the transaction under the locks; nothing written', async () => {
      const x = await eventOnly();
      await fx.setEvaluation(x.ep, 'accepted');
      const before = await snapshot();
      const one = await putEvent(x.ev, { scene_set_id: w.t });
      expect([one.status, one.body]).toEqual([409, { success: false, error: PLACE_LOCKED_MESSAGE, code: PLACE_LOCKED_CODE }]);
      const three = await WRITERS['W3 makeEventVersion'](x, w.t);
      expect([three.ok, three.status, three.code]).toEqual([false, 409, PLACE_LOCKED_CODE]);
      // W2: its early check answers the same; with that check passed (the acceptance committing after it), the one in the transaction refuses.
      expect((await linkSet(x.ev, w.t)).body).toEqual(LOCKED);
      await fx.setEvaluation(x.ep, 'pending');
      const g = gateOn((rec, sql) => !rec.txId && /FROM scene_sets s WHERE id = :setId AND deleted_at IS NULL/.test(sql)); // after W2's early checks
      const pending = send(linkSet(x.ev, w.t));
      await g.reached;
      await fx.setEvaluation(x.ep, 'accepted');
      g.open();
      const two = await pending;
      expect([two.status, two.body]).toEqual([409, LOCKED]);
      expect(await snapshot()).toEqual(before);
      // W4.
      const y = await eventOnly(w.s);
      expect((await settle(makeEventVersion(sequelize, { setId: w.u, everydaySetId: w.v, eventId: y.ev }))).ok).toBe(true);
      await fx.setEvaluation(y.ep, 'accepted');
      const four = await settle(makeEveryday(sequelize, w.u, { returnEvent: true }));
      expect([four.ok, four.status, four.code]).toEqual([false, 409, PLACE_LOCKED_CODE]);
      expect(await setOf(y.ev)).toBe(w.u);
    });

    test.each(['W1 the event edit', 'W3 makeEventVersion'])('[real lock] a real acceptance (completeEpisode) racing %s, both orders: they take turns; accepted first, the writer is refused PLACE_LOCKED', async (name) => {
      const x = await eventOnly();
      const acceptance = () => settle(completeEpisode(x.ep, show, sequelize));
      const first = await race(acceptance, () => WRITERS[name](x, w.t), (rec) => Boolean(rec.txId) && rec.kind === 'lock' && rec.table === 'episodes' && rec.mode === 'update');
      if (!first.a.ok) throw first.a.error;
      clean(first);
      expect(first.how).toBe('blocked');
      expect(okOf(first.b)).toBe(false);
      expect(first.b.body ? first.b.body.code : first.b.code).toBe(PLACE_LOCKED_CODE);
      expect(await setOf(x.ev)).toBe(w.s);

      const y = await eventOnly();
      const second = await race(() => WRITERS[name](y, w.t), () => settle(completeEpisode(y.ep, show, sequelize)));
      clean(second);
      expect(okOf(second.a)).toBe(true);
      if (!second.b.ok) throw second.b.error;
      expect(await evaluationOf(y.ep)).toBe('accepted');
      expect(await setOf(y.ev)).toBe(w.t);
    });

    test('RECORDED GAP (held; not changed by this work): a FILMED, not accepted episode\'s event is still moved by the event edit, scene-set-link and makeEventVersion', async () => {
      const observed = {};
      for (const name of Object.keys(WRITERS)) {
        const x = await eventOnly();
        await film(x.ep);
        const to = await set('Target'); // one each: an event version is one event's
        const res = await WRITERS[name](x, to);
        observed[name] = [okOf(res) ? 'moved' : (res.body?.code || res.code || res.status), (await setOf(x.ev)) === to];
      }
      // Today's behaviour, pinned: none of them refuses a filmed episode (no EPISODE_SNAPSHOT_FROZEN here).
      expect(observed).toEqual({ 'W1 the event edit': ['moved', true], 'W2 scene-set-link': ['moved', true], 'W3 makeEventVersion': ['moved', true] });
    });
  });

  // ══ scene-set-link's savepoint, and the version routes' errors ═════════
  describe('[injected] failures inside scene-set-link\'s savepoint and in the version routes', () => {
    test.each([['55P03'], ['40P01']])('a lock conflict (%s) at the link insert: tried again, then 409 RETRY; the event is not moved and no database text is sent', async (code) => {
      const x = await eventOnly();
      const before = await snapshot();
      const spy = failStatement(/^INSERT INTO scene_set_episodes/, code);
      pause.mockImplementation(async () => {});
      const res = await linkSet(x.ev, w.t);
      spy.mockRestore();
      expect(res.status).toBe(409);
      expect(res.body).toEqual(RETRY);
      expect(pause.mock.calls).toEqual([[DELAY], [DELAY]]);
      expect(await snapshot()).toEqual(before); // the outer transaction rolled back: the event's move too
    });

    test('any other failure at the link insert: 200 needs_reconnecting with a fixed reason and nothing of the database\'s; the savepoint rolled back', async () => {
      const x = await eventOnly();
      const spy = failStatement(/^INSERT INTO scene_set_episodes/, '23503');
      const res = await linkSet(x.ev, w.t);
      spy.mockRestore();
      expect(res.status).toBe(200);
      expect(res.body.scene_set).toEqual({ status: 'needs_reconnecting', scene_set_id: w.t, reason: 'The scene set could not be linked. Try again, or choose a scene set.' });
      expect(JSON.stringify(res.body)).not.toMatch(NOT_DATABASE_TEXT);
      expect(await setOf(x.ev)).toBe(w.s);
      expect(pause).not.toHaveBeenCalled();
    });

    test('the version route: a lock conflict is 409 RETRY; an unknown failure is a fixed 500, not the error\'s text', async () => {
      const x = await eventOnly();
      await holdRow('scene_sets', w.t);
      pause.mockImplementation(async () => {});
      const busy = await version(w.t, { everyday_set_id: w.v, event_id: x.ev });
      expect([busy.status, busy.body]).toEqual([409, { success: false, code: 'RETRY', error: RETRY.error }]);
      const spy = failStatement(/^UPDATE scene_sets SET version_of_set_id = :everydayId/, '23503');
      const failed = await version(w.u, { everyday_set_id: w.v, event_id: x.ev });
      spy.mockRestore();
      expect([failed.status, failed.body]).toEqual([500, { success: false, error: 'The scene set version could not be read or changed. Nothing was changed.' }]);
    });
  });

  // ══ The finalizer's callers ════════════════════════════════════════════
  describe('[real lock] against the writers that already took the Place order (the finalizer): both orders, no deadlock', () => {
    const FINALIZERS = {
      'a Locations save that moves the event': async () => {
        const x = await eventOnly();
        return { x, go: () => send(save(x.ep, [loc('event', w.u), loc('home', w.home)])) };
      },
      'generate-venue (a base for the event\'s own set, which has none)': async () => {
        const place = await mkLocation('PR 2 venue');
        const bare = await mkSet(show, `Bare ${fx.uuid().slice(0, 6)}`, { scene_type: 'EVENT_LOCATION', generation_status: 'pending', world_location_id: place, base_model: 'flux-dev' });
        const ep = await mkEpisode(show);
        const ev = await mkEvent(show, { stamp: ep, set: bare, loc: place });
        await mkBrief(show, ep, ev);
        return { x: { ep, ev }, go: () => send(generateVenue(ev)) };
      },
    };
    test.each(Object.keys(FINALIZERS).flatMap((f) => ['W1 the event edit', 'W3 makeEventVersion'].flatMap((wr) => [[f, wr, true], [f, wr, false]])))(
      '%s against %s (the finalizer first: %s)', async (f, name, finalizerFirst) => {
        const { x, go } = await FINALIZERS[f]();
        const writer = () => WRITERS[name](x, w.t);
        const out = finalizerFirst ? await race(go, writer) : await race(writer, go);
        clean(out);
        expect(out.errors.filter((e) => e === '40P01')).toEqual([]);
        await noReferenceToARemovedSet();
        // The event is at one of the sets a serial order leaves it at, and the episode's Event location is there too.
        const at = await setOf(x.ev);
        const eventLinks = (await linksOf(x.ep)).filter((l) => l.role === 'event');
        if (eventLinks.length) expect(eventLinks).toEqual([{ scene_set_id: at, role: 'event' }]);
      });

    test('Start Episode against W1 on its event, both orders: no deadlock; Start is refused as stale or starts on the set it was shown', async () => {
      for (const startFirst of [true, false]) {
        const ev = await mkEvent(show, { set: w.s });
        const doStart = () => send(start(ev, { locations: [loc('event', w.s), loc('home', w.home)], event_scene_set_id: w.s }));
        const edit = () => send(putEvent(ev, { scene_set_id: w.t }));
        const out = startFirst ? await race(doStart, edit) : await race(edit, doStart);
        clean(out);
        expect([200, 201, 409]).toContain(out.a.status);
        expect([200, 201, 409]).toContain(out.b.status);
      }
    });
  });

  describe('the network guard', () => {
    test('no external network attempt in this file', () => {
      const mine = networkGuard.getState().events.slice(guardEventsAtStart);
      expect(mine.filter((e) => e.type === 'attempt')).toEqual([]);
    });
  });
});
