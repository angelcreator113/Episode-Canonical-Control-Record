'use strict';

/**
 * Production coverage for one episode (§8(o) item 2; episode creation
 * step 8). Loads what computeCoverage reads, all of it existing data:
 * the episode's scene_plans rows with their sets and angles (the same read
 * GET /episode-brief/:id/plan makes, then planWithAngles and
 * planReadiness), and the overlays placed on a beat (timeline_placements
 * whose properties.anchor is 'beat', written by placeOverlayOnBeat), and
 * the episode's performance clips (episode_performance_clips). A failed
 * clip read is logged and leaves the two clip indicators "not tracked"; a
 * failed overlay read does the same for the interface indicator.
 * Reads only.
 */

const { computeCoverage } = require('../utils/productionCoverage');

async function loadCoverage(models, episodeId) {
  const { ScenePlan, SceneSet, sequelize } = models;
  const plans = await ScenePlan.findAll({
    where: { episode_id: episodeId, deleted_at: null },
    order: [['beat_number', 'ASC']],
    include: [{
      model: SceneSet,
      as: 'sceneSet',
      attributes: ['id', 'name', 'scene_type', 'script_context', 'base_still_url'],
      required: false,
    }],
  });
  const { planWithAngles, planReadiness } = require('./planLocationsService');
  const planRows = await planWithAngles(sequelize, plans.map((p) => (p.toJSON ? p.toJSON() : p)));
  const readiness = planReadiness(planRows);

  // timeline_placements is not created by the canon migration tree, so a
  // database without it reads the interface indicator as "not tracked".
  // Overlays kept off beats for now (episodeBeatPlacement): not tracked.
  const { isOverlaysOnBeats } = require('./episodeBeatPlacement');
  let overlays = 'off';
  if (isOverlaysOnBeats()) {
    overlays = null;
    try {
      const [placed] = await sequelize.query(
        `SELECT label, properties->>'beat_number' AS beat_number
           FROM timeline_placements
          WHERE episode_id = :episodeId AND deleted_at IS NULL AND properties->>'anchor' = 'beat'`,
        { replacements: { episodeId } });
      overlays = (placed || []).map((p) => ({ beat_number: Number(p.beat_number), label: p.label }));
    } catch (err) {
      console.error('[ProductionCoverage] overlay read failed:', err.message);
    }
  }

  let clips = null;
  try {
    const { listClips } = require('./performanceClipsService');
    clips = await listClips(sequelize, episodeId);
  } catch (err) {
    console.error('[ProductionCoverage] clip read failed:', err.message);
  }

  return computeCoverage({ planRows, readiness, overlays, clips });
}

module.exports = { loadCoverage };
