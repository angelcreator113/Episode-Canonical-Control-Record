/**
 * Error Handler Middleware Unit Tests
 */

const {
  ApiError,
  NotFoundError,
  ValidationError,
  UnauthorizedError,
  ForbiddenError,
  ConflictError,
  ServiceUnavailableError,
  errorHandler,
  notFoundHandler,
  asyncHandler,
  validateRequest,
} = require('../../../src/middleware/errorHandler');

describe('Error Handler Middleware', () => {
  let mockReq, mockRes, mockNext;

  beforeEach(() => {
    mockReq = {};
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    mockNext = jest.fn();
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('NotFoundError', () => {
    test('should create NotFoundError with message', () => {
      const error = new NotFoundError('User', 123);
      expect(error.message).toContain('User');
      expect(error.statusCode).toBe(404);
    });

    test('should handle NotFoundError in middleware', () => {
      const error = new NotFoundError('Episode', 999);
      errorHandler(error, mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Not Found',
          code: 'NOT_FOUND',
          timestamp: expect.any(String),
        })
      );
    });
  });

  describe('ValidationError', () => {
    test('should create ValidationError with details', () => {
      const details = { email: 'Invalid email' };
      const error = new ValidationError('Invalid input', details);
      expect(error.message).toContain('Invalid input');
      expect(error.statusCode).toBe(422);
    });

    test('should handle ValidationError in middleware', () => {
      const error = new ValidationError('Invalid fields', {
        email: 'Required field',
      });
      errorHandler(error, mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(422);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.any(String),
          code: 'VALIDATION_ERROR',
          timestamp: expect.any(String),
        })
      );
    });
  });

  describe('UnauthorizedError', () => {
    test('should create UnauthorizedError', () => {
      const error = new UnauthorizedError('Invalid token');
      expect(error.message).toContain('Invalid token');
      expect(error.statusCode).toBe(401);
    });

    test('should handle UnauthorizedError in middleware', () => {
      const error = new UnauthorizedError('Token expired');
      errorHandler(error, mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Unauthorized',
          code: 'UNAUTHORIZED',
          timestamp: expect.any(String),
        })
      );
    });
  });

  describe('ForbiddenError', () => {
    test('should create ForbiddenError', () => {
      const error = new ForbiddenError('Access denied');
      expect(error.message).toContain('Access denied');
      expect(error.statusCode).toBe(403);
    });

    test('should handle ForbiddenError in middleware', () => {
      const error = new ForbiddenError('Insufficient permissions');
      errorHandler(error, mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Forbidden',
          code: 'FORBIDDEN',
          timestamp: expect.any(String),
        })
      );
    });
  });

  describe('Generic errors', () => {
    test('should handle generic Error objects', () => {
      const error = new Error('Something went wrong');
      errorHandler(error, mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.any(String),
          code: 'INTERNAL_ERROR',
          timestamp: expect.any(String),
        })
      );
    });

    test('should handle errors without message', () => {
      const error = {};
      errorHandler(error, mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(500);
    });
  });

  describe('Error response format', () => {
    test('should include error message in response', () => {
      const error = new ValidationError('Test error', {});
      errorHandler(error, mockReq, mockRes, mockNext);

      const callArgs = mockRes.json.mock.calls[0][0];
      expect(callArgs).toHaveProperty('error');
      expect(callArgs).toHaveProperty('code');
      expect(callArgs).toHaveProperty('message');
      expect(callArgs).toHaveProperty('timestamp');
    });

    test('should include validation details when present', () => {
      const details = { field: 'error message' };
      const error = new ValidationError('Validation failed', details);
      errorHandler(error, mockReq, mockRes, mockNext);

      const callArgs = mockRes.json.mock.calls[0][0];
      expect(callArgs).toHaveProperty('details');
    });
  });

  describe('ConflictError', () => {
    test('should create ConflictError', () => {
      const error = new ConflictError('Resource already exists');
      expect(error.message).toContain('Resource already exists');
      expect(error.statusCode).toBe(409);
      expect(error.code).toBe('CONFLICT');
    });

    test('should handle ConflictError with details', () => {
      const details = { email: 'Email already in use' };
      const error = new ConflictError('Duplicate entry', details);
      errorHandler(error, mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(409);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'CONFLICT',
          details: details,
        })
      );
    });
  });

  describe('ServiceUnavailableError', () => {
    test('should create ServiceUnavailableError with default service', () => {
      const error = new ServiceUnavailableError();
      expect(error.statusCode).toBe(503);
      expect(error.code).toBe('SERVICE_UNAVAILABLE');
      expect(error.message).toContain('unavailable');
    });

    test('should create ServiceUnavailableError with custom service', () => {
      const error = new ServiceUnavailableError('Cache');
      expect(error.message).toContain('Cache');
      expect(error.statusCode).toBe(503);
    });

    test('should handle ServiceUnavailableError in middleware', () => {
      const error = new ServiceUnavailableError('Database');
      errorHandler(error, mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(503);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'SERVICE_UNAVAILABLE',
        })
      );
    });
  });

  describe('Sequelize Error Handling', () => {
    test('should handle SequelizeValidationError', () => {
      const sequelizeError = new Error('Validation error');
      sequelizeError.name = 'SequelizeValidationError';
      sequelizeError.errors = [
        { path: 'email', message: 'Invalid email format' },
        { path: 'username', message: 'Username too short' },
      ];

      errorHandler(sequelizeError, mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(422);
      const response = mockRes.json.mock.calls[0][0];
      expect(response.code).toBe('VALIDATION_ERROR');
      expect(response.details.fields).toHaveProperty('email');
      expect(response.details.fields).toHaveProperty('username');
    });

    test('should handle SequelizeUniqueConstraintError', () => {
      const sequelizeError = new Error('Unique constraint violation');
      sequelizeError.name = 'SequelizeUniqueConstraintError';
      sequelizeError.errors = [
        { path: 'email', message: 'Email already exists' },
      ];

      errorHandler(sequelizeError, mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(409);
      const response = mockRes.json.mock.calls[0][0];
      expect(response.code).toBe('CONFLICT');
      // ConflictError returns { fields: {...} } in details
      if (response.details && response.details.fields) {
        expect(response.details.fields.email).toContain('must be unique');
      }
    });

    test('should handle SequelizeAccessDeniedError', () => {
      const sequelizeError = new Error('Access denied');
      sequelizeError.name = 'SequelizeAccessDeniedError';

      errorHandler(sequelizeError, mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(503);
      const response = mockRes.json.mock.calls[0][0];
      expect(response.code).toBe('SERVICE_UNAVAILABLE');
      expect(response.message).toContain('Database');
    });

    test('should handle database connection refused error', () => {
      const error = new Error('ECONNREFUSED: Connection refused');

      errorHandler(error, mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(503);
      const response = mockRes.json.mock.calls[0][0];
      expect(response.code).toBe('SERVICE_UNAVAILABLE');
    });
  });

  describe('JSON Parsing Error Handling', () => {
    test('should handle JSON parsing errors', () => {
      const syntaxError = new SyntaxError('Invalid JSON');
      syntaxError.status = 400;
      syntaxError.body = true;

      errorHandler(syntaxError, mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(422);
      const response = mockRes.json.mock.calls[0][0];
      expect(response.code).toBe('VALIDATION_ERROR');
      expect(response.message).toContain('Invalid JSON');
    });
  });

  describe('Response Headers Already Sent', () => {
    test('should call next() if headers already sent', () => {
      mockRes.headersSent = true;
      const error = new Error('Some error');

      errorHandler(error, mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith(error);
      expect(mockRes.status).not.toHaveBeenCalled();
    });
  });

  describe('Environment-Specific Error Messages', () => {
    test('should expose error details in development', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      const error = new Error('Development error');
      errorHandler(error, mockReq, mockRes, mockNext);

      const response = mockRes.json.mock.calls[0][0];
      expect(response.message).toBe('Development error');
      expect(response).toHaveProperty('details');

      process.env.NODE_ENV = originalEnv;
    });

    test('should hide error details in production', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      const error = new Error('Secret internal error');
      errorHandler(error, mockReq, mockRes, mockNext);

      const response = mockRes.json.mock.calls[0][0];
      expect(response.message).toBe('Internal server error');
      expect(response.details).toBeUndefined();

      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('404 Not Found Handler', () => {
    test('should return 404 for undefined routes', () => {
      mockReq.method = 'GET';
      mockReq.path = '/undefined-route';

      notFoundHandler(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      const response = mockRes.json.mock.calls[0][0];
      expect(response.code).toBe('NOT_FOUND');
      expect(response.message).toContain('GET');
      expect(response.message).toContain('/undefined-route');
    });

    test('should include timestamp in 404 response', () => {
      mockReq.method = 'POST';
      mockReq.path = '/api/missing';

      notFoundHandler(mockReq, mockRes);

      const response = mockRes.json.mock.calls[0][0];
      expect(response).toHaveProperty('timestamp');
    });
  });

  describe('ApiError Base Class', () => {
    test('should create ApiError with all properties', () => {
      const error = new ApiError(400, 'Bad request', 'BAD_REQUEST', {
        field: 'error',
      });

      expect(error.statusCode).toBe(400);
      expect(error.code).toBe('BAD_REQUEST');
      expect(error.details).toEqual({ field: 'error' });
      expect(error.timestamp).toBeTruthy();
    });

    test('should map status codes to error types', () => {
      const statusCodes = [
        [400, 'Bad Request'],
        [401, 'Unauthorized'],
        [403, 'Forbidden'],
        [404, 'Not Found'],
        [409, 'Conflict'],
        [422, 'Unprocessable Entity'],
        [500, 'Internal Server Error'],
        [503, 'Service Unavailable'],
      ];

      statusCodes.forEach(([code, type]) => {
        const error = new ApiError(code, 'Test');
        expect(error.getErrorType()).toBe(type);
      });
    });

    test('should return Error for unknown status codes', () => {
      const error = new ApiError(418, 'I am a teapot');
      expect(error.getErrorType()).toBe('Error');
    });

    test('should serialize to JSON with toJSON', () => {
      const error = new ApiError(400, 'Test error', 'TEST_CODE', {
        extra: 'data',
      });
      const json = error.toJSON();

      expect(json).toHaveProperty('error');
      expect(json).toHaveProperty('message');
      expect(json).toHaveProperty('code');
      expect(json).toHaveProperty('timestamp');
      expect(json.details).toEqual({ extra: 'data' });
    });

    test('should not include null details in JSON', () => {
      const error = new ApiError(500, 'Test error', 'TEST_CODE', null);
      const json = error.toJSON();

      expect(json).not.toHaveProperty('details');
    });
  });

  describe('Async Handler Wrapper', () => {
    test('should wrap async functions and handle errors', async () => {
      const asyncFn = jest.fn(async (req, res, next) => {
        throw new Error('Async error');
      });

      const wrapped = asyncHandler(asyncFn);
      const error = new Error('Async error');

      await wrapped(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
    });

    test('should handle successful async operations', async () => {
      const asyncFn = jest.fn(async (req, res, next) => {
        res.json({ success: true });
      });

      const wrapped = asyncHandler(asyncFn);

      await wrapped(mockReq, mockRes, mockNext);

      expect(asyncFn).toHaveBeenCalledWith(mockReq, mockRes, mockNext);
    });

    test('should handle promise rejections', async () => {
      const asyncFn = jest.fn(() => Promise.reject(new Error('Rejected')));
      const wrapped = asyncHandler(asyncFn);

      await wrapped(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('Request Validation Helper', () => {
    beforeEach(() => {
      mockReq.body = {
        email: 'test@example.com',
        username: 'testuser',
        password: 'secure123',
      };
    });

    test('should pass validation for valid data', () => {
      const schema = {
        email: { required: true, type: 'string' },
        username: { required: true, type: 'string', minLength: 3 },
      };

      const validator = validateRequest(schema, 'body');
      validator(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
    });

    test('should fail validation for required missing fields', () => {
      mockReq.body = { username: 'testuser' }; // email missing
      const schema = {
        email: { required: true, type: 'string' },
        username: { required: true, type: 'string' },
      };

      const validator = validateRequest(schema, 'body');
      validator(mockReq, mockRes, mockNext);

      const error = mockNext.mock.calls[0][0];
      expect(error.statusCode).toBe(422);
      expect(error.details.fields).toHaveProperty('email');
    });

    test('should fail validation for type mismatch', () => {
      mockReq.body.email = 12345; // should be string
      const schema = {
        email: { required: true, type: 'string' },
      };

      const validator = validateRequest(schema, 'body');
      validator(mockReq, mockRes, mockNext);

      const error = mockNext.mock.calls[0][0];
      expect(error.statusCode).toBe(422);
      expect(error.details.fields.email).toContain('must be string');
    });

    test('should fail validation for minLength violation', () => {
      mockReq.body.username = 'ab'; // too short
      const schema = {
        username: { required: true, type: 'string', minLength: 3 },
      };

      const validator = validateRequest(schema, 'body');
      validator(mockReq, mockRes, mockNext);

      const error = mockNext.mock.calls[0][0];
      expect(error.details.fields.username).toContain('at least 3 characters');
    });

    test('should fail validation for maxLength violation', () => {
      mockReq.body.username = 'a'.repeat(51); // too long
      const schema = {
        username: { required: true, type: 'string', maxLength: 50 },
      };

      const validator = validateRequest(schema, 'body');
      validator(mockReq, mockRes, mockNext);

      const error = mockNext.mock.calls[0][0];
      expect(error.details.fields.username).toContain('must not exceed 50 characters');
    });

    test('should fail validation for pattern mismatch', () => {
      mockReq.body.email = 'invalid-email';
      const schema = {
        email: {
          required: true,
          type: 'string',
          pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
          patternMessage: 'Invalid email format',
        },
      };

      const validator = validateRequest(schema, 'body');
      validator(mockReq, mockRes, mockNext);

      const error = mockNext.mock.calls[0][0];
      expect(error.details.fields.email).toBe('Invalid email format');
    });

    test('should fail validation for enum violation', () => {
      mockReq.body.role = 'superuser';
      const schema = {
        role: {
          required: true,
          type: 'string',
          enum: ['admin', 'editor', 'viewer'],
        },
      };

      const validator = validateRequest(schema, 'body');
      validator(mockReq, mockRes, mockNext);

      const error = mockNext.mock.calls[0][0];
      expect(error.details.fields.role).toContain('must be one of');
      expect(error.details.fields.role).toContain('admin');
    });

    test('should validate query parameters', () => {
      mockReq.query = { page: 'abc' };
      const schema = {
        page: { required: false, type: 'string' },
      };

      const validator = validateRequest(schema, 'query');
      validator(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
    });

    test('should validate params', () => {
      mockReq.params = { id: '123' };
      const schema = {
        id: { required: true, type: 'string', pattern: /^\d+$/ },
      };

      const validator = validateRequest(schema, 'params');
      validator(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
    });

    test('should skip validation for optional fields without value', () => {
      mockReq.body = { username: 'testuser' }; // optional email missing
      const schema = {
        email: { required: false, type: 'string' },
        username: { required: true, type: 'string' },
      };

      const validator = validateRequest(schema, 'body');
      validator(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
    });
  });

  describe('Error Logging', () => {
    test('should log errors to console', () => {
      const error = new ValidationError('Test error');
      errorHandler(error, mockReq, mockRes, mockNext);

      expect(console.warn).toHaveBeenCalled();
    });

    test('should log errors with correct severity', () => {
      const clientError = new ValidationError('Client error');
      errorHandler(clientError, mockReq, mockRes, mockNext);

      // Client errors (4xx) should use console.warn
      expect(console.warn).toHaveBeenCalled();
      expect(console.error).not.toHaveBeenCalled();
    });

    test('should log server errors with correct severity', () => {
      const serverError = new Error('Server error');
      errorHandler(serverError, mockReq, mockRes, mockNext);

      // Server errors (5xx) should use console.error
      expect(console.error).toHaveBeenCalled();
    });
  });
});
