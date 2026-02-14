/**
 * Icon Slot Mapping Routes
 * Manages icon role → slot mappings
 */

const express = require('express');
const router = express.Router();
const iconSlotController = require('../controllers/iconSlotController');
const { optionalAuth } = require('../middleware/auth');

// ============================================================================
// ICON SLOT MAPPINGS
// ============================================================================

/**
 * GET /api/v1/icon-slots/mappings
 * Get all icon slot mappings
 */
router.get(
  '/mappings',
  optionalAuth,
  iconSlotController.getAllMappings
);

/**
 * GET /api/v1/icon-slots/mappings/:assetRole
 * Get mapping for specific asset role
 */
router.get(
  '/mappings/:assetRole',
  optionalAuth,
  iconSlotController.getMappingByRole
);

/**
 * GET /api/v1/icon-slots/:slotId
 * Get all icons for specific slot
 */
router.get(
  '/:slotId',
  optionalAuth,
  iconSlotController.getIconsBySlot
);

/**
 * POST /api/v1/icon-slots/mappings
 * Create new icon slot mapping (admin only)
 */
router.post(
  '/mappings',
  optionalAuth,
  iconSlotController.createMapping
);

/**
 * PUT /api/v1/icon-slots/mappings/:assetRole
 * Update icon slot mapping (admin only)
 */
router.put(
  '/mappings/:assetRole',
  optionalAuth,
  iconSlotController.updateMapping
);

/**
 * DELETE /api/v1/icon-slots/mappings/:assetRole
 * Delete icon slot mapping (admin only)
 */
router.delete(
  '/mappings/:assetRole',
  optionalAuth,
  iconSlotController.deleteMapping
);

module.exports = router;
