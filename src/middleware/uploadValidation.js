/**
 * Upload Validation Middleware
 * Validates file uploads before processing
 */
const FileValidationService = require('../services/FileValidationService');
const logger = require('../utils/logger');

/**
 * Validate file upload middleware
 * @param {object} req - Request object
 * @param {object} res - Response object
 * @param {function} next - Next middleware function
 */
const uploadValidation = (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file provided' });
    }

    const { fileType } = req.body;

    if (!fileType) {
      return res.status(400).json({ error: 'fileType is required' });
    }

    // Validate file
    const validation = FileValidationService.validateFile({
      name: req.file.originalname,
      size: req.file.size,
      mimeType: req.file.mimetype,
      type: fileType,
    });

    if (!validation.valid) {
      logger.warn('File validation failed', {
        fileName: req.file.originalname,
        errors: validation.errors,
      });
      return res.status(400).json({
        error: 'File validation failed',
        errors: validation.errors,
      });
    }

    // Attach validation result to request
    req.fileValidation = {
      valid: true,
      warnings: validation.warnings,
    };

    if (validation.warnings && validation.warnings.length > 0) {
      logger.warn('File upload has warnings', {
        fileName: req.file.originalname,
        warnings: validation.warnings,
      });
    }

    next();
  } catch (error) {
    logger.error('Upload validation middleware error', { error: error.message });
    res.status(500).json({ error: 'Validation error' });
  }
};

module.exports = uploadValidation;
