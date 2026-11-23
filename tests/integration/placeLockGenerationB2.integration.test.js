/**
 * Generation B2 (Evoni, 2026-11-23;
 * docs/audit/F-AUTH-1_PlaceLockGenerationB2_Amendment_2026-11-23.md): the
 * event look, its upload, the dressed angles and the venue-look draft save
 * through the Place finalizer (utils/placeLock finalizePlaceWrite).
 *
 *   - "Generate this look": before the answer, the set (made if needed), the
 *     claim and the event's move are one finalization; after the paid
 *     generation, the look's row and its dressed angles are another. The
 *     base step gives generateBaseScene the finalizer;
 *   - an uploaded look: the file stored first, then one finalization;
 *   - dressed angles: the Place lock asked before the claim, the provider
 *     and the storage write; the row saved in one finalization;
 *   - the venue-look draft: the model first, then one finalization;
 *   - the event look read says when a base was generated and not saved.
 *
 * On the migrated test database, through the real app, against the real
 * acceptance (completeEpisode, a real two-part completion) and the real
 * event PUT. The image provider (axios), object storage (S3Client) and the
 * model (Anthropic) are doubles. Interleavings are held with a latch in a
 * double, tests/helpers/lockTrace's gate or a second transaction; a wait is
 * seen in pg_stat_activity, never slept for.
 *
 * This file sends no DDL.
 */
jest.unmock('uuid');

process.env.S3_PRIMARY_BUCKET = 'genb2-test-bucket';

// The model double: completion's after-commit story call is refused (it
// logs and survives); the venue-look draft cases answer for it themselves.
const mockAnthropic = jest.fn();
jest.mock('@anthropic-ai/sdk', () => jest.fn(() => ({ messages: { create: mockAnthropic } })));
jest.mock('axios', () => {
  const actual = jest.requireActual('axios');
  return { ...actual, post: jest.fn(), get: jest.fn(), put: jest.fn(), delete: jest.fn(), request: jest.fn(), create: actual.create };
});
const mockS3Send = jest.fn();
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
const sceneGen = require('../../src/services/sceneGenerationService');
const eventPlaceSync = require('../../src/services/eventPlaceSync');
const lockTrace = require('../helpers/lockTrace');
const networkGuard = require('../networkGuard/core');
const { placeLockFixtures, waitForLockWait } = require('../helpers/placeLockFixtures');

const { sequelize } = models;
const { PLACE_LOCKED_CODE, PLACE_LOCKED_MESSAGE } = placeLock;
const { GENERATED_NOT_SAVED_MESSAGE, GENERATED_SAVE_FAILED_MESSAGE } = sceneGen;
const DELAY = sceneGen.PLACE_FINALIZE_RETRY_DELAY_MS;

const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const STALE_MESSAGE = "This event's scene set changed while this was being made. Nothing was saved over the newer choice.";
const EXHAUSTED_MESSAGE = 'This could not be saved: the event or its episode was busy on every try. Nothing was saved.';
const UPLOAD_NOT_ATTACHED = 'The file was stored, but it was not attached. Nothing was changed.';
const UPLOAD_SAVE_FAILED = 'The file was stored, but attaching it failed. Nothing was changed.';
const NOT_STARTED = 'This could not be saved. Nothing was generated and nothing was changed.';
const DRAFT_NOT_SAVED = 'The draft was written, but it was not saved. Drafting again costs again.';
const LOCKED = { success: false, code: PLACE_LOCKED_CODE, error: PLACE_LOCKED_MESSAGE };
// What a database error carries and an answer or a stored reason must not.
const LEAK = /INSERT|UPDATE |SELECT|violates|constraint|relation|\bat .*\.js|https?:|X-Amz|secret/i;
const databaseError = () => Object.assign(
  new Error('insert or update on table "scene_set_looks" violates foreign key constraint "x_fkey" https://secret.example/x.jpg?X-Amz-Signature=secret'),
  { name: 'SequelizeForeignKeyConstraintError', original: { code: '23503' }, sql: 'INSERT INTO "scene_set_looks" VALUES ($1)', parameters: ['secret'] });
const DRAFT_JSON = JSON.stringify({ overall: 'Candlelit glass hall.', decor: 'White florals.', lighting: 'Warm dusk.', areas: ['Bar'], signage: 'Brass plaques.', must_include: 'Candles.', must_avoid: 'Balloons.' });

const open = [];
const settle = (promise) => promise.then(
  (value) => ({ ok: true, value }),
  (error) => ({ ok: false, error, lock: isLockConflict(error) ? (error.original?.code || error.parent?.code || error.code) : null }));
const send = (req) => req.then((res) => res);
const flat = (sql) => String(sql).replace(/\s+/g, ' ').trim();

(shouldSkip ? describe.skip : describe)('Generation B2: the event look, dressed angles and the venue-look draft save through the Place finalizer', () => {
  jest.setTimeout(Number(process.env.GENB2_TEST_TIMEOUT_MS) || 90000);
  const fx = placeLockFixtures(sequelize, models);
  const { run, rows, mkShow, mkEpisode, mkEvent, mkBrief, mkSet, mkLocation, evaluationOf, eventRow } = fx;
  const TAG = fx.uuid().slice(0, 8);
  let show;
  let editorToken;
  let PNG;
  let trace = null;
  let pause = null;
  let usageLog = null;
  let guardEventsAtStart = 0;
  const usageLogIds = [];
  const saved = {};

  let admins = 0;
  const adminToken = () => {
    admins += 1;
    return TokenService.generateTokenPair({ id: `genb2-admin-${TAG}-${admins}`, email: `admin${admins}@genb2.dev`, name: 'Admin', groups: ['ADMIN'], role: 'ADMIN' }).accessToken;
  };
  const asAdmin = (r) => r.set('X-Forwarded-For', `10.95.${Math.floor(admins / 250)}.${(admins % 250) + 1}`).set('Authorization', `Bearer ${adminToken()}`);
  const lookUrl = (ev, tail = '', showId = show) => `/api/v1/world/${showId}/events/${ev}/look${tail}`;
  const generateLook = (ev, body = {}, showId = show) => asAdmin(request(app).post(lookUrl(ev, '/generate', showId))).send(body);
  const uploadLook = (ev, showId = show) => asAdmin(request(app).post(lookUrl(ev, '/upload', showId))).attach('image', PNG, { filename: 'look.png', contentType: 'image/png' });
  const readLook = async (ev) => (await asAdmin(request(app).get(lookUrl(ev)))).body.data;
  const dressedUrl = (ep, angle, tail) => `/api/v1/episode-brief/${ep}/dressed-angles/${angle}/${tail}`;
  const generateAngle = (ep, angle) => asAdmin(request(app).post(dressedUrl(ep, angle, 'generate'))).send({});
  const uploadAngle = (ep, angle) => asAdmin(request(app).post(dressedUrl(ep, angle, 'upload'))).attach('image', PNG, { filename: 'angle.png', contentType: 'image/png' });
  const draft = (ev) => asAdmin(request(app).post(`/api/v1/world/${show}/events/${ev}/venue-look/draft`)).send({});

  // ── The doubles ────────────────────────────────────────────────────────
  const provider = { calls: [], hold: null, fail: false };
  const storage = { hold: null };
  function latch(target) {
    let release;
    let reached;
    const hold = { used: false };
    hold.wait = new Promise((resolve) => { release = resolve; });
    hold.reached = new Promise((resolve) => { reached = resolve; });
    hold.arrive = reached;
    target.hold = hold;
    open.push(async () => release());
    return { reached: hold.reached, release };
  }
  const holdGeneration = () => latch(provider);
  const holdStorage = () => latch(storage);
  const pass = async (target) => {
    const hold = target.hold;
    if (hold && !hold.used) {
      hold.used = true;
      hold.arrive();
      await hold.wait;
    }
  };
  const falCalls = () => provider.calls;
  const s3Calls = (name) => mockS3Send.mock.calls.map(([cmd]) => cmd).filter((cmd) => cmd?.constructor?.name === name);
  const puts = () => s3Calls('PutObjectCommand').map((cmd) => cmd.input.Key);
  const deletes = () => s3Calls('DeleteObjectCommand');
  const errorLines = () => console.error.mock.calls.map((call) => call.map(String).join(' '));
  const orphanLines = () => errorLines().filter((line) => line.startsWith('[GeneratedNotSaved]'));
  /** Makes the first statement in a transaction whose text matches throw as the database would. */
  function failStatement(pattern) {
    const real = sequelize.query.bind(sequelize);
    return jest.spyOn(sequelize, 'query').mockImplementation((sql, options) => {
      if (options?.transaction && pattern.test(flat(sql))) return Promise.reject(databaseError());
      return real(sql, options);
    });
  }

  // ── Fixtures ───────────────────────────────────────────────────────────
  const baseUrl = () => `https://genb2-test-bucket.s3.us-east-1.amazonaws.com/scene-sets/base-${fx.uuid()}.jpg`;
  /** A venue: a location, a set there (with a base or not), approved or not. */
  async function venue({ approved = true, withSet = true, base = true, showId = show } = {}) {
    const loc = await mkLocation('B2 hall');
    const url = baseUrl();
    const set = withSet
      ? await mkSet(showId, `Hall ${fx.uuid().slice(0, 6)}`, { world_location_id: loc, base_model: 'flux-dev', generation_status: base ? 'complete' : 'pending', ...(base ? { base_still_url: url } : {}) })
      : null;
    if (approved) {
      await run('UPDATE world_locations SET approved_base_scene_set_id = :set, approved_base_image_url = :url, approved_base_at = NOW() WHERE id = :loc', { set, url, loc });
    }
    return { loc, set };
  }
  async function primary({ evaluation = 'pending', set = null, loc = null, showId = show } = {}) {
    const ep = await mkEpisode(showId, { evaluation });
    const ev = await mkEvent(showId, { stamp: ep, set, loc });
    await mkBrief(showId, ep, ev);
    return { ep, ev };
  }
  async function stampOnly({ set = null, loc = null } = {}) {
    const ep = await mkEpisode(show);
    const ev = await mkEvent(show, { stamp: ep, set, loc });
    return { ep, ev };
  }
  const lookOf = async (ev) => (await rows('SELECT * FROM scene_set_looks WHERE event_id = :ev AND deleted_at IS NULL', { ev }))[0] || null;
  const setRow = async (id) => (await rows('SELECT * FROM scene_sets WHERE id = :id', { id }))[0] || null;
  const angleRowOf = async (look, angle) => (await rows('SELECT * FROM scene_set_look_angles WHERE look_id = :look AND scene_angle_id = :angle AND deleted_at IS NULL', { look, angle }))[0] || null;
  const eventLinks = (ep) => rows("SELECT scene_set_id, role FROM scene_set_episodes WHERE episode_id = :ep AND deleted_at IS NULL ORDER BY sort_order, role", { ep });
  async function until(read, done, what) {
    const end = Date.now() + 15000;
    for (;;) {
      const value = await read();
      if (done(value)) return value;
      if (Date.now() > end) throw new Error(`${what} did not end`);
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
  }
  const lookSettled = (ev) => until(() => lookOf(ev), (l) => l && l.status !== 'generating', 'the look run');
  const baseSettled = (set) => until(() => setRow(set), (s) => s.generation_status !== 'generating', 'the base run');
  const angleSettled = (look, angle) => until(() => angleRowOf(look, angle), (a) => a && a.status !== 'generating', 'the dressed angle run');
  /** Every row these flows could change, for a show. */
  async function snapshot(showId = show) {
    const by = { showId };
    return {
      sets: await rows('SELECT * FROM scene_sets WHERE show_id = :showId ORDER BY id', by),
      angles: await rows('SELECT a.* FROM scene_angles a JOIN scene_sets s ON s.id = a.scene_set_id WHERE s.show_id = :showId ORDER BY a.id', by),
      links: await rows('SELECT l.* FROM scene_set_episodes l JOIN episodes e ON e.id = l.episode_id WHERE e.show_id = :showId ORDER BY l.id', by),
      plans: await rows('SELECT p.* FROM scene_plans p JOIN episodes e ON e.id = p.episode_id WHERE e.show_id = :showId ORDER BY p.id', by),
      looks: await rows('SELECT l.* FROM scene_set_looks l JOIN world_events e ON e.id = l.event_id WHERE e.show_id = :showId ORDER BY l.id', by),
      lookAngles: await rows('SELECT a.* FROM scene_set_look_angles a JOIN scene_set_looks l ON l.id = a.look_id JOIN world_events e ON e.id = l.event_id WHERE e.show_id = :showId ORDER BY a.id', by),
      events: await rows('SELECT * FROM world_events WHERE show_id = :showId ORDER BY id', by),
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
  function tracing() {
    trace = lockTrace.install(sequelize);
    return trace;
  }
  function gateOn(predicate) {
    const g = (trace || tracing()).gate(predicate);
    open.push(async () => g.open());
    return g;
  }
  const acceptanceHoldsEpisode = () => gateOn((rec) => Boolean(rec.txId) && rec.kind === 'lock' && rec.table === 'episodes' && rec.mode === 'update');
  async function twoParter() {
    const seasonShow = await mkShow('Generation B2 season');
    const { arc_id: arcId } = await seedArc(seasonShow, models);
    const { loc, set } = await venue({ showId: seasonShow });
    const ev = await mkEvent(seasonShow, { name: 'The Finale Gala', set, loc });
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
    editorToken = TokenService.generateTokenPair({ id: `genb2-editor-${TAG}`, email: 'editor@genb2.dev', name: 'Editor', groups: ['USER', 'EDITOR'], role: 'USER' }).accessToken;
  });
  beforeEach(async () => {
    show = await mkShow('Generation B2');
    for (const k of ['FAL_KEY', 'AI_DAILY_IMAGE_BUDGET_USD', 'AI_DAILY_BUDGET_USD', 'ANTHROPIC_API_KEY']) saved[k] = process.env[k];
    process.env.FAL_KEY = 'test-fal';
    process.env.AI_DAILY_IMAGE_BUDGET_USD = '100000';
    process.env.AI_DAILY_BUDGET_USD = '100000';
    delete process.env.ANTHROPIC_API_KEY;
    provider.calls = [];
    provider.hold = null;
    provider.fail = false;
    storage.hold = null;
    mockS3Send.mockReset();
    mockS3Send.mockImplementation(async (cmd) => {
      if (cmd?.constructor?.name === 'PutObjectCommand' && /\/upload-|\/angles\//.test(cmd.input.Key)) await pass(storage);
      return {};
    });
    mockAnthropic.mockReset();
    mockAnthropic.mockImplementation(async () => { throw new Error('the model is not called in the Generation B2 races'); });
    axios.get.mockImplementation(async () => ({ data: PNG }));
    axios.post.mockImplementation(async (url) => {
      if (!String(url).startsWith('https://fal.run/')) throw new Error(`unexpected provider call ${url}`);
      provider.calls.push(String(url));
      const n = provider.calls.length;
      await pass(provider);
      if (provider.fail) throw Object.assign(new Error('provider down'), { response: { status: 400, data: {} } });
      return { status: 200, data: { images: [{ url: `https://fal.media/genb2-${n}.jpg?X-Amz-Signature=do-not-log-this` }] } };
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
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  });
  afterAll(async () => {
    await new Promise((resolve) => setTimeout(resolve, 500)); // after-commit work of completions and Start Episode
    for (const showId of fx.made.shows) {
      const made = await rows('SELECT id FROM scene_sets WHERE show_id = :showId', { showId });
      for (const { id } of made) if (!fx.made.sets.includes(id)) fx.made.sets.push(id);
      await run('DELETE FROM scene_set_look_angles WHERE look_id IN (SELECT l.id FROM scene_set_looks l JOIN world_events e ON e.id = l.event_id WHERE e.show_id = :showId)', { showId });
    }
    if (fx.made.locations.length) await run('UPDATE world_locations SET approved_base_scene_set_id = NULL, approved_base_image_url = NULL WHERE id IN (:ids)', { ids: fx.made.locations });
    if (fx.made.sets.length) {
      await run('DELETE FROM scene_set_looks WHERE scene_set_id IN (:ids)', { ids: fx.made.sets });
      await run('DELETE FROM scene_angles WHERE scene_set_id IN (:ids)', { ids: fx.made.sets });
    }
    if (usageLogIds.length) await run('DELETE FROM ai_usage_logs WHERE id IN (:ids)', { ids: usageLogIds });
    await fx.cleanup();
  });

  // ══ The look step ══════════════════════════════════════════════════════
  describe('"Generate this look" at a venue with an approved base (the look step)', () => {
    test('saved: 202 as before; the claim is one finalization (episodes, the event row, the set row without waiting), the picture another; one provider call', async () => {
      const { loc, set } = await venue();
      const { ev } = await primary({ set, loc });
      const t = tracing();
      const res = await generateLook(ev);
      expect(res.status).toBe(202);
      expect(res.body).toEqual({ success: true, data: { step: 'look', scene_set_id: set, look_id: expect.any(String) } });
      const look = await lookSettled(ev);
      expect(look).toMatchObject({ id: res.body.data.look_id, status: 'complete', source: 'generated', scene_set_id: set, error: null });
      expect(look.image_url).toMatch(new RegExp(`scene-sets/${set}/stills/.*look-${ev}`));
      expect(falCalls()).toHaveLength(1);
      expect(puts()).toHaveLength(1);
      // The claim: in the finalizer's transaction, after the locks.
      const claim = t.records.find((r) => r.kind === 'insert' && r.table === 'scene_set_looks');
      expect(claim.txId).toBeTruthy();
      const claimTx = t.records.filter((r) => r.txId === claim.txId);
      expect(lockTrace.classSequence(claimTx).slice(0, 3)).toEqual(['E:episodes:share', 'W:world_events:update', 'X:scene_sets:update']);
      expect(claimTx.find((r) => r.kind === 'lock' && r.table === 'scene_sets').sql).toMatch(/FOR NO KEY UPDATE NOWAIT$/);
      expect(claimTx.at(-1).kind).toBe('commit');
      // The completion: another transaction, committed; no transaction spans the provider call.
      const done = t.records.find((r) => r.kind === 'write' && r.table === 'scene_set_looks' && /status = 'complete'/.test(r.sql));
      expect(done.txId).toBeTruthy();
      expect(done.txId).not.toBe(claim.txId);
      expect(lockTrace.classSequence(t.records.filter((r) => r.txId === done.txId)).slice(0, 2)).toEqual(['E:episodes:share', 'W:world_events:update']);
      expect(pause).not.toHaveBeenCalled();
    });

    describe.each([
      ['its primary event (stamp and Brief)', primary],
      ['an event linked by its stamp alone (non-primary)', stampOnly],
    ])('the episode accepted during the paid generation, for %s', (_name, make) => {
      test('the picture is not kept: no look image, the reason on the row, not left generating; the provider called once, nothing deleted, the stored key logged', async () => {
        const { loc, set } = await venue();
        const { ep, ev } = await make({ set, loc });
        const hold = holdGeneration();
        expect((await generateLook(ev)).status).toBe(202);
        await hold.reached;
        await accept(ep);
        const event = await eventRow(ev);
        hold.release();
        const look = await lookSettled(ev);
        expect(look).toMatchObject({ status: 'failed', image_url: null, error: `${PLACE_LOCKED_MESSAGE} ${GENERATED_NOT_SAVED_MESSAGE}` });
        expect(await eventRow(ev)).toEqual(event);
        expect(falCalls()).toHaveLength(1);
        expect(puts()).toHaveLength(1);
        expect(deletes()).toHaveLength(0);
        const lines = orphanLines();
        expect(lines).toHaveLength(1);
        expect(lines[0]).toContain(`storage_keys=${puts()[0]}`);
        expect(lines[0]).toContain(`event=${ev} set=${set} outcome=PLACE_LOCKED attempts=1`);
        for (const line of errorLines()) expect(line).not.toMatch(/\?|X-Amz|do-not-log|https?:\/\//);
      });

      test('a look that already had an image keeps it, with its source, and the dressed angles cut from it', async () => {
        const { loc, set } = await venue();
        const { ep, ev } = await make({ set, loc });
        expect((await uploadLook(ev)).status).toBe(200);
        const before = await lookOf(ev);
        const angle = await models.SceneAngle.create({ scene_set_id: set, angle_label: 'WIDE', angle_name: 'Wide' });
        await run(`INSERT INTO scene_set_look_angles (id, look_id, scene_angle_id, status, image_url, source, created_at, updated_at)
                   VALUES (gen_random_uuid(), :look, :angle, 'complete', 'https://cdn.example/dressed.jpg', 'uploaded', NOW(), NOW())`, { look: before.id, angle: angle.id });
        const hold = holdGeneration();
        expect((await generateLook(ev)).status).toBe(202);
        await hold.reached;
        await accept(ep);
        hold.release();
        const look = await lookSettled(ev);
        expect(look).toMatchObject({ status: 'complete', source: 'uploaded', image_url: before.image_url, error: `${PLACE_LOCKED_MESSAGE} ${GENERATED_NOT_SAVED_MESSAGE}` });
        expect(await angleRowOf(before.id, angle.id)).toMatchObject({ status: 'complete', image_url: 'https://cdn.example/dressed.jpg' });
        expect(falCalls()).toHaveLength(1);
      });

      test('raced at the save: the acceptance holding its episode first (the save waits, then is refused); the save first (it commits, the acceptance waits and then succeeds)', async () => {
        const first = await venue();
        const a = await make({ set: first.set, loc: first.loc });
        const hold = holdGeneration();
        expect((await generateLook(a.ev)).status).toBe(202);
        await hold.reached;
        const g = acceptanceHoldsEpisode();
        const acceptance = settle(completeEpisode(a.ep, show, sequelize));
        await Promise.race([g.reached, acceptance]);
        hold.release();
        await waitForLockWait(sequelize, `%FROM episodes WHERE id IN%${a.ep}%FOR SHARE%`);
        g.open();
        const accepted = await acceptance;
        if (!accepted.ok) throw accepted.error;
        expect(await lookSettled(a.ev)).toMatchObject({ status: 'failed', image_url: null, error: `${PLACE_LOCKED_MESSAGE} ${GENERATED_NOT_SAVED_MESSAGE}` });

        const second = await venue();
        const b = await make({ set: second.set, loc: second.loc });
        const saving = gateOn((rec) => Boolean(rec.txId) && rec.kind === 'write' && rec.table === 'scene_set_looks' && /status = 'complete'/.test(rec.sql));
        expect((await generateLook(b.ev)).status).toBe(202);
        await saving.reached; // the finalizer holds the episode FOR SHARE and the event row, the look written
        const later = settle(completeEpisode(b.ep, show, sequelize));
        await waitForLockWait(sequelize, `%episodes%${b.ep}%`);
        expect(await evaluationOf(b.ep)).not.toBe('accepted');
        saving.open();
        const done = await later;
        expect(done.lock).toBeFalsy();
        if (!done.ok) throw done.error;
        expect(await lookSettled(b.ev)).toMatchObject({ status: 'complete', source: 'generated', error: null });
        expect(await evaluationOf(b.ep)).toBe('accepted');
        expect(trace.records.filter((r) => r.error === '40P01')).toEqual([]);
      });

      test('raced at the claim, before anything is paid: the acceptance first (409 PLACE_LOCKED, nothing generated, no claim, no "not saved"); the claim first (202, the acceptance waits for it)', async () => {
        const first = await venue();
        const a = await make({ set: first.set, loc: first.loc });
        const before = await snapshot();
        const g = acceptanceHoldsEpisode();
        const acceptance = settle(completeEpisode(a.ep, show, sequelize));
        await Promise.race([g.reached, acceptance]); // not committed: the early read still says open
        const pending = send(generateLook(a.ev));
        await waitForLockWait(sequelize, `%FROM episodes WHERE id IN%${a.ep}%FOR SHARE%`);
        g.open();
        const [res, accepted] = await Promise.all([pending, acceptance]);
        if (!accepted.ok) throw accepted.error;
        expect(res.status).toBe(409);
        expect(res.body).toEqual(LOCKED);
        expect(JSON.stringify(res.body)).not.toMatch(/not saved|costs again/i);
        expect(falCalls()).toHaveLength(0);
        expect(mockS3Send).not.toHaveBeenCalled();
        expect(await lookOf(a.ev)).toBeNull();
        expect((await snapshot()).looks).toEqual(before.looks);

        const second = await venue();
        const b = await make({ set: second.set, loc: second.loc });
        const hold = holdGeneration();
        const claiming = gateOn((rec) => Boolean(rec.txId) && rec.kind === 'insert' && rec.table === 'scene_set_looks');
        const started = send(generateLook(b.ev));
        await claiming.reached;
        const later = settle(completeEpisode(b.ep, show, sequelize));
        await waitForLockWait(sequelize, `%episodes%${b.ep}%`);
        claiming.open();
        expect((await started).status).toBe(202);
        const done = await later;
        if (!done.ok) throw done.error;
        // Accepted while the picture was being made: the claim does not stay.
        await hold.reached;
        hold.release();
        expect(await lookSettled(b.ev)).toMatchObject({ status: 'failed', error: `${PLACE_LOCKED_MESSAGE} ${GENERATED_NOT_SAVED_MESSAGE}` });
        expect(falCalls()).toHaveLength(1);
      });
    });

    test('a real two-part special: Part 1 accepted and Part 2 not yet, during generation (the strict rule): not kept; and both parts accepted', async () => {
      const w = await twoParter();
      const hold = holdGeneration();
      expect((await generateLook(w.ev, {}, w.show)).status).toBe(202);
      await hold.reached;
      const holder = await holdTransaction();
      await sequelize.query('SELECT id FROM episodes WHERE id = :id FOR SHARE', { replacements: { id: w.partTwo }, transaction: holder });
      const acceptance = settle(completeEpisode(w.partTwo, w.show, sequelize));
      await waitForLockWait(sequelize, `%UPDATE episodes SET evaluation_status = %accepted%${w.partTwo}%`);
      expect([await evaluationOf(w.partOne), await evaluationOf(w.partTwo)]).toEqual(['accepted', expect.not.stringMatching(/^accepted$/)]);
      hold.release();
      expect(await lookSettled(w.ev)).toMatchObject({ status: 'failed', image_url: null, error: `${PLACE_LOCKED_MESSAGE} ${GENERATED_NOT_SAVED_MESSAGE}` });
      await holder.rollback();
      const a = await acceptance;
      if (!a.ok) throw a.error;
      // Both accepted now: the early check refuses, before anything is paid.
      const again = await generateLook(w.ev, {}, w.show);
      expect(again.status).toBe(409);
      expect(again.body).toEqual(LOCKED);
      expect(falCalls()).toHaveLength(1);
    });

    test('the event moved to another set during the paid generation (a real event PUT): the picture is not attached anywhere; the newer choice and the old rows are as they were', async () => {
      const { loc, set } = await venue();
      const other = await mkSet(show, `Other ${fx.uuid().slice(0, 6)}`, { world_location_id: loc, base_still_url: baseUrl() });
      const { ev } = await primary({ set, loc });
      const hold = holdGeneration();
      expect((await generateLook(ev)).status).toBe(202);
      await hold.reached;
      expect((await asAdmin(request(app).put(`/api/v1/world/${show}/events/${ev}`)).send({ scene_set_id: other })).status).toBe(200);
      const event = await eventRow(ev);
      hold.release();
      const look = await lookSettled(ev);
      expect(look).toMatchObject({ scene_set_id: set, status: 'failed', image_url: null, error: `${STALE_MESSAGE} ${GENERATED_NOT_SAVED_MESSAGE}` });
      expect(await rows('SELECT id FROM scene_set_looks WHERE scene_set_id = :other', { other })).toEqual([]);
      expect(await eventRow(ev)).toEqual(event);
      expect(event.scene_set_id).toBe(other);
      expect(orphanLines()).toEqual([expect.stringContaining('outcome=STALE_SOURCE_SET')]);
      expect(deletes()).toHaveLength(0);
    });

    test.each([
      ['the look\'s own row', /UPDATE scene_set_looks SET status = 'complete'/],
      ['the dressed angles cut from the old image', /UPDATE scene_set_look_angles SET deleted_at/],
    ])('the save failing at %s: rolled back whole, the previous image kept with a fixed reason; nothing of the database\'s in it; the provider called once', async (_name, pattern) => {
      const { loc, set } = await venue();
      const { ev } = await primary({ set, loc });
      expect((await uploadLook(ev)).status).toBe(200);
      const before = await lookOf(ev);
      failStatement(pattern);
      expect((await generateLook(ev)).status).toBe(202);
      const look = await lookSettled(ev);
      expect(look).toMatchObject({ status: 'complete', source: 'uploaded', image_url: before.image_url, error: GENERATED_SAVE_FAILED_MESSAGE });
      expect(look.error).not.toMatch(LEAK);
      expect(falCalls()).toHaveLength(1);
      expect(deletes()).toHaveLength(0);
      expect(orphanLines()).toEqual([expect.stringMatching(/outcome=SAVE_FAILED .*error=SequelizeForeignKeyConstraintError\/23503/)]);
      for (const line of errorLines()) expect(line).not.toMatch(/violates|X-Amz|secret/);
    });

    test('a provider failure is as before: the reason on the row, nothing logged as stored; a second start while one runs is LOOK_GENERATING as before', async () => {
      const { loc, set } = await venue();
      const { ev } = await primary({ set, loc });
      provider.fail = true;
      expect((await generateLook(ev)).status).toBe(202);
      expect(await lookSettled(ev)).toMatchObject({ status: 'failed', image_url: null });
      expect(orphanLines()).toEqual([]);
      provider.fail = false;
      const hold = holdGeneration();
      expect((await generateLook(ev)).status).toBe(202);
      await hold.reached;
      const second = await generateLook(ev);
      expect(second.status).toBe(409);
      expect(second.body).toEqual({ success: false, code: 'LOOK_GENERATING', error: 'This look is already being generated. Wait for it to finish.' });
      hold.release();
      expect(await lookSettled(ev)).toMatchObject({ status: 'complete' });
    });
  });

  // ══ The set row, never waited for ══════════════════════════════════════
  describe('an existing set\'s row held by another transaction when the claim is saved (NOWAIT)', () => {
    async function held() {
      const { loc, set } = await venue();
      const { ev } = await primary({ set, loc });
      const holder = await holdTransaction();
      const [[me]] = await sequelize.query('SELECT pg_backend_pid() AS pid', { transaction: holder });
      await sequelize.query('SELECT id FROM scene_sets WHERE id = :set FOR UPDATE', { replacements: { set }, transaction: holder });
      return { ev, set, holder, pid: me.pid };
    }

    test('let go during the pause (transient): 202 on the second try, after one pause with no transaction open', async () => {
      const { ev, holder, pid } = await held();
      const t = tracing();
      const seen = [];
      pause.mockImplementation(async (ms) => {
        const inTransaction = await rows(
          `SELECT pid FROM pg_stat_activity
            WHERE datname = current_database() AND pid NOT IN (pg_backend_pid(), :pid) AND state LIKE 'idle in transaction%'`, { pid });
        const ends = [...t.byTransaction().entries()].filter(([id]) => id !== holder.id).map(([, recs]) => recs.at(-1).kind);
        seen.push({ ms, inTransaction, ends });
        await holder.rollback();
      });
      const res = await generateLook(ev);
      expect(res.status).toBe(202);
      expect(seen).toEqual([{ ms: DELAY, inTransaction: [], ends: ['rollback'] }]);
      expect(t.records.filter((r) => r.error === '55P03')).toHaveLength(1);
      expect(await lookSettled(ev)).toMatchObject({ status: 'complete' });
      expect(falCalls()).toHaveLength(1);
    });

    test('held throughout (persistent): three tries, two pauses, 409 PLACE_FINALIZE_RETRY_EXHAUSTED with its established text and no "not saved"; nothing generated, no claim', async () => {
      const { ev, holder } = await held();
      pause.mockImplementation(async () => {});
      const t = tracing();
      const res = await generateLook(ev);
      expect(res.status).toBe(409);
      expect(res.body).toEqual({ success: false, code: 'PLACE_FINALIZE_RETRY_EXHAUSTED', error: EXHAUSTED_MESSAGE });
      expect(res.body.outcome).toBeUndefined();
      expect(JSON.stringify(res.body)).not.toMatch(/not saved|costs again/i);
      expect(pause.mock.calls).toEqual([[DELAY], [DELAY]]);
      expect(t.records.filter((r) => r.error === '55P03')).toHaveLength(3);
      expect(falCalls()).toHaveLength(0);
      await holder.rollback();
      expect(await lookOf(ev)).toBeNull();
    });
  });

  // ══ The base step, and a set made for the venue ════════════════════════
  describe('"Generate this look" at a venue with no approved base (the base step)', () => {
    test('no set at the venue: the set, its claim, the event\'s move and the draft episode\'s Event location are one transaction; then the base is saved through the finalizer', async () => {
      const { loc } = await venue({ approved: false, withSet: false });
      const { ep, ev } = await primary({ loc });
      const t = tracing();
      const res = await generateLook(ev);
      expect(res.status).toBe(202);
      const set = res.body.data.scene_set_id;
      expect(res.body).toEqual({ success: true, data: { step: 'base', scene_set_id: set } });
      const insert = t.records.find((r) => r.kind === 'insert' && r.table === 'scene_sets');
      const inTx = t.records.filter((r) => r.txId === insert.txId);
      expect(insert.txId).toBeTruthy();
      expect(insert.ids).toEqual([set]);
      expect(inTx.filter((r) => r.kind === 'write' && r.table === 'scene_sets')).toHaveLength(1); // the claim
      expect(inTx.filter((r) => r.kind === 'write' && r.table === 'world_events')).toHaveLength(1);
      expect(inTx.filter((r) => r.kind === 'insert' && r.table === 'scene_set_episodes')).toHaveLength(1);
      expect(inTx.at(-1).kind).toBe('commit');
      expect((await eventRow(ev)).scene_set_id).toBe(set);
      expect(await eventLinks(ep)).toEqual([{ scene_set_id: set, role: 'event' }]);
      const row = await baseSettled(set);
      expect(row).toMatchObject({ generation_status: 'complete', world_location_id: loc, show_id: show });
      expect(row.base_still_url).toMatch(new RegExp(`scene-sets/${set}/stills/`));
      expect(falCalls()).toHaveLength(1);
      // The base's final write: in a finalizer transaction, the set row locked without waiting.
      const final = t.records.find((r) => r.kind === 'write' && r.table === 'scene_sets' && /"base_still_url"/.test(r.sql));
      expect(lockTrace.classSequence(t.records.filter((r) => r.txId === final.txId))).toEqual(['E:episodes:share', 'W:world_events:update', 'X:scene_sets:update', 'X:scene_sets:write']);
    });

    test.each([
      ['the set', () => jest.spyOn(models.SceneSet, 'create').mockImplementationOnce(async () => { throw databaseError(); })],
      ['the claim', () => failStatement(/UPDATE scene_sets SET generation_status = 'generating'/)],
      ['the event\'s move', () => failStatement(/UPDATE world_events SET scene_set_id/)],
      ['the episode\'s Event location', () => jest.spyOn(eventPlaceSync, 'syncEpisodeEventLocation').mockImplementationOnce(async () => { throw databaseError(); })],
    ])('the start failing at %s: 500 with a fixed sentence, everything rolled back (no set left behind), nothing generated', async (_name, breakIt) => {
      const { loc } = await venue({ approved: false, withSet: false });
      const { ev } = await primary({ loc });
      const before = await snapshot();
      breakIt();
      const res = await generateLook(ev);
      jest.restoreAllMocks();
      expect(res.status).toBe(500);
      expect(res.body).toEqual({ success: false, error: NOT_STARTED });
      expect(JSON.stringify(res.body)).not.toMatch(LEAK);
      expect(await snapshot()).toEqual(before);
      expect(falCalls()).toHaveLength(0);
    });

    test('an existing set with no base: the claim and the move to it in one finalization; BASE_GENERATING as before for a second start, which leaves the first as it is', async () => {
      const { loc, set } = await venue({ approved: false, base: false });
      const { ep, ev } = await primary({ loc }); // not linked yet: the venue's one set is used
      const hold = holdGeneration();
      const res = await generateLook(ev);
      expect(res.status).toBe(202);
      expect(res.body.data).toEqual({ step: 'base', scene_set_id: set });
      await hold.reached;
      expect((await eventRow(ev)).scene_set_id).toBe(set);
      expect(await eventLinks(ep)).toEqual([{ scene_set_id: set, role: 'event' }]);
      const second = await generateLook(ev);
      expect(second.status).toBe(409);
      expect(second.body).toMatchObject({ success: false, code: 'BASE_GENERATING' });
      hold.release();
      expect(await baseSettled(set)).toMatchObject({ generation_status: 'complete' });
      expect(falCalls()).toHaveLength(1);
    });

    test('the set row held when the generated base is saved and let go during the pause: saved on the second try; the provider and storage used once across the tries', async () => {
      const { loc, set } = await venue({ approved: false, base: false });
      const { ev } = await primary({ set, loc });
      const hold = holdGeneration();
      expect((await generateLook(ev)).status).toBe(202);
      await hold.reached; // the claim is committed; the provider is being paid
      const holder = await holdTransaction();
      await sequelize.query('SELECT id FROM scene_sets WHERE id = :set FOR UPDATE', { replacements: { set }, transaction: holder });
      const t = tracing();
      pause.mockImplementation(async () => { await holder.rollback(); });
      hold.release();
      const row = await baseSettled(set);
      expect(row.generation_status).toBe('complete');
      expect(row.base_still_url).toBeTruthy();
      expect(pause.mock.calls).toEqual([[DELAY]]);
      expect(t.records.filter((r) => r.error === '55P03')).toHaveLength(1);
      expect(falCalls()).toHaveLength(1);
      expect(puts()).toHaveLength(1);
    });

    test('accepted during the base\'s generation: not saved, the status put back, not failed; the read says so, and a later uploaded base clears it', async () => {
      const { loc, set } = await venue({ approved: false, base: false });
      const { ep, ev } = await primary({ set, loc });
      const hold = holdGeneration();
      expect((await generateLook(ev)).status).toBe(202);
      await hold.reached;
      await accept(ep);
      hold.release();
      const row = await baseSettled(set);
      expect(row).toMatchObject({ generation_status: 'pending', base_still_url: null });
      expect(row.base_generation.last_error).toBe(`${PLACE_LOCKED_MESSAGE} ${GENERATED_NOT_SAVED_MESSAGE}`);
      expect(falCalls()).toHaveLength(1);
      expect(deletes()).toHaveLength(0);
      await new Promise((resolve) => setTimeout(resolve, 100)); // the look service's catch has run: still not failed
      expect((await setRow(set)).generation_status).toBe('pending');

      const read = await readLook(ev);
      expect(read.scene_set).toEqual({
        id: set, name: row.name, base_still_url: null, generation_status: 'pending',
        error: `${PLACE_LOCKED_MESSAGE} ${GENERATED_NOT_SAVED_MESSAGE}`,
        not_saved: true, failed_at: new Date(row.base_generation.failed_at).toISOString(), generated_at: null,
      });
      expect(read.editable).toBe(false);

      // A base uploaded since (Scene Sets' own upload): the indication is gone.
      const big = await sharp({ create: { width: 800, height: 450, channels: 3, background: '#cccccc' } }).png().toBuffer();
      const uploaded = await asAdmin(request(app).post(`/api/v1/scene-sets/${set}/upload-base`)).attach('image', big, { filename: 'base.png', contentType: 'image/png' });
      expect(uploaded.status).toBe(200);
      const after = (await readLook(ev)).scene_set;
      expect(after).toMatchObject({ not_saved: false, error: null, generation_status: 'complete' });
      expect(after.base_still_url).toBeTruthy();
      expect(after.failed_at).toBe(read.scene_set.failed_at); // still on record, and older than the upload
      expect(Date.parse(after.generated_at)).toBeGreaterThan(Date.parse(after.failed_at));
    });

    test('the read for a base that was never refused, one that failed, and one generated after an older refusal', async () => {
      const { loc, set } = await venue({ approved: false, base: false });
      const { ev } = await primary({ set, loc });
      expect((await readLook(ev)).scene_set).toEqual({ id: set, name: expect.any(String), base_still_url: null, generation_status: 'pending', error: null, not_saved: false, failed_at: null, generated_at: null });
      provider.fail = true;
      expect((await generateLook(ev)).status).toBe(202);
      await baseSettled(set);
      const failed = (await readLook(ev)).scene_set;
      expect(failed).toMatchObject({ generation_status: 'failed', not_saved: false });
      expect(failed.error).toBeTruthy();
      expect(failed.failed_at).toBeTruthy();
      provider.fail = false;
      expect((await generateLook(ev)).status).toBe(202);
      await baseSettled(set);
      const done = (await readLook(ev)).scene_set;
      expect(done).toMatchObject({ generation_status: 'complete', not_saved: false, error: null });
      expect(Date.parse(done.generated_at)).toBeGreaterThan(Date.parse(done.failed_at));
    });
  });

  // ══ An uploaded look ═══════════════════════════════════════════════════
  describe('an uploaded look', () => {
    test('attached as before; the file stored first, then one finalization (the look, the dressed angles cut from the old image)', async () => {
      const { loc, set } = await venue();
      const { ev } = await primary({ set, loc });
      const t = tracing();
      const res = await uploadLook(ev);
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ success: true, data: { scene_set_id: set, look: { id: expect.any(String), status: 'complete', source: 'uploaded', image_url: expect.stringMatching(new RegExp(`scene-sets/${set}/looks/${ev}/upload-`)) } } });
      expect(puts()).toHaveLength(1);
      const insert = t.records.find((r) => r.kind === 'insert' && r.table === 'scene_set_looks');
      expect(insert.txId).toBeTruthy();
      const inTx = t.records.filter((r) => r.txId === insert.txId);
      expect(lockTrace.classSequence(inTx).slice(0, 3)).toEqual(['E:episodes:share', 'W:world_events:update', 'X:scene_sets:update']);
      expect(inTx.filter((r) => r.kind === 'write' && r.table === 'scene_set_look_angles')).toHaveLength(1);
      expect(await lookOf(ev)).toMatchObject({ status: 'complete', source: 'uploaded' });
    });

    test('no set at the venue: the set is made with the id the file was stored under, and the event and its draft episode move to it, together', async () => {
      const { loc } = await venue({ approved: false, withSet: false });
      const { ep, ev } = await primary({ loc });
      const res = await uploadLook(ev);
      expect(res.status).toBe(200);
      const set = res.body.data.scene_set_id;
      expect(puts()).toEqual([expect.stringMatching(new RegExp(`^scene-sets/${set}/looks/${ev}/upload-`))]);
      expect(await setRow(set)).toMatchObject({ world_location_id: loc, show_id: show, scene_type: 'EVENT_LOCATION' });
      expect((await eventRow(ev)).scene_set_id).toBe(set);
      expect(await eventLinks(ep)).toEqual([{ scene_set_id: set, role: 'event' }]);
    });

    describe.each([
      ['its primary event (stamp and Brief)', primary],
      ['an event linked by its stamp alone (non-primary)', stampOnly],
    ])('the episode accepted while the file was being stored, for %s', (_name, make) => {
      test('409 PLACE_LOCKED saying the file was stored and not attached, with no outcome field; the previous look kept; nothing deleted; the key logged', async () => {
        const { loc, set } = await venue();
        const { ep, ev } = await make({ set, loc });
        expect((await uploadLook(ev)).status).toBe(200);
        const before = await lookOf(ev);
        const hold = holdStorage();
        const pending = send(uploadLook(ev));
        await hold.reached;
        await accept(ep);
        const snap = await snapshot();
        hold.release();
        const res = await pending;
        expect(res.status).toBe(409);
        expect(res.body).toEqual({ success: false, code: PLACE_LOCKED_CODE, error: `${PLACE_LOCKED_MESSAGE} ${UPLOAD_NOT_ATTACHED}` });
        expect(res.body.outcome).toBeUndefined();
        expect(await lookOf(ev)).toEqual(before);
        expect(await snapshot()).toEqual(snap);
        expect(puts()).toHaveLength(2);
        expect(deletes()).toHaveLength(0);
        expect(errorLines().filter((l) => l.includes('stored and not attached'))).toEqual([
          expect.stringMatching(new RegExp(`storage_key=${puts()[1]} event=${ev} set=${set} outcome=PLACE_LOCKED attempts=1; nothing was deleted from storage$`)),
        ]);
      });
    });

    test('already accepted: the early 409 as before, and the file is never stored', async () => {
      const { loc, set } = await venue();
      const { ev } = await primary({ evaluation: 'accepted', set, loc });
      const res = await uploadLook(ev);
      expect(res.status).toBe(409);
      expect(res.body).toEqual(LOCKED);
      expect(mockS3Send).not.toHaveBeenCalled();
    });

    test('no set at the venue and the episode accepted while the file was being stored: no set is left behind', async () => {
      const { loc } = await venue({ approved: false, withSet: false });
      const { ep, ev } = await primary({ loc });
      const hold = holdStorage();
      const pending = send(uploadLook(ev));
      await hold.reached;
      await accept(ep);
      const snap = await snapshot();
      hold.release();
      const res = await pending;
      expect(res.status).toBe(409);
      expect(res.body.code).toBe(PLACE_LOCKED_CODE);
      expect(await snapshot()).toEqual(snap);
      expect(snap.sets).toEqual([]);
      expect((await eventRow(ev)).scene_set_id).toBeNull();
    });

    test('the event moved to another set while the file was being stored: STALE_SOURCE_SET, stored and not attached; the newer choice kept', async () => {
      const { loc, set } = await venue();
      const other = await mkSet(show, `Other ${fx.uuid().slice(0, 6)}`, { world_location_id: loc, base_still_url: baseUrl() });
      const { ev } = await primary({ set, loc });
      const hold = holdStorage();
      const pending = send(uploadLook(ev));
      await hold.reached;
      await run('UPDATE world_events SET scene_set_id = :other WHERE id = :ev', { other, ev });
      hold.release();
      const res = await pending;
      expect(res.status).toBe(409);
      expect(res.body).toEqual({ success: false, code: 'STALE_SOURCE_SET', error: `${STALE_MESSAGE} ${UPLOAD_NOT_ATTACHED}` });
      expect(await lookOf(ev)).toBeNull();
      expect((await eventRow(ev)).scene_set_id).toBe(other);
    });

    test.each([
      ['the set', () => jest.spyOn(models.SceneSet, 'create').mockImplementationOnce(async () => { throw databaseError(); })],
      ['the look', () => failStatement(/INSERT INTO scene_set_looks/)],
      ['the event\'s move', () => failStatement(/UPDATE world_events SET scene_set_id/)],
      ['the episode\'s Event location', () => jest.spyOn(eventPlaceSync, 'syncEpisodeEventLocation').mockImplementationOnce(async () => { throw databaseError(); })],
      ['the dressed angles', () => failStatement(/UPDATE scene_set_look_angles SET deleted_at/)],
    ])('the save failing at %s: 500 with a fixed sentence, everything rolled back, the file left in storage and logged', async (_name, breakIt) => {
      const { loc } = await venue({ approved: false, withSet: false });
      const { ev } = await primary({ loc });
      const before = await snapshot();
      breakIt();
      const res = await uploadLook(ev);
      const logged = errorLines();
      jest.restoreAllMocks();
      expect(res.status).toBe(500);
      expect(res.body).toEqual({ success: false, error: UPLOAD_SAVE_FAILED });
      expect(JSON.stringify(res.body)).not.toMatch(LEAK);
      expect(await snapshot()).toEqual(before);
      expect(puts()).toHaveLength(1);
      expect(deletes()).toHaveLength(0);
      expect(logged.filter((l) => l.includes('stored and not attached'))).toEqual([expect.stringMatching(/outcome=SAVE_FAILED error=SequelizeForeignKeyConstraintError\/23503; nothing was deleted from storage$/)]);
    });

    test('an existing set\'s row held throughout: 409 PLACE_FINALIZE_RETRY_EXHAUSTED, stored and not attached, after two pauses', async () => {
      const { loc, set } = await venue();
      const { ev } = await primary({ set, loc });
      const holder = await holdTransaction();
      await sequelize.query('SELECT id FROM scene_sets WHERE id = :set FOR UPDATE', { replacements: { set }, transaction: holder });
      pause.mockImplementation(async () => {});
      const res = await uploadLook(ev);
      expect(res.status).toBe(409);
      expect(res.body).toEqual({ success: false, code: 'PLACE_FINALIZE_RETRY_EXHAUSTED', error: `${EXHAUSTED_MESSAGE} ${UPLOAD_NOT_ATTACHED}` });
      expect(pause.mock.calls).toEqual([[DELAY], [DELAY]]);
      await holder.rollback();
      expect(await lookOf(ev)).toBeNull();
    });
  });

  // ══ Dressed angles ═════════════════════════════════════════════════════
  describe('dressed angles', () => {
    /** An episode, its event at an approved venue with an uploaded look, and an angle of the set. */
    async function dressedFixture(make = primary) {
      const { loc, set } = await venue();
      const { ep, ev } = await make({ set, loc });
      expect((await uploadLook(ev)).status).toBe(200);
      const look = await lookOf(ev);
      const angle = (await models.SceneAngle.create({ scene_set_id: set, angle_label: 'WIDE', angle_name: 'Wide', still_image_url: baseUrl() })).id;
      mockS3Send.mockClear();
      return { ep, ev, set, look, angle };
    }

    test('before acceptance: generated (202, then complete, saved in one finalization) and uploaded (200), as before', async () => {
      const f = await dressedFixture();
      const t = tracing();
      const res = await generateAngle(f.ep, f.angle);
      expect(res.status).toBe(202);
      expect(res.body.data).toMatchObject({ status: 'generating', look_id: f.look.id, angle_id: f.angle });
      const row = await angleSettled(f.look.id, f.angle);
      expect(row).toMatchObject({ status: 'complete', source: 'generated', error: null });
      expect(falCalls()).toHaveLength(1);
      const done = t.records.find((r) => r.kind === 'write' && r.table === 'scene_set_look_angles' && /status = 'complete'/.test(r.sql));
      expect(done.txId).toBeTruthy();
      expect(lockTrace.classSequence(t.records.filter((r) => r.txId === done.txId))).toEqual(['E:episodes:share', 'W:world_events:update', 'X:scene_set_look_angles:write']);

      const up = await uploadAngle(f.ep, f.angle);
      expect(up.status).toBe(200);
      expect(up.body.data).toMatchObject({ status: 'complete', look_id: f.look.id, angle_id: f.angle });
      expect(await angleRowOf(f.look.id, f.angle)).toMatchObject({ status: 'complete', source: 'uploaded', image_url: up.body.data.image_url });
    });

    describe.each([
      ['its primary event (stamp and Brief)', primary],
      ['an event linked by its stamp alone (non-primary)', stampOnly],
    ])('after acceptance, for %s', (_name, make) => {
      test('generate and upload are refused with 409 PLACE_LOCKED before the claim, the provider and the storage write', async () => {
        const f = await dressedFixture(make);
        await accept(f.ep);
        const before = await snapshot();
        const gen = await generateAngle(f.ep, f.angle);
        expect(gen.status).toBe(409);
        expect(gen.body).toEqual(LOCKED);
        const up = await uploadAngle(f.ep, f.angle);
        expect(up.status).toBe(409);
        expect(up.body).toEqual(LOCKED);
        expect(falCalls()).toHaveLength(0);
        expect(mockS3Send).not.toHaveBeenCalled();
        expect(await angleRowOf(f.look.id, f.angle)).toBeNull();
        expect(await snapshot()).toEqual(before);
      });

      test('accepted during the paid generation: the picture is not kept, the previous image stays, the row is not left generating; the provider called once', async () => {
        const f = await dressedFixture(make);
        const first = await uploadAngle(f.ep, f.angle);
        expect(first.status).toBe(200);
        const hold = holdGeneration();
        expect((await generateAngle(f.ep, f.angle)).status).toBe(202);
        await hold.reached;
        await accept(f.ep);
        hold.release();
        const row = await angleSettled(f.look.id, f.angle);
        expect(row).toMatchObject({ status: 'complete', source: 'uploaded', image_url: first.body.data.image_url, error: `${PLACE_LOCKED_MESSAGE} ${GENERATED_NOT_SAVED_MESSAGE}` });
        expect(falCalls()).toHaveLength(1);
        expect(deletes()).toHaveLength(0);
        expect(orphanLines()).toEqual([expect.stringMatching(new RegExp(`event=${f.ev} set=${f.set} outcome=PLACE_LOCKED attempts=1`))]);
      });

      test('accepted while an uploaded angle was being stored: 409 PLACE_LOCKED saying it was stored and not attached; no outcome field; no row', async () => {
        const f = await dressedFixture(make);
        const hold = holdStorage();
        const pending = send(uploadAngle(f.ep, f.angle));
        await hold.reached;
        await accept(f.ep);
        hold.release();
        const res = await pending;
        expect(res.status).toBe(409);
        expect(res.body).toEqual({ success: false, error: `${PLACE_LOCKED_MESSAGE} ${UPLOAD_NOT_ATTACHED}`, code: PLACE_LOCKED_CODE });
        expect(res.body.outcome).toBeUndefined();
        expect(await angleRowOf(f.look.id, f.angle)).toBeNull();
        expect(puts()).toHaveLength(1);
        expect(deletes()).toHaveLength(0);
      });
    });

    test('the acceptance holding its episode when the dressed angle is saved: the save waits, then is refused; the save first: it commits and the acceptance waits', async () => {
      const a = await dressedFixture();
      const hold = holdGeneration();
      expect((await generateAngle(a.ep, a.angle)).status).toBe(202);
      await hold.reached;
      const g = acceptanceHoldsEpisode();
      const acceptance = settle(completeEpisode(a.ep, show, sequelize));
      await Promise.race([g.reached, acceptance]);
      hold.release();
      await waitForLockWait(sequelize, `%FROM episodes WHERE id IN%${a.ep}%FOR SHARE%`);
      g.open();
      const accepted = await acceptance;
      if (!accepted.ok) throw accepted.error;
      expect(await angleSettled(a.look.id, a.angle)).toMatchObject({ status: 'failed', image_url: null, error: `${PLACE_LOCKED_MESSAGE} ${GENERATED_NOT_SAVED_MESSAGE}` });

      const b = await dressedFixture();
      const saving = gateOn((rec) => Boolean(rec.txId) && rec.kind === 'write' && rec.table === 'scene_set_look_angles' && /status = 'complete'/.test(rec.sql));
      expect((await generateAngle(b.ep, b.angle)).status).toBe(202);
      await saving.reached;
      const later = settle(completeEpisode(b.ep, show, sequelize));
      await waitForLockWait(sequelize, `%episodes%${b.ep}%`);
      saving.open();
      const done = await later;
      if (!done.ok) throw done.error;
      expect(await angleSettled(b.look.id, b.angle)).toMatchObject({ status: 'complete', source: 'generated' });
    });

    test('the save failing for another reason: generated, the row keeps a fixed reason and is not left generating; uploaded, 500 with a fixed sentence and no row', async () => {
      const f = await dressedFixture();
      const spy = failStatement(/UPDATE scene_set_look_angles SET status = 'complete'/);
      expect((await generateAngle(f.ep, f.angle)).status).toBe(202);
      const row = await angleSettled(f.look.id, f.angle);
      spy.mockRestore();
      expect(row).toMatchObject({ status: 'failed', image_url: null, error: GENERATED_SAVE_FAILED_MESSAGE });
      expect(falCalls()).toHaveLength(1);
      expect(orphanLines()).toEqual([expect.stringMatching(/outcome=SAVE_FAILED .*error=SequelizeForeignKeyConstraintError\/23503/)]);

      const g = await dressedFixture();
      failStatement(/INSERT INTO scene_set_look_angles/);
      const up = await uploadAngle(g.ep, g.angle);
      jest.restoreAllMocks();
      expect(up.status).toBe(500);
      expect(up.body).toEqual({ success: false, error: UPLOAD_SAVE_FAILED });
      expect(JSON.stringify(up.body)).not.toMatch(LEAK);
      expect(await angleRowOf(g.look.id, g.angle)).toBeNull();
    });

    test('an episode with no event: NO_LOOK as before, for generate and upload; nothing generated or stored', async () => {
      const { set } = await venue();
      const ep = await mkEpisode(show);
      const angle = (await models.SceneAngle.create({ scene_set_id: set, angle_label: 'WIDE', angle_name: 'Wide' })).id;
      const NO_LOOK = { success: false, error: "This episode's event has no finished look on this set; the plain angle is used", code: 'NO_LOOK' };
      const gen = await generateAngle(ep, angle);
      expect(gen.status).toBe(409);
      expect(gen.body).toEqual(NO_LOOK);
      const up = await uploadAngle(ep, angle);
      expect(up.status).toBe(409);
      expect(up.body).toEqual(NO_LOOK);
      expect(falCalls()).toHaveLength(0);
      expect(mockS3Send).not.toHaveBeenCalled();
    });
  });

  // ══ The venue-look draft ═══════════════════════════════════════════════
  describe('the venue-look draft', () => {
    const answer = async () => ({ content: [{ text: DRAFT_JSON }] });
    const venueLook = async (ev) => (await eventRow(ev)).venue_look;

    test('saved: the model once, then one finalization (no set is compared)', async () => {
      const { ev } = await primary();
      mockAnthropic.mockImplementation(answer);
      const t = tracing();
      const res = await draft(ev);
      expect(res.status).toBe(200);
      expect(res.body.data.venue_look).toMatchObject({ overall: 'Candlelit glass hall.', areas: ['Bar'] });
      expect(mockAnthropic).toHaveBeenCalledTimes(1);
      const write = t.records.find((r) => r.kind === 'write' && r.table === 'world_events' && /venue_look/.test(r.sql));
      expect(lockTrace.classSequence(t.records.filter((r) => r.txId === write.txId))).toEqual(['E:episodes:share', 'W:world_events:update', 'W:world_events:write']);
      expect(await venueLook(ev)).toMatchObject({ overall: 'Candlelit glass hall.' });
    });

    test('the model failing is as before: tried twice, then 502; failing once, then saved', async () => {
      const { ev } = await primary();
      mockAnthropic.mockImplementation(async () => { throw new Error('model down'); });
      const failed = await draft(ev);
      expect(failed.status).toBe(502);
      expect(failed.body).toEqual({ success: false, code: 'VENUE_LOOK_DRAFT_FAILED', error: 'Drafting failed: model down' });
      expect(mockAnthropic).toHaveBeenCalledTimes(2);
      expect(await venueLook(ev)).toBeNull();
      mockAnthropic.mockReset();
      mockAnthropic.mockImplementationOnce(async () => { throw new Error('model down'); }).mockImplementationOnce(answer);
      expect((await draft(ev)).status).toBe(200);
      expect(mockAnthropic).toHaveBeenCalledTimes(2);
    });

    test('the save failing: 500 GENERATED_SAVE_FAILED with a fixed sentence; the model was called once, not again; nothing saved; nothing of the database\'s in the answer', async () => {
      const { ev } = await primary();
      mockAnthropic.mockImplementation(answer);
      failStatement(/UPDATE world_events SET venue_look/);
      const res = await draft(ev);
      jest.restoreAllMocks();
      expect(res.status).toBe(500);
      expect(res.body).toEqual({ success: false, code: 'GENERATED_SAVE_FAILED', error: 'The draft was written, but saving it failed. Nothing was saved. Drafting again costs again.' });
      expect(JSON.stringify(res.body)).not.toMatch(LEAK);
      expect(mockAnthropic).toHaveBeenCalledTimes(1);
      expect(await venueLook(ev)).toBeNull();
    });

    test('accepted while the model was writing: 409 VENUE_LOOK_LOCKED saying the draft was not saved; the model called once; nothing saved', async () => {
      const { ep, ev } = await primary();
      let release;
      let reached;
      const arrived = new Promise((resolve) => { reached = resolve; });
      const wait = new Promise((resolve) => { release = resolve; });
      open.push(async () => release());
      mockAnthropic.mockImplementation(async () => {
        reached();
        await wait;
        return answer();
      });
      const pending = send(draft(ev));
      await arrived;
      const completion = jest.fn(async () => { throw new Error('the model is not called for the story record here'); });
      const writing = mockAnthropic.getMockImplementation();
      mockAnthropic.mockImplementation(completion);
      await accept(ep);
      mockAnthropic.mockImplementation(writing);
      release();
      const res = await pending;
      expect(res.status).toBe(409);
      expect(res.body).toEqual({ success: false, code: 'VENUE_LOOK_LOCKED', error: `This event's episode is accepted: its venue look is locked. ${DRAFT_NOT_SAVED}` });
      expect(await venueLook(ev)).toBeNull();
    });

    test('a conflict on every try of the save: 409 PLACE_FINALIZE_RETRY_EXHAUSTED; the model called once', async () => {
      const { ev } = await primary();
      mockAnthropic.mockImplementation(answer);
      const linkedRead = /FROM episodes e WHERE e\.deleted_at IS NULL AND \(e\.id = \(SELECT w\.used_in_episode_id/;
      const seen = new Set();
      const first = (rec, sql) => Boolean(rec.txId) && linkedRead.test(sql) && !seen.has(rec.txId) && Boolean(seen.add(rec.txId));
      const gates = [gateOn(first), gateOn(first), gateOn(first)];
      const pending = send(draft(ev));
      for (const g of gates) {
        await g.reached;
        await mkBrief(show, await mkEpisode(show), ev);
        g.open();
      }
      const res = await pending;
      expect(res.status).toBe(409);
      expect(res.body).toEqual({ success: false, code: 'PLACE_FINALIZE_RETRY_EXHAUSTED', error: `${EXHAUSTED_MESSAGE} ${DRAFT_NOT_SAVED}` });
      expect(mockAnthropic).toHaveBeenCalledTimes(1);
      expect(await venueLook(ev)).toBeNull();
    });

    test('already accepted: the early 409 VENUE_LOOK_LOCKED as before, and the model is not called', async () => {
      const { ev } = await primary({ evaluation: 'accepted' });
      mockAnthropic.mockImplementation(answer);
      const res = await draft(ev);
      expect(res.status).toBe(409);
      expect(res.body).toEqual({ success: false, code: 'VENUE_LOOK_LOCKED', error: "This event's episode is accepted: its venue look is locked" });
      expect(mockAnthropic).not.toHaveBeenCalled();
    });
  });

  describe('the network guard', () => {
    test('no external network attempt in this file', () => {
      const mine = networkGuard.getState().events.slice(guardEventsAtStart);
      expect(mine.filter((e) => e.type === 'attempt')).toEqual([]);
    });
  });
});
