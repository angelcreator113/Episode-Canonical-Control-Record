/**
 * A base is saved only onto a live set, and generate-venue answers from what
 * was saved (Evoni, 2026-11-24;
 * docs/audit/F-AUTH-1_BaseSaveLiveSet_Amendment_2026-11-24.md).
 *
 * Removing a scene set is a soft delete: the row stays. Two things followed:
 *   1. generate-venue read the set again after its save had committed; a
 *      delete that committed in between made that read throw, and a paid,
 *      saved picture answered 500 with the ORM's text;
 *   2. a base whose set was removed while the provider was working was
 *      "saved" by an update that matched no row: nothing was written,
 *      nothing was said, and the paid picture was lost.
 * Now the final save takes the set's row live only (and counts the row it
 * wrote): a set that is gone is the generated-not-saved refusal
 * (SET_NOT_FOUND), on both paths of generateBaseScene; and generate-venue
 * answers with the image that save committed.
 *
 * On the migrated test database, through the real app. The image provider
 * (axios), the storage (S3Client) and the model (Anthropic) are doubles: no
 * paid call. The deletes are the real DELETE /api/v1/scene-sets/:id, placed
 * with a latch on the provider double, a latch on the storage or model
 * double, or the lock trace's gate on a statement. [injected] marks the one
 * case that alters a statement. Nothing sends DDL.
 */
jest.unmock('uuid');
process.env.S3_PRIMARY_BUCKET = 'base-live-test-bucket';

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
const sceneGen = require('../../src/services/sceneGenerationService');
const generationClaim = require('../../src/services/generationClaimService');
const lockTrace = require('../helpers/lockTrace');
const { databaseTextMatcher } = require('../helpers/databaseText');
const networkGuard = require('../networkGuard/core');
const { placeLockFixtures } = require('../helpers/placeLockFixtures');

const { sequelize } = models;
const BUCKET = 'base-live-test-bucket';

const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const NOT_SAVED = 'The image was generated but it was not saved. Generating it again costs again.';
const GONE = 'That scene set no longer exists.';
// This suite's OWN word list, unchanged and not inherited from the shared
// one (Evoni, 2026-11-27): its two ORM phrases, and `relation ` with the
// trailing space that keeps it narrower than the shared `relation`. The words
// the shared list carries and this one does not — deadlock, syntax, canceling
// statement, lock timeout — stay out, deliberately.
//
// What it DOES take is the shared SQL recognition, an approved improvement
// rather than a like-for-like move: its own pattern had the SELECT and UPDATE
// keywords only, so INSERT and DELETE statements, multiline statements and
// clause fragments reached its assertion unflagged, while its keywords flagged
// our own English ("Update your scene set.").
const NOT_DATABASE_TEXT = databaseTextMatcher([
  'Instance could not be reloaded',
  'find call returned null',
  'Sequelize',
  'violates',
  'constraint',
  'relation ',
]);
const open = [];
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const send = (req) => req.then((res) => res);
const settle = (promise) => promise.then((value) => ({ ok: true, value }), (error) => ({ ok: false, error }));

(shouldSkip ? describe.skip : describe)('a base is saved only onto a live set; generate-venue answers from what was saved', () => {
  jest.setTimeout(Number(process.env.BASE_TEST_TIMEOUT_MS) || 90000);
  const fx = placeLockFixtures(sequelize, models);
  const { run, rows, mkShow, mkEpisode, mkEvent, mkBrief, mkSet, mkLocation, eventRow } = fx;
  const TAG = fx.uuid().slice(0, 8);
  let show;
  let PNG;
  let trace = null;
  let guardEventsAtStart = 0;
  let usageLog;
  const usageLogIds = [];
  const saved = {};

  let admins = 0;
  const adminToken = () => {
    admins += 1;
    return TokenService.generateTokenPair({ id: `base-admin-${TAG}-${admins}`, email: `admin${admins}@base.dev`, name: 'Admin', groups: ['ADMIN'], role: 'ADMIN' }).accessToken;
  };
  const asAdmin = (r) => r.set('X-Forwarded-For', `10.98.${Math.floor(admins / 250)}.${(admins % 250) + 1}`).set('Authorization', `Bearer ${adminToken()}`);
  const del = (id, query = '?confirm_orphan=true') => asAdmin(request(app).delete(`/api/v1/scene-sets/${id}${query}`)).send({});
  const generateVenue = (ev) => asAdmin(request(app).post(`/api/v1/world/${show}/events/${ev}/generate-venue`)).send({});
  const generateBase = (id, body = {}) => asAdmin(request(app).post(`/api/v1/scene-sets/${id}/generate-base`)).send(body);

  // ── The doubles ────────────────────────────────────────────────────────
  const provider = { calls: [], hold: null };
  const storage = { holdDelete: null };
  const model = { hold: null, calls: 0 };
  function latch(target, key = 'hold') {
    let release;
    let reached;
    const hold = { used: false };
    hold.wait = new Promise((resolve) => { release = resolve; });
    hold.reached = new Promise((resolve) => { reached = resolve; });
    hold.arrive = reached;
    target[key] = hold;
    open.push(async () => release());
    return { reached: hold.reached, release };
  }
  const pass = async (hold) => {
    if (hold && !hold.used) {
      hold.used = true;
      hold.arrive();
      await hold.wait;
    }
  };
  const s3Calls = (name) => mockS3Send.mock.calls.map(([cmd]) => cmd).filter((cmd) => cmd?.constructor?.name === name);
  const puts = () => s3Calls('PutObjectCommand').map((cmd) => cmd.input.Key);
  const storageDeletes = () => s3Calls('DeleteObjectCommand').map((cmd) => cmd.input.Key);
  const errorLines = () => console.error.mock.calls.map((call) => call.map(String).join(' '));
  const orphanLines = () => errorLines().filter((line) => line.startsWith('[GeneratedNotSaved]'));

  // ── Fixtures ───────────────────────────────────────────────────────────
  const storedUrl = (key) => `https://${BUCKET}.s3.us-east-1.amazonaws.com/${key}`;
  /** A set at a venue. previous: it already has a base image in the bucket. */
  async function venueSet({ previous = false } = {}) {
    const place = await mkLocation('Base hall');
    const id = await mkSet(show, `Hall ${fx.uuid().slice(0, 6)}`, {
      scene_type: 'EVENT_LOCATION', world_location_id: place, base_model: 'flux-dev',
      generation_status: previous ? 'complete' : 'pending',
    });
    let oldUrl = null;
    if (previous) {
      oldUrl = storedUrl(`scene-sets/${id}/stills/previous-base.jpg`);
      await run('UPDATE scene_sets SET base_still_url = :oldUrl WHERE id = :id', { oldUrl, id });
    }
    return { id, place, oldUrl };
  }
  /** A draft episode's event held at a set that has no base yet: generate-venue generates that set's base. */
  async function venueEvent() {
    const set = await venueSet();
    const ep = await mkEpisode(show);
    const ev = await mkEvent(show, { stamp: ep, set: set.id, loc: set.place });
    await mkBrief(show, ep, ev);
    return { ...set, ep, ev };
  }
  /** The set's row as stored, removed or not. */
  const setRow = async (id) => (await rows('SELECT id, deleted_at, generation_status, base_still_url, base_generation, visual_language, updated_at FROM scene_sets WHERE id = :id', { id }))[0];
  function tracing() {
    trace = lockTrace.install(sequelize);
    return trace;
  }
  function gateOn(predicate) {
    const g = (trace || tracing()).gate(predicate);
    open.push(async () => g.open());
    return g;
  }
  /** The base's final save, just after its transaction committed. */
  const afterTheSaveCommits = () => {
    let tx = null;
    return (rec, sql) => {
      if (rec.txId && /^UPDATE "scene_sets" SET "base_runway_prompt"/.test(sql)) tx = rec.txId;
      return Boolean(tx) && rec.txId === tx && rec.kind === 'commit';
    };
  };
  /** The background run of POST /scene-sets/:id/generate-base: resolves how generateBaseScene ended. */
  async function startBase(id, body = {}) {
    const spy = jest.spyOn(sceneGen, 'generateBaseScene');
    const res = await generateBase(id, body);
    expect(res.status).toBe(202);
    const end = Date.now() + 5000;
    while (!spy.mock.results.length && Date.now() < end) await sleep(10);
    return settle(spy.mock.results[0].value);
  }
  const expectRefused = (ended) => {
    expect(ended.ok).toBe(false);
    expect(ended.error).toBeInstanceOf(sceneGen.PlaceFinalizeRefusal);
    expect(ended.error).toMatchObject({ code: 'SET_NOT_FOUND', status: 409, outcome: 'generated_not_saved', message: GONE, detail: NOT_SAVED });
  };

  beforeAll(async () => {
    guardEventsAtStart = networkGuard.getState().events.length;
    PNG = await sharp({ create: { width: 4, height: 4, channels: 3, background: '#ffffff' } }).png().toBuffer();
  });
  beforeEach(async () => {
    show = await mkShow('Base live set');
    for (const k of ['FAL_KEY', 'AI_DAILY_IMAGE_BUDGET_USD', 'AI_DAILY_BUDGET_USD', 'ANTHROPIC_API_KEY']) saved[k] = process.env[k];
    process.env.FAL_KEY = 'test-fal';
    process.env.AI_DAILY_IMAGE_BUDGET_USD = '100000';
    process.env.AI_DAILY_BUDGET_USD = '100000';
    delete process.env.ANTHROPIC_API_KEY;
    provider.calls = [];
    provider.hold = null;
    storage.holdDelete = null;
    model.hold = null;
    model.calls = 0;
    mockS3Send.mockReset();
    mockS3Send.mockImplementation(async (cmd) => {
      if (cmd?.constructor?.name === 'DeleteObjectCommand') await pass(storage.holdDelete);
      return {};
    });
    mockAnthropic.mockReset();
    mockAnthropic.mockImplementation(async () => {
      model.calls += 1;
      await pass(model.hold);
      return { content: [{ type: 'text', text: '{"color_palette":["#ffffff"],"materials":["oak"],"lighting_type":"soft ambient","design_style":"modern","key_textures":["linen"]}' }] };
    });
    axios.get.mockImplementation(async () => ({ data: PNG }));
    axios.post.mockImplementation(async (url) => {
      if (!String(url).startsWith('https://fal.run/')) throw new Error(`unexpected provider call ${url}`);
      provider.calls.push(String(url));
      const n = provider.calls.length;
      await pass(provider.hold);
      return { status: 200, data: { images: [{ url: `https://fal.media/base-${n}.jpg` }] } };
    });
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    usageLog = jest.spyOn(models.AIUsageLog, 'create');
  });
  afterEach(async () => {
    for (const result of usageLog?.mock.results || []) {
      const row = result.type === 'return' ? await Promise.resolve(result.value).catch(() => null) : null;
      if (row?.id != null) usageLogIds.push(row.id);
    }
    for (const close of open.splice(0).reverse()) await close();
    await sleep(50); // a background analysis let go by the line above
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
    await sleep(300);
    if (usageLogIds.length) await run('DELETE FROM ai_usage_logs WHERE id IN (:ids)', { ids: usageLogIds });
    if (fx.made.sets.length) await run('DELETE FROM scene_angles WHERE scene_set_id IN (:ids)', { ids: fx.made.sets });
    await run('DELETE FROM scene_sets WHERE show_id IN (:shows)', { shows: fx.made.shows }); // venues generate-venue made
    await fx.cleanup();
  });

  // ══ generate-venue ═════════════════════════════════════════════════════
  describe('generate-venue (the base of the event\'s own set, saved through the Place finalizer)', () => {
    test('the set deleted AFTER the save committed and BEFORE the route answers: 200 generated, with the image that save committed; the delete succeeds; no ORM or database text; one provider call, one stored picture', async () => {
      const v = await venueEvent();
      const committed = gateOn(afterTheSaveCommits());
      const pending = send(generateVenue(v.ev));
      await committed.reached;
      const atCommit = await setRow(v.id);
      expect(atCommit.base_still_url).toMatch(new RegExp(`^https://${BUCKET}\\.s3\\.us-east-1\\.amazonaws\\.com/scene-sets/${v.id}/`));
      const removed = await del(v.id);
      expect(removed.status).toBe(200);
      expect((await setRow(v.id)).deleted_at).not.toBeNull();
      committed.open();
      const res = await pending;
      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        success: true, outcome: 'generated',
        data: { kind: 'base', scene_set_id: v.id, venue_image_url: atCommit.base_still_url, venue_name: expect.stringMatching(/^Hall /) },
        message: expect.stringMatching(/^Venue image generated for "Hall /),
      });
      expect(JSON.stringify(res.body)).not.toMatch(NOT_DATABASE_TEXT);
      expect(provider.calls).toHaveLength(1);
      expect(puts()).toHaveLength(1);
      expect(storageDeletes()).toEqual([]);
      expect(orphanLines()).toEqual([]);
      // The removed row keeps what was saved; it is not restored.
      expect(await setRow(v.id)).toMatchObject({ base_still_url: atCommit.base_still_url, generation_status: 'complete' });
    });

    test('"delete anyway" committed DURING the provider call: 409 generated_not_saved / SET_NOT_FOUND; one [GeneratedNotSaved] line with the stored key, the cost and the usage ids; nothing attached; the provider called once', async () => {
      const v = await venueEvent();
      const during = latch(provider);
      const pending = send(generateVenue(v.ev));
      await during.reached;
      const removed = await del(v.id);
      expect(removed.status).toBe(200);
      during.release();
      const res = await pending;
      expect(res.status).toBe(409);
      expect(res.body).toEqual({ success: false, outcome: 'generated_not_saved', code: 'SET_NOT_FOUND', error: GONE, message: NOT_SAVED });
      expect(provider.calls).toHaveLength(1);
      expect(puts()).toHaveLength(1);
      expect(storageDeletes()).toEqual([]);
      const lines = orphanLines();
      expect(lines).toHaveLength(1);
      expect(lines[0]).toContain(`storage_keys=${puts()[0]}`);
      expect(lines[0]).toContain(`event=${v.ev} set=${v.id} outcome=SET_NOT_FOUND`);
      expect(lines[0]).toMatch(/cost=\$[\d.]+ estimate=\$[\d.]+ usage_log_ids=\d+/);
      expect(lines[0]).toMatch(/nothing was deleted from storage$/);
      // Nothing attached: no base on the removed row, the event as the delete left it, no venue made in its place.
      const row = await setRow(v.id);
      expect(row.deleted_at).not.toBeNull(); // not restored
      expect(row.base_still_url).toBeNull();
      expect(row.generation_status).toBe('pending'); // its claim cleared, back to what it was
      expect(row.base_generation).toMatchObject({ last_error: `${GONE} ${NOT_SAVED}`, failed_at: expect.any(String) });
      expect((await eventRow(v.ev)).scene_set_id).toBe(v.id);
      expect(await rows('SELECT id FROM scene_sets WHERE show_id = :show AND id <> :id', { show, id: v.id })).toEqual([]);
    });

    test('a delete WITH a replacement during the provider call: the existing 409 generated_not_saved / STALE_SOURCE_SET, as before', async () => {
      const v = await venueEvent();
      const other = await venueSet({ previous: true });
      const during = latch(provider);
      const pending = send(generateVenue(v.ev));
      await during.reached;
      expect((await del(v.id, `?replacement_id=${other.id}`)).status).toBe(200);
      during.release();
      const res = await pending;
      expect(res.status).toBe(409);
      expect(res.body).toEqual({
        success: false, outcome: 'generated_not_saved', code: 'STALE_SOURCE_SET',
        error: "This event's scene set changed while this was being made. Nothing was saved over the newer choice.", message: NOT_SAVED,
      });
      expect(orphanLines()).toHaveLength(1);
      expect(provider.calls).toHaveLength(1);
      expect((await eventRow(v.ev)).scene_set_id).toBe(other.id);
      expect((await setRow(other.id)).base_still_url).toBe(other.oldUrl);
    });

    test('the set deleted BEFORE generation starts: as before, a new venue is generated for the event', async () => {
      const v = await venueEvent();
      expect((await del(v.id)).status).toBe(200);
      const res = await generateVenue(v.ev);
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ success: true, outcome: 'generated', data: { kind: 'venue' } });
      const now = (await eventRow(v.ev)).scene_set_id;
      expect(now).not.toBe(v.id);
      expect((await setRow(now)).deleted_at).toBeNull();
      expect((await setRow(v.id)).base_still_url).toBeNull();
    });

    test('nothing in its way: 200 generated with the saved image, as before', async () => {
      const v = await venueEvent();
      const res = await generateVenue(v.ev);
      expect(res.status).toBe(200);
      expect(res.body.data).toEqual({ kind: 'base', scene_set_id: v.id, venue_image_url: (await setRow(v.id)).base_still_url, venue_name: expect.any(String) });
      expect(orphanLines()).toEqual([]);
    });
  });

  // ══ POST /scene-sets/:id/generate-base ═════════════════════════════════
  describe('POST /scene-sets/:id/generate-base (202, then the base in the background; the plain-transaction save)', () => {
    test('nothing in its way: saved as before; the previous image is deleted from storage only after the new one is saved', async () => {
      const s = await venueSet({ previous: true });
      const ended = await startBase(s.id);
      expect(ended.ok).toBe(true);
      const row = await setRow(s.id);
      expect(row.generation_status).toBe('complete');
      expect(row.base_still_url).toBe(ended.value.stillUrl);
      expect(row.base_still_url).not.toBe(s.oldUrl);
      expect(storageDeletes()).toEqual([`scene-sets/${s.id}/stills/previous-base.jpg`]);
      expect(orphanLines()).toEqual([]);
    });

    test('a first base, "delete anyway" during the provider call: generated and not saved (SET_NOT_FOUND), logged once; the removed row is not restored and is not left generating', async () => {
      const s = await venueSet();
      const during = latch(provider);
      const running = startBase(s.id);
      await during.reached;
      expect((await setRow(s.id)).generation_status).toBe('generating'); // the route's claim
      expect((await del(s.id)).status).toBe(200);
      during.release();
      const ended = await running;
      expectRefused(ended);
      expect(provider.calls).toHaveLength(1);
      const lines = orphanLines();
      expect(lines).toHaveLength(1);
      expect(lines[0]).toContain(`storage_keys=${puts()[0]}`);
      expect(lines[0]).toContain(`set=${s.id} outcome=SET_NOT_FOUND`);
      const row = await setRow(s.id);
      expect(row.deleted_at).not.toBeNull();
      expect(row.base_still_url).toBeNull();
      expect(row.generation_status).toBe('pending');
      expect(row.base_generation).toMatchObject({ last_error: `${GONE} ${NOT_SAVED}` });
      expect(storageDeletes()).toEqual([]);
      // The route does not mark it failed for this (a refusal is not a failed generation).
      await sleep(50);
      expect((await setRow(s.id)).generation_status).toBe('pending');
    });

    test('a regenerate over a previous image, "delete anyway" during the provider call: the previous image stays on the row and in storage (no delete call), the status is back to complete, the new picture is logged', async () => {
      const s = await venueSet({ previous: true });
      const during = latch(provider);
      const running = startBase(s.id);
      await during.reached;
      expect((await del(s.id)).status).toBe(200);
      during.release();
      expectRefused(await running);
      const row = await setRow(s.id);
      expect(row.deleted_at).not.toBeNull();
      expect(row.base_still_url).toBe(s.oldUrl);
      expect(row.generation_status).toBe('complete');
      expect(storageDeletes()).toEqual([]); // neither the previous image nor the new one
      expect(puts()).toHaveLength(1);
      expect(orphanLines()).toHaveLength(1);
      // None of the steps that follow a save ran: no review was recorded for a new base.
      expect(row.visual_language?.description_review).toBeUndefined();
    });

    test('[injected] the second line of defence: the locking read made to see the removed row, the final write then changes no row: the same refusal, nothing written', async () => {
      const s = await venueSet({ previous: true });
      const during = latch(provider);
      const running = startBase(s.id);
      await during.reached;
      expect((await del(s.id)).status).toBe(200);
      const real = sequelize.query.bind(sequelize);
      let altered = 0;
      jest.spyOn(sequelize, 'query').mockImplementation((sql, options) => {
        if (typeof sql === 'string' && /FROM scene_sets WHERE id = :id AND deleted_at IS NULL FOR NO KEY UPDATE/.test(sql)) {
          altered += 1;
          return real(sql.replace(' AND deleted_at IS NULL', ''), options);
        }
        return real(sql, options);
      });
      during.release();
      expectRefused(await running);
      expect(altered).toBe(1);
      expect((await setRow(s.id)).base_still_url).toBe(s.oldUrl);
      expect(storageDeletes()).toEqual([]);
      expect(orphanLines()).toHaveLength(1);
    });

    test('a run whose claim was taken over by a newer run before it was refused: what the existing statement does (the status has no owner on the row)', async () => {
      const s = await venueSet({ previous: true });
      const during = latch(provider);
      const running = startBase(s.id);
      await during.reached;
      expect((await del(s.id)).status).toBe(200);
      // A fresh claim is not taken again.
      expect(await generationClaim.claimRow(sequelize, 'set', s.id)).toBe(false);
      // The first run's claim gone stale (twenty minutes), a second run claims the row.
      await run("UPDATE scene_sets SET updated_at = NOW() - INTERVAL '2 hours' WHERE id = :id", { id: s.id });
      expect(await generationClaim.claimRow(sequelize, 'set', s.id)).toBe(true);
      during.release();
      expectRefused(await running);
      const row = await setRow(s.id);
      expect(row.deleted_at).not.toBeNull();
      expect(row.base_still_url).toBe(s.oldUrl);
      // OBSERVED, and as before this change for every refusal (Generation B1's
      // restoreBaseAfterRefusal: WHERE generation_status = 'generating'): the
      // first run puts the status back although the claim on it is by now the
      // second run's. The row carries no owner of its claim.
      expect(row.generation_status).toBe('complete');
    });
  });

  // ══ After a save that committed ════════════════════════════════════════
  describe('a delete that commits AFTER the save, inside each step that follows it: the run still ends as saved, nothing throws, and only the previous image is removed from storage', () => {
    /** A from_base angle of the set showing its previous base, so the angles are moved to the new base. */
    async function fromBaseAngle(s) {
      const id = fx.uuid();
      await run(`INSERT INTO scene_angles (id, scene_set_id, angle_name, angle_label, generation_status, still_image_url, quality_review, sort_order, created_at, updated_at)
                 VALUES (:id, :set, 'Inside', 'WIDE', 'complete', :url, CAST(:review AS jsonb), 0, NOW(), NOW())`,
      { id, set: s.id, url: s.oldUrl, review: JSON.stringify({ from_base: { url: s.oldUrl } }) });
      return id;
    }
    const savedAndRemoved = async (s, ended) => {
      expect(ended.ok).toBe(true);
      expect(ended.value).toMatchObject({ success: true, stillUrl: expect.stringContaining(`scene-sets/${s.id}/`) });
      const row = await setRow(s.id);
      expect(row.deleted_at).not.toBeNull();
      expect(row.base_still_url).toBe(ended.value.stillUrl);
      expect(row.generation_status).toBe('complete');
      expect(orphanLines()).toEqual([]);
      // The new picture is never deleted.
      expect(storageDeletes()).not.toContain(puts()[0]);
      return row;
    };

    test('during repointBaseAngles (the angles that are the base picture)', async () => {
      const s = await venueSet({ previous: true });
      const angle = await fromBaseAngle(s);
      const g = gateOn((rec, sql) => /^UPDATE scene_angles SET still_image_url = :newUrl/.test(sql));
      const running = startBase(s.id);
      await g.reached;
      // Removed with a replacement asked for nothing here: "delete anyway" (the angle is the set's own).
      expect((await del(s.id)).status).toBe(200);
      g.open();
      const row = await savedAndRemoved(s, await running);
      // It ran before the delete: the angle shows the new base.
      expect((await rows('SELECT still_image_url FROM scene_angles WHERE id = :angle', { angle }))[0].still_image_url).toBe(row.base_still_url);
      expect(storageDeletes()).toEqual([`scene-sets/${s.id}/stills/previous-base.jpg`]);
    });

    test('during deleteOldBaseImage (the previous image leaving storage)', async () => {
      const s = await venueSet({ previous: true });
      const during = latch(storage, 'holdDelete');
      const running = startBase(s.id);
      await during.reached;
      expect((await del(s.id)).status).toBe(200);
      during.release();
      await savedAndRemoved(s, await running);
      expect(storageDeletes()).toEqual([`scene-sets/${s.id}/stills/previous-base.jpg`]);
    });

    test('during noteBaseChanged (the description review): its write lands on the removed row and is harmless', async () => {
      const s = await venueSet({ previous: true });
      await run("UPDATE scene_sets SET canonical_description = 'A hall.', visual_language = CAST(:vl AS jsonb) WHERE id = :id",
        { id: s.id, vl: JSON.stringify({ description_source: 'analysis' }) });
      const g = gateOn((rec, sql) => !rec.txId && /^SELECT id, canonical_description, visual_language FROM scene_sets WHERE id = :id/.test(sql));
      const running = startBase(s.id);
      await g.reached;
      expect((await del(s.id)).status).toBe(200);
      g.open();
      await savedAndRemoved(s, await running);
    });

    test('during the style lock and the image analysis (the model double held): both writes land on the removed row; the run ends as saved', async () => {
      process.env.ANTHROPIC_API_KEY = 'test-anthropic';
      const s = await venueSet({ previous: true });
      const during = latch(model);
      const running = startBase(s.id);
      await during.reached;
      expect((await del(s.id)).status).toBe(200);
      during.release();
      const row = await savedAndRemoved(s, await running);
      expect(model.calls).toBeGreaterThanOrEqual(1);
      await sleep(100);
      const after = await setRow(s.id);
      expect(after.deleted_at).not.toBeNull();
      expect(after.base_still_url).toBe(row.base_still_url);
      expect(errorLines().join('\n')).not.toMatch(/Instance could not be reloaded/);
    });
  });

  describe('the network guard', () => {
    test('no external network attempt in this file', () => {
      const mine = networkGuard.getState().events.slice(guardEventsAtStart);
      expect(mine.filter((e) => e.type === 'attempt')).toEqual([]);
    });
  });
});
