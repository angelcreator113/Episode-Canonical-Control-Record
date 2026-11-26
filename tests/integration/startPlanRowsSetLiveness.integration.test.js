/**
 * C2 / Writer 8 (Evoni, 2026-11-26): Start's and Resume's plan rows name
 * LIVE scene sets, inside S1-B's caller-owned transaction.
 *
 * The defect this closes: the plan-row inserts held no set row, so a Scene
 * Set delete that committed in between left the beat naming the removed set —
 * scene_plans.scene_set_id's foreign key is satisfied by the soft-deleted row
 * and nothing waited for it. It was carried in
 * referenceWritersSetLiveness.integration.test.js as
 * `RECORDED GAP (W8, UNRESOLVED)`, which asserted the defect; that case is
 * now its positive form, and this suite is the battery
 * F-AUTH-1_ReferenceWritersSetLiveness_Amendment_2026-11-24.md §5a asked for.
 *
 * S1-B is the architectural authority
 * (F-AUTH-1_S1B_FrozenEpisodeProductionWrites_Amendment_2026-11-26.md §9):
 * the transaction is the CALLER's, the episode is held FOR UPDATE, the freeze
 * is decided under it, and the plan rows and the scene rows commit or roll
 * back together. Writer 8's own transaction, its weaker FOR SHARE lock and
 * its per-beat SAVEPOINTs are not integrated.
 *
 * These cases drive the real caller, `resumeEpisodeSetup` — which is
 * `planAndSyncUnderEpisodeLock` end to end — rather than calling
 * createScenePlanRows directly, because that now requires a caller's
 * transaction by contract.
 *
 * A "removed" set here is a set whose `deleted_at` is set, which is the state
 * the delete path leaves and the only state liveness is read from.
 */
jest.unmock('uuid');

const models = require('../../src/models');
const generator = require('../../src/services/episodeGeneratorService');
const { lockEpisodes, RetryableConflictError, isLockConflict } = require('../../src/utils/episodeLocks');
const { isFrozenEpisodeError } = require('../../src/utils/frozenEpisode');
const { BEAT_TEMPLATES, REMOVED_SET_BEAT_REASON } = require('../../src/services/episodeGeneratorService');
const lockTrace = require('../helpers/lockTrace');
const { placeLockFixtures, waitForLockWait, uuid } = require('../helpers/placeLockFixtures');

const { sequelize } = models;

const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

const CANON = BEAT_TEMPLATES.map((b) => b.beat);

(shouldSkip ? describe.skip : describe)("Start's plan rows name live scene sets (C2 / Writer 8, inside S1-B's unit)", () => {
  const fx = placeLockFixtures(sequelize, models);
  const { run, rows } = fx;
  let show;
  let trace = null;

  beforeAll(async () => {
    show = await fx.mkShow('W8 liveness');
  });

  afterEach(() => {
    if (trace) { trace.uninstall(); trace = null; }
    jest.restoreAllMocks();
  });

  afterAll(async () => {
    await fx.cleanup();
  });

  /** A draft episode with a Brief, an event, and its Locations linked. */
  async function episodeWithLocations({ homeSet, eventSet }) {
    const ep = await fx.mkEpisode(show);
    const ev = await fx.mkEvent(show, { set: eventSet });
    await fx.mkBrief(show, ep, ev);
    for (const [role, setId] of [['home', homeSet], ['event', eventSet]]) {
      if (!setId) continue;
      await run(`INSERT INTO scene_set_episodes (id, scene_set_id, episode_id, role, role_name, created_at, updated_at)
                 VALUES (gen_random_uuid(), :setId, :ep, :role, NULL, NOW(), NOW())`, { setId, ep, role });
    }
    return { ep, ev };
  }

  const remove = (setId) => run('UPDATE scene_sets SET deleted_at = NOW() WHERE id = :setId', { setId });
  const planRows = (ep) => rows('SELECT beat_number, scene_set_id FROM scene_plans WHERE episode_id = :ep AND deleted_at IS NULL ORDER BY beat_number', { ep });
  const sceneRows = (ep) => rows('SELECT scene_number, scene_plan_id FROM scenes WHERE episode_id = :ep AND deleted_at IS NULL ORDER BY scene_number', { ep });
  const beatsNaming = async (setId) => Number((await rows(
    'SELECT count(*)::int AS n FROM scene_plans WHERE scene_set_id = :setId AND deleted_at IS NULL', { setId }))[0].n);

  /**
   * The production unit, driven the way Start drives it: the episode
   * FOR UPDATE, the freeze under it, then the plan rows and the scene sync in
   * that one transaction, with the locations given explicitly as Start's
   * request gives them. A real transaction, never a token.
   */
  async function planAsStart(ep, event, locations) {
    const { episodeFreeze, frozenWriteRefusal } = require('../../src/utils/frozenEpisode');
    const { inEpisodeFirstTransaction } = require('../../src/services/eventPlaceSync');
    const beatScenes = require('../../src/services/beatScenesService');
    return inEpisodeFirstTransaction(sequelize, async (transaction) => {
      await lockEpisodes(sequelize, [ep], { transaction, mode: 'update' });
      const freeze = await episodeFreeze(sequelize, ep, { transaction });
      if (freeze.frozen) throw frozenWriteRefusal(ep, freeze, 'beats and scenes');
      const result = await generator.createScenePlanRows(
        { id: ep, show_id: show }, event, models, locations, { transaction });
      const sync = await beatScenes.syncBeatScenes(sequelize, ep, { transaction });
      return { result, sync };
    });
  }

  async function sets() {
    const home = await fx.mkSet(show, `Home ${uuid().slice(0, 6)}`, { scene_type: 'HOME_BASE' });
    const venue = await fx.mkSet(show, `Venue ${uuid().slice(0, 6)}`);
    return { home, venue };
  }

  // ══════════════════════════════════════════════════════════════════════
  // 1. A REMOVED SET TAKES NO NEW BEAT REFERENCE
  // ══════════════════════════════════════════════════════════════════════
  describe('a scene set that has been removed', () => {
    test('Resume: no beat names it, because the episode\'s Locations read drops it before any placement', async () => {
      // MEASURED: episodeLocationsService.listLocations joins
      // `scene_sets ... AND s.deleted_at IS NULL`, so a set already removed is
      // not among the episode's Locations at all. The beats that would have
      // used it are therefore written with NO set, which is the
      // locationless-beat case below, and the invariant still holds: nothing
      // names a removed set. The liveness pass below is what covers a set
      // removed AFTER the Locations were read, which is Start's shape.
      const { home, venue } = await sets();
      const { ep } = await episodeWithLocations({ homeSet: home, eventSet: venue });
      await remove(home);

      const out = await generator.resumeEpisodeSetup(models, ep);

      expect(await beatsNaming(home)).toBe(0);
      const made = await planRows(ep);
      expect(made.every((r) => r.scene_set_id !== home)).toBe(true);
      expect(made.some((r) => r.scene_set_id === venue)).toBe(true);
      expect(made.some((r) => r.scene_set_id === null)).toBe(true);
      expect(out.scene_plan.failed).toEqual([]);
    });

    test('Start: a selected set removed after the Locations were read is not written, is named with the reason, and the other beats are created in the same successful transaction', async () => {
      // Start takes its locations from the request, so a set removed between
      // that read and the inserts IS still named — the case the liveness pass
      // exists for. Nothing is substituted: no NULL, no other set.
      const { home, venue } = await sets();
      const { ep, ev } = await episodeWithLocations({ homeSet: home, eventSet: venue });
      await remove(home);

      const { result, sync } = await planAsStart(ep, { id: ev, show_id: show, scene_set_id: venue },
        [{ role: 'home', scene_set_id: home, name: null }, { role: 'event', scene_set_id: venue, name: null }]);

      expect(result.failedBeats).not.toHaveLength(0);
      expect(result.failedBeats.every((f) => f.reason === REMOVED_SET_BEAT_REASON)).toBe(true);
      expect(await beatsNaming(home)).toBe(0);
      expect(result.scenePlanRows.some((r) => String(r.scene_set_id || '') === home)).toBe(false);

      // The unrelated beats committed in that same successful transaction.
      const made = await planRows(ep);
      expect(made).not.toHaveLength(0);
      expect(made.some((r) => r.scene_set_id === venue)).toBe(true);
      expect(made).toHaveLength(CANON.length - result.failedBeats.length);
      // None of the unresolved beats was written at all.
      const failedNumbers = result.failedBeats.map((f) => f.beat);
      expect(made.some((r) => failedNumbers.includes(r.beat_number))).toBe(false);

      // The step is incomplete and names exactly those beats.
      const step = generator.scenePlanStep({ ...result, sync });
      expect(step.status).toBe('partial');
      expect(step.missing).toEqual([...failedNumbers].sort((a, b) => a - b));
    });

    test('a beat with no location at all is still written with no set: that is a different case', async () => {
      // No home role is linked, so the beats that would use it have no set to
      // be placed at. They are written without one, exactly as before.
      const { venue } = await sets();
      const { ep } = await episodeWithLocations({ homeSet: null, eventSet: venue });

      const out = await generator.resumeEpisodeSetup(models, ep);

      const made = await planRows(ep);
      expect(made).toHaveLength(CANON.length);
      expect(made.some((r) => r.scene_set_id === null)).toBe(true);
      expect(out.scene_plan.failed).toEqual([]);
    });

    test('both of its locations removed: no beat is written at any removed set, and every beat is accounted for', async () => {
      const { home, venue } = await sets();
      const { ep } = await episodeWithLocations({ homeSet: home, eventSet: venue });
      const { ev } = { ev: (await rows('SELECT event_id FROM episode_briefs WHERE episode_id = :ep', { ep }))[0].event_id };
      await remove(home);
      await remove(venue);

      const { result, sync } = await planAsStart(ep, { id: ev, show_id: show, scene_set_id: venue },
        [{ role: 'home', scene_set_id: home, name: null }, { role: 'event', scene_set_id: venue, name: null }]);

      expect(await beatsNaming(home)).toBe(0);
      expect(await beatsNaming(venue)).toBe(0);
      const made = await planRows(ep);
      const failedNumbers = result.failedBeats.map((f) => f.beat);
      // Every canonical beat is either written (with no set) or unresolved.
      expect([...made.map((r) => r.beat_number), ...failedNumbers].sort((a, b) => a - b)).toEqual([...CANON].sort((a, b) => a - b));
      expect(made.every((r) => r.scene_set_id === null)).toBe(true);
      expect(generator.scenePlanStep({ ...result, sync }).status).not.toBe('complete');
    });
  });

  // ══════════════════════════════════════════════════════════════════════
  // 2. A LOCKED SET IS NOT A REMOVED SET
  // ══════════════════════════════════════════════════════════════════════
  describe('[real lock] a live set row held by another transaction', () => {
    test('is never reported as removed: the unit loses to the lock, writes nothing, and the next resume makes the beats', async () => {
      const { home, venue } = await sets();
      const { ep } = await episodeWithLocations({ homeSet: home, eventSet: venue });

      // Another transaction holds the live set row, so the NOWAIT lock below
      // cannot take it. This is contention, not a removal.
      const holder = await sequelize.transaction();
      await sequelize.query('SELECT id FROM scene_sets WHERE id = :id FOR UPDATE',
        { replacements: { id: home }, transaction: holder });

      const errSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      const out = await generator.resumeEpisodeSetup(models, ep);
      errSpy.mockRestore();

      // Not one beat was blamed on a removed set.
      expect((out.scene_plan.failed || []).some((f) => f.reason === REMOVED_SET_BEAT_REASON)).toBe(false);
      // And the whole unit rolled back: nothing was written at all.
      expect(await planRows(ep)).toEqual([]);
      expect(await sceneRows(ep)).toEqual([]);
      expect(out.scene_plan.status).toBe('failed');
      expect(out.setup_status.complete).toBe(false);

      // Released, the very next resume makes every beat: safe recovery.
      await holder.rollback();
      const again = await generator.resumeEpisodeSetup(models, ep);
      expect(again.scene_plan.status).toBe('complete');
      expect(await planRows(ep)).toHaveLength(CANON.length);
      expect(await beatsNaming(home)).toBeGreaterThan(0);
    });
  });

  // ══════════════════════════════════════════════════════════════════════
  // 3. THE FREEZE STILL DECIDES FIRST
  // ══════════════════════════════════════════════════════════════════════
  describe('an accepted or filmed episode', () => {
    test.each([
      ['accepted', async (ep) => fx.setEvaluation(ep, 'accepted')],
      ['filmed', async (ep) => run(`INSERT INTO episode_raw_clips (id, episode_id, show_id, performer, s3_key_raw, key_status, key_strength, created_at, updated_at)
                                    VALUES (gen_random_uuid(), :ep, :show, 'lala', :key, 'none', 'low', NOW(), NOW())`,
      { ep, show, key: `raw/${uuid().slice(0, 8)}.mp4` })],
    ])('%s: the resume is refused 409 EPISODE_FROZEN before any set is held, and nothing is written', async (_label, freeze) => {
      const { home, venue } = await sets();
      const { ep } = await episodeWithLocations({ homeSet: home, eventSet: venue });
      await freeze(ep);

      trace = lockTrace.install(sequelize);
      const refusal = await generator.resumeEpisodeSetup(models, ep).then(() => null, (e) => e);

      expect(refusal).not.toBeNull();
      expect(isFrozenEpisodeError(refusal)).toBe(true);
      expect(refusal.status).toBe(409);
      expect(refusal.code).toBe('EPISODE_FROZEN');
      // Nothing was written, and no set row was ever taken: the freeze is
      // decided under the episode's lock, before the liveness pass.
      expect(await planRows(ep)).toEqual([]);
      expect(await sceneRows(ep)).toEqual([]);
      expect(trace.records.some((r) => r.kind === 'lock' && r.table === 'scene_sets')).toBe(false);
      expect(trace.records.some((r) => r.kind === 'insert' && r.table === 'scene_plans')).toBe(false);
    });

    test('the freeze answers before the removed set: response precedence is unchanged', async () => {
      const { home, venue } = await sets();
      const { ep } = await episodeWithLocations({ homeSet: home, eventSet: venue });
      await remove(home);
      await fx.setEvaluation(ep, 'accepted');

      const refusal = await generator.resumeEpisodeSetup(models, ep).then(() => null, (e) => e);

      expect(isFrozenEpisodeError(refusal)).toBe(true);
      expect(refusal.code).toBe('EPISODE_FROZEN');
      expect(String(refusal.message)).not.toContain('scene set was removed');
      expect(await planRows(ep)).toEqual([]);
    });
  });

  // ══════════════════════════════════════════════════════════════════════
  // 4. A FIRST CLIP CANNOT SLIP PAST THE FREEZE
  // ══════════════════════════════════════════════════════════════════════
  describe('[real lock] a first raw clip attaching while the unit runs', () => {
    test('the attach is not refused, and the unit that follows it sees the episode filmed and refuses', async () => {
      const { home, venue } = await sets();
      const { ep } = await episodeWithLocations({ homeSet: home, eventSet: venue });

      // The clip's own writer takes the episode FOR SHARE, as attachClip does,
      // and has not committed yet.
      const clipTx = await sequelize.transaction();
      await lockEpisodes(sequelize, [ep], { transaction: clipTx, mode: 'share' });
      await sequelize.query(`INSERT INTO episode_raw_clips (id, episode_id, show_id, performer, s3_key_raw, key_status, key_strength, created_at, updated_at)
                             VALUES (gen_random_uuid(), :ep, :show, 'lala', :key, 'none', 'low', NOW(), NOW())`,
        { replacements: { ep, show, key: `raw/${uuid().slice(0, 8)}.mp4` }, transaction: clipTx });

      // The unit asks for FOR UPDATE, so it must wait for the clip — filming
      // is never turned away.
      const resumed = generator.resumeEpisodeSetup(models, ep).then((r) => ({ ok: r }), (e) => ({ err: e }));
      await waitForLockWait(sequelize, '%FROM episodes%');
      await clipTx.commit();

      const out = await resumed;
      // Having waited, it reads the episode as filmed and refuses: the clip
      // cannot be overtaken, and no plan is written onto a filmed episode.
      expect(out.err).toBeDefined();
      expect(isFrozenEpisodeError(out.err)).toBe(true);
      expect(out.err.code).toBe('EPISODE_FROZEN');
      expect(await planRows(ep)).toEqual([]);
      expect(Number((await rows('SELECT count(*)::int AS n FROM episode_raw_clips WHERE episode_id = :ep', { ep }))[0].n)).toBe(1);
    });
  });

  // ══════════════════════════════════════════════════════════════════════
  // 5. A DATABASE FAILURE ROLLS BACK THE WHOLE UNIT
  // ══════════════════════════════════════════════════════════════════════
  describe('a real database statement failure inside the unit', () => {
    test('rolls back every plan row and every scene row it wrote, and leaves the beats and scenes that existed byte-identical', async () => {
      const { home, venue } = await sets();
      const { ep, ev } = await episodeWithLocations({ homeSet: home, eventSet: venue });
      // Three beats and their scenes made first, so there is real
      // pre-existing work for the rollback to preserve.
      for (const n of [1, 2, 3]) {
        await run(`INSERT INTO scene_plans (id, episode_id, beat_number, beat_name, scene_set_id, sort_order, locked, ai_suggested, created_at, updated_at)
                   VALUES (gen_random_uuid(), :ep, :n, :name, :setId, :n, false, true, NOW(), NOW())`,
        { ep, n, name: `Kept ${n}`, setId: venue });
      }
      await require('../../src/services/beatScenesService').syncBeatScenes(sequelize, ep);
      const before = await planRows(ep);
      const scenesBefore = await rows('SELECT * FROM scenes WHERE episode_id = :ep AND deleted_at IS NULL ORDER BY scene_number', { ep });
      expect(before).toHaveLength(3);
      expect(scenesBefore).not.toHaveLength(0);

      // A REAL failure, not an injected rejection: another connection holds
      // one of this episode's scene rows FOR UPDATE, so the sync's own write
      // waits and is cancelled by the 10 s lock timeout. An injected mock
      // rejection would NOT do: the statement would never reach PostgreSQL,
      // the transaction would never be aborted, and the swallowed per-beat
      // catch would let the rest commit — which is exactly the difference
      // this case has to prove.
      const holder = await sequelize.transaction();
      await sequelize.query('SELECT id FROM scenes WHERE id = :id FOR UPDATE',
        { replacements: { id: scenesBefore[0].id }, transaction: holder });

      const errSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      const failure = await planAsStart(ep, { id: ev, show_id: show, scene_set_id: venue },
        [{ role: 'home', scene_set_id: home, name: null }, { role: 'event', scene_set_id: venue, name: null }])
        .then(() => null, (e) => e);
      errSpy.mockRestore();
      await holder.rollback();

      // The unit failed, so nothing of it survived.
      expect(failure).not.toBeNull();
      expect(await planRows(ep)).toEqual(before);
      const scenesAfter = await rows('SELECT * FROM scenes WHERE episode_id = :ep AND deleted_at IS NULL ORDER BY scene_number', { ep });
      expect(scenesAfter).toEqual(scenesBefore);

      // And the next run recovers: the missing beats are made, the three that
      // existed are left exactly as they were.
      const { result, sync } = await planAsStart(ep, { id: ev, show_id: show, scene_set_id: venue },
        [{ role: 'home', scene_set_id: home, name: null }, { role: 'event', scene_set_id: venue, name: null }]);
      expect(generator.scenePlanStep({ ...result, sync }).status).toBe('complete');
      expect(await planRows(ep)).toHaveLength(CANON.length);
      const kept = (await planRows(ep)).filter((r) => [1, 2, 3].includes(r.beat_number));
      expect(kept).toEqual(before);
    }, 60000);
  });

  // ══════════════════════════════════════════════════════════════════════
  // 6. THE LOCK ORDER IS THE PLACE ORDER
  // ══════════════════════════════════════════════════════════════════════
  describe('the order the unit takes its rows in', () => {
    test('the episode FOR UPDATE first, then every named set live-only and NOWAIT, ascending', async () => {
      const { home, venue } = await sets();
      const { ep } = await episodeWithLocations({ homeSet: home, eventSet: venue });

      trace = lockTrace.install(sequelize);
      const out = await generator.resumeEpisodeSetup(models, ep);
      expect(out.scene_plan.status).toBe('complete');

      const locks = trace.records.filter((r) => r.kind === 'lock');
      const episodeLocks = locks.filter((r) => r.table === 'episodes');
      const setLocks = locks.filter((r) => r.table === 'scene_sets');

      // The episode is taken first, and as FOR UPDATE — never share.
      expect(episodeLocks).not.toHaveLength(0);
      expect(episodeLocks[0].mode).toBe('update');
      expect(locks.indexOf(episodeLocks[0])).toBe(0);

      // Then the set rows: live only, never waited for, ascending by id.
      expect(setLocks).not.toHaveLength(0);
      expect(setLocks.every((r) => /NOWAIT/.test(r.sql))).toBe(true);
      expect(setLocks.every((r) => /deleted_at IS NULL/.test(r.sql))).toBe(true);
      const askedIds = setLocks.map((r) => String(r.sql.match(/'([0-9a-f-]{36})'/)?.[1] || '')).filter(Boolean);
      const seen = askedIds.length ? askedIds : setLocks.flatMap((r) => r.ids);
      expect([...seen]).toEqual([...seen].sort());

      // No set row was taken before the episode.
      for (const sl of setLocks) expect(locks.indexOf(sl)).toBeGreaterThan(locks.indexOf(episodeLocks[0]));

      // And the plan rows and the scene rows were written in one transaction.
      const planInserts = trace.records.filter((r) => r.kind === 'insert' && r.table === 'scene_plans');
      const sceneInserts = trace.records.filter((r) => r.kind === 'insert' && r.table === 'scenes');
      expect(planInserts).not.toHaveLength(0);
      expect(sceneInserts).not.toHaveLength(0);
      const txIds = new Set([...planInserts, ...sceneInserts].map((r) => r.txId));
      expect(txIds.size).toBe(1);
      expect([...txIds][0]).toBeTruthy();
    });
  });

  // ══════════════════════════════════════════════════════════════════════
  // 7. THE CONTRACT ITSELF
  // ══════════════════════════════════════════════════════════════════════
  describe('createScenePlanRows without a caller transaction', () => {
    test('refuses at once and writes nothing', async () => {
      const { home, venue } = await sets();
      const { ep, ev } = await episodeWithLocations({ homeSet: home, eventSet: venue });

      await expect(generator.createScenePlanRows(
        { id: ep, show_id: show }, { id: ev, show_id: show, scene_set_id: venue }, models,
        [{ role: 'home', scene_set_id: home, name: null }]))
        .rejects.toThrow(/requires the caller's transaction/);

      expect(await planRows(ep)).toEqual([]);
      expect(await beatsNaming(home)).toBe(0);
    });

    test('and the retryable-conflict contract is unchanged: a lock conflict is still a lock conflict', () => {
      // No new retry system: the unit's bounded retry is the Place
      // finalizer's, and these are the two codes it counts as retryable.
      expect(isLockConflict({ original: { code: '40P01' } })).toBe(true);
      expect(isLockConflict({ original: { code: '55P03' } })).toBe(true);
      expect(isLockConflict({ original: { code: '23505' } })).toBe(false);
      expect(new RetryableConflictError().code).toBe('RETRY');
    });
  });
});
