/**
 * Icon Slot Mapping Routes
 * Manages icon role → slot mappings
 */

const express = require('express');
const router = express.Router();
const iconSlotController = require('../controllers/iconSlotController');
const { requireAuth } = require('../middleware/auth');

// ============================================================================
// ICON SLOT MAPPINGS
// ============================================================================

/**
 * GET /api/v1/icon-slots/mappings
 * Get all icon slot mappings
 */
router.get(
  '/mappings',
  requireAuth,
  iconSlotController.getAllMappings
);

/**
 * GET /api/v1/icon-slots/mappings/:assetRole
 * Get mapping for specific asset role
 */
router.get(
  '/mappings/:assetRole',
  requireAuth,
  iconSlotController.getMappingByRole
);

/**
 * GET /api/v1/icon-slots/:slotId
 * Get all icons for specific slot
 */
router.get(
  '/:slotId',
  requireAuth,
  iconSlotController.getIconsBySlot
);

/**
 * POST /api/v1/icon-slots/mappings
 * Create new icon slot mapping (admin only)
 */
router.post(
  '/mappings',
  requireAuth,
  iconSlotController.createMapping
);

/**
 * PUT /api/v1/icon-slots/mappings/:assetRole
 * Update icon slot mapping (admin only)
 */
router.put(
  '/mappings/:assetRole',
  requireAuth,
  iconSlotController.updateMapping
);

/**
 * DELETE /api/v1/icon-slots/mappings/:assetRole
 * Delete icon slot mapping (admin only)
 */
router.delete(
  '/mappings/:assetRole',
  requireAuth,
  iconSlotController.deleteMapping
);

module.exports = router;
