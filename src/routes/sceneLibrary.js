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
    // Accept common video formats including mobile-specific ones
    const allowedMimes = [
      'video/mp4',
      'video/quicktime',        // iOS .mov files
      'video/x-m4v',           // iOS .m4v files
      'video/3gpp',            // Android .3gp files
      'video/3gpp2',           // Android .3g2 files
      'video/x-msvideo',       // .avi files
      'video/x-matroska',      // .mkv files
      'video/webm',            // .webm files
      'application/octet-stream' // Fallback for some mobile browsers
    ];
    
    // Also check file extension as fallback (some mobile browsers send wrong MIME types)
    const fileExt = file.originalname.toLowerCase().split('.').pop();
    const allowedExts = ['mp4', 'mov', 'm4v', '3gp', '3g2', 'avi', 'mkv', 'webm'];
    
    if (allowedMimes.includes(file.mimetype) || allowedExts.includes(fileExt)) {
      cb(null, true);
    } else {
      cb(new Error(`Invalid file type. Received: ${file.mimetype}, Extension: ${fileExt}. Only video files are allowed.`), false);
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
