const express = require('express');
const router = express.Router();
const audioClipController = require('../controllers/audioClipController');
const { asyncHandler } = require('../middleware/errorHandler');

console.log('🟢 AUDIO CLIP ROUTES FILE LOADING... [TIMESTAMP:', new Date().toISOString(), ']');
console.log('🆕 AUDIO CLIP ROUTES VERSION: Phase 2.5 - Animatic System');

/**
 * Audio Clip Routes (Phase 2.5 - Animatic System)
 * Audio tracks for dialogue, ambience, music, SFX
 * Supports TTS now, real voice-over swap later
 * 
 * Base paths:
 *   - /api/v1/scenes/:sceneId/audio-clips (scene-scoped)
 *   - /api/v1/audio-clips/:id (single clip operations)
 *
 * ✅ AUTH TEMPORARILY DISABLED FOR TESTING
 */

/**
 * Scene-Scoped Audio Clip Routes
 * Mounted at /api/v1/scenes/:sceneId/audio-clips
 */

// GET /api/v1/scenes/:sceneId/audio-clips - List all audio clips for scene
router.get('/scenes/:sceneId/audio-clips', asyncHandler(audioClipController.listAudioClips));

// POST /api/v1/scenes/:sceneId/audio-clips - Create new audio clip
router.post('/scenes/:sceneId/audio-clips', asyncHandler(audioClipController.createAudioClip));

/**
 * Single Audio Clip Routes
 * Mounted at /api/v1/audio-clips/:id
 */

// GET /api/v1/audio-clips/:id - Get single audio clip
router.get('/audio-clips/:id', asyncHandler(audioClipController.getAudioClip));

// PATCH /api/v1/audio-clips/:id - Update audio clip
router.patch('/audio-clips/:id', asyncHandler(audioClipController.updateAudioClip));

// DELETE /api/v1/audio-clips/:id - Delete audio clip
router.delete('/audio-clips/:id', asyncHandler(audioClipController.deleteAudioClip));

console.log('✅ AUDIO CLIP ROUTES LOADED');

module.exports = router;
