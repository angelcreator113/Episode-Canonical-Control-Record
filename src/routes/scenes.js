const express = require('express');
const router = express.Router();
const sceneController = require('../controllers/sceneController');
const { asyncHandler } = require('../middleware/errorHandler');
const { validateUUIDParam } = require('../middleware/requestValidation');

/**
 * Scene Routes
 * Base path: /api/v1/scenes
 * 
 * ✅ AUTH TEMPORARILY DISABLED FOR TESTING (matching episodes.js pattern)
 */

/**
 * Scene CRUD Routes
 */

// GET /api/v1/scenes - List all scenes with filters
router.get('/', asyncHandler(sceneController.listScenes));

// GET /api/v1/scenes/:id - Get single scene
router.get('/:id', validateUUIDParam('id'), asyncHandler(sceneController.getScene));

// POST /api/v1/scenes - Create new scene
router.post(
  '/',
  // authenticateToken,  // ✅ COMMENTED OUT FOR TESTING
  // requirePermission('scenes', 'create'),  // ✅ COMMENTED OUT FOR TESTING
  asyncHandler(sceneController.createScene)
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

module.exports = router;
