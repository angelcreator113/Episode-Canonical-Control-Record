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

// Advanced search and analytics (must be before :id routes)
router.get('/advanced-search', authenticate, controller.advancedSearch);
router.get('/suggestions', authenticate, controller.getSuggestions);
router.get('/check-duplicates', authenticate, controller.duplicateDetection);
router.get('/analytics/most-used', authenticate, controller.getMostUsedItems);
router.get('/analytics/never-used', authenticate, controller.getNeverUsedItems);

// Bulk operations
router.post('/bulk-assign', authenticate, controller.bulkAssign);

// Library CRUD operations
router.post('/', authenticate, uploadPlaceholder, controller.uploadToLibrary);
router.get('/', authenticate, controller.listLibrary);
router.get('/:id', authenticate, controller.getLibraryItem);
router.put('/:id', authenticate, uploadPlaceholder, controller.updateLibraryItem);
router.delete('/:id', authenticate, controller.deleteLibraryItem);

// Outfit set management (Phase 3)
router.get('/:id/items', authenticate, controller.getOutfitItems);
router.post('/:id/items', authenticate, controller.addItemsToOutfit);
router.delete('/:setId/items/:itemId', authenticate, controller.removeItemFromOutfit);

// Episode assignment
router.post('/:id/assign', authenticate, controller.assignToEpisode);

// Usage tracking and analytics (Phase 5)
router.get('/:id/usage', authenticate, controller.getUsageHistory);
router.get('/:id/usage/shows', authenticate, controller.getCrossShowUsage);
router.get('/:id/usage/timeline', authenticate, controller.getUsageTimeline);
router.post('/:id/track-view', authenticate, controller.trackView);
router.post('/:id/track-selection', authenticate, controller.trackSelection);

module.exports = router;
