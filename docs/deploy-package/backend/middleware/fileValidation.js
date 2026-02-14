const logger = require('../utils/logger');

// Allowed file types and extensions
const ALLOWED_FILE_TYPES = {
  video: ['video/mp4', 'video/x-matroska', 'video/webm', 'video/x-msvideo', 'video/quicktime'],
  image: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
  document: ['application/pdf', 'text/plain', 'application/json'],
};

const ALLOWED_EXTENSIONS = [
  '.mp4',
  '.mkv',
  '.webm',
  '.avi',
  '.mov',
  '.jpg',
  '.jpeg',
  '.png',
  '.gif',
  '.webp',
  '.pdf',
  '.txt',
  '.json',
];
const MAX_FILE_SIZE = 500 * 1024 * 1024; // 500MB
const MAX_FILE_SIZE_IMAGE = 50 * 1024 * 1024; // 50MB for images

/**
 * Validate file upload
 */
function validateFileUpload(req, res, next) {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file provided',
        code: 'NO_FILE',
      });
    }

    const { originalname, mimetype, size, buffer } = req.file;

    // Check file size
    const maxSize = mimetype.startsWith('image/') ? MAX_FILE_SIZE_IMAGE : MAX_FILE_SIZE;
    if (size > maxSize) {
      return res.status(400).json({
        success: false,
        message: `File size exceeds limit (max: ${maxSize / 1024 / 1024}MB)`,
        code: 'FILE_TOO_LARGE',
        maxSize,
        providedSize: size,
      });
    }

    // Check MIME type
    const allowedMimes = Object.values(ALLOWED_FILE_TYPES).flat();
    if (!allowedMimes.includes(mimetype)) {
      logger.warn('Invalid MIME type', { originalname, mimetype });
      return res.status(400).json({
        success: false,
        message: 'File type not allowed',
        code: 'INVALID_FILE_TYPE',
        providedType: mimetype,
        allowedTypes: allowedMimes,
      });
    }

    // Check file extension
    const fileExtension = originalname.substring(originalname.lastIndexOf('.')).toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(fileExtension)) {
      logger.warn('Invalid file extension', { originalname, extension: fileExtension });
      return res.status(400).json({
        success: false,
        message: 'File extension not allowed',
        code: 'INVALID_EXTENSION',
        providedExtension: fileExtension,
        allowedExtensions: ALLOWED_EXTENSIONS,
      });
    }

    // Check file name length
    if (originalname.length > 255) {
      return res.status(400).json({
        success: false,
        message: 'File name too long (max 255 characters)',
        code: 'FILENAME_TOO_LONG',
      });
    }

    // Add validated data to request
    req.fileValidation = {
      originalName: originalname,
      mimeType: mimetype,
      size,
      extension: fileExtension,
      isVideo: mimetype.startsWith('video/'),
      isImage: mimetype.startsWith('image/'),
      buffer,
    };

    next();
  } catch (error) {
    logger.error('File validation error', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'File validation failed',
      error: error.message,
    });
  }
}

/**
 * Validate batch file upload
 */
function validateBatchFileUpload(req, res, next) {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No files provided',
        code: 'NO_FILES',
      });
    }

    const maxFiles = 10;
    if (req.files.length > maxFiles) {
      return res.status(400).json({
        success: false,
        message: `Too many files (max: ${maxFiles})`,
        code: 'TOO_MANY_FILES',
        maxFiles,
        providedCount: req.files.length,
      });
    }

    const validatedFiles = [];
    const errors = [];

    for (let i = 0; i < req.files.length; i++) {
      const file = req.files[i];
      const { originalname, mimetype, size } = file;

      // Validate file size
      const maxSize = mimetype.startsWith('image/') ? MAX_FILE_SIZE_IMAGE : MAX_FILE_SIZE;
      if (size > maxSize) {
        errors.push({
          index: i,
          fileName: originalname,
          error: `File size exceeds limit (max: ${maxSize / 1024 / 1024}MB)`,
        });
        continue;
      }

      // Validate MIME type
      const allowedMimes = Object.values(ALLOWED_FILE_TYPES).flat();
      if (!allowedMimes.includes(mimetype)) {
        errors.push({
          index: i,
          fileName: originalname,
          error: 'File type not allowed',
        });
        continue;
      }

      // Validate extension
      const fileExtension = originalname.substring(originalname.lastIndexOf('.')).toLowerCase();
      if (!ALLOWED_EXTENSIONS.includes(fileExtension)) {
        errors.push({
          index: i,
          fileName: originalname,
          error: 'File extension not allowed',
        });
        continue;
      }

      validatedFiles.push({
        file,
        originalName: originalname,
        mimeType: mimetype,
        size,
        extension: fileExtension,
      });
    }

    // Reject batch if any file has validation errors
    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Batch validation failed - some files have errors',
        code: 'BATCH_VALIDATION_FAILED',
        errors,
      });
    }

    if (validatedFiles.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid files',
        code: 'NO_VALID_FILES',
        errors,
      });
    }

    req.validatedFiles = validatedFiles;
    req.fileValidationErrors = errors;

    next();
  } catch (error) {
    logger.error('Batch file validation error', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'File validation failed',
      error: error.message,
    });
  }
}

/**
 * Check storage quota
 */
async function checkStorageQuota(req, res, next) {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized',
      });
    }

    // Storage quota: 10GB per user
    const STORAGE_QUOTA = 10 * 1024 * 1024 * 1024; // 10GB

    const FileModel = require('../models/file');
    const currentSizeResult = await FileModel.getTotalSizeByUserId(userId);
    const currentSize = Number(currentSizeResult) || 0;
    const incomingSize = req.fileValidation?.size || 0;

    if (currentSize + incomingSize > STORAGE_QUOTA) {
      const availableSpace = STORAGE_QUOTA - currentSize;
      return res.status(400).json({
        success: false,
        message: 'Storage quota exceeded',
        code: 'QUOTA_EXCEEDED',
        currentSize,
        quota: STORAGE_QUOTA,
        availableSpace,
        incomingSize,
      });
    }

    req.storageInfo = {
      currentSize,
      availableSpace: STORAGE_QUOTA - currentSize,
      quota: STORAGE_QUOTA,
    };

    next();
  } catch (error) {
    logger.error('Storage quota check failed', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Storage quota check failed',
      error: error.message,
    });
  }
}

module.exports = {
  validateFileUpload,
  validateBatchFileUpload,
  checkStorageQuota,
  ALLOWED_FILE_TYPES,
  ALLOWED_EXTENSIONS,
  MAX_FILE_SIZE,
  MAX_FILE_SIZE_IMAGE,
};
