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

    // Create Asset
    let asset = null;
    if (models.Asset) {
      try {
        asset = await models.Asset.create({
          id: uuidv4(),
          name: `UI Overlay: ${overlayType.name}`,
          asset_type: 'UI_OVERLAY',
          asset_role: `UI.OVERLAY.${overlayType.id.toUpperCase()}`,
          asset_group: 'SHOW',
          asset_scope: 'SHOW',
          approval_status: 'approved',
          s3_url_raw: url,
          s3_url_processed: url,
          show_id: req.params.showId,
          metadata: {
            source: 'ui-overlay-generator',
            overlay_type: overlayType.id,
            overlay_beat: overlayType.beat,
            bg_removed,
            generated_at: new Date().toISOString(),
          },
        });
      } catch { /* non-blocking */ }
    }

    return res.json({ success: true, data: { ...overlayType, url, bg_removed, asset_id: asset?.id } });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
