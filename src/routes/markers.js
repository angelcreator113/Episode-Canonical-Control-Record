const express = require('express');
const router = express.Router();
const markerController = require('../controllers/markerController');
const { asyncHandler } = require('../middleware/errorHandler');

console.log('🟣 MARKER ROUTES FILE LOADING... [TIMESTAMP:', new Date().toISOString(), ']');
console.log('🆕 MARKER ROUTES VERSION: Phase 2 Week 1 - Timeline Markers');

/**
 * Marker Routes
 * Base paths:
 *   - /api/v1/episodes/:episodeId/markers (episode-scoped)
 *   - /api/v1/markers/:id (single marker operations)
 *
 * ✅ AUTH TEMPORARILY DISABLED FOR TESTING
 */

/**
 * Episode-Scoped Marker Routes
 * Mounted at /api/v1/episodes/:episodeId/markers
 */

// GET /api/v1/episodes/:episodeId/markers - List all markers for episode
router.get('/episodes/:episodeId/markers', asyncHandler(markerController.listMarkers));

// POST /api/v1/episodes/:episodeId/markers - Create new marker
router.post('/episodes/:episodeId/markers', asyncHandler(markerController.createMarker));

// GET /api/v1/episodes/:episodeId/markers/by-type/:markerType - Get markers by type
router.get(
  '/episodes/:episodeId/markers/by-type/:markerType',
  asyncHandler(markerController.getMarkersByType)
);

/**
 * Single Marker Routes
 * Mounted at /api/v1/markers/:id
 */

// GET /api/v1/markers/:id - Get single marker
router.get('/markers/:id', asyncHandler(markerController.getMarker));

// PUT /api/v1/markers/:id - Update marker
router.put('/markers/:id', asyncHandler(markerController.updateMarker));

// DELETE /api/v1/markers/:id - Delete marker
router.delete('/markers/:id', asyncHandler(markerController.deleteMarker));

// POST /api/v1/markers/:id/auto-scene-link - Auto-link to containing scene
router.post('/markers/:id/auto-scene-link', asyncHandler(markerController.autoLinkScene));

module.exports = router;
