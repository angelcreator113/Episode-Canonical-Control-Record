// ════════════════════════════════════════════════════════════════════════════
// WORLD TEMPERATURE ROUTES — v1.1
// Mount at: /api/v1/world-temperature
// NOTE: Takes universeId, not showId — scoping is at universe level
// ════════════════════════════════════════════════════════════════════════════

const express = require('express');
const worldTempRouter = express.Router();
const { optionalAuth } = require('../middleware/auth');
const { computeWorldTemperature, snapshotTemperature } = require('../services/worldTemperatureService');

/**
 * GET /api/v1/world-temperature/:universeId
 */
worldTempRouter.get('/:universeId', optionalAuth, async (req, res) => {
  try {
    const { universeId } = req.params;
    const models = req.app.get('models') || require('../models');

    const result = await computeWorldTemperature(universeId, models);
    return res.json(result);
  } catch (err) {
    console.error('[WorldTemp] GET error:', err);
    return res.status(500).json({ error: 'World temperature computation failed', detail: err.message });
  }
});

/**
 * POST /api/v1/world-temperature/:universeId/snapshot
 * Body: { temperature }
 * Call after every episode accept.
 */
worldTempRouter.post('/:universeId/snapshot', optionalAuth, async (req, res) => {
  try {
    const { universeId } = req.params;
    const { temperature } = req.body;
    const models = req.app.get('models') || require('../models');

    if (typeof temperature !== 'number') {
      return res.status(400).json({ error: 'temperature (number) is required in body' });
    }

    await snapshotTemperature(universeId, temperature, models);
    return res.json({ success: true, snapshotted: temperature });
  } catch (err) {
    console.error('[WorldTemp] POST snapshot error:', err);
    return res.status(500).json({ error: 'Snapshot failed', detail: err.message });
  }
});

module.exports = worldTempRouter;
