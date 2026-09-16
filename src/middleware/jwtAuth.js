/**
 * JWT Authentication Middleware
 * Supports both AWS Cognito and custom JWT tokens
 */

const _jwt = require('jsonwebtoken');
const { verifyToken } = require('./auth');

/**
 * Authenticate using JWT token (custom or Cognito)
 * Delegates verification to auth.js's dual-verifier verifyToken (F-AUTH-X1),
 * so this middleware accepts both HS256 (local) and RS256 (Cognito) tokens.
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
      const { payload: decoded, source, alg: _alg } = await verifyToken(token);

      req.user = {
        id: decoded.sub,
        email: decoded.email,
        name: decoded.name,
        groups: decoded['cognito:groups'] || decoded.groups || [],
        tokenUse: decoded.token_use,
        issuedAt: decoded.iat,
        expiresAt: decoded.exp,
        source,
        raw: decoded,
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
 * Token is optional; user info attached if valid. Same verifyToken delegation
 * as authenticateJWT, so it is not a second divergent verifier.
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
      const { payload: decoded, source, alg: _alg } = await verifyToken(token);
      req.user = {
        id: decoded.sub,
        email: decoded.email,
        name: decoded.name,
        groups: decoded['cognito:groups'] || decoded.groups || [],
        tokenUse: decoded.token_use,
        issuedAt: decoded.iat,
        expiresAt: decoded.exp,
        source,
        raw: decoded,
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
  // Case-insensitive: Cognito group names are values this app doesn't control.
  // Plain toLowerCase() (not toLocaleLowerCase()/localeCompare) -- locale-invariant
  // per spec, avoiding the Turkish-I class of defect on a value containing 'i'.
  const normalizedGroups = groups.map((group) => group.toLowerCase());

  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'User not authenticated',
        code: 'AUTH_REQUIRED',
      });
    }

    if (
      !req.user.groups ||
      !req.user.groups.some((g) => normalizedGroups.includes(g.toLowerCase()))
    ) {
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
