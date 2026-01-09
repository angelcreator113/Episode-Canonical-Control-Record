/**
 * JWT Authentication Middleware
 * Supports both AWS Cognito and custom JWT tokens
 */

const _jwt = require('jsonwebtoken');
const TokenService = require('../services/tokenService');

/**
 * Authenticate using JWT token (custom or Cognito)
 * Tries JWT first, falls back to Cognito
 */
const authenticateJWT = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Missing authorization header',
        code: 'AUTH_MISSING_TOKEN',
      });
    }

    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer') {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid authorization header format. Use: Bearer <token>',
        code: 'AUTH_INVALID_FORMAT',
      });
    }

    const token = parts[1];

    try {
      // Try to verify as JWT token first
      const decoded = TokenService.verifyToken(token);

      req.user = {
        id: decoded.sub,
        email: decoded.email,
        name: decoded.name,
        groups: decoded.groups || [],
        role: decoded.role || 'USER',
        tokenType: 'jwt',
        source: 'jwt',
        expiresAt: new Date(decoded.exp * 1000),
      };

      return next();
    } catch (jwtError) {
      // JWT verification failed
      return res.status(401).json({
        error: 'Unauthorized',
        message: jwtError.message,
        code: 'AUTH_INVALID_TOKEN',
      });
    }
  } catch (error) {
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Authentication middleware error',
      code: 'AUTH_ERROR',
    });
  }
};

/**
 * Optional JWT Authentication
 * Token is optional; user info attached if valid
 */
const optionalJWTAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      req.user = null;
      return next();
    }

    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer') {
      req.user = null;
      return next();
    }

    const token = parts[1];

    try {
      const decoded = TokenService.verifyToken(token);
      req.user = {
        id: decoded.sub,
        email: decoded.email,
        name: decoded.name,
        groups: decoded.groups || [],
        role: decoded.role || 'USER',
        tokenType: 'jwt',
        source: 'jwt',
        expiresAt: new Date(decoded.exp * 1000),
      };
    } catch (error) {
      console.warn('Optional JWT auth failed:', error.message);
      req.user = null;
    }

    next();
  } catch (error) {
    console.error('Optional JWT auth error:', error);
    req.user = null;
    next();
  }
};

/**
 * Require user to be in a specific group
 * @param {string|string[]} requiredGroups
 */
const requireGroup = (requiredGroups) => {
  const groups = Array.isArray(requiredGroups) ? requiredGroups : [requiredGroups];

  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'User not authenticated',
        code: 'AUTH_REQUIRED',
      });
    }

    if (!req.user.groups || !req.user.groups.some(g => groups.includes(g))) {
      return res.status(403).json({
        error: 'Forbidden',
        message: `User must be in one of these groups: ${groups.join(', ')}`,
        code: 'AUTH_GROUP_REQUIRED',
      });
    }

    next();
  };
};

/**
 * Require user to have a specific role
 * @param {string|string[]} requiredRoles
 */
const requireRole = (requiredRoles) => {
  const roles = Array.isArray(requiredRoles) ? requiredRoles : [requiredRoles];

  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'User not authenticated',
        code: 'AUTH_REQUIRED',
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        error: 'Forbidden',
        message: `User must have one of these roles: ${roles.join(', ')}`,
        code: 'AUTH_ROLE_REQUIRED',
      });
    }

    next();
  };
};

module.exports = {
  authenticateJWT,
  optionalJWTAuth,
  requireGroup,
  requireRole,
};
