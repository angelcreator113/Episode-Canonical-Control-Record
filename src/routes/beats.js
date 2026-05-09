const express = require('express');
const router = express.Router();
const beatController = require('../controllers/beatController');
const { asyncHandler } = require('../middleware/errorHandler');
const { requireAuth } = require('../middleware/auth');

/**
 * Beat Routes (Phase 2.5 - Animatic System)
 * Auto-generated timing beats linking script to timeline
 *
 * Base paths:
 *   - /api/v1/scenes/:sceneId/beats (scene-scoped)
 *   - /api/v1/beats/:id (single beat operations)
 */

// Scene-Scoped Beat Routes
router.get('/scenes/:sceneId/beats', requireAuth, asyncHandler(beatController.listBeats));
router.post('/scenes/:sceneId/beats', requireAuth, asyncHandler(beatController.createBeat));

// Single Beat Routes
router.get('/beats/:id', requireAuth, asyncHandler(beatController.getBeat));
router.patch('/beats/:id', requireAuth, asyncHandler(beatController.updateBeat));
router.delete('/beats/:id', requireAuth, asyncHandler(beatController.deleteBeat));

module.exports = router;
