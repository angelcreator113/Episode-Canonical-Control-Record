const express = require('express');
const router = express.Router();
const thumbnailController = require('../controllers/thumbnailController');
const { authenticateToken } = require('../middleware/auth');
const { requirePermission } = require('../middleware/rbac');
const { asyncHandler } = require('../middleware/errorHandler');

/**
 * Thumbnail Routes
 * Base path: /api/v1/thumbnails
 * 
 * Permissions:
 * - view: All (viewer, editor, admin)
 * - create: Admin, Editor
 * - edit: Admin, Editor
 * - delete: Admin only
 */

// List thumbnails (viewer permission)
router.get(
  '/',
  asyncHandler(thumbnailController.listThumbnails)
);

// Get single thumbnail (viewer permission)
router.get(
  '/:id',
  asyncHandler(thumbnailController.getThumbnail)
);

// Get thumbnail S3 URL (viewer permission)
router.get(
  '/:id/url',
  asyncHandler(thumbnailController.getThumbnailUrl)
);

// Prepare thumbnail download (viewer permission)
router.get(
  '/:id/download',
  asyncHandler(thumbnailController.prepareThumbnailDownload)
);

// Create thumbnail (requires authentication + editor role)
router.post(
  '/',
  authenticateToken,
  requirePermission('thumbnails', 'create'),
  asyncHandler(thumbnailController.createThumbnail)
);

// Update thumbnail (requires authentication + editor role)
router.put(
  '/:id',
  authenticateToken,
  requirePermission('thumbnails', 'edit'),
  asyncHandler(thumbnailController.updateThumbnail)
);

// Rate thumbnail quality (requires authentication + editor role)
router.post(
  '/:id/rate-quality',
  authenticateToken,
  requirePermission('thumbnails', 'edit'),
  asyncHandler(thumbnailController.rateThumbnailQuality)
);

// Delete thumbnail (requires authentication + admin role)
router.delete(
  '/:id',
  authenticateToken,
  requirePermission('thumbnails', 'delete'),
  asyncHandler(thumbnailController.deleteThumbnail)
);

// Get all thumbnails for specific episode
router.get(
  '/episode/:episodeId',
  asyncHandler(thumbnailController.getEpisodeThumbnails)
);

// Get primary thumbnail for episode
router.get(
  '/episode/:episodeId/primary',
  asyncHandler(thumbnailController.getPrimaryThumbnail)
);

module.exports = router;
