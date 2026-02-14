const express = require('express');
const router = express.Router();
const beatController = require('../controllers/beatController');
const { asyncHandler } = require('../middleware/errorHandler');

console.log('🟠 BEAT ROUTES FILE LOADING... [TIMESTAMP:', new Date().toISOString(), ']');
console.log('🆕 BEAT ROUTES VERSION: Phase 2.5 - Animatic System');

/**
 * Beat Routes (Phase 2.5 - Animatic System)
 * Auto-generated timing beats linking script to timeline
 * 
 * Base paths:
 *   - /api/v1/scenes/:sceneId/beats (scene-scoped)
 *   - /api/v1/beats/:id (single beat operations)
 *
 * ✅ AUTH TEMPORARILY DISABLED FOR TESTING
 */

/**
 * Scene-Scoped Beat Routes
 * Mounted at /api/v1/scenes/:sceneId/beats
 */

// GET /api/v1/scenes/:sceneId/beats - List all beats for scene
router.get('/scenes/:sceneId/beats', asyncHandler(beatController.listBeats));

// POST /api/v1/scenes/:sceneId/beats - Create new beat
router.post('/scenes/:sceneId/beats', asyncHandler(beatController.createBeat));

/**
 * Single Beat Routes
 * Mounted at /api/v1/beats/:id
 */

// GET /api/v1/beats/:id - Get single beat
router.get('/beats/:id', asyncHandler(beatController.getBeat));

// PATCH /api/v1/beats/:id - Update beat
router.patch('/beats/:id', asyncHandler(beatController.updateBeat));

// DELETE /api/v1/beats/:id - Delete beat
router.delete('/beats/:id', asyncHandler(beatController.deleteBeat));

console.log('✅ BEAT ROUTES LOADED');

module.exports = router;
