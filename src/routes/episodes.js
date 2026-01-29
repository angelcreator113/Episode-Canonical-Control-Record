const express = require('express');
const router = express.Router();

const episodeController = require('../controllers/episodeController');
const sceneController = require('../controllers/sceneController');
const wardrobeController = require('../controllers/wardrobeController');
const scriptsController = require('../controllers/scriptsController');
const { _authenticateToken } = require('../middleware/auth');
const { _requirePermission } = require('../middleware/rbac');
const { asyncHandler } = require('../middleware/errorHandler');
const { validateEpisodeQuery, validateUUIDParam } = require('../middleware/requestValidation');

/**
 * Episode Routes
 * Base path: /api/v1/episodes
 *
 * ✅ AUTH TEMPORARILY DISABLED FOR TESTING
 */

// Test endpoint to verify basic functionality
router.get(
  '/test-create',
  asyncHandler(async (req, res) => {
    const { models } = require('../models');
    const { Episode } = models;

    try {
      const testEpisode = await Episode.create({
        title: 'Test Episode ' + Date.now(),
        episode_number: Math.floor(Math.random() * 1000),
        status: 'draft',
        description: 'Test episode for debugging',
        categories: ['test'],
      });

      res.json({
        success: true,
        message: 'Test episode created successfully',
        episode: testEpisode,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message,
        name: error.name,
        sql: error.sql,
      });
    }
  })
);

// List episodes
router.get('/', validateEpisodeQuery, asyncHandler(episodeController.listEpisodes));

// ==================== WARDROBE ROUTES ====================
// These must come BEFORE /:id route to avoid being caught by it

// GET /api/v1/episodes/:id/wardrobe - Get all wardrobe items for episode
router.get(
  '/:id/wardrobe',
  validateUUIDParam('id'),
  asyncHandler(wardrobeController.getEpisodeWardrobe)
);

// POST /api/v1/episodes/:id/wardrobe/:wardrobeId - Link wardrobe item to episode
router.post(
  '/:id/wardrobe/:wardrobeId',
  validateUUIDParam('id'),
  asyncHandler(wardrobeController.linkWardrobeToEpisode)
);

// DELETE /api/v1/episodes/:id/wardrobe/:wardrobeId - Unlink wardrobe from episode
router.delete(
  '/:id/wardrobe/:wardrobeId',
  validateUUIDParam('id'),
  asyncHandler(wardrobeController.unlinkWardrobeFromEpisode)
);

// ==================== ASSET ROUTES ====================
// These must come BEFORE /:id route to avoid being caught by it

// GET /api/v1/episodes/:id/assets - Get all assets for episode
router.get(
  '/:id/assets',
  validateUUIDParam('id'),
  asyncHandler(episodeController.getEpisodeAssets)
);

// POST /api/v1/episodes/:id/assets - Add asset(s) to episode
router.post(
  '/:id/assets',
  validateUUIDParam('id'),
  asyncHandler(episodeController.addEpisodeAsset)
);

// DELETE /api/v1/episodes/:id/assets/:assetId - Remove asset from episode
router.delete(
  '/:id/assets/:assetId',
  validateUUIDParam('id'),
  asyncHandler(episodeController.removeEpisodeAsset)
);

// PATCH /api/v1/episodes/:id/assets/:assetId - Update asset usage in episode
router.patch(
  '/:id/assets/:assetId',
  validateUUIDParam('id'),
  asyncHandler(episodeController.updateEpisodeAsset)
);

// ==================== STANDARD EPISODE ROUTES ====================
router.get('/:id/status', asyncHandler(episodeController.getEpisodeStatus));

// Get single episode
router.get('/:id', validateUUIDParam('id'), asyncHandler(episodeController.getEpisode));

// ✅ CREATE EPISODE - AUTH DISABLED FOR TESTING
router.post(
  '/',
  // authenticateToken,  // ✅ COMMENTED OUT FOR TESTING
  // requirePermission('episodes', 'create'),  // ✅ COMMENTED OUT FOR TESTING
  asyncHandler(episodeController.createEpisode)
);

// ✅ UPDATE EPISODE - AUTH DISABLED FOR TESTING
router.put(
  '/:id',
  // authenticateToken,  // ✅ COMMENTED OUT FOR TESTING
  // requirePermission('episodes', 'edit'),  // ✅ COMMENTED OUT FOR TESTING
  asyncHandler(episodeController.updateEpisode)
);

// ✅ DELETE EPISODE - AUTH DISABLED FOR TESTING
router.delete(
  '/:id',
  // authenticateToken,  // ✅ COMMENTED OUT FOR TESTING
  // requirePermission('episodes', 'delete'),  // ✅ COMMENTED OUT FOR TESTING
  asyncHandler(episodeController.deleteEpisode)
);

// Enqueue episode for processing
router.post(
  '/:id/enqueue',
  // authenticateToken,  // ✅ COMMENTED OUT FOR TESTING
  // requirePermission('episodes', 'edit'),  // ✅ COMMENTED OUT FOR TESTING
  asyncHandler(episodeController.enqueueEpisode)
);

/**
 * Episode Scenes Management
 */

// GET /api/v1/episodes/:episodeId/scenes - Get all scenes for episode
router.get(
  '/:episodeId/scenes',
  validateUUIDParam('episodeId'),
  asyncHandler(sceneController.getEpisodeScenes)
);

// PUT /api/v1/episodes/:episodeId/scenes/reorder - Reorder scenes
router.put(
  '/:episodeId/scenes/reorder',
  validateUUIDParam('episodeId'),
  // authenticateToken,  // ✅ COMMENTED OUT FOR TESTING
  asyncHandler(sceneController.reorderScenes)
);

// GET /api/v1/episodes/:episodeId/scenes/stats - Get scene statistics
router.get(
  '/:episodeId/scenes/stats',
  validateUUIDParam('episodeId'),
  asyncHandler(sceneController.getSceneStats)
);

/**
 * Episode Scripts Management
 */

// GET /api/v1/episodes/:episodeId/scripts - Get all scripts for episode
router.get(
  '/:episodeId/scripts',
  validateUUIDParam('episodeId'),
  asyncHandler(scriptsController.getScriptsByEpisode)
);

// POST /api/v1/episodes/:episodeId/scripts - Create new script
router.post(
  '/:episodeId/scripts',
  validateUUIDParam('episodeId'),
  // authenticateToken,  // ✅ COMMENTED OUT FOR TESTING
  // requireAdmin,
  asyncHandler(scriptsController.createScript)
);

// GET /api/v1/episodes/:episodeId/scripts/:scriptType/versions - Get versions
router.get(
  '/:episodeId/scripts/:scriptType/versions',
  validateUUIDParam('episodeId'),
  asyncHandler(scriptsController.getScriptVersions)
);

/**
 * Episode Scene Library Management
 * New routes for scene library integration
 */

// GET /api/v1/episodes/:id/library-scenes - List scenes from library assigned to episode
router.get(
  '/:id/library-scenes',
  validateUUIDParam('id'),
  asyncHandler(episodeController.listEpisodeScenes)
);

// POST /api/v1/episodes/:id/library-scenes - Add scene from library to episode
router.post(
  '/:id/library-scenes',
  validateUUIDParam('id'),
  asyncHandler(episodeController.addSceneToEpisode)
);

// PUT /api/v1/episodes/:id/library-scenes/:sceneId - Update episode scene (trim, notes, order)
router.put(
  '/:id/library-scenes/:sceneId',
  validateUUIDParam('id'),
  asyncHandler(episodeController.updateEpisodeScene)
);

// DELETE /api/v1/episodes/:id/library-scenes/:sceneId - Remove scene from episode
router.delete(
  '/:id/library-scenes/:sceneId',
  validateUUIDParam('id'),
  asyncHandler(episodeController.removeSceneFromEpisode)
);

// PUT /api/v1/episodes/:id/sequence-items/reorder - Batch reorder sequence items
router.put(
  '/:id/sequence-items/reorder',
  validateUUIDParam('id'),
  asyncHandler(episodeController.reorderSequenceItems)
);

// POST /api/v1/episodes/:id/sequence-items/note - Add a note to the sequence
router.post(
  '/:id/sequence-items/note',
  validateUUIDParam('id'),
  asyncHandler(episodeController.addNoteToEpisode)
);

module.exports = router;
