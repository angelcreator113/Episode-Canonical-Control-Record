const { CognitoJwtVerifier } = require('aws-jwt-verify');
const { verifyToken: verifyTestToken } = require('../services/tokenService');

/**
 * Authentication Middleware
 * Validates AWS Cognito JWT tokens and extracts user information
 * Uses aws-jwt-verify for proper signature verification
 * In test environment, falls back to tokenService for simple JWT tokens
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
 * In test environment, falls back to simple JWT verification
 */
// F-Auth-3: preserve underlying verifier error via Error.cause so the optionalAuth
// classifier can distinguish infra failures from token-rejection failures upstream.
const wrapVerifierError = (original) => {
  const wrapped = new Error(`Token verification failed: ${original.message}`);
  wrapped.cause = original;
  return wrapped;
};

const verifyToken = async (token) => {
  // In test environment, use simple JWT verification
  if (process.env.NODE_ENV === 'test') {
    try {
      return verifyTestToken(token);
    } catch (error) {
      throw wrapVerifierError(error);
    }
  }

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
    throw wrapVerifierError(error);
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
 * Optional Authentication Middleware (F-Auth-3 three-case classifier)
 *
 * Case A — no Authorization header → req.user = null, no log, next().
 * Case B — header present but verifier rejects token → req.user = null,
 *          single quiet console.log, next().
 * Case C — verifier throws unexpected infra error (Cognito/JWKS/network) →
 *          structured console.error. Default behavior: 503
 *          AUTH_SERVICE_UNAVAILABLE. With degradeOnInfraFailure: true →
 *          req.user = null, next() (visibility preserved via the log).
 *
 * Polymorphic: callable as Express middleware (req, res, next) OR as a
 * factory `optionalAuth({ degradeOnInfraFailure: true })` returning a
 * middleware. Detection is by arg shape — existing route mounts that pass
 * `optionalAuth` directly to `router.get(..., optionalAuth, ...)` work
 * unchanged.
 */

// Match infra failures by name/code, NOT instanceof — bundler/realm boundaries
// make instanceof unreliable for errors crossing module-cache boundaries.
const COGNITO_INFRA_ERROR_NAMES = new Set([
  'FetchError',
  'NonRetryableFetchError',
  'JwksNotAvailableInCacheError',
  'WaitPeriodNotYetEndedJwkError',
]);

const NETWORK_INFRA_ERROR_CODES = new Set([
  'ECONNREFUSED',
  'ETIMEDOUT',
  'ENOTFOUND',
  'EAI_AGAIN',
  'ECONNRESET',
  'EHOSTUNREACH',
  'ENETUNREACH',
]);

// Walk Error.cause chain — verifyToken wraps the original verifier error,
// so the wrapper's own name/code are useless. Return the matching cause
// (or null) so the log line can surface the real failure.
const findCognitoInfraCause = (err) => {
  let cur = err;
  while (cur) {
    if (cur.name && COGNITO_INFRA_ERROR_NAMES.has(cur.name)) return cur;
    if (cur.code && NETWORK_INFRA_ERROR_CODES.has(cur.code)) return cur;
    cur = cur.cause;
  }
  return null;
};

const buildOptionalAuthMiddleware = (options = {}) => {
  const degradeOnInfraFailure = options.degradeOnInfraFailure === true;

  return async (req, res, next) => {
    const authHeader = req.headers.authorization;

    // Case A — no Authorization header
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
      return next();
    } catch (error) {
      const infraCause = findCognitoInfraCause(error);
      if (infraCause) {
        // Case C — Cognito/JWKS infrastructure failure
        console.error('[F-Auth-3] cognito_unreachable', {
          name: infraCause.name,
          code: infraCause.code,
          message: error.message,
          path: req.path,
          method: req.method,
          degraded: degradeOnInfraFailure,
        });
        if (!degradeOnInfraFailure) {
          return res.status(503).json({
            error: 'Service Unavailable',
            message: 'Authentication service is temporarily unavailable',
            code: 'AUTH_SERVICE_UNAVAILABLE',
          });
        }
        req.user = null;
        return next();
      }
      // Case B — token rejected by verifier (expired, bad signature, claim mismatch, etc.)
      console.log('[F-Auth-3] optionalAuth: token rejected', {
        message: error.message,
        path: req.path,
        method: req.method,
      });
      req.user = null;
      return next();
    }
  };
};

const _defaultOptionalAuth = buildOptionalAuthMiddleware();

const optionalAuth = function optionalAuth(...args) {
  // Middleware mode: invoked by Express as (req, res, next).
  if (
    args.length === 3 &&
    args[0] && typeof args[0] === 'object' && args[0].headers !== undefined &&
    args[1] && typeof args[1].status === 'function' &&
    typeof args[2] === 'function'
  ) {
    return _defaultOptionalAuth(args[0], args[1], args[2]);
  }
  // Factory mode: invoked as optionalAuth({ degradeOnInfraFailure }) → middleware.
  return buildOptionalAuthMiddleware(args[0] || {});
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

/**
 * requireAuth — F-Auth-4 Path 1 (post Track 1.6 split).
 *
 * Emits distinct error codes so the frontend interceptor can branch:
 *   - No Authorization header → 401 AUTH_REQUIRED. Frontend wipes
 *     creds and redirects to /login (no session present).
 *   - Header present but malformed (not "Bearer <token>") →
 *     401 AUTH_INVALID_FORMAT. Frontend pass-throughs (LOCKED §4.6) —
 *     this is a client-side integration bug, NOT a session failure.
 *   - Cognito/JWKS infra failure (verifier could not reach Cognito) →
 *     503 AUTH_SERVICE_UNAVAILABLE. Inherits F-Auth-3 classifier and
 *     structured server-side log.
 *   - Header present, verifier rejected the token → 401 AUTH_INVALID_TOKEN.
 *     Frontend attempts refresh-once-then-redirect.
 *
 * Functionally same path as authenticateToken minus the unified-contract codes.
 * The duplicate authenticateToken implementation is removed in a later Step 6b
 * backend cleanup commit.
 */
const requireAuth = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({
      error: 'Authorization required',
      message: 'This action requires a signed-in user.',
      code: 'AUTH_REQUIRED',
    });
  }
  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer') {
    // Header present but unparseable — the user IS logged in (header is set);
    // this is a client-side integration bug, NOT a session failure. Match
    // authenticateToken's contract so the Track 1 interceptor pass-throughs
    // (LOCKED §4.6) instead of redirecting to /login.
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid authorization header format. Use: Bearer <token>',
      code: 'AUTH_INVALID_FORMAT',
    });
  }
  try {
    const decoded = await verifyToken(parts[1]);
    req.user = {
      id: decoded.sub,
      email: decoded.email,
      name: decoded.name,
      groups: decoded['cognito:groups'] || decoded.groups || [],
      tokenUse: decoded.token_use,
      issuedAt: decoded.iat,
      expiresAt: decoded.exp,
      raw: decoded,
    };
    return next();
  } catch (error) {
    const infraCause = findCognitoInfraCause(error);
    if (infraCause) {
      // Inherits F-Auth-3 structured log + 503 contract from optionalAuth.
      // requireAuth is strict — no degradeOnInfraFailure option.
      console.error('[F-Auth-3] cognito_unreachable', {
        name: infraCause.name,
        code: infraCause.code,
        message: error.message,
        path: req.path,
        method: req.method,
        degraded: false,
      });
      return res.status(503).json({
        error: 'Service Unavailable',
        message: 'Authentication service is temporarily unavailable',
        code: 'AUTH_SERVICE_UNAVAILABLE',
      });
    }
    // F-Auth-4: token-rejection emits AUTH_INVALID_TOKEN so the frontend
    // interceptor can attempt refresh-once-then-redirect (per fix plan §4.6).
    // Cause is logged server-side; client sees a generic message — no verifier
    // internals leak.
    console.log('[F-Auth-4] requireAuth: token rejected', {
      message: error.message,
      path: req.path,
      method: req.method,
    });
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'The provided token is invalid or expired.',
      code: 'AUTH_INVALID_TOKEN',
    });
  }
};

module.exports = {
  authenticate,
  authenticateToken,
  authorize,
  authorizeRole,
  optionalAuth,
  requireAuth,
  verifyToken,
  verifyGroup,
};
