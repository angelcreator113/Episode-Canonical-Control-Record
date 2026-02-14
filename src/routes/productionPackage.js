/**
 * Production Package Routes
 * Generates complete production packages for episodes
 */

const express = require('express');
const router = express.Router();
const productionPackageController = require('../controllers/productionPackageController');
const { optionalAuth } = require('../middleware/auth');

// ============================================================================
// PACKAGE GENERATION
// ============================================================================

/**
 * POST /api/v1/episodes/:episodeId/production-package/generate
 * Generate complete production package (ZIP with all files)
 */
router.post(
  '/:episodeId/production-package/generate',
  optionalAuth,
  productionPackageController.generateProductionPackage
);

/**
 * GET /api/v1/episodes/:episodeId/production-package/latest
 * Get latest production package
 */
router.get(
  '/:episodeId/production-package/latest',
  optionalAuth,
  productionPackageController.getLatestPackage
);

/**
 * GET /api/v1/episodes/:episodeId/production-package/versions
 * List all production package versions
 */
router.get(
  '/:episodeId/production-package/versions',
  optionalAuth,
  productionPackageController.listPackageVersions
);

/**
 * GET /api/v1/episodes/:episodeId/production-package/:packageId
 * Get specific production package
 */
router.get(
  '/:episodeId/production-package/:packageId',
  optionalAuth,
  productionPackageController.getPackage
);

/**
 * GET /api/v1/episodes/:episodeId/production-package/:packageId/download
 * Download production package ZIP
 */
router.get(
  '/:episodeId/production-package/:packageId/download',
  optionalAuth,
  productionPackageController.downloadPackage
);

/**
 * DELETE /api/v1/episodes/:episodeId/production-package/:packageId
 * Delete production package
 */
router.delete(
  '/:episodeId/production-package/:packageId',
  optionalAuth,
  productionPackageController.deletePackage
);

module.exports = router;
