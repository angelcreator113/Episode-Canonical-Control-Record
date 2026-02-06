const express = require('express');
const router = express.Router();
const multer = require('multer');
const wardrobeController = require('../controllers/wardrobeController');
const { asyncHandler } = require('../middleware/errorHandler');

// Configure multer for file uploads (memory storage)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    // Accept images only
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  },
});

/**
 * Wardrobe Routes
 * Base path: /api/v1/wardrobe
 */

// Get staging items (unassigned wardrobe items)
router.get('/staging', asyncHandler(wardrobeController.getStagingItems));

// List all wardrobe items
router.get('/', asyncHandler(wardrobeController.listWardrobeItems));

// Create new wardrobe item
router.post('/', upload.single('file'), asyncHandler(wardrobeController.createWardrobeItem));

// Get item usage across shows/episodes
router.get('/:id/usage', asyncHandler(wardrobeController.getItemUsage));

// Get single wardrobe item
router.get('/:id', asyncHandler(wardrobeController.getWardrobeItem));

// Update wardrobe item
router.put('/:id', upload.single('file'), asyncHandler(wardrobeController.updateWardrobeItem));

// Process background removal for wardrobe item
router.post('/:id/process-background', asyncHandler(wardrobeController.processBackgroundRemoval));

// Delete wardrobe item (with safeguards)
router.delete('/:id', asyncHandler(wardrobeController.deleteWardrobeItem));

module.exports = router;
