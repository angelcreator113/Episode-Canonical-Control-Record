/**
 * episodeGeneratorService — createScenePlanRows duplicate guard
 *
 * Task #1620: episodeGeneratorService's scene_plans insert loop had no
 * duplicate check. These tests cover the guard added to
 * createScenePlanRows — a fresh episode gets 14 rows, a second call for
 * the same episode inserts none and leaves existing rows untouched.
 */

const { createScenePlanRows, BEAT_TEMPLATES } = require('../../../src/services/episodeGeneratorService');

function makeModels({ existingCount = 0 } = {}) {
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
          if (/SELECT COUNT\(\*\)/.test(sql)) {
            return [[{ count: existingCount }]];
          }
          if (/INSERT INTO scene_plans/.test(sql)) {
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
    const { models, queries } = makeModels({ existingCount: 0 });

    const { scenePlanRows, sceneSetIds } = await createScenePlanRows(episode, event, models);

    expect(scenePlanRows).toHaveLength(BEAT_TEMPLATES.length);
    expect(scenePlanRows).toHaveLength(14);
    expect(sceneSetIds).toEqual({ home: 'scene-set-home-1', venue: 'scene-set-venue-1' });

    const inserts = queries.filter(q => /INSERT INTO scene_plans/.test(q.sql));
    expect(inserts).toHaveLength(14);
  });

  it('skips the insert entirely on a repeat call for an episode that already has rows', async () => {
    const { models, queries } = makeModels({ existingCount: 14 });

    const { scenePlanRows, sceneSetIds } = await createScenePlanRows(episode, event, models);

    expect(scenePlanRows).toHaveLength(0);
    // The home/venue lookup still runs — SceneSetEpisode linking right
    // after this call is idempotent and expected to run every time,
    // including on a regenerate.
    expect(sceneSetIds).toEqual({ home: 'scene-set-home-1', venue: 'scene-set-venue-1' });

    const inserts = queries.filter(q => /INSERT INTO scene_plans/.test(q.sql));
    expect(inserts).toHaveLength(0);
  });

  it('logs when an insert is skipped', async () => {
    const { models } = makeModels({ existingCount: 3 });
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    await createScenePlanRows(episode, event, models);

    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Skipped scene plan insert'));
    logSpy.mockRestore();
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
