const router = require('express').Router();
const controller = require('../controllers/wardrobeLibraryController');
const { authenticate } = require('../middleware/auth');

// Note: Upload middleware will be added when S3 integration is implemented
// For now, we'll use a simple placeholder that passes through
const uploadPlaceholder = (req, res, next) => {
  // Placeholder for future multer/S3 upload middleware
  next();
};

/**
 * Wardrobe Library Routes
 * Manage wardrobe library items and outfit sets
 */

// Library CRUD operations
router.post('/', authenticate, uploadPlaceholder, controller.uploadToLibrary);
router.get('/', authenticate, controller.listLibrary);
router.get('/:id', authenticate, controller.getLibraryItem);
router.put('/:id', authenticate, uploadPlaceholder, controller.updateLibraryItem);
router.delete('/:id', authenticate, controller.deleteLibraryItem);

// Episode assignment
router.post('/:id/assign', authenticate, controller.assignToEpisode);

// Usage tracking and analytics
router.get('/:id/usage', authenticate, controller.getUsageHistory);
router.post('/:id/track-view', authenticate, controller.trackView);
router.post('/:id/track-selection', authenticate, controller.trackSelection);

module.exports = router;
