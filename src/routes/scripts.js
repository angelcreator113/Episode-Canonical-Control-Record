const express = require('express');
const router = express.Router();
const scriptsController = require('../controllers/scriptsController');
const { asyncHandler } = require('../middleware/errorHandler');
// F-AUTH-1 Step 3 CP9: mixed Tier 1+4 within single file (per v2.33 §5.21,
// 6th cumulative instance after worldStudio.js @ CP3 + universe.js @ CP6 +
// franchiseBrainRoutes.js @ CP7 + socialProfileRoutes.js + feedPostRoutes.js
// @ CP8). 4 GETs are public catalog reads (no req.user consumption); 6 writes
// are Tier 1. Legacy authenticateToken alias converted to requireAuth per
// v2.33 §5.53 (5 instances; 2nd legacy-alias conversion in CP-zone work after
// franchiseBrainRoutes:560 @ CP7).
const { requireAuth } = require('../middleware/auth');

/**
 * Scripts Routes
 * Base path: /api/v1/scripts
 */

// PUBLIC: scripts catalog endpoints (Tier 4); no req.user consumption.
router.get('/', asyncHandler(scriptsController.getAllScripts));
router.get('/search', asyncHandler(scriptsController.searchScripts));

// POST /api/v1/scripts/bulk-delete - Bulk delete scripts
router.post(
  '/bulk-delete',
  requireAuth,
  asyncHandler(scriptsController.bulkDelete)
);

// PUBLIC: single-script + history catalog reads (Tier 4); no req.user consumption.
router.get('/:scriptId', asyncHandler(scriptsController.getScriptById));

// PATCH /api/v1/scripts/:scriptId - Update script
router.patch(
  '/:scriptId',
  requireAuth,
  asyncHandler(scriptsController.updateScript)
);

// DELETE /api/v1/scripts/:scriptId - Delete script
router.delete(
  '/:scriptId',
  requireAuth,
  asyncHandler(scriptsController.deleteScript)
);

// POST /api/v1/scripts/:scriptId/set-primary - Set script as primary
router.post(
  '/:scriptId/set-primary',
  requireAuth,
  asyncHandler(scriptsController.setPrimary)
);

// POST /api/v1/scripts/:scriptId/restore - Restore old version
router.post(
  '/:scriptId/restore',
  requireAuth,
  asyncHandler(scriptsController.restoreVersion)
);

// PUBLIC: edit history catalog read (Tier 4); no req.user consumption.
router.get('/:scriptId/history', asyncHandler(scriptsController.getEditHistory));

// POST /api/v1/scripts/:scriptId/parse-scenes - Parse scenes from script (Tier 1)
router.post('/:scriptId/parse-scenes', requireAuth, asyncHandler(scriptsController.parseScenes));

module.exports = router;
