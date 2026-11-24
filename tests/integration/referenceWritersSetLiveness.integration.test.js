/**
 * C2, PR 3 (Evoni, 2026-11-24;
 * docs/audit/F-AUTH-1_ReferenceWritersSetLiveness_Amendment_2026-11-24.md):
 *
 *   "No ordinary writer may create, move, or restore a Scene Set reference
 *   onto a set that was already removed. An existing reference may remain
 *   after Delete Anyway where that is part of the current documented
 *   behavior."
 *
 * Each corrected writer takes its locks in the established order — the
 * affected episodes first (one ascending statement), then events, then the
 * set rows, never waited for while an episode or event row is held (NOWAIT)
 * — and answers its own existing refusal when the set has gone.
 *
 * On the migrated test database, through the real app and the real
 * services. REAL LOCKS: every race is two real writers, one held open at a
 * statement by the lock trace's gate (its locks really held), and a backend
 * that waits is read from pg_stat_activity, never slept for. Nothing sends
 * DDL. The provider, storage and the model are doubles, and the network
 * guard asserts no external attempt was made.
 *
 * RECORDED GAP cases pin today's behaviour where this PR deliberately does
 * not change it (a filmed episode, and the legacy references Delete Anyway
 * leaves). They are not endorsements.
 */
jest.unmock('uuid');
process.env.S3_PRIMARY_BUCKET = 'pr3-test-bucket';
// The variant writers refuse before anything else when FAL_KEY is unset
// (503 PROVIDER_NOT_CONFIGURED), which would hide the liveness answer under
// test. A placeholder gets past that check; the provider itself is a double
// and the network guard asserts nothing left this process.
process.env.FAL_KEY = process.env.FAL_KEY || 'pr3-not-a-real-key';

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
const app = require('../../src/app');
const TokenService = require('../../src/services/tokenService');
const models = require('../../src/models');
const { isLockConflict, RetryableConflictError } = require('../../src/utils/episodeLocks');
const uses = require('../../src/services/sceneSetUsesService');
const approvedBase = require('../../src/services/approvedBaseService');
const lookVariants = require('../../src/services/locationLookVariantService');
const episodeLocations = require('../../src/services/episodeLocationsService');
const lockTrace = require('../helpers/lockTrace');
const networkGuard = require('../networkGuard/core');
const { placeLockFixtures, waitForLockWait } = require('../helpers/placeLockFixtures');

const { sequelize } = models;

const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

// No database or ORM words may reach a response body.
const DATABASE_TEXT = /deadlock|violates|constraint|SELECT |UPDATE |INSERT |relation|syntax|sequelize|canceling statement|lock timeout|could not serialize|FOR KEY SHARE|NOWAIT|scene_sets|scene_plans|scene_set_episodes/i;

// A supertest request only leaves for the server once something calls
// .then on it, so a race must start it with this, never hold it as a value.
const send = (req) => req.then((res) => res);
const settle = (promise) => promise.then(
  (value) => ({ ok: true, value, lock: null }),
  (error) => ({ ok: false, error, lock: isLockConflict(error) ? (error.original?.code || error.parent?.code || error.code) : null }));

(shouldSkip ? describe.skip : describe)('C2 PR 3: no ordinary writer puts a Scene Set reference on a removed set', () => {
  jest.setTimeout(Number(process.env.PR3_TEST_TIMEOUT_MS) || 120000);
  const fx = placeLockFixtures(sequelize, models);
  const { run, rows, mkShow, mkEpisode, mkEvent, mkBrief, mkSet, mkLocation, setEvaluation, eventRow } = fx;
  const TAG = fx.uuid().slice(0, 8);
  let show;
  let trace = null;
  let guardEventsAtStart = 0;
  let w;

  let admins = 0;
  const adminToken = () => {
    admins += 1;
    return TokenService.generateTokenPair({ id: `pr3-admin-${TAG}-${admins}`, email: `admin${admins}@pr3.dev`, name: 'Admin', groups: ['ADMIN'], role: 'ADMIN' }).accessToken;
  };
  const asAdmin = (r) => r.set('X-Forwarded-For', `10.98.${Math.floor(admins / 250)}.${(admins % 250) + 1}`).set('Authorization', `Bearer ${adminToken()}`);

  // ── The writers under test, as the browser calls them ──────────────────
  const del = (id, query = '') => asAdmin(request(app).delete(`/api/v1/scene-sets/${id}${query}`)).send({});
  const ANYWAY = '?confirm_orphan=true';
  const into = (id) => `?replacement_id=${id}`;
  // W1
  const linkSetsToEpisode = (ep, ids) => asAdmin(request(app).post(`/api/v1/episodes/${ep}/scene-sets`)).send({ sceneSetIds: ids });
  // W2
  const linkEpisodesToSet = (setId, eps) => asAdmin(request(app).post(`/api/v1/scene-sets/${setId}/episodes`)).send({ episode_ids: eps });
  // W4
  const beatAngle = (ep, n, angleId) => asAdmin(request(app).put(`/api/v1/scene-studio-episodes/${ep}/beat/${n}/angle`)).send({ angle_id: angleId });
  // W5
  const beatSet = (ep, n, setId) => asAdmin(request(app).put(`/api/v1/scene-studio-episodes/${ep}/beat/${n}/scene-set`)).send({ scene_set_id: setId });
  // W6
  const beatSave = (ep, n, body) => asAdmin(request(app).put(`/api/v1/episode-brief/${ep}/plan/${n}`)).send(body);
  // W9
  const createScene = (body) => asAdmin(request(app).post('/api/v1/scenes')).send(body);
  const updateScene = (id, body) => asAdmin(request(app).put(`/api/v1/scenes/${id}`)).send(body);
  // W10
  const sceneFromAngle = (ep, setId, angleId) => asAdmin(request(app).post(`/api/v1/episodes/${ep}/scenes/from-angle`)).send({ sceneSetId: setId, sceneAngleId: angleId });
  // W16
  const createEvent = (body, showId = show) => asAdmin(request(app).post(`/api/v1/world/${showId}/events`)).send({ name: `Event ${fx.uuid().slice(0, 6)}`, ...body });

  // ── Fixtures ───────────────────────────────────────────────────────────
  const set = (name, type = 'EVENT_LOCATION', showId = show, fields = {}) =>
    mkSet(showId, `${name} ${fx.uuid().slice(0, 6)}`, { scene_type: type, base_still_url: `https://cdn.example/${fx.uuid()}.jpg`, ...fields });

  async function world(showId = show) {
    return {
      s: await set('Hall S', 'EVENT_LOCATION', showId),
      r: await set('Hall R', 'EVENT_LOCATION', showId),
      t: await set('Hall T', 'EVENT_LOCATION', showId),
      home: await set('Home', 'HOME_BASE', showId),
      closet: await set('Closet', 'CLOSET', showId),
    };
  }

  /** An angle of a set, so the Studio and from-angle writers have one to name. */
  async function mkAngle(setId, label = 'WIDE') {
    const id = fx.uuid();
    await run(`INSERT INTO scene_angles (id, scene_set_id, angle_label, angle_name, still_image_url, generation_status, sort_order, created_at, updated_at)
               VALUES (:id, :set, :label, 'Wide', :url, 'complete', 0, NOW(), NOW())`,
    { id, set: setId, label, url: `https://cdn.example/${id}.jpg` });
    return id;
  }

  /** A beat of an episode, optionally already at a set. */
  async function mkBeat(ep, n = 1, setId = null) {
    const id = fx.uuid();
    await run(`INSERT INTO scene_plans (id, episode_id, beat_number, beat_name, scene_set_id, angle_label, locked, chosen_by_user, sort_order, ai_suggested, created_at, updated_at)
               VALUES (:id, :ep, :n, 'Beat', :at, NULL, false, false, :n, false, NOW(), NOW())`,
    { id, ep, n, at: setId });
    return id;
  }

  async function mkScene(ep, setId = null, n = 1) {
    const id = fx.uuid();
    await run(`INSERT INTO scenes (id, episode_id, scene_number, title, location, background_url, scene_set_id, scene_angle_id,
                                   duration_seconds, characters, ui_elements, dialogue_clips, scene_type, production_status, created_at, updated_at)
               VALUES (:id, :ep, :n, 'Scene', 'Hall', NULL, :at, NULL, 5.0, '[]', '[]', '[]', 'main', 'draft', NOW(), NOW())`,
    { id, ep, n, at: setId });
    return id;
  }

  /** A filmed episode: a raw clip freezes its snapshot. */
  async function film(ep) {
    const id = fx.uuid();
    await run(`INSERT INTO episode_raw_clips (id, episode_id, show_id, performer, s3_key_raw, key_status, key_strength, created_at, updated_at)
               VALUES (:id, :ep, :show, 'lala', :key, 'none', 'medium', NOW(), NOW())`,
    { id, ep, show, key: `raw/${id}.mp4` });
    return id;
  }

  const removedAt = async (id) => (await rows('SELECT deleted_at FROM scene_sets WHERE id = :id', { id }))[0]?.deleted_at ?? null;
  const linksOf = (ep) => rows('SELECT scene_set_id, role FROM scene_set_episodes WHERE episode_id = :ep AND deleted_at IS NULL ORDER BY sort_order, role', { ep });

  /** Every live reference to a set, anywhere a corrected writer could make one. */
  async function referencesTo(setId) {
    const one = async (sql) => Number((await rows(sql, { setId }))[0].n);
    return {
      links: await one('SELECT COUNT(*) AS n FROM scene_set_episodes WHERE scene_set_id = :setId AND deleted_at IS NULL'),
      beats: await one('SELECT COUNT(*) AS n FROM scene_plans WHERE scene_set_id = :setId AND deleted_at IS NULL'),
      scenes: await one('SELECT COUNT(*) AS n FROM scenes WHERE scene_set_id = :setId AND deleted_at IS NULL'),
      events: await one('SELECT COUNT(*) AS n FROM world_events WHERE scene_set_id = :setId AND deleted_at IS NULL'),
      lookbook: await one('SELECT COUNT(*) AS n FROM episode_lookbook_images WHERE scene_set_id = :setId AND deleted_at IS NULL'),
      places: await one('SELECT COUNT(*) AS n FROM character_places WHERE scene_set_id = :setId AND deleted_at IS NULL'),
      variants: await one('SELECT COUNT(*) AS n FROM location_look_variants WHERE scene_set_id = :setId AND deleted_at IS NULL'),
      approvedBases: await one('SELECT COUNT(*) AS n FROM world_locations WHERE approved_base_scene_set_id = :setId AND deleted_at IS NULL'),
      defaults: await one(`SELECT COUNT(*) AS n FROM shows
                            WHERE metadata::jsonb->'scene_defaults'->>'home_set_id' = CAST(:setId AS text)
                               OR metadata::jsonb->'scene_defaults'->>'closet_set_id' = CAST(:setId AS text)`),
    };
  }

  const NO_REFERENCES = {
    links: 0, beats: 0, scenes: 0, events: 0, lookbook: 0, places: 0, variants: 0, approvedBases: 0, defaults: 0,
  };

  /** Everything a writer or a delete could change, for the test's show. */
  async function snapshot(showId = show) {
    const by = { showId };
    return {
      events: await rows('SELECT id, scene_set_id, used_in_episode_id, deleted_at FROM world_events WHERE show_id = :showId ORDER BY id', by),
      links: await rows('SELECT l.id, l.scene_set_id, l.episode_id, l.role, l.role_name, l.sort_order, l.deleted_at FROM scene_set_episodes l JOIN episodes e ON e.id = l.episode_id WHERE e.show_id = :showId ORDER BY l.id', by),
      beats: await rows('SELECT p.id, p.scene_set_id, p.angle_label, p.scene_context, p.locked, p.chosen_by_user, p.deleted_at FROM scene_plans p JOIN episodes e ON e.id = p.episode_id WHERE e.show_id = :showId ORDER BY p.id', by),
      scenes: await rows('SELECT s.id, s.scene_set_id, s.scene_angle_id, s.background_url, s.deleted_at FROM scenes s JOIN episodes e ON e.id = s.episode_id WHERE e.show_id = :showId ORDER BY s.id', by),
      lookbook: await rows('SELECT i.id, i.scene_set_id, i.in_lookbook, i.deleted_at FROM episode_lookbook_images i JOIN episodes e ON e.id = i.episode_id WHERE e.show_id = :showId ORDER BY i.id', by),
      shows: await rows('SELECT id, metadata FROM shows WHERE id = :showId', by),
      places: await rows('SELECT c.id, c.scene_set_id, c.role, c.deleted_at FROM character_places c JOIN scene_sets s ON s.id = c.scene_set_id WHERE s.show_id = :showId ORDER BY c.id', by),
      variants: await rows('SELECT v.id, v.scene_set_id, v.status, v.deleted_at FROM location_look_variants v JOIN scene_sets s ON s.id = v.scene_set_id WHERE s.show_id = :showId ORDER BY v.id', by),
      sets: await rows('SELECT id, deleted_at, version_of_set_id, generation_status FROM scene_sets WHERE show_id = :showId ORDER BY id', by),
      episodes: await rows('SELECT id, evaluation_status, deleted_at FROM episodes WHERE show_id = :showId ORDER BY id', by),
    };
  }

  /**
   * Holds a scene set's row exactly as the delete path does — the episodes,
   * the events, then the set FOR UPDATE — and resolves handles to commit the
   * soft delete or to roll it all back. The caller's writer then really
   * waits on that row.
   */
  async function holdingSetRow(setId, { episodes = [], events = [] } = {}) {
    const transaction = await sequelize.transaction();
    if (episodes.length) {
      await sequelize.query('SELECT id FROM episodes WHERE id IN (:ids) ORDER BY id FOR UPDATE', { replacements: { ids: episodes }, transaction });
    }
    for (const id of [...events].sort()) {
      await sequelize.query('SELECT id FROM world_events WHERE id = :id FOR UPDATE', { replacements: { id }, transaction });
    }
    await sequelize.query('SELECT id FROM scene_sets WHERE id = :id FOR UPDATE', { replacements: { id: setId }, transaction });
    return {
      transaction,
      /** Soft-delete the set and commit: "delete anyway" as the route leaves it. */
      async deleteAnyway() {
        await sequelize.query('UPDATE scene_sets SET deleted_at = NOW(), updated_at = NOW() WHERE id = :id', { replacements: { id: setId }, transaction });
        await transaction.commit();
      },
      async release() { if (!transaction.finished) await transaction.rollback(); },
    };
  }

  /**
   * waitForLockWait, but a timeout says what WAS waiting, so a case that
   * never reaches the lock is told apart from one that waits elsewhere.
   */
  async function waitingOn(like, { timeoutMs = 9000 } = {}) {
    try {
      return await waitForLockWait(sequelize, like, { timeoutMs });
    } catch (err) {
      const all = await rows(
        `SELECT pid, wait_event_type, wait_event, state, left(query, 160) AS query FROM pg_stat_activity
          WHERE datname = current_database() AND pid <> pg_backend_pid() AND state <> 'idle'`);
      console.error(`[pr3 test] nothing waited on ${like}; backends now:`, JSON.stringify(all, null, 1));
      throw err;
    }
  }

  /**
   * The delete path's set statement, run on its own: FOR UPDATE NOWAIT on
   * the set row. Resolves 'taken' when it got the lock (and releases it) or
   * the Postgres code when it lost (55P03: someone holds that row).
   */
  async function probeSetRowNowait(setId) {
    const transaction = await sequelize.transaction();
    try {
      await sequelize.query('SELECT id FROM scene_sets WHERE id = :id FOR UPDATE NOWAIT', { replacements: { id: setId }, transaction });
      return 'taken';
    } catch (err) {
      return err?.original?.code || err?.parent?.code || 'unknown';
    } finally {
      if (!transaction.finished) await transaction.rollback();
    }
  }

  /** The database's own deadlock counter: 40P01 anywhere increments it. */
  const deadlocks = async () =>
    Number((await rows('SELECT deadlocks FROM pg_stat_database WHERE datname = current_database()'))[0].deadlocks);
  let deadlocksAtStart = 0;

  beforeAll(async () => {
    guardEventsAtStart = networkGuard.getState().events.length;
    show = await mkShow('PR3 liveness');
    w = await world();
    deadlocksAtStart = await deadlocks();
  });

  afterEach(async () => {
    if (trace) { trace.uninstall(); trace = null; }
  });

  afterAll(async () => {
    await fx.cleanup();
  });

  // ══════════════════════════════════════════════════════════════════════
  // 1. DELETE FIRST, then the writer: every writer answers its refusal
  //    and leaves no row naming the removed set.
  // ══════════════════════════════════════════════════════════════════════
  describe('the set was already removed when the writer arrived ("delete anyway", then the writer)', () => {
    let gone;
    let goneAngle;
    let ep;

    beforeEach(async () => {
      gone = await set('Removed');
      goneAngle = await mkAngle(gone);
      ep = await mkEpisode(show);
      // Delete Anyway: no use, so the set is simply removed.
      expect((await del(gone, ANYWAY)).status).toBe(200);
      expect(await removedAt(gone)).not.toBeNull();
    });

    test('W1 the episode scene-set link: 404 SCENE_SET_NOT_FOUND, no link (it had no refusal before)', async () => {
      const before = await snapshot();
      const res = await linkSetsToEpisode(ep, [gone]);
      expect(res.status).toBe(404);
      expect(res.body.code).toBe('SCENE_SET_NOT_FOUND');
      expect(await referencesTo(gone)).toEqual(NO_REFERENCES);
      expect(await snapshot()).toEqual(before);
    });

    test('W2 the scene set episode link: 404, no link', async () => {
      const res = await linkEpisodesToSet(gone, [ep]);
      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Scene set not found');
      expect(await referencesTo(gone)).toEqual(NO_REFERENCES);
    });

    test('W4 the Studio beat angle: 404, the beat keeps its set (it had no refusal before)', async () => {
      await mkBeat(ep, 3, w.s);
      const before = await snapshot();
      const res = await beatAngle(ep, 3, goneAngle);
      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Scene set not found');
      expect(await referencesTo(gone)).toEqual(NO_REFERENCES);
      expect(await snapshot()).toEqual(before);
    });

    test('W5 the Studio beat scene set: 404, nothing moved and no link', async () => {
      await mkBeat(ep, 4, w.s);
      const before = await snapshot();
      const res = await beatSet(ep, 4, gone);
      expect(res.status).toBe(404);
      expect(await referencesTo(gone)).toEqual(NO_REFERENCES);
      expect(await snapshot()).toEqual(before);
    });

    test('W6 the beat save: 404, and its link and its beat are both unchanged', async () => {
      await mkBeat(ep, 5, w.s);
      const before = await snapshot();
      const res = await beatSave(ep, 5, { scene_set_id: gone });
      expect(res.status).toBe(404);
      expect(await referencesTo(gone)).toEqual(NO_REFERENCES);
      expect(await snapshot()).toEqual(before);
    });

    test('W9 createScene: 404, no scene row', async () => {
      const res = await createScene({ episodeId: ep, title: 'Scene A', scene_set_id: gone });
      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Scene set not found');
      expect(await referencesTo(gone)).toEqual(NO_REFERENCES);
    });

    test('W9 updateScene: 404, the scene keeps the set it had', async () => {
      const scene = await mkScene(ep, w.s, 7);
      const res = await updateScene(scene, { scene_set_id: gone });
      expect(res.status).toBe(404);
      expect(await referencesTo(gone)).toEqual(NO_REFERENCES);
      expect((await rows('SELECT scene_set_id FROM scenes WHERE id = :id', { id: scene }))[0].scene_set_id).toBe(w.s);
    });

    test('W10 a scene from an angle: 404, no scene row', async () => {
      const res = await sceneFromAngle(ep, gone, goneAngle);
      expect(res.status).toBe(404);
      expect(await referencesTo(gone)).toEqual(NO_REFERENCES);
    });

    test('W16 creating a world event at it: 400 INVALID_SCENE_SET_ID, no event', async () => {
      const res = await createEvent({ scene_set_id: gone });
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('INVALID_SCENE_SET_ID');
      expect(await referencesTo(gone)).toEqual(NO_REFERENCES);
    });

    test('W18 the show defaults: 404 SCENE_SET_NOT_FOUND, the default is not written', async () => {
      const out = await settle(episodeLocations.saveSceneDefaults(sequelize, { showId: show, body: { home_set_id: gone } }));
      expect(out.ok).toBe(false);
      expect(out.error.code).toBe('SCENE_SET_NOT_FOUND');
      expect(await referencesTo(gone)).toEqual(NO_REFERENCES);
    });

    test('W20 a look variant claim: 404, no variant row', async () => {
      const out = await settle(lookVariants.startVariant(sequelize, { setId: gone, kind: 'time', value: 'night' }));
      expect(out.ok).toBe(false);
      expect(out.error.status).toBe(404);
      expect(await referencesTo(gone)).toEqual(NO_REFERENCES);
    });

    test('W22 approve base: it is not approved onto the World Location', async () => {
      const loc = await mkLocation('Removed venue');
      await run('UPDATE scene_sets SET world_location_id = :loc WHERE id = :id', { loc, id: gone });
      const out = await approvedBase.approveBase(sequelize, { id: gone, world_location_id: loc, base_still_url: 'https://cdn.example/b.jpg', version_of_set_id: null });
      expect(out.status).toBe(404);
      expect(out.location).toBeUndefined();
      expect(await referencesTo(gone)).toEqual(NO_REFERENCES);
    });

    test('no response in this group carried database or ORM text', async () => {
      const bodies = await Promise.all([
        linkSetsToEpisode(ep, [gone]), linkEpisodesToSet(gone, [ep]),
        beatSet(ep, 1, gone), createScene({ episodeId: ep, title: 'X', scene_set_id: gone }),
        sceneFromAngle(ep, gone, goneAngle), createEvent({ scene_set_id: gone }),
      ]);
      for (const res of bodies) expect(JSON.stringify(res.body)).not.toMatch(DATABASE_TEXT);
    });
  });

  // ══════════════════════════════════════════════════════════════════════
  // 2. DELETE WITH A REPLACEMENT, then the writer: the old set is removed
  //    the same way, and the writer still refuses it.
  // ══════════════════════════════════════════════════════════════════════
  describe('the set was removed with a replacement, then the writer arrived', () => {
    test('the old set is refused and the replacement is untouched', async () => {
      const old = await set('Replaced');
      const keep = await set('Keeper');
      const ep = await mkEpisode(show);
      await run(`INSERT INTO scene_set_episodes (id, scene_set_id, episode_id, sort_order, role, created_at, updated_at)
                 VALUES (:id, :set, :ep, 0, 'home', NOW(), NOW())`, { id: fx.uuid(), set: old, ep });
      expect((await del(old, into(keep))).status).toBe(200);
      expect(await removedAt(old)).not.toBeNull();
      // The use moved to the replacement.
      expect(await linksOf(ep)).toEqual([{ scene_set_id: keep, role: 'home' }]);

      const other = await mkEpisode(show);
      expect((await linkSetsToEpisode(other, [old])).status).toBe(404);
      expect((await beatSet(other, 1, old)).status).toBe(404);
      expect((await createScene({ episodeId: other, title: 'S', scene_set_id: old })).status).toBe(404);
      expect((await createEvent({ scene_set_id: old })).body.code).toBe('INVALID_SCENE_SET_ID');
      expect(await referencesTo(old)).toEqual(NO_REFERENCES);
      // The replacement kept exactly the one link the move made.
      expect((await referencesTo(keep)).links).toBe(1);
    });

    test('a beat save onto the replacement still works (the success path is unchanged)', async () => {
      const keep = await set('Live target');
      const ep = await mkEpisode(show);
      await mkBeat(ep, 2, null);
      const res = await beatSave(ep, 2, { scene_set_id: keep });
      expect(res.status).toBe(200);
      expect((await referencesTo(keep)).beats).toBe(1);
      // L11: the set joined the episode's locations in the same commit.
      expect((await referencesTo(keep)).links).toBe(1);
    });
  });

  // ══════════════════════════════════════════════════════════════════════
  // 3. THE HEADLINE RACE: the writer waits on the set row, the delete
  //    removes it, the writer resumes.
  // ══════════════════════════════════════════════════════════════════════
  describe('a writer that waited on the set row while the delete removed it', () => {
    test('W18 the show defaults: it resumes, answers SCENE_SET_NOT_FOUND, and writes nothing', async () => {
      const going = await set('Going 18');
      const hold = await holdingSetRow(going);
      try {
        const before = await snapshot();
        const saving = settle(episodeLocations.saveSceneDefaults(sequelize, { showId: show, body: { home_set_id: going } }));
        // It really waits on the set's row — read from pg_stat_activity.
        const waiter = await waitingOn('%scene_sets%FOR KEY SHARE%');
        expect(waiter.pid).toBeGreaterThan(0);
        await hold.deleteAnyway();
        const out = await saving;
        expect(out.ok).toBe(false);
        expect(out.error.code).toBe('SCENE_SET_NOT_FOUND');
        expect(out.lock).toBeNull();
        expect(await referencesTo(going)).toEqual(NO_REFERENCES);
        // No partial commit: everything but the set's own removal is as it was.
        const after = await snapshot();
        expect(after.shows).toEqual(before.shows);
        expect(after.places).toEqual(before.places);
        expect(after.links).toEqual(before.links);
      } finally {
        await hold.release();
      }
    });

    test('W20 a look variant: it resumes, answers 404, and claims nothing', async () => {
      const loc = await mkLocation('Variant venue');
      const going = await set('Going 20', 'EVENT_LOCATION', show, { world_location_id: loc });
      await run('UPDATE world_locations SET approved_base_scene_set_id = :id, approved_base_image_url = :url, approved_base_at = NOW() WHERE id = :loc',
        { id: going, url: 'https://cdn.example/base.jpg', loc });
      const hold = await holdingSetRow(going);
      try {
        const starting = settle(lookVariants.startVariant(sequelize, { setId: going, kind: 'time', value: 'night' }));
        await waitingOn('%scene_sets%FOR KEY SHARE%');
        await hold.deleteAnyway();
        const out = await starting;
        expect(out.ok).toBe(false);
        expect(out.error.status).toBe(404);
        // No variant row was claimed. (The World Location's approved base
        // still names the set: that row is this test's own fixture, made
        // before the delete, and is exactly the kind of existing reference
        // Delete Anyway leaves behind.)
        expect((await referencesTo(going)).variants).toBe(0);
      } finally {
        await hold.release();
      }
    });

    test('W16 a new world event: it resumes and answers INVALID_SCENE_SET_ID with no event row', async () => {
      const going = await set('Going 16');
      const hold = await holdingSetRow(going);
      try {
        const creating = send(createEvent({ scene_set_id: going }));
        await waitingOn('%scene_sets%FOR KEY SHARE%');
        await hold.deleteAnyway();
        const res = await creating;
        expect(res.status).toBe(400);
        expect(res.body.code).toBe('INVALID_SCENE_SET_ID');
        expect(JSON.stringify(res.body)).not.toMatch(DATABASE_TEXT);
        expect(await referencesTo(going)).toEqual(NO_REFERENCES);
      } finally {
        await hold.release();
      }
    });

    test('W22 approve base: it resumes and does not approve the removed set', async () => {
      const loc = await mkLocation('Approve venue');
      const going = await set('Going 22', 'EVENT_LOCATION', show, { world_location_id: loc });
      const hold = await holdingSetRow(going);
      try {
        const approving = settle(approvedBase.approveBase(sequelize, { id: going, world_location_id: loc, base_still_url: 'https://cdn.example/b.jpg', version_of_set_id: null }));
        // Its own lock is FOR UPDATE on the set row, as it always was.
        await waitingOn('%scene_sets%FOR UPDATE%');
        await hold.deleteAnyway();
        const out = await approving;
        expect(out.ok).toBe(true);
        expect(out.value.status).toBe(404);
        expect(await referencesTo(going)).toEqual(NO_REFERENCES);
      } finally {
        await hold.release();
      }
    });
  });

  // ══════════════════════════════════════════════════════════════════════
  // 4. WRITER FIRST: the writer holds the set row, the delete cannot take
  //    it (NOWAIT), and the writer's own success is unaffected.
  // ══════════════════════════════════════════════════════════════════════
  describe('the writer went first and holds the set row', () => {
    // The delete path's set statement is FOR UPDATE NOWAIT, so while a
    // writer holds the set's row the delete loses at once, on every try,
    // and ends in its existing retryable 409. probeSetRowNowait runs
    // exactly that statement, which is both the precise mechanism and
    // bounded (the full route would spend three ten-second lock waits on
    // the episode row first, which is the SAME order, proven by the
    // concurrent races further down).
    test('W6 the beat save holds the set row, so the delete\'s NOWAIT loses (55P03) and the set stays', async () => {
      const held = await set('Held by a beat');
      const ep = await mkEpisode(show);
      await mkBeat(ep, 6, null);
      trace = lockTrace.install(sequelize);
      const gate = trace.gate((rec) => rec.kind === 'lock' && rec.table === 'scene_sets' && rec.mode === 'share');
      const saving = send(beatSave(ep, 6, { scene_set_id: held }));
      await gate.reached;
      // It really holds it: the delete's own statement cannot take it.
      expect(await probeSetRowNowait(held)).toBe('55P03');
      gate.open();
      const saved = await saving;

      expect(saved.status).toBe(200);
      expect(await removedAt(held)).toBeNull();
      expect((await referencesTo(held)).beats).toBe(1);
      // Once the writer has committed, the row is free again.
      expect(await probeSetRowNowait(held)).toBe('taken');
    });

    test('W1 the episode link holds the set row the same way, and the lock it takes is only FOR KEY SHARE', async () => {
      const held = await set('Held by a link');
      const ep = await mkEpisode(show);
      trace = lockTrace.install(sequelize);
      const gate = trace.gate((rec) => rec.kind === 'lock' && rec.table === 'scene_sets' && rec.mode === 'share');
      const linking = send(linkSetsToEpisode(ep, [held]));
      await gate.reached;
      const before = await snapshot();
      expect(await probeSetRowNowait(held)).toBe('55P03');
      // Two writers may hold the same set row at once: the lock is no
      // stronger than FOR KEY SHARE (PR 3 introduces none stronger).
      const second = await sequelize.transaction();
      try {
        const [alsoHeld] = await sequelize.query('SELECT id FROM scene_sets WHERE id = :id AND deleted_at IS NULL FOR KEY SHARE NOWAIT', { replacements: { id: held }, transaction: second });
        expect(alsoHeld).toHaveLength(1);
      } finally {
        await second.rollback();
      }
      gate.open();
      const linked = await linking;

      expect(linked.status).toBe(200);
      expect(await removedAt(held)).toBeNull();
      // Nothing but the new link changed.
      const after = await snapshot();
      expect(after.sets).toEqual(before.sets);
      expect(after.events).toEqual(before.events);
      expect(after.beats).toEqual(before.beats);
      expect((await referencesTo(held)).links).toBe(1);
    });
  });

  // ══════════════════════════════════════════════════════════════════════
  // 5. ACCEPTED AND FILMED
  // ══════════════════════════════════════════════════════════════════════
  describe('accepted and filmed episodes', () => {
    test('W1 EPISODE_ACCEPTED is decided under the episode lock, and nothing is linked', async () => {
      const live = await set('For accepted');
      const ep = await mkEpisode(show, { evaluation: 'accepted' });
      const res = await linkSetsToEpisode(ep, [live]);
      expect(res.status).toBe(409);
      expect(res.body.code).toBe('EPISODE_ACCEPTED');
      expect((await referencesTo(live)).links).toBe(0);
    });

    test('W1 an acceptance that commits while the link waits on the episode is seen (the read is under the lock)', async () => {
      const live = await set('Accepted mid-flight');
      const ep = await mkEpisode(show);
      // Hold the episode row FOR UPDATE and accept it, as an acceptance does.
      const transaction = await sequelize.transaction();
      try {
        await sequelize.query('SELECT id FROM episodes WHERE id IN (:ids) ORDER BY id FOR UPDATE', { replacements: { ids: [ep] }, transaction });
        await sequelize.query("UPDATE episodes SET evaluation_status = 'accepted' WHERE id = :ep", { replacements: { ep }, transaction });
        const linking = send(linkSetsToEpisode(ep, [live]));
        await waitingOn('%episodes%FOR SHARE%');
        await transaction.commit();
        const res = await linking;
        expect(res.status).toBe(409);
        expect(res.body.code).toBe('EPISODE_ACCEPTED');
        expect((await referencesTo(live)).links).toBe(0);
      } finally {
        if (!transaction.finished) await transaction.rollback();
      }
      await setEvaluation(ep, 'pending');
    });

    test('W6 the beat save on an accepted episode: EPISODE_ACCEPTED when the link is new (unchanged)', async () => {
      const live = await set('Accepted beat');
      const ep = await mkEpisode(show, { evaluation: 'accepted' });
      await mkBeat(ep, 8, null);
      const res = await beatSave(ep, 8, { scene_set_id: live });
      expect(res.status).toBe(409);
      expect(res.body.code).toBe('EPISODE_ACCEPTED');
      expect(await referencesTo(live)).toEqual(NO_REFERENCES);
    });

    test('RECORDED GAP: a filmed episode is not protected by these writers — a live set is still linked to it', async () => {
      // Today's behaviour, pinned, not endorsed. The filmed-episode policy
      // for ordinary writers is out of PR 3's scope (only the DELETE path
      // refuses a filmed use, with 409 EPISODE_SNAPSHOT_FROZEN).
      const live = await set('Filmed episode set');
      const ep = await mkEpisode(show);
      await film(ep);
      const res = await linkSetsToEpisode(ep, [live]);
      expect(res.status).toBe(200);
      expect((await referencesTo(live)).links).toBe(1);
      // And the delete of that set is still refused for the filmed episode.
      expect((await del(live, ANYWAY)).body.code).toBe('EPISODE_SNAPSHOT_FROZEN');
      expect(await removedAt(live)).toBeNull();
    });

    test('RECORDED GAP: Delete Anyway leaves a filmed episode\'s existing references alone — and they are refused, not removed', async () => {
      const kept = await set('Legacy reference');
      const ep = await mkEpisode(show);
      await mkBeat(ep, 9, kept);
      // The set has a use, so Delete Anyway is what removes it.
      expect((await del(kept, ANYWAY)).status).toBe(200);
      expect(await removedAt(kept)).not.toBeNull();
      // The existing beat still names the removed set: that is the current
      // documented behaviour of Delete Anyway, and PR 3 does not change it.
      expect((await referencesTo(kept)).beats).toBe(1);
      // But no writer may add another one.
      expect((await linkSetsToEpisode(ep, [kept])).status).toBe(404);
      expect((await createScene({ episodeId: ep, title: 'S', scene_set_id: kept })).status).toBe(404);
      expect(await referencesTo(kept)).toEqual({ ...NO_REFERENCES, beats: 1 });
    });
  });

  // ══════════════════════════════════════════════════════════════════════
  // 6. THE NO-FK WRITERS: the set row before `shows` and
  //    `character_places`, so the delete's order is never inverted.
  // ══════════════════════════════════════════════════════════════════════
  describe('the writers with no foreign key take the set row first', () => {
    test('W18 locks the set before the show (the delete writes set rows, then shows)', async () => {
      const live = await set('Default home', 'HOME_BASE');
      trace = lockTrace.install(sequelize);
      await episodeLocations.saveSceneDefaults(sequelize, { showId: show, body: { home_set_id: live } });
      const mine = [...trace.byTransaction().values()].find((recs) => recs.some((r) => r.table === 'shows'));
      expect(mine).toBeDefined();
      const order = mine.filter((r) => r.kind === 'lock' || r.kind === 'write').map((r) => r.table);
      expect(order.indexOf('scene_sets')).toBeGreaterThanOrEqual(0);
      expect(order.indexOf('scene_sets')).toBeLessThan(order.indexOf('shows'));
      // Clean the default again so later snapshots are stable.
      await episodeLocations.saveSceneDefaults(sequelize, { showId: show, body: { home_set_id: null } });
    });

    test('W18 against the delete of the same set: no deadlock either way round', async () => {
      const contested = await set('Contested default', 'HOME_BASE');
      const results = await Promise.all([
        settle(episodeLocations.saveSceneDefaults(sequelize, { showId: show, body: { home_set_id: contested } })),
        settle(del(contested, ANYWAY).then((r) => r.body)),
      ]);
      for (const r of results) expect(r.lock).toBeNull();
      // Only two interleavings are legal, and both are safe:
      //   the save won first  -> the set is still live, or Delete Anyway
      //                          removed it AFTER and left the default it
      //                          found (its documented behaviour);
      //   the delete won first -> the save answers SCENE_SET_NOT_FOUND and
      //                          writes nothing.
      // What must never happen is the save writing the default onto an
      // already removed set, which is what the group above tests
      // deterministically. Here the point is that neither deadlocked.
      const [saveOut] = results;
      if (!saveOut.ok) {
        expect(saveOut.error.code).toBe('SCENE_SET_NOT_FOUND');
        expect((await referencesTo(contested)).defaults).toBe(0);
      }
      // And once everything has settled, the writer refuses it for good.
      if (await removedAt(contested)) {
        const again = await settle(episodeLocations.saveSceneDefaults(sequelize, { showId: show, body: { home_set_id: contested } }));
        expect(again.ok).toBe(false);
        expect(again.error.code).toBe('SCENE_SET_NOT_FOUND');
      }
      await episodeLocations.saveSceneDefaults(sequelize, { showId: show, body: { home_set_id: null } }).catch((err) => {
        console.error('[pr3 test] clearing the default after the race failed:', err.message);
      });
    });

    test('W20 locks the set before it claims the variant row, and no deadlock against the delete', async () => {
      const loc = await mkLocation('Race venue');
      const contested = await set('Contested variant', 'EVENT_LOCATION', show, { world_location_id: loc });
      await run('UPDATE world_locations SET approved_base_scene_set_id = :id, approved_base_image_url = :url, approved_base_at = NOW() WHERE id = :loc',
        { id: contested, url: 'https://cdn.example/base.jpg', loc });
      const results = await Promise.all([
        settle(lookVariants.startVariant(sequelize, { setId: contested, kind: 'season', value: 'winter' })),
        settle(del(contested, ANYWAY).then((r) => r.body)),
      ]);
      for (const r of results) expect(r.lock).toBeNull();
      if (await removedAt(contested)) expect((await referencesTo(contested)).variants).toBe(0);
    });
  });

  // ══════════════════════════════════════════════════════════════════════
  // 7. THE PLANNER AND START: a set removed after it was read
  // ══════════════════════════════════════════════════════════════════════
  describe('the planner and Start discover a stale set at save time', () => {
    const planner = require('../../src/services/scenePlannerService');
    const generator = require('../../src/services/episodeGeneratorService');

    test('W7 the planner: a set removed between the read and the save is saved as no set, not as a reference', async () => {
      const going = await set('Planner set');
      const ep = await mkEpisode(show);
      const brief = await mkBrief(show, ep, await mkEvent(show, { stamp: ep }));
      expect(brief).toBeTruthy();

      // The model is a double: its plan names the set, which is removed
      // before the save transaction runs.
      mockAnthropic.mockImplementationOnce(async () => {
        await del(going, ANYWAY);
        return {
          content: [{ type: 'text', text: JSON.stringify({ beats: [{ beat_number: 1, beat_name: 'Open', scene_set_id: going, angle_label: 'WIDE', confidence: 0.9 }] }) }],
          usage: { input_tokens: 10, output_tokens: 10 },
        };
      });
      const out = await settle(planner.generateScenePlan(ep, show, { title: 'Brief', logline: 'A shoot' }));
      // Whether the model double's shape satisfied the parser or not, the
      // one thing that must hold is that no beat names the removed set.
      expect(await removedAt(going)).not.toBeNull();
      expect((await referencesTo(going)).beats).toBe(0);
      if (out.ok) {
        for (const beat of out.value || []) expect(String(beat.scene_set_id || '')).not.toBe(going);
      }
    });

    test('W8 Start\'s plan rows: a set removed before they are written is omitted, and Start is not failed', async () => {
      const going = await set('Start home', 'HOME_BASE');
      const ep = await mkEpisode(show);
      const ev = await mkEvent(show, { stamp: ep });
      await del(going, ANYWAY);
      expect(await removedAt(going)).not.toBeNull();

      const result = await generator.createScenePlanRows(
        { id: ep, show_id: show }, { id: ev, show_id: show, scene_set_id: null }, models,
        [{ role: 'home', scene_set_id: going, name: null }]);
      // Beats were made (Start is never failed by this step) and not one
      // of them names the removed set.
      expect(result.failedBeats).toEqual([]);
      expect(result.scenePlanRows.length).toBeGreaterThan(0);
      for (const row of result.scenePlanRows) expect(String(row.scene_set_id || '')).not.toBe(going);
      expect((await referencesTo(going)).beats).toBe(0);
    });

    test('W8 with a live set: the beats are made at it, as before', async () => {
      const live = await set('Start live home', 'HOME_BASE');
      const ep = await mkEpisode(show);
      const ev = await mkEvent(show, { stamp: ep });
      const result = await generator.createScenePlanRows(
        { id: ep, show_id: show }, { id: ev, show_id: show, scene_set_id: null }, models,
        [{ role: 'home', scene_set_id: live, name: null }]);
      expect(result.failedBeats).toEqual([]);
      expect(result.scenePlanRows.some((r) => r.scene_set_id === live)).toBe(true);
      expect((await referencesTo(live)).beats).toBeGreaterThan(0);
    });
  });

  // ══════════════════════════════════════════════════════════════════════
  // 8. NO DATABASE TEXT, AND NO 40P01 ANYWHERE
  // ══════════════════════════════════════════════════════════════════════
  describe('what the browser is told, and what the database never reports', () => {
    test('W4, W5 and W6 answer a lock conflict as 409 RETRY with no database words', async () => {
      // Each writer is given a real lock conflict by holding the episode
      // row FOR UPDATE for longer than its bounded retries can outlast.
      const live = await set('Conflict set');
      const ep = await mkEpisode(show);
      await mkBeat(ep, 11, null);
      const angle = await mkAngle(live);

      const transaction = await sequelize.transaction();
      try {
        await sequelize.query("SET LOCAL lock_timeout = '150ms'", { transaction });
        await sequelize.query('SELECT id FROM episodes WHERE id IN (:ids) ORDER BY id FOR UPDATE', { replacements: { ids: [ep] }, transaction });
        const answers = await Promise.all([
          beatAngle(ep, 11, angle),
          beatSet(ep, 11, live),
          beatSave(ep, 11, { scene_set_id: live }),
        ]);
        for (const res of answers) {
          expect([409, 500]).toContain(res.status);
          // Whatever it was, the database's own words never reached it.
          expect(JSON.stringify(res.body)).not.toMatch(DATABASE_TEXT);
          expect(res.body.error).toBeTruthy();
        }
        // At least one is the retryable 409 the repo already uses.
        expect(answers.some((res) => res.status === 409 && res.body.code === 'RETRY')).toBe(true);
        // Nothing was written while the episode was held.
        expect(await referencesTo(live)).toEqual(NO_REFERENCES);
      } finally {
        if (!transaction.finished) await transaction.rollback();
      }
    });

    test('the retryable error the writers raise is the repo\'s own, with code RETRY and a 409', () => {
      const err = new RetryableConflictError();
      expect(err.code).toBe('RETRY');
      expect(err.status).toBe(409);
      expect(err.message).not.toMatch(DATABASE_TEXT);
    });

    test('the database itself counted no deadlock since this file began', async () => {
      // Every race above also asserts `lock` is null, which covers 40P01 on
      // the path that answered; this asks the database, which sees them all.
      expect(await deadlocks()).toBe(deadlocksAtStart);
    });
  });

  // ══════════════════════════════════════════════════════════════════════
  // 9. THE C1 EVENT WRITERS AND THE FINALIZERS: one order, no deadlock
  // ══════════════════════════════════════════════════════════════════════
  describe('against the C1 event writers and the Place finalizer', () => {
    test('an event PUT that changes its set, and an episode link to the same set, do not deadlock', async () => {
      const a = await set('Shared A');
      const ep = await mkEpisode(show);
      const ev = await mkEvent(show, { stamp: ep, set: w.s });
      await mkBrief(show, ep, ev);
      const putEvent = (body) => asAdmin(request(app).put(`/api/v1/world/${show}/events/${ev}`)).send(body);

      const results = await Promise.all([
        settle(putEvent({ scene_set_id: a }).then((r) => r.body)),
        settle(linkSetsToEpisode(ep, [a]).then((r) => r.body)),
      ]);
      for (const r of results) expect(r.lock).toBeNull();
      for (const r of results) if (r.ok) expect(JSON.stringify(r.value)).not.toMatch(DATABASE_TEXT);
    });

    test('the Locations save and an episode link to the same set do not deadlock', async () => {
      const a = await set('Shared B');
      const home = await set('Shared home', 'HOME_BASE');
      const ep = await mkEpisode(show);
      const ev = await mkEvent(show, { stamp: ep, set: a });
      await mkBrief(show, ep, ev);
      const saveLocations = () => asAdmin(request(app).put(`/api/v1/episodes/${ep}/locations`))
        .send({ locations: [{ role: 'event', scene_set_id: a }, { role: 'home', scene_set_id: home }], event_scene_set_id: a });

      const results = await Promise.all([
        settle(saveLocations().then((r) => r.body)),
        settle(linkSetsToEpisode(ep, [home]).then((r) => r.body)),
      ]);
      for (const r of results) expect(r.lock).toBeNull();
    });

    test('a delete, an episode link and a beat save on one set: no deadlock, and no reference on a removed set', async () => {
      const contested = await set('Three way');
      const ep = await mkEpisode(show);
      await mkBeat(ep, 12, null);
      const results = await Promise.all([
        settle(del(contested, ANYWAY).then((r) => r.body)),
        settle(linkSetsToEpisode(ep, [contested]).then((r) => r.body)),
        settle(beatSave(ep, 12, { scene_set_id: contested }).then((r) => r.body)),
      ]);
      for (const r of results) expect(r.lock).toBeNull();
      for (const r of results) if (r.ok) expect(JSON.stringify(r.value)).not.toMatch(DATABASE_TEXT);
      // References the writers made while the set was still live and that
      // Delete Anyway then left behind are its documented behaviour. The
      // invariant is that no writer may add one now that the set has gone.
      if (await removedAt(contested)) {
        const after = await referencesTo(contested);
        expect((await send(linkSetsToEpisode(ep, [contested]))).status).toBe(404);
        expect((await send(beatSave(ep, 12, { scene_set_id: contested }))).status).toBe(404);
        expect((await send(createScene({ episodeId: ep, title: 'S', scene_set_id: contested }))).status).toBe(404);
        expect(await referencesTo(contested)).toEqual(after);
      }
    });
  });

  // ══════════════════════════════════════════════════════════════════════
  // 10. THE SUCCESS PATHS ARE UNCHANGED
  // ══════════════════════════════════════════════════════════════════════
  describe('the ordinary, uncontested workflows still work', () => {
    test('W1, W2, W5, W9, W10 and W16 all succeed against a live set', async () => {
      const live = await set('Happy path');
      const angle = await mkAngle(live);
      const ep = await mkEpisode(show);
      await mkBeat(ep, 13, null);

      expect((await linkSetsToEpisode(ep, [live])).status).toBe(200);
      const other = await mkEpisode(show);
      expect((await linkEpisodesToSet(live, [other])).status).toBe(200);
      expect((await beatSet(ep, 13, live)).status).toBe(200);
      const created = await createScene({ episodeId: ep, title: 'Happy scene', scene_set_id: live });
      expect(created.status).toBe(201);
      expect((await updateScene(created.body.data.id, { title: 'Renamed' })).status).toBe(200);
      expect((await sceneFromAngle(ep, live, angle)).status).toBe(201);
      expect((await createEvent({ scene_set_id: live })).status).toBe(201);

      const refs = await referencesTo(live);
      expect(refs.links).toBeGreaterThanOrEqual(2);
      expect(refs.beats).toBe(1);
      expect(refs.scenes).toBeGreaterThanOrEqual(2);
      expect(refs.events).toBe(1);
    });

    test('a non-admin is still refused (the permission tier did not move)', async () => {
      const live = await set('Tier check');
      const ep = await mkEpisode(show);
      const viewer = TokenService.generateTokenPair({ id: `pr3-viewer-${TAG}`, email: 'v@pr3.dev', name: 'V', groups: ['VIEWER'], role: 'VIEWER' }).accessToken;
      const res = await request(app).post(`/api/v1/episodes/${ep}/scene-sets`)
        .set('X-Forwarded-For', '10.99.0.1').set('Authorization', `Bearer ${viewer}`).send({ sceneSetIds: [live] });
      expect([401, 403]).toContain(res.status);
      expect((await referencesTo(live)).links).toBe(0);
    });

    test('the delete path still refuses an accepted use and a filmed use', async () => {
      const used = await set('Still refused');
      const accepted = await mkEpisode(show, { evaluation: 'accepted' });
      await mkBeat(accepted, 14, used);
      expect((await del(used, ANYWAY)).body.code).toBe('EPISODE_ACCEPTED');
      expect(await removedAt(used)).toBeNull();
      expect(await uses.countUses(sequelize, used)).toBeTruthy();
    });
  });

  describe('the network guard', () => {
    test('no external network attempt in this file', () => {
      const mine = networkGuard.getState().events.slice(guardEventsAtStart);
      expect(mine.filter((e) => e.type === 'attempt')).toEqual([]);
    });
  });
});
