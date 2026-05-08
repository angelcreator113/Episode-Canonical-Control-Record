/**
 * File Routes
 * Endpoints for file upload, download, and management
 */
const express = require('express');
const multer = require('multer');
const { requireAuth } = require('../middleware/auth');
const uploadValidation = require('../middleware/uploadValidation');
const fileController = require('../controllers/fileController');

const router = express.Router();

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 500 * 1024 * 1024, // 500MB
  },
});

/**
 * POST /api/files/:episodeId/upload
 * Upload file to episode
 */
const uploadHandler = (req, res) => fileController.uploadFile(req, res);
router.post(
  '/:episodeId/upload',
  requireAuth,
  upload.single('file'),
  uploadValidation,
  uploadHandler
);

/**
 * GET /api/files/:episodeId/:fileId/download
 * Get pre-signed download URL
 */
const downloadHandler = (req, res) => fileController.getPreSignedUrl(req, res);
router.get('/:episodeId/:fileId/download', requireAuth, downloadHandler);

/**
 * DELETE /api/files/:episodeId/:fileId
 * Delete file
 */
const deleteHandler = (req, res) => fileController.deleteFile(req, res);
router.delete('/:episodeId/:fileId', requireAuth, deleteHandler);

/**
 * GET /api/files/:episodeId
 * List episode files
 */
const listHandler = (req, res) => fileController.listEpisodeFiles(req, res);
router.get('/:episodeId', requireAuth, listHandler);

/**
 * GET /api/files/:episodeId/:fileId
 * Get file metadata
 */
const metadataHandler = (req, res) => fileController.getFileMetadata(req, res);
router.get('/:episodeId/:fileId', requireAuth, metadataHandler);

module.exports = router;
