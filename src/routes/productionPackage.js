/**
 * Production Package Routes
 * Generates complete production packages for episodes
 */

const express = require('express');
const router = express.Router();
const productionPackageController = require('../controllers/productionPackageController');
// The four reads are an ADMIN's (Evoni, 2026-11-22): a package is built from
// the episode's script, and a non-admin account is never sent internal script
// text (docs/audit/F-AUTH-1_ScriptReads_AdminOnly_Amendment2_2026-11-22.md).
// The two writes are an ADMIN's too (Evoni, 2026-11-22): generating answers
// with the package built from the script, and the delete is a hard delete
// (docs/audit/F-AUTH-1_DestructiveOps_ParseScript_AdminOnly_Amendment_2026-11-22.md).
const { requireAuth, authorize } = require('../middleware/auth');

// ============================================================================
// PACKAGE GENERATION
// ============================================================================

/**
 * POST /api/v1/episodes/:episodeId/production-package/generate
 * Generate complete production package (ZIP with all files)
 */
router.post(
  '/:episodeId/production-package/generate',
  requireAuth, authorize(['ADMIN']),
  productionPackageController.generateProductionPackage
);

/**
 * GET /api/v1/episodes/:episodeId/production-package/latest
 * Get latest production package
 */
router.get(
  '/:episodeId/production-package/latest',
  requireAuth, authorize(['ADMIN']),
  productionPackageController.getLatestPackage
);

/**
 * GET /api/v1/episodes/:episodeId/production-package/versions
 * List all production package versions
 */
router.get(
  '/:episodeId/production-package/versions',
  requireAuth, authorize(['ADMIN']),
  productionPackageController.listPackageVersions
);

/**
 * GET /api/v1/episodes/:episodeId/production-package/:packageId
 * Get specific production package
 */
router.get(
  '/:episodeId/production-package/:packageId',
  requireAuth, authorize(['ADMIN']),
  productionPackageController.getPackage
);

/**
 * GET /api/v1/episodes/:episodeId/production-package/:packageId/download
 * Download production package ZIP
 */
router.get(
  '/:episodeId/production-package/:packageId/download',
  requireAuth, authorize(['ADMIN']),
  productionPackageController.downloadPackage
);

/**
 * DELETE /api/v1/episodes/:episodeId/production-package/:packageId
 * Delete production package
 */
router.delete(
  '/:episodeId/production-package/:packageId',
  requireAuth, authorize(['ADMIN']),
  productionPackageController.deletePackage
);

module.exports = router;
