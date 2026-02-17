const router = require('express').Router();
const multer = require('multer');
const controller = require('../controllers/wardrobeLibraryController');
const { authenticate } = require('../middleware/auth');

// Development: Skip auth if in development mode
const isDevelopment = process.env.NODE_ENV === 'development';
const authMiddleware = isDevelopment
  ? (req, res, next) => {
      req.user = { id: 'dev-user', email: 'dev@example.com', name: 'Dev User' };
      next();
    }
  : authenticate;

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB max
  },
  fileFilter: (req, file, cb) => {
    const allowedMimes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, GIF, WebP allowed.'));
    }
  },
});

/**
 * Wardrobe Library Routes
 * Manage wardrobe library items and outfit sets
 */

// Debug logging
router.use((req, res, next) => {
  console.log(`🔍 Wardrobe Library Route: ${req.method} ${req.path}`);
  next();
});

// Advanced search and analytics (must be before :id routes)
router.get('/stats', controller.getStats);
router.get('/advanced-search', controller.advancedSearch);
router.get('/suggestions', controller.getSuggestions);
router.get('/check-duplicates', controller.duplicateDetection);
router.get('/analytics/most-used', controller.getMostUsedItems);
router.get('/analytics/never-used', controller.getNeverUsedItems);

// Bulk operations
router.post('/bulk-assign', controller.bulkAssign);

// Library CRUD operations
router.post('/', upload.single('image'), controller.uploadToLibrary);
router.get('/', controller.listLibrary);
router.get('/:id', controller.getLibraryItem);
router.put('/:id', upload.single('image'), controller.updateLibraryItem);
router.delete('/:id', controller.deleteLibraryItem);

// Outfit set management (Phase 3)
router.get('/:id/items', controller.getOutfitItems);
router.post('/:id/items', controller.addItemsToOutfit);
router.delete('/:setId/items/:itemId', controller.removeItemFromOutfit);

// Episode assignment
router.post('/:id/assign', controller.assignToEpisode);

// Usage tracking and analytics (Phase 5)
router.get('/:id/usage', authMiddleware, controller.getUsageHistory);
router.get('/:id/usage/shows', authMiddleware, controller.getCrossShowUsage);
router.get('/:id/usage/timeline', authMiddleware, controller.getUsageTimeline);
router.post('/:id/track-view', authMiddleware, controller.trackView);
router.post('/:id/track-selection', authMiddleware, controller.trackSelection);

module.exports = router;
