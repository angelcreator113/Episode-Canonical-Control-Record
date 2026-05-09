const express = require('express');
const router = express.Router();
const markerController = require('../controllers/markerController');
const { asyncHandler } = require('../middleware/errorHandler');
const { requireAuth } = require('../middleware/auth');

/**
 * Marker Routes
 * Base paths:
 *   - /api/v1/episodes/:episodeId/markers (episode-scoped)
 *   - /api/v1/markers/:id (single marker operations)
 */

// Episode-Scoped Marker Routes
router.get('/episodes/:episodeId/markers', requireAuth, asyncHandler(markerController.listMarkers));
router.post('/episodes/:episodeId/markers', requireAuth, asyncHandler(markerController.createMarker));
router.get(
  '/episodes/:episodeId/markers/by-type/:markerType',
  requireAuth,
  asyncHandler(markerController.getMarkersByType)
);

// Single Marker Routes
router.get('/markers/:id', requireAuth, asyncHandler(markerController.getMarker));
router.put('/markers/:id', requireAuth, asyncHandler(markerController.updateMarker));
router.delete('/markers/:id', requireAuth, asyncHandler(markerController.deleteMarker));
router.post('/markers/:id/auto-scene-link', requireAuth, asyncHandler(markerController.autoLinkScene));

module.exports = router;
