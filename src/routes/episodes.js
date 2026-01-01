const express = require('express');
const router = express.Router();
const episodeController = require('../controllers/episodeController');
const { authenticateToken } = require('../middleware/auth');
const { requirePermission } = require('../middleware/rbac');
const { asyncHandler } = require('../middleware/errorHandler');

/**
 * Episode Routes
 * Base path: /api/v1/episodes
 * 
 * Permissions:
 * - view: All authenticated roles (admin, editor, viewer)
 * - create: Admin, Editor
 * - edit: Admin, Editor
 * - delete: Admin only
 * - manage: Admin only
 */

// List episodes (viewer permission)
router.get(
  '/',
  asyncHandler(episodeController.listEpisodes)
);

// Get episode status (viewer permission)
router.get(
  '/:id/status',
  asyncHandler(episodeController.getEpisodeStatus)
);

// Get single episode (viewer permission)
router.get(
  '/:id',
  asyncHandler(episodeController.getEpisode)
);

// Create episode (requires authentication + editor role)
router.post(
  '/',
  authenticateToken,
  requirePermission('episodes', 'create'),
  asyncHandler(episodeController.createEpisode)
);

// Update episode (requires authentication + editor role)
router.put(
  '/:id',
  authenticateToken,
  requirePermission('episodes', 'edit'),
  asyncHandler(episodeController.updateEpisode)
);

// Delete episode (requires authentication + admin role)
router.delete(
  '/:id',
  authenticateToken,
  requirePermission('episodes', 'delete'),
  asyncHandler(episodeController.deleteEpisode)
);

// Enqueue episode for processing (requires authentication + editor role)
router.post(
  '/:id/enqueue',
  authenticateToken,
  requirePermission('episodes', 'edit'),
  asyncHandler(episodeController.enqueueEpisode)
);

module.exports = router;
