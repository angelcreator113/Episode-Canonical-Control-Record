const express = require('express');
const router = express.Router();
const sceneController = require('../controllers/sceneController');
const sceneStudioController = require('../controllers/sceneStudioController');
const { asyncHandler } = require('../middleware/errorHandler');
const { validateUUIDParam } = require('../middleware/requestValidation');
const { requireAuth } = require('../middleware/auth');

console.log('🔵 SCENES ROUTES FILE LOADING... [TIMESTAMP:', new Date().toISOString(), ']');
console.log('🆕 SCENES.JS VERSION: 2026-02-10-05:20 - Routes reordered with /:id LAST');

/**
 * Scene Routes
 * Base path: /api/v1/scenes
 *
 * ⚠️ CRITICAL ROUTING ORDER:
 * - Specific routes (/, /:id/duplicate, etc.) MUST come FIRST
 * - Generic parameterized route (/:id) MUST come LAST
 * - Express matches routes sequentially - if /:id comes first, it catches EVERYTHING
 */

/**
 * Scene CRUD Routes
 */

// GET /api/v1/scenes - List all scenes with filters
router.get('/', requireAuth, asyncHandler(sceneController.listScenes));

// POST /api/v1/scenes - Create new scene
router.post(
  '/',
  requireAuth,
  asyncHandler(sceneController.createScene)
);

// POST /api/v1/scenes/:id/duplicate - Duplicate scene
router.post(
  '/:id/duplicate',
  validateUUIDParam('id'),
  requireAuth,
  asyncHandler(sceneController.duplicateScene)
);

/**
 * Advanced Scene Management Routes
 */

// PUT /api/v1/scenes/:id/status - Update scene production status
router.put(
  '/:id/status',
  validateUUIDParam('id'),
  requireAuth,
  asyncHandler(sceneController.updateSceneStatus)
);

// POST /api/v1/scenes/:id/characters - Add character to scene
router.post(
  '/:id/characters',
  validateUUIDParam('id'),
  requireAuth,
  asyncHandler(sceneController.addCharacter)
);

// DELETE /api/v1/scenes/:id/characters/:characterName - Remove character from scene
router.delete(
  '/:id/characters/:characterName',
  validateUUIDParam('id'),
  requireAuth,
  asyncHandler(sceneController.removeCharacter)
);

// PUT /api/v1/scenes/:id/thumbnail - Set scene thumbnail
router.put(
  '/:id/thumbnail',
  validateUUIDParam('id'),
  requireAuth,
  asyncHandler(sceneController.setSceneThumbnail)
);

// PUT /api/v1/scenes/:id/assets - Update scene assets
router.put(
  '/:id/assets',
  validateUUIDParam('id'),
  requireAuth,
  asyncHandler(sceneController.updateSceneAssets)
);

/**
 * Scene Asset Management Routes (NEW)
 */

// GET /api/v1/scenes/:id/assets - Get all assets for a scene
router.get('/:id/assets', validateUUIDParam('id'), requireAuth, asyncHandler(sceneController.getSceneAssets));

// POST /api/v1/scenes/:id/assets - Link asset(s) to scene
router.post(
  '/:id/assets',
  validateUUIDParam('id'),
  requireAuth,
  asyncHandler(sceneController.addSceneAsset)
);

// DELETE /api/v1/scenes/:id/assets/:assetId - Remove asset from scene
router.delete(
  '/:id/assets/:assetId',
  validateUUIDParam('id'),
  validateUUIDParam('assetId'),
  requireAuth,
  asyncHandler(sceneController.removeSceneAsset)
);

// PATCH /api/v1/scenes/:id/assets/:assetId - Update asset positioning/timing
router.patch(
  '/:id/assets/:assetId',
  validateUUIDParam('id'),
  validateUUIDParam('assetId'),
  requireAuth,
  asyncHandler(sceneController.updateSceneAsset)
);

/**
 * Scene Studio Routes (Canvas-based editor)
 */

// GET /api/v1/scenes/:id/canvas - Load canvas state (objects + settings)
router.get(
  '/:id/canvas',
  validateUUIDParam('id'),
  requireAuth,
  asyncHandler(sceneStudioController.getCanvas)
);

// PUT /api/v1/scenes/:id/canvas - Bulk save canvas (objects + settings)
router.put(
  '/:id/canvas',
  validateUUIDParam('id'),
  requireAuth,
  asyncHandler(sceneStudioController.saveCanvas)
);

// POST /api/v1/scenes/:id/generate-object - AI object generation (DALL-E 3)
router.post(
  '/:id/generate-object',
  validateUUIDParam('id'),
  requireAuth,
  asyncHandler(sceneStudioController.generateObject)
);

// POST /api/v1/scenes/:id/transform-object - AI image transform (img2img)
router.post(
  '/:id/transform-object',
  validateUUIDParam('id'),
  requireAuth,
  asyncHandler(sceneStudioController.transformObject)
);

// POST /api/v1/scenes/:id/regenerate-background - AI background variation
router.post(
  '/:id/regenerate-background',
  validateUUIDParam('id'),
  requireAuth,
  asyncHandler(sceneStudioController.regenerateBackground)
);

// POST /api/v1/scenes/:id/suggest-objects - AI smart suggestions
router.post(
  '/:id/suggest-objects',
  validateUUIDParam('id'),
  requireAuth,
  asyncHandler(sceneStudioController.suggestObjects)
);

// POST /api/v1/scenes/:id/inpaint - AI object removal via inpainting
router.post(
  '/:id/inpaint',
  validateUUIDParam('id'),
  requireAuth,
  asyncHandler(sceneStudioController.inpaint)
);

// POST /api/v1/scenes/:id/segment - Smart Select via SAM (click-to-segment)
router.post(
  '/:id/segment',
  validateUUIDParam('id'),
  requireAuth,
  asyncHandler(sceneStudioController.segmentObject)
);

// POST /api/v1/scenes/:id/animate - Scene animation via Runway image-to-video
router.post(
  '/:id/animate',
  validateUUIDParam('id'),
  requireAuth,
  asyncHandler(sceneStudioController.animateScene)
);

// POST /api/v1/scenes/:id/generate-depth - Depth map estimation (DepthAnythingV2)
router.post(
  '/:id/generate-depth',
  validateUUIDParam('id'),
  requireAuth,
  asyncHandler(sceneStudioController.generateDepth)
);

// GET /api/v1/scenes/:id/depth-map - Proxy depth map image (avoids S3 CORS issues)
router.get(
  '/:id/depth-map',
  validateUUIDParam('id'),
  requireAuth,
  asyncHandler(sceneStudioController.proxyDepthMap)
);

// POST /api/v1/scenes/:id/objects - Add object to canvas
router.post(
  '/:id/objects',
  validateUUIDParam('id'),
  requireAuth,
  asyncHandler(sceneStudioController.addObject)
);

// PATCH /api/v1/scenes/:id/objects/:objectId - Update single object
router.patch(
  '/:id/objects/:objectId',
  validateUUIDParam('id'),
  validateUUIDParam('objectId'),
  requireAuth,
  asyncHandler(sceneStudioController.updateObject)
);

// DELETE /api/v1/scenes/:id/objects/:objectId - Remove object
router.delete(
  '/:id/objects/:objectId',
  validateUUIDParam('id'),
  validateUUIDParam('objectId'),
  requireAuth,
  asyncHandler(sceneStudioController.deleteObject)
);

// POST /api/v1/scenes/:id/objects/:objectId/duplicate - Duplicate object
router.post(
  '/:id/objects/:objectId/duplicate',
  validateUUIDParam('id'),
  validateUUIDParam('objectId'),
  requireAuth,
  asyncHandler(sceneStudioController.duplicateObject)
);

// POST /api/v1/scenes/:id/objects/:objectId/variants - Create variant
router.post(
  '/:id/objects/:objectId/variants',
  validateUUIDParam('id'),
  validateUUIDParam('objectId'),
  requireAuth,
  asyncHandler(sceneStudioController.createVariant)
);

// PATCH /api/v1/scenes/:id/variant-groups/:groupId/activate - Switch active variant
router.patch(
  '/:id/variant-groups/:groupId/activate',
  validateUUIDParam('id'),
  validateUUIDParam('groupId'),
  requireAuth,
  asyncHandler(sceneStudioController.activateVariant)
);

// GET /api/v1/scenes/:id/variant-groups/:groupId - Get variant group details
router.get(
  '/:id/variant-groups/:groupId',
  validateUUIDParam('id'),
  validateUUIDParam('groupId'),
  requireAuth,
  asyncHandler(sceneStudioController.getVariantGroup)
);

// PUT /api/v1/scenes/:id - Update scene
router.put(
  '/:id',
  validateUUIDParam('id'),
  requireAuth,
  asyncHandler(sceneController.updateScene)
);

// DELETE /api/v1/scenes/:id - Delete scene
router.delete(
  '/:id',
  validateUUIDParam('id'),
  requireAuth,
  asyncHandler(sceneController.deleteScene)
);

// ⚠️ GET /api/v1/scenes/:id - MUST BE REGISTERED LAST!
// This catches any path like /scenes/<anything> so it blocks specific routes if placed earlier
router.get('/:id', requireAuth, (req, res, next) => {
  console.log('🟢 GET /scenes/:id HIT! ID:', req.params.id);
  next();
}, validateUUIDParam('id'), asyncHandler(sceneController.getScene));

console.log('✅ SCENES ROUTES REGISTERED');

module.exports = router;
