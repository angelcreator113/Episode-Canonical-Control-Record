/**
 * asyncHandler Middleware Unit Tests
 * Tests error catching and response handling for async route handlers
 */

// Suppress console output during tests
jest.spyOn(console, 'error').mockImplementation(() => {});

const asyncHandler = require('../../../src/middleware/asyncHandler');

describe('asyncHandler', () => {
  let mockReq, mockRes, mockNext;

  beforeEach(() => {
    mockReq = {};
    mockRes = {
      headersSent: false,
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    mockNext = jest.fn();
    jest.clearAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should call the wrapped function with req, res, next', async () => {
    const fn = jest.fn().mockResolvedValue(undefined);
    const handler = asyncHandler(fn);
    await handler(mockReq, mockRes, mockNext);
    expect(fn).toHaveBeenCalledWith(mockReq, mockRes, mockNext);
  });

  it('should not call next or send error response when fn succeeds', async () => {
    const fn = jest.fn().mockResolvedValue('ok');
    const handler = asyncHandler(fn);
    await handler(mockReq, mockRes, mockNext);
    expect(mockNext).not.toHaveBeenCalled();
    expect(mockRes.status).not.toHaveBeenCalled();
    expect(mockRes.json).not.toHaveBeenCalled();
  });

  it('should send a 500 JSON error when fn throws without a statusCode', async () => {
    const error = new Error('Something went wrong');
    const fn = jest.fn().mockRejectedValue(error);
    const handler = asyncHandler(fn);
    await handler(mockReq, mockRes, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(500);
    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        message: 'Something went wrong',
        code: 'INTERNAL_ERROR',
      })
    );
  });

  it('should use the error statusCode when provided', async () => {
    const error = new Error('Not Found');
    error.statusCode = 404;
    const fn = jest.fn().mockRejectedValue(error);
    const handler = asyncHandler(fn);
    await handler(mockReq, mockRes, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(404);
    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        message: 'Not Found',
      })
    );
  });

  it('should use the error code when provided', async () => {
    const error = new Error('Forbidden');
    error.statusCode = 403;
    error.code = 'FORBIDDEN';
    const fn = jest.fn().mockRejectedValue(error);
    const handler = asyncHandler(fn);
    await handler(mockReq, mockRes, mockNext);

    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'FORBIDDEN',
      })
    );
  });

  it('should call next(error) when headers are already sent', async () => {
    mockRes.headersSent = true;
    const error = new Error('Late error');
    const fn = jest.fn().mockRejectedValue(error);
    const handler = asyncHandler(fn);
    await handler(mockReq, mockRes, mockNext);

    expect(mockNext).toHaveBeenCalledWith(error);
    expect(mockRes.status).not.toHaveBeenCalled();
  });

  it('should not include stack trace in non-development environment', async () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    const error = new Error('Prod error');
    const fn = jest.fn().mockRejectedValue(error);
    const handler = asyncHandler(fn);
    await handler(mockReq, mockRes, mockNext);

    const jsonCall = mockRes.json.mock.calls[0][0];
    expect(jsonCall).not.toHaveProperty('stack');
    process.env.NODE_ENV = originalEnv;
  });

  it('should include stack trace in development environment', async () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';
    const error = new Error('Dev error');
    error.stack = 'Error: Dev error\n    at test';
    const fn = jest.fn().mockRejectedValue(error);
    const handler = asyncHandler(fn);
    await handler(mockReq, mockRes, mockNext);

    const jsonCall = mockRes.json.mock.calls[0][0];
    expect(jsonCall).toHaveProperty('stack');
    process.env.NODE_ENV = originalEnv;
  });

  it('should return a function when called with a handler', () => {
    const fn = jest.fn();
    const handler = asyncHandler(fn);
    expect(typeof handler).toBe('function');
  });

  it('should handle promise rejections from async functions', async () => {
    const fn = () => Promise.reject(new Error('Async rejection'));
    const handler = asyncHandler(fn);
    await handler(mockReq, mockRes, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(500);
    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        message: 'Async rejection',
      })
    );
  });
});
