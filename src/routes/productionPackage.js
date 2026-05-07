/**
 * Production Package Routes
 * Generates complete production packages for episodes
 */

const express = require('express');
const router = express.Router();
const productionPackageController = require('../controllers/productionPackageController');
const { requireAuth } = require('../middleware/auth');

// ============================================================================
// PACKAGE GENERATION
// ============================================================================

/**
 * POST /api/v1/episodes/:episodeId/production-package/generate
 * Generate complete production package (ZIP with all files)
 */
router.post(
  '/:episodeId/production-package/generate',
  requireAuth,
  productionPackageController.generateProductionPackage
);

/**
 * GET /api/v1/episodes/:episodeId/production-package/latest
 * Get latest production package
 */
router.get(
  '/:episodeId/production-package/latest',
  requireAuth,
  productionPackageController.getLatestPackage
);

/**
 * GET /api/v1/episodes/:episodeId/production-package/versions
 * List all production package versions
 */
router.get(
  '/:episodeId/production-package/versions',
  requireAuth,
  productionPackageController.listPackageVersions
);

/**
 * GET /api/v1/episodes/:episodeId/production-package/:packageId
 * Get specific production package
 */
router.get(
  '/:episodeId/production-package/:packageId',
  requireAuth,
  productionPackageController.getPackage
);

/**
 * GET /api/v1/episodes/:episodeId/production-package/:packageId/download
 * Download production package ZIP
 */
router.get(
  '/:episodeId/production-package/:packageId/download',
  requireAuth,
  productionPackageController.downloadPackage
);

/**
 * DELETE /api/v1/episodes/:episodeId/production-package/:packageId
 * Delete production package
 */
router.delete(
  '/:episodeId/production-package/:packageId',
  requireAuth,
  productionPackageController.deletePackage
);

module.exports = router;
