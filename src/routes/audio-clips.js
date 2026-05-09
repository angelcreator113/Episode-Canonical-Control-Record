const express = require('express');
const router = express.Router();
const audioClipController = require('../controllers/audioClipController');
const { asyncHandler } = require('../middleware/errorHandler');
const { requireAuth } = require('../middleware/auth');

/**
 * Audio Clip Routes (Phase 2.5 - Animatic System)
 * Audio tracks for dialogue, ambience, music, SFX
 * Supports TTS now, real voice-over swap later
 *
 * Base paths:
 *   - /api/v1/scenes/:sceneId/audio-clips (scene-scoped)
 *   - /api/v1/audio-clips/:id (single clip operations)
 */

// Scene-Scoped Audio Clip Routes
router.get('/scenes/:sceneId/audio-clips', requireAuth, asyncHandler(audioClipController.listAudioClips));
router.post('/scenes/:sceneId/audio-clips', requireAuth, asyncHandler(audioClipController.createAudioClip));

// Single Audio Clip Routes
router.get('/audio-clips/:id', requireAuth, asyncHandler(audioClipController.getAudioClip));
router.patch('/audio-clips/:id', requireAuth, asyncHandler(audioClipController.updateAudioClip));
router.delete('/audio-clips/:id', requireAuth, asyncHandler(audioClipController.deleteAudioClip));

module.exports = router;
