const express = require('express');
const router = express.Router();
const metadataController = require('../controllers/metadataController');
const { requireAuth, authorize } = require('../middleware/auth');
const { requirePermission } = require('../middleware/rbac');
const { asyncHandler } = require('../middleware/errorHandler');

/**
 * Metadata Storage Routes
 * Base path: /api/v1/metadata
 *
 * Metadata = ML/AI extracted analysis results (text, scenes, sentiment, objects, transcription)
 *
 * Permissions:
 * - view: Admin only (Evoni, 2026-11-22; see below)
 * - create: Admin, Editor
 * - edit: Admin, Editor
 * - delete: Admin only
 */

// The five reads are an ADMIN's (Evoni, 2026-11-22). They carried optionalAuth
// as a "public catalog" (F-AUTH-1 CP12 §5.21, because they do not read
// req.user), so they answered anyone, signed in or not, with whole rows:
// a video's transcription and extracted text among them. Correction filed as
// docs/audit/F-AUTH-1_MetadataReads_AdminOnly_Amendment_2026-11-22.md.
// List metadata
router.get('/', requireAuth, authorize(['ADMIN']), asyncHandler(metadataController.listMetadata));

// Get all metadata - special route for /ALL
router.get('/ALL', requireAuth, authorize(['ADMIN']), asyncHandler(metadataController.listMetadata));

// Get single metadata (admin)
router.get('/:id', requireAuth, authorize(['ADMIN']), asyncHandler(metadataController.getMetadata));

// Get metadata summary (lightweight, viewer permission)
router.get('/:id/summary', requireAuth, authorize(['ADMIN']), asyncHandler(metadataController.getMetadataSummary));

// Get metadata for specific episode (admin)
router.get('/episode/:episodeId', requireAuth, authorize(['ADMIN']), asyncHandler(metadataController.getMetadataForEpisode));

// Create or update metadata (requires authentication + editor role)
router.post(
  '/',
  requireAuth,
  requirePermission('metadata', 'create'),
  asyncHandler(metadataController.createOrUpdateMetadata)
);

// Update metadata (requires authentication + editor role)
router.put(
  '/:id',
  requireAuth,
  requirePermission('metadata', 'edit'),
  asyncHandler(metadataController.updateMetadata)
);

// Add tags to metadata (requires authentication + editor role)
router.post(
  '/:id/add-tags',
  requireAuth,
  requirePermission('metadata', 'edit'),
  asyncHandler(metadataController.addTags)
);

// Set detected scenes (requires authentication + editor role)
router.post(
  '/:id/set-scenes',
  requireAuth,
  requirePermission('metadata', 'edit'),
  asyncHandler(metadataController.setDetectedScenes)
);

// Delete metadata (requires authentication + admin role)
router.delete(
  '/:id',
  requireAuth,
  requirePermission('metadata', 'delete'),
  asyncHandler(metadataController.deleteMetadata)
);

module.exports = router;
