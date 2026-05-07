/**
 * Cursor Path Routes
 * Manages cursor action timeline for episodes
 */

const express = require('express');
const router = express.Router();
const cursorPathController = require('../controllers/cursorPathController');
const { requireAuth } = require('../middleware/auth');

// ============================================================================
// CURSOR PATH GENERATION
// ============================================================================

/**
 * POST /api/v1/episodes/:episodeId/cursor-paths/generate
 * Auto-generate cursor paths from icon cues
 */
router.post(
  '/:episodeId/cursor-paths/generate',
  requireAuth,
  cursorPathController.generateCursorPaths
);

/**
 * POST /api/v1/episodes/:episodeId/cursor-paths/regenerate
 * Regenerate cursor paths (keeps approved, regenerates suggested)
 */
router.post(
  '/:episodeId/cursor-paths/regenerate',
  requireAuth,
  cursorPathController.regenerateCursorPaths
);

// ============================================================================
// CURSOR PATH CRUD
// ============================================================================

/**
 * GET /api/v1/episodes/:episodeId/cursor-paths
 * List all cursor paths for episode
 */
router.get(
  '/:episodeId/cursor-paths',
  requireAuth,
  cursorPathController.listCursorPaths
);

/**
 * GET /api/v1/episodes/:episodeId/cursor-paths/:pathId
 * Get single cursor path
 */
router.get(
  '/:episodeId/cursor-paths/:pathId',
  requireAuth,
  cursorPathController.getCursorPath
);

/**
 * POST /api/v1/episodes/:episodeId/cursor-paths
 * Create cursor path manually
 */
router.post(
  '/:episodeId/cursor-paths',
  requireAuth,
  cursorPathController.createCursorPath
);

/**
 * PUT /api/v1/episodes/:episodeId/cursor-paths/:pathId
 * Update cursor path
 */
router.put(
  '/:episodeId/cursor-paths/:pathId',
  requireAuth,
  cursorPathController.updateCursorPath
);

/**
 * DELETE /api/v1/episodes/:episodeId/cursor-paths/:pathId
 * Delete cursor path
 */
router.delete(
  '/:episodeId/cursor-paths/:pathId',
  requireAuth,
  cursorPathController.deleteCursorPath
);

// ============================================================================
// APPROVAL WORKFLOW
// ============================================================================

/**
 * POST /api/v1/episodes/:episodeId/cursor-paths/:pathId/approve
 * Approve cursor path
 */
router.post(
  '/:episodeId/cursor-paths/:pathId/approve',
  requireAuth,
  cursorPathController.approveCursorPath
);

/**
 * POST /api/v1/episodes/:episodeId/cursor-paths/:pathId/reject
 * Reject cursor path
 */
router.post(
  '/:episodeId/cursor-paths/:pathId/reject',
  requireAuth,
  cursorPathController.rejectCursorPath
);

/**
 * POST /api/v1/episodes/:episodeId/cursor-paths/approve-all
 * Approve all suggested cursor paths
 */
router.post(
  '/:episodeId/cursor-paths/approve-all',
  requireAuth,
  cursorPathController.approveAllCursorPaths
);

// ============================================================================
// EXPORT
// ============================================================================

/**
 * GET /api/v1/episodes/:episodeId/cursor-paths/export
 * Export cursor paths as JSON/Markdown
 */
router.get(
  '/:episodeId/cursor-paths/export',
  requireAuth,
  cursorPathController.exportCursorPaths
);

module.exports = router;
