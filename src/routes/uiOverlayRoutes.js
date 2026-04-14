'use strict';

const express = require('express');
const router = express.Router();
const multer = require('multer');
const { optionalAuth } = require('../middleware/auth');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// ── In-memory generation status tracking per show ──
// Tracks progress/errors so the frontend can display feedback
const generationStatus = {};

// GET /api/v1/ui-overlays/:showId — list existing overlays (hardcoded + custom)
router.get('/:showId', optionalAuth, async (req, res) => {
  try {
    const models = require('../models');
    const { getAllOverlayTypes } = require('../services/uiOverlayService');
    const showId = req.params.showId;

    // Merge hardcoded defaults + custom overlay types from DB
    const allTypes = await getAllOverlayTypes(showId, models);

    // Direct SQL query — cast metadata to text to avoid JSONB driver issues
    // This is the same pattern used by the /debug endpoint which works reliably
    let existing = [];
    try {
      const [rows] = await models.sequelize.query(
        `SELECT id, name, asset_type, asset_role,
                s3_url_processed, s3_url_raw,
                metadata::text as metadata_text
         FROM assets
         WHERE asset_type = 'UI_OVERLAY' AND show_id = :showId AND deleted_at IS NULL
         ORDER BY created_at DESC`,
        { replacements: { showId } }
      );
      existing = (rows || []).map(r => {
        let meta = {};
        try { meta = r.metadata_text ? JSON.parse(r.metadata_text) : {}; } catch { /* skip */ }
        return {
          id: r.id,
          name: r.name,
          metadata: meta,
          overlay_type: meta.overlay_type || '',
          overlay_category: meta.overlay_category || '',
          url: r.s3_url_processed || r.s3_url_raw,
          bg_removed: meta.bg_removed || false,
          custom_prompt: meta.custom_prompt || null,
        };
      });
    } catch (queryErr) {
      console.error('[UIOverlay] Asset query failed:', queryErr.message);
    }

    // Build a name-to-type lookup for legacy fallback matching
    const typesByName = {};
    allTypes.forEach(ot => { typesByName[ot.name.toLowerCase()] = ot.id; });

    // Map all overlay types to show which are generated vs missing
    const status = allTypes.map(ot => {
      const otId = ot.id.toLowerCase();
      const otName = ot.name.toLowerCase();
      const lifecycle = ot.lifecycle || 'permanent';

      // Find ALL matching assets — strict overlay_type, name fallback only when type is missing
      const allMatches = existing.filter(e => {
        const eType = (e.overlay_type || '').toLowerCase();

        // Primary: exact overlay_type match
        if (eType && eType === otId) return true;

        // Only use name fallback when asset has NO overlay_type (truly legacy)
        if (!eType) {
          const nameOnly = (e.name || '').replace(/^ui overlay:\s*/i, '').replace(/\s*\(.*\)$/, '').trim().toLowerCase();
          if (nameOnly === otName) return true;
        }

        // Special case
        if (otId === 'wardrobe_list' && eType === 'todo_checklist') return true;

        return false;
      });

      // Primary = the one without a variant_label, or first match
      const primary = allMatches.find(e => !e.metadata?.variant_label) || allMatches[0] || null;

      // Build variants array
      const variants = allMatches.length > 1 ? allMatches.map(e => ({
        asset_id: e.id,
        url: e.url,
        variant_label: e.metadata?.variant_label || 'Default',
        screen_links: e.metadata?.screen_links || null,
        image_fit: e.metadata?.image_fit || null,
      })) : null;

      return {
        ...ot,
        lifecycle,
        generated: !!primary,
        url: primary?.url || null,
        asset_id: primary?.id || null,
        bg_removed: primary?.bg_removed || false,
        custom_prompt: primary?.custom_prompt || null,
        screen_links: primary?.metadata?.screen_links || null,
        image_fit: primary?.metadata?.image_fit || null,
        content_zones: primary?.metadata?.content_zones || null,
        // Include overlay_type from asset metadata for debugging
        overlay_type: primary?.metadata?.overlay_type || ot.id,
        variants,
      };
    });

    const genStatus = generationStatus[showId] || null;

    return res.json({
      success: true,
      data: status,
      generated_count: status.filter(s => s.generated).length,
      total: allTypes.length,
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

// GET /api/v1/ui-overlays/:showId/debug — diagnose overlay matching issues
router.get('/:showId/debug', optionalAuth, async (req, res) => {
  try {
    const models = require('../models');
    const { getAllOverlayTypes } = require('../services/uiOverlayService');
    const showId = req.params.showId;

    // Get all overlay assets for this show
    const [allAssets] = await models.sequelize.query(
      `SELECT id, name, asset_type,
              metadata->>'overlay_type' as overlay_type,
              metadata->>'overlay_category' as overlay_category,
              metadata->>'source' as source,
              CASE WHEN s3_url_processed IS NOT NULL OR s3_url_raw IS NOT NULL THEN true ELSE false END as has_image,
              created_at
       FROM assets
       WHERE asset_type = 'UI_OVERLAY' AND show_id = :showId AND deleted_at IS NULL
       ORDER BY created_at DESC`,
      { replacements: { showId } }
    );

    // Get all type definitions
    const allTypes = await getAllOverlayTypes(showId, models);

    // Show which assets match which types
    const matching = allTypes.map(ot => {
      const matched = allAssets.filter(a => {
        if ((a.overlay_type || '').toLowerCase() === ot.id.toLowerCase()) return true;
        const nameOnly = (a.name || '').replace(/^ui overlay:\s*/i, '').replace(/\s*\(.*\)$/, '').trim().toLowerCase();
        if (nameOnly === ot.name.toLowerCase()) return true;
        return false;
      });
      return {
        type_id: ot.id,
        type_name: ot.name,
        type_category: ot.category,
        matched_assets: matched.length,
        assets: matched.map(a => ({
          asset_id: a.id,
          name: a.name,
          overlay_type: a.overlay_type,
          overlay_category: a.overlay_category,
          has_image: a.has_image,
        })),
      };
    });

    // Find orphaned assets (don't match any type)
    const matchedIds = new Set();
    matching.forEach(m => m.assets.forEach(a => matchedIds.add(a.asset_id)));
    const orphaned = allAssets.filter(a => !matchedIds.has(a.id)).map(a => ({
      asset_id: a.id,
      name: a.name,
      overlay_type: a.overlay_type,
      overlay_category: a.overlay_category,
      source: a.source,
    }));

    return res.json({
      success: true,
      show_id: showId,
      total_assets: allAssets.length,
      total_types: allTypes.length,
      matched_types: matching.filter(m => m.matched_assets > 0).length,
      orphaned_assets: orphaned.length,
      matching,
      orphaned,
      fix_hint: orphaned.length > 0
        ? 'Orphaned assets have overlay_type values that don\'t match any type definition. Re-upload them to fix.'
        : 'All assets matched correctly.',
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/v1/ui-overlays/:showId/generate/:overlayType — generate (or regenerate) single overlay
router.post('/:showId/generate/:overlayType', optionalAuth, async (req, res) => {
  try {
    const models = require('../models');
    const { generateOverlay, getAllOverlayTypes } = require('../services/uiOverlayService');
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
// Optional body field: variant_label (e.g. "Locked", "Unlocked") — defaults to replacing the single asset
router.post('/:showId/upload/:overlayType', optionalAuth, upload.single('image'), async (req, res) => {
  try {
    const models = require('../models');
    const { getAllOverlayTypes, uploadOverlayToS3 } = require('../services/uiOverlayService');
    const { v4: uuidv4 } = require('uuid');
    const showId = req.params.showId;
    const variantLabel = req.body?.variant_label || null;

    const allTypes = await getAllOverlayTypes(showId, models);
    const overlayType = allTypes.find(ot => ot.id === req.params.overlayType);
    if (!overlayType) return res.status(404).json({ success: false, error: `Unknown overlay type: ${req.params.overlayType}` });
    if (!req.file) return res.status(400).json({ success: false, error: 'No image file uploaded' });

    // Soft-delete existing asset for this variant (or all if no variant specified)
    if (variantLabel) {
      await models.sequelize.query(
        `UPDATE assets SET deleted_at = NOW() WHERE asset_type = 'UI_OVERLAY' AND show_id = :showId
         AND metadata->>'overlay_type' = :overlayId AND metadata->>'variant_label' = :variantLabel AND deleted_at IS NULL`,
        { replacements: { showId, overlayId: overlayType.id, variantLabel } }
      );
    } else {
      await models.sequelize.query(
        `UPDATE assets SET deleted_at = NOW() WHERE asset_type = 'UI_OVERLAY' AND show_id = :showId
         AND metadata->>'overlay_type' = :overlayId AND (metadata->>'variant_label' IS NULL OR metadata->>'variant_label' = '') AND deleted_at IS NULL`,
        { replacements: { showId, overlayId: overlayType.id } }
      );
    }

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
          name: `UI Overlay: ${overlayType.name}${variantLabel ? ` (${variantLabel})` : ''}`,
          url,
          showId,
          metadata: JSON.stringify({
            source: 'custom-upload', overlay_type: overlayType.id,
            overlay_beat: overlayType.beat, overlay_category: overlayType.category,
            uploaded_at: new Date().toISOString(), original_filename: req.file.originalname,
            ...(variantLabel ? { variant_label: variantLabel } : {}),
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

// ── PHONE FRAME (custom device frame image) ────────────────────────────────

// POST /api/v1/ui-overlays/:showId/frame — upload a custom phone frame image
router.post('/:showId/frame', optionalAuth, upload.single('frame'), async (req, res) => {
  try {
    const models = require('../models');
    const { uploadOverlayToS3 } = require('../services/uiOverlayService');
    const showId = req.params.showId;

    if (!req.file) return res.status(400).json({ success: false, error: 'No frame file uploaded' });

    const url = await uploadOverlayToS3(req.file.buffer, 'phone-frame', showId, req.file.mimetype);

    // Save frame URL using PageContent model
    const PageContent = models.PageContent;
    if (PageContent) {
      await PageContent.upsert(
        { page_name: `phone_hub_${showId}`, constant_key: 'FRAME_URL', data: { frame_url: url } },
        { conflictFields: ['page_name', 'constant_key'] }
      );
    }

    return res.json({ success: true, frame_url: url });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/v1/ui-overlays/:showId/frame — get saved phone frame URL + global fit
router.get('/:showId/frame', optionalAuth, async (req, res) => {
  try {
    const models = require('../models');
    const showId = req.params.showId;
    const PageContent = models.PageContent;

    let frame_url = null;
    let global_fit = null;

    if (PageContent) {
      const frameRow = await PageContent.findOne({ where: { page_name: `phone_hub_${showId}`, constant_key: 'FRAME_URL' } });
      if (frameRow?.data) frame_url = frameRow.data.frame_url || null;

      const fitRow = await PageContent.findOne({ where: { page_name: `phone_hub_${showId}`, constant_key: 'GLOBAL_FIT' } });
      if (fitRow?.data) global_fit = fitRow.data.global_fit || null;
    }

    return res.json({ success: true, frame_url, global_fit });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/v1/ui-overlays/:showId/frame — remove custom phone frame, revert to built-in
router.delete('/:showId/frame', optionalAuth, async (req, res) => {
  try {
    const models = require('../models');
    const showId = req.params.showId;
    const PageContent = models.PageContent;

    if (PageContent) {
      await PageContent.destroy({ where: { page_name: `phone_hub_${showId}`, constant_key: 'FRAME_URL' } });
    }

    return res.json({ success: true, frame_url: null });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/v1/ui-overlays/:showId/global-fit — save global image fit settings for all screens
router.put('/:showId/global-fit', optionalAuth, async (req, res) => {
  try {
    const models = require('../models');
    const showId = req.params.showId;
    const { global_fit } = req.body;

    const PageContent = models.PageContent;
    if (PageContent) {
      await PageContent.upsert(
        { page_name: `phone_hub_${showId}`, constant_key: 'GLOBAL_FIT', data: { global_fit } },
        { conflictFields: ['page_name', 'constant_key'] }
      );
    }

    return res.json({ success: true, global_fit });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ── CATEGORY OVERRIDE (screen vs icon for built-in types) ───────────────

// PUT /api/v1/ui-overlays/:showId/category/:assetId — set category on asset metadata
// When switching between screen and icon, also update overlay_type to match
router.put('/:showId/category/:assetId', optionalAuth, async (req, res) => {
  try {
    const models = require('../models');
    const { category } = req.body;
    if (!category) return res.status(400).json({ success: false, error: 'category is required' });

    // Only update overlay_category — overlay_type stays the same since there's
    // no reliable mapping between screen/icon type IDs (e.g., wardrobe ≠ icon_closet)
    const patch = { overlay_category: category };

    await models.sequelize.query(
      `UPDATE assets
       SET metadata = COALESCE(metadata, '{}'::jsonb) || CAST(:patch AS jsonb),
           updated_at = NOW()
       WHERE id = :assetId AND show_id = :showId AND deleted_at IS NULL`,
      { replacements: {
        assetId: req.params.assetId,
        showId: req.params.showId,
        patch: JSON.stringify(patch),
      } }
    );

    return res.json({ success: true, category });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ── IMAGE FIT (resize/position settings) ────────────────────────────────

// PUT /api/v1/ui-overlays/:showId/image-fit/:assetId — save image fit settings
router.put('/:showId/image-fit/:assetId', optionalAuth, async (req, res) => {
  try {
    const models = require('../models');
    const { image_fit } = req.body;

    // Allow null to clear per-screen override, otherwise must be an object
    if (image_fit !== null && (!image_fit || typeof image_fit !== 'object')) {
      return res.status(400).json({ success: false, error: 'image_fit must be an object or null' });
    }

    await models.sequelize.query(
      `UPDATE assets
       SET metadata = COALESCE(metadata, '{}'::jsonb) || CAST(:patch AS jsonb),
           updated_at = NOW()
       WHERE id = :assetId AND show_id = :showId AND deleted_at IS NULL`,
      { replacements: {
        assetId: req.params.assetId,
        showId: req.params.showId,
        patch: JSON.stringify({ image_fit }),
      } }
    );

    return res.json({ success: true, image_fit });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ── SCREEN LINKS (tap zones with icon overlays) ───────────────────────────

// PUT /api/v1/ui-overlays/:showId/screen-links/:assetId — save screen links for an overlay
router.put('/:showId/screen-links/:assetId', optionalAuth, async (req, res) => {
  try {
    const models = require('../models');
    const { screen_links } = req.body;

    if (!Array.isArray(screen_links)) {
      return res.status(400).json({ success: false, error: 'screen_links must be an array' });
    }

    // Merge screen_links into existing metadata
    await models.sequelize.query(
      `UPDATE assets
       SET metadata = COALESCE(metadata, '{}'::jsonb) || CAST(:patch AS jsonb),
           updated_at = NOW()
       WHERE id = :assetId AND show_id = :showId AND deleted_at IS NULL`,
      { replacements: {
        assetId: req.params.assetId,
        showId: req.params.showId,
        patch: JSON.stringify({ screen_links }),
      } }
    );

    return res.json({ success: true, screen_links });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/v1/ui-overlays/:showId/screen-links/:assetId — get screen links for an overlay
router.get('/:showId/screen-links/:assetId', optionalAuth, async (req, res) => {
  try {
    const models = require('../models');

    const [rows] = await models.sequelize.query(
      `SELECT metadata::text as metadata_text FROM assets
       WHERE id = :assetId AND show_id = :showId AND deleted_at IS NULL`,
      { replacements: { assetId: req.params.assetId, showId: req.params.showId } }
    );

    if (!rows?.length) return res.status(404).json({ success: false, error: 'Asset not found' });

    let meta = {};
    try { meta = JSON.parse(rows[0].metadata_text || '{}'); } catch { /* skip */ }

    return res.json({ success: true, screen_links: meta.screen_links || [] });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/v1/ui-overlays/:showId/screen-links/:assetId/icon — upload icon image for a link zone
router.post('/:showId/screen-links/:assetId/icon', optionalAuth, upload.single('icon'), async (req, res) => {
  try {
    const models = require('../models');
    const { uploadOverlayToS3 } = require('../services/uiOverlayService');
    const { link_id } = req.body;

    if (!req.file) return res.status(400).json({ success: false, error: 'No icon file uploaded' });
    if (!link_id) return res.status(400).json({ success: false, error: 'link_id is required' });

    // Upload icon to S3
    const url = await uploadOverlayToS3(
      req.file.buffer,
      `screen-icon-${link_id}`,
      req.params.showId,
      req.file.mimetype
    );

    // Update the matching link's icon_url in the asset metadata
    const [rows] = await models.sequelize.query(
      `SELECT metadata::text as metadata_text FROM assets
       WHERE id = :assetId AND show_id = :showId AND deleted_at IS NULL`,
      { replacements: { assetId: req.params.assetId, showId: req.params.showId } }
    );

    if (rows?.length) {
      let meta = {};
      try { meta = JSON.parse(rows[0].metadata_text || '{}'); } catch { /* skip */ }
      const links = meta.screen_links || [];
      const link = links.find(l => l.id === link_id);
      if (link) {
        link.icon_url = url;
        await models.sequelize.query(
          `UPDATE assets SET metadata = CAST(:metadata AS jsonb), updated_at = NOW()
           WHERE id = :assetId AND show_id = :showId AND deleted_at IS NULL`,
          { replacements: {
            assetId: req.params.assetId,
            showId: req.params.showId,
            metadata: JSON.stringify(meta),
          } }
        );
      }
    }

    return res.json({ success: true, icon_url: url, link_id });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ── CONTENT ZONES (Live data rendering on templates) ────────────────────────

// PUT /api/v1/ui-overlays/:showId/content-zones/:assetId — save content zones for an overlay
router.put('/:showId/content-zones/:assetId', optionalAuth, async (req, res) => {
  try {
    const models = require('../models');
    const { content_zones } = req.body;

    if (!Array.isArray(content_zones)) {
      return res.status(400).json({ success: false, error: 'content_zones must be an array' });
    }

    await models.sequelize.query(
      `UPDATE assets
       SET metadata = COALESCE(metadata, '{}'::jsonb) || CAST(:patch AS jsonb),
           updated_at = NOW()
       WHERE id = :assetId AND show_id = :showId AND deleted_at IS NULL`,
      { replacements: {
        assetId: req.params.assetId,
        showId: req.params.showId,
        patch: JSON.stringify({ content_zones }),
      } }
    );

    return res.json({ success: true, content_zones });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/v1/ui-overlays/:showId/content-zones/:assetId — get content zones for an overlay
router.get('/:showId/content-zones/:assetId', optionalAuth, async (req, res) => {
  try {
    const models = require('../models');

    const [rows] = await models.sequelize.query(
      `SELECT metadata::text as metadata_text FROM assets
       WHERE id = :assetId AND show_id = :showId AND deleted_at IS NULL`,
      { replacements: { assetId: req.params.assetId, showId: req.params.showId } }
    );

    if (!rows?.length) return res.status(404).json({ success: false, error: 'Asset not found' });

    let meta = {};
    try { meta = JSON.parse(rows[0].metadata_text || '{}'); } catch { /* skip */ }

    return res.json({ success: true, content_zones: meta.content_zones || [] });
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

// DELETE /api/v1/ui-overlays/:showId/types/:typeId — permanently delete a custom overlay type
router.delete('/:showId/types/:typeId', optionalAuth, async (req, res) => {
  try {
    const models = require('../models');
    await models.sequelize.query(
      `DELETE FROM ui_overlay_types WHERE id = :typeId AND show_id = :showId`,
      { replacements: { typeId: req.params.typeId, showId: req.params.showId } }
    );
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/v1/ui-overlays/:showId/asset/:assetId — permanently delete an overlay asset
router.delete('/:showId/asset/:assetId', optionalAuth, async (req, res) => {
  try {
    const models = require('../models');
    const { showId, assetId } = req.params;

    // Hard delete — permanently remove from database
    const [rows] = await models.sequelize.query(
      `DELETE FROM assets
       WHERE id = :assetId AND show_id = :showId
       RETURNING id`,
      { replacements: { assetId, showId } }
    );

    if (!rows?.length) {
      return res.status(404).json({ success: false, error: 'Asset not found' });
    }

    return res.json({ success: true, message: 'Asset permanently deleted' });
  } catch (err) {
    console.error('[UIOverlays] Delete asset error:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
