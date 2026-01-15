const {
  validateFileUpload,
  validateBatchFileUpload,
  checkStorageQuota,
  ALLOWED_FILE_TYPES,
  ALLOWED_EXTENSIONS,
} = require('../../../src/middleware/fileValidation');
const FileModel = require('../../../src/models/file');

jest.mock('../../../src/models/file');

describe('File Validation Middleware', () => {
  let req, res, next;

  beforeEach(() => {
    req = {
      file: {
        originalname: 'test.mp4',
        mimetype: 'video/mp4',
        size: 10485760, // 10MB
        buffer: Buffer.from('test'),
      },
      user: { id: 'user-123' },
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    next = jest.fn();
    jest.clearAllMocks();
  });

  describe('ALLOWED_FILE_TYPES', () => {
    test('should contain video category', () => {
      expect(ALLOWED_FILE_TYPES.video).toBeDefined();
      expect(Array.isArray(ALLOWED_FILE_TYPES.video)).toBe(true);
      expect(ALLOWED_FILE_TYPES.video.length).toBeGreaterThan(0);
    });

    test('should contain image category', () => {
      expect(ALLOWED_FILE_TYPES.image).toBeDefined();
      expect(ALLOWED_FILE_TYPES.image.length).toBeGreaterThan(0);
    });

    test('should contain document category', () => {
      expect(ALLOWED_FILE_TYPES.document).toBeDefined();
      expect(ALLOWED_FILE_TYPES.document.length).toBeGreaterThan(0);
    });
  });

  describe('ALLOWED_EXTENSIONS', () => {
    test('should include video extensions', () => {
      expect(ALLOWED_EXTENSIONS).toContain('.mp4');
      expect(ALLOWED_EXTENSIONS).toContain('.mkv');
      expect(ALLOWED_EXTENSIONS).toContain('.webm');
    });

    test('should include image extensions', () => {
      expect(ALLOWED_EXTENSIONS).toContain('.jpg');
      expect(ALLOWED_EXTENSIONS).toContain('.png');
      expect(ALLOWED_EXTENSIONS).toContain('.gif');
    });

    test('should not include dangerous extensions', () => {
      expect(ALLOWED_EXTENSIONS).not.toContain('exe');
      expect(ALLOWED_EXTENSIONS).not.toContain('bat');
      expect(ALLOWED_EXTENSIONS).not.toContain('sh');
    });
  });

  describe('validateFileUpload', () => {
    test('should pass validation for valid MP4 file', (done) => {
      validateFileUpload(req, res, next);
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
      done();
    });

    test('should pass validation for valid PNG image', (done) => {
      req.file = {
        originalname: 'image.png',
        mimetype: 'image/png',
        size: 5242880, // 5MB
        buffer: Buffer.from('test'),
      };
      validateFileUpload(req, res, next);
      expect(next).toHaveBeenCalled();
      done();
    });

    test('should reject when no file attached', (done) => {
      delete req.file;
      validateFileUpload(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'NO_FILE',
        })
      );
      done();
    });

    test('should reject file with invalid extension', (done) => {
      req.file.originalname = 'malware.exe';
      validateFileUpload(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'INVALID_EXTENSION',
        })
      );
      done();
    });

    test('should reject file exceeding size limit', (done) => {
      req.file.size = 510 * 1024 * 1024; // 510MB, exceeds 500MB limit
      validateFileUpload(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'FILE_TOO_LARGE',
        })
      );
      done();
    });

    test('should reject image exceeding 50MB limit', (done) => {
      req.file.originalname = 'large.jpg';
      req.file.mimetype = 'image/jpeg';
      req.file.size = 60 * 1024 * 1024; // 60MB
      validateFileUpload(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'FILE_TOO_LARGE',
        })
      );
      done();
    });

    test('should reject unsupported MIME type', (done) => {
      req.file.mimetype = 'application/x-msdownload';
      validateFileUpload(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'INVALID_FILE_TYPE',
        })
      );
      done();
    });

    test('should reject filename exceeding 255 chars', (done) => {
      req.file.originalname = 'a'.repeat(256) + '.mp4';
      validateFileUpload(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'FILENAME_TOO_LONG',
        })
      );
      done();
    });

    test('should attach file validation data to request', (done) => {
      validateFileUpload(req, res, next);
      expect(req.fileValidation).toBeDefined();
      expect(req.fileValidation.originalName).toBe('test.mp4');
      expect(req.fileValidation.mimeType).toBe('video/mp4');
      expect(req.fileValidation.size).toBe(10485760);
      done();
    });

    test('should extract file extension correctly', (done) => {
      req.file.originalname = 'Video.With.Dots.mp4';
      validateFileUpload(req, res, next);
      expect(req.fileValidation.extension).toBe('.mp4');
      done();
    });
  });

  describe('validateBatchFileUpload', () => {
    test('should validate multiple files', (done) => {
      req.files = [
        { ...req.file, originalname: 'file1.mp4' },
        { ...req.file, originalname: 'file2.mp4' },
      ];
      validateBatchFileUpload(req, res, next);
      expect(next).toHaveBeenCalled();
      done();
    });

    test('should reject batch if any file is invalid', (done) => {
      req.files = [
        { ...req.file, originalname: 'valid.mp4' },
        { ...req.file, originalname: 'invalid.exe' },
      ];
      validateBatchFileUpload(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'BATCH_VALIDATION_FAILED',
        })
      );
      done();
    });

    test('should collect all errors for batch', (done) => {
      req.files = [
        { ...req.file, originalname: 'file1.exe' },
        { ...req.file, size: 600 * 1024 * 1024, originalname: 'file2.mp4' },
      ];
      validateBatchFileUpload(req, res, next);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          errors: expect.arrayContaining([expect.any(Object), expect.any(Object)]),
        })
      );
      done();
    });
  });

  describe('checkStorageQuota', () => {
    test('should allow upload when under quota', async () => {
      FileModel.getTotalSizeByUserId.mockResolvedValue(BigInt(5 * 1024 * 1024 * 1024)); // 5GB used
      req.fileValidation = { size: 1 * 1024 * 1024 * 1024 }; // 1GB new file

      checkStorageQuota(req, res, next);
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(next).toHaveBeenCalled();
    });

    test('should reject upload exceeding 10GB quota', async () => {
      FileModel.getTotalSizeByUserId.mockResolvedValue(BigInt(9.5 * 1024 * 1024 * 1024)); // 9.5GB used
      req.fileValidation = { size: 1 * 1024 * 1024 * 1024 }; // 1GB new file (would exceed 10GB)

      checkStorageQuota(req, res, next);
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'QUOTA_EXCEEDED',
        })
      );
    });

    test('should return available space in response', async () => {
      FileModel.getTotalSizeByUserId.mockResolvedValue(BigInt(9.5 * 1024 * 1024 * 1024)); // 9.5GB used
      req.fileValidation = { size: 1 * 1024 * 1024 * 1024 }; // 1GB new file (exceeds quota)

      checkStorageQuota(req, res, next);
      await new Promise((resolve) => setTimeout(resolve, 100));

      const callData = res.json.mock.calls[0]?.[0];
      expect(callData?.availableSpace).toBeGreaterThan(0);
    });
  });
});
