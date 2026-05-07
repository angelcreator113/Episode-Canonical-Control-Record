const express = require('express');
const router = express.Router();
const characterClipController = require('../controllers/characterClipController');
const { asyncHandler } = require('../middleware/errorHandler');
const { requireAuth } = require('../middleware/auth');

/**
 * Character Clip Routes (Phase 2.5 - Animatic System)
 * Video clips for each character in each scene
 * Enables per-character editing workflow
 *
 * Base paths:
 *   - /api/v1/scenes/:sceneId/character-clips (scene-scoped)
 *   - /api/v1/character-clips/:id (single clip operations)
 */

// Scene-Scoped Character Clip Routes
router.get('/scenes/:sceneId/character-clips', requireAuth, asyncHandler(characterClipController.listCharacterClips));
router.post('/scenes/:sceneId/character-clips', requireAuth, asyncHandler(characterClipController.createCharacterClip));

// Single Character Clip Routes
router.get('/character-clips/:id', requireAuth, asyncHandler(characterClipController.getCharacterClip));
router.patch('/character-clips/:id', requireAuth, asyncHandler(characterClipController.updateCharacterClip));
router.delete('/character-clips/:id', requireAuth, asyncHandler(characterClipController.deleteCharacterClip));

module.exports = router;
