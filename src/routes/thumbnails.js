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
router.get('/', asyncHandler(thumbnailController.listThumbnails));

// Get single thumbnail (viewer permission)
router.get('/:id', asyncHandler(thumbnailController.getThumbnail));

// Get thumbnail S3 URL (viewer permission)
router.get('/:id/url', asyncHandler(thumbnailController.getThumbnailUrl));

// Prepare thumbnail download (viewer permission)
router.get('/:id/download', asyncHandler(thumbnailController.prepareThumbnailDownload));

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
router.get('/episode/:episodeId', asyncHandler(thumbnailController.getEpisodeThumbnails));

// Get primary thumbnail for episode
router.get('/episode/:episodeId/primary', asyncHandler(thumbnailController.getPrimaryThumbnail));

/**
 * Phase 2.6 Publishing Workflow Routes
 */

// Publish thumbnail
router.post(
  '/:id/publish',
  authenticateToken,
  asyncHandler(async (req, res) => {
    try {
      const ThumbnailService = require('../services/ThumbnailService');
      const userId = req.user?.sub || req.user?.id || 'system';
      const thumbnail = await ThumbnailService.publishThumbnail(req.params.id, userId);
      res.json({
        success: true,
        thumbnail,
      });
    } catch (error) {
      res.status(error.message.includes('not found') ? 404 : 400).json({
        error: error.message,
      });
    }
  })
);

// Unpublish thumbnail
router.post(
  '/:id/unpublish',
  authenticateToken,
  asyncHandler(async (req, res) => {
    try {
      const ThumbnailService = require('../services/ThumbnailService');
      const thumbnail = await ThumbnailService.unpublishThumbnail(req.params.id);
      res.json({
        success: true,
        thumbnail,
      });
    } catch (error) {
      res.status(error.message.includes('not found') ? 404 : 400).json({
        error: error.message,
      });
    }
  })
);

// Set as primary thumbnail
router.post(
  '/:id/set-primary',
  authenticateToken,
  asyncHandler(async (req, res) => {
    try {
      const ThumbnailService = require('../services/ThumbnailService');
      const thumbnail = await ThumbnailService.setPrimaryThumbnail(req.params.id);
      res.json({
        success: true,
        thumbnail,
      });
    } catch (error) {
      res.status(error.message.includes('not found') ? 404 : 400).json({
        error: error.message,
      });
    }
  })
);

// Get thumbnails by episode (new method for gallery)
router.get(
  '/episode/:episodeId/all',
  asyncHandler(async (req, res) => {
    try {
      const ThumbnailService = require('../services/ThumbnailService');
      const thumbnails = await ThumbnailService.getThumbnailsByEpisode(req.params.episodeId);
      res.json({
        success: true,
        thumbnails,
      });
    } catch (error) {
      res.status(500).json({
        error: error.message,
      });
    }
  })
);

module.exports = router;
