/**
 * episodeGeneratorService — createScenePlanRows makes only the missing beats
 *
 * Task #1620 added a duplicate guard (a second call inserted nothing).
 * Audit STATE-01 (2026-10-03) made it a repair: a fresh episode gets 14
 * rows, a complete episode gets none, a partly made one gets exactly the
 * beats it lacks, and a beat that fails is named with its reason while the
 * others stay.
 */

const { createScenePlanRows, scenePlanStep, BEAT_TEMPLATES, REMOVED_SET_BEAT_REASON } = require('../../../src/services/episodeGeneratorService');

// S1-B (Evoni, 2026-11-26): createScenePlanRows requires the CALLER's
// transaction. This is a unit suite over a doubled sequelize, so the token is
// a sentinel — but it is only an honest stand-in if the double proves the
// token reaches every statement, so each test asserts that below. A double
// that accepted anything could hide a missing propagation, which is the one
// defect this contract exists to prevent.
const TX = { sentinel: 'caller-owned-transaction' };

// C2 / Writer 8: the set-liveness read is told apart from the home-set
// lookup, so a removed set can be modelled instead of every set reading live.
const LIVENESS = /FOR KEY SHARE/;

function makeModels({ existingBeats = [], failBeats = [], goneSets = [] } = {}) {
  const queries = [];
  return {
    queries,
    models: {
      ScenePlan: {},
      sequelize: {
        query: jest.fn(async (sql, opts) => {
          queries.push({ sql, opts });
          if (LIVENESS.test(sql)) {
            const id = String(opts?.replacements?.id || '');
            return [goneSets.map(String).includes(id) ? [] : [{ id }]];
          }
          if (/FROM scene_sets/.test(sql)) {
            return [[{ id: 'scene-set-home-1' }]];
          }
          if (/SELECT beat_number FROM scene_plans/.test(sql)) {
            return [existingBeats.map((beat_number) => ({ beat_number }))];
          }
          if (/FROM scene_angles/.test(sql)) {
            return [[]];
          }
          if (/INSERT INTO scene_plans/.test(sql)) {
            if (failBeats.includes(opts.replacements.beat_number)) throw new Error(`disk full on beat ${opts.replacements.beat_number}`);
            return [[]];
          }
          throw new Error(`Unexpected query in test: ${sql}`);
        }),
      },
    },
  };
}

const episode = { id: 'episode-1' };
const event = { scene_set_id: 'scene-set-venue-1' };

describe('createScenePlanRows', () => {
  it('inserts all 14 beats for a fresh episode with no existing rows', async () => {
    const { models, queries } = makeModels();

    const { scenePlanRows, sceneSetIds, existingBeats, failedBeats } = await createScenePlanRows(episode, event, models, null, { transaction: TX });

    expect(scenePlanRows).toHaveLength(BEAT_TEMPLATES.length);
    expect(scenePlanRows).toHaveLength(14);
    expect(sceneSetIds).toEqual({ home: 'scene-set-home-1', venue: 'scene-set-venue-1' });
    expect(existingBeats).toEqual([]);
    expect(failedBeats).toEqual([]);

    const inserts = queries.filter(q => /INSERT INTO scene_plans/.test(q.sql));
    expect(inserts).toHaveLength(14);
    // The caller's transaction reached EVERY statement, the set-liveness
    // reads included. Without this the sentinel above would prove nothing.
    expect(queries).not.toHaveLength(0);
    expect(queries.every((q) => q.opts?.transaction === TX)).toBe(true);
    // And the sets the beats name were taken live-only, never waited for.
    const liveness = queries.filter((q) => LIVENESS.test(q.sql));
    expect(liveness).not.toHaveLength(0);
    expect(liveness.every((q) => /NOWAIT/.test(q.sql) && /deleted_at IS NULL/.test(q.sql))).toBe(true);
  });

  it("refuses at once without a caller's transaction, and writes nothing", async () => {
    const { models, queries } = makeModels();

    await expect(createScenePlanRows(episode, event, models))
      .rejects.toThrow(/requires the caller's transaction/);
    await expect(createScenePlanRows(episode, event, models, null, {}))
      .rejects.toThrow(/requires the caller's transaction/);

    // Not one statement was sent: it refuses before any read or write.
    expect(queries).toHaveLength(0);
    expect(models.sequelize.query).not.toHaveBeenCalled();
  });

  it('a beat whose selected set was removed is not written, and the others still are', async () => {
    // The home set is gone. The beats placed at it are named with the reason;
    // no row names it; the event's beats are created in the same call.
    const { models, queries } = makeModels({ goneSets: ['scene-set-home-1'] });

    const result = await createScenePlanRows(episode, event, models, null, { transaction: TX });

    expect(result.failedBeats).not.toHaveLength(0);
    expect(result.failedBeats.every((f) => f.reason === REMOVED_SET_BEAT_REASON)).toBe(true);
    expect(result.scenePlanRows).not.toHaveLength(0);
    // Nothing naming the removed set was written, and nothing was quietly
    // moved to another set or turned into a locationless beat.
    const inserts = queries.filter((q) => /INSERT INTO scene_plans/.test(q.sql));
    expect(inserts.some((q) => q.opts.replacements.scene_set_id === 'scene-set-home-1')).toBe(false);
    expect(inserts).toHaveLength(result.scenePlanRows.length);
    const failedNumbers = result.failedBeats.map((f) => f.beat);
    expect(inserts.some((q) => failedNumbers.includes(q.opts.replacements.beat_number))).toBe(false);
    // The step stays incomplete while those beats are unresolved.
    const step = scenePlanStep(result);
    expect(step.status).toBe('partial');
    expect(step.missing).toEqual(failedNumbers);
  });

  it('inserts nothing on a repeat call for an episode that has every beat', async () => {
    const { models, queries } = makeModels({ existingBeats: BEAT_TEMPLATES.map((b) => b.beat) });

    const { scenePlanRows, sceneSetIds, existingBeats } = await createScenePlanRows(episode, event, models, null, { transaction: TX });

    expect(scenePlanRows).toHaveLength(0);
    expect(existingBeats).toHaveLength(14);
    // The home/venue lookup still runs — SceneSetEpisode linking right
    // after this call is idempotent and expected to run every time,
    // including on a regenerate.
    expect(sceneSetIds).toEqual({ home: 'scene-set-home-1', venue: 'scene-set-venue-1' });

    const inserts = queries.filter(q => /INSERT INTO scene_plans/.test(q.sql));
    expect(inserts).toHaveLength(0);
  });

  it('a partly made plan gets exactly the beats it lacks, and the rows that exist are left alone', async () => {
    const { models, queries } = makeModels({ existingBeats: [1, 2, 3, 4, 5] });

    const { scenePlanRows, existingBeats } = await createScenePlanRows(episode, event, models, null, { transaction: TX });

    expect(existingBeats).toEqual([1, 2, 3, 4, 5]);
    expect(scenePlanRows.map((r) => r.beat_number)).toEqual([6, 7, 8, 9, 10, 11, 12, 13, 14]);
    const inserts = queries.filter(q => /INSERT INTO scene_plans/.test(q.sql));
    expect(inserts.map((q) => q.opts.replacements.beat_number)).toEqual([6, 7, 8, 9, 10, 11, 12, 13, 14]);
    expect(queries.some((q) => /UPDATE|DELETE/.test(q.sql))).toBe(false);
  });

  it('a beat that fails is named with its reason; the others stay; the step reads partial', async () => {
    const errSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const { models } = makeModels({ failBeats: [6] });

    const result = await createScenePlanRows(episode, event, models, null, { transaction: TX });

    expect(result.scenePlanRows).toHaveLength(13);
    expect(result.failedBeats).toEqual([{ beat: 6, reason: 'disk full on beat 6' }]);
    expect(scenePlanStep(result)).toEqual({ status: 'partial', created: 13, existing: 0, missing: [6], failed: [{ beat: 6, reason: 'disk full on beat 6' }] });
    expect(scenePlanStep({ scenePlanRows: [], existingBeats: BEAT_TEMPLATES.map((b) => b.beat), failedBeats: [] }).status).toBe('complete');
    expect(scenePlanStep({ scenePlanRows: [], existingBeats: [], failedBeats: [{ beat: 1, reason: 'x' }] }).status).toBe('failed');
    errSpy.mockRestore();
  });

  it('returns no rows and no scene set ids when ScenePlan model is unavailable', async () => {
    const { models } = makeModels({ existingCount: 0 });
    models.ScenePlan = undefined;

    const { scenePlanRows, sceneSetIds } = await createScenePlanRows(episode, event, models, null, { transaction: TX });

    expect(scenePlanRows).toEqual([]);
    expect(sceneSetIds).toEqual({ home: null, venue: null });
  });

  it('proceeds with insert if the existence check itself fails', async () => {
    const { models } = makeModels({ existingCount: 0 });
    models.sequelize.query = jest.fn(async (sql, opts) => {
      if (LIVENESS.test(sql)) return [[{ id: String(opts?.replacements?.id || '') }]];
      if (/FROM scene_sets/.test(sql)) return [[{ id: 'scene-set-home-1' }]];
      if (/SELECT COUNT\(\*\)/.test(sql)) throw new Error('connection reset');
      if (/INSERT INTO scene_plans/.test(sql)) return [[]];
      throw new Error(`Unexpected query in test: ${sql}`);
    });
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    const { scenePlanRows } = await createScenePlanRows(episode, event, models, null, { transaction: TX });

    expect(scenePlanRows).toHaveLength(14);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Scene plan existence check failed'),
      expect.any(String)
    );
    warnSpy.mockRestore();
  });
});
