'use strict';

const express = require('express');
const router = express.Router();
const { optionalAuth } = require('../middleware/auth');

// ── In-memory generation status tracking per show ──
// Tracks progress/errors so the frontend can display feedback
const generationStatus = {};

// GET /api/v1/ui-overlays/:showId — list existing overlays
router.get('/:showId', optionalAuth, async (req, res) => {
  try {
    const models = require('../models');
    const { getShowOverlays, OVERLAY_TYPES } = require('../services/uiOverlayService');
    const showId = req.params.showId;
    const existing = await getShowOverlays(showId, models);

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

    // Include generation status if a generation job is active or recently finished
    const genStatus = generationStatus[showId] || null;

    return res.json({
      success: true,
      data: status,
      generated_count: status.filter(s => s.generated).length,
      total: OVERLAY_TYPES.length,
      generation_status: genStatus,
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
      return res.status(503).json({ success: false, error: 'No image generation API configured. Set FAL_KEY or OPENAI_API_KEY in your environment.' });
    }

    // Check if generation is already running for this show
    if (generationStatus[showId]?.status === 'generating') {
      return res.json({ success: true, message: 'Generation already in progress' });
    }

    // Initialize status tracking
    generationStatus[showId] = {
      status: 'generating',
      started_at: new Date().toISOString(),
      completed: 0,
      failed: 0,
      total: 0,
      errors: [],
    };

    // Return immediately — run generation in background
    res.json({ success: true, message: 'Generation started — polling for progress' });

    // Generate in background with progress tracking
    generateAllOverlays(showId, models, {
      onProgress: (completed, failed, total, error) => {
        generationStatus[showId].completed = completed;
        generationStatus[showId].failed = failed;
        generationStatus[showId].total = total;
        if (error) generationStatus[showId].errors.push(error);
      },
    }).then(results => {
      const successCount = results.filter(r => r.url).length;
      const failCount = results.filter(r => r.error).length;
      console.log(`[UIOverlay] Background generation complete: ${successCount} generated, ${failCount} failed`);
      generationStatus[showId].status = failCount > 0 && successCount === 0 ? 'failed' : 'done';
      generationStatus[showId].finished_at = new Date().toISOString();
      generationStatus[showId].completed = successCount;
      generationStatus[showId].failed = failCount;
      // Clear status after 2 minutes so it doesn't persist forever
      setTimeout(() => { delete generationStatus[showId]; }, 120000);
    }).catch(err => {
      console.error('[UIOverlay] Background generation failed:', err.message);
      generationStatus[showId].status = 'failed';
      generationStatus[showId].errors.push(err.message);
      generationStatus[showId].finished_at = new Date().toISOString();
      setTimeout(() => { delete generationStatus[showId]; }, 120000);
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
        `INSERT INTO assets (id, name, asset_type, s3_url_raw, s3_url_processed, show_id, metadata, created_at, updated_at)
         VALUES (:id, :name, 'UI_OVERLAY', :url, :url, :showId, :metadata, NOW(), NOW())`,
        { replacements: {
          id: assetUuid,
          name: `UI Overlay: ${overlayType.name}`,
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
