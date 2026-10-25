'use strict';

const express = require('express');
const router = express.Router();
const multer = require('multer');
const { requireAuth, authorize } = require('../middleware/auth');
const { isBudgetError } = require('../services/imageCostService');

// Images only (phone audit, 2026-10-07): the stored file keeps the type it
// was sent with, so an HTML or SVG file posing as an overlay could run as a
// page from the bucket. PNG, JPEG, WebP and GIF are accepted.
const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
const multerUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (IMAGE_TYPES.includes(file.mimetype)) return cb(null, true);
    return cb(new Error('Only PNG, JPEG, WebP or GIF images can be uploaded.'));
  },
});
// A refused or oversized file is a 400 with the reason, not a 500.
const upload = {
  single: (field) => (req, res, next) => multerUpload.single(field)(req, res, (err) => {
    if (!err) return next();
    console.error('[UIOverlay] upload refused:', err.message);
    return res.status(400).json({ success: false, error: err.message });
  }),
};

// ── In-memory generation status tracking per show ──
// Tracks progress/errors so the frontend can display feedback
const generationStatus = {};

// GET /api/v1/ui-overlays/:showId — list existing overlays (all from DB)
//
// Optional query: ?episode_id=<uuid>
//   When present, returns show-level overlays (episode_id IS NULL) merged
//   with episode-level overrides (episode_id = X) for that episode.
//   Episode-level rows take priority over show-level rows that share the
//   same `name` (the Phone Hub key for "this is the Camera screen") — so
//   a Camera override placed on episode 5 swaps out the show's default
//   Camera screen only when episode 5 is the active context.
//   When omitted, only show-level rows are returned (the default phone).
router.get('/:showId', requireAuth, async (req, res) => {
  try {
    const models = require('../models');
    const showId = req.params.showId;
    const episodeId = (req.query.episode_id || '').trim() || null;

    // The show's overlays (services/phoneOverlays.js; the Script tab's
    // writer reads the same list).
    let status;
    try {
      status = await require('../services/phoneOverlays').overlayStatusForShow(models, showId, episodeId);
    } catch (listErr) {
      // A failed read of the images or the screens: logged where thrown.
      if (listErr.code === 'PHONE_IMAGES_READ' || listErr.code === 'PHONE_TYPES_READ') return res.status(500).json({ success: false, error: listErr.message });
      throw listErr;
    }

    const genStatus = generationStatus[showId] || null;

    return res.json({
      success: true,
      data: status,
      generated_count: status.filter(s => s.generated).length,
      total: status.length,
      generation_status: genStatus,
    });
  } catch (err) {
    console.error('[UIOverlay] GET /:showId failed:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/v1/ui-overlays/:showId/usage — which episodes place each of the
// show's overlay images (Evoni, 2026-10-07: the show's Overlays library says
// "Used in 3 episodes"). An episode uses an overlay when one of its
// live timeline_placements row names the asset; deleted episodes and assets
// are left out. Returns { data: { [asset_id]: [{ id, episode_number, title }] } }.
// Read-only.
router.get('/:showId/usage', requireAuth, async (req, res) => {
  try {
    const models = require('../models');
    // No timeline_placements table (a database built before it): nothing is placed.
    const [[table]] = await models.sequelize.query(`SELECT to_regclass('public.timeline_placements') IS NOT NULL AS ok`);
    if (!table?.ok) return res.json({ success: true, data: {} });
    const [rows] = await models.sequelize.query(
      `SELECT DISTINCT tp.asset_id, e.id, e.episode_number, e.title
         FROM timeline_placements tp
         JOIN assets a ON a.id = tp.asset_id AND a.show_id = :showId
                      AND a.asset_type = 'UI_OVERLAY' AND a.deleted_at IS NULL
         JOIN episodes e ON e.id = tp.episode_id AND e.deleted_at IS NULL
        WHERE tp.deleted_at IS NULL
        ORDER BY e.episode_number NULLS LAST, e.id`,
      { replacements: { showId: req.params.showId } });
    const usage = {};
    for (const r of rows || []) {
      (usage[r.asset_id] = usage[r.asset_id] || []).push({ id: r.id, episode_number: r.episode_number, title: r.title });
    }
    return res.json({ success: true, data: usage });
  } catch (err) {
    console.error('[UIOverlay] Usage lookup failed:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/v1/ui-overlays/:showId/generate-all — start generating all missing overlays (async)
router.post('/:showId/generate-all', requireAuth, async (req, res) => {
  try {
    const models = require('../models');
    const { generateAllOverlays } = require('../services/uiOverlayService');
    const showId = req.params.showId;

    if (!process.env.FAL_KEY) {
      return res.status(503).json({ success: false, error: 'FAL_KEY not configured. Add it to your .env file.' });
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
    console.error('[UIOverlay] POST /generate-all failed:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/v1/ui-overlays/:showId/debug — diagnose why overlays might not be showing
router.get('/:showId/debug', requireAuth, authorize(['ADMIN']), async (req, res) => {
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
    console.error('[UIOverlay] GET /debug failed:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/v1/ui-overlays/:showId/generate/:overlayType — generate (or regenerate) single overlay
router.post('/:showId/generate/:overlayType', requireAuth, async (req, res) => {
  try {
    const models = require('../models');
    const { generateOverlay, getAllOverlayTypes } = require('../services/uiOverlayService');
    const { v4: uuidv4 } = require('uuid');
    const showId = req.params.showId;
    const customPrompt = req.body?.prompt || null;

    const allTypes = await getAllOverlayTypes(showId, models);
    const overlayType = allTypes.find(ot => ot.id === req.params.overlayType);
    if (!overlayType) return res.status(404).json({ success: false, error: `Unknown overlay type: ${req.params.overlayType}` });

    // Generate first: the old image stays until the new one is saved. Only
    // the main image is replaced (variants stay), and its tap zones, content
    // areas, fit and category carry over (uiOverlayAssetReplace; Evoni,
    // 2026-10-07, Lala's Phone step 1). A failed save is an error, not a
    // success with no asset.
    // The show's style, as Generate all uses (phone audit, 2026-10-07: one
    // screen was drawn in the default style).
    const { getStylePrefix } = require('../services/uiOverlayService');
    const stylePrefix = await getStylePrefix(showId, models);
    const { url, bg_removed, prompt_used } = await generateOverlay(overlayType, showId, { customPrompt, stylePrefix });

    const { replaceOverlayAsset } = require('../services/uiOverlayAssetReplace');
    let assetId;
    let carried = [];
    try {
      ({ assetId, carried } = await replaceOverlayAsset(models.sequelize, {
        showId, overlayId: overlayType.id, assetId: uuidv4(), name: `UI Overlay: ${overlayType.name}`, url,
        metadata: {
          source: 'ui-overlay-generator', overlay_type: overlayType.id,
          overlay_beat: overlayType.beat, overlay_category: overlayType.category,
          bg_removed, generated_at: new Date().toISOString(),
          ...(customPrompt ? { custom_prompt: customPrompt } : {}),
        },
      }));
    } catch (assetErr) {
      console.error('[UIOverlay] generate: saving the new image failed (the old one stays):', assetErr.message);
      return res.status(500).json({ success: false, error: `The new image was made but could not be saved: ${assetErr.message}` });
    }

    return res.json({ success: true, data: { ...overlayType, url, bg_removed, asset_id: assetId, prompt_used, carried } });
  } catch (err) {
    console.error('[UIOverlay] generate failed:', err.message);
    return res.status(isBudgetError(err) ? 429 : 500).json({ success: false, error: err.message });
  }
});

// POST /api/v1/ui-overlays/:showId/remove-bg/:assetId — remove background from existing overlay
router.post('/:showId/remove-bg/:assetId', requireAuth, async (req, res) => {
  try {
    const models = require('../models');
    const { removeBackgroundFromAsset } = require('../services/uiOverlayService');

    if (!process.env.REMOVEBG_API_KEY) {
      return res.status(503).json({ success: false, error: 'Background removal not configured. Set REMOVEBG_API_KEY.' });
    }

    const result = await removeBackgroundFromAsset(req.params.assetId, models, { showId: req.params.showId });
    return res.json({ success: true, data: result });
  } catch (err) {
    console.error('[UIOverlay] remove-bg error:', err.message);
    if (err.message === 'Asset not found') return res.status(404).json({ success: false, error: 'No overlay image with that id in this show' });
    return res.status(isBudgetError(err) ? 429 : 500).json({ success: false, error: err.message });
  }
});

// POST /api/v1/ui-overlays/:showId/upload/:overlayType — upload custom image for an overlay
// Replaces the type's main image. Variants (a variant_label body field) were
// removed (Evoni, 2026-10-07, Lala's Phone step 2): the field is ignored, and
// variant images uploaded before stay as they are.
router.post('/:showId/upload/:overlayType', requireAuth, upload.single('image'), async (req, res) => {
  try {
    const models = require('../models');
    const { getAllOverlayTypes, uploadOverlayToS3 } = require('../services/uiOverlayService');
    const { v4: uuidv4 } = require('uuid');
    const showId = req.params.showId;

    const allTypes = await getAllOverlayTypes(showId, models);
    const overlayType = allTypes.find(ot => ot.id === req.params.overlayType);
    if (!overlayType) return res.status(404).json({ success: false, error: `Unknown overlay type: ${req.params.overlayType}` });
    if (!req.file) return res.status(400).json({ success: false, error: 'No image file uploaded' });

    // Upload to S3 first — if this fails we haven't touched the DB yet.
    const url = await uploadOverlayToS3(req.file.buffer, overlayType.id, showId, req.file.mimetype);

    // Replace the previous main image and insert the new one
    // in one transaction, carrying its tap zones, content areas, fit and
    // category (uiOverlayAssetReplace; Evoni, 2026-10-07, Lala's Phone step
    // 1). A failure rolls back, so the old image stays, and is an error.
    const { replaceOverlayAsset } = require('../services/uiOverlayAssetReplace');
    let assetId;
    let carried = [];
    try {
      ({ assetId, carried } = await replaceOverlayAsset(models.sequelize, {
        showId, overlayId: overlayType.id, assetId: uuidv4(),
        name: `UI Overlay: ${overlayType.name}`, url,
        metadata: {
          source: 'custom-upload', overlay_type: overlayType.id,
          overlay_beat: overlayType.beat, overlay_category: overlayType.category,
          uploaded_at: new Date().toISOString(), original_filename: req.file.originalname,
        },
      }));
    } catch (assetErr) {
      console.error('[UIOverlay] upload: saving the new image failed (the old one stays):', assetErr.message);
      return res.status(500).json({ success: false, error: `The image was uploaded but could not be saved: ${assetErr.message}` });
    }

    return res.json({ success: true, data: { ...overlayType, url, asset_id: assetId, generated: true, carried } });
  } catch (err) {
    console.error('[UIOverlay] POST /upload/:overlayType failed:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ── PHONE FRAME (custom device frame image) ────────────────────────────────

// POST /api/v1/ui-overlays/:showId/frame — upload a custom phone frame image
router.post('/:showId/frame', requireAuth, upload.single('frame'), async (req, res) => {
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
    console.error('[UIOverlay] POST /frame failed:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/v1/ui-overlays/:showId/frame — get saved phone frame URL + global fit
router.get('/:showId/frame', requireAuth, async (req, res) => {
  try {
    const models = require('../models');
    const showId = req.params.showId;
    const PageContent = models.PageContent;

    let frame_url = null;
    let global_fit = null;
    let phone_skin = null;

    if (PageContent) {
      const frameRow = await PageContent.findOne({ where: { page_name: `phone_hub_${showId}`, constant_key: 'FRAME_URL' } });
      if (frameRow?.data) frame_url = frameRow.data.frame_url || null;

      const fitRow = await PageContent.findOne({ where: { page_name: `phone_hub_${showId}`, constant_key: 'GLOBAL_FIT' } });
      if (fitRow?.data) global_fit = fitRow.data.global_fit || null;

      const skinRow = await PageContent.findOne({ where: { page_name: `phone_hub_${showId}`, constant_key: 'PHONE_SKIN' } });
      if (skinRow?.data) phone_skin = skinRow.data.phone_skin || null;
    }

    return res.json({ success: true, frame_url, global_fit, phone_skin });
  } catch (err) {
    console.error('[UIOverlay] GET /:showId/frame failed:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/v1/ui-overlays/:showId/frame — remove custom phone frame, revert to built-in
router.delete('/:showId/frame', requireAuth, async (req, res) => {
  try {
    const models = require('../models');
    const showId = req.params.showId;
    const PageContent = models.PageContent;

    if (PageContent) {
      await PageContent.destroy({ where: { page_name: `phone_hub_${showId}`, constant_key: 'FRAME_URL' } });
    }

    return res.json({ success: true, frame_url: null });
  } catch (err) {
    console.error('[UIOverlay] DELETE /frame failed:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/v1/ui-overlays/:showId/global-fit — save global image fit settings for all screens
router.put('/:showId/global-fit', requireAuth, async (req, res) => {
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
    console.error('[UIOverlay] PUT /global-fit failed:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/v1/ui-overlays/:showId/phone-skin — save Lala's Phone skin for the
// show, so Producer Mode and the Episode preview show the same device (Task #1964).
// Unlike /global-fit, a missing PageContent model is an error, never a silent success.
const PHONE_SKIN_PATTERN = /^[a-z0-9_-]{1,32}$/;
router.put('/:showId/phone-skin', requireAuth, async (req, res) => {
  try {
    const models = require('../models');
    const showId = req.params.showId;
    const { phone_skin } = req.body || {};

    if (typeof phone_skin !== 'string' || !PHONE_SKIN_PATTERN.test(phone_skin)) {
      return res.status(400).json({ success: false, error: 'phone_skin must be 1-32 characters of a-z, 0-9, _ or -' });
    }

    const PageContent = models.PageContent;
    if (!PageContent) {
      console.error('[phone-skin] PageContent model is not loaded; skin not saved');
      return res.status(500).json({ success: false, error: 'PageContent model is not loaded' });
    }

    await PageContent.upsert(
      { page_name: `phone_hub_${showId}`, constant_key: 'PHONE_SKIN', data: { phone_skin } },
      { conflictFields: ['page_name', 'constant_key'] }
    );

    return res.json({ success: true, phone_skin });
  } catch (err) {
    console.error('[phone-skin] Failed to save phone skin:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ── STYLE PREFIX (per-show design language for AI generation) ────────────

// GET /api/v1/ui-overlays/:showId/style-prefix — get show's style prefix
router.get('/:showId/style-prefix', requireAuth, async (req, res) => {
  try {
    const models = require('../models');
    const { getStylePrefix, DEFAULT_STYLE_PREFIX } = require('../services/uiOverlayService');
    const prefix = await getStylePrefix(req.params.showId, models);
    return res.json({ success: true, style_prefix: prefix.trim(), default_prefix: DEFAULT_STYLE_PREFIX.trim() });
  } catch (err) {
    console.error('[UIOverlay] GET /style-prefix failed:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/v1/ui-overlays/:showId/style-prefix — set show's style prefix
router.put('/:showId/style-prefix', requireAuth, async (req, res) => {
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
    console.error('[UIOverlay] PUT /style-prefix failed:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ── CATEGORY OVERRIDE (screen vs icon for built-in types) ───────────────

// PUT /api/v1/ui-overlays/:showId/category/:assetId — set category on asset metadata
// A save that matched no live image says so (Evoni, 2026-10-07, Lala's Phone
// step 1): it used to answer success when the image had been replaced or
// removed meanwhile, and the work was lost without a word.
const NO_LIVE_IMAGE = "That image was replaced or removed. Reload Lala's Phone and try again.";
const updatedNothing = (meta) => meta && typeof meta.rowCount === 'number' && meta.rowCount === 0;

router.put('/:showId/category/:assetId', requireAuth, async (req, res) => {
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

    const [, updateMeta] = await models.sequelize.query(
      `UPDATE assets SET ${setClauses.join(', ')} WHERE id = :assetId AND show_id = :showId AND deleted_at IS NULL`,
      { replacements }
    );
    if (updatedNothing(updateMeta)) return res.status(404).json({ success: false, error: NO_LIVE_IMAGE });

    return res.json({ success: true, category, name });
  } catch (err) {
    console.error('[UIOverlay] PUT /category/:assetId failed:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ── IMAGE FIT (resize/position settings) ────────────────────────────────

// PUT /api/v1/ui-overlays/:showId/image-fit/:assetId — save image fit settings
router.put('/:showId/image-fit/:assetId', requireAuth, async (req, res) => {
  try {
    const models = require('../models');
    const { image_fit } = req.body;

    // Allow null to clear per-screen override, otherwise must be an object
    if (image_fit !== null && (!image_fit || typeof image_fit !== 'object')) {
      return res.status(400).json({ success: false, error: 'image_fit must be an object or null' });
    }

    const [, updateMeta] = await models.sequelize.query(
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
    if (updatedNothing(updateMeta)) return res.status(404).json({ success: false, error: NO_LIVE_IMAGE });

    return res.json({ success: true, image_fit });
  } catch (err) {
    console.error('[UIOverlay] PUT /image-fit/:assetId failed:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ── SCREEN LINKS (tap zones with icon overlays) ───────────────────────────

// PUT /api/v1/ui-overlays/:showId/screen-links/:assetId — save screen links for an overlay
router.put('/:showId/screen-links/:assetId', requireAuth, async (req, res) => {
  try {
    const models = require('../models');
    const { validateScreenLinks } = require('../services/phoneConditionSchema');
    const { screen_links } = req.body;

    if (!Array.isArray(screen_links)) {
      return res.status(400).json({ success: false, error: 'screen_links must be an array' });
    }

    // Validate any conditions/actions before persisting — rejects unknown action types
    // and malformed rules. Zones without conditions/actions pass through untouched.
    // zone_errors (when present) carries per-zone detail so the UI can point at the
    // specific zone that failed instead of surfacing one flat message.
    const { error, value: validatedLinks, zone_errors } = validateScreenLinks(screen_links);
    if (error) {
      return res.status(400).json({ success: false, error, zone_errors: zone_errors || null });
    }

    // Merge screen_links into existing metadata
    const [, updateMeta] = await models.sequelize.query(
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
    if (updatedNothing(updateMeta)) return res.status(404).json({ success: false, error: NO_LIVE_IMAGE });

    return res.json({ success: true, screen_links: validatedLinks });
  } catch (err) {
    console.error('[UIOverlay] PUT /screen-links/:assetId failed:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/v1/ui-overlays/:showId/screen-links/:assetId — get screen links for an overlay
router.get('/:showId/screen-links/:assetId', requireAuth, async (req, res) => {
  try {
    const models = require('../models');

    const [rows] = await models.sequelize.query(
      `SELECT metadata::text as metadata_text FROM assets
       WHERE id = :assetId AND show_id = :showId AND deleted_at IS NULL`,
      { replacements: { assetId: req.params.assetId, showId: req.params.showId } }
    );

    if (!rows?.length) return res.status(404).json({ success: false, error: 'Asset not found' });

    let meta = {};
    try { meta = JSON.parse(rows[0].metadata_text || '{}'); } catch (parseErr) { console.error(`[UIOverlay] screen ${req.params.assetId} metadata is not JSON, read as none:`, parseErr.message); }

    return res.json({ success: true, screen_links: meta.screen_links || [] });
  } catch (err) {
    console.error('[UIOverlay] GET /screen-links/:assetId failed:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/v1/ui-overlays/:showId/screen-links/:assetId/icon — upload icon image for a link zone
router.post('/:showId/screen-links/:assetId/icon', requireAuth, upload.single('icon'), async (req, res) => {
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

    // The upload becomes the zone's own image: the library icon key goes, or
    // it would keep drawing the library icon after a reload (phone audit,
    // 2026-10-07). Read and written under a row lock, so a zones save made
    // while the file uploaded is not overwritten by an older copy.
    const found = await models.sequelize.transaction(async (transaction) => {
      const [rows] = await models.sequelize.query(
        `SELECT metadata::text as metadata_text FROM assets
         WHERE id = :assetId AND show_id = :showId AND deleted_at IS NULL
         FOR UPDATE`,
        { replacements: { assetId: req.params.assetId, showId: req.params.showId }, transaction }
      );
      if (!rows?.length) return false;
      let meta = {};
      try { meta = JSON.parse(rows[0].metadata_text || '{}'); } catch (parseErr) {
        console.error('[UIOverlay] icon upload: screen metadata is not JSON:', parseErr.message);
        return false;
      }
      const links = meta.screen_links || [];
      const link = links.find(l => l.id === link_id);
      if (!link) return false;
      delete link.icon_overlay_id;
      link.icon_url = url;
      link.icon_urls = [url];
      await models.sequelize.query(
        `UPDATE assets SET metadata = CAST(:metadata AS jsonb), updated_at = NOW()
         WHERE id = :assetId AND show_id = :showId AND deleted_at IS NULL`,
        { replacements: {
          assetId: req.params.assetId,
          showId: req.params.showId,
          metadata: JSON.stringify(meta),
        }, transaction }
      );
      return true;
    });
    if (!found) return res.status(404).json({ success: false, error: 'That zone is not saved on this screen yet. Save the zones, then upload again.' });

    return res.json({ success: true, icon_url: url, link_id });
  } catch (err) {
    console.error('[UIOverlay] icon upload error:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ── CONTENT ZONES (Live data rendering on templates) ────────────────────────

// Content areas are checked like tap zones (phone audit, 2026-10-07: any
// shape was stored): an id, a box inside the screen, and conditions in the
// shared grammar. Returns the first problem in plain words, or null.
const CONTENT_ZONES_MAX = 40;
function contentZonesProblem(zones) {
  const { conditionsArraySchema } = require('../services/phoneConditionSchema');
  if (zones.length > CONTENT_ZONES_MAX) return `A screen holds at most ${CONTENT_ZONES_MAX} content areas.`;
  for (let i = 0; i < zones.length; i += 1) {
    const z = zones[i];
    const n = i + 1;
    if (!z || typeof z !== 'object' || Array.isArray(z)) return `Content area ${n} is not an area.`;
    if (typeof z.id !== 'string' || !z.id || z.id.length > 80) return `Content area ${n} has no id.`;
    for (const k of ['x', 'y', 'w', 'h']) {
      if (typeof z[k] !== 'number' || !Number.isFinite(z[k]) || z[k] < 0 || z[k] > 100) return `Content area ${n}: ${k} must be a number from 0 to 100.`;
    }
    if (z.content_type != null && (typeof z.content_type !== 'string' || z.content_type.length > 60)) return `Content area ${n} has an unknown kind.`;
    if (z.conditions !== undefined) {
      const { error } = conditionsArraySchema.validate(z.conditions);
      if (error) return `Content area ${n}: ${/key" is not allowed to be empty|key" is required/.test(error.message) ? 'a condition needs a key (or remove it)' : error.message}`;
    }
  }
  return null;
}

// PUT /api/v1/ui-overlays/:showId/content-zones/:assetId — save content zones for an overlay
router.put('/:showId/content-zones/:assetId', requireAuth, async (req, res) => {
  try {
    const models = require('../models');
    const { content_zones } = req.body;

    if (!Array.isArray(content_zones)) {
      return res.status(400).json({ success: false, error: 'content_zones must be an array' });
    }
    const invalid = contentZonesProblem(content_zones);
    if (invalid) return res.status(400).json({ success: false, error: invalid });

    const [, updateMeta] = await models.sequelize.query(
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
    if (updatedNothing(updateMeta)) return res.status(404).json({ success: false, error: NO_LIVE_IMAGE });

    return res.json({ success: true, content_zones });
  } catch (err) {
    console.error('[UIOverlay] PUT /content-zones/:assetId failed:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/v1/ui-overlays/:showId/content-zones/:assetId — get content zones for an overlay
router.get('/:showId/content-zones/:assetId', requireAuth, async (req, res) => {
  try {
    const models = require('../models');

    const [rows] = await models.sequelize.query(
      `SELECT metadata::text as metadata_text FROM assets
       WHERE id = :assetId AND show_id = :showId AND deleted_at IS NULL`,
      { replacements: { assetId: req.params.assetId, showId: req.params.showId } }
    );

    if (!rows?.length) return res.status(404).json({ success: false, error: 'Asset not found' });

    let meta = {};
    try { meta = JSON.parse(rows[0].metadata_text || '{}'); } catch (parseErr) { console.error(`[UIOverlay] screen ${req.params.assetId} metadata is not JSON, read as none:`, parseErr.message); }

    return res.json({ success: true, content_zones: meta.content_zones || [] });
  } catch (err) {
    console.error('[UIOverlay] GET /content-zones/:assetId failed:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ── SUGGEST LINKED SCREENS ─────────────────────────────────────────────────

// GET /api/v1/ui-overlays/:showId/types/suggest-links/:iconName — suggest screens for an icon to link to
router.get('/:showId/types/suggest-links/:iconName', requireAuth, async (req, res) => {
  try {
    const models = require('../models');
    const { suggestLinkedScreens } = require('../services/uiOverlayService');
    const suggestions = await suggestLinkedScreens(req.params.showId, decodeURIComponent(req.params.iconName), models);
    return res.json({ success: true, data: suggestions });
  } catch (err) {
    console.error('[UIOverlay] GET /types/suggest-links/:iconName failed:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ── OVERLAY TYPE CRUD ─────────────────────────────────────────────────────

// POST /api/v1/ui-overlays/:showId/types — create an overlay type
router.post('/:showId/types', requireAuth, async (req, res) => {
  try {
    const models = require('../models');
    const { v4: uuidv4 } = require('uuid');
    const showId = req.params.showId;
    const { name, category, beat, description, prompt, type_key, opens_screen, is_home } = req.body;

    if (!name) {
      return res.status(400).json({ success: false, error: 'name is required' });
    }

    // Prompt is only needed for AI generation; creators who plan to upload an
    // image inline can leave it blank. Fill in a sensible default so the column
    // (NOT NULL in older schemas) stays happy.
    const effectivePrompt = prompt && prompt.trim()
      ? prompt
      : category === 'production'
        ? `Show overlay for "${name}", 16:9.`
        : `Phone ${category === 'phone_icon' || category === 'icon' ? 'icon' : 'screen'} for "${name}".`;

    // Guard against dangling `opens_screen` references — only accept keys that
    // correspond to a live overlay type on the same show. Null/empty is fine
    // (icon with no navigation target).
    if (opens_screen) {
      const [[row]] = await models.sequelize.query(
        `SELECT 1 FROM ui_overlay_types WHERE show_id = :showId AND type_key = :key AND deleted_at IS NULL LIMIT 1`,
        { replacements: { showId, key: opens_screen } }
      );
      if (!row) {
        return res.status(400).json({ success: false, error: `opens_screen "${opens_screen}" does not match any screen on this show` });
      }
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

    // If marking as home, unset any existing home screen for this show — after
    // the duplicate check, and with the insert, so a refused or failed create
    // never leaves the show without a home (phone audit, 2026-10-07).
    const id = uuidv4();
    await models.sequelize.transaction(async (transaction) => {
    if (is_home) {
      await models.sequelize.query(
        `UPDATE ui_overlay_types SET is_home = false, updated_at = NOW() WHERE show_id = :showId AND is_home = true AND deleted_at IS NULL`,
        { replacements: { showId }, transaction }
      );
    }
    await models.sequelize.query(
      `INSERT INTO ui_overlay_types (id, show_id, type_key, name, category, beat, description, prompt, sort_order, opens_screen, is_home, created_at, updated_at)
       VALUES (:id, :showId, :key, :name, :category, :beat, :description, :prompt, :sortOrder, :opensScreen, :isHome, NOW(), NOW())`,
      { replacements: {
        id, showId, key, name,
        category: category || 'phone',
        beat: beat || 'Various',
        description: description || '',
        prompt: effectivePrompt,
        sortOrder: req.body.sort_order || 100,
        opensScreen: opens_screen || null,
        isHome: !!is_home,
      }, transaction }
    );
    });

    return res.json({ success: true, data: { id, type_key: key, name, category: category || 'phone', beat: beat || 'Various', description, prompt: effectivePrompt, opens_screen: opens_screen || null } });
  } catch (err) {
    console.error('[UIOverlay] POST /types failed:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/v1/ui-overlays/:showId/types/:typeId — update a custom overlay type
router.put('/:showId/types/:typeId', requireAuth, async (req, res) => {
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
    if (opens_screen !== undefined) {
      // FK-like validation: only accept keys that live on this show. Null/empty
      // clears the link. See the POST handler for the same guard.
      if (opens_screen) {
        const [[row]] = await models.sequelize.query(
          `SELECT 1 FROM ui_overlay_types WHERE show_id = :showId AND type_key = :key AND deleted_at IS NULL LIMIT 1`,
          { replacements: { showId: req.params.showId, key: opens_screen } }
        );
        if (!row) {
          return res.status(400).json({ success: false, error: `opens_screen "${opens_screen}" does not match any screen on this show` });
        }
      }
      sets.push('opens_screen = :opensScreen'); replacements.opensScreen = opens_screen || null;
    }
    if (is_home !== undefined) {
      sets.push('is_home = :isHome'); replacements.isHome = !!is_home;
    }

    if (sets.length === 0) {
      return res.status(400).json({ success: false, error: 'No fields to update' });
    }

    sets.push('updated_at = NOW()');
    // The old home is unset with the update, in one transaction, and only
    // when the update matched a live type (phone round step 1, D3): it was
    // unset first and on its own, so an id that matched nothing, or a
    // failed update, left the show with no home screen.
    const matched = await models.sequelize.transaction(async (transaction) => {
      const [rows] = await models.sequelize.query(
        `UPDATE ui_overlay_types SET ${sets.join(', ')} WHERE id = :typeId AND show_id = :showId AND deleted_at IS NULL RETURNING id`,
        { replacements, transaction }
      );
      if (!rows?.length) return false;
      if (is_home) {
        await models.sequelize.query(
          `UPDATE ui_overlay_types SET is_home = false, updated_at = NOW() WHERE show_id = :showId AND is_home = true AND deleted_at IS NULL AND id != :typeId`,
          { replacements: { showId: req.params.showId, typeId: req.params.typeId }, transaction }
        );
      }
      return true;
    });
    if (!matched) return res.status(404).json({ success: false, error: 'Overlay type not found' });

    return res.json({ success: true });
  } catch (err) {
    console.error('[UIOverlay] PUT types/:typeId failed:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/v1/ui-overlays/:showId/types/:typeId — soft-delete a custom overlay type
router.delete('/:showId/types/:typeId', requireAuth, async (req, res) => {
  try {
    const models = require('../models');
    const showId = req.params.showId;

    // One transaction (phone audit, 2026-10-07): the type, its images (show
    // and episode versions), icons' opens_screen to it, and every zone on the
    // show's screens that led to it. The page used to clean up zones itself,
    // without waiting, from a stale copy, and the images stayed behind.
    const result = await models.sequelize.transaction(async (transaction) => {
      const [rows] = await models.sequelize.query(
        `UPDATE ui_overlay_types SET deleted_at = NOW() WHERE id = :typeId AND show_id = :showId AND deleted_at IS NULL RETURNING id, type_key`,
        { replacements: { typeId: req.params.typeId, showId }, transaction }
      );
      if (!rows?.length) return null;
      const deletedKey = rows[0].type_key;
      if (!deletedKey) return { zonesRemoved: 0, navigateActionsRemoved: 0, missionRewardsRemoved: 0, missionsFlagged: [] };

      await models.sequelize.query(
        `UPDATE ui_overlay_types SET opens_screen = NULL, updated_at = NOW()
         WHERE show_id = :showId AND opens_screen = :deletedKey AND deleted_at IS NULL`,
        { replacements: { showId, deletedKey }, transaction }
      );
      await models.sequelize.query(
        `UPDATE assets SET deleted_at = NOW(), updated_at = NOW()
         WHERE asset_type = 'UI_OVERLAY' AND show_id = :showId AND deleted_at IS NULL
           AND metadata->>'overlay_type' = :deletedKey`,
        { replacements: { showId, deletedKey }, transaction }
      );
      const [screens] = await models.sequelize.query(
        `SELECT id, metadata::text AS metadata_text FROM assets
         WHERE asset_type = 'UI_OVERLAY' AND show_id = :showId AND deleted_at IS NULL
         FOR UPDATE`,
        { replacements: { showId }, transaction }
      );
      // A zone's own "Go to" action wins over its target on the phone
      // (phoneRuntime.actionsForZone), so a navigate action to the deleted
      // screen is a dead link too (phone round step 1, D1): the action goes,
      // and a zone left with no target and nothing to do goes with it.
      const isDeadNavigate = (a) => a?.type === 'navigate' && a.target === deletedKey;
      let zonesRemoved = 0;
      let navigateActionsRemoved = 0;
      for (const screen of screens || []) {
        let meta;
        try { meta = JSON.parse(screen.metadata_text || '{}'); } catch (parseErr) {
          console.error(`[UIOverlay] type delete: screen ${screen.id} metadata is not JSON, skipped:`, parseErr.message);
          continue;
        }
        const links = Array.isArray(meta.screen_links) ? meta.screen_links : [];
        let changed = false;
        const kept = [];
        for (const link of links) {
          if (link?.target === deletedKey) { zonesRemoved += 1; changed = true; continue; }
          const actions = Array.isArray(link?.actions) ? link.actions : null;
          const dead = actions ? actions.filter(isDeadNavigate).length : 0;
          if (!dead) { kept.push(link); continue; }
          changed = true;
          navigateActionsRemoved += dead;
          const rest = actions.filter(a => !isDeadNavigate(a));
          if (!link.target && rest.length === 0) { zonesRemoved += 1; continue; }
          kept.push({ ...link, actions: rest });
        }
        if (!changed) continue;
        meta.screen_links = kept;
        await models.sequelize.query(
          `UPDATE assets SET metadata = CAST(:metadata AS jsonb), updated_at = NOW() WHERE id = :id`,
          { replacements: { id: screen.id, metadata: JSON.stringify(meta) }, transaction }
        );
      }

      // Missions: a reward that opens the deleted screen is removed. An
      // objective or start condition that needs it ("visited:<key>") is
      // kept and named in the answer, and the Hub's health check flags it:
      // deleting the objective could finish the mission on the spot, and
      // what the mission should ask instead is Evoni's call.
      let missionRewardsRemoved = 0;
      const missionsFlagged = [];
      const [[missionsTable]] = await models.sequelize.query(
        `SELECT to_regclass('public.phone_missions') IS NOT NULL AS ok`, { transaction });
      if (missionsTable?.ok) {
        const [missions] = await models.sequelize.query(
          `SELECT id, name, episode_id, objectives::text AS objectives_text,
                  reward_actions::text AS rewards_text, start_condition::text AS start_text
             FROM phone_missions WHERE show_id = :showId AND deleted_at IS NULL
           FOR UPDATE`,
          { replacements: { showId }, transaction }
        );
        const visitedKey = `visited:${deletedKey}`;
        const needsScreen = (conds) => Array.isArray(conds) && conds.some(c => c?.key === visitedKey);
        for (const m of missions || []) {
          let objectives; let rewards; let start;
          try {
            objectives = JSON.parse(m.objectives_text || '[]');
            rewards = JSON.parse(m.rewards_text || '[]');
            start = JSON.parse(m.start_text || 'null');
          } catch (parseErr) {
            console.error(`[UIOverlay] type delete: mission ${m.id} is not JSON, skipped:`, parseErr.message);
            continue;
          }
          const keptRewards = Array.isArray(rewards) ? rewards.filter(a => !isDeadNavigate(a)) : rewards;
          if (Array.isArray(rewards) && keptRewards.length !== rewards.length) {
            missionRewardsRemoved += rewards.length - keptRewards.length;
            await models.sequelize.query(
              `UPDATE phone_missions SET reward_actions = CAST(:rewards AS jsonb), updated_at = NOW() WHERE id = :id`,
              { replacements: { id: m.id, rewards: JSON.stringify(keptRewards) }, transaction }
            );
          }
          const objectivesNeeding = (Array.isArray(objectives) ? objectives : [])
            .filter(o => needsScreen(o?.condition)).map(o => o.label || o.id || 'objective');
          if (objectivesNeeding.length || needsScreen(start)) {
            missionsFlagged.push({ id: m.id, name: m.name, episode_id: m.episode_id || null, objectives: objectivesNeeding, start_condition: needsScreen(start) });
          }
        }
      }
      return { deletedKey, zonesRemoved, navigateActionsRemoved, missionRewardsRemoved, missionsFlagged };
    });
    if (!result) return res.status(404).json({ success: false, error: 'Overlay type not found' });

    return res.json({ success: true, data: result });
  } catch (err) {
    console.error('[UIOverlay] type delete error:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/v1/ui-overlays/:showId/asset/:assetId — soft-delete an overlay asset
router.delete('/:showId/asset/:assetId', requireAuth, async (req, res) => {
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

// ── STATS PANEL (the audience's overlay; Task #3164) ────────────────────────
// services/statsPanelService: the show's panel art (one of its overlays), the
// boxes where Lala's numbers go, and an episode's PNG with each number as
// "before → after". Separate from Lala's Phone (Evoni, 2026-10-14).

function sendStatsPanelError(res, err, where) {
  const { StatsPanelError } = require('../services/statsPanelService');
  if (err instanceof StatsPanelError) return res.status(err.status).json({ success: false, error: err.message, code: err.code });
  console.error(`[UIOverlay] ${where} error:`, err);
  return res.status(500).json({ success: false, error: err.message });
}

// PUT /api/v1/ui-overlays/:showId/stats-panel/:assetId — save the panel's number boxes on its art
router.put('/:showId/stats-panel/:assetId', requireAuth, async (req, res) => {
  try {
    const { saveSpots } = require('../services/statsPanelService');
    const data = await saveSpots(require('../models'), req.params.showId, req.params.assetId, req.body?.spots);
    return res.json({ success: true, data });
  } catch (err) {
    return sendStatsPanelError(res, err, 'PUT stats-panel');
  }
});

// GET /api/v1/ui-overlays/:showId/stats-panel/episode/:episodeId — the episode's numbers, before → after
router.get('/:showId/stats-panel/episode/:episodeId', requireAuth, async (req, res) => {
  try {
    const { episodePanel } = require('../services/statsPanelService');
    const data = await episodePanel(require('../models'), req.params.showId, req.params.episodeId);
    return res.json({ success: true, data });
  } catch (err) {
    return sendStatsPanelError(res, err, 'GET stats-panel episode');
  }
});

// GET /api/v1/ui-overlays/:showId/stats-panel/episode/:episodeId/png?size=1080p|4k — the PNG to download
router.get('/:showId/stats-panel/episode/:episodeId/png', requireAuth, async (req, res) => {
  try {
    const { renderPng } = require('../services/statsPanelService');
    const { buffer, filename } = await renderPng(require('../models'), req.params.showId, req.params.episodeId, String(req.query.size || '1080p'));
    res.set('Content-Type', 'image/png');
    res.set('Content-Disposition', `attachment; filename="${filename}"`);
    return res.send(buffer);
  } catch (err) {
    return sendStatsPanelError(res, err, 'GET stats-panel png');
  }
});

module.exports = router;
