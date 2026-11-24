/**
 * Generation B1 (Evoni, 2026-11-23;
 * docs/audit/F-AUTH-1_PlaceLockGenerationB1_Amendment_2026-11-23.md):
 * generate-venue saves what it generated through the Place finalizer
 * (utils/placeLock finalizePlaceWrite).
 *
 *   - new venue: the set, its angles, the event's move to it and the draft
 *     episode's Event location are one transaction;
 *   - missing base: generateBaseScene's final write is that transaction's
 *     work;
 *   - a save refused after the picture was made (the Place locked, the
 *     event's set changed, the event deleted, every try a lock conflict)
 *     answers 409 `generated_not_saved`: nothing written, nothing deleted
 *     from storage, the provider never called again, the stored key logged;
 *   - the three callers that mark a base failed do not for that refusal.
 *
 * On the migrated test database, through the real app, against the real
 * acceptance (episodeCompletionService.completeEpisode, a real two-part
 * completion), the real event PUT and the real makeEventVersion. The image
 * provider (axios) and object storage (S3Client) are doubles; a latch in the
 * provider double holds a generation open while something else commits.
 * Interleavings are held with that latch, tests/helpers/lockTrace's gate or
 * a second transaction, and a wait is seen in pg_stat_activity, never slept
 * for.
 *
 * This file sends no DDL.
 */
jest.unmock('uuid');

// The bucket is read when the services load: set before they are required,
// so the venue path stores (in the double) and has keys to log.
process.env.S3_PRIMARY_BUCKET = 'genb1-test-bucket';

// A real completion writes its story record with the model after it commits;
// that call is answered here with a refusal, which completion logs and
// survives.
const mockAnthropic = jest.fn(async () => { throw new Error('the model is not called in the Generation B1 races'); });
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
const { seedArc } = require('../../src/services/arcProgressionService');
const { makeEventVersion } = require('../../src/services/sceneSetVersionService');
const sceneGen = require('../../src/services/sceneGenerationService');
const lookService = require('../../src/services/venueLookImageService');
const lockTrace = require('../helpers/lockTrace');
const networkGuard = require('../networkGuard/core');
const { placeLockFixtures, waitForLockWait } = require('../helpers/placeLockFixtures');

const { sequelize } = models;
const { isPlaceLocked, PLACE_LOCKED_CODE, PLACE_LOCKED_MESSAGE, PLACE_FINALIZE_OUTCOMES: O } = placeLock;
const { PlaceFinalizeRefusal, GENERATED_NOT_SAVED_MESSAGE } = sceneGen;
const fs = require('fs');
const path = require('path');

const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const STALE_MESSAGE = "This event's scene set changed while this was being made. Nothing was saved over the newer choice.";
const EXHAUSTED_MESSAGE = 'This could not be saved: the event or its episode was busy on every try. Nothing was saved.';
const DELETED_MESSAGE = 'This event was deleted. Nothing was started or linked.';
/** The 409 a generation answers when its picture was made and not saved. */
const notSaved = (code, error) => ({ success: false, outcome: 'generated_not_saved', code, error, message: GENERATED_NOT_SAVED_MESSAGE });
const EARLY_LOCKED = { success: false, code: PLACE_LOCKED_CODE, error: PLACE_LOCKED_MESSAGE };
/** The 500 a generation answers when its picture was made and stored and the save then failed for another reason. */
const SAVE_FAILED = {
  success: false,
  outcome: 'failed',
  code: 'GENERATED_SAVE_FAILED',
  error: 'The image was generated and stored, but saving it failed. Nothing was saved.',
  message: 'The image was generated and stored, but saving it failed. Generating it again costs again.',
};
// What a database error carries and an answer must not: SQL, a constraint's text, a stack, a URL, a signature.
const LEAK = /INSERT|UPDATE|SELECT|violates|constraint|relation|\bat .*\.js|https?:|X-Amz|\?|secret/i;
/** An error as the database driver throws one: its message, SQL and parameters name rows, values and a signed URL. */
const databaseError = () => Object.assign(
  new Error('insert or update on table "scene_angles" violates foreign key constraint "scene_angles_scene_set_id_fkey" https://secret.example/x.jpg?X-Amz-Signature=secret'),
  {
    name: 'SequelizeForeignKeyConstraintError',
    original: { code: '23503', detail: 'Key (scene_set_id)=(secret) is not present' },
    sql: 'INSERT INTO "scene_angles" ("id","still_image_url") VALUES ($1,$2)',
    parameters: ['id', 'https://secret.example/x.jpg?X-Amz-Signature=secret'],
  });
const DELAY = sceneGen.PLACE_FINALIZE_RETRY_DELAY_MS;

// Filled per test: what a failing test must not leave open (transactions, gates, latches).
const open = [];
/** What a call ended in, never an unhandled rejection. */
const settle = (promise) => promise.then(
  (value) => ({ ok: true, value }),
  (error) => ({ ok: false, error, lock: isLockConflict(error) ? (error.original?.code || error.parent?.code || error.code) : null }));
/** Sends a supertest request now (it is lazy until awaited). */
const send = (req) => req.then((res) => res);

(shouldSkip ? describe.skip : describe)('Generation B1: generate-venue saves through the Place finalizer', () => {
  // GENB1_TEST_TIMEOUT_MS: a shorter limit for a control run against other
  // sources, where a held interleaving is never reached and each such case
  // would wait out the whole limit.
  jest.setTimeout(Number(process.env.GENB1_TEST_TIMEOUT_MS) || 90000);
  const fx = placeLockFixtures(sequelize, models);
  const { run, rows, mkShow, mkEpisode, mkEvent, mkBrief, mkSet, mkLocation, evaluationOf, eventRow } = fx;
  const TAG = fx.uuid().slice(0, 8);
  let show;
  let location;
  let editorToken;
  let PNG;
  let trace = null;
  let guardEventsAtStart = 0;
  let usageLog = null;
  let pause = null; // the finalizer's pause between tries, watched (it really waits unless a case answers for it)
  const usageLogIds = [];
  const saved = {};

  // Each admin request is another admin: the AI rate limiter counts by account.
  let admins = 0;
  const adminToken = () => {
    admins += 1;
    return TokenService.generateTokenPair({ id: `genb1-admin-${TAG}-${admins}`, email: `admin${admins}@genb1.dev`, name: 'Admin', groups: ['ADMIN'], role: 'ADMIN' }).accessToken;
  };
  const asAdmin = (r) => r.set('X-Forwarded-For', `10.94.${Math.floor(admins / 250)}.${(admins % 250) + 1}`).set('Authorization', `Bearer ${adminToken()}`);
  const generate = (ev, body = {}, showId = show) => asAdmin(request(app).post(`/api/v1/world/${showId}/events/${ev}/generate-venue`)).send(body);

  // ── The provider double ────────────────────────────────────────────────
  const provider = { calls: [], hold: null, fail: false, during: null };
  /** The next provider call waits, after it is counted, until release(). */
  function holdGeneration() {
    let release;
    let reached;
    const hold = { used: false };
    hold.wait = new Promise((resolve) => { release = resolve; });
    hold.reached = new Promise((resolve) => { reached = resolve; });
    hold.arrive = reached;
    provider.hold = hold;
    open.push(async () => release());
    return { reached: hold.reached, release };
  }
  const falCalls = () => provider.calls;
  const s3Calls = (name) => mockS3Send.mock.calls.map(([cmd]) => cmd).filter((cmd) => cmd?.constructor?.name === name);
  const puts = () => s3Calls('PutObjectCommand').map((cmd) => cmd.input.Key);
  const deletes = () => s3Calls('DeleteObjectCommand');
  const orphanLines = () => console.error.mock.calls.map(([first]) => String(first)).filter((line) => line.startsWith('[GeneratedNotSaved]'));

  // ── Fixtures ───────────────────────────────────────────────────────────
  const noBase = (name, fields = {}) => mkSet(show, `${name} ${fx.uuid().slice(0, 6)}`, { generation_status: 'pending', base_model: 'flux-dev', world_location_id: location, ...fields });
  const withBase = (name, fields = {}) => mkSet(show, `${name} ${fx.uuid().slice(0, 6)}`, { base_still_url: `https://cdn.example/${fx.uuid()}.jpg`, base_model: 'flux-dev', world_location_id: location, ...fields });
  /** A draft episode and its primary event (stamp and Brief), at `set`. */
  async function primary({ evaluation = 'pending', set = null, showId = show } = {}) {
    const ep = await mkEpisode(showId, { evaluation });
    const ev = await mkEvent(showId, { stamp: ep, set, loc: location });
    await mkBrief(showId, ep, ev);
    return { ep, ev };
  }
  /** A draft episode and an event linked to it by its stamp alone (a non-primary event's link). */
  async function stampOnly({ set = null } = {}) {
    const ep = await mkEpisode(show);
    const ev = await mkEvent(show, { stamp: ep, set, loc: location });
    return { ep, ev };
  }
  /** The episode's Event location at `at`, and two beats there: one free, one locked. */
  async function place(ep, at) {
    await run(`INSERT INTO scene_set_episodes (id, scene_set_id, episode_id, sort_order, role, created_at, updated_at)
               VALUES (:id, :at, :ep, 0, 'event', NOW(), NOW())`, { id: fx.uuid(), at, ep });
    for (const [n, locked] of [[10, false], [11, true]]) {
      await run(`INSERT INTO scene_plans (id, episode_id, beat_number, beat_name, scene_set_id, angle_label, locked, chosen_by_user, sort_order, ai_suggested, created_at, updated_at)
                 VALUES (:id, :ep, :n, 'Beat', :at, 'WIDE', :locked, false, :n, false, NOW(), NOW())`, { id: fx.uuid(), ep, n, at, locked });
    }
  }
  const eventLinks = (ep) => rows("SELECT scene_set_id, role, role_name, sort_order FROM scene_set_episodes WHERE episode_id = :ep AND deleted_at IS NULL ORDER BY sort_order, role", { ep });
  const plans = (ep) => rows('SELECT beat_number, scene_set_id, angle_label, locked FROM scene_plans WHERE episode_id = :ep AND deleted_at IS NULL ORDER BY beat_number', { ep });
  const setRow = async (id) => (await rows('SELECT * FROM scene_sets WHERE id = :id', { id }))[0] || null;
  const setCount = async (showId = show) => (await rows('SELECT COUNT(*)::int AS n FROM scene_sets WHERE show_id = :showId', { showId }))[0].n;
  const anglesOf = (setId) => rows('SELECT * FROM scene_angles WHERE scene_set_id = :setId ORDER BY sort_order', { setId });
  /** Every row a generation could change, for a show: sets, angles, episode links, plans, scenes. */
  async function snapshot(showId = show) {
    const by = { showId };
    return {
      sets: await rows('SELECT * FROM scene_sets WHERE show_id = :showId ORDER BY id', by),
      angles: await rows('SELECT a.* FROM scene_angles a JOIN scene_sets s ON s.id = a.scene_set_id WHERE s.show_id = :showId ORDER BY a.id', by),
      links: await rows('SELECT l.* FROM scene_set_episodes l JOIN episodes e ON e.id = l.episode_id WHERE e.show_id = :showId ORDER BY l.id', by),
      plans: await rows('SELECT p.* FROM scene_plans p JOIN episodes e ON e.id = p.episode_id WHERE e.show_id = :showId ORDER BY p.id', by),
      scenes: await rows('SELECT sc.* FROM scenes sc JOIN episodes e ON e.id = sc.episode_id WHERE e.show_id = :showId ORDER BY sc.id', by),
    };
  }
  /** The same, with one set left out (the base path marks and restores its own set). */
  const without = (snap, setId) => ({ ...snap, sets: snap.sets.filter((s) => s.id !== setId) });
  const IMAGE_COLUMNS = ['base_still_url', 'base_runway_prompt', 'base_runway_seed', 'style_reference_url', 'cover_angle_id', 'generation_cost'];
  const imagesOf = (row) => Object.fromEntries(IMAGE_COLUMNS.map((c) => [c, row[c]]));

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
  function tracing() {
    trace = lockTrace.install(sequelize);
    return trace;
  }
  function gateOn(predicate) {
    const g = (trace || tracing()).gate(predicate);
    open.push(async () => g.open());
    return g;
  }
  const writesOf = (records, table) => records.filter((r) => (r.kind === 'write' || r.kind === 'insert') && (!table || r.table === table));
  const lockErrors = (records) => records.filter((r) => r.error === '55P03' || r.error === '40P01').map((r) => r.error);

  /** Made by the season routes and Start Episode: { show, set, ev, partOne, partTwo }. */
  async function twoParter() {
    const seasonShow = await mkShow('Generation B1 season');
    const { arc_id: arcId } = await seedArc(seasonShow, models);
    const set = await mkSet(seasonShow, `Two-part set ${fx.uuid().slice(0, 6)}`, { generation_status: 'pending', base_model: 'flux-dev' });
    const ev = await mkEvent(seasonShow, { name: 'The Finale Gala', set });
    const slotId = async (n) => (await rows('SELECT id FROM season_slots WHERE arc_id = :arcId AND slot_number = :n', { arcId, n }))[0].id;
    const asEditor = (r) => r.set('Authorization', `Bearer ${editorToken}`);
    expect((await asEditor(request(app).put(`/api/v1/world/${seasonShow}/season/slots/${await slotId(12)}/event`)).send({ event_id: ev })).status).toBe(200);
    const made = await asEditor(request(app).post(`/api/v1/world/${seasonShow}/season/two-parters`)).send({ slot_id: await slotId(12) });
    expect(made.status).toBe(201);
    const one = await asAdmin(request(app).post(`/api/v1/world/${seasonShow}/events/${ev}/generate-episode`)).send({ draft_script: false });
    expect(one.status).toBe(201);
    const two = await asEditor(request(app).post(`/api/v1/world/${seasonShow}/season/two-parters/${made.body.data.id}/part-two`));
    expect(two.status).toBe(201);
    return { show: seasonShow, set, ev, partOne: one.body.data.episode.id, partTwo: two.body.data.episode.id };
  }

  beforeAll(async () => {
    guardEventsAtStart = networkGuard.getState().events.length;
    PNG = await sharp({ create: { width: 4, height: 4, channels: 3, background: '#ffffff' } }).png().toBuffer();
    editorToken = TokenService.generateTokenPair({ id: `genb1-editor-${TAG}`, email: 'editor@genb1.dev', name: 'Editor', groups: ['USER', 'EDITOR'], role: 'USER' }).accessToken;
    location = await mkLocation('Generation B1 hall');
  });
  beforeEach(async () => {
    // A show per test: its own ledger for the completions, and only its own rows in a snapshot.
    show = await mkShow('Generation B1');
    for (const k of ['FAL_KEY', 'AI_DAILY_IMAGE_BUDGET_USD', 'AI_DAILY_BUDGET_USD', 'ANTHROPIC_API_KEY']) saved[k] = process.env[k];
    process.env.FAL_KEY = 'test-fal';
    process.env.AI_DAILY_IMAGE_BUDGET_USD = '100000';
    process.env.AI_DAILY_BUDGET_USD = '100000';
    delete process.env.ANTHROPIC_API_KEY;
    provider.calls = [];
    provider.hold = null;
    provider.fail = false;
    provider.during = null;
    mockS3Send.mockClear();
    // Provider doubles: no request leaves the process. A real (tiny) image,
    // since the base path stores it through sharp. The provider's URL carries
    // a signature, as a signed URL does: it must never reach a log line.
    axios.get.mockImplementation(async () => ({ data: PNG }));
    axios.post.mockImplementation(async (url) => {
      if (!String(url).startsWith('https://fal.run/')) throw new Error(`unexpected provider call ${url}`);
      provider.calls.push(String(url));
      const n = provider.calls.length;
      const hold = provider.hold;
      if (hold && !hold.used) {
        hold.used = true;
        hold.arrive();
        await hold.wait;
      }
      if (provider.during) await provider.during();
      if (provider.fail) throw Object.assign(new Error('provider down'), { response: { status: 400, data: {} } });
      return { status: 200, data: { images: [{ url: `https://fal.media/genb1-${n}.jpg?X-Amz-Signature=do-not-log-this` }] } };
    });
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    // The provider calls are logged with a cost (ai_usage_logs): the rows
    // this file logs are removed at the end, so the database's day of spend
    // is not left higher for the suites that run on the default budget.
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
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  });
  afterAll(async () => {
    await new Promise((resolve) => setTimeout(resolve, 500)); // completion's and Start Episode's after-commit work
    // The venues the route made are sets of these shows too.
    for (const showId of fx.made.shows) {
      const made = await rows('SELECT id FROM scene_sets WHERE show_id = :showId', { showId });
      for (const { id } of made) if (!fx.made.sets.includes(id)) fx.made.sets.push(id);
    }
    if (fx.made.sets.length) await run('DELETE FROM scene_angles WHERE scene_set_id IN (:ids)', { ids: fx.made.sets });
    if (usageLogIds.length) await run('DELETE FROM ai_usage_logs WHERE id IN (:ids)', { ids: usageLogIds });
    await fx.cleanup();
  });

  // ══ The new-venue path ═════════════════════════════════════════════════
  describe('a new venue', () => {
    test('saved as before, in one transaction after the paid work; the draft episode\'s Event location follows, as an event edit moves it', async () => {
      const from = await withBase('Old hall');
      const { ep, ev } = await primary({ set: from });
      await place(ep, from);
      const sets = await setCount();
      const t = tracing();

      const res = await generate(ev, { force: true });

      expect(res.status).toBe(200);
      const id = res.body.data.scene_set_id;
      expect(res.body).toEqual({
        success: true,
        outcome: 'generated',
        data: {
          kind: 'venue',
          venue_url: expect.stringMatching(/^https:\/\/genb1-test-bucket\.s3\..*\/venues\/.*-venue\.png$/),
          exterior_url: expect.stringMatching(/-exterior\.png$/),
          scene_set_id: expect.any(String),
          world_location_id: location,
          brief: expect.any(Object),
        },
        message: expect.stringMatching(/^Venue images generated for ".*" — scene set created$/),
      });
      // One provider call per image, one put per image, nothing deleted.
      expect(falCalls()).toHaveLength(2);
      expect(puts()).toHaveLength(2);
      expect(deletes()).toHaveLength(0);
      expect(await setCount()).toBe(sets + 1);
      const set = await setRow(id);
      expect(set).toMatchObject({ base_still_url: res.body.data.venue_url, generation_status: 'complete', world_location_id: location, show_id: show });
      expect(set.base_generation).toMatchObject({ source: 'venue_generation', generated_for_event: ev });
      // The timestamp was made before the transaction, and is the row's own.
      expect(new Date(set.created_at).toISOString()).toBe(set.base_generation.generated_at);
      expect(new Date(set.updated_at).toISOString()).toBe(set.base_generation.generated_at);
      const angles = await anglesOf(id);
      expect(angles.map((a) => [a.angle_label, a.angle_kind, a.sort_order])).toEqual([['ESTABLISHING', 'front', 0], ['interior_wide', 'inside', 1]]);
      expect(angles[1].still_image_url).toBe(res.body.data.venue_url);
      const event = await eventRow(ev);
      expect(event.scene_set_id).toBe(id);
      expect(new Date(event.updated_at).toISOString()).toBe(set.base_generation.generated_at);

      // Every write of the save ran in one transaction: the finalizer's.
      const insert = t.records.find((r) => r.kind === 'insert' && r.table === 'scene_sets');
      expect(insert.txId).toBeTruthy();
      const inTx = t.records.filter((r) => r.txId === insert.txId);
      expect(inTx.filter((r) => r.kind === 'insert' && r.table === 'scene_angles')).toHaveLength(2);
      expect(inTx.filter((r) => r.kind === 'write' && r.table === 'world_events')).toHaveLength(1);
      expect(inTx.filter((r) => r.kind === 'write' && r.table === 'scene_set_episodes')).toHaveLength(1);
      expect(inTx.filter((r) => r.kind === 'write' && r.table === 'scene_plans')).toHaveLength(1);
      expect(inTx.at(-1).kind).toBe('commit');
      expect(lockTrace.classSequence(inTx).slice(0, 2)).toEqual(['E:episodes:share', 'W:world_events:update']);
      // No write to these tables ran outside it.
      expect(writesOf(t.records).filter((r) => !r.txId && ['scene_sets', 'scene_angles', 'world_events', 'scene_set_episodes', 'scene_plans'].includes(r.table))).toEqual([]);

      // The draft episode: its Event location and its free beat moved; the locked beat stayed.
      expect(await eventLinks(ep)).toEqual([{ scene_set_id: id, role: 'event', role_name: null, sort_order: 0 }]);
      expect(await plans(ep)).toEqual([
        { beat_number: 10, scene_set_id: id, angle_label: null, locked: false },
        { beat_number: 11, scene_set_id: from, angle_label: 'WIDE', locked: true },
      ]);

      // Exactly what a real event PUT to that set does to a twin episode.
      const twin = await primary({ set: from });
      await place(twin.ep, from);
      const put = await asAdmin(request(app).put(`/api/v1/world/${show}/events/${twin.ev}`)).send({ scene_set_id: id });
      expect(put.status).toBe(200);
      expect(await eventLinks(twin.ep)).toEqual(await eventLinks(ep));
      expect(await plans(twin.ep)).toEqual(await plans(ep));
    });

    test('an event with no set and no episode: saved, null was the source set', async () => {
      const ev = await mkEvent(show, { loc: location });
      const res = await generate(ev);
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ success: true, outcome: 'generated', data: { kind: 'venue' } });
      expect((await eventRow(ev)).scene_set_id).toBe(res.body.data.scene_set_id);
      expect(falCalls()).toHaveLength(2);
    });

    describe.each([
      ['its primary event (stamp and Brief)', primary],
      ['an event linked by its stamp alone (non-primary)', stampOnly],
    ])('the episode accepted during generation, for %s', (_name, make) => {
      test('409 generated_not_saved PLACE_LOCKED: one provider call per image, stored and not deleted, nothing written, the stored keys logged', async () => {
        const from = await withBase('Kept hall');
        const { ep, ev } = await make({ set: from });
        await place(ep, from);
        const hold = holdGeneration();
        const pending = send(generate(ev, { force: true }));
        await hold.reached; // the early check passed; the provider is being paid
        await accept(ep); // a real completion, committed
        const before = await snapshot();
        const event = await eventRow(ev);
        const t = tracing();
        hold.release();
        const res = await pending;

        expect(res.status).toBe(409);
        expect(res.body).toEqual(notSaved(PLACE_LOCKED_CODE, PLACE_LOCKED_MESSAGE));
        expect(falCalls()).toHaveLength(2);
        expect(puts()).toHaveLength(2);
        expect(deletes()).toHaveLength(0);
        expect(await eventRow(ev)).toEqual(event);
        expect(await snapshot()).toEqual(before);
        expect(writesOf(t.records).filter((r) => ['scene_sets', 'scene_angles', 'world_events', 'scene_set_episodes', 'scene_plans', 'scenes'].includes(r.table))).toEqual([]);
        const lines = orphanLines();
        expect(lines).toHaveLength(1);
        for (const key of puts()) expect(lines[0]).toContain(key);
        expect(lines[0]).toContain(`event=${ev}`);
        expect(lines[0]).toContain('outcome=PLACE_LOCKED');
        expect(lines[0]).toContain('attempts=1');
        expect(lines[0]).toMatch(/usage_log_ids=\d+,\d+/);
        expect(lines[0]).toContain('nothing was deleted from storage');
        // A key, never a URL: no query string, no signature, no host.
        for (const call of console.error.mock.calls) expect(call.map(String).join(' ')).not.toMatch(/\?|X-Amz|do-not-log|https?:\/\//);
      });

      test('the acceptance holding its episode when the save begins: the save waits for it, then is refused', async () => {
        const { ep, ev } = await make({ set: await withBase('Raced hall') });
        const sets = await setCount();
        const hold = holdGeneration();
        const pending = send(generate(ev, { force: true }));
        await hold.reached;
        const g = gateOn((rec) => Boolean(rec.txId) && rec.kind === 'lock' && rec.table === 'episodes' && rec.mode === 'update');
        const acceptance = settle(completeEpisode(ep, show, sequelize));
        await Promise.race([g.reached, acceptance]); // the acceptance holds its episode FOR UPDATE
        hold.release();
        await waitForLockWait(sequelize, `%FROM episodes WHERE id IN%${ep}%FOR SHARE%`);
        g.open();
        const [res, a] = await Promise.all([pending, acceptance]);
        if (!a.ok) throw a.error;
        expect(res.status).toBe(409);
        expect(res.body).toEqual(notSaved(PLACE_LOCKED_CODE, PLACE_LOCKED_MESSAGE));
        expect(await setCount()).toBe(sets);
        expect(falCalls()).toHaveLength(2);
        expect(await evaluationOf(ep)).toBe('accepted');
      });

      test('the save first: it commits; the acceptance waits for it and then succeeds', async () => {
        const { ep, ev } = await make({ set: await withBase('First hall') });
        const g = gateOn((rec) => Boolean(rec.txId) && rec.kind === 'insert' && rec.table === 'scene_sets');
        const pending = send(generate(ev, { force: true }));
        await g.reached; // the finalizer holds the episode FOR SHARE and the event row
        const acceptance = settle(completeEpisode(ep, show, sequelize));
        const waiter = await waitForLockWait(sequelize, `%episodes%${ep}%`);
        expect(waiter.query).toMatch(/episodes/);
        expect(await evaluationOf(ep)).not.toBe('accepted');
        g.open();
        const [res, a] = await Promise.all([pending, acceptance]);
        expect(a.lock).toBeFalsy();
        if (!a.ok) throw a.error;
        expect(res.status).toBe(200);
        expect(res.body).toMatchObject({ success: true, outcome: 'generated', data: { kind: 'venue' } });
        expect((await eventRow(ev)).scene_set_id).toBe(res.body.data.scene_set_id);
        expect(await evaluationOf(ep)).toBe('accepted');
        expect(await isPlaceLocked(sequelize, ev)).toBe(true);
        expect(lockErrors(trace.records)).toEqual([]);
      });
    });

    test('the event\'s set changed during generation (a real event PUT): STALE_SOURCE_SET; the newer set is kept, nothing written', async () => {
      const from = await withBase('Stale from');
      const to = await withBase('Stale to');
      const { ep, ev } = await primary({ set: from });
      const hold = holdGeneration();
      const pending = send(generate(ev, { force: true }));
      await hold.reached;
      const put = await asAdmin(request(app).put(`/api/v1/world/${show}/events/${ev}`)).send({ scene_set_id: to });
      expect(put.status).toBe(200);
      const before = await snapshot();
      const event = await eventRow(ev);
      hold.release();
      const res = await pending;
      expect(res.status).toBe(409);
      expect(res.body).toEqual(notSaved('STALE_SOURCE_SET', STALE_MESSAGE));
      expect(await eventRow(ev)).toEqual(event);
      expect(event.scene_set_id).toBe(to);
      expect(await snapshot()).toEqual(before);
      expect(await eventLinks(ep)).toEqual([expect.objectContaining({ scene_set_id: to, role: 'event' })]);
      expect(falCalls()).toHaveLength(2);
      expect(deletes()).toHaveLength(0);
      expect(orphanLines()).toEqual([expect.stringContaining('outcome=STALE_SOURCE_SET')]);
    });

    test('no set when it began, one chosen during generation: STALE_SOURCE_SET', async () => {
      const chosen = await withBase('Chosen since');
      const ev = await mkEvent(show, { loc: location });
      const hold = holdGeneration();
      const pending = send(generate(ev));
      await hold.reached;
      await run('UPDATE world_events SET scene_set_id = :chosen WHERE id = :ev', { chosen, ev });
      const before = await snapshot();
      hold.release();
      const res = await pending;
      expect(res.status).toBe(409);
      expect(res.body).toEqual(notSaved('STALE_SOURCE_SET', STALE_MESSAGE));
      expect((await eventRow(ev)).scene_set_id).toBe(chosen);
      expect(await snapshot()).toEqual(before);
    });

    test('the event soft-deleted during generation: EVENT_DELETED, nothing written', async () => {
      const ev = await mkEvent(show, { loc: location });
      const hold = holdGeneration();
      const pending = send(generate(ev));
      await hold.reached;
      await run('UPDATE world_events SET deleted_at = NOW() WHERE id = :ev', { ev });
      const before = await snapshot();
      const event = await eventRow(ev);
      hold.release();
      const res = await pending;
      expect(res.status).toBe(409);
      expect(res.body).toEqual(notSaved('EVENT_DELETED', DELETED_MESSAGE));
      expect(await eventRow(ev)).toEqual(event);
      expect(await snapshot()).toEqual(before);
      expect(orphanLines()).toEqual([expect.stringContaining('outcome=EVENT_DELETED')]);
    });

    // A retryable conflict the production call can meet without a ten-second
    // wait: the event's links change between the finalizer's read and its
    // locks (EVENT_LINK_CHANGED). The helper's lockTimeout seam is not used:
    // no production caller passes it.
    const linkedRead = /FROM episodes e WHERE e\.deleted_at IS NULL AND \(e\.id = \(SELECT w\.used_in_episode_id/;
    function firstLinkedReadOfEachAttempt() {
      const seen = new Set();
      return (rec, sql) => Boolean(rec.txId) && linkedRead.test(sql) && !seen.has(rec.txId) && Boolean(seen.add(rec.txId));
    }
    const linkDraft = async (ev) => mkBrief(show, await mkEpisode(show), ev);

    test('retryable conflicts on attempts 1 and 2, saved on attempt 3: the provider and storage are used once, the rows written once', async () => {
      const { ev } = await primary({ set: await withBase('Retried hall') });
      const sets = await setCount();
      const first = firstLinkedReadOfEachAttempt();
      const g1 = gateOn(first);
      const g2 = gateOn(first);
      const pending = send(generate(ev, { force: true }));
      await g1.reached;
      await linkDraft(ev);
      g1.open();
      await g2.reached;
      await linkDraft(ev);
      g2.open();
      const res = await pending;
      expect(res.status).toBe(200);
      expect(falCalls()).toHaveLength(2);
      expect(puts()).toHaveLength(2);
      expect(await setCount()).toBe(sets + 1);
      expect(await anglesOf(res.body.data.scene_set_id)).toHaveLength(2);
      // Three attempts: two rolled back before any write, the third committed.
      const attempts = [...trace.byTransaction().values()].filter((recs) => recs.some((r) => linkedRead.test(r.sql || '') || r.kind === 'begin'));
      expect(trace.records.filter((r) => r.kind === 'insert' && r.table === 'scene_sets')).toHaveLength(1);
      expect(attempts.filter((recs) => recs.at(-1).kind === 'rollback')).toHaveLength(2);
      expect(pause).not.toHaveBeenCalled(); // a changed link is tried again at once
      // The three draft episodes whose event this is now have it as their Event location.
      const located = await rows("SELECT episode_id FROM scene_set_episodes WHERE scene_set_id = :id AND role = 'event' AND deleted_at IS NULL", { id: res.body.data.scene_set_id });
      expect(located).toHaveLength(3);
    });

    test('a conflict on every attempt: 409 generated_not_saved PLACE_FINALIZE_RETRY_EXHAUSTED, nothing written, the provider called once per image', async () => {
      const { ev } = await primary({ set: await withBase('Exhausted hall') });
      const first = firstLinkedReadOfEachAttempt();
      const gates = [gateOn(first), gateOn(first), gateOn(first)];
      const before = await snapshot();
      const event = await eventRow(ev);
      const pending = send(generate(ev, { force: true }));
      for (const g of gates) {
        await g.reached;
        await linkDraft(ev);
        g.open();
      }
      const res = await pending;
      expect(res.status).toBe(409);
      expect(res.body).toEqual(notSaved('PLACE_FINALIZE_RETRY_EXHAUSTED', EXHAUSTED_MESSAGE));
      expect(falCalls()).toHaveLength(2);
      expect(puts()).toHaveLength(2);
      expect(deletes()).toHaveLength(0);
      expect(await eventRow(ev)).toEqual(event);
      expect(await snapshot()).toEqual(before);
      expect(orphanLines()).toEqual([expect.stringMatching(/outcome=PLACE_FINALIZE_RETRY_EXHAUSTED attempts=3/)]);
      expect(pause).not.toHaveBeenCalled();
    });

    test('a lock conflict inside the save, after the set was inserted: that attempt is rolled back whole, the next writes the same rows once', async () => {
      const { ev } = await primary({ set: await withBase('Conflict hall') });
      const sets = await setCount();
      const realCreate = models.SceneAngle.create.bind(models.SceneAngle);
      const spy = jest.spyOn(models.SceneAngle, 'create').mockImplementationOnce(async (...args) => {
        await realCreate(...args);
        throw Object.assign(new Error('canceling statement due to lock timeout'), { original: { code: '55P03' } });
      });
      const t = tracing();
      const res = await generate(ev, { force: true });
      expect(res.status).toBe(200);
      expect(spy.mock.calls.length).toBe(3); // one in the attempt rolled back, two in the one that committed
      expect(t.records.filter((r) => r.kind === 'insert' && r.table === 'scene_sets')).toHaveLength(2);
      expect(await setCount()).toBe(sets + 1);
      expect(await anglesOf(res.body.data.scene_set_id)).toHaveLength(2);
      // Both attempts wrote the same set id: it was made before the transaction.
      const ids = t.records.filter((r) => r.kind === 'insert' && r.table === 'scene_sets').map((r) => r.ids[0]);
      expect(ids).toEqual([res.body.data.scene_set_id, res.body.data.scene_set_id]);
      expect(falCalls()).toHaveLength(2);
      expect(puts()).toHaveLength(2);
      // One pause, of the generation paths' length, between the two tries.
      expect(pause.mock.calls).toEqual([[DELAY]]);
      expect(DELAY).toBe(250);
    });

    // D2 (Evoni, 2026-11-23): a required write failing for a reason that is
    // no lock conflict and no refusal. The picture is generated and stored;
    // the save is rolled back whole; the answer is the route's 500 "failed"
    // with a code of its own and fixed sentences.
    describe.each([
      ['the second angle insert', () => {
        const realCreate = models.SceneAngle.create.bind(models.SceneAngle);
        jest.spyOn(models.SceneAngle, 'create')
          .mockImplementationOnce((...args) => realCreate(...args))
          .mockImplementationOnce(async () => { throw databaseError(); });
      }],
      ['the event\'s move to the new set', () => {
        const realQuery = sequelize.query.bind(sequelize);
        jest.spyOn(sequelize, 'query').mockImplementation((sql, options) => {
          if (options?.transaction && /^UPDATE world_events SET scene_set_id/.test(String(sql))) return Promise.reject(databaseError());
          return realQuery(sql, options);
        });
      }],
      ['the episode\'s Event location (the sync)', () => {
        const sync = require('../../src/services/eventPlaceSync');
        jest.spyOn(sync, 'syncEpisodeEventLocation').mockImplementationOnce(async () => { throw databaseError(); });
      }],
    ])('the save failing at %s', (_name, breakIt) => {
      test('500 "failed" with GENERATED_SAVE_FAILED, never "scene set created"; everything rolled back; the stored keys and the error\'s class logged; nothing of the error in the answer', async () => {
        const from = await withBase('Broken hall');
        const { ep, ev } = await primary({ set: from });
        await place(ep, from);
        const before = await snapshot();
        const event = await eventRow(ev);
        breakIt();
        const res = await generate(ev, { force: true });

        expect(res.status).toBe(500);
        expect(res.body).toEqual(SAVE_FAILED);
        expect(res.body.outcome).not.toBe('generated');
        expect(res.body.data).toBeUndefined();
        expect(JSON.stringify(res.body)).not.toMatch(LEAK);
        // Rolled back whole: no set, no angle, the event and the episode's rows as they were.
        expect(await eventRow(ev)).toEqual(event);
        expect(await snapshot()).toEqual(before);
        // Paid once, stored, nothing deleted.
        expect(falCalls()).toHaveLength(2);
        expect(puts()).toHaveLength(2);
        expect(deletes()).toHaveLength(0);
        expect(pause).not.toHaveBeenCalled(); // not tried again
      });

      test('the log: one line with the stored keys, the event, SAVE_FAILED, the error\'s class and the cost; no SQL, message, URL or signature in any error line', async () => {
        const { ev } = await primary({ set: await withBase('Logged hall') });
        breakIt();
        const res = await generate(ev, { force: true });
        expect(res.status).toBe(500);
        const lines = orphanLines();
        expect(lines).toHaveLength(1);
        for (const key of puts()) expect(lines[0]).toContain(key);
        expect(lines[0]).toContain(`event=${ev}`);
        expect(lines[0]).toContain('outcome=SAVE_FAILED');
        expect(lines[0]).toContain('error=SequelizeForeignKeyConstraintError/23503');
        expect(lines[0]).toMatch(/cost=\$[0-9.]+ estimate=\$[0-9.]+ usage_log_ids=\d+,\d+/);
        expect(lines[0]).toContain('nothing was deleted from storage');
        const logged = console.error.mock.calls.map((call) => call.map(String).join(' '));
        expect(logged).toContain('[VenueGen] generated, the save failed (SequelizeForeignKeyConstraintError/23503)');
        for (const line of logged) expect(line).not.toMatch(/INSERT|violates|https?:|X-Amz|\?|secret/);
      });
    });

    test('no provider key: 503 as before; the provider failing: 500 "failed" as before', async () => {
      const ev = await mkEvent(show, { loc: location });
      delete process.env.FAL_KEY;
      const noKey = await generate(ev);
      expect(noKey.status).toBe(503);
      expect(noKey.body).toEqual({ success: false, error: 'FAL_KEY not configured. Add it to your .env file.' });
      process.env.FAL_KEY = 'test-fal';
      provider.fail = true;
      const failed = await generate(ev);
      expect(failed.status).toBe(500);
      expect(failed.body).toMatchObject({ success: false, outcome: 'failed' });
      expect(failed.body.code).toBeUndefined();
      expect((await eventRow(ev)).scene_set_id).toBeNull();
      expect(orphanLines()).toEqual([]);
    });
  });

  // ══ The missing-base path ══════════════════════════════════════════════
  describe('the missing base of the set the event has', () => {
    test('saved as before: one provider call, the base on that set, the event still on it; the marker names generation_status alone and the prompt is written with the picture', async () => {
      const set = await noBase('Bare hall');
      const { ev } = await primary({ set });
      const sets = await setCount();
      const t = tracing();
      const res = await generate(ev);
      expect(res.body.error).toBeUndefined();
      expect(res.status).toBe(200);
      const row = await setRow(set);
      expect(res.body).toEqual({
        success: true,
        outcome: 'generated',
        data: { kind: 'base', scene_set_id: set, venue_image_url: row.base_still_url, venue_name: row.name },
        message: `Venue image generated for "${row.name}"`,
      });
      expect(falCalls()).toHaveLength(1);
      expect(puts()).toEqual([expect.stringMatching(new RegExp(`^scene-sets/${set}/stills/`))]);
      expect(row.generation_status).toBe('complete');
      expect(row.base_still_url).toMatch(new RegExp(`scene-sets/${set}/stills/`));
      expect(row.base_runway_prompt).toBeTruthy();
      expect(row.base_generation.brief).toMatchObject({ event_id: ev });
      expect((await eventRow(ev)).scene_set_id).toBe(set);
      expect(await setCount()).toBe(sets);

      const writes = t.records.filter((r) => r.kind === 'write' && r.table === 'scene_sets');
      // The marker: one autocommit statement, generation_status and nothing of the picture.
      expect(writes[0].txId).toBeNull();
      expect(writes[0].sql).toMatch(/^UPDATE "scene_sets" SET "generation_status"=\$1,"updated_at"=\$2 WHERE/);
      expect(writes[0].sql).not.toMatch(/base_runway_prompt/);
      // The final write: in the finalizer's transaction, with the prompt.
      const final = writes.find((r) => /"base_still_url"/.test(r.sql));
      expect(final.txId).toBeTruthy();
      expect(final.sql).toMatch(/"base_runway_prompt"=/);
      expect(writes.filter((r) => /base_runway_prompt/.test(r.sql))).toHaveLength(1);
      // Episodes (share), then the event row, then the set row, never waited for.
      const inTx = t.records.filter((r) => r.txId === final.txId);
      expect(lockTrace.classSequence(inTx)).toEqual(['E:episodes:share', 'W:world_events:update', 'X:scene_sets:update', 'X:scene_sets:write']);
      expect(inTx.find((r) => r.kind === 'lock' && r.table === 'scene_sets').sql).toMatch(/FOR NO KEY UPDATE NOWAIT$/);
    });

    describe.each([['pending'], ['failed']])('the episode accepted during generation, the set %s before', (prior) => {
      test('409 generated_not_saved PLACE_LOCKED: the status put back, no image column written, the reason kept, nothing marked failed, nothing deleted', async () => {
        const set = await noBase('Locked bare hall', { generation_status: prior });
        const { ep, ev } = await primary({ set });
        const start = await setRow(set);
        const hold = holdGeneration();
        const pending = send(generate(ev));
        await hold.reached;
        expect((await setRow(set)).generation_status).toBe('generating'); // the marker, before the paid call
        await accept(ep);
        const before = await snapshot();
        const event = await eventRow(ev);
        const t = tracing();
        hold.release();
        const res = await pending;

        expect(res.status).toBe(409);
        expect(res.body).toEqual(notSaved(PLACE_LOCKED_CODE, PLACE_LOCKED_MESSAGE));
        expect(falCalls()).toHaveLength(1);
        expect(puts()).toHaveLength(1);
        expect(deletes()).toHaveLength(0);
        const row = await setRow(set);
        expect(row.generation_status).toBe(prior);
        expect(imagesOf(row)).toEqual(imagesOf(start));
        expect(row.base_generation.last_error).toBe(`${PLACE_LOCKED_MESSAGE} ${GENERATED_NOT_SAVED_MESSAGE}`);
        expect(Date.parse(row.base_generation.failed_at)).toBeGreaterThan(Date.now() - 60000);
        expect(row.base_generation.generated_at).toBeUndefined();
        expect(await eventRow(ev)).toEqual(event);
        expect(without(await snapshot(), set)).toEqual(without(before, set));
        // One write to the set: the status put back, with the reason. Never
        // 'uncertain', and 'failed' only when that is what it was before.
        const writes = t.records.filter((r) => r.kind === 'write' && r.table === 'scene_sets');
        expect(writes).toHaveLength(1);
        expect(writes[0].sql).toMatch(/^UPDATE scene_sets SET generation_status = :prior, base_generation = COALESCE\(base_generation, '\{\}'::jsonb\) \|\| jsonb_build_object\('last_error', CAST\(:reason AS text\), 'failed_at', NOW\(\)\)/);
        expect(writes[0].txId).toBeNull();
        expect(writes[0].values).toContain(prior);
        expect(writes[0].values).not.toContain('uncertain');
        expect(writesOf(t.records).filter((r) => r.table !== 'scene_sets' && ['scene_angles', 'world_events', 'scene_set_episodes', 'scene_plans', 'scenes'].includes(r.table))).toEqual([]);
        const lines = orphanLines();
        expect(lines).toHaveLength(1);
        expect(lines[0]).toContain(`storage_keys=${puts()[0]}`);
        expect(lines[0]).toMatch(new RegExp(`storage_keys=scene-sets/${set}/stills/`));
        expect(lines[0]).toContain(`event=${ev}`);
        expect(lines[0]).toContain(`set=${set}`);
        expect(lines[0]).toContain('outcome=PLACE_LOCKED');
        for (const call of console.error.mock.calls) expect(call.map(String).join(' ')).not.toMatch(/\?|X-Amz|do-not-log|https?:\/\//);
      });
    });

    test('an event linked by its stamp alone, accepted during generation: the same refusal', async () => {
      const set = await noBase('Stamped bare hall');
      const { ep, ev } = await stampOnly({ set });
      const hold = holdGeneration();
      const pending = send(generate(ev));
      await hold.reached;
      await accept(ep);
      hold.release();
      const res = await pending;
      expect(res.status).toBe(409);
      expect(res.body).toEqual(notSaved(PLACE_LOCKED_CODE, PLACE_LOCKED_MESSAGE));
      expect(await setRow(set)).toMatchObject({ generation_status: 'pending', base_still_url: null });
    });

    describe.each([
      ['its primary event (stamp and Brief)', primary],
      ['an event linked by its stamp alone (non-primary)', stampOnly],
    ])('raced with a real acceptance, for %s', (_name, make) => {
      test('the save first: the base is saved; the acceptance waits for it and then succeeds', async () => {
        const set = await noBase('Base first');
        const { ep, ev } = await make({ set });
        const g = gateOn((rec) => Boolean(rec.txId) && rec.kind === 'lock' && rec.table === 'scene_sets');
        const pending = send(generate(ev));
        await g.reached; // the finalizer holds the episode, the event row and the set row
        const acceptance = settle(completeEpisode(ep, show, sequelize));
        await waitForLockWait(sequelize, `%episodes%${ep}%`);
        expect(await evaluationOf(ep)).not.toBe('accepted');
        g.open();
        const [res, a] = await Promise.all([pending, acceptance]);
        expect(a.lock).toBeFalsy();
        if (!a.ok) throw a.error;
        expect(res.status).toBe(200);
        expect((await setRow(set)).base_still_url).toBe(res.body.data.venue_image_url);
        expect(await evaluationOf(ep)).toBe('accepted');
        expect(lockErrors(trace.records)).toEqual([]);
      });

      test('the acceptance first: the save waits for it, then is refused; the set is as it was', async () => {
        const set = await noBase('Base second');
        const { ep, ev } = await make({ set });
        const hold = holdGeneration();
        const pending = send(generate(ev));
        await hold.reached;
        const g = gateOn((rec) => Boolean(rec.txId) && rec.kind === 'lock' && rec.table === 'episodes' && rec.mode === 'update');
        const acceptance = settle(completeEpisode(ep, show, sequelize));
        await Promise.race([g.reached, acceptance]);
        hold.release();
        await waitForLockWait(sequelize, `%FROM episodes WHERE id IN%${ep}%FOR SHARE%`);
        g.open();
        const [res, a] = await Promise.all([pending, acceptance]);
        if (!a.ok) throw a.error;
        expect(res.status).toBe(409);
        expect(res.body).toEqual(notSaved(PLACE_LOCKED_CODE, PLACE_LOCKED_MESSAGE));
        expect(await setRow(set)).toMatchObject({ generation_status: 'pending', base_still_url: null });
        expect(falCalls()).toHaveLength(1);
      });
    });

    test('the event moved to another set during generation: STALE_SOURCE_SET; both sets without a new picture', async () => {
      const set = await noBase('Stale bare hall');
      const other = await withBase('Other hall');
      const { ev } = await primary({ set });
      const hold = holdGeneration();
      const pending = send(generate(ev));
      await hold.reached;
      await run('UPDATE world_events SET scene_set_id = :other WHERE id = :ev', { other, ev });
      const otherBefore = await setRow(other);
      hold.release();
      const res = await pending;
      expect(res.status).toBe(409);
      expect(res.body).toEqual(notSaved('STALE_SOURCE_SET', STALE_MESSAGE));
      expect(await setRow(set)).toMatchObject({ generation_status: 'pending', base_still_url: null, base_runway_prompt: null });
      expect((await setRow(set)).base_generation.last_error).toBe(`${STALE_MESSAGE} ${GENERATED_NOT_SAVED_MESSAGE}`);
      expect(await setRow(other)).toEqual(otherBefore);
      expect((await eventRow(ev)).scene_set_id).toBe(other);
      expect(falCalls()).toHaveLength(1);
    });

    test('the set row held by another transaction on every attempt (a real 55P03, never waited for): PLACE_FINALIZE_RETRY_EXHAUSTED, nothing written, the provider called once', async () => {
      const set = await noBase('Held bare hall');
      const { ev } = await primary({ set });
      const hold = holdGeneration();
      const pending = send(generate(ev));
      await hold.reached; // the marker is committed; now the set row is held
      const holder = await holdTransaction();
      await sequelize.query('SELECT id FROM scene_sets WHERE id = :set FOR UPDATE', { replacements: { set }, transaction: holder });
      let rolledBack = 0;
      const g = gateOn((rec) => Boolean(rec.txId) && rec.txId !== holder.id && rec.kind === 'rollback' && (rolledBack += 1) === 3);
      const t = trace;
      pause.mockImplementation(async () => {}); // counted, not waited for
      const started = Date.now();
      hold.release();
      await g.reached; // the third and last attempt is rolled back
      expect(Date.now() - started).toBeLessThan(8000); // three tries, none of them a lock wait
      expect(t.records.filter((r) => r.error === '55P03')).toHaveLength(3);
      expect((await setRow(set)).generation_status).toBe('generating'); // not yet put back
      // The status is put back in its own statement after the save, which
      // waits for the set row like any other write: the holder lets go.
      await holder.rollback();
      g.open();
      const res = await pending;
      expect(res.status).toBe(409);
      expect(res.body).toEqual(notSaved('PLACE_FINALIZE_RETRY_EXHAUSTED', EXHAUSTED_MESSAGE));
      expect(falCalls()).toHaveLength(1);
      expect(puts()).toHaveLength(1);
      expect(await setRow(set)).toMatchObject({ generation_status: 'pending', base_still_url: null });
      expect(orphanLines()).toEqual([expect.stringMatching(/outcome=PLACE_FINALIZE_RETRY_EXHAUSTED attempts=3/)]);
      expect(pause.mock.calls).toEqual([[DELAY], [DELAY]]); // two pauses between three tries, none after the last
    });

    test('the set row held when the save begins and let go during the pause (a transient lock): saved on the second try, after one pause with no transaction open; the provider and storage used once', async () => {
      const set = await noBase('Transient bare hall');
      const { ev } = await primary({ set });
      const hold = holdGeneration();
      const pending = send(generate(ev));
      await hold.reached;
      const holder = await holdTransaction();
      const [[me]] = await sequelize.query('SELECT pg_backend_pid() AS pid', { transaction: holder });
      await sequelize.query('SELECT id FROM scene_sets WHERE id = :set FOR UPDATE', { replacements: { set }, transaction: holder });
      const t = tracing();
      const seen = [];
      pause.mockImplementation(async (ms) => {
        const open = await rows(
          `SELECT pid FROM pg_stat_activity
            WHERE datname = current_database() AND pid NOT IN (pg_backend_pid(), :holder) AND state LIKE 'idle in transaction%'`, { holder: me.pid });
        const ends = [...t.byTransaction().entries()].filter(([id]) => id !== holder.id).map(([, recs]) => recs.at(-1).kind);
        seen.push({ ms, open, ends });
        await holder.rollback();
      });
      hold.release();
      const res = await pending;
      expect(res.status).toBe(200);
      expect(seen).toEqual([{ ms: DELAY, open: [], ends: ['rollback'] }]);
      expect(t.records.filter((r) => r.error === '55P03')).toHaveLength(1);
      expect(falCalls()).toHaveLength(1);
      expect(puts()).toHaveLength(1);
      expect(await setRow(set)).toMatchObject({ generation_status: 'complete', base_still_url: res.body.data.venue_image_url });
    });

    test('the final write failing for another reason: 500 "failed" with GENERATED_SAVE_FAILED; the set marked failed as a failed final write always was, with a fixed reason; no image column written; nothing of the error in the answer or the log', async () => {
      const set = await noBase('Save failed bare hall');
      const { ep, ev } = await primary({ set });
      await place(ep, set);
      const start = await setRow(set);
      const before = without(await snapshot(), set);
      const event = await eventRow(ev);
      const realUpdate = models.SceneSet.update.bind(models.SceneSet);
      jest.spyOn(models.SceneSet, 'update').mockImplementation((values, options) => {
        if (values && 'base_still_url' in values) return Promise.reject(databaseError());
        return realUpdate(values, options);
      });
      const res = await generate(ev);
      expect(res.status).toBe(500);
      expect(res.body).toEqual(SAVE_FAILED);
      expect(JSON.stringify(res.body)).not.toMatch(LEAK);
      const row = await setRow(set);
      expect(row.generation_status).toBe('failed');
      expect(imagesOf(row)).toEqual(imagesOf(start));
      expect(row.base_generation.last_error).toBe(SAVE_FAILED.message);
      expect(Date.parse(row.base_generation.failed_at)).toBeGreaterThan(Date.now() - 60000);
      expect(await eventRow(ev)).toEqual(event);
      expect(without(await snapshot(), set)).toEqual(before);
      expect(falCalls()).toHaveLength(1);
      expect(puts()).toHaveLength(1);
      expect(deletes()).toHaveLength(0);
      expect(pause).not.toHaveBeenCalled();
      const lines = orphanLines();
      expect(lines).toHaveLength(1);
      expect(lines[0]).toContain(`storage_keys=${puts()[0]}`);
      expect(lines[0]).toContain(`event=${ev} set=${set} outcome=SAVE_FAILED`);
      expect(lines[0]).toContain('error=SequelizeForeignKeyConstraintError/23503');
      const logged = console.error.mock.calls.map((call) => call.map(String).join(' '));
      expect(logged).toContain('[VenueGen] generated, the save failed (SequelizeForeignKeyConstraintError/23503)');
      for (const line of logged) expect(line).not.toMatch(/INSERT|violates|https?:|X-Amz|\?|secret/);
    });

    test('the set row held on attempts 1 and 2 and free for attempt 3: saved; the provider and storage used once', async () => {
      const set = await noBase('Freed bare hall');
      const { ev } = await primary({ set });
      const hold = holdGeneration();
      const pending = send(generate(ev));
      await hold.reached;
      const holder = await holdTransaction();
      await sequelize.query('SELECT id FROM scene_sets WHERE id = :set FOR UPDATE', { replacements: { set }, transaction: holder });
      let rolledBack = 0;
      const g = gateOn((rec) => Boolean(rec.txId) && rec.txId !== holder.id && rec.kind === 'rollback' && (rolledBack += 1) === 2);
      pause.mockImplementation(async () => {});
      hold.release();
      await g.reached; // attempt 2 is rolled back
      await holder.rollback();
      g.open();
      const res = await pending;
      expect(res.status).toBe(200);
      expect(trace.records.filter((r) => r.error === '55P03')).toHaveLength(2);
      expect(falCalls()).toHaveLength(1);
      expect(puts()).toHaveLength(1);
      expect(trace.records.filter((r) => r.kind === 'write' && r.table === 'scene_sets' && /"base_still_url"/.test(r.sql))).toHaveLength(1);
      expect(await setRow(set)).toMatchObject({ generation_status: 'complete', base_still_url: res.body.data.venue_image_url });
    });

    test('a generation attempt in flight on the set: the marker is refused by the database guard as before, and nothing is generated', async () => {
      const set = await noBase('In flight hall');
      const { ev } = await primary({ set });
      const attempt = fx.uuid();
      await run(`INSERT INTO scene_generation_attempts (id, target_kind, target_id, scene_set_id, provider, model, route, created_by)
                 VALUES (:attempt, 'set', :set, :set, 'fal', 'fal-ai/flux/dev', 'planned', 'u1')`, { attempt, set });
      await run("UPDATE scene_sets SET generation_status = 'generating', current_attempt_id = :attempt, updated_at = NOW() WHERE id = :set", { attempt, set });
      const res = await generate(ev);
      expect(res.status).toBe(500);
      expect(res.body).toMatchObject({ success: false, outcome: 'failed', error: expect.stringMatching(/scene generation guard: set .* has an attempt in flight/) });
      expect(falCalls()).toHaveLength(0);
      expect(puts()).toHaveLength(0);
      expect(await setRow(set)).toMatchObject({ generation_status: 'generating', current_attempt_id: attempt, base_still_url: null });
      // Out of flight again, so the fixture's cleanup is not refused by the guard.
      await run("UPDATE scene_generation_attempts SET state = 'not_sent', finished_at = NOW() WHERE id = :attempt", { attempt });
    });

    test('the provider failing: 500 "failed" and the set marked failed, as before', async () => {
      const set = await noBase('Failing bare hall');
      const { ev } = await primary({ set });
      provider.fail = true;
      const res = await generate(ev);
      expect(res.status).toBe(500);
      expect(res.body).toMatchObject({ success: false, outcome: 'failed' });
      expect(res.body.code).toBeUndefined();
      expect((await setRow(set)).generation_status).toBe('failed');
      expect(orphanLines()).toEqual([]);
    });
  });

  // ══ The two-part special ═══════════════════════════════════════════════
  describe.each([
    ['a new venue', { force: true }, 2],
    ['the missing base', {}, 1],
  ])('a real two-part special, generating %s', (_name, body, images) => {
    test('Part 1 accepted and Part 2 not yet (the strict rule): 409 generated_not_saved PLACE_LOCKED, nothing written', async () => {
      const w = await twoParter();
      const sets = await setCount(w.show);
      const hold = holdGeneration();
      const pending = send(generate(w.ev, body, w.show));
      await hold.reached;
      // The real window: Part 2's bare UPDATE waits on a share lock on Part 2
      // while Part 1's completion is committed.
      const holder = await holdTransaction();
      await sequelize.query('SELECT id FROM episodes WHERE id = :id FOR SHARE', { replacements: { id: w.partTwo }, transaction: holder });
      const acceptance = settle(completeEpisode(w.partTwo, w.show, sequelize));
      await waitForLockWait(sequelize, `%UPDATE episodes SET evaluation_status = %accepted%${w.partTwo}%`);
      expect(await evaluationOf(w.partOne)).toBe('accepted');
      expect(await evaluationOf(w.partTwo)).not.toBe('accepted');
      const event = await eventRow(w.ev);
      const before = without(await snapshot(w.show), w.set);
      hold.release();
      const res = await pending;
      expect(res.status).toBe(409);
      expect(res.body).toEqual(notSaved(PLACE_LOCKED_CODE, PLACE_LOCKED_MESSAGE));
      expect(falCalls()).toHaveLength(images);
      expect(await eventRow(w.ev)).toEqual(event);
      expect(without(await snapshot(w.show), w.set)).toEqual(before);
      expect(await setCount(w.show)).toBe(sets);
      expect(await setRow(w.set)).toMatchObject({ generation_status: 'pending', base_still_url: null });
      await holder.rollback();
      const a = await acceptance;
      if (!a.ok) throw a.error;
      expect(await evaluationOf(w.partTwo)).toBe('accepted');
    });

    test('both parts accepted during generation (the full two-part completion): the same refusal', async () => {
      const w = await twoParter();
      const sets = await setCount(w.show);
      const hold = holdGeneration();
      const pending = send(generate(w.ev, body, w.show));
      await hold.reached;
      await accept(w.partTwo, w.show);
      expect([await evaluationOf(w.partOne), await evaluationOf(w.partTwo)]).toEqual(['accepted', 'accepted']);
      const event = await eventRow(w.ev);
      hold.release();
      const res = await pending;
      expect(res.status).toBe(409);
      expect(res.body).toEqual(notSaved(PLACE_LOCKED_CODE, PLACE_LOCKED_MESSAGE));
      expect(falCalls()).toHaveLength(images);
      expect(deletes()).toHaveLength(0);
      expect(await eventRow(w.ev)).toEqual(event);
      expect(await setCount(w.show)).toBe(sets);
      expect(await setRow(w.set)).toMatchObject({ generation_status: 'pending', base_still_url: null });
    });
  });

  // ══ The early refusal is unchanged ═════════════════════════════════════
  describe.each([
    ['a new venue', { force: true }],
    ['the missing base', {}],
  ])('an episode already accepted, asked for %s', (_name, body) => {
    test('the early 409 PLACE_LOCKED, with no outcome: no provider call, nothing stored, no statement that writes', async () => {
      const set = await noBase('Early locked hall');
      const { ev } = await primary({ evaluation: 'accepted', set });
      const before = await snapshot();
      const event = await eventRow(ev);
      const t = tracing();
      const res = await generate(ev, body);
      expect(res.status).toBe(409);
      expect(res.body).toEqual(EARLY_LOCKED);
      expect(res.body.outcome).toBeUndefined();
      expect(falCalls()).toHaveLength(0);
      expect(mockS3Send).not.toHaveBeenCalled();
      expect(writesOf(t.records)).toEqual([]);
      expect(await eventRow(ev)).toEqual(event);
      expect(await snapshot()).toEqual(before);
      expect(orphanLines()).toEqual([]);
    });
  });

  // ══ The set row and makeEventVersion ═══════════════════════════════════
  describe('the base save against the real makeEventVersion (a set row, then the event row)', () => {
    async function versionFixture() {
      const set = await noBase('Version hall');
      const everyday = await withBase('Everyday hall');
      const { ev } = await primary({ set });
      return { set, everyday, ev };
    }

    // C1 PR 2 (Evoni, 2026-11-24;
    // docs/audit/F-AUTH-1_EventWritersEpisodeFirst_Amendment_2026-11-24.md).
    // makeEventVersion takes the event's linked episodes and the event row
    // before its set rows, and takes the set rows without waiting. The two
    // cases below pinned the old order: the version holding the set row and
    // waiting for the event (so the save stepped back from the set row with
    // one 55P03), and the version waiting for the set row. They hold the
    // same two real writers and assert the new order exactly.
    //
    // The version is also held, by a second gate, just after it gets the
    // event row and until generate-venue has answered: generate-venue goes
    // on writing its set's row after its save (the description review), and
    // the version's NOWAIT lock on that row is only decided once those
    // writes are over. So the number of lock conflicts is exact: none.
    async function saveThenVersion(saveHolds) {
      const { set, everyday, ev } = await versionFixture();
      let saveTx = null;
      const g = gateOn((rec) => {
        const hit = Boolean(rec.txId) && rec.kind === 'lock' && rec.table === saveHolds;
        if (hit && !saveTx) saveTx = rec.txId;
        return hit;
      });
      // The version, just after it has locked the event row (a transaction that is not the save's).
      const versionHasEvent = gateOn((rec) => Boolean(rec.txId) && Boolean(saveTx) && rec.txId !== saveTx && rec.kind === 'lock' && rec.table === 'world_events');
      const pending = send(generate(ev));
      await g.reached; // the finalizer holds the episode and the event row (and, in the second case, its set row)
      const version = settle(makeEventVersion(sequelize, { setId: set, everydaySetId: everyday, eventId: ev }));
      await waitForLockWait(sequelize, `%FROM world_events WHERE id = %${ev}%FOR UPDATE%`); // it waits for the EVENT row
      // Nothing waits for a set row, and the version holds neither of its set rows.
      expect(await rows(
        "SELECT pid FROM pg_stat_activity WHERE datname = current_database() AND wait_event_type = 'Lock' AND query ILIKE '%FROM scene_sets%'")).toEqual([]);
      const heldSets = await holdTransaction();
      await sequelize.query('SELECT id FROM scene_sets WHERE id = :id FOR KEY SHARE NOWAIT', { replacements: { id: everyday }, transaction: heldSets });
      await heldSets.rollback();
      const before = await setRow(set);
      expect(before.base_still_url).toBeNull(); // nothing is saved yet
      g.open();
      const res = await pending; // generate-venue has saved, answered, and finished its writes to the set
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ success: true, outcome: 'generated', data: { kind: 'base', scene_set_id: set } });
      // The save committed whole before the version wrote anything: a base, and not yet a version.
      expect(await setRow(set)).toMatchObject({ version_of_set_id: null, generation_status: 'complete', base_still_url: res.body.data.venue_image_url });
      await versionHasEvent.reached;
      versionHasEvent.open();
      const v = await version;
      expect(v.lock).toBeFalsy();
      if (!v.ok) throw v.error;
      expect(v.value).toMatchObject({ scene_set_id: set, version_of: { id: everyday }, event: { id: ev } });
      // Exactly: no deadlock, no lock conflict, no pause.
      expect(lockErrors(trace.records)).toEqual([]);
      expect(pause).not.toHaveBeenCalled();
      expect(JSON.stringify(res.body)).not.toMatch(/deadlock|violates|constraint|could not obtain lock|Sequelize/i);
      // One serial order: the base saved, then the set made that event's version; the event is held there.
      expect(await setRow(set)).toMatchObject({ version_of_set_id: everyday, generation_status: 'complete', base_still_url: res.body.data.venue_image_url });
      expect((await eventRow(ev)).scene_set_id).toBe(set);
      expect(falCalls()).toHaveLength(1);
    }

    test('the save holding the event row, then makeEventVersion: it waits for the event row holding no set row; no deadlock and no lock conflict; the save commits, then the version', async () => {
      await saveThenVersion('world_events');
    });

    test('the save holding the event row and the set row first: makeEventVersion waits for the event row (not for the set row), then commits; no lock conflict', async () => {
      await saveThenVersion('scene_sets');
    });
  });

  // ══ generateBaseScene and the three callers that mark a base failed ════
  describe('generateBaseScene with a finalize that refuses, and the three callers that mark a base failed', () => {
    const REFUSAL = { outcome: O.PLACE_LOCKED, code: PLACE_LOCKED_CODE, message: PLACE_LOCKED_MESSAGE, attempts: 1 };
    const refusing = jest.fn(async () => REFUSAL);
    /** generateBaseScene as its callers call it, with a finalize that refuses. */
    function injectRefusal() {
      const real = sceneGen.generateBaseScene;
      refusing.mockClear();
      return jest.spyOn(sceneGen, 'generateBaseScene').mockImplementation((set, m, options = {}) => real(set, m, { ...options, finalize: refusing }));
    }
    async function settled(setId) {
      const end = Date.now() + 10000;
      for (;;) {
        const row = await setRow(setId);
        if (row.generation_status !== 'generating') return row;
        if (Date.now() > end) throw new Error('the base run did not end');
        await new Promise((resolve) => setTimeout(resolve, 25));
      }
    }

    test('(1) generateBaseScene itself: the typed refusal, the status put back (complete with its old base, which is neither replaced nor deleted)', async () => {
      const set = await withBase('Own catch complete');
      const start = await setRow(set);
      const instance = await models.SceneSet.findByPk(set);
      const err = await sceneGen.generateBaseScene(instance, models, { skipAnalysis: true, eventId: null, finalize: refusing }).catch((e) => e);
      expect(err).toBeInstanceOf(PlaceFinalizeRefusal);
      expect(err).toMatchObject({ name: 'PlaceFinalizeRefusal', code: PLACE_LOCKED_CODE, status: 409, outcome: 'generated_not_saved', message: PLACE_LOCKED_MESSAGE, detail: GENERATED_NOT_SAVED_MESSAGE, attempts: 1 });
      const row = await setRow(set);
      expect(row.generation_status).toBe('complete');
      expect(imagesOf(row)).toEqual(imagesOf(start));
      expect(row.base_generation).toMatchObject({ last_error: `${PLACE_LOCKED_MESSAGE} ${GENERATED_NOT_SAVED_MESSAGE}` });
      expect(falCalls()).toHaveLength(1);
      expect(deletes()).toHaveLength(0);
      expect(orphanLines()).toEqual([expect.stringMatching(new RegExp(`storage_keys=scene-sets/${set}/stills/.* event=none set=${set} outcome=PLACE_LOCKED attempts=1`))]);
    });

    test('(1) a set its caller already marked generating goes back to pending without a base, or to options.priorStatus when given', async () => {
      const claimed = await noBase('Own catch claimed', { generation_status: 'generating' });
      await expect(sceneGen.generateBaseScene(await models.SceneSet.findByPk(claimed), models, { skipAnalysis: true, finalize: refusing })).rejects.toBeInstanceOf(PlaceFinalizeRefusal);
      expect((await setRow(claimed)).generation_status).toBe('pending');
      const given = await noBase('Own catch given', { generation_status: 'generating' });
      await expect(sceneGen.generateBaseScene(await models.SceneSet.findByPk(given), models, { skipAnalysis: true, finalize: refusing, priorStatus: 'failed' })).rejects.toBeInstanceOf(PlaceFinalizeRefusal);
      expect((await setRow(given)).generation_status).toBe('failed');
      // Never uncertain, whatever is asked.
      expect(sceneGen.priorBaseStatus({ generation_status: 'uncertain', base_still_url: null }, 'uncertain')).toBe('pending');
      expect(sceneGen.priorBaseStatus({ generation_status: 'generating', base_still_url: 'x' })).toBe('complete');
      expect(sceneGen.priorBaseStatus({ generation_status: 'failed' })).toBe('failed');
    });

    test('(1) the status is put back only while the set is still generating: a set another writer moved on is left as it is, with the reason kept', async () => {
      const set = await noBase('Own catch moved on');
      const movedOn = async () => {
        await run("UPDATE scene_sets SET generation_status = 'complete' WHERE id = :set", { set });
        return REFUSAL;
      };
      await expect(sceneGen.generateBaseScene(await models.SceneSet.findByPk(set), models, { skipAnalysis: true, finalize: movedOn })).rejects.toBeInstanceOf(PlaceFinalizeRefusal);
      const row = await setRow(set);
      expect(row.generation_status).toBe('complete'); // not pending: the restore matched nothing
      expect(row.base_generation.last_error).toBe(`${PLACE_LOCKED_MESSAGE} ${GENERATED_NOT_SAVED_MESSAGE}`);
      expect(row.base_still_url).toBeNull();
    });

    test('(1) a finalize that runs the work twice (a try rolled back, then one committed): the picture is saved once and the provider called once', async () => {
      const set = await noBase('Own catch twice');
      const twice = async (work) => {
        const first = await sequelize.transaction();
        await work({ transaction: first });
        await first.rollback();
        expect((await setRow(set)).base_still_url).toBeNull();
        await sequelize.transaction((transaction) => work({ transaction }));
        return { outcome: 'OK', code: 'OK' };
      };
      const out = await sceneGen.generateBaseScene(await models.SceneSet.findByPk(set), models, { skipAnalysis: true, finalize: twice });
      expect(out.success).toBe(true);
      expect(falCalls()).toHaveLength(1);
      expect(puts()).toHaveLength(1);
      expect(await setRow(set)).toMatchObject({ generation_status: 'complete', base_still_url: out.stillUrl });
    });

    test('(1) no finalize given: one plain transaction, the set row locked and waited for; a provider failure still marks the set failed', async () => {
      const set = await noBase('Own default');
      const t = tracing();
      const out = await sceneGen.generateBaseScene(await models.SceneSet.findByPk(set), models, { skipAnalysis: true, eventId: null });
      expect(out).toMatchObject({ success: true });
      const final = t.records.find((r) => r.kind === 'write' && r.table === 'scene_sets' && /"base_still_url"/.test(r.sql));
      expect(final.txId).toBeTruthy();
      const inTx = t.records.filter((r) => r.txId === final.txId);
      expect(lockTrace.classSequence(inTx)).toEqual(['X:scene_sets:update', 'X:scene_sets:write']);
      expect(inTx.find((r) => r.kind === 'lock').sql).toMatch(/FOR NO KEY UPDATE$/);
      expect(await setRow(set)).toMatchObject({ generation_status: 'complete' });

      const failing = await noBase('Own default failing');
      provider.fail = true;
      await expect(sceneGen.generateBaseScene(await models.SceneSet.findByPk(failing), models, { skipAnalysis: true })).rejects.toThrow();
      expect((await setRow(failing)).generation_status).toBe('failed');
    });

    test('(1) the base approved while the picture was being made (no finalize given): refused as before; the status it had is put back and the reason kept', async () => {
      const loc = await mkLocation('Approved late');
      const set = await withBase('Approved late hall', { world_location_id: loc });
      const start = await setRow(set);
      provider.during = () => run('UPDATE world_locations SET approved_base_scene_set_id = :set, approved_base_image_url = :url, approved_base_at = NOW() WHERE id = :loc',
        { set, url: start.base_still_url, loc });
      await expect(sceneGen.generateBaseScene(await models.SceneSet.findByPk(set), models, { skipAnalysis: true }))
        .rejects.toThrow(/approved while the new picture was being made/);
      const row = await setRow(set);
      expect(row.generation_status).toBe('complete');
      expect(imagesOf(row)).toEqual(imagesOf(start));
      expect(row.base_generation.last_error).toMatch(/approved while the new picture was being made/);
      expect(deletes()).toHaveLength(0);
      await run('UPDATE world_locations SET approved_base_scene_set_id = NULL, approved_base_image_url = NULL, approved_base_at = NULL WHERE id = :loc', { loc });
    });

    test('(2) the generate-base route: the refusal is not marked failed; a provider failure still is', async () => {
      const base = (id) => asAdmin(request(app).post(`/api/v1/scene-sets/${id}/generate-base`)).send({});
      const set = await noBase('Route refused');
      const spy = injectRefusal();
      expect((await base(set)).status).toBe(202);
      const row = await settled(set);
      await new Promise((resolve) => setTimeout(resolve, 100)); // the route's catch has run
      expect(refusing).toHaveBeenCalledTimes(1);
      expect((await setRow(set)).generation_status).toBe('pending');
      expect(row.base_still_url).toBeNull();
      expect(row.base_generation.last_error).toBe(`${PLACE_LOCKED_MESSAGE} ${GENERATED_NOT_SAVED_MESSAGE}`);
      spy.mockRestore();

      const failing = await noBase('Route failing');
      provider.fail = true;
      expect((await base(failing)).status).toBe(202);
      expect((await settled(failing)).generation_status).toBe('failed');
    });

    test('(3) the look\'s base step: the refusal is not marked failed; a provider failure still is, with its reason', async () => {
      const loc = await mkLocation('Look base');
      const set = await mkSet(show, `Look refused ${fx.uuid().slice(0, 6)}`, { generation_status: 'pending', base_model: 'flux-dev', world_location_id: loc });
      const spy = injectRefusal();
      const ev = await mkEvent(show, { set, loc });
      const started = await lookService.startLook(models, { showId: show, eventId: ev, overrides: {} });
      expect(started.result).toEqual({ step: lookService.STEPS.BASE, scene_set_id: set });
      await started.run();
      expect(refusing).toHaveBeenCalledTimes(1);
      const row = await setRow(set);
      expect(row.generation_status).toBe('pending');
      expect(row.base_still_url).toBeNull();
      expect(row.base_generation.last_error).toBe(`${PLACE_LOCKED_MESSAGE} ${GENERATED_NOT_SAVED_MESSAGE}`);
      spy.mockRestore();

      const loc2 = await mkLocation('Look base failing');
      const failing = await mkSet(show, `Look failing ${fx.uuid().slice(0, 6)}`, { generation_status: 'pending', base_model: 'flux-dev', world_location_id: loc2 });
      provider.fail = true;
      const ev2 = await mkEvent(show, { set: failing, loc: loc2 });
      const second = await lookService.startLook(models, { showId: show, eventId: ev2, overrides: {} });
      await second.run();
      const failed = await setRow(failing);
      expect(failed.generation_status).toBe('failed');
      expect(failed.base_generation.last_error).toBeTruthy();
    });

    test('the log line: keys or "nothing was stored", the cost that is known, never a URL', () => {
      expect(sceneGen.storageKeyOf('https://b.s3.us-east-1.amazonaws.com/scene-sets/abc/stills/1-base.jpg?X-Amz-Signature=zzz')).toBe('scene-sets/abc/stills/1-base.jpg');
      expect(sceneGen.storageKeyOf('https://fal.media/x.jpg?sig=1')).toBeNull();
      expect(sceneGen.generatedNotSavedLine({ keys: [], eventId: 'e1', code: 'PLACE_LOCKED', attempts: 1, estimateUsd: 0.08 }))
        .toBe('[GeneratedNotSaved] an image was generated and not saved: storage_keys=none (no bucket is configured: nothing was stored) event=e1 set=none outcome=PLACE_LOCKED attempts=1 cost=unknown estimate=$0.08 usage_log_ids=none; nothing was deleted from storage');
      expect(sceneGen.generatedNotSavedLine({ keys: ['venues/e1/a-venue.png', 'venues/e1/b-exterior.png'], eventId: 'e1', setId: 's1', code: 'STALE_SOURCE_SET', attempts: 1, costUsd: 0.08, estimateUsd: 0.08, usageLogIds: [4, 5] }))
        .toBe('[GeneratedNotSaved] an image was generated and not saved: storage_keys=venues/e1/a-venue.png,venues/e1/b-exterior.png event=e1 set=s1 outcome=STALE_SOURCE_SET attempts=1 cost=$0.08 estimate=$0.08 usage_log_ids=4,5; nothing was deleted from storage');
    });
  });

  // ══ Last: nothing left the process ═════════════════════════════════════
  describe('what the source still says', () => {
    const src = (file) => fs.readFileSync(path.join(__dirname, '..', '..', 'src', file), 'utf8');
    test('generate-venue: requireAuth, then authorize([\'ADMIN\']), then the rate limiter; the early Place check before the key, the marker and anything paid', () => {
      const route = src('routes/worldEvents/venue.js');
      expect(route).toContain("router.post('/world/:showId/events/:eventId/generate-venue', requireAuth, authorize(['ADMIN']), aiRateLimiter, async (req, res) => {");
      const handler = route.slice(route.indexOf("events/:eventId/generate-venue', requireAuth"));
      const early = handler.indexOf('if (await isPlaceLocked(models.sequelize, event.id))');
      expect(early).toBeGreaterThan(0);
      for (const later of ['generateBaseScene(', 'process.env.FAL_KEY', 'generateVenueImages(event']) expect(handler.indexOf(later)).toBeGreaterThan(early);
    });
    test('the two generation paths delete nothing from storage on a refusal or a failed save, and both ask the finalizer for the same pause', () => {
      const venue = src('services/venueGenerationService.js');
      expect(venue).not.toMatch(/DeleteObjectCommand|deleteOld/);
      expect(venue).toContain('retryDelayMs: PLACE_FINALIZE_RETRY_DELAY_MS');
      expect(src('routes/worldEvents/venue.js')).toContain('retryDelayMs: sceneGenService.PLACE_FINALIZE_RETRY_DELAY_MS');
    });
  });

  describe('the network guard', () => {
    test('no external network attempt in this file', () => {
      const mine = networkGuard.getState().events.slice(guardEventsAtStart);
      expect(mine.filter((e) => e.type === 'attempt')).toEqual([]);
    });
  });
});
