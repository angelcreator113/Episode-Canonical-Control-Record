const express = require('express');
const router = express.Router();
const metadataController = require('../controllers/metadataController');
const { authenticateToken } = require('../middleware/auth');
const { requirePermission } = require('../middleware/rbac');
const { asyncHandler } = require('../middleware/errorHandler');

/**
 * Metadata Storage Routes
 * Base path: /api/v1/metadata
 * 
 * Metadata = ML/AI extracted analysis results (text, scenes, sentiment, objects, transcription)
 * 
 * Permissions:
 * - view: All (viewer, editor, admin)
 * - create: Admin, Editor
 * - edit: Admin, Editor
 * - delete: Admin only
 */

// List metadata (viewer permission)
router.get(
  '/',
  asyncHandler(metadataController.listMetadata)
);

// Get all metadata - special route for /ALL
router.get(
  '/ALL',
  asyncHandler(metadataController.listMetadata)
);

// Get single metadata (viewer permission)
router.get(
  '/:id',
  asyncHandler(metadataController.getMetadata)
);

// Get metadata summary (lightweight, viewer permission)
router.get(
  '/:id/summary',
  asyncHandler(metadataController.getMetadataSummary)
);

// Get metadata for specific episode (viewer permission)
router.get(
  '/episode/:episodeId',
  asyncHandler(metadataController.getMetadataForEpisode)
);

// Create or update metadata (requires authentication + editor role)
router.post(
  '/',
  authenticateToken,
  requirePermission('metadata', 'create'),
  asyncHandler(metadataController.createOrUpdateMetadata)
);

// Update metadata (requires authentication + editor role)
router.put(
  '/:id',
  authenticateToken,
  requirePermission('metadata', 'edit'),
  asyncHandler(metadataController.updateMetadata)
);

// Add tags to metadata (requires authentication + editor role)
router.post(
  '/:id/add-tags',
  authenticateToken,
  requirePermission('metadata', 'edit'),
  asyncHandler(metadataController.addTags)
);

// Set detected scenes (requires authentication + editor role)
router.post(
  '/:id/set-scenes',
  authenticateToken,
  requirePermission('metadata', 'edit'),
  asyncHandler(metadataController.setDetectedScenes)
);

// Delete metadata (requires authentication + admin role)
router.delete(
  '/:id',
  authenticateToken,
  requirePermission('metadata', 'delete'),
  asyncHandler(metadataController.deleteMetadata)
);

module.exports = router;
