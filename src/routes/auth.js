/**
 * Authentication Routes
 * Handles login, token refresh, and token validation
 */

const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const TokenService = require('../services/tokenService');
const cognitoPasswordAuthService = require('../services/cognitoPasswordAuthService');
const { authenticateJWT } = require('../middleware/jwtAuth');
const { optionalAuth } = require('../middleware/auth');
const {
  validateLoginRequest,
  validateRefreshRequest,
  validateTokenRequest,
} = require('../middleware/requestValidation');

// Cognito exception name -> HTTP response. UserNotFoundException maps to the
// same status/code/message as NotAuthorizedException so a caller cannot tell
// a nonexistent account from a wrong password.
const COGNITO_LOGIN_ERROR_MAP = {
  NotAuthorizedException: {
    status: 401,
    error: 'Unauthorized',
    code: 'AUTH_INVALID_CREDENTIALS',
    message: 'Incorrect email or password.',
  },
  UserNotFoundException: {
    status: 401,
    error: 'Unauthorized',
    code: 'AUTH_INVALID_CREDENTIALS',
    message: 'Incorrect email or password.',
  },
  UserNotConfirmedException: {
    status: 403,
    error: 'Forbidden',
    code: 'AUTH_USER_NOT_CONFIRMED',
    message: 'This account has not been confirmed.',
  },
  PasswordResetRequiredException: {
    status: 403,
    error: 'Forbidden',
    code: 'AUTH_PASSWORD_RESET_REQUIRED',
    message: 'A password reset is required for this account.',
  },
  TooManyRequestsException: {
    status: 429,
    error: 'Too Many Requests',
    code: 'AUTH_TOO_MANY_REQUESTS',
    message: 'Too many login attempts. Please try again later.',
  },
  LimitExceededException: {
    status: 429,
    error: 'Too Many Requests',
    code: 'AUTH_TOO_MANY_REQUESTS',
    message: 'Too many login attempts. Please try again later.',
  },
};

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
 * Exchanges email/password for Cognito tokens via InitiateAuth
 * (AuthFlow: USER_PASSWORD_AUTH). Removed: the unconditional 401 return
 * that made this handler's try/catch (the FD-65-disabled body — a dev-only
 * flow that minted a local HS256 token for any well-formed email and any
 * 6-character password, without verifying either) unreachable dead code.
 * Per F-AUTH-1_AuthIssuanceSurface_Read_2026-09-15.md and
 * F-AUTH-1_LoginHandler_UnreachableRegion_Read_2026-09-14.md, Evoni ruled
 * on 2026-09-14 (a) the fix-cycle scope restriction is waived for
 * password-login implementation, (b) the local HS256 token family is
 * narrowed to a controlled internal flow and must not remain the issuance
 * path for user login, and (c) FD-65's issuance half closes on live
 * verification against the real Cognito pool, not on implementation. This
 * handler implements ruling (b); it does not, and cannot, discharge (c).
 */
router.post('/login', optionalAuth, loginLimiter, validateLoginRequest, async (req, res) => {
  try {
    const { email, password } = req.body;
    const result = await cognitoPasswordAuthService.initiatePasswordAuth(email, password);

    // Contract: this endpoint returns exactly these five fields, built from
    // the id token's claims — never the raw Cognito response. No local
    // HS256 token is minted on this path (TokenService.generateTokenPair is
    // not called here).
    return res.status(200).json({
      success: true,
      message: 'Login successful',
      data: {
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        expiresIn: result.expiresIn,
        tokenType: result.tokenType,
        user: result.user,
      },
    });
  } catch (error) {
    const mapped = COGNITO_LOGIN_ERROR_MAP[error.name];
    // Never log or return the password, the Cognito client secret, or the
    // raw Cognito error object — only the exception name.
    console.error('Login error:', error.name || 'UnknownError');
    if (mapped) {
      return res.status(mapped.status).json({
        error: mapped.error,
        message: mapped.message,
        code: mapped.code,
      });
    }
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Login failed.',
      code: 'AUTH_LOGIN_ERROR',
    });
  }
});

/**
 * POST /api/v1/auth/refresh
 * Refresh access token using refresh token
 */
router.post('/refresh', optionalAuth, refreshLimiter, validateRefreshRequest, async (req, res) => {
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
    // Contract: this endpoint returns exactly these four fields, independent
    // of whichever middleware built req.user (jwtAuth.js delegates to
    // auth.js's verifyToken, but /me does not expose req.user verbatim).
    const { id, email, name, groups } = req.user;
    return res.status(200).json({
      success: true,
      message: 'User information retrieved',
      data: {
        user: { id, email, name, groups },
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
router.post('/validate', optionalAuth, validateTokenRequest, async (req, res) => {
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
