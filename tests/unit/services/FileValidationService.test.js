/**
 * FileValidationService Unit Tests
 * Tests file validation logic
 */
// Mock logger
jest.mock('../../../src/utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
}));

// Set up environment variables for tests
process.env.AWS_S3_BUCKET_EPISODES = 'brd-episodes-dev';
process.env.AWS_S3_BUCKET_THUMBNAILS = 'brd-thumbnails-dev';
process.env.AWS_S3_BUCKET_TEMP = 'brd-temp-dev';
process.env.FILE_LIMITS_VIDEO_SOFT = '5368709120';
process.env.FILE_LIMITS_VIDEO_HARD = '10737418240';
process.env.FILE_LIMITS_IMAGE_SOFT = '10485760';
process.env.FILE_LIMITS_IMAGE_HARD = '26214400';

const FileValidationService = require('../../../src/services/FileValidationService');

describe('FileValidationService', () => {
  describe('validateFileSize', () => {
    it('should accept valid video file size (under soft limit)', () => {
      const fileSize = 2 * 1024 * 1024 * 1024; // 2GB
      const result = FileValidationService.validateFileSize(fileSize, 'video');

      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
      expect(result.warning).toBeUndefined();
    });

    it('should accept file at soft limit with warning', () => {
      const softLimit = parseInt(process.env.FILE_LIMITS_VIDEO_SOFT) || 5368709120;
      const fileSize = softLimit + 1024; // Just over soft limit
      const result = FileValidationService.validateFileSize(fileSize, 'video');

      expect(result.valid).toBe(true);
      expect(result.warning).toBeDefined();
      expect(result.warning).toContain('soft limit');
    });

    it('should reject file exceeding hard limit', () => {
      const hardLimit = parseInt(process.env.FILE_LIMITS_VIDEO_HARD) || 10737418240;
      const fileSize = hardLimit + 1;
      const result = FileValidationService.validateFileSize(fileSize, 'video');

      expect(result.valid).toBe(false);
      expect(result.error).toContain('hard limit');
      expect(result.error).toContain('10.00GB');
    });

    it('should validate image file sizes', () => {
      const imageSize = 5 * 1024 * 1024; // 5MB
      const result = FileValidationService.validateFileSize(imageSize, 'image');

      expect(result.valid).toBe(true);
    });

    it('should validate script file sizes', () => {
      const scriptSize = 500 * 1024; // 500KB
      const result = FileValidationService.validateFileSize(scriptSize, 'script');

      expect(result.valid).toBe(true);
    });

    it('should handle unknown file type', () => {
      const result = FileValidationService.validateFileSize(1024, 'unknown');

      expect(result.valid).toBe(false);
      expect(result.error).toContain('Unknown');
    });

    it('should accept zero-byte file', () => {
      const result = FileValidationService.validateFileSize(0, 'script');

      expect(result.valid).toBe(true);
    });

    it('should reject image file exceeding hard limit', () => {
      const hardLimit = parseInt(process.env.FILE_LIMITS_IMAGE_HARD) || 26214400;
      const fileSize = hardLimit + 1;
      const result = FileValidationService.validateFileSize(fileSize, 'image');

      expect(result.valid).toBe(false);
      expect(result.error).toContain('hard limit');
    });
  });

  describe('validateFileType', () => {
    it('should accept valid video MIME type', () => {
      const result = FileValidationService.validateFileType('video/mp4', 'video');

      expect(result.valid).toBe(true);
    });

    it('should accept multiple valid MIME types for video', () => {
      const types = ['video/mp4', 'video/quicktime', 'video/x-msvideo'];
      types.forEach((mimeType) => {
        const result = FileValidationService.validateFileType(mimeType, 'video');
        expect(result.valid).toBe(true);
      });
    });

    it('should reject invalid MIME type for video', () => {
      const result = FileValidationService.validateFileType('image/jpeg', 'video');

      expect(result.valid).toBe(false);
      expect(result.error).toContain('not allowed');
    });

    it('should validate image MIME types', () => {
      const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
      validTypes.forEach((mimeType) => {
        const result = FileValidationService.validateFileType(mimeType, 'image');
        expect(result.valid).toBe(true);
      });
    });

    it('should validate script MIME types', () => {
      const validTypes = ['text/plain', 'application/json'];
      validTypes.forEach((mimeType) => {
        const result = FileValidationService.validateFileType(mimeType, 'script');
        expect(result.valid).toBe(true);
      });
    });

    it('should handle unknown file type', () => {
      const result = FileValidationService.validateFileType('application/pdf', 'unknown');

      expect(result.valid).toBe(false);
      expect(result.error).toContain('Unknown');
    });
  });

  describe('validateFile', () => {
    it('should validate complete valid file', () => {
      const file = {
        name: 'video.mp4',
        size: 2 * 1024 * 1024 * 1024,
        mimeType: 'video/mp4',
        type: 'video',
      };

      const result = FileValidationService.validateFile(file);

      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should collect multiple validation errors', () => {
      const file = {
        name: 'bad-file',
        size: 50 * 1024 * 1024 * 1024, // Way over limit
        mimeType: 'image/jpeg', // Wrong type for video
        type: 'video',
      };

      const result = FileValidationService.validateFile(file);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(1);
    });

    it('should handle missing file', () => {
      const result = FileValidationService.validateFile(null);

      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('required');
    });

    it('should validate image file completely', () => {
      const file = {
        name: 'image.png',
        size: 5 * 1024 * 1024,
        mimeType: 'image/png',
        type: 'image',
      };

      const result = FileValidationService.validateFile(file);

      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should include warnings in result', () => {
      const softLimit = parseInt(process.env.FILE_LIMITS_IMAGE_SOFT) || 10485760;
      const file = {
        name: 'large-image.jpg',
        size: softLimit + 1024,
        mimeType: 'image/jpeg',
        type: 'image',
      };

      const result = FileValidationService.validateFile(file);

      expect(result.valid).toBe(true);
      expect(result.warnings.length).toBeGreaterThan(0);
    });

    it('should reject invalid file type', () => {
      const file = {
        name: 'file.zip',
        size: 1024,
        mimeType: 'application/zip',
        type: 'invalid',
      };

      const result = FileValidationService.validateFile(file);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('generateS3Key', () => {
    it('should generate valid S3 key', () => {
      const key = FileValidationService.generateS3Key('episode-uuid', 'video', 'my-video.mp4');

      expect(key).toContain('episodes/episode-uuid/video/');
      expect(key).toContain('my-video.mp4');
      expect(key).toMatch(/\d+_my-video/);
    });

    it('should sanitize special characters in filename', () => {
      const key = FileValidationService.generateS3Key(
        'ep-1',
        'image',
        'image with spaces & special.jpg'
      );

      expect(key).not.toContain('&');
      expect(key).not.toContain(' ');
    });

    it('should include timestamp in key', () => {
      const beforeTime = Date.now();
      const key = FileValidationService.generateS3Key('ep-1', 'video', 'file.mp4');
      const afterTime = Date.now();

      const timestamp = parseInt(key.split('/')[3].split('_')[0]);
      expect(timestamp).toBeGreaterThanOrEqual(beforeTime);
      expect(timestamp).toBeLessThanOrEqual(afterTime);
    });

    it('should handle various file types', () => {
      const types = ['video', 'image', 'script'];
      types.forEach((type) => {
        const key = FileValidationService.generateS3Key('ep-1', type, 'file.ext');
        expect(key).toContain(type);
      });
    });
  });

  describe('getS3Bucket', () => {
    it('should return episodes bucket for video', () => {
      const bucket = FileValidationService.getS3Bucket('video');
      expect(bucket).toBe(process.env.AWS_S3_BUCKET_EPISODES || 'brd-episodes-dev');
    });

    it('should return thumbnails bucket for image', () => {
      const bucket = FileValidationService.getS3Bucket('image');
      expect(bucket).toBeDefined();
      expect(['brd-thumbnails-dev', 'brd-episodes-dev']).toContain(bucket);
    });

    it('should return episodes bucket for script', () => {
      const bucket = FileValidationService.getS3Bucket('script');
      expect(bucket).toBe(process.env.AWS_S3_BUCKET_EPISODES || 'brd-episodes-dev');
    });

    it('should default to episodes bucket for unknown type', () => {
      const bucket = FileValidationService.getS3Bucket('unknown');
      expect(bucket).toBe(process.env.AWS_S3_BUCKET_EPISODES || 'brd-episodes-dev');
    });
  });

  describe('getFileLimits', () => {
    it('should return file limits config', () => {
      const limits = FileValidationService.getFileLimits();

      expect(limits).toHaveProperty('video');
      expect(limits).toHaveProperty('image');
      expect(limits).toHaveProperty('script');
    });

    it('should have soft and hard limits for each type', () => {
      const limits = FileValidationService.getFileLimits();

      Object.values(limits).forEach((limit) => {
        expect(limit).toHaveProperty('soft');
        expect(limit).toHaveProperty('hard');
        expect(limit.soft).toBeLessThan(limit.hard);
      });
    });

    it('should match environment variables', () => {
      const limits = FileValidationService.getFileLimits();
      const videoSoft = parseInt(process.env.FILE_LIMITS_VIDEO_SOFT) || 5368709120;

      expect(limits.video.soft).toBe(videoSoft);
    });
  });

  describe('getAllowedMimeTypes', () => {
    it('should return allowed MIME types', () => {
      const types = FileValidationService.getAllowedMimeTypes();

      expect(types).toHaveProperty('video');
      expect(types).toHaveProperty('image');
      expect(types).toHaveProperty('script');
    });

    it('should have array of types for each category', () => {
      const types = FileValidationService.getAllowedMimeTypes();

      Object.values(types).forEach((typeArray) => {
        expect(Array.isArray(typeArray)).toBe(true);
        expect(typeArray.length).toBeGreaterThan(0);
      });
    });

    it('should include common video formats', () => {
      const types = FileValidationService.getAllowedMimeTypes();
      expect(types.video).toContain('video/mp4');
    });

    it('should include common image formats', () => {
      const types = FileValidationService.getAllowedMimeTypes();
      expect(types.image).toContain('image/jpeg');
      expect(types.image).toContain('image/png');
    });
  });
});
