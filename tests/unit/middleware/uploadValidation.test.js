/**
 * uploadValidation Middleware Unit Tests
 * Tests file upload validation via FileValidationService
 */

jest.mock('../../../src/utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
  error: jest.fn(),
}));

jest.mock('../../../src/services/FileValidationService', () => ({
  validateFile: jest.fn(),
}));

const FileValidationService = require('../../../src/services/FileValidationService');
const uploadValidation = require('../../../src/middleware/uploadValidation');

describe('uploadValidation', () => {
  let mockReq, mockRes, mockNext;

  beforeEach(() => {
    jest.clearAllMocks();
    mockReq = {
      file: {
        originalname: 'test-video.mp4',
        size: 1024 * 1024,
        mimetype: 'video/mp4',
      },
      body: { fileType: 'video' },
    };
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    mockNext = jest.fn();
  });

  it('should return 400 when no file is provided', () => {
    mockReq.file = undefined;
    uploadValidation(mockReq, mockRes, mockNext);
    expect(mockRes.status).toHaveBeenCalledWith(400);
    expect(mockRes.json).toHaveBeenCalledWith({ error: 'No file provided' });
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('should return 400 when fileType is missing from body', () => {
    delete mockReq.body.fileType;
    uploadValidation(mockReq, mockRes, mockNext);
    expect(mockRes.status).toHaveBeenCalledWith(400);
    expect(mockRes.json).toHaveBeenCalledWith({ error: 'fileType is required' });
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('should call next when file is valid', () => {
    FileValidationService.validateFile.mockReturnValue({ valid: true, errors: [], warnings: [] });
    uploadValidation(mockReq, mockRes, mockNext);
    expect(mockNext).toHaveBeenCalled();
    expect(mockRes.status).not.toHaveBeenCalled();
  });

  it('should attach fileValidation to req on success', () => {
    FileValidationService.validateFile.mockReturnValue({ valid: true, errors: [], warnings: [] });
    uploadValidation(mockReq, mockRes, mockNext);
    expect(mockReq.fileValidation).toEqual({ valid: true, warnings: [] });
  });

  it('should include warnings in req.fileValidation', () => {
    FileValidationService.validateFile.mockReturnValue({
      valid: true,
      errors: [],
      warnings: ['File size is near the limit'],
    });
    uploadValidation(mockReq, mockRes, mockNext);
    expect(mockReq.fileValidation.warnings).toEqual(['File size is near the limit']);
    expect(mockNext).toHaveBeenCalled();
  });

  it('should return 400 when file validation fails', () => {
    FileValidationService.validateFile.mockReturnValue({
      valid: false,
      errors: ['File type not allowed'],
      warnings: [],
    });
    uploadValidation(mockReq, mockRes, mockNext);
    expect(mockRes.status).toHaveBeenCalledWith(400);
    expect(mockRes.json).toHaveBeenCalledWith({
      error: 'File validation failed',
      errors: ['File type not allowed'],
    });
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('should pass correct file info to FileValidationService.validateFile', () => {
    FileValidationService.validateFile.mockReturnValue({ valid: true, errors: [], warnings: [] });
    uploadValidation(mockReq, mockRes, mockNext);
    expect(FileValidationService.validateFile).toHaveBeenCalledWith({
      name: 'test-video.mp4',
      size: 1024 * 1024,
      mimeType: 'video/mp4',
      type: 'video',
    });
  });

  it('should return 500 when FileValidationService throws', () => {
    FileValidationService.validateFile.mockImplementation(() => {
      throw new Error('Service unavailable');
    });
    uploadValidation(mockReq, mockRes, mockNext);
    expect(mockRes.status).toHaveBeenCalledWith(500);
    expect(mockRes.json).toHaveBeenCalledWith({ error: 'Validation error' });
    expect(mockNext).not.toHaveBeenCalled();
  });
});
