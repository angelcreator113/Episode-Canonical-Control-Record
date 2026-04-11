'use strict';

const express = require('express');
const router = express.Router();
const multer = require('multer');
const { optionalAuth } = require('../middleware/auth');

// GET /api/v1/ui-overlays/:showId — list existing overlays
router.get('/:showId', optionalAuth, async (req, res) => {
  try {
    const models = require('../models');
    const { getShowOverlays, OVERLAY_TYPES } = require('../services/uiOverlayService');
    const existing = await getShowOverlays(req.params.showId, models);

    // Map all overlay types to show which are generated vs missing
    const status = allTypes.map(ot => {
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

// POST /api/v1/ui-overlays/:showId/generate/:overlayType — generate (or regenerate) single overlay
router.post('/:showId/generate/:overlayType', optionalAuth, async (req, res) => {
  try {
    const { generateOverlay, OVERLAY_TYPES } = require('../services/uiOverlayService');
    const { v4: uuidv4 } = require('uuid');
    const showId = req.params.showId;
    const customPrompt = req.body?.prompt || null;

    const allTypes = await getAllOverlayTypes(showId, models);
    const overlayType = allTypes.find(ot => ot.id === req.params.overlayType);
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
         VALUES (:id, :name, 'UI_OVERLAY', :url, :url, :showId, :metadata, NOW(), NOW())`,
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
    const { getAllOverlayTypes, uploadOverlayToS3 } = require('../services/uiOverlayService');
    const { v4: uuidv4 } = require('uuid');
    const showId = req.params.showId;

    const allTypes = await getAllOverlayTypes(showId, models);
    const overlayType = allTypes.find(ot => ot.id === req.params.overlayType);
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

// ── CUSTOM OVERLAY TYPE CRUD ────────────────────────────────────────────────

// POST /api/v1/ui-overlays/:showId/types — create a custom overlay type
router.post('/:showId/types', optionalAuth, async (req, res) => {
  try {
    const models = require('../models');
    const { v4: uuidv4 } = require('uuid');
    const showId = req.params.showId;
    const { name, category, beat, description, prompt, type_key } = req.body;

    if (!name || !prompt) {
      return res.status(400).json({ success: false, error: 'name and prompt are required' });
    }

    // Generate type_key from name if not provided
    const key = type_key || name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/(^_|_$)/g, '');

    // Check for duplicate key
    const [existing] = await models.sequelize.query(
      `SELECT id FROM ui_overlay_types WHERE show_id = :showId AND type_key = :key AND deleted_at IS NULL`,
      { replacements: { showId, key } }
    );
    if (existing?.length) {
      return res.status(409).json({ success: false, error: `Overlay type "${key}" already exists` });
    }

    const id = uuidv4();
    await models.sequelize.query(
      `INSERT INTO ui_overlay_types (id, show_id, type_key, name, category, beat, description, prompt, sort_order, created_at, updated_at)
       VALUES (:id, :showId, :key, :name, :category, :beat, :description, :prompt, :sortOrder, NOW(), NOW())`,
      { replacements: {
        id, showId, key, name,
        category: category || 'icon',
        beat: beat || 'Various',
        description: description || '',
        prompt,
        sortOrder: req.body.sort_order || 100,
      } }
    );

    return res.json({ success: true, data: { id, type_key: key, name, category: category || 'icon', beat: beat || 'Various', description, prompt } });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/v1/ui-overlays/:showId/types/:typeId — update a custom overlay type
router.put('/:showId/types/:typeId', optionalAuth, async (req, res) => {
  try {
    const models = require('../models');
    const { name, category, beat, description, prompt, sort_order } = req.body;

    const sets = [];
    const replacements = { typeId: req.params.typeId, showId: req.params.showId };

    if (name !== undefined) { sets.push('name = :name'); replacements.name = name; }
    if (category !== undefined) { sets.push('category = :category'); replacements.category = category; }
    if (beat !== undefined) { sets.push('beat = :beat'); replacements.beat = beat; }
    if (description !== undefined) { sets.push('description = :description'); replacements.description = description; }
    if (prompt !== undefined) { sets.push('prompt = :prompt'); replacements.prompt = prompt; }
    if (sort_order !== undefined) { sets.push('sort_order = :sortOrder'); replacements.sortOrder = sort_order; }

    if (sets.length === 0) {
      return res.status(400).json({ success: false, error: 'No fields to update' });
    }

    sets.push('updated_at = NOW()');
    await models.sequelize.query(
      `UPDATE ui_overlay_types SET ${sets.join(', ')} WHERE id = :typeId AND show_id = :showId AND deleted_at IS NULL`,
      { replacements }
    );

    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/v1/ui-overlays/:showId/types/:typeId — soft-delete a custom overlay type
router.delete('/:showId/types/:typeId', optionalAuth, async (req, res) => {
  try {
    const models = require('../models');
    await models.sequelize.query(
      `UPDATE ui_overlay_types SET deleted_at = NOW() WHERE id = :typeId AND show_id = :showId AND deleted_at IS NULL`,
      { replacements: { typeId: req.params.typeId, showId: req.params.showId } }
    );
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
