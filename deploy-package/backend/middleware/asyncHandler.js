/**
 * Async Handler Wrapper
 * Catches errors from async route handlers and passes to error middleware
 * Provides consistent error handling across all async endpoints
 */

/* eslint-disable no-console */

const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch((error) => {
    // Log error
    console.error('❌ Async handler error:', error.message);

    // If headers already sent, pass to error middleware
    if (res.headersSent) {
      return next(error);
    }

    // Send error response
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Internal server error',
      code: error.code || 'INTERNAL_ERROR',
      ...(process.env.NODE_ENV === 'development' && {
        stack: error.stack,
      }),
    });
  });
};

module.exports = asyncHandler;
