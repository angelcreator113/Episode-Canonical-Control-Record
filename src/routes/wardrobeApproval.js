const router = require('express').Router();
const controller = require('../controllers/wardrobeApprovalController');
const { requireAuth, authorize } = require('../middleware/auth');

/**
 * Wardrobe Approval Routes
 * Manage approval workflow for episode wardrobe items
 */

// Individual approval/rejection
router.put(
  '/:episodeId/wardrobe/:wardrobeId/approve',
  requireAuth, authorize(['ADMIN']),
  controller.approveWardrobeItem
);
router.put('/:episodeId/wardrobe/:wardrobeId/reject', requireAuth, authorize(['ADMIN']), controller.rejectWardrobeItem);

// Approval status
router.get('/:episodeId/wardrobe/approval-status', requireAuth, authorize(['ADMIN']), controller.getApprovalStatus);

// Bulk operations
router.put('/:episodeId/wardrobe/bulk-approve', requireAuth, authorize(['ADMIN']), controller.bulkApprove);

module.exports = router;
