/**
 * FileValidationService
 * Validates file uploads (size, type, dimensions)
 */
const logger = require('../utils/logger');

const FILE_LIMITS = {
  video: {
    soft: parseInt(process.env.FILE_LIMITS_VIDEO_SOFT) || 5368709120, // 5GB
    hard: parseInt(process.env.FILE_LIMITS_VIDEO_HARD) || 10737418240, // 10GB
  },
  image: {
    soft: parseInt(process.env.FILE_LIMITS_IMAGE_SOFT) || 10485760, // 10MB
    hard: parseInt(process.env.FILE_LIMITS_IMAGE_HARD) || 26214400, // 25MB
  },
  script: {
    soft: parseInt(process.env.FILE_LIMITS_SCRIPT_SOFT) || 1048576, // 1MB
    hard: parseInt(process.env.FILE_LIMITS_SCRIPT_HARD) || 5242880, // 5MB
  },
};

const ALLOWED_MIME_TYPES = {
  video: ['video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/x-matroska'],
  image: ['image/jpeg', 'image/png', 'image/webp', 'image/tiff'],
  script: ['text/plain', 'application/json', 'application/xml', 'text/javascript'],
};

class FileValidationService {
  /**
   * Validate file size against limits
   * @param {number} fileSize - File size in bytes
   * @param {string} fileType - File type (video, image, script)
   * @returns {object} Validation result {valid: boolean, error?: string}
   */
  validateFileSize(fileSize, fileType) {
    if (!FILE_LIMITS[fileType]) {
      return { valid: false, error: `Unknown file type: ${fileType}` };
    }

    const { soft, hard } = FILE_LIMITS[fileType];

    if (fileSize > hard) {
      return {
        valid: false,
        error: `File exceeds hard limit of ${(hard / 1024 / 1024 / 1024).toFixed(2)}GB for ${fileType}`,
      };
    }

    if (fileSize > soft) {
      logger.warn('File size exceeds soft limit', { fileSize, fileType, softLimit: soft });
      return {
        valid: true,
        warning: `File size exceeds soft limit of ${(soft / 1024 / 1024).toFixed(2)}MB`,
      };
    }

    return { valid: true };
  }

  /**
   * Validate file MIME type
   * @param {string} mimeType - File MIME type
   * @param {string} fileType - File type (video, image, script)
   * @returns {object} Validation result {valid: boolean, error?: string}
   */
  validateFileType(mimeType, fileType) {
    if (!ALLOWED_MIME_TYPES[fileType]) {
      return { valid: false, error: `Unknown file type: ${fileType}` };
    }

    const allowed = ALLOWED_MIME_TYPES[fileType];
    if (!allowed.includes(mimeType)) {
      return {
        valid: false,
        error: `MIME type ${mimeType} not allowed for ${fileType}. Allowed: ${allowed.join(', ')}`,
      };
    }

    return { valid: true };
  }

  /**
   * Validate complete file
   * @param {object} file - File object {name, size, mimeType, type}
   * @returns {object} Validation result {valid: boolean, errors: [], warnings: []}
   */
  validateFile(file) {
    const errors = [];
    const warnings = [];

    if (!file) {
      return { valid: false, errors: ['File is required'] };
    }

    // Validate file type
    if (!['video', 'image', 'script'].includes(file.type)) {
      errors.push(`Invalid file type: ${file.type}`);
    }

    // Validate MIME type
    const mimeValidation = this.validateFileType(file.mimeType, file.type);
    if (!mimeValidation.valid) {
      errors.push(mimeValidation.error);
    }

    // Validate file size
    const sizeValidation = this.validateFileSize(file.size, file.type);
    if (!sizeValidation.valid) {
      errors.push(sizeValidation.error);
    }
    if (sizeValidation.warning) {
      warnings.push(sizeValidation.warning);
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Generate S3 key for file
   * @param {string} episodeId - Episode ID
   * @param {string} fileType - File type (video, image, script)
   * @param {string} fileName - Original file name
   * @returns {string} S3 key
   */
  generateS3Key(episodeId, fileType, fileName) {
    const timestamp = Date.now();
    const sanitizedName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const key = `episodes/${episodeId}/${fileType}/${timestamp}_${sanitizedName}`;
    return key;
  }

  /**
   * Get S3 bucket for file type
   * @param {string} fileType - File type (video, image, script)
   * @returns {string} S3 bucket name
   */
  getS3Bucket(fileType) {
    const buckets = {
      video: process.env.AWS_S3_BUCKET_EPISODES,
      image: process.env.AWS_S3_BUCKET_THUMBNAILS || process.env.AWS_S3_BUCKET_EPISODES,
      script: process.env.AWS_S3_BUCKET_EPISODES,
    };
    return buckets[fileType] || process.env.AWS_S3_BUCKET_EPISODES;
  }

  /**
   * Get file limits configuration
   * @returns {object} File limits by type
   */
  getFileLimits() {
    return FILE_LIMITS;
  }

  /**
   * Get allowed MIME types
   * @returns {object} MIME types by file type
   */
  getAllowedMimeTypes() {
    return ALLOWED_MIME_TYPES;
  }
}

module.exports = new FileValidationService();
