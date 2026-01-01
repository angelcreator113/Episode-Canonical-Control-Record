/**
 * File Routes
 * Endpoints for file upload, download, and management
 */
const express = require('express');
const multer = require('multer');
const { authenticateToken } = require('../middleware/auth');
const uploadValidation = require('../middleware/uploadValidation');
const fileController = require('../controllers/fileController');

const router = express.Router();

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024 * 1024, // 10GB
  },
});

/**
 * POST /api/files/:episodeId/upload
 * Upload file to episode
 */
const uploadHandler = (req, res) => fileController.uploadFile(req, res);
router.post('/:episodeId/upload', authenticateToken, upload.single('file'), uploadValidation, uploadHandler);

/**
 * GET /api/files/:episodeId/:fileId/download
 * Get pre-signed download URL
 */
const downloadHandler = (req, res) => fileController.getPreSignedUrl(req, res);
router.get('/:episodeId/:fileId/download', authenticateToken, downloadHandler);

/**
 * DELETE /api/files/:episodeId/:fileId
 * Delete file
 */
const deleteHandler = (req, res) => fileController.deleteFile(req, res);
router.delete('/:episodeId/:fileId', authenticateToken, deleteHandler);

/**
 * GET /api/files/:episodeId
 * List episode files
 */
const listHandler = (req, res) => fileController.listEpisodeFiles(req, res);
router.get('/:episodeId', authenticateToken, listHandler);

/**
 * GET /api/files/:episodeId/:fileId
 * Get file metadata
 */
const metadataHandler = (req, res) => fileController.getFileMetadata(req, res);
router.get('/:episodeId/:fileId', authenticateToken, metadataHandler);

module.exports = router;
