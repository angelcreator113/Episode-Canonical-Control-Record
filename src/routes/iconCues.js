/**
 * Icon Cue Routes
 * Manages icon timeline cues for episodes
 * 
 * Features:
 * - Generate icon cues from Lala Formula script
 * - CRUD operations for icon cues
 * - Approval workflow
 * - Anchor management
 */

const express = require('express');
const router = express.Router();
const iconCueController = require('../controllers/iconCueController');
const { requireAuth } = require('../middleware/auth');

// ============================================================================
// ICON CUE GENERATION
// ============================================================================

/**
 * POST /api/v1/episodes/:episodeId/icon-cues/generate
 * Auto-generate icon cues from episode script/scenes
 */
router.post(
  '/:episodeId/icon-cues/generate',
  requireAuth,
  iconCueController.generateIconCues
);

/**
 * POST /api/v1/episodes/:episodeId/icon-cues/regenerate
 * Regenerate icon cues (keeps approved ones, regenerates suggested)
 */
router.post(
  '/:episodeId/icon-cues/regenerate',
  requireAuth,
  iconCueController.regenerateIconCues
);

// ============================================================================
// ICON CUE CRUD
// ============================================================================

/**
 * GET /api/v1/episodes/:episodeId/icon-cues
 * List all icon cues for episode
 * Query params: status, slot_id, sort
 */
router.get(
  '/:episodeId/icon-cues',
  requireAuth,
  iconCueController.listIconCues
);

/**
 * GET /api/v1/episodes/:episodeId/icon-cues/:cueId
 * Get single icon cue
 */
router.get(
  '/:episodeId/icon-cues/:cueId',
  requireAuth,
  iconCueController.getIconCue
);

/**
 * POST /api/v1/episodes/:episodeId/icon-cues
 * Create new icon cue manually
 */
router.post(
  '/:episodeId/icon-cues',
  requireAuth,
  iconCueController.createIconCue
);

/**
 * PUT /api/v1/episodes/:episodeId/icon-cues/:cueId
 * Update icon cue
 */
router.put(
  '/:episodeId/icon-cues/:cueId',
  requireAuth,
  iconCueController.updateIconCue
);

/**
 * DELETE /api/v1/episodes/:episodeId/icon-cues/:cueId
 * Delete icon cue
 */
router.delete(
  '/:episodeId/icon-cues/:cueId',
  requireAuth,
  iconCueController.deleteIconCue
);

// ============================================================================
// APPROVAL WORKFLOW
// ============================================================================

/**
 * POST /api/v1/episodes/:episodeId/icon-cues/:cueId/approve
 * Approve a suggested icon cue
 */
router.post(
  '/:episodeId/icon-cues/:cueId/approve',
  requireAuth,
  iconCueController.approveIconCue
);

/**
 * POST /api/v1/episodes/:episodeId/icon-cues/:cueId/reject
 * Reject a suggested icon cue
 */
router.post(
  '/:episodeId/icon-cues/:cueId/reject',
  requireAuth,
  iconCueController.rejectIconCue
);

/**
 * POST /api/v1/episodes/:episodeId/icon-cues/approve-all
 * Approve all suggested icon cues
 */
router.post(
  '/:episodeId/icon-cues/approve-all',
  requireAuth,
  iconCueController.approveAllIconCues
);

/**
 * POST /api/v1/episodes/:episodeId/icon-cues/reject-all
 * Reject all suggested icon cues
 */
router.post(
  '/:episodeId/icon-cues/reject-all',
  requireAuth,
  iconCueController.rejectAllIconCues
);

// ============================================================================
// ANCHORS
// ============================================================================

/**
 * GET /api/v1/episodes/:episodeId/icon-cues/anchors
 * List all anchor points in episode
 */
router.get(
  '/:episodeId/icon-cues/anchors',
  requireAuth,
  iconCueController.listAnchors
);

/**
 * POST /api/v1/episodes/:episodeId/icon-cues/:cueId/set-anchor
 * Mark cue as anchor with name
 */
router.post(
  '/:episodeId/icon-cues/:cueId/set-anchor',
  requireAuth,
  iconCueController.setAnchor
);

/**
 * DELETE /api/v1/episodes/:episodeId/icon-cues/:cueId/remove-anchor
 * Remove anchor from cue
 */
router.delete(
  '/:episodeId/icon-cues/:cueId/remove-anchor',
  requireAuth,
  iconCueController.removeAnchor
);

// ============================================================================
// EXPORT
// ============================================================================

/**
 * GET /api/v1/episodes/:episodeId/icon-cues/export
 * Export icon cues as JSON/Markdown
 * Query params: format (json, markdown, csv)
 */
router.get(
  '/:episodeId/icon-cues/export',
  requireAuth,
  iconCueController.exportIconCues
);

module.exports = router;
