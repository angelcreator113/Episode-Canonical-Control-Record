const { CognitoJwtVerifier } = require('aws-jwt-verify');

/**
 * Authentication Middleware
 * Validates AWS Cognito JWT tokens and extracts user information
 * Uses aws-jwt-verify for proper signature verification
 */

// Create verifier for ID tokens
const idTokenVerifier = CognitoJwtVerifier.create({
  userPoolId: process.env.COGNITO_USER_POOL_ID || 'us-east-1_XXXXXXXXX',
  tokenUse: 'id',
  clientId: process.env.COGNITO_CLIENT_ID || 'xxxxxxxxxxxxxxxxxxxxxxxxxx',
});

// Create verifier for access tokens
const accessTokenVerifier = CognitoJwtVerifier.create({
  userPoolId: process.env.COGNITO_USER_POOL_ID || 'us-east-1_XXXXXXXXX',
  tokenUse: 'access',
  clientId: process.env.COGNITO_CLIENT_ID || 'xxxxxxxxxxxxxxxxxxxxxxxxxx',
});

/**
 * Verify Cognito JWT token
 * Uses AWS JWT Verify library for proper signature verification
 * Automatically fetches and caches JWKS keys from Cognito
 */
const verifyToken = async (token) => {
  try {
    const userPoolId = process.env.COGNITO_USER_POOL_ID;

    if (!userPoolId) {
      throw new Error('COGNITO_USER_POOL_ID not configured');
    }

    // Try to verify as ID token first (contains user info)
    try {
      const payload = await idTokenVerifier.verify(token);
      return payload;
    } catch (idError) {
      // If ID token verification fails, try as access token
      try {
        const payload = await accessTokenVerifier.verify(token);
        return payload;
      } catch (accessError) {
        // If both fail, throw the original ID token error
        throw idError;
      }
    }
  } catch (error) {
    throw new Error(`Token verification failed: ${error.message}`);
  }
};

/**
 * Cognito Authentication Middleware
 * Validates JWT token and extracts user information
 */
const authenticateToken = async (req, res, next) => {
  try {
    // Get token from Authorization header
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Missing authorization header',
        code: 'AUTH_MISSING_TOKEN',
      });
    }

    // Extract bearer token
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
      // Verify token
      const decoded = await verifyToken(token);

      // Attach user info to request
      req.user = {
        id: decoded.sub, // Cognito subject ID
        email: decoded.email,
        name: decoded.name,
        groups: decoded['cognito:groups'] || decoded.groups || [],
        tokenUse: decoded.token_use, // 'access' or 'id'
        issuedAt: decoded.iat,
        expiresAt: decoded.exp,
        raw: decoded,
      };

      // Continue to next middleware
      next();
    } catch (error) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: error.message,
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
 * Optional Authentication Middleware
 * Validates token if present, but doesn't require it
 */
const optionalAuth = async (req, res, next) => {
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
      const decoded = await verifyToken(token);

      req.user = {
        id: decoded.sub,
        email: decoded.email,
        name: decoded.name,
        groups: decoded['cognito:groups'] || [],
        tokenUse: decoded.token_use,
        issuedAt: decoded.iat,
        expiresAt: decoded.exp,
        raw: decoded,
      };
    } catch (error) {
      // Log but don't fail - user is optional
      console.warn('Optional auth token invalid:', error.message);
      req.user = null;
    }

    next();
  } catch (error) {
    console.error('Optional auth middleware error:', error);
    req.user = null;
    next();
  }
};

/**
 * Verify user has a specific Cognito group
 * @param {string} requiredGroup - Group name to check for
 */
const verifyGroup = (requiredGroup) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'User not authenticated',
        code: 'AUTH_REQUIRED',
      });
    }

    if (!req.user.groups || !req.user.groups.includes(requiredGroup)) {
      return res.status(403).json({
        error: 'Forbidden',
        message: `User must be in group: ${requiredGroup}`,
        code: 'AUTH_GROUP_REQUIRED',
      });
    }

    next();
  };
};

/**
 * Authorization Middleware
 * Alias for verifyGroup - checks if user is in required role/group
 * @param {string|string[]} requiredGroups - Group name(s) to check for
 */
const authorize = (requiredGroups) => {
  // Handle both single group and array of groups
  const groups = Array.isArray(requiredGroups) ? requiredGroups : [requiredGroups];

  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'User not authenticated',
        code: 'AUTH_REQUIRED',
      });
    }

    if (!req.user.groups || !req.user.groups.some((group) => groups.includes(group))) {
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
 * Alias for authenticateToken - more intuitive naming
 */
const authenticate = authenticateToken;

/**
 * Alias for authorize - check user roles/groups
 */
const authorizeRole = authorize;

module.exports = {
  authenticate,
  authenticateToken,
  authorize,
  authorizeRole,
  optionalAuth,
  verifyToken,
  verifyGroup,
};
