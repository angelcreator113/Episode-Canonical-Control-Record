/**
 * World Events routes — episode distribution
 *
 * POST   /api/v1/world/:showId/episodes/:episodeId/generate-distribution
 * GET    /api/v1/world/:showId/episodes/:episodeId/distribution
 * PUT    /api/v1/world/:showId/episodes/:episodeId/distribution
 * PUT    /api/v1/world/:showId/distribution-defaults
 * GET    /api/v1/world/:showId/distribution-defaults
 *
 * Part of the worldEvents router (Task #54 split it out of one 5,568-line
 * file); ./index.js mounts the parts in their original order.
 */

'use strict';

const express = require('express');
const router = express.Router();

const { requireAuth } = require('../../middleware/auth');
const { aiRateLimiter } = require('../../middleware/aiRateLimiter');

// ═══════════════════════════════════════════════════════════════════════
// DISTRIBUTION — platform-specific descriptions, hashtags, scheduling
// ═══════════════════════════════════════════════════════════════════════

// POST /world/:showId/episodes/:episodeId/generate-distribution
router.post('/world/:showId/episodes/:episodeId/generate-distribution', requireAuth, aiRateLimiter, async (req, res) => {
  try {
    const { showId, episodeId } = req.params;
    const { platforms } = req.body; // optional: ['youtube', 'tiktok', 'instagram', 'facebook']
    const models = req.app?.get?.('models') || require('../../models');
    const { generateDistribution } = require('../../services/distributionService');

    const result = await generateDistribution(episodeId, showId, models.sequelize, { platforms });

    return res.json({
      success: true,
      message: `Distribution generated for ${Object.keys(result.platforms).length} platforms`,
      data: result,
    });
  } catch (err) {
    console.error('[Distribution] Generate error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// GET /world/:showId/episodes/:episodeId/distribution
router.get('/world/:showId/episodes/:episodeId/distribution', requireAuth, async (req, res) => {
  try {
    const { episodeId } = req.params;
    const models = req.app?.get?.('models') || require('../../models');

    const [episode] = await models.sequelize.query(
      `SELECT distribution_metadata FROM episodes WHERE id = :episodeId AND deleted_at IS NULL LIMIT 1`,
      { replacements: { episodeId }, type: models.sequelize.QueryTypes.SELECT }
    );

    let metadata = episode?.distribution_metadata;
    if (typeof metadata === 'string') try { metadata = JSON.parse(metadata); } catch { metadata = {}; }

    return res.json({ success: true, data: metadata || {} });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /world/:showId/episodes/:episodeId/distribution
router.put('/world/:showId/episodes/:episodeId/distribution', requireAuth, async (req, res) => {
  try {
    const { episodeId } = req.params;
    const { distribution_metadata } = req.body;
    const models = req.app?.get?.('models') || require('../../models');
    // The style sheet entry (Task #2878) is written only by its own routes.
    const { keepStyleSheet } = require('../../services/styleSheetDistributionService');
    const metadata = await keepStyleSheet(models.sequelize, episodeId, distribution_metadata);

    await models.sequelize.query(
      `UPDATE episodes SET distribution_metadata = :metadata, updated_at = NOW() WHERE id = :episodeId AND deleted_at IS NULL`,
      { replacements: { metadata: JSON.stringify(metadata), episodeId } }
    );

    return res.json({ success: true, message: 'Distribution metadata saved' });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /world/:showId/distribution-defaults — save show-level platform config
router.put('/world/:showId/distribution-defaults', requireAuth, async (req, res) => {
  try {
    const { showId } = req.params;
    const { distribution_defaults } = req.body;
    const models = req.app?.get?.('models') || require('../../models');
    const { saveShowDefaults } = require('../../services/distributionService');

    const saved = await saveShowDefaults(showId, distribution_defaults, models.sequelize);
    return res.json({ success: true, data: saved, message: 'Show distribution defaults saved' });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// GET /world/:showId/distribution-defaults
router.get('/world/:showId/distribution-defaults', requireAuth, async (req, res) => {
  try {
    const { showId } = req.params;
    const models = req.app?.get?.('models') || require('../../models');

    const [show] = await models.sequelize.query(
      `SELECT distribution_defaults FROM shows WHERE id = :showId AND deleted_at IS NULL LIMIT 1`,
      { replacements: { showId }, type: models.sequelize.QueryTypes.SELECT }
    );

    let defaults = show?.distribution_defaults;
    if (typeof defaults === 'string') try { defaults = JSON.parse(defaults); } catch { defaults = {}; }

    return res.json({ success: true, data: defaults || {} });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
