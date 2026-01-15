const express = require('express');
const router = express.Router();
const processingController = require('../controllers/processingController');
const { authenticateToken } = require('../middleware/auth');
const { requirePermission } = require('../middleware/rbac');
const { asyncHandler } = require('../middleware/errorHandler');

/**
 * Processing Queue Routes
 * Base path: /api/v1/processing-queue
 *
 * Manages async jobs: thumbnail generation, metadata extraction, transcription
 *
 * Permissions:
 * - view: All (viewer, editor, admin)
 * - create: Admin, Editor
 * - edit: Admin, Editor (update status, retry)
 * - delete: Admin only (cancel jobs)
 */

// List all jobs (viewer permission)
router.get('/', asyncHandler(processingController.listJobs));

// Get job statistics (viewer permission)
router.get('/stats', asyncHandler(processingController.getStats));

// Get pending jobs (viewer permission)
router.get('/pending', asyncHandler(processingController.getPendingJobs));

// Get failed jobs (viewer permission)
router.get('/failed', asyncHandler(processingController.getFailedJobs));

// Get retryable jobs (viewer permission)
router.get('/retryable', asyncHandler(processingController.getRetryableJobs));

// Get single job (viewer permission)
router.get('/:id', asyncHandler(processingController.getJob));

// Get jobs for specific episode (viewer permission)
router.get('/episode/:episodeId', asyncHandler(processingController.getEpisodeJobs));

// Create job (requires authentication + editor role)
router.post(
  '/',
  authenticateToken,
  requirePermission('processing', 'create'),
  asyncHandler(processingController.createJob)
);

// Update job status (requires authentication + editor role)
router.put(
  '/:id',
  authenticateToken,
  requirePermission('processing', 'edit'),
  asyncHandler(processingController.updateJob)
);

// Retry job (requires authentication + editor role)
router.post(
  '/:id/retry',
  authenticateToken,
  requirePermission('processing', 'edit'),
  asyncHandler(processingController.retryJob)
);

// Cancel job (requires authentication + admin role)
router.delete(
  '/:id',
  authenticateToken,
  requirePermission('processing', 'delete'),
  asyncHandler(processingController.cancelJob)
);

module.exports = router;
