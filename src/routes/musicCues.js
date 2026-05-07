/**
 * Music Cue Routes
 * Manages music timeline for episodes
 */

const express = require('express');
const router = express.Router();
const musicCueController = require('../controllers/musicCueController');
const { requireAuth } = require('../middleware/auth');

// ============================================================================
// MUSIC CUE GENERATION
// ============================================================================

/**
 * POST /api/v1/episodes/:episodeId/music-cues/generate
 * Auto-generate music cues from scene structure
 */
router.post(
  '/:episodeId/music-cues/generate',
  requireAuth,
  musicCueController.generateMusicCues
);

// ============================================================================
// MUSIC CUE CRUD
// ============================================================================

/**
 * GET /api/v1/episodes/:episodeId/music-cues
 * List all music cues for episode
 */
router.get(
  '/:episodeId/music-cues',
  requireAuth,
  musicCueController.listMusicCues
);

/**
 * GET /api/v1/episodes/:episodeId/music-cues/:cueId
 * Get single music cue
 */
router.get(
  '/:episodeId/music-cues/:cueId',
  requireAuth,
  musicCueController.getMusicCue
);

/**
 * POST /api/v1/episodes/:episodeId/music-cues
 * Create music cue manually
 */
router.post(
  '/:episodeId/music-cues',
  requireAuth,
  musicCueController.createMusicCue
);

/**
 * PUT /api/v1/episodes/:episodeId/music-cues/:cueId
 * Update music cue
 */
router.put(
  '/:episodeId/music-cues/:cueId',
  requireAuth,
  musicCueController.updateMusicCue
);

/**
 * DELETE /api/v1/episodes/:episodeId/music-cues/:cueId
 * Delete music cue
 */
router.delete(
  '/:episodeId/music-cues/:cueId',
  requireAuth,
  musicCueController.deleteMusicCue
);

// ============================================================================
// APPROVAL WORKFLOW
// ============================================================================

/**
 * POST /api/v1/episodes/:episodeId/music-cues/:cueId/approve
 * Approve music cue
 */
router.post(
  '/:episodeId/music-cues/:cueId/approve',
  requireAuth,
  musicCueController.approveMusicCue
);

/**
 * POST /api/v1/episodes/:episodeId/music-cues/approve-all
 * Approve all suggested music cues
 */
router.post(
  '/:episodeId/music-cues/approve-all',
  requireAuth,
  musicCueController.approveAllMusicCues
);

// ============================================================================
// EXPORT
// ============================================================================

/**
 * GET /api/v1/episodes/:episodeId/music-cues/export
 * Export music cues as Markdown
 */
router.get(
  '/:episodeId/music-cues/export',
  requireAuth,
  musicCueController.exportMusicCues
);

module.exports = router;
