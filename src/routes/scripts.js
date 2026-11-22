const express = require('express');
const router = express.Router();
const scriptsController = require('../controllers/scriptsController');
const { asyncHandler } = require('../middleware/errorHandler');
// The four reads are an ADMIN's (Evoni, 2026-11-21). They were classed as a
// public catalog at F-AUTH-1 Step 3 CP9 because they did not read req.user,
// and answered anyone, signed in or not, with every latest script, a script's
// text for ?includeContent=true and its edit history. Scripts are production
// material: Prime Studios is admin only (her ruling of 2026-10-29). The
// correction is recorded in docs/audit/F-AUTH-1_ScriptsReads_AdminOnly_
// Amendment_2026-11-21.md. What each read answers with is named in
// services/scriptReadFields.
// The 6 writes are as CP9 left them: requireAuth (the legacy
// authenticateToken alias was converted there, v2.33 §5.53).
const { requireAuth, authorize } = require('../middleware/auth');

/**
 * Scripts Routes
 * Base path: /api/v1/scripts
 */

// ADMIN only: the list of scripts, and its search.
router.get('/', requireAuth, authorize(['ADMIN']), asyncHandler(scriptsController.getAllScripts));
router.get('/search', requireAuth, authorize(['ADMIN']), asyncHandler(scriptsController.searchScripts));

// POST /api/v1/scripts/bulk-delete - Bulk delete scripts
router.post(
  '/bulk-delete',
  requireAuth,
  asyncHandler(scriptsController.bulkDelete)
);

// ADMIN only: one script; its text for ?includeContent=true.
router.get('/:scriptId', requireAuth, authorize(['ADMIN']), asyncHandler(scriptsController.getScriptById));

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

// ADMIN only: a script's edit history (never the sender's IP address or user agent).
router.get('/:scriptId/history', requireAuth, authorize(['ADMIN']), asyncHandler(scriptsController.getEditHistory));

// POST /api/v1/scripts/:scriptId/parse-scenes - Parse scenes from script (Tier 1)
router.post('/:scriptId/parse-scenes', requireAuth, asyncHandler(scriptsController.parseScenes));

module.exports = router;
