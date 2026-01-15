const express = require('express');
const router = express.Router();
const episodeController = require('../controllers/episodeController');
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

// List episodes
router.get('/', validateEpisodeQuery, asyncHandler(episodeController.listEpisodes));

// Get episode status
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

module.exports = router;
