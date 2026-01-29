const express = require('express');
const router = express.Router();
const multer = require('multer');
const sceneLibraryController = require('../controllers/sceneLibraryController');
const { asyncHandler } = require('../middleware/errorHandler');
const { validateUUIDParam } = require('../middleware/requestValidation');

// Configure multer for file uploads (memory storage for direct S3 upload)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 500 * 1024 * 1024, // 500MB max file size
  },
  fileFilter: (req, file, cb) => {
    // Accept video files only
    const allowedMimes = [
      'video/mp4',
      'video/quicktime',
      'video/x-msvideo',
      'video/x-matroska',
      'video/webm',
    ];

    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only video files are allowed.'), false);
    }
  },
});

/**
 * Scene Library Routes
 * Base path: /api/scene-library
 *
 * ✅ AUTH TEMPORARILY DISABLED FOR TESTING
 */

/**
 * @route   GET /api/scene-library
 * @desc    List all scene library clips with filters
 * @access  Public (temp)
 * @query   showId, search, tags, processingStatus, sortBy, limit, offset
 */
router.get('/', asyncHandler(sceneLibraryController.listLibraryScenes));

/**
 * @route   GET /api/scene-library/:id
 * @desc    Get single scene library clip
 * @access  Public (temp)
 */
router.get('/:id', validateUUIDParam('id'), asyncHandler(sceneLibraryController.getLibraryScene));

/**
 * @route   POST /api/scene-library/upload
 * @desc    Upload new video clip to scene library
 * @access  Public (temp)
 * @body    multipart/form-data with 'file' field + showId, title, description, tags, characters
 */
router.post(
  '/upload',
  // authenticateToken,  // ✅ COMMENTED OUT FOR TESTING
  upload.single('file'),
  asyncHandler(sceneLibraryController.uploadSceneClip)
);

/**
 * @route   PUT /api/scene-library/:id
 * @desc    Update scene library metadata
 * @access  Public (temp)
 */
router.put(
  '/:id',
  validateUUIDParam('id'),
  // authenticateToken,  // ✅ COMMENTED OUT FOR TESTING
  asyncHandler(sceneLibraryController.updateLibraryScene)
);

/**
 * @route   DELETE /api/scene-library/:id
 * @desc    Delete scene library clip (soft delete)
 * @access  Public (temp)
 */
router.delete(
  '/:id',
  validateUUIDParam('id'),
  // authenticateToken,  // ✅ COMMENTED OUT FOR TESTING
  asyncHandler(sceneLibraryController.deleteLibraryScene)
);

module.exports = router;
