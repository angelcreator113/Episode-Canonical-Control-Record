/**
 * Music Cue Routes
 * Manages music timeline for episodes
 */

const express = require('express');
const router = express.Router();
const musicCueController = require('../controllers/musicCueController');
const { optionalAuth } = require('../middleware/auth');

// ============================================================================
// MUSIC CUE GENERATION
// ============================================================================

/**
 * POST /api/v1/episodes/:episodeId/music-cues/generate
 * Auto-generate music cues from scene structure
 */
router.post(
  '/:episodeId/music-cues/generate',
  optionalAuth,
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
  optionalAuth,
  musicCueController.listMusicCues
);

/**
 * GET /api/v1/episodes/:episodeId/music-cues/:cueId
 * Get single music cue
 */
router.get(
  '/:episodeId/music-cues/:cueId',
  optionalAuth,
  musicCueController.getMusicCue
);

/**
 * POST /api/v1/episodes/:episodeId/music-cues
 * Create music cue manually
 */
router.post(
  '/:episodeId/music-cues',
  optionalAuth,
  musicCueController.createMusicCue
);

/**
 * PUT /api/v1/episodes/:episodeId/music-cues/:cueId
 * Update music cue
 */
router.put(
  '/:episodeId/music-cues/:cueId',
  optionalAuth,
  musicCueController.updateMusicCue
);

/**
 * DELETE /api/v1/episodes/:episodeId/music-cues/:cueId
 * Delete music cue
 */
router.delete(
  '/:episodeId/music-cues/:cueId',
  optionalAuth,
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
  optionalAuth,
  musicCueController.approveMusicCue
);

/**
 * POST /api/v1/episodes/:episodeId/music-cues/approve-all
 * Approve all suggested music cues
 */
router.post(
  '/:episodeId/music-cues/approve-all',
  optionalAuth,
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
  optionalAuth,
  musicCueController.exportMusicCues
);

module.exports = router;
