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
const { optionalAuth } = require('../middleware/auth');
const { validateMissionPayload } = require('../services/phoneConditionSchema');

// GET /api/v1/ui-overlays/:showId/missions?episode_id=...
router.get('/', optionalAuth, async (req, res) => {
  try {
    const models = require('../models');
    const where = { show_id: req.params.showId, deleted_at: null };
    if (req.query.episode_id) {
      // `episode_id IS NULL OR = :episodeId` — show-wide missions surface everywhere.
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
      where,
      order: [['display_order', 'ASC'], ['created_at', 'ASC']],
    });
    return res.json({ success: true, missions });
  } catch (err) {
    console.error('[phoneMissionRoutes] GET error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/v1/ui-overlays/:showId/missions
router.post('/', optionalAuth, async (req, res) => {
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
    return res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/v1/ui-overlays/:showId/missions/:id
router.put('/:id', optionalAuth, async (req, res) => {
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
    return res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/v1/ui-overlays/:showId/missions/:id — soft delete
router.delete('/:id', optionalAuth, async (req, res) => {
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
