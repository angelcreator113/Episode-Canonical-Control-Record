/**
 * Error Handling Middleware
 * Centralized error handling and response formatting
 */

/**
 * Standard error response format
 */
class ApiError extends Error {
  constructor(statusCode, message, code = 'INTERNAL_ERROR', details = null) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.timestamp = new Date().toISOString();
  }

  toJSON() {
    return {
      error: this.getErrorType(),
      message: this.message,
      code: this.code,
      timestamp: this.timestamp,
      ...(this.details && { details: this.details }),
    };
  }

  getErrorType() {
    const types = {
      400: 'Bad Request',
      401: 'Unauthorized',
      403: 'Forbidden',
      404: 'Not Found',
      409: 'Conflict',
      422: 'Unprocessable Entity',
      500: 'Internal Server Error',
      503: 'Service Unavailable',
    };
    return types[this.statusCode] || 'Error';
  }
}

/**
 * Validation error helper
 */
class ValidationError extends ApiError {
  constructor(message, fields = {}) {
    super(422, message, 'VALIDATION_ERROR', { fields });
  }
}

/**
 * Not found error helper
 */
class NotFoundError extends ApiError {
  constructor(resource, id = null) {
    const msg = id ? `${resource} with ID ${id} not found` : `${resource} not found`;
    super(404, msg, 'NOT_FOUND');
  }
}

/**
 * Unauthorized error helper
 */
class UnauthorizedError extends ApiError {
  constructor(message = 'Authentication required') {
    super(401, message, 'UNAUTHORIZED');
  }
}

/**
 * Forbidden error helper
 */
class ForbiddenError extends ApiError {
  constructor(message = 'Access denied') {
    super(403, message, 'FORBIDDEN');
  }
}

/**
 * Conflict error helper
 */
class ConflictError extends ApiError {
  constructor(message, details = null) {
    super(409, message, 'CONFLICT', details);
  }
}

/**
 * Service unavailable error helper
 */
class ServiceUnavailableError extends ApiError {
  constructor(service = 'Service') {
    super(503, `${service} is currently unavailable`, 'SERVICE_UNAVAILABLE');
  }
}

/**
 * Main error handling middleware
 */
const errorHandler = (err, req, res, next) => {
  // Log error
  logError(err, req);

  // Check if response already sent
  if (res.headersSent) {
    return next(err);
  }

  let error = err;

  // Handle different error types
  if (err instanceof ApiError) {
    // Custom API error
    return res.status(err.statusCode).json(err.toJSON());
  }

  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    // JSON parsing error
    error = new ValidationError('Invalid JSON in request body');
    return res.status(error.statusCode).json(error.toJSON());
  }

  if (err.name === 'SequelizeValidationError') {
    // Sequelize validation error
    const fields = {};
    err.errors.forEach((e) => {
      fields[e.path] = e.message;
    });
    error = new ValidationError('Validation failed', fields);
    return res.status(error.statusCode).json(error.toJSON());
  }

  if (err.name === 'SequelizeUniqueConstraintError') {
    // Unique constraint violation
    const fields = {};
    err.errors.forEach((e) => {
      fields[e.path] = `${e.path} must be unique`;
    });
    error = new ConflictError('Unique constraint violation', fields);
    return res.status(error.statusCode).json(error.toJSON());
  }

  if (err.name === 'SequelizeAccessDeniedError') {
    // Database access error
    error = new ServiceUnavailableError('Database');
    return res.status(error.statusCode).json(error.toJSON());
  }

  if (err.message && err.message.includes('ECONNREFUSED')) {
    // Database connection refused
    error = new ServiceUnavailableError('Database');
    return res.status(error.statusCode).json(error.toJSON());
  }

  // Default to 500 error
  const apiError = new ApiError(
    500,
    process.env.NODE_ENV === 'production'
      ? 'Internal server error'
      : err.message || 'Unknown error',
    'INTERNAL_ERROR',
    process.env.NODE_ENV !== 'production' ? { stack: err.stack } : null
  );

  res.status(apiError.statusCode).json(apiError.toJSON());
};

/**
 * 404 Not Found handler
 * Should be placed at the end of all route definitions
 */
const notFoundHandler = (req, res) => {
  const error = new NotFoundError(`Route ${req.method} ${req.path}`);
  res.status(error.statusCode).json(error.toJSON());
};

/**
 * Async error wrapper
 * Wraps async route handlers to catch errors
 */
const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * Request validation helper
 * @param {Object} schema - Validation schema
 * @param {string} source - 'body', 'query', 'params'
 */
const validateRequest = (schema, source = 'body') => {
  return (req, res, next) => {
    const data = req[source];
    const errors = {};
    let hasErrors = false;

    Object.keys(schema).forEach((field) => {
      const rules = schema[field];
      const value = data[field];

      // Check required
      if (rules.required && !value) {
        errors[field] = `${field} is required`;
        hasErrors = true;
        return;
      }

      // Check type
      if (value && rules.type && typeof value !== rules.type) {
        errors[field] = `${field} must be ${rules.type}`;
        hasErrors = true;
        return;
      }

      // Check min length
      if (value && rules.minLength && value.length < rules.minLength) {
        errors[field] = `${field} must be at least ${rules.minLength} characters`;
        hasErrors = true;
        return;
      }

      // Check max length
      if (value && rules.maxLength && value.length > rules.maxLength) {
        errors[field] = `${field} must not exceed ${rules.maxLength} characters`;
        hasErrors = true;
        return;
      }

      // Check pattern
      if (value && rules.pattern && !rules.pattern.test(value)) {
        errors[field] = rules.patternMessage || `${field} format is invalid`;
        hasErrors = true;
        return;
      }

      // Check enum
      if (value && rules.enum && !rules.enum.includes(value)) {
        errors[field] = `${field} must be one of: ${rules.enum.join(', ')}`;
        hasErrors = true;
        return;
      }
    });

    if (hasErrors) {
      return next(new ValidationError('Validation failed', errors));
    }

    next();
  };
};

/**
 * Log error details
 */
const logError = (err, req) => {
  const errorLog = {
    timestamp: new Date().toISOString(),
    method: req.method,
    path: req.path,
    query: req.query,
    ip: req.ip,
    userId: req.user?.id || 'anonymous',
    error: {
      name: err.name,
      message: err.message,
      code: err.code,
      statusCode: err.statusCode || 500,
    },
    ...(process.env.NODE_ENV !== 'production' && {
      stack: err.stack,
      body: req.body,
    }),
  };

  // Log based on severity
  if (err.statusCode && err.statusCode < 500) {
    console.warn('API Error:', JSON.stringify(errorLog, null, 2));
  } else {
    console.error('Internal Error:', JSON.stringify(errorLog, null, 2));
  }
};

module.exports = {
  ApiError,
  ValidationError,
  NotFoundError,
  UnauthorizedError,
  ForbiddenError,
  ConflictError,
  ServiceUnavailableError,
  errorHandler,
  notFoundHandler,
  asyncHandler,
  validateRequest,
};
