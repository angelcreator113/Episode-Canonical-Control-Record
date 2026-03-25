const express = require('express');
const router = express.Router();
const sceneController = require('../controllers/sceneController');
const sceneStudioController = require('../controllers/sceneStudioController');
const { asyncHandler } = require('../middleware/errorHandler');
const { validateUUIDParam } = require('../middleware/requestValidation');
const { optionalAuth } = require('../middleware/auth');

console.log('🔵 SCENES ROUTES FILE LOADING... [TIMESTAMP:', new Date().toISOString(), ']');
console.log('🆕 SCENES.JS VERSION: 2026-02-10-05:20 - Routes reordered with /:id LAST');

/**
 * Scene Routes
 * Base path: /api/v1/scenes
 *
 * ⚠️ CRITICAL ROUTING ORDER:
 * - Specific routes (/, /ultra-test, /db-test, /test-direct/:id, /:id/duplicate, etc.) MUST come FIRST
 * - Generic parameterized route (/:id) MUST come LAST
 * - Express matches routes sequentially - if /:id comes first, it catches EVERYTHING
 */

/**
 * Scene CRUD Routes
 */

// GET /api/v1/scenes - List all scenes with filters
router.get('/', asyncHandler(sceneController.listScenes));

// ULTRA SIMPLE TEST - No validation, no async, nothing
router.get('/ultra-test', (req, res) => {
  console.log('🚨 ULTRA-TEST HIT!');
  res.json({ success: true, message: 'ULTRA TEST WORKS', timestamp: new Date().toISOString() });
});

// DATABASE CONNECTIVITY TEST - Check what database we're actually connected to
router.get('/db-test', asyncHandler(async (req, res) => {
  console.log('🧪 DB-TEST HIT!');
  const { sequelize } = require('../models');
  
  try {
    // Test 1: Check current database
    const [dbInfo] = await sequelize.query('SELECT current_database(), current_schema()');
    console.log('Database:', dbInfo[0].current_database, 'Schema:', dbInfo[0].current_schema);

    // Test 2: Check if scenes table exists
    const [sceneTableCheck] = await sequelize.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'scenes'
      ) as exists
    `);
    console.log('Scenes table exists:', sceneTableCheck[0].exists);

    // Test 3: Try to query scenes
    let sceneCount = 0;
    let firstScene = null;
    if (sceneTableCheck[0].exists) {
      const [countResult] = await sequelize.query('SELECT COUNT(*) as count FROM scenes');
      sceneCount = countResult[0].count;
      
      if (sceneCount > 0) {
        const [sceneResult] = await sequelize.query('SELECT id, title FROM scenes LIMIT 1');
        firstScene = sceneResult[0];
      }
    }

    res.json({
      success: true,
      database: dbInfo[0].current_database,
      schema: dbInfo[0].current_schema,
      scenesTableExists: sceneTableCheck[0].exists,
      sceneCount,
      firstScene,
    });
  } catch (error) {
    console.error('❌ DB-TEST ERROR:', error.message);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
}));

// TEST ROUTE - Inline handler to verify route registration
router.get('/test-direct/:id', asyncHandler(async (req, res) => {
  console.log('🧪 TEST-DIRECT ROUTE HIT! ID:', req.params.id);
  const { sequelize } = require('../models');
  const { QueryTypes } = require('sequelize');
  
  try {
    const scenes = await sequelize.query(
      `SELECT * FROM scenes WHERE id = $1::uuid LIMIT 1`,
      {
        bind: [req.params.id],
        type: QueryTypes.SELECT
      }
    );
    
    res.json({
      success: true,
      message: '✅ TEST ROUTE WORKS! Code is loading!',
      scene: scenes[0] || null,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}));

// POST /api/v1/scenes - Create new scene
router.post(
  '/',
  optionalAuth,
  asyncHandler(sceneController.createScene)
);

// POST /api/v1/scenes/:id/duplicate - Duplicate scene
router.post(
  '/:id/duplicate',
  validateUUIDParam('id'),
  optionalAuth,
  asyncHandler(sceneController.duplicateScene)
);

/**
 * Advanced Scene Management Routes
 */

// PUT /api/v1/scenes/:id/status - Update scene production status
router.put(
  '/:id/status',
  validateUUIDParam('id'),
  optionalAuth,
  asyncHandler(sceneController.updateSceneStatus)
);

// POST /api/v1/scenes/:id/characters - Add character to scene
router.post(
  '/:id/characters',
  validateUUIDParam('id'),
  optionalAuth,
  asyncHandler(sceneController.addCharacter)
);

// DELETE /api/v1/scenes/:id/characters/:characterName - Remove character from scene
router.delete(
  '/:id/characters/:characterName',
  validateUUIDParam('id'),
  optionalAuth,
  asyncHandler(sceneController.removeCharacter)
);

// PUT /api/v1/scenes/:id/thumbnail - Set scene thumbnail
router.put(
  '/:id/thumbnail',
  validateUUIDParam('id'),
  optionalAuth,
  asyncHandler(sceneController.setSceneThumbnail)
);

// PUT /api/v1/scenes/:id/assets - Update scene assets
router.put(
  '/:id/assets',
  validateUUIDParam('id'),
  optionalAuth,
  asyncHandler(sceneController.updateSceneAssets)
);

/**
 * Scene Asset Management Routes (NEW)
 */

// GET /api/v1/scenes/:id/assets - Get all assets for a scene
router.get('/:id/assets', validateUUIDParam('id'), asyncHandler(sceneController.getSceneAssets));

// POST /api/v1/scenes/:id/assets - Link asset(s) to scene
router.post(
  '/:id/assets',
  validateUUIDParam('id'),
  optionalAuth,
  asyncHandler(sceneController.addSceneAsset)
);

// DELETE /api/v1/scenes/:id/assets/:assetId - Remove asset from scene
router.delete(
  '/:id/assets/:assetId',
  validateUUIDParam('id'),
  validateUUIDParam('assetId'),
  optionalAuth,
  asyncHandler(sceneController.removeSceneAsset)
);

// PATCH /api/v1/scenes/:id/assets/:assetId - Update asset positioning/timing
router.patch(
  '/:id/assets/:assetId',
  validateUUIDParam('id'),
  validateUUIDParam('assetId'),
  optionalAuth,
  asyncHandler(sceneController.updateSceneAsset)
);

/**
 * Scene Studio Routes (Canvas-based editor)
 */

// GET /api/v1/scenes/:id/canvas - Load canvas state (objects + settings)
router.get(
  '/:id/canvas',
  validateUUIDParam('id'),
  asyncHandler(sceneStudioController.getCanvas)
);

// PUT /api/v1/scenes/:id/canvas - Bulk save canvas (objects + settings)
router.put(
  '/:id/canvas',
  validateUUIDParam('id'),
  optionalAuth,
  asyncHandler(sceneStudioController.saveCanvas)
);

// POST /api/v1/scenes/:id/generate-object - AI object generation (DALL-E 3)
router.post(
  '/:id/generate-object',
  validateUUIDParam('id'),
  optionalAuth,
  asyncHandler(sceneStudioController.generateObject)
);

// POST /api/v1/scenes/:id/regenerate-background - AI background variation
router.post(
  '/:id/regenerate-background',
  validateUUIDParam('id'),
  optionalAuth,
  asyncHandler(sceneStudioController.regenerateBackground)
);

// POST /api/v1/scenes/:id/suggest-objects - AI smart suggestions
router.post(
  '/:id/suggest-objects',
  validateUUIDParam('id'),
  optionalAuth,
  asyncHandler(sceneStudioController.suggestObjects)
);

// POST /api/v1/scenes/:id/inpaint - AI object removal via inpainting
router.post(
  '/:id/inpaint',
  validateUUIDParam('id'),
  optionalAuth,
  asyncHandler(sceneStudioController.inpaint)
);

// POST /api/v1/scenes/:id/animate - Scene animation via Runway image-to-video
router.post(
  '/:id/animate',
  validateUUIDParam('id'),
  optionalAuth,
  asyncHandler(sceneStudioController.animateScene)
);

// POST /api/v1/scenes/:id/generate-depth - Depth map estimation (DepthAnythingV2)
router.post(
  '/:id/generate-depth',
  validateUUIDParam('id'),
  optionalAuth,
  asyncHandler(sceneStudioController.generateDepth)
);

// GET /api/v1/scenes/:id/depth-map - Proxy depth map image (avoids S3 CORS issues)
router.get(
  '/:id/depth-map',
  validateUUIDParam('id'),
  asyncHandler(sceneStudioController.proxyDepthMap)
);

// POST /api/v1/scenes/:id/objects - Add object to canvas
router.post(
  '/:id/objects',
  validateUUIDParam('id'),
  optionalAuth,
  asyncHandler(sceneStudioController.addObject)
);

// PATCH /api/v1/scenes/:id/objects/:objectId - Update single object
router.patch(
  '/:id/objects/:objectId',
  validateUUIDParam('id'),
  validateUUIDParam('objectId'),
  optionalAuth,
  asyncHandler(sceneStudioController.updateObject)
);

// DELETE /api/v1/scenes/:id/objects/:objectId - Remove object
router.delete(
  '/:id/objects/:objectId',
  validateUUIDParam('id'),
  validateUUIDParam('objectId'),
  optionalAuth,
  asyncHandler(sceneStudioController.deleteObject)
);

// POST /api/v1/scenes/:id/objects/:objectId/duplicate - Duplicate object
router.post(
  '/:id/objects/:objectId/duplicate',
  validateUUIDParam('id'),
  validateUUIDParam('objectId'),
  optionalAuth,
  asyncHandler(sceneStudioController.duplicateObject)
);

// POST /api/v1/scenes/:id/objects/:objectId/variants - Create variant
router.post(
  '/:id/objects/:objectId/variants',
  validateUUIDParam('id'),
  validateUUIDParam('objectId'),
  optionalAuth,
  asyncHandler(sceneStudioController.createVariant)
);

// PATCH /api/v1/scenes/:id/variant-groups/:groupId/activate - Switch active variant
router.patch(
  '/:id/variant-groups/:groupId/activate',
  validateUUIDParam('id'),
  validateUUIDParam('groupId'),
  optionalAuth,
  asyncHandler(sceneStudioController.activateVariant)
);

// GET /api/v1/scenes/:id/variant-groups/:groupId - Get variant group details
router.get(
  '/:id/variant-groups/:groupId',
  validateUUIDParam('id'),
  validateUUIDParam('groupId'),
  asyncHandler(sceneStudioController.getVariantGroup)
);

// PUT /api/v1/scenes/:id - Update scene
router.put(
  '/:id',
  validateUUIDParam('id'),
  optionalAuth,
  asyncHandler(sceneController.updateScene)
);

// DELETE /api/v1/scenes/:id - Delete scene
router.delete(
  '/:id',
  validateUUIDParam('id'),
  optionalAuth,
  asyncHandler(sceneController.deleteScene)
);

// ⚠️ GET /api/v1/scenes/:id - MUST BE REGISTERED LAST!
// This catches any path like /scenes/<anything> so it blocks specific routes if placed earlier
router.get('/:id', (req, res, next) => {
  console.log('🟢 GET /scenes/:id HIT! ID:', req.params.id);
  next();
}, validateUUIDParam('id'), asyncHandler(sceneController.getScene));

console.log('✅ SCENES ROUTES REGISTERED');

module.exports = router;
