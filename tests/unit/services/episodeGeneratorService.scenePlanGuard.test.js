/**
 * episodeGeneratorService — createScenePlanRows makes only the missing beats
 *
 * Task #1620 added a duplicate guard (a second call inserted nothing).
 * Audit STATE-01 (2026-10-03) made it a repair: a fresh episode gets 14
 * rows, a complete episode gets none, a partly made one gets exactly the
 * beats it lacks, and a beat that fails is named with its reason while the
 * others stay.
 */

const { createScenePlanRows, scenePlanStep, BEAT_TEMPLATES } = require('../../../src/services/episodeGeneratorService');

function makeModels({ existingBeats = [], failBeats = [] } = {}) {
  const queries = [];
  return {
    queries,
    models: {
      ScenePlan: {},
      sequelize: {
        query: jest.fn(async (sql, opts) => {
          queries.push({ sql, opts });
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

    const { scenePlanRows, sceneSetIds, existingBeats, failedBeats } = await createScenePlanRows(episode, event, models);

    expect(scenePlanRows).toHaveLength(BEAT_TEMPLATES.length);
    expect(scenePlanRows).toHaveLength(14);
    expect(sceneSetIds).toEqual({ home: 'scene-set-home-1', venue: 'scene-set-venue-1' });
    expect(existingBeats).toEqual([]);
    expect(failedBeats).toEqual([]);

    const inserts = queries.filter(q => /INSERT INTO scene_plans/.test(q.sql));
    expect(inserts).toHaveLength(14);
  });

  it('inserts nothing on a repeat call for an episode that has every beat', async () => {
    const { models, queries } = makeModels({ existingBeats: BEAT_TEMPLATES.map((b) => b.beat) });

    const { scenePlanRows, sceneSetIds, existingBeats } = await createScenePlanRows(episode, event, models);

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

    const { scenePlanRows, existingBeats } = await createScenePlanRows(episode, event, models);

    expect(existingBeats).toEqual([1, 2, 3, 4, 5]);
    expect(scenePlanRows.map((r) => r.beat_number)).toEqual([6, 7, 8, 9, 10, 11, 12, 13, 14]);
    const inserts = queries.filter(q => /INSERT INTO scene_plans/.test(q.sql));
    expect(inserts.map((q) => q.opts.replacements.beat_number)).toEqual([6, 7, 8, 9, 10, 11, 12, 13, 14]);
    expect(queries.some((q) => /UPDATE|DELETE/.test(q.sql))).toBe(false);
  });

  it('a beat that fails is named with its reason; the others stay; the step reads partial', async () => {
    const errSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const { models } = makeModels({ failBeats: [6] });

    const result = await createScenePlanRows(episode, event, models);

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

    const { scenePlanRows, sceneSetIds } = await createScenePlanRows(episode, event, models);

    expect(scenePlanRows).toEqual([]);
    expect(sceneSetIds).toEqual({ home: null, venue: null });
  });

  it('proceeds with insert if the existence check itself fails', async () => {
    const { models } = makeModels({ existingCount: 0 });
    models.sequelize.query = jest.fn(async (sql) => {
      if (/FROM scene_sets/.test(sql)) return [[{ id: 'scene-set-home-1' }]];
      if (/SELECT COUNT\(\*\)/.test(sql)) throw new Error('connection reset');
      if (/INSERT INTO scene_plans/.test(sql)) return [[]];
      throw new Error(`Unexpected query in test: ${sql}`);
    });
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    const { scenePlanRows } = await createScenePlanRows(episode, event, models);

    expect(scenePlanRows).toHaveLength(14);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Scene plan existence check failed'),
      expect.any(String)
    );
    warnSpy.mockRestore();
  });
});
