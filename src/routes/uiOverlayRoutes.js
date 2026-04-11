'use strict';

const express = require('express');
const router = express.Router();
const multer = require('multer');
const { optionalAuth } = require('../middleware/auth');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

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
        bg_removed: found?.metadata?.bg_removed || false,
        custom_prompt: found?.metadata?.custom_prompt || null,
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

// POST /api/v1/ui-overlays/:showId/generate/:overlayType — generate (or regenerate) single overlay
router.post('/:showId/generate/:overlayType', optionalAuth, async (req, res) => {
  try {
    const models = require('../models');
    const { generateOverlay, OVERLAY_TYPES } = require('../services/uiOverlayService');
    const { v4: uuidv4 } = require('uuid');
    const showId = req.params.showId;
    const customPrompt = req.body?.prompt || null;

    const overlayType = OVERLAY_TYPES.find(ot => ot.id === req.params.overlayType);
    if (!overlayType) return res.status(404).json({ success: false, error: `Unknown overlay type: ${req.params.overlayType}` });

    // Soft-delete existing asset for this overlay type (regeneration)
    await models.sequelize.query(
      `UPDATE assets SET deleted_at = NOW() WHERE asset_type = 'UI_OVERLAY' AND show_id = :showId
       AND metadata->>'overlay_type' = :overlayId AND deleted_at IS NULL`,
      { replacements: { showId, overlayId: overlayType.id } }
    );

    const { url, bg_removed, prompt_used } = await generateOverlay(overlayType, showId, { customPrompt });

    // Create Asset via raw SQL
    let assetId = null;
    try {
      const assetUuid = uuidv4();
      await models.sequelize.query(
        `INSERT INTO assets (id, name, asset_type, s3_url_raw, s3_url_processed, show_id, metadata, created_at, updated_at)
         VALUES (:id, :name, 'UI_OVERLAY', :url, :url, :showId, CAST(:metadata AS jsonb), NOW(), NOW())`,
        { replacements: {
          id: assetUuid,
          name: `UI Overlay: ${overlayType.name}`,
          url,
          showId,
          metadata: JSON.stringify({
            source: 'ui-overlay-generator', overlay_type: overlayType.id,
            overlay_beat: overlayType.beat, overlay_category: overlayType.category,
            bg_removed, generated_at: new Date().toISOString(),
            ...(customPrompt ? { custom_prompt: customPrompt } : {}),
          }),
        } }
      );
      assetId = assetUuid;
    } catch (assetErr) {
      console.warn('[UIOverlay] Asset save failed:', assetErr.message);
    }

    return res.json({ success: true, data: { ...overlayType, url, bg_removed, asset_id: assetId, prompt_used } });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/v1/ui-overlays/:showId/remove-bg/:assetId — remove background from existing overlay
router.post('/:showId/remove-bg/:assetId', optionalAuth, async (req, res) => {
  try {
    const models = require('../models');
    const { removeBackgroundFromAsset } = require('../services/uiOverlayService');

    if (!process.env.REMOVEBG_API_KEY) {
      return res.status(503).json({ success: false, error: 'Background removal not configured. Set REMOVEBG_API_KEY.' });
    }

    const result = await removeBackgroundFromAsset(req.params.assetId, models);
    return res.json({ success: true, data: result });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/v1/ui-overlays/:showId/upload/:overlayType — upload custom image for an overlay
router.post('/:showId/upload/:overlayType', optionalAuth, upload.single('image'), async (req, res) => {
  try {
    const models = require('../models');
    const { OVERLAY_TYPES, uploadOverlayToS3 } = require('../services/uiOverlayService');
    const { v4: uuidv4 } = require('uuid');
    const showId = req.params.showId;

    const overlayType = OVERLAY_TYPES.find(ot => ot.id === req.params.overlayType);
    if (!overlayType) return res.status(404).json({ success: false, error: `Unknown overlay type: ${req.params.overlayType}` });
    if (!req.file) return res.status(400).json({ success: false, error: 'No image file uploaded' });

    // Soft-delete existing asset
    await models.sequelize.query(
      `UPDATE assets SET deleted_at = NOW() WHERE asset_type = 'UI_OVERLAY' AND show_id = :showId
       AND metadata->>'overlay_type' = :overlayId AND deleted_at IS NULL`,
      { replacements: { showId, overlayId: overlayType.id } }
    );

    // Upload to S3
    const url = await uploadOverlayToS3(req.file.buffer, overlayType.id, showId, req.file.mimetype);

    // Create Asset
    let assetId = null;
    try {
      const assetUuid = uuidv4();
      await models.sequelize.query(
        `INSERT INTO assets (id, name, asset_type, s3_url_raw, s3_url_processed, show_id, metadata, created_at, updated_at)
         VALUES (:id, :name, 'UI_OVERLAY', :url, :url, :showId, CAST(:metadata AS jsonb), NOW(), NOW())`,
        { replacements: {
          id: assetUuid,
          name: `UI Overlay: ${overlayType.name}`,
          url,
          showId,
          metadata: JSON.stringify({
            source: 'custom-upload', overlay_type: overlayType.id,
            overlay_beat: overlayType.beat, overlay_category: overlayType.category,
            uploaded_at: new Date().toISOString(), original_filename: req.file.originalname,
          }),
        } }
      );
      assetId = assetUuid;
    } catch (assetErr) {
      console.warn('[UIOverlay] Asset save failed:', assetErr.message);
    }

    return res.json({ success: true, data: { ...overlayType, url, asset_id: assetId, generated: true } });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
