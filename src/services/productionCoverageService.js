'use strict';

/**
 * Production coverage for one episode (§8(o) item 2; episode creation
 * step 8). Loads what computeCoverage reads, all of it existing data:
 * the episode's scene_plans rows with their sets and angles (the same read
 * GET /episode-brief/:id/plan makes, then planWithAngles and
 * planReadiness), and the overlays placed on a beat (timeline_placements
 * whose properties.anchor is 'beat', written by placeOverlayOnBeat). Reads
 * only.
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

  const [placed] = await sequelize.query(
    `SELECT label, properties->>'beat_number' AS beat_number
       FROM timeline_placements
      WHERE episode_id = :episodeId AND deleted_at IS NULL AND properties->>'anchor' = 'beat'`,
    { replacements: { episodeId } });
  const overlays = (placed || []).map((p) => ({ beat_number: Number(p.beat_number), label: p.label }));

  return computeCoverage({ planRows, readiness, overlays });
}

module.exports = { loadCoverage };
