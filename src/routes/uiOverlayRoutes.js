'use strict';

const express = require('express');
const router = express.Router();
const multer = require('multer');
const { optionalAuth } = require('../middleware/auth');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// ── In-memory generation status tracking per show ──
// Tracks progress/errors so the frontend can display feedback
const generationStatus = {};

// GET /api/v1/ui-overlays/:showId — list existing overlays (all from DB)
router.get('/:showId', optionalAuth, async (req, res) => {
  try {
    const models = require('../models');
    const { getAllOverlayTypes } = require('../services/uiOverlayService');
    const showId = req.params.showId;

    // All overlay types come from the DB
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
          overlay_type: meta.overlay_type || r.name,
          url: r.s3_url_processed || r.s3_url_raw,
          bg_removed: meta.bg_removed || false,
          custom_prompt: meta.custom_prompt || null,
        };
      });
    } catch (queryErr) {
      console.error('[UIOverlay] Asset query failed:', queryErr.message);
    }

    // Map all overlay types to show which are generated vs missing
    // Use case-insensitive matching and check name patterns to handle
    // assets stored with different naming conventions
    const status = allTypes.map(ot => {
      const otId = ot.id.toLowerCase();
      const otName = ot.name.toLowerCase();
      const lifecycle = ot.lifecycle || 'permanent';

      // Find ALL matching assets (variants)
      const allMatches = existing.filter(e => {
        const eType = (e.overlay_type || '').toLowerCase();
        const eName = (e.name || '').toLowerCase();
        return eType === otId
          || eName === `ui overlay: ${otName}`
          || eName.includes(otId.replace(/_/g, ' '))
          || (otId === 'wardrobe_list' && eType === 'todo_checklist');
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
        // Category override from asset metadata (for built-in types reassigned by user)
        ...(primary?.metadata?.overlay_category ? { category: primary.metadata.overlay_category } : {}),
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

// GET /api/v1/ui-overlays/:showId/debug — diagnose why overlays might not be showing
router.get('/:showId/debug', optionalAuth, async (req, res) => {
  try {
    const models = require('../models');
    const showId = req.params.showId;

    // Raw count of all overlay-related assets for this show
    const [allAssets] = await models.sequelize.query(
      `SELECT id, name, asset_type, asset_role, s3_url_processed, s3_url_raw,
              CASE WHEN metadata IS NOT NULL THEN substring(metadata::text, 1, 200) ELSE NULL END as metadata_preview,
              created_at
       FROM assets
       WHERE show_id = :showId AND deleted_at IS NULL
       AND (asset_type IN ('UI_OVERLAY', 'ui_overlay') OR asset_role LIKE 'UI.OVERLAY.%' OR name LIKE 'UI Overlay:%')
       ORDER BY created_at DESC
       LIMIT 50`,
      { replacements: { showId } }
    );

    // Count by asset_type
    const [typeCounts] = await models.sequelize.query(
      `SELECT asset_type, COUNT(*) as count FROM assets
       WHERE show_id = :showId AND deleted_at IS NULL
       GROUP BY asset_type ORDER BY count DESC LIMIT 20`,
      { replacements: { showId } }
    );

    // Also search across ALL shows for any overlay assets (in case show_id mismatch)
    let globalOverlays = [];
    if (allAssets.length === 0) {
      const [global] = await models.sequelize.query(
        `SELECT id, name, asset_type, asset_role, show_id, s3_url_processed, s3_url_raw,
                CASE WHEN metadata IS NOT NULL THEN substring(metadata::text, 1, 200) ELSE NULL END as metadata_preview,
                created_at
         FROM assets
         WHERE deleted_at IS NULL
         AND (asset_type IN ('UI_OVERLAY', 'ui_overlay') OR asset_role LIKE 'UI.OVERLAY.%' OR name LIKE 'UI Overlay:%' OR name LIKE '%overlay%')
         ORDER BY created_at DESC LIMIT 30`
      );
      globalOverlays = global || [];
    }

    // Check total asset count for this show to make sure show_id is valid
    const [showAssetCount] = await models.sequelize.query(
      'SELECT COUNT(*) as count FROM assets WHERE show_id = :showId AND deleted_at IS NULL',
      { replacements: { showId } }
    );

    return res.json({
      success: true,
      show_id: showId,
      total_assets_for_show: parseInt(showAssetCount?.[0]?.count || 0),
      overlay_assets_found: allAssets.length,
      assets: allAssets,
      asset_type_counts: typeCounts,
      global_overlay_search: globalOverlays.length > 0 ? {
        found: globalOverlays.length,
        assets: globalOverlays,
        note: 'These overlay assets exist in OTHER shows — they may need to be re-linked to your current show_id',
      } : null,
      hint: allAssets.length === 0
        ? globalOverlays.length > 0
          ? `No overlay assets for this show_id, but found ${globalOverlays.length} in other shows. The show_id might be wrong.`
          : 'No overlay assets found anywhere. They may need to be regenerated.'
        : `Found ${allAssets.length} overlay assets. Check metadata.overlay_type values match the type definitions.`,
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

// ── STYLE PREFIX (per-show design language for AI generation) ────────────

// GET /api/v1/ui-overlays/:showId/style-prefix — get show's style prefix
router.get('/:showId/style-prefix', optionalAuth, async (req, res) => {
  try {
    const models = require('../models');
    const { getStylePrefix, DEFAULT_STYLE_PREFIX } = require('../services/uiOverlayService');
    const prefix = await getStylePrefix(req.params.showId, models);
    return res.json({ success: true, style_prefix: prefix.trim(), default_prefix: DEFAULT_STYLE_PREFIX.trim() });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/v1/ui-overlays/:showId/style-prefix — set show's style prefix
router.put('/:showId/style-prefix', optionalAuth, async (req, res) => {
  try {
    const models = require('../models');
    const { style_prefix } = req.body;
    if (style_prefix === undefined) return res.status(400).json({ success: false, error: 'style_prefix is required' });

    await models.sequelize.query(
      `UPDATE shows SET style_prefix = :prefix, updated_at = NOW() WHERE id = :showId AND deleted_at IS NULL`,
      { replacements: { prefix: style_prefix || null, showId: req.params.showId } }
    );
    return res.json({ success: true, style_prefix: style_prefix || null });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ── CATEGORY OVERRIDE (screen vs icon for built-in types) ───────────────

// PUT /api/v1/ui-overlays/:showId/category/:assetId — set category on asset metadata
router.put('/:showId/category/:assetId', optionalAuth, async (req, res) => {
  try {
    const models = require('../models');
    const { category, name } = req.body;
    if (!category && !name) return res.status(400).json({ success: false, error: 'category or name is required' });

    const patch = {};
    if (category) patch.overlay_category = category;

    const setClauses = ['updated_at = NOW()'];
    const replacements = { assetId: req.params.assetId, showId: req.params.showId };

    if (Object.keys(patch).length > 0) {
      setClauses.push(`metadata = COALESCE(metadata, '{}'::jsonb) || CAST(:patch AS jsonb)`);
      replacements.patch = JSON.stringify(patch);
    }
    if (name) {
      setClauses.push('name = :name');
      replacements.name = name;
    }

    await models.sequelize.query(
      `UPDATE assets SET ${setClauses.join(', ')} WHERE id = :assetId AND show_id = :showId AND deleted_at IS NULL`,
      { replacements }
    );

    return res.json({ success: true, category, name });
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
    const { validateScreenLinks } = require('../services/phoneConditionSchema');
    const { screen_links } = req.body;

    if (!Array.isArray(screen_links)) {
      return res.status(400).json({ success: false, error: 'screen_links must be an array' });
    }

    // Validate any conditions/actions before persisting — rejects unknown action types
    // and malformed rules. Zones without conditions/actions pass through untouched.
    const { error, value: validatedLinks } = validateScreenLinks(screen_links);
    if (error) {
      return res.status(400).json({ success: false, error });
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
        patch: JSON.stringify({ screen_links: validatedLinks }),
      } }
    );

    return res.json({ success: true, screen_links: validatedLinks });
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

// ── SUGGEST LINKED SCREENS ─────────────────────────────────────────────────

// GET /api/v1/ui-overlays/:showId/types/suggest-links/:iconName — suggest screens for an icon to link to
router.get('/:showId/types/suggest-links/:iconName', optionalAuth, async (req, res) => {
  try {
    const models = require('../models');
    const { suggestLinkedScreens } = require('../services/uiOverlayService');
    const suggestions = await suggestLinkedScreens(req.params.showId, decodeURIComponent(req.params.iconName), models);
    return res.json({ success: true, data: suggestions });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ── OVERLAY TYPE CRUD ─────────────────────────────────────────────────────

// POST /api/v1/ui-overlays/:showId/types — create an overlay type
router.post('/:showId/types', optionalAuth, async (req, res) => {
  try {
    const models = require('../models');
    const { v4: uuidv4 } = require('uuid');
    const showId = req.params.showId;
    const { name, category, beat, description, prompt, type_key, opens_screen, is_home } = req.body;

    if (!name || !prompt) {
      return res.status(400).json({ success: false, error: 'name and prompt are required' });
    }

    // Generate type_key from name if not provided
    const key = type_key || name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/(^_|_$)/g, '');

    // If marking as home, unset any existing home screen for this show
    if (is_home) {
      await models.sequelize.query(
        `UPDATE ui_overlay_types SET is_home = false, updated_at = NOW() WHERE show_id = :showId AND is_home = true AND deleted_at IS NULL`,
        { replacements: { showId } }
      );
    }

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
      `INSERT INTO ui_overlay_types (id, show_id, type_key, name, category, beat, description, prompt, sort_order, opens_screen, is_home, created_at, updated_at)
       VALUES (:id, :showId, :key, :name, :category, :beat, :description, :prompt, :sortOrder, :opensScreen, :isHome, NOW(), NOW())`,
      { replacements: {
        id, showId, key, name,
        category: category || 'phone',
        beat: beat || 'Various',
        description: description || '',
        prompt,
        sortOrder: req.body.sort_order || 100,
        opensScreen: opens_screen || null,
        isHome: !!is_home,
      } }
    );

    return res.json({ success: true, data: { id, type_key: key, name, category: category || 'phone', beat: beat || 'Various', description, prompt, opens_screen: opens_screen || null } });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/v1/ui-overlays/:showId/types/:typeId — update a custom overlay type
router.put('/:showId/types/:typeId', optionalAuth, async (req, res) => {
  try {
    const models = require('../models');
    const { name, category, beat, description, prompt, sort_order, opens_screen, is_home } = req.body;

    const sets = [];
    const replacements = { typeId: req.params.typeId, showId: req.params.showId };

    if (name !== undefined) { sets.push('name = :name'); replacements.name = name; }
    if (category !== undefined) { sets.push('category = :category'); replacements.category = category; }
    if (beat !== undefined) { sets.push('beat = :beat'); replacements.beat = beat; }
    if (description !== undefined) { sets.push('description = :description'); replacements.description = description; }
    if (prompt !== undefined) { sets.push('prompt = :prompt'); replacements.prompt = prompt; }
    if (sort_order !== undefined) { sets.push('sort_order = :sortOrder'); replacements.sortOrder = sort_order; }
    if (opens_screen !== undefined) { sets.push('opens_screen = :opensScreen'); replacements.opensScreen = opens_screen; }
    if (is_home !== undefined) {
      sets.push('is_home = :isHome'); replacements.isHome = !!is_home;
      // If marking as home, unset any existing home screen first
      if (is_home) {
        await models.sequelize.query(
          `UPDATE ui_overlay_types SET is_home = false, updated_at = NOW() WHERE show_id = :showId AND is_home = true AND deleted_at IS NULL AND id != :typeId`,
          { replacements: { showId: req.params.showId, typeId: req.params.typeId } }
        );
      }
    }

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
    const showId = req.params.showId;

    // Get the type_key before deleting (needed for orphan cleanup)
    const [rows] = await models.sequelize.query(
      `UPDATE ui_overlay_types SET deleted_at = NOW() WHERE id = :typeId AND show_id = :showId AND deleted_at IS NULL RETURNING id, type_key`,
      { replacements: { typeId: req.params.typeId, showId } }
    );
    if (!rows?.length) {
      return res.status(404).json({ success: false, error: 'Overlay type not found' });
    }

    // Clean up stale opens_screen references pointing to the deleted type
    const deletedKey = rows[0].type_key;
    if (deletedKey) {
      await models.sequelize.query(
        `UPDATE ui_overlay_types SET opens_screen = NULL, updated_at = NOW()
         WHERE show_id = :showId AND opens_screen = :deletedKey AND deleted_at IS NULL`,
        { replacements: { showId, deletedKey } }
      );
    }

    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/v1/ui-overlays/:showId/asset/:assetId — soft-delete an overlay asset
router.delete('/:showId/asset/:assetId', optionalAuth, async (req, res) => {
  try {
    const models = require('../models');
    const { showId, assetId } = req.params;

    const [rows] = await models.sequelize.query(
      `UPDATE assets
       SET deleted_at = NOW(), updated_at = NOW()
       WHERE id = :assetId AND show_id = :showId AND deleted_at IS NULL
       RETURNING id`,
      { replacements: { assetId, showId } }
    );

    if (!rows?.length) {
      return res.status(404).json({ success: false, error: 'Asset not found' });
    }

    return res.json({ success: true, message: 'Asset deleted' });
  } catch (err) {
    console.error('[UIOverlays] Delete asset error:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
