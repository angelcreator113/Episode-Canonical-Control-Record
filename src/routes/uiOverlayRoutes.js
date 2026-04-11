'use strict';

const express = require('express');
const router = express.Router();
const { optionalAuth } = require('../middleware/auth');

// GET /api/v1/ui-overlays/:showId — list existing overlays
router.get('/:showId', optionalAuth, async (req, res) => {
  try {
    const models = require('../models');
    const { getShowOverlays, OVERLAY_TYPES } = require('../services/uiOverlayService');
    const existing = await getShowOverlays(req.params.showId, models);

    // Map overlay types to show which are generated vs missing
    const status = OVERLAY_TYPES.map(ot => {
      const found = existing.find(e => e.overlay_type === ot.id || e.metadata?.overlay_type === ot.id);
      return {
        ...ot,
        generated: !!found,
        url: found?.url || null,
        asset_id: found?.id || null,
      };
    });

    return res.json({
      success: true,
      data: status,
      generated_count: status.filter(s => s.generated).length,
      total: OVERLAY_TYPES.length,
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/v1/ui-overlays/:showId/generate-all — start generating all missing overlays (async)
router.post('/:showId/generate-all', optionalAuth, async (req, res) => {
  try {
    const models = require('../models');
    const { generateAllOverlays } = require('../services/uiOverlayService');
    const showId = req.params.showId;

    if (!process.env.FAL_KEY && !process.env.OPENAI_API_KEY) {
      return res.status(503).json({ success: false, error: 'No image generation API configured' });
    }

    // Return immediately — run generation in background
    res.json({ success: true, message: 'Generation started — refresh to see progress' });

    // Generate in background
    generateAllOverlays(showId, models).then(results => {
      console.log(`[UIOverlay] Background generation complete: ${results.filter(r => r.url).length} generated`);
    }).catch(err => {
      console.error('[UIOverlay] Background generation failed:', err.message);
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/v1/ui-overlays/:showId/generate/:overlayType — generate single overlay
router.post('/:showId/generate/:overlayType', optionalAuth, async (req, res) => {
  try {
    const models = require('../models');
    const { generateOverlay, OVERLAY_TYPES } = require('../services/uiOverlayService');
    const { v4: uuidv4 } = require('uuid');

    const overlayType = OVERLAY_TYPES.find(ot => ot.id === req.params.overlayType);
    if (!overlayType) return res.status(404).json({ success: false, error: `Unknown overlay type: ${req.params.overlayType}` });

    const { url, bg_removed } = await generateOverlay(overlayType, req.params.showId);

    // Create Asset via raw SQL (avoid model column mismatch)
    let assetId = null;
    try {
      const assetUuid = uuidv4();
      const models2 = require('../models');
      await models2.sequelize.query(
        `INSERT INTO assets (id, name, asset_type, asset_role, asset_group, asset_scope, approval_status, s3_url_raw, s3_url_processed, show_id, metadata, created_at, updated_at)
         VALUES (:id, :name, 'UI_OVERLAY', :role, 'SHOW', 'SHOW', 'approved', :url, :url, :showId, :metadata, NOW(), NOW())`,
        { replacements: {
          id: assetUuid,
          name: `UI Overlay: ${overlayType.name}`,
          role: `UI.OVERLAY.${overlayType.id.toUpperCase()}`,
          url,
          showId: req.params.showId,
          metadata: JSON.stringify({ source: 'ui-overlay-generator', overlay_type: overlayType.id, overlay_beat: overlayType.beat, overlay_category: overlayType.category, bg_removed, generated_at: new Date().toISOString() }),
        } }
      );
      assetId = assetUuid;
    } catch (assetErr) {
      console.warn('[UIOverlay] Asset save failed:', assetErr.message);
    }

    return res.json({ success: true, data: { ...overlayType, url, bg_removed, asset_id: assetId } });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
