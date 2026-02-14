const express = require('express');
const router = express.Router();
const sceneController = require('../controllers/sceneController');
const { asyncHandler } = require('../middleware/errorHandler');
const { validateUUIDParam } = require('../middleware/requestValidation');

console.log('🔵 SCENES ROUTES FILE LOADING... [TIMESTAMP:', new Date().toISOString(), ']');
console.log('🆕 SCENES.JS VERSION: 2026-02-10-05:20 - Routes reordered with /:id LAST');

/**
 * Scene Routes
 * Base path: /api/v1/scenes
 *
 * ✅ AUTH TEMPORARILY DISABLED FOR TESTING (matching episodes.js pattern)
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
  // authenticateToken,  // ✅ COMMENTED OUT FOR TESTING
  // requirePermission('scenes', 'create'),  // ✅ COMMENTED OUT FOR TESTING
  asyncHandler(sceneController.createScene)
);

// POST /api/v1/scenes/:id/duplicate - Duplicate scene
router.post(
  '/:id/duplicate',
  validateUUIDParam('id'),
  // authenticateToken,  // ✅ COMMENTED OUT FOR TESTING
  asyncHandler(sceneController.duplicateScene)
);

/**
 * Advanced Scene Management Routes
 */

// PUT /api/v1/scenes/:id/status - Update scene production status
router.put(
  '/:id/status',
  validateUUIDParam('id'),
  // authenticateToken,  // ✅ COMMENTED OUT FOR TESTING
  asyncHandler(sceneController.updateSceneStatus)
);

// POST /api/v1/scenes/:id/characters - Add character to scene
router.post(
  '/:id/characters',
  validateUUIDParam('id'),
  // authenticateToken,  // ✅ COMMENTED OUT FOR TESTING
  asyncHandler(sceneController.addCharacter)
);

// DELETE /api/v1/scenes/:id/characters/:characterName - Remove character from scene
router.delete(
  '/:id/characters/:characterName',
  validateUUIDParam('id'),
  // authenticateToken,  // ✅ COMMENTED OUT FOR TESTING
  asyncHandler(sceneController.removeCharacter)
);

// PUT /api/v1/scenes/:id/thumbnail - Set scene thumbnail
router.put(
  '/:id/thumbnail',
  validateUUIDParam('id'),
  // authenticateToken,  // ✅ COMMENTED OUT FOR TESTING
  // requirePermission('scenes', 'edit'),  // ✅ COMMENTED OUT FOR TESTING
  asyncHandler(sceneController.setSceneThumbnail)
);

// PUT /api/v1/scenes/:id/assets - Update scene assets
router.put(
  '/:id/assets',
  validateUUIDParam('id'),
  // authenticateToken,  // ✅ COMMENTED OUT FOR TESTING
  // requirePermission('scenes', 'edit'),  // ✅ COMMENTED OUT FOR TESTING
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
  // authenticateToken,  // ✅ COMMENTED OUT FOR TESTING
  asyncHandler(sceneController.addSceneAsset)
);

// DELETE /api/v1/scenes/:id/assets/:assetId - Remove asset from scene
router.delete(
  '/:id/assets/:assetId',
  validateUUIDParam('id'),
  validateUUIDParam('assetId'),
  // authenticateToken,  // ✅ COMMENTED OUT FOR TESTING
  asyncHandler(sceneController.removeSceneAsset)
);

// PATCH /api/v1/scenes/:id/assets/:assetId - Update asset positioning/timing
router.patch(
  '/:id/assets/:assetId',
  validateUUIDParam('id'),
  validateUUIDParam('assetId'),
  // authenticateToken,  // ✅ COMMENTED OUT FOR TESTING
  asyncHandler(sceneController.updateSceneAsset)
);

// PUT /api/v1/scenes/:id - Update scene
router.put(
  '/:id',
  validateUUIDParam('id'),
  // authenticateToken,  // ✅ COMMENTED OUT FOR TESTING
  // requirePermission('scenes', 'edit'),  // ✅ COMMENTED OUT FOR TESTING
  asyncHandler(sceneController.updateScene)
);

// DELETE /api/v1/scenes/:id - Delete scene
router.delete(
  '/:id',
  validateUUIDParam('id'),
  // authenticateToken,  // ✅ COMMENTED OUT FOR TESTING
  // requirePermission('scenes', 'delete'),  // ✅ COMMENTED OUT FOR TESTING
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
