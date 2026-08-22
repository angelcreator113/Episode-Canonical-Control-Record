/**
 * Authentication Routes
 * Handles login, token refresh, and token validation
 */

const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const TokenService = require('../services/tokenService');
const { authenticateJWT } = require('../middleware/jwtAuth');
const {
  validateLoginRequest,
  validateRefreshRequest,
  validateTokenRequest,
} = require('../middleware/requestValidation');

// Rate limiting for authentication endpoints
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 login attempts per 15 minutes
  message: 'Too many login attempts, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
  skip: (_req) => process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test', // Skip in development and test
});

const refreshLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // 10 refresh attempts per minute
  message: 'Too many token refresh attempts, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
  skip: (_req) => process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test',
});

/**
 * POST /api/v1/auth/login
 * Developer/test endpoint to get a JWT token
 * In production, this would integrate with Cognito
 */
router.post('/login', loginLimiter, validateLoginRequest, async (req, res) => {
  // FD-65 ISSUANCE HALF, closed 2026-08-22. This route issued a signed token
  // to any caller supplying a well-formed email and any 6-character password;
  // no credential was ever verified. v2.49 minted FD-65 with two halves and
  // v2.50 closed only the privilege half (75ac05f0, caller-supplied
  // groups/role removed), explicitly leaving this one open at P0.
  //
  // Disabled rather than repaired: implementing real verification is a
  // decision about whether password login should exist at all, given Cognito
  // is the actual authentication path. Fails closed until that is ruled.
  return res.status(401).json({
    error: 'Unauthorized',
    message: 'Password login is disabled.',
    code: 'AUTH_LOGIN_DISABLED',
  });
  try {
    const { email, password } = req.body;

    // Validate email
    if (!email || !email.includes('@')) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Valid email required',
        code: 'AUTH_INVALID_EMAIL',
      });
    }

    // For development: accept any password (in production, verify against Cognito)
    if (!password || password.length < 6) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Password must be at least 6 characters',
        code: 'AUTH_INVALID_PASSWORD',
      });
    }

    // Generate token pair
    const user = {
      id: `user-${email.split('@')[0]}-${Date.now()}`, // Generate ID for dev/test
      email,
      name: email.split('@')[0],
      groups: ['USER'],
      role: 'USER',
    };

    const tokens = TokenService.generateTokenPair(user);

    // Store refresh token in secure httpOnly cookie (optional)
    res.cookie('refreshToken', tokens.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    });

    return res.status(200).json({
      success: true,
      message: 'Login successful',
      data: {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        tokenType: tokens.tokenType,
        expiresIn: tokens.expiresIn,
        user: {
          email: user.email,
          name: user.name,
          groups: user.groups,
          role: user.role,
        },
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: error.message,
      code: 'AUTH_LOGIN_ERROR',
    });
  }
});

/**
 * POST /api/v1/auth/refresh
 * Refresh access token using refresh token
 */
router.post('/refresh', refreshLimiter, validateRefreshRequest, async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Refresh token required',
        code: 'AUTH_MISSING_REFRESH_TOKEN',
      });
    }

    const newTokens = TokenService.refreshAccessToken(refreshToken);

    return res.status(200).json({
      success: true,
      message: 'Token refreshed',
      data: {
        accessToken: newTokens.accessToken,
        tokenType: newTokens.tokenType,
        expiresIn: newTokens.expiresIn,
      },
    });
  } catch (error) {
    console.error('Token refresh error:', error);
    return res.status(401).json({
      error: 'Unauthorized',
      message: error.message,
      code: 'AUTH_REFRESH_FAILED',
    });
  }
});

/**
 * POST /api/v1/auth/logout
 * Logout user by revoking token
 * Requires valid authentication token
 */
router.post('/logout', authenticateJWT, (req, res) => {
  try {
    const { authorization } = req.headers;

    if (authorization) {
      const token = authorization.split(' ')[1];
      // Revoke the token
      try {
        TokenService.revokeToken(token);
      } catch (err) {
        console.log('Token revocation skipped (invalid token):', err.message);
      }
    }

    // Clear refresh token cookie if set
    res.clearCookie('refreshToken', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
    });

    return res.status(200).json({
      success: true,
      message: 'Logout successful',
      data: {
        loggedOut: true,
      },
    });
  } catch (error) {
    console.error('Logout error:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: error.message,
      code: 'AUTH_LOGOUT_ERROR',
    });
  }
});

/**
 * GET /api/v1/auth/me
 * Get current authenticated user
 */
router.get('/me', authenticateJWT, (req, res) => {
  try {
    return res.status(200).json({
      success: true,
      message: 'User information retrieved',
      data: {
        user: req.user,
      },
    });
  } catch (error) {
    console.error('Get user error:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: error.message,
      code: 'AUTH_GET_USER_ERROR',
    });
  }
});

/**
 * POST /api/v1/auth/validate
 * Validate a JWT token
 */
router.post('/validate', validateTokenRequest, async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Token required',
        code: 'AUTH_MISSING_TOKEN',
      });
    }

    const decoded = TokenService.verifyToken(token);

    return res.status(200).json({
      success: true,
      message: 'Token is valid',
      data: {
        valid: true,
        expiresAt: new Date(decoded.exp * 1000),
        user: {
          id: decoded.sub,
          email: decoded.email,
          name: decoded.name,
          groups: decoded.groups,
          role: decoded.role,
        },
      },
    });
  } catch (error) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: error.message,
      code: 'AUTH_INVALID_TOKEN',
      data: { valid: false },
    });
  }
});

module.exports = router;
