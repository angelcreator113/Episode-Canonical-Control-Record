const express = require('express');
const router = express.Router();
const characterClipController = require('../controllers/characterClipController');
const { asyncHandler } = require('../middleware/errorHandler');

console.log('🟣 CHARACTER CLIP ROUTES FILE LOADING... [TIMESTAMP:', new Date().toISOString(), ']');
console.log('🆕 CHARACTER CLIP ROUTES VERSION: Phase 2.5 - Animatic System');

/**
 * Character Clip Routes (Phase 2.5 - Animatic System)
 * Video clips for each character in each scene
 * Enables per-character editing workflow
 * 
 * Base paths:
 *   - /api/v1/scenes/:sceneId/character-clips (scene-scoped)
 *   - /api/v1/character-clips/:id (single clip operations)
 *
 * ✅ AUTH TEMPORARILY DISABLED FOR TESTING
 */

/**
 * Scene-Scoped Character Clip Routes
 * Mounted at /api/v1/scenes/:sceneId/character-clips
 */

// GET /api/v1/scenes/:sceneId/character-clips - List all character clips for scene
router.get('/scenes/:sceneId/character-clips', asyncHandler(characterClipController.listCharacterClips));

// POST /api/v1/scenes/:sceneId/character-clips - Create new character clip
router.post('/scenes/:sceneId/character-clips', asyncHandler(characterClipController.createCharacterClip));

/**
 * Single Character Clip Routes
 * Mounted at /api/v1/character-clips/:id
 */

// GET /api/v1/character-clips/:id - Get single character clip
router.get('/character-clips/:id', asyncHandler(characterClipController.getCharacterClip));

// PATCH /api/v1/character-clips/:id - Update character clip
router.patch('/character-clips/:id', asyncHandler(characterClipController.updateCharacterClip));

// DELETE /api/v1/character-clips/:id - Delete character clip
router.delete('/character-clips/:id', asyncHandler(characterClipController.deleteCharacterClip));

console.log('✅ CHARACTER CLIP ROUTES LOADED');

module.exports = router;
