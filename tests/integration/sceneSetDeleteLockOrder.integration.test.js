/**
 * C1, PR 1 (Evoni, 2026-11-24;
 * docs/audit/F-AUTH-1_SceneSetDeleteLockOrder_Amendment_2026-11-24.md): the
 * Scene Set delete path (DELETE /api/v1/scene-sets/:id, with a replacement
 * or "delete anyway") takes its locks in the Place order, in one transaction
 * per attempt (sceneSetUsesService.withSetLocks):
 *
 *   every affected episode FOR UPDATE, ascending id (those that use the set
 *   directly and those linked to an event held at it) -> each such event ->
 *   the set rows, NOWAIT, in one statement -> the reference set read again
 *   (grown: rolled back, a pause outside any transaction, a new transaction)
 *   -> the checks (approved base, locked Place, accepted use, filmed use)
 *   -> the writes, as they were.
 *
 * On the migrated test database, through the real app and the real
 * services. REAL LOCKS: every race here is two real writers, one held open
 * at a statement by the lock trace's gate (its locks really held), or a real
 * row lock held by another transaction. [injected] cases make one statement
 * throw to prove the rollback. Nothing sleeps to wait for a lock, and
 * nothing sends DDL.
 *
 * KNOWN INCOMPATIBILITY (the last describe): until PR 2 changes the four
 * event-first writers, this order deadlocks against them when the writer
 * goes first. Those cases assert what really happens on this code. PR 1 is
 * not to be deployed without PR 2.
 */
jest.unmock('uuid');
process.env.S3_PRIMARY_BUCKET = 'pr1-test-bucket';

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

const fs = require('fs');
const request = require('supertest');
const sharp = require('sharp');
const axios = require('axios');
const app = require('../../src/app');
const TokenService = require('../../src/services/tokenService');
const models = require('../../src/models');
const placeLock = require('../../src/utils/placeLock');
const { isLockConflict } = require('../../src/utils/episodeLocks');
const uses = require('../../src/services/sceneSetUsesService');
const rawClips = require('../../src/services/rawClipsService');
const { completeEpisode } = require('../../src/services/episodeCompletionService');
const { seedArc } = require('../../src/services/arcProgressionService');
const { makeEventVersion, makeEveryday } = require('../../src/services/sceneSetVersionService');
const sceneGen = require('../../src/services/sceneGenerationService');
const lockTrace = require('../helpers/lockTrace');
const networkGuard = require('../networkGuard/core');
const { placeLockFixtures } = require('../helpers/placeLockFixtures');

const { sequelize } = models;
const { PLACE_LOCKED_CODE } = placeLock;
const DELAY = sceneGen.PLACE_FINALIZE_RETRY_DELAY_MS;

const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const RETRY = { success: false, code: 'RETRY', error: 'Someone else changed this at the same moment. Nothing was saved: try again.' };
const DELETE_FAILED = { success: false, error: 'The scene set could not be deleted. Nothing was changed.' };
const NOT_DATABASE_TEXT = /deadlock|violates|constraint|SELECT |UPDATE |INSERT |relation|syntax|sequelize|canceling statement|lock timeout/i;
const databaseError = () => Object.assign(new Error('violates foreign key constraint "x_fkey"'), { name: 'SequelizeForeignKeyConstraintError', original: { code: '23503' } });

const open = [];
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const settle = (promise) => promise.then(
  (value) => ({ ok: true, value }),
  (error) => ({ ok: false, error, lock: isLockConflict(error) ? (error.original?.code || error.parent?.code || error.code) : null }));
const send = (req) => req.then((res) => res);
const flat = (sql) => String(sql).replace(/\s+/g, ' ').trim();
// What each race did, for the report (written when PR1_OBSERVED_FILE is set).
const observed = [];

(shouldSkip ? describe.skip : describe)('C1 PR 1: the Scene Set delete path takes its locks in the Place order', () => {
  jest.setTimeout(Number(process.env.PR1_TEST_TIMEOUT_MS) || 90000);
  const fx = placeLockFixtures(sequelize, models);
  const { run, rows, mkShow, mkEpisode, mkEvent, mkBrief, mkSet, mkLocation, evaluationOf, eventRow } = fx;
  const TAG = fx.uuid().slice(0, 8);
  let show;
  let editorToken;
  let trace = null;
  let pause = null;
  let PNG;
  let guardEventsAtStart = 0;
  let w; // the sets of the test's show
  const saved = {};
  const usageLogIds = [];
  let usageLog;

  let admins = 0;
  const adminToken = () => {
    admins += 1;
    return TokenService.generateTokenPair({ id: `pr1-admin-${TAG}-${admins}`, email: `admin${admins}@pr1.dev`, name: 'Admin', groups: ['ADMIN'], role: 'ADMIN' }).accessToken;
  };
  const asAdmin = (r) => r.set('X-Forwarded-For', `10.97.${Math.floor(admins / 250)}.${(admins % 250) + 1}`).set('Authorization', `Bearer ${adminToken()}`);
  const del = (id, query = '') => asAdmin(request(app).delete(`/api/v1/scene-sets/${id}${query}`)).send({});
  const into = (id) => `?replacement_id=${id}`;
  const ANYWAY = '?confirm_orphan=true';
  const save = (ep, locations) => asAdmin(request(app).put(`/api/v1/episodes/${ep}/locations`)).send({ locations });
  const start = (ev, body = {}, showId = show) => asAdmin(request(app).post(`/api/v1/world/${showId}/events/${ev}/generate-episode`)).send({ draft_script: false, ...body });
  const putEvent = (ev, body, showId = show) => asAdmin(request(app).put(`/api/v1/world/${showId}/events/${ev}`)).send(body);
  const linkSet = (ev, setId) => asAdmin(request(app).post(`/api/v1/world/${show}/events/${ev}/scene-set-link`)).send({ scene_set_id: setId });
  const uploadLook = (ev) => asAdmin(request(app).post(`/api/v1/world/${show}/events/${ev}/look/upload`)).attach('image', PNG, { filename: 'look.png', contentType: 'image/png' });
  const generateVenue = (ev) => asAdmin(request(app).post(`/api/v1/world/${show}/events/${ev}/generate-venue`)).send({});
  const loc = (role, id, name = null) => ({ role, scene_set_id: id, ...(name ? { name } : {}) });

  // ── Fixtures ───────────────────────────────────────────────────────────
  const set = (name, type = 'EVENT_LOCATION', showId = show, fields = {}) => mkSet(showId, `${name} ${fx.uuid().slice(0, 6)}`, { scene_type: type, base_still_url: `https://cdn.example/${fx.uuid()}.jpg`, ...fields });
  async function world(showId = show) {
    return {
      s: await set('Hall S', 'EVENT_LOCATION', showId), r: await set('Hall R', 'EVENT_LOCATION', showId), t: await set('Hall T', 'EVENT_LOCATION', showId),
      home: await set('Home', 'HOME_BASE', showId), home2: await set('Second home', 'HOME_BASE', showId),
    };
  }
  /** The episode uses the set directly: a location (link), a beat and the beat's scene row, or only some. */
  async function useDirect(ep, setId, { link = true, beat = true, scene = true, role = 'home', n = 1 } = {}) {
    if (link) {
      await run(`INSERT INTO scene_set_episodes (id, scene_set_id, episode_id, sort_order, role, created_at, updated_at)
                 VALUES (:id, :set, :ep, 0, :role, NOW(), NOW())`, { id: fx.uuid(), set: setId, ep, role });
    }
    let plan = null;
    if (beat || scene) {
      plan = fx.uuid();
      await run(`INSERT INTO scene_plans (id, episode_id, beat_number, beat_name, scene_set_id, angle_label, locked, chosen_by_user, sort_order, ai_suggested, created_at, updated_at)
                 VALUES (:id, :ep, :n, 'Beat', :at, 'WIDE', false, false, :n, false, NOW(), NOW())`, { id: plan, ep, n, at: beat ? setId : null });
    }
    if (scene) {
      await run(`INSERT INTO scenes (id, episode_id, scene_plan_id, scene_number, title, location, background_url, scene_set_id, scene_angle_id,
                                     duration_seconds, characters, ui_elements, dialogue_clips, scene_type, production_status, created_at, updated_at)
                 VALUES (:id, :ep, :plan, :n, 'Scene', 'Hall', 'https://cdn.example/bg.jpg', :at, NULL, 5.0, '[]', '[]', '[]', 'main', 'draft', NOW(), NOW())`,
      { id: fx.uuid(), ep, plan, n, at: setId });
    }
  }
  /** A draft episode that uses the set directly. */
  async function direct(setId = w.s, how = {}) {
    const ep = await mkEpisode(show);
    await useDirect(ep, setId, how);
    return ep;
  }
  /** A draft episode whose only use of the set is its event, held at it (no location row: "event-only"). brief: also its Brief's event. */
  async function eventOnly(setId = w.s, { brief = true } = {}) {
    const ep = await mkEpisode(show);
    const ev = await mkEvent(show, { stamp: ep, set: setId });
    if (brief) await mkBrief(show, ep, ev);
    return { ep, ev };
  }
  /** A draft episode with its event at the set and its stored locations (the Event location and a home), with beats at each. */
  async function placed(setId = w.s) {
    const { ep, ev } = await eventOnly(setId);
    await useDirect(ep, setId, { role: 'event', n: 10, scene: false });
    await useDirect(ep, w.home, { role: 'home', n: 1, scene: false });
    return { ep, ev };
  }
  async function film(ep, { removed = false } = {}) {
    const id = fx.uuid();
    await run(`INSERT INTO episode_raw_clips (id, episode_id, show_id, performer, s3_key_raw, key_status, key_strength, deleted_at, created_at, updated_at)
               VALUES (:id, :ep, :show, :performer, :key, 'none', 'medium', :deletedAt, NOW(), NOW())`,
    { id, ep, show, performer: rawClips.PERFORMERS?.[0] || 'lala', key: `raw/${id}.mp4`, deletedAt: removed ? new Date() : null });
    return id;
  }
  const clip = (ep) => rawClips.createClip(sequelize, { id: fx.uuid(), episode_id: ep, show_id: show, performer: rawClips.PERFORMERS?.[0] || 'lala', s3_key_raw: `raw/${fx.uuid()}.mp4` });
  const removedAt = async (id) => (await rows('SELECT deleted_at FROM scene_sets WHERE id = :id', { id }))[0].deleted_at;
  const liveRefs = async (id) => uses.countUses(sequelize, id);
  const linksOf = (ep) => rows('SELECT scene_set_id, role FROM scene_set_episodes WHERE episode_id = :ep AND deleted_at IS NULL ORDER BY sort_order, role', { ep });
  const episodeOf = async (ev) => (await eventRow(ev)).used_in_episode_id;

  /**
   * Every row a delete could change, for the test's show (and one given
   * beside it): each event's set; episode locations; beats (set, angle,
   * locked, chosen); scene rows (set, angle, background); looks; the shows'
   * defaults; characters' places; the sets with their versions; each
   * episode's evaluation; the clips.
   */
  async function snapshot(showId = show) {
    const by = { showId };
    return {
      events: await rows('SELECT id, scene_set_id, used_in_episode_id, deleted_at FROM world_events WHERE show_id = :showId ORDER BY id', by),
      links: await rows('SELECT l.id, l.scene_set_id, l.episode_id, l.role, l.role_name, l.sort_order, l.deleted_at FROM scene_set_episodes l JOIN episodes e ON e.id = l.episode_id WHERE e.show_id = :showId ORDER BY l.id', by),
      beats: await rows('SELECT p.id, p.scene_set_id, p.angle_label, p.locked, p.chosen_by_user, p.deleted_at FROM scene_plans p JOIN episodes e ON e.id = p.episode_id WHERE e.show_id = :showId ORDER BY p.id', by),
      scenes: await rows('SELECT s.id, s.scene_set_id, s.scene_angle_id, s.background_url, s.deleted_at FROM scenes s JOIN episodes e ON e.id = s.episode_id WHERE e.show_id = :showId ORDER BY s.id', by),
      looks: await rows('SELECT k.id, k.scene_set_id, k.event_id, k.status, k.image_url, k.deleted_at FROM scene_set_looks k JOIN world_events v ON v.id = k.event_id WHERE v.show_id = :showId ORDER BY k.id', by),
      shows: await rows('SELECT id, metadata FROM shows WHERE id = :showId', by),
      places: await rows('SELECT c.id, c.scene_set_id, c.deleted_at FROM character_places c JOIN scene_sets s ON s.id = c.scene_set_id WHERE s.show_id = :showId ORDER BY c.id', by),
      sets: await rows('SELECT id, deleted_at, version_of_set_id, generation_status FROM scene_sets WHERE show_id = :showId ORDER BY id', by),
      episodes: await rows('SELECT id, evaluation_status, deleted_at FROM episodes WHERE show_id = :showId ORDER BY id', by),
      clips: await rows('SELECT c.id, c.episode_id, c.deleted_at FROM episode_raw_clips c JOIN episodes e ON e.id = c.episode_id WHERE e.show_id = :showId ORDER BY c.id', by),
    };
  }

  // ── Locks, gates, races ────────────────────────────────────────────────
  async function holdTransaction() {
    const transaction = await sequelize.transaction();
    open.push(async () => { if (!transaction.finished) await transaction.rollback(); });
    return transaction;
  }
  /** [real lock] Another transaction holding a row. */
  async function holdRow(table, id, how = 'FOR UPDATE') {
    const holder = await holdTransaction();
    const [[me]] = await sequelize.query('SELECT pg_backend_pid() AS pid', { transaction: holder });
    await sequelize.query(`SELECT id FROM ${table} WHERE id = :id ${how}`, { replacements: { id }, transaction: holder });
    return { holder, pid: me.pid };
  }
  const inTransaction = (pid) => rows(
    `SELECT pid FROM pg_stat_activity
      WHERE datname = current_database() AND pid NOT IN (pg_backend_pid(), :pid) AND state LIKE 'idle in transaction%'`, { pid });
  const othersInTransaction = async () => (await rows(
    'SELECT count(*)::int AS n FROM pg_stat_activity WHERE datname = current_database() AND pid <> pg_backend_pid() AND xact_start IS NOT NULL'))[0].n;
  const waiting = async () => (await rows(
    "SELECT count(*)::int AS n FROM pg_stat_activity WHERE datname = current_database() AND pid <> pg_backend_pid() AND wait_event_type = 'Lock'"))[0].n;
  /** [real lock] Whether a row lock of this strength can be had right now (NOWAIT, in a transaction rolled back at once). */
  async function canLock(table, id, how) {
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
  /** The delete holding everything: its episodes, its events and its set rows (just after its one set-row statement). */
  const deleteHoldsAll = (rec, sql) => Boolean(rec.txId) && /^WITH gone AS/.test(sql);
  /** A transaction that has just locked an episode row FOR UPDATE (the delete, an acceptance). */
  const holdsEpisodeForUpdate = (rec) => Boolean(rec.txId) && rec.kind === 'lock' && rec.table === 'episodes' && rec.mode === 'update';
  /** A transaction that has just locked or written an event row. */
  const holdsEventRow = (rec) => Boolean(rec.txId) && rec.table === 'world_events' && (rec.kind === 'lock' || rec.kind === 'write');
  /** Start past its commit and its beats, holding the event row in its locations write. */
  const startSavingLocations = () => {
    let plansMade = false;
    return (rec) => {
      if (!rec.txId && rec.kind === 'insert' && rec.table === 'scene_plans') plansMade = true;
      return plansMade && Boolean(rec.txId) && rec.kind === 'lock' && rec.table === 'world_events';
    };
  };
  /** [injected] Makes the first statement in a transaction whose text matches throw as the database would. */
  function failStatement(pattern) {
    const real = sequelize.query.bind(sequelize);
    return jest.spyOn(sequelize, 'query').mockImplementation((sql, options) => {
      if (options?.transaction && pattern.test(flat(typeof sql === 'string' ? sql : sql?.query || sql))) return Promise.reject(databaseError());
      return real(sql, options);
    });
  }
  /**
   * [real locks] Two real writers. `first` runs until `gate` (its locks
   * held), then `second` starts. The gate opens once the second is seen
   * waiting for a lock, or when it steps back from one (its retry pause),
   * or when it has answered. A retry pause here waits until no other
   * session is inside a transaction, instead of 250 ms.
   * Resolves { a, b, how, errors, pauses }: how the second met the first
   * ('blocked' | 'done' | 'paused').
   */
  async function race(name, first, gate, second) {
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
    const out = { a, b, how, errors: lockErrors(trace.records), pauses: pause.mock.calls.length };
    const brief = (x) => (x && typeof x.status === 'number' ? `${x.status}${x.body?.code ? ` ${x.body.code}` : ''}` : (x && 'ok' in x ? (x.ok ? 'ok' : `threw ${x.error?.code || x.error?.name}`) : String(x)));
    observed.push({ name, first: brief(a), second: brief(b), how, errors: out.errors, pauses: out.pauses });
    // A 500 from either side is recorded with its body and what was logged, so a failing run explains itself.
    for (const x of [a, b]) {
      if (x && x.status >= 500) {
        observed.push({ name: `${name}: 500`, body: x.body, logged: console.error.mock?.calls.map((c) => c.map(String).join(' ').slice(0, 300)).slice(-6),
          statements: trace.records.filter((r) => r.table === 'scene_sets' || r.table === 'world_events').map((r) => `${r.txId ? 'tx' : 'auto'} ${r.kind} ${r.table}${r.error ? ` ${r.error}` : ''} ${String(r.sql || '').slice(0, 70)}`).slice(-30) });
      }
    }
    return out;
  }
  const noDeadlock = (out) => {
    expect(out.errors.filter((e) => e === '40P01')).toEqual([]);
    for (const x of [out.a, out.b]) if (x && typeof x.status === 'number') expect(x.status).not.toBe(500);
  };

  async function twoParter() {
    const seasonShow = await mkShow('PR 1 season');
    const { arc_id: arcId } = await seedArc(seasonShow, models);
    const sets = await world(seasonShow);
    const ev = await mkEvent(seasonShow, { name: 'The Finale Gala', set: sets.s });
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
  async function accept(ep, showId = show) {
    const a = await settle(completeEpisode(ep, showId, sequelize));
    if (!a.ok) throw a.error;
    expect(await evaluationOf(ep)).toBe('accepted');
  }

  beforeAll(async () => {
    guardEventsAtStart = networkGuard.getState().events.length;
    PNG = await sharp({ create: { width: 4, height: 4, channels: 3, background: '#ffffff' } }).png().toBuffer();
    editorToken = TokenService.generateTokenPair({ id: `pr1-editor-${TAG}`, email: 'editor@pr1.dev', name: 'Editor', groups: ['USER', 'EDITOR'], role: 'USER' }).accessToken;
  });
  beforeEach(async () => {
    show = await mkShow('PR 1');
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
      return { status: 200, data: { images: [{ url: `https://fal.media/pr1-${n}.jpg` }] } };
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
    await sleep(500); // after-commit work of completions and Starts
    if (process.env.PR1_OBSERVED_FILE) fs.writeFileSync(process.env.PR1_OBSERVED_FILE, JSON.stringify(observed, null, 1));
    if (usageLogIds.length) await run('DELETE FROM ai_usage_logs WHERE id IN (:ids)', { ids: usageLogIds });
    for (const s of fx.made.shows) await run('DELETE FROM episode_raw_clips WHERE episode_id IN (SELECT id FROM episodes WHERE show_id = :s)', { s });
    if (fx.made.sets.length) {
      await run('DELETE FROM scene_set_looks WHERE scene_set_id IN (:ids)', { ids: fx.made.sets });
      await run('DELETE FROM scene_angles WHERE scene_set_id IN (:ids)', { ids: fx.made.sets });
    }
    await fx.cleanup();
  });

  // ══ Unchanged behaviour ════════════════════════════════════════════════
  describe('what a delete answers and writes when nothing is in its way (as before)', () => {
    test('a set nothing uses: deleted, with the same body', async () => {
      const res = await del(w.t);
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ success: true, message: 'Scene set deleted', uses_left: { locations: 0, beats: 0, events: 0, defaults: 0, scenes: 0, homes: 0, versions: 0, total: 0 }, links_dropped: 0 });
      expect(await removedAt(w.t)).not.toBeNull();
      expect((await del(w.t)).status).toBe(404);
    });

    test('draft uses and no choice: 409 SET_IN_USE with the uses, nothing changed', async () => {
      const { ep } = await placed();
      await useDirect(ep, w.s, { link: false, beat: false, scene: true, n: 11 });
      const before = await snapshot();
      const res = await del(w.s);
      expect(res.status).toBe(409);
      expect(res.body).toEqual({
        success: false, code: 'SET_IN_USE', uses: { locations: 1, beats: 1, events: 1, defaults: 0, scenes: 1, homes: 0, versions: 0, total: 4 },
        error: 'This scene set is used 4 time(s). Choose a replacement to move them to, or delete anyway and leave them pointing at a removed set.',
      });
      expect(await snapshot()).toEqual(before);
    });

    test('"delete anyway" on draft uses: the set removed, its uses left on it, a link no beat uses dropped, its versions everyday again', async () => {
      const { ep, ev } = await placed();
      const other = await direct(w.s, { beat: false, scene: false }); // a location no beat uses
      const version = await set('Version of S', 'EVENT_LOCATION', show, { version_of_set_id: w.s });
      const res = await del(w.s, ANYWAY);
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ success: true, message: 'Scene set deleted', uses_left: { locations: 2, beats: 1, events: 1, defaults: 0, scenes: 0, homes: 0, versions: 1, total: 5 }, links_dropped: 1 });
      expect(await removedAt(w.s)).not.toBeNull();
      expect((await eventRow(ev)).scene_set_id).toBe(w.s);
      expect(await linksOf(ep)).toEqual(expect.arrayContaining([{ scene_set_id: w.s, role: 'event' }]));
      expect(await linksOf(other)).toEqual([]);
      expect((await rows('SELECT version_of_set_id FROM scene_sets WHERE id = :version', { version }))[0].version_of_set_id).toBeNull();
    });

    test('with a replacement on draft uses: every use moved (location, beat with its angle cleared, scene, event, version), then the set removed', async () => {
      const { ep, ev } = await placed();
      await useDirect(ep, w.s, { link: false, beat: false, scene: true, n: 11 });
      const version = await set('Version of S', 'EVENT_LOCATION', show, { version_of_set_id: w.s });
      const res = await del(w.s, into(w.r));
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ success: true, message: 'Scene set deleted; its uses moved to the replacement', moved: { locations: 1, beats: 1, events: 1, defaults: 0, scenes: 1, homes: 0, looks: 0, versions: 1 } });
      expect(await removedAt(w.s)).not.toBeNull();
      expect((await eventRow(ev)).scene_set_id).toBe(w.r);
      expect(await linksOf(ep)).toEqual(expect.arrayContaining([{ scene_set_id: w.r, role: 'event' }]));
      expect(await rows('SELECT scene_set_id, angle_label FROM scene_plans WHERE episode_id = :ep AND beat_number = 10', { ep })).toEqual([{ scene_set_id: w.r, angle_label: null }]);
      expect((await rows('SELECT version_of_set_id FROM scene_sets WHERE id = :version', { version }))[0].version_of_set_id).toBe(w.r);
      expect((await liveRefs(w.s)).total).toBe(0);
    });

    test('a replacement that cannot be one: the same answers as before (itself, not an id, not found, removed), nothing changed', async () => {
      await placed();
      const before = await snapshot();
      const itself = await del(w.s, into(w.s));
      expect(itself.status).toBe(400);
      expect(itself.body).toEqual({ success: false, code: 'BAD_REQUEST', error: 'Choose a different scene set as the replacement' });
      const notAnId = await del(w.s, '?replacement_id=not-an-id');
      expect(notAnId.status).toBe(400);
      expect(notAnId.body).toEqual({ success: false, code: 'BAD_REPLACEMENT', error: 'The replacement must be a scene set id' });
      const missing = await del(w.s, into(fx.uuid()));
      expect(missing.status).toBe(400);
      expect(missing.body).toEqual({ success: false, code: 'BAD_REPLACEMENT', error: 'The replacement scene set was not found, or it has been removed' });
      expect((await del(w.t)).status).toBe(200);
      const removed = await del(w.s, into(w.t));
      expect(removed.status).toBe(400);
      expect(removed.body.code).toBe('BAD_REPLACEMENT');
      const now = await snapshot();
      expect({ ...now, sets: now.sets.filter((x) => x.id !== w.t) }).toEqual({ ...before, sets: before.sets.filter((x) => x.id !== w.t) });
    });

    test('the approved base of a location is refused first, as before', async () => {
      const place = await mkLocation('PR 1 hall');
      await run('UPDATE scene_sets SET world_location_id = :place WHERE id = :s', { place, s: w.s });
      await run('UPDATE world_locations SET approved_base_scene_set_id = :s, approved_base_image_url = :url, approved_base_at = NOW() WHERE id = :place', { s: w.s, url: 'https://cdn.example/base.jpg', place });
      const ep = await direct(w.s);
      await fx.setEvaluation(ep, 'accepted');
      const res = await del(w.s, into(w.r));
      expect(res.status).toBe(409);
      expect(res.body).toEqual({ success: false, error: expect.stringMatching(/^This base is the approved base of PR 1 hall/), approved_base_of: { world_location_id: place, name: expect.stringMatching(/^PR 1 hall/) } });
      await run('UPDATE world_locations SET approved_base_scene_set_id = NULL WHERE id = :place', { place });
    });
  });

  // ══ The lock order ═════════════════════════════════════════════════════
  describe('the order the delete takes its locks in', () => {
    test('[real lock] several episodes, direct and through events, several events, a version: every episode FOR UPDATE in one ascending statement, then each event ascending, then the set rows in one NOWAIT statement, then the writes; each of those rows is really held', async () => {
      const d1 = await direct(w.s);
      const d2 = await direct(w.s, { link: false, scene: false, n: 2 });
      const e1 = await eventOnly(w.s);
      const e2 = await eventOnly(w.s, { brief: false });
      const both = await placed(w.s); // direct and through its event
      const version = await set('Version of S', 'EVENT_LOCATION', show, { version_of_set_id: w.s });
      const episodes = [d1, d2, e1.ep, e2.ep, both.ep].sort();
      const events = [e1.ev, e2.ev, both.ev].sort();

      const g = gateOn(deleteHoldsAll);
      const pending = send(del(w.s, into(w.r)));
      await g.reached;
      // Really held, and how strongly: an episode refuses even a share lock; the removed set refuses a key-share lock;
      // the replacement gives a key-share lock but not an exclusive one; a version refuses a no-key-update lock.
      for (const id of episodes) expect(await canLock('episodes', id, 'FOR SHARE')).toBe(false);
      for (const id of events) expect(await canLock('world_events', id, 'FOR KEY SHARE')).toBe(false);
      expect(await canLock('scene_sets', w.s, 'FOR KEY SHARE')).toBe(false);
      expect(await canLock('scene_sets', w.r, 'FOR KEY SHARE')).toBe(true);
      expect(await canLock('scene_sets', w.r, 'FOR UPDATE')).toBe(false);
      expect(await canLock('scene_sets', version, 'FOR NO KEY UPDATE')).toBe(false);
      expect(await canLock('scene_sets', version, 'FOR KEY SHARE')).toBe(true);
      g.open();
      const res = await pending;
      expect(res.status).toBe(200);

      const tx = [...trace.byTransaction().values()].find((t) => t.some((r) => /^WITH gone AS/.test(r.sql || '')));
      const setRows = tx.findIndex((r) => /^WITH gone AS/.test(r.sql || ''));
      const locks = tx.slice(0, setRows).filter((r) => r.kind === 'lock');
      expect(locks.map((r) => `${r.table}:${r.mode}`)).toEqual(['episodes:update', ...events.map(() => 'world_events:update')]);
      // One statement for the episodes, ordered by id, naming all five.
      expect(locks[0].sql).toBe('SELECT id FROM episodes WHERE id IN (:ids) ORDER BY id FOR UPDATE');
      expect([...locks[0].ids].sort()).toEqual(episodes);
      // The events one by one, ascending.
      expect(locks.slice(1).map((r) => r.ids[0])).toEqual(events);
      // The set rows: one statement, each lock NOWAIT.
      expect(tx[setRows].sql).toMatch(/^WITH gone AS \(SELECT id FROM scene_sets WHERE id = :setId FOR UPDATE NOWAIT\)/);
      expect(tx.filter((r) => /^WITH gone AS/.test(r.sql || ''))).toHaveLength(1);
      // Nothing is written before the last lock.
      const firstWrite = tx.findIndex((r) => r.kind === 'write' || r.kind === 'insert');
      expect(firstWrite).toBeGreaterThan(setRows);
      expect(tx.filter((r) => r.error)).toEqual([]); // (the probes above are the only conflicts in the trace)
      expect(pause).not.toHaveBeenCalled();
    });

    test('[real lock] the reference set grows after discovery (an event arrives at the set, with its episode): everything rolled back, one pause outside any transaction, then again in a new transaction holding the larger set, in order', async () => {
      const d1 = await direct(w.s);
      const late = await mkEpisode(show);
      const g = gateOn(holdsEpisodeForUpdate); // the delete has read its references and locked d1; the set rows are not locked yet
      const pending = send(del(w.s, into(w.r)));
      await g.reached;
      const ev = await mkEvent(show, { stamp: late, set: w.s }); // committed by another session
      let during = null;
      pause.mockImplementation(async () => { during = await othersInTransaction(); });
      g.open();
      const res = await pending;
      expect(res.status).toBe(200);
      expect(pause.mock.calls).toEqual([[DELAY]]);
      expect(during).toBe(0); // the pause is outside any transaction
      const tries = [...trace.byTransaction().values()].filter((t) => t.some((r) => /^WITH gone AS/.test(r.sql || '')));
      expect(tries).toHaveLength(2);
      expect(tries[0].some((r) => r.kind === 'rollback')).toBe(true);
      expect(tries[0].some((r) => r.kind === 'write' || r.kind === 'insert')).toBe(false);
      const second = tries[1].filter((r) => r.kind === 'lock');
      expect([...second[0].ids].sort()).toEqual([d1, late].sort());
      expect(second[1].ids).toEqual([ev]);
      expect(tries[1].some((r) => r.kind === 'commit')).toBe(true);
      expect((await eventRow(ev)).scene_set_id).toBe(w.r);
      expect(await removedAt(w.s)).not.toBeNull();
      expect(lockErrors(trace.records)).toEqual([]);
    });

    test('[real lock] a set that keeps growing: three tries, two pauses, then the retryable 409; nothing changed by the delete', async () => {
      await direct(w.s);
      tracing();
      // Each try, once it has locked its episodes, finds one more event at the set.
      const real = sequelize.query;
      let tries = 0;
      const arrivals = [];
      jest.spyOn(sequelize, 'query').mockImplementation(async function wrapped(sql, options) {
        const out = await real.call(this, sql, options);
        if (options?.transaction && /^SELECT id FROM episodes WHERE id IN/.test(flat(sql)) && /FOR UPDATE$/.test(flat(sql))) {
          tries += 1;
          arrivals.push(await mkEvent(show, { stamp: await mkEpisode(show), set: w.s }));
        }
        return out;
      });
      pause.mockImplementation(async () => {});
      const res = await del(w.s, into(w.r));
      expect(res.status).toBe(409);
      expect(res.body).toEqual(RETRY);
      expect(tries).toBe(3);
      expect(pause.mock.calls).toEqual([[DELAY], [DELAY]]);
      expect(await removedAt(w.s)).toBeNull();
      for (const ev of arrivals) expect((await eventRow(ev)).scene_set_id).toBe(w.s);
    });
  });

  // ══ Accepted and filmed uses ═══════════════════════════════════════════
  describe('an accepted or a filmed episode that uses the set keeps it (both kinds of delete), and nothing at all is changed', () => {
    const KINDS = [['with a replacement', () => into(w.r)], ['"delete anyway"', () => ANYWAY]];
    const USES = [
      ['a location', { beat: false, scene: false }],
      ['a beat', { link: false, scene: false }],
      ['a scene row', { link: false, beat: false }],
    ];

    describe.each(KINDS)('%s', (_kind, query) => {
      test.each(USES)('an accepted episode that uses the set as %s: 409 EPISODE_ACCEPTED naming it', async (_use, how) => {
        const ep = await direct(w.s, how);
        await direct(w.s); // a draft that uses it too
        await fx.setEvaluation(ep, 'accepted');
        const [{ episode_number: number, title }] = await rows('SELECT episode_number, title FROM episodes WHERE id = :ep', { ep });
        const before = await snapshot();
        const res = await del(w.s, query());
        expect(res.status).toBe(409);
        expect(res.body).toEqual({
          success: false, code: 'EPISODE_ACCEPTED',
          error: `Episode ${number} "${title}" is accepted and uses this scene set: it stays. Nothing was changed.`,
          episodes: [{ id: ep, episode_number: number, title }],
        });
        expect(await snapshot()).toEqual(before);
      });

      test('an accepted episode linked to an event held at the set (no row of its own at it): 409 PLACE_LOCKED with the event, as before', async () => {
        const { ep, ev } = await eventOnly(w.s);
        await fx.setEvaluation(ep, 'accepted');
        const before = await snapshot();
        const res = await del(w.s, query());
        expect(res.status).toBe(409);
        expect(res.body).toMatchObject({ success: false, code: PLACE_LOCKED_CODE, locked_events: [{ id: ev, name: expect.any(String) }] });
        expect(res.body.error).toMatch(/is held here and its episode is accepted: the place is locked, so this set stays\.$/);
        expect(await snapshot()).toEqual(before);
      });

      test.each(USES)('a filmed, not accepted episode that uses the set as %s: 409 EPISODE_SNAPSHOT_FROZEN', async (_use, how) => {
        const ep = await direct(w.s, how);
        const [{ episode_number: number, title }] = await rows('SELECT episode_number, title FROM episodes WHERE id = :ep', { ep });
        await film(ep);
        const before = await snapshot();
        const res = await del(w.s, query());
        expect(res.status).toBe(409);
        expect(res.body).toEqual({
          success: false, code: 'EPISODE_SNAPSHOT_FROZEN', episode_id: ep, frozen_at: expect.any(String),
          error: expect.stringMatching(new RegExp(`^Episode ${number} "${title}" has been filmed \\(since \\d{4}-\\d{2}-\\d{2}\\) and uses this scene set: it stays\\. Nothing was changed\\.$`)),
        });
        expect(await snapshot()).toEqual(before);
      });

      test('a filmed episode linked to an event held at the set, and one whose only clip was removed: EPISODE_SNAPSHOT_FROZEN for each', async () => {
        const { ep } = await eventOnly(w.s);
        await film(ep);
        const before = await snapshot();
        const res = await del(w.s, query());
        expect(res.status).toBe(409);
        expect(res.body).toMatchObject({ success: false, code: 'EPISODE_SNAPSHOT_FROZEN', episode_id: ep });
        expect(await snapshot()).toEqual(before);

        const other = await direct(w.t);
        await film(other, { removed: true }); // a removed clip counts, as everywhere
        const again = await del(w.t, query() === ANYWAY ? ANYWAY : into(w.r));
        expect(again.status).toBe(409);
        expect(again.body).toMatchObject({ code: 'EPISODE_SNAPSHOT_FROZEN', episode_id: other });
        expect(await removedAt(w.t)).toBeNull();
      });
    });

    test('accepted is said before filmed; a locked Place before both; and a draft, unfilmed use beside them changes nothing about that', async () => {
      const filmed = await direct(w.s);
      await film(filmed);
      const accepted = await direct(w.s);
      await fx.setEvaluation(accepted, 'accepted');
      expect((await del(w.s, ANYWAY)).body.code).toBe('EPISODE_ACCEPTED');
      const { ep } = await eventOnly(w.s);
      await fx.setEvaluation(ep, 'accepted');
      expect((await del(w.s, ANYWAY)).body.code).toBe(PLACE_LOCKED_CODE);
      // No choice made (neither a replacement nor "delete anyway"): the refusal, not SET_IN_USE.
      expect((await del(w.s)).body.code).toBe(PLACE_LOCKED_CODE);
    });

    test('a deleted episode\'s rows do not hold the set, unless it was filmed', async () => {
      const gone = await mkEpisode(show, { deleted: true, evaluation: 'accepted' });
      await useDirect(gone, w.s);
      const res = await del(w.s, into(w.r));
      expect(res.status).toBe(200);
      const filmedGone = await mkEpisode(show, { deleted: true });
      await useDirect(filmedGone, w.t);
      await film(filmedGone);
      expect((await del(w.t, into(w.r))).body).toMatchObject({ code: 'EPISODE_SNAPSHOT_FROZEN', episode_id: filmedGone });
    });
  });

  // ══ A held set row, and failures ═══════════════════════════════════════
  describe('a set row held by another transaction, and a failure inside the delete', () => {
    test.each([
      ['the set', () => w.s, 'FOR KEY SHARE'],
      ['the replacement', () => w.r, 'FOR UPDATE'],
    ])('[real lock] %s held and let go during the pause: deleted on the second try; no session but the holder\'s is inside a transaction during the pause', async (_what, id, how) => {
      await placed();
      tracing();
      const { holder, pid } = await holdRow('scene_sets', id(), how);
      let during = null;
      pause.mockImplementation(async () => {
        during = await inTransaction(pid);
        await holder.rollback();
      });
      const res = await del(w.s, into(w.r));
      expect(res.status).toBe(200);
      expect(pause.mock.calls).toEqual([[DELAY]]);
      expect(during).toEqual([]);
      expect(lockErrors(trace.records)).toEqual(['55P03']);
    });

    test.each([
      ['with a replacement', () => into(w.r)],
      ['"delete anyway"', () => ANYWAY],
    ])('[real lock] the set row held throughout, %s: three tries, two pauses (none inside a transaction), then 409 RETRY; nothing changed', async (_kind, query) => {
      await placed();
      tracing();
      const { pid } = await holdRow('scene_sets', w.s, 'FOR KEY SHARE');
      const before = await snapshot();
      const during = [];
      pause.mockImplementation(async () => { during.push((await inTransaction(pid)).length); });
      const res = await del(w.s, query());
      expect(res.status).toBe(409);
      expect(res.body).toEqual(RETRY);
      expect(pause.mock.calls).toEqual([[DELAY], [DELAY]]);
      expect(during).toEqual([0, 0]);
      expect(lockErrors(trace.records)).toEqual(['55P03', '55P03', '55P03']);
      expect(await snapshot()).toEqual(before);
    });

    test('[real lock] an episode row held (a wait, then the lock timeout) is the same retryable answer, never the database\'s words', async () => {
      const ep = await direct(w.s);
      // A lock conflict at the episode lock itself, as a lock_timeout raises it (55P03).
      const real = sequelize.query.bind(sequelize);
      jest.spyOn(sequelize, 'query').mockImplementation((sql, options) => {
        if (options?.transaction && /^SELECT id FROM episodes WHERE id IN/.test(flat(sql))) {
          return Promise.reject(Object.assign(new Error('canceling statement due to lock timeout'), { original: { code: '55P03' } }));
        }
        return real(sql, options);
      });
      pause.mockImplementation(async () => {});
      const res = await del(w.s, ANYWAY);
      expect(res.status).toBe(409);
      expect(res.body).toEqual(RETRY);
      expect(JSON.stringify(res.body)).not.toMatch(/canceling|lock timeout/);
      expect(await linksOf(ep)).toHaveLength(1);
    });

    test.each([
      ['merging a location the episode already has at the replacement', /^UPDATE scene_set_episodes keep/],
      ['removing the merged location', /^UPDATE scene_set_episodes old SET deleted_at/],
      ['moving the locations', /^UPDATE scene_set_episodes SET scene_set_id/],
      ['moving the beats', /^UPDATE scene_plans SET scene_set_id/],
      ['moving the looks', /^UPDATE scene_set_looks old/],
      ['moving the events', /^UPDATE world_events SET scene_set_id/],
      ['moving the scene rows', /^UPDATE scenes SET scene_set_id/],
      ['moving a show default', /^UPDATE shows SET metadata/],
      ['removing a character\'s doubled place', /^UPDATE character_places old/],
      ['moving the characters\' places', /^UPDATE character_places SET scene_set_id/],
      ['moving the versions', /^UPDATE scene_sets SET version_of_set_id = :toId/],
      ['removing the set', /^UPDATE "scene_sets" SET "deleted_at"/],
    ])('[injected] with a replacement, failing at %s: a fixed sentence (500), nothing of the database\'s, and every row as it was', async (_step, pattern) => {
      const { ep } = await placed();
      await useDirect(ep, w.s, { link: false, beat: false, scene: true, n: 11 });
      await set('Version of S', 'EVENT_LOCATION', show, { version_of_set_id: w.s });
      const before = await snapshot();
      const spy = failStatement(pattern);
      const res = await del(w.s, into(w.r));
      const failedAt = spy.mock.calls.filter(([sql, o]) => o?.transaction && pattern.test(flat(typeof sql === 'string' ? sql : sql?.query || ''))).length;
      spy.mockRestore();
      expect(failedAt).toBe(1);
      expect(res.status).toBe(500);
      expect(res.body).toEqual(DELETE_FAILED);
      expect(JSON.stringify(res.body)).not.toMatch(NOT_DATABASE_TEXT);
      expect(await snapshot()).toEqual(before);
      expect(pause).not.toHaveBeenCalled(); // not a lock conflict: not tried again
      expect(console.error.mock.calls.map((c) => c.join(' ')).filter((l) => l.startsWith('Scene Sets DELETE /:id error:'))).toEqual([
        expect.stringMatching(new RegExp(`^Scene Sets DELETE /:id error: set=${w.s} error=[\\w/]+$`)),
      ]);
    });

    test.each([
      ['removing the set', /^UPDATE "scene_sets" SET "deleted_at"/],
      ['releasing its versions', /^UPDATE scene_sets SET version_of_set_id = NULL/],
      ['dropping the links no beat uses', /^UPDATE scene_set_episodes l SET deleted_at/],
    ])('[injected] "delete anyway", failing at %s: the fixed sentence, every row as it was', async (_step, pattern) => {
      await placed();
      await direct(w.s, { beat: false, scene: false });
      await set('Version of S', 'EVENT_LOCATION', show, { version_of_set_id: w.s });
      const before = await snapshot();
      const spy = failStatement(pattern);
      const res = await del(w.s, ANYWAY);
      spy.mockRestore();
      expect(res.status).toBe(500);
      expect(res.body).toEqual(DELETE_FAILED);
      expect(await snapshot()).toEqual(before);
    });

    test.each([
      ['the scene generation guard refusing the removal (SQLSTATE 23514 and its prefix): this route\'s own sentence, nothing of the trigger\'s text or its ids',
        (id) => `scene generation guard: set ${id} has an angle with an uncertain outcome and cannot be deleted`,
        { success: false, error: 'This scene set, or one of its angles, has a generation that is in flight or whose outcome is not known yet: it cannot be deleted until that is settled. Nothing was changed.' }],
      ['an ordinary check-constraint failure, which shares the guard\'s SQLSTATE (23514) but not its prefix: the generic fixed sentence',
        () => 'new row for relation "scene_sets" violates check constraint "scene_sets_some_check"',
        DELETE_FAILED],
    ])('[injected] %s; 500 as before, every row as it was, not tried again', async (_name, textOf, body) => {
      await placed();
      const before = await snapshot();
      const real = sequelize.query.bind(sequelize);
      const text = textOf(w.s);
      const removal = /^UPDATE "scene_sets" SET "deleted_at"/;
      jest.spyOn(sequelize, 'query').mockImplementation((sql, options) => {
        if (options?.transaction && removal.test(flat(typeof sql === 'string' ? sql : sql?.query || sql))) {
          return Promise.reject(Object.assign(new Error(text), { name: 'SequelizeDatabaseError', original: Object.assign(new Error(text), { code: '23514' }) }));
        }
        return real(sql, options);
      });
      const res = await del(w.s, ANYWAY);
      expect(res.status).toBe(500);
      expect(res.body).toEqual(body);
      const sent = JSON.stringify(res.body);
      expect(sent).not.toMatch(/scene generation guard|23514/);
      expect(sent).not.toContain(String(w.s));
      expect(sent).not.toMatch(NOT_DATABASE_TEXT);
      expect(await snapshot()).toEqual(before);
      expect(pause).not.toHaveBeenCalled();
    });

    test('a deadlock reported inside the delete (40P01) is tried again and never reaches the answer as text', async () => {
      await placed();
      const real = sequelize.query.bind(sequelize);
      let thrown = 0;
      jest.spyOn(sequelize, 'query').mockImplementation((sql, options) => {
        if (options?.transaction && /^UPDATE world_events SET scene_set_id/.test(flat(sql))) {
          thrown += 1;
          return Promise.reject(Object.assign(new Error('deadlock detected'), { original: { code: '40P01' } }));
        }
        return real(sql, options);
      });
      pause.mockImplementation(async () => {});
      const res = await del(w.s, into(w.r));
      expect(thrown).toBe(3);
      expect(res.status).toBe(409);
      expect(res.body).toEqual(RETRY);
      expect(JSON.stringify(res.body)).not.toMatch(/deadlock/);
      expect(await removedAt(w.s)).toBeNull();
    });
  });

  // ══ Two deletes ════════════════════════════════════════════════════════
  describe('[real lock] two deletes at once', () => {
    test('opposite deletes (S into R, and R into S), each set used by its own episode: no deadlock; the second steps back from the held set row, and once the first is done its replacement is gone (BAD_REPLACEMENT); nothing changed for it', async () => {
      const a = await direct(w.s);
      const b = await direct(w.r);
      const out = await race('opposite deletes, separate episodes', () => send(del(w.s, into(w.r))), deleteHoldsAll, () => send(del(w.r, into(w.s))));
      noDeadlock(out);
      expect(out.a.status).toBe(200);
      expect(out.b.status).toBe(400);
      expect(out.b.body).toEqual({ success: false, code: 'BAD_REPLACEMENT', error: 'The replacement scene set was not found, or it has been removed' });
      expect(out.how).toBe('paused');
      expect(out.errors).toEqual(['55P03']);
      expect(await removedAt(w.s)).not.toBeNull();
      expect(await removedAt(w.r)).toBeNull();
      expect(await linksOf(a)).toEqual([{ scene_set_id: w.r, role: 'home' }]);
      expect(await linksOf(b)).toEqual([{ scene_set_id: w.r, role: 'home' }]);
    });

    test('opposite deletes of two sets one episode uses: the second waits for the episode, then BAD_REPLACEMENT; no deadlock', async () => {
      const ep = await direct(w.s);
      await useDirect(ep, w.r, { role: 'closet', n: 2 });
      const out = await race('opposite deletes, one episode', () => send(del(w.s, into(w.r))), deleteHoldsAll, () => send(del(w.r, into(w.s))));
      noDeadlock(out);
      expect(out.how).toBe('blocked');
      expect(out.errors).toEqual([]);
      expect(out.a.status).toBe(200);
      expect(out.b.status).toBe(400);
      expect(out.b.body.code).toBe('BAD_REPLACEMENT');
      expect(await removedAt(w.r)).toBeNull();
    });

    test('a delete of the set another delete is moving its uses to: it steps back, then finds the set in use (409 SET_IN_USE, the moved uses counted); nothing changed for it', async () => {
      await direct(w.s);
      const out = await race('delete of a replacement in use', () => send(del(w.s, into(w.r))), deleteHoldsAll, () => send(del(w.r)));
      noDeadlock(out);
      expect(out.a.status).toBe(200);
      expect(out.b.status).toBe(409);
      expect(out.b.body).toMatchObject({ code: 'SET_IN_USE', uses: { locations: 1, beats: 1, scenes: 1, total: 3 } });
      expect(out.errors).toEqual(['55P03']);
      expect(await removedAt(w.r)).toBeNull();
    });

    test('the same set deleted twice at once: the second finds it gone (404)', async () => {
      await direct(w.s);
      const out = await race('same set twice', () => send(del(w.s, ANYWAY)), deleteHoldsAll, () => send(del(w.s, ANYWAY)));
      noDeadlock(out);
      expect([out.a.status, out.b.status]).toEqual([200, 404]);
    });
  });

  // ══ The Place writers of Generations B1 to B3 ══════════════════════════
  describe('[real lock] against the writers that take the Place order (B1, B2, B3): no deadlock in either order, and the one that comes second answers for what it then finds', () => {
    test('a Locations save that leaves the event\'s set (B3, its own transaction): the save first, then the delete moves its uses; the delete first, and the save is refused as stale', async () => {
      const one = await placed();
      const first = await race('locations save (home edit) first', () => send(save(one.ep, [loc('event', w.s), loc('home', w.home2)])), holdsEventRow, () => send(del(w.s, into(w.r))));
      noDeadlock(first);
      expect(first.a.status).toBe(200);
      expect(first.b.status).toBe(200);
      expect(first.how).toBe('blocked');
      expect(await linksOf(one.ep)).toEqual([{ scene_set_id: w.r, role: 'event' }, { scene_set_id: w.home2, role: 'home' }]);
      expect((await eventRow(one.ev)).scene_set_id).toBe(w.r);
      trace.uninstall();
      trace = null;

      const two = await placed(w.t);
      const second = await race('delete first, then locations save (home edit)', () => send(del(w.t, into(w.r))), deleteHoldsAll, () => send(save(two.ep, [loc('event', w.t), loc('home', w.home2)])));
      noDeadlock(second);
      expect(second.a.status).toBe(200);
      expect(second.how).toBe('blocked');
      expect(second.b.status).toBe(409);
      expect(second.b.body.code).toBe('STALE_SOURCE_SET');
      // As the delete alone leaves it.
      expect(await linksOf(two.ep)).toEqual([{ scene_set_id: w.r, role: 'event' }, { scene_set_id: w.home, role: 'home' }]);
      expect((await eventRow(two.ev)).scene_set_id).toBe(w.r);
    });

    test('a Locations save that moves the event (B3, through the finalizer): the save first, then the delete finds the set unused by it; the delete first, and the save is refused as stale', async () => {
      const one = await placed();
      const first = await race('locations save (event move) first', () => send(save(one.ep, [loc('event', w.t), loc('home', w.home)])), holdsEventRow, () => send(del(w.s, into(w.r))));
      noDeadlock(first);
      expect(first.a.status).toBe(200);
      expect(first.b.status).toBe(200);
      expect((await eventRow(one.ev)).scene_set_id).toBe(w.t);
      expect(await linksOf(one.ep)).toEqual([{ scene_set_id: w.t, role: 'event' }, { scene_set_id: w.home, role: 'home' }]);
      expect(await removedAt(w.s)).not.toBeNull();
      trace.uninstall();
      trace = null;

      const other = await set('Hall U');
      const two = await placed(other);
      const second = await race('delete first, then locations save (event move)', () => send(del(other, into(w.r))), deleteHoldsAll, () => send(save(two.ep, [loc('event', w.t), loc('home', w.home)])));
      noDeadlock(second);
      expect(second.a.status).toBe(200);
      expect(second.b.status).toBe(409);
      expect(second.b.body.code).toBe('STALE_SOURCE_SET');
      expect((await eventRow(two.ev)).scene_set_id).toBe(w.r);
    });

    test('Start Episode\'s locations write (B3): the write first, then the delete moves the new episode\'s uses; the delete first, and Start is refused as stale with nothing created', async () => {
      const ev = await mkEvent(show, { set: w.s });
      const first = await race('Start locations write first', () => send(start(ev, { locations: [loc('event', w.s), loc('home', w.home)], event_scene_set_id: w.s })), startSavingLocations(), () => send(del(w.s, into(w.r))));
      noDeadlock(first);
      expect(first.a.status).toBe(201);
      expect(first.a.body.setup_complete).toBe(true);
      expect(first.b.status).toBe(200);
      const ep = first.a.body.data.episode.id;
      expect(await linksOf(ep)).toEqual([{ scene_set_id: w.r, role: 'event' }, { scene_set_id: w.home, role: 'home' }]);
      expect((await eventRow(ev)).scene_set_id).toBe(w.r);
      expect((await liveRefs(w.s)).total).toBe(0);
      trace.uninstall();
      trace = null;

      const other = await mkEvent(show, { set: w.t });
      const second = await race('delete first, then Start', () => send(del(w.t, into(w.r))), deleteHoldsAll, () => send(start(other, { locations: [loc('event', w.t), loc('home', w.home)], event_scene_set_id: w.t })));
      noDeadlock(second);
      expect(second.a.status).toBe(200);
      expect(second.b.status).toBe(409);
      expect(second.b.body.code).toBe('STALE_SOURCE_SET');
      expect(await episodeOf(other)).toBeNull();
      expect((await eventRow(other)).scene_set_id).toBe(w.r);
    });

    test('an uploaded look (B2, linked to the event\'s set in its finalization): both orders', async () => {
      const one = await placed();
      const first = await race('look upload first', () => send(uploadLook(one.ev)), holdsEventRow, () => send(del(w.s, into(w.r))));
      noDeadlock(first);
      expect(first.a.status).toBe(200);
      expect(first.b.status).toBe(200);
      // The look went with its event to the replacement.
      expect(await rows('SELECT scene_set_id, status FROM scene_set_looks WHERE event_id = :ev AND deleted_at IS NULL', { ev: one.ev })).toEqual([{ scene_set_id: w.r, status: 'complete' }]);
      trace.uninstall();
      trace = null;

      const two = await placed(w.t);
      const second = await race('delete first, then look upload', () => send(del(w.t, into(w.r))), deleteHoldsAll, () => send(uploadLook(two.ev)));
      noDeadlock(second);
      expect(second.a.status).toBe(200);
      observed.push({ name: 'look upload after delete: body', code: second.b.body?.code || null, status: second.b.status });
      expect([200, 409]).toContain(second.b.status);
      expect((await eventRow(two.ev)).scene_set_id).toBe(w.r);
      // Whatever it answered, no look is left on the removed set.
      expect(await rows('SELECT id FROM scene_set_looks WHERE scene_set_id = :t AND deleted_at IS NULL', { t: w.t })).toEqual([]);
    });

    test('generate-venue (B1, a base generated for the event\'s own set and saved through the finalizer): the delete first, and what was generated is not saved (409 STALE_SOURCE_SET, generated_not_saved); the venue\'s finalization first, and the delete steps back from the set row, then moves the uses', async () => {
      const venue = async () => {
        const place = await mkLocation('PR 1 venue');
        const bare = await mkSet(show, `Bare ${fx.uuid().slice(0, 6)}`, { scene_type: 'EVENT_LOCATION', generation_status: 'pending', world_location_id: place });
        const ep = await mkEpisode(show);
        const ev = await mkEvent(show, { stamp: ep, set: bare, loc: place });
        await mkBrief(show, ep, ev);
        return { bare, ev };
      };
      const one = await venue();
      const second = await race('delete first, then generate-venue', () => send(del(one.bare, into(w.r))), deleteHoldsAll, () => send(generateVenue(one.ev)));
      noDeadlock(second);
      expect(second.a.status).toBe(200);
      expect(second.b.status).toBe(409);
      expect(second.b.body).toMatchObject({ code: 'STALE_SOURCE_SET', outcome: 'generated_not_saved' });
      expect((await eventRow(one.ev)).scene_set_id).toBe(w.r);
      trace.uninstall();
      trace = null;

      const two = await venue();
      const first = await race('generate-venue first', () => send(generateVenue(two.ev)), holdsEventRow, () => send(del(two.bare, into(w.r))));
      noDeadlock(first);
      expect(first.a.status).toBe(200);
      expect(first.a.body.outcome).toBe('generated');
      expect(first.b.status).toBe(200);
      expect((await eventRow(two.ev)).scene_set_id).toBe(w.r);
      expect(await removedAt(two.bare)).not.toBeNull();
    });
  });

  // ══ Acceptance ═════════════════════════════════════════════════════════
  describe('[real lock] against a real acceptance (completeEpisode)', () => {
    const placeOf = (snap) => ({ events: snap.events, links: snap.links, beats: snap.beats, scenes: snap.scenes, sets: snap.sets, looks: snap.looks });

    test.each([
      ['an episode that uses the set directly', async () => ({ ep: await direct(w.s) }), 'EPISODE_ACCEPTED'],
      ['an episode linked to an event held at the set', () => eventOnly(w.s), PLACE_LOCKED_CODE],
    ])('the acceptance first, of %s: the delete waits for it and is then refused; every Place row as it was', async (_what, make, code) => {
      const { ep } = await make();
      const before = placeOf(await snapshot());
      const out = await race(`acceptance first (${code})`, () => settle(completeEpisode(ep, show, sequelize)), holdsEpisodeForUpdate, () => send(del(w.s, into(w.r))));
      if (!out.a.ok) throw out.a.error;
      noDeadlock(out);
      expect(out.how).toBe('blocked');
      expect(out.b.status).toBe(409);
      expect(out.b.body.code).toBe(code);
      expect(await evaluationOf(ep)).toBe('accepted');
      expect(placeOf(await snapshot())).toEqual(before);
      // "Delete anyway" is refused the same.
      expect((await del(w.s, ANYWAY)).body.code).toBe(code);
      expect(placeOf(await snapshot())).toEqual(before);
    });

    test.each([
      ['an episode that uses the set directly', async () => ({ ep: await direct(w.s) })],
      ['an episode linked to an event held at the set', () => eventOnly(w.s)],
    ])('the delete first, on %s: the acceptance waits for it, then succeeds on the episode as the delete left it', async (_what, make) => {
      const { ep } = await make();
      const out = await race('delete first, then acceptance', () => send(del(w.s, into(w.r))), deleteHoldsAll, () => settle(completeEpisode(ep, show, sequelize)));
      noDeadlock(out);
      expect(out.how).toBe('blocked');
      expect(out.a.status).toBe(200);
      if (!out.b.ok) throw out.b.error;
      expect(await evaluationOf(ep)).toBe('accepted');
      expect(await removedAt(w.s)).not.toBeNull();
      expect((await liveRefs(w.s)).total).toBe(0);
    });

    test('a real two-part completion racing the delete of the event\'s set: the completion first, and the delete waits and is refused (PLACE_LOCKED); the delete first, and the completion waits, then accepts both parts', async () => {
      const tp = await twoParter();
      const before = placeOf(await snapshot(tp.show));
      const first = await race('two-part completion first, then delete', () => settle(completeEpisode(tp.partTwo, tp.show, sequelize)), holdsEpisodeForUpdate, () => send(del(tp.sets.s, into(tp.sets.r))));
      if (!first.a.ok) throw first.a.error;
      noDeadlock(first);
      expect(first.how).toBe('blocked');
      expect(first.b.status).toBe(409);
      expect(first.b.body.code).toBe(PLACE_LOCKED_CODE);
      expect([await evaluationOf(tp.partOne), await evaluationOf(tp.partTwo)]).toEqual(['accepted', 'accepted']);
      expect(placeOf(await snapshot(tp.show))).toEqual(before);
      trace.uninstall();
      trace = null;

      const again = await twoParter();
      const second = await race('delete first, then two-part completion', () => send(del(again.sets.s, into(again.sets.r))), deleteHoldsAll, () => settle(completeEpisode(again.partTwo, again.show, sequelize)));
      noDeadlock(second);
      expect(second.how).toBe('blocked');
      expect(second.a.status).toBe(200);
      if (!second.b.ok) throw second.b.error;
      expect([await evaluationOf(again.partOne), await evaluationOf(again.partTwo)]).toEqual(['accepted', 'accepted']);
      expect((await eventRow(again.ev)).scene_set_id).toBe(again.sets.r);
    });

    test('the gap of a real two-part completion (Part 1 accepted and committed, Part 2 not yet): the event\'s set stays, by either kind of delete, and nothing changes. KNOWN GAP (not closed by PR 1): a set only Part 2 uses directly can still be deleted in the gap, and Part 2 is then accepted with a beat on a removed set', async () => {
      const tp = await twoParter();
      await useDirect(tp.partTwo, tp.sets.t, { role: 'extra', n: 3, scene: false });
      // The real completion, stopped just after Part 1's acceptance committed; no lock is held in the gap.
      let partOneAccepted = false;
      const gap = gateOn((rec) => {
        if (rec.txId && rec.kind === 'write' && rec.table === 'episodes') partOneAccepted = true;
        return partOneAccepted && rec.kind === 'commit';
      });
      const completion = settle(completeEpisode(tp.partTwo, tp.show, sequelize));
      await gap.reached;
      expect([await evaluationOf(tp.partOne), await evaluationOf(tp.partTwo)]).toEqual(['accepted', expect.not.stringMatching(/^accepted$/)]);
      const before = placeOf(await snapshot(tp.show));
      for (const query of [into(tp.sets.r), ANYWAY]) {
        const res = await del(tp.sets.s, query);
        expect(res.status).toBe(409);
        expect(res.body.code).toBe(PLACE_LOCKED_CODE);
      }
      expect(placeOf(await snapshot(tp.show))).toEqual(before);
      // The known gap: Part 2 is neither accepted nor filmed yet, so nothing refuses this.
      const partTwoOnly = await del(tp.sets.t, ANYWAY);
      expect(partTwoOnly.status).toBe(200);
      gap.open();
      const done = await completion;
      if (!done.ok) throw done.error;
      expect(await evaluationOf(tp.partTwo)).toBe('accepted');
      expect(await removedAt(tp.sets.t)).not.toBeNull();
      expect(await rows('SELECT beat_number FROM scene_plans WHERE episode_id = :ep AND scene_set_id = :t AND deleted_at IS NULL', { ep: tp.partTwo, t: tp.sets.t })).toEqual([{ beat_number: 3 }]);
    });
  });

  // ══ The first clip ═════════════════════════════════════════════════════
  describe('[real lock] against an episode\'s first raw clip (rawClipsService.createClip)', () => {
    const clipHoldsEpisode = (rec) => Boolean(rec.txId) && rec.kind === 'lock' && rec.table === 'episodes' && rec.mode === 'share';
    const KINDS = [
      ['an episode that uses the set directly', async () => ({ ep: await direct(w.s) })],
      ['an episode linked to an event held at the set', () => eventOnly(w.s)],
    ];

    test.each(KINDS)('the clip first, on %s: the delete waits, then 409 EPISODE_SNAPSHOT_FROZEN; nothing changed but the clip', async (_what, make) => {
      const { ep } = await make();
      const before = await snapshot();
      const out = await race('clip first', () => settle(clip(ep)), clipHoldsEpisode, () => send(del(w.s, into(w.r))));
      if (!out.a.ok) throw out.a.error;
      noDeadlock(out);
      expect(out.how).toBe('blocked');
      expect(out.b.status).toBe(409);
      expect(out.b.body).toMatchObject({ success: false, code: 'EPISODE_SNAPSHOT_FROZEN', episode_id: ep });
      const after = await snapshot();
      expect(after.clips).toHaveLength(1);
      expect({ ...after, clips: [] }).toEqual({ ...before, clips: [] });
    });

    test.each(KINDS)('the delete first, on %s: the clip waits, then attaches to the episode as the delete left it', async (_what, make) => {
      const { ep } = await make();
      const out = await race('delete first, then clip', () => send(del(w.s, into(w.r))), deleteHoldsAll, () => settle(clip(ep)));
      noDeadlock(out);
      expect(out.how).toBe('blocked');
      expect(out.a.status).toBe(200);
      if (!out.b.ok) throw out.b.error;
      expect((await snapshot()).clips).toHaveLength(1);
      expect(await removedAt(w.s)).not.toBeNull();
    });
  });

  // ══ KNOWN INCOMPATIBILITY ══════════════════════════════════════════════
  // The four writers below still take the EVENT row first and reach the
  // episode row afterwards (through the foreign key of the location row they
  // insert for an episode that has no Event location yet). The delete takes
  // the episode first, exclusively, and then the event. With the writer
  // first that is a real deadlock (40P01). PR 2 changes those writers to
  // take the linked episodes before the event; until then PR 1 is NOT to be
  // deployed. These cases assert what really happens on this code, with both
  // sides held open at the deadlock. They are not a design to keep.
  describe('KNOWN INCOMPATIBILITY with the event-first writers, until PR 2 [real lock]: the writer first, on an episode with no Event location row', () => {
    /** The writer holds the event row; the delete holds the episode and waits for the event; then the writer goes on to the episode. */
    async function deadlock(name, writer, target, query) {
      const g = gateOn(holdsEventRow);
      const p1 = writer();
      await g.reached;
      const p2 = send(del(target, query));
      const end = Date.now() + 8000;
      while (await waiting() === 0 && Date.now() < end) await sleep(15); // the delete waits for the event row
      expect(await waiting()).toBe(1);
      g.open();
      const [a, b] = await Promise.all([p1, p2]);
      const errors = lockErrors(trace.records);
      const victim = trace.records.find((r) => r.error === '40P01');
      observed.push({ name: `KNOWN INCOMPATIBILITY: ${name}`, writer: a.status ?? (a.ok ? 'ok' : `threw ${a.error?.code || a.error?.message}`), del: `${b.status} ${b.body?.code || ''}`, errors, pauses: pause.mock.calls.length, victimSql: victim?.sql?.slice(0, 60) });
      return { a, b, errors, victim };
    }

    test('the event edit (PUT event, a set change): a deadlock is raised (40P01); the delete is its victim, tries again after its pause and succeeds; the edit succeeds; no database text in either answer', async () => {
      const { ep, ev } = await eventOnly(w.s);
      const out = await deadlock('event PUT', () => send(putEvent(ev, { scene_set_id: w.t })), w.s, into(w.r));
      expect(out.errors).toEqual(['40P01']);
      expect(out.victim.sql).toMatch(/world_events/); // the delete, waiting for the event row
      expect(out.a.status).toBe(200);
      expect(out.b.status).toBe(200);
      expect(pause.mock.calls).toEqual([[DELAY]]);
      expect(JSON.stringify([out.a.body, out.b.body])).not.toMatch(/deadlock/);
      expect((await eventRow(ev)).scene_set_id).toBe(w.t);
      expect(await linksOf(ep)).toEqual([{ scene_set_id: w.t, role: 'event' }]);
      expect(await removedAt(w.s)).not.toBeNull();
    });

    test('scene-set-link (a chosen set): the same deadlock; the delete is the victim and succeeds on its second try', async () => {
      const { ev } = await eventOnly(w.s, { brief: false });
      const out = await deadlock('scene-set-link', () => send(linkSet(ev, w.t)), w.s, into(w.r));
      expect(out.errors).toEqual(['40P01']);
      expect(out.a.status).toBe(200);
      expect(out.b.status).toBe(200);
      expect(pause.mock.calls).toEqual([[DELAY]]);
      expect((await eventRow(ev)).scene_set_id).toBe(w.t);
    });

    test('makeEventVersion: the same deadlock; the delete is the victim and succeeds on its second try', async () => {
      const { ev } = await eventOnly(w.s);
      const out = await deadlock('makeEventVersion', () => settle(makeEventVersion(sequelize, { setId: w.t, everydaySetId: w.r, eventId: ev })), w.s, ANYWAY);
      expect(out.errors).toEqual(['40P01']);
      if (!out.a.ok) throw out.a.error;
      expect(out.b.status).toBe(200);
      expect(pause.mock.calls).toEqual([[DELAY]]);
      expect((await eventRow(ev)).scene_set_id).toBe(w.t);
    });

    test('makeEveryday (the event returned to the everyday set): the same deadlock; the delete is the victim and succeeds on its second try', async () => {
      const { ep, ev } = await eventOnly(w.s);
      expect((await settle(makeEventVersion(sequelize, { setId: w.t, everydaySetId: w.r, eventId: ev }))).ok).toBe(true);
      // As an episode that has no Event location row (the version's move gave it one).
      await run('UPDATE scene_set_episodes SET deleted_at = NOW() WHERE episode_id = :ep', { ep });
      const out = await deadlock('makeEveryday', () => settle(makeEveryday(sequelize, w.t, { returnEvent: true })), w.t, ANYWAY);
      expect(out.errors).toEqual(['40P01']);
      if (!out.a.ok) throw out.a.error;
      expect(out.b.status).toBe(200);
      expect(pause.mock.calls).toEqual([[DELAY]]);
      expect((await eventRow(ev)).scene_set_id).toBe(w.r);
    });

    test('the delete first against the same four writers: no deadlock (each waits for the delete\'s event or set row, or is refused)', async () => {
      const cases = [
        ['event PUT', async () => { const x = await eventOnly(w.s); return { target: w.s, go: () => send(putEvent(x.ev, { scene_set_id: w.t })) }; }],
        ['scene-set-link', async () => { const u = await set('Hall U'); const x = await eventOnly(u, { brief: false }); return { target: u, go: () => send(linkSet(x.ev, w.t)) }; }],
        ['makeEventVersion', async () => { const u = await set('Hall V'); const x = await eventOnly(u); return { target: u, go: () => settle(makeEventVersion(sequelize, { setId: w.home2, everydaySetId: w.home, eventId: x.ev })) }; }],
        ['makeEveryday', async () => {
          const version = await set('Hall W');
          const everyday = await set('Hall X');
          const x = await eventOnly(everyday);
          expect((await settle(makeEventVersion(sequelize, { setId: version, everydaySetId: everyday, eventId: x.ev }))).ok).toBe(true);
          return { target: version, go: () => settle(makeEveryday(sequelize, version, { returnEvent: true })) };
        }],
      ];
      for (const [name, make] of cases) {
        const { target, go } = await make();
        const out = await race(`delete first, then ${name}`, () => send(del(target, ANYWAY)), deleteHoldsAll, go);
        noDeadlock(out);
        expect(out.a.status).toBe(200);
        trace.uninstall();
        trace = null;
      }
    });
  });


  // ══ RECORDED GAP (for PR 2 / S1; Evoni, 2026-11-24) ════════════════════
  // Not changed by PR 1, and not a delete: written down here as it is today.
  describe('RECORDED GAP (PR 2 / S1, not changed here): the Place of a FILMED, not accepted episode\'s event can still be changed by the event edit and by scene-set-link', () => {
    test('the event edit (PUT event, a set change) on a filmed episode\'s event: 200, the event and the episode\'s Event location moved', async () => {
      const { ep, ev } = await eventOnly(w.s);
      await film(ep);
      const res = await putEvent(ev, { scene_set_id: w.t });
      expect(res.status).toBe(200);
      expect((await eventRow(ev)).scene_set_id).toBe(w.t);
      expect(await linksOf(ep)).toEqual([{ scene_set_id: w.t, role: 'event' }]);
      // The delete of that set is refused for the same episode.
      expect((await del(w.t, ANYWAY)).body.code).toBe('EPISODE_SNAPSHOT_FROZEN');
    });

    test('scene-set-link (a chosen set) on a filmed episode\'s event: 200, the event moved', async () => {
      const { ep, ev } = await eventOnly(w.s, { brief: false });
      await film(ep);
      const res = await linkSet(ev, w.t);
      expect(res.status).toBe(200);
      expect((await eventRow(ev)).scene_set_id).toBe(w.t);
    });
  });

  describe('the network guard', () => {
    test('no external network attempt in this file', () => {
      const mine = networkGuard.getState().events.slice(guardEventsAtStart);
      expect(mine.filter((e) => e.type === 'attempt')).toEqual([]);
    });
  });
});
