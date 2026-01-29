const express = require('express');
const router = express.Router();
const scriptsController = require('../controllers/scriptsController');
const { asyncHandler } = require('../middleware/errorHandler');

/**
 * Scripts Routes
 * Base path: /api/v1/scripts
 *
 * ✅ AUTH TEMPORARILY DISABLED FOR TESTING
 * TODO: Enable admin-only permissions when auth is enabled
 */

// GET /api/v1/scripts/search - Search/filter scripts (library page)
router.get('/search', asyncHandler(scriptsController.searchScripts));

// POST /api/v1/scripts/bulk-delete - Bulk delete scripts
router.post(
  '/bulk-delete',
  // authenticateToken,
  // requireAdmin,
  asyncHandler(scriptsController.bulkDelete)
);

// GET /api/v1/scripts/:scriptId - Get single script
router.get('/:scriptId', asyncHandler(scriptsController.getScriptById));

// PATCH /api/v1/scripts/:scriptId - Update script
router.patch(
  '/:scriptId',
  // authenticateToken,
  // requireAdmin,
  asyncHandler(scriptsController.updateScript)
);

// DELETE /api/v1/scripts/:scriptId - Delete script
router.delete(
  '/:scriptId',
  // authenticateToken,
  // requireAdmin,
  asyncHandler(scriptsController.deleteScript)
);

// POST /api/v1/scripts/:scriptId/set-primary - Set script as primary
router.post(
  '/:scriptId/set-primary',
  // authenticateToken,
  // requireAdmin,
  asyncHandler(scriptsController.setPrimary)
);

// POST /api/v1/scripts/:scriptId/restore - Restore old version
router.post(
  '/:scriptId/restore',
  // authenticateToken,
  // requireAdmin,
  asyncHandler(scriptsController.restoreVersion)
);

// GET /api/v1/scripts/:scriptId/history - Get edit history
router.get('/:scriptId/history', asyncHandler(scriptsController.getEditHistory));

module.exports = router;
