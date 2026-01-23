const router = require('express').Router();
const controller = require('../controllers/wardrobeApprovalController');
const { authenticate } = require('../middleware/auth');

/**
 * Wardrobe Approval Routes
 * Manage approval workflow for episode wardrobe items
 */

// Individual approval/rejection
router.put('/:episodeId/wardrobe/:wardrobeId/approve', authenticate, controller.approveWardrobeItem);
router.put('/:episodeId/wardrobe/:wardrobeId/reject', authenticate, controller.rejectWardrobeItem);

// Approval status
router.get('/:episodeId/wardrobe/approval-status', authenticate, controller.getApprovalStatus);

// Bulk operations
router.put('/:episodeId/wardrobe/bulk-approve', authenticate, controller.bulkApprove);

module.exports = router;
