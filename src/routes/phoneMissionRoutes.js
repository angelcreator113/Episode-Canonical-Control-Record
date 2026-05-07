/**
 * phoneMissionRoutes — CRUD for show/episode-scoped missions (read-only observers).
 *
 * Mounted at `/api/v1/ui-overlays/:showId/missions`. Missions use the SAME
 * condition grammar as zones + content zones, validated via phoneConditionSchema
 * so a bad objective can't slip in from the UI or from future AI proposals.
 *
 * Read-only in v1: missions only watch state, they don't write it. No rewards,
 * no triggers. Progress is computed client-side (or server-side via
 * phoneRuntime.evaluateMissions) against the current playthrough state.
 */
const express = require('express');
const router = express.Router({ mergeParams: true });
const { requireAuth } = require('../middleware/auth');
const { validateMissionPayload } = require('../services/phoneConditionSchema');

// GET /api/v1/ui-overlays/:showId/missions?episode_id=...
router.get('/', requireAuth, async (req, res) => {
  try {
    const models = require('../models');
    // Fail soft if the table hasn't been migrated yet on this environment
    // (e.g. old dev DB). Returning an empty list keeps the step header + AI
    // context builder working; a missing table isn't an error from the UI's POV.
    if (!models.PhoneMission) {
      return res.json({ success: true, missions: [] });
    }
    if (req.query.episode_id) {
      const [rows] = await models.sequelize.query(
        `SELECT * FROM phone_missions
         WHERE show_id = :showId AND deleted_at IS NULL
           AND (episode_id = :episodeId OR episode_id IS NULL)
         ORDER BY display_order ASC, created_at ASC`,
        { replacements: { showId: req.params.showId, episodeId: req.query.episode_id } }
      );
      return res.json({ success: true, missions: rows || [] });
    }
    const missions = await models.PhoneMission.findAll({
      where: { show_id: req.params.showId, deleted_at: null },
      order: [['display_order', 'ASC'], ['created_at', 'ASC']],
    });
    return res.json({ success: true, missions });
  } catch (err) {
    // Undefined-table fallback — Postgres throws code 42P01 when the relation
    // doesn't exist. Treat that specifically as "no missions yet" rather than
    // a server error.
    if (err?.parent?.code === '42P01' || /phone_missions.*does not exist/i.test(err?.message || '')) {
      return res.json({ success: true, missions: [] });
    }
    console.error('[phoneMissionRoutes] GET error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Postgres 42703 = column does not exist; surfaces a clearer 503 so the UI
// can tell creators "this environment needs a DB migration" rather than a
// generic 500. Covers pre-migration state where reward_actions isn't in the
// table yet but the client already POSTs it via validateMissionPayload.
function missingColumnError(err) {
  return err?.parent?.code === '42703' || /column.*does not exist/i.test(err?.message || '');
}

// POST /api/v1/ui-overlays/:showId/missions
router.post('/', requireAuth, async (req, res) => {
  try {
    const models = require('../models');
    const { error, value } = validateMissionPayload(req.body);
    if (error) return res.status(400).json({ success: false, error });
    const mission = await models.PhoneMission.create({
      ...value,
      show_id: req.params.showId,
    });
    return res.status(201).json({ success: true, mission });
  } catch (err) {
    console.error('[phoneMissionRoutes] POST error:', err);
    if (missingColumnError(err)) {
      return res.status(503).json({ success: false, error: 'Mission schema is out of date on this environment — run pending migrations (reward_actions column).' });
    }
    return res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/v1/ui-overlays/:showId/missions/:id
router.put('/:id', requireAuth, async (req, res) => {
  try {
    const models = require('../models');
    const mission = await models.PhoneMission.findOne({
      where: { id: req.params.id, show_id: req.params.showId, deleted_at: null },
    });
    if (!mission) return res.status(404).json({ success: false, error: 'mission not found' });

    const { error, value } = validateMissionPayload(req.body);
    if (error) return res.status(400).json({ success: false, error });

    await mission.update(value);
    return res.json({ success: true, mission });
  } catch (err) {
    console.error('[phoneMissionRoutes] PUT error:', err);
    if (missingColumnError(err)) {
      return res.status(503).json({ success: false, error: 'Mission schema is out of date on this environment — run pending migrations (reward_actions column).' });
    }
    return res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/v1/ui-overlays/:showId/missions/:id — soft delete
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const models = require('../models');
    const mission = await models.PhoneMission.findOne({
      where: { id: req.params.id, show_id: req.params.showId, deleted_at: null },
    });
    if (!mission) return res.status(404).json({ success: false, error: 'mission not found' });
    await mission.destroy();  // paranoid → soft delete
    return res.json({ success: true });
  } catch (err) {
    console.error('[phoneMissionRoutes] DELETE error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
