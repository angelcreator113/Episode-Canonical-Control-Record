const { CognitoJwtVerifier } = require('aws-jwt-verify');
const { verifyToken: verifyHs256Token } = require('../services/tokenService');

/**
 * Authentication Middleware
 * Validates JWT tokens and extracts user information.
 *   RS256 (Cognito) tokens — verified via aws-jwt-verify against Cognito JWKS.
 *   HS256 (local) tokens   — verified via tokenService against JWT_SECRET.
 * See F-AUTH-X1 block below for routing semantics.
 */

// ============================================================================
// F-AUTH-X1 — Dual-verifier routing (Phase 2, Option B)
// ============================================================================
//
// verifyToken uses a JWT `alg` discriminator to route tokens to one of two
// verifiers:
//
//   RS256 → AWS Cognito (lazy verifiers — see F-AUTH-2 block below)
//   HS256 → tokenService (jsonwebtoken HS256, JWT_SECRET-backed)
//
// Pre F-AUTH-X1: tokenService was wired in only when NODE_ENV === 'test'.
// Post F-AUTH-X1: tokenService is operational in ALL environments. This
// activates the existing local-HS256 login flow (POST /api/auth/login →
// generateTokenPair) for production traffic that was previously verifier-
// rejected by the Cognito-only path.
//
// ARCHITECTURAL DEBT (deliberately deferred to Track 8 — Option A migration):
//
//   1. Two trust roots exist concurrently. Cognito tokens are verified
//      against a public-key JWKS fetched from AWS; HS256 tokens are
//      verified against a single shared symmetric secret (JWT_SECRET).
//      A compromise of JWT_SECRET is sufficient to mint tokens that the
//      backend accepts as valid, with NO downstream check that distinguishes
//      "Cognito-issued" from "locally-issued" identities.
//
//   2. The `req.user.source` field ('cognito' | 'local-hs256') is
//      OBSERVABILITY ONLY — it exists so log lines and metrics can attribute
//      authenticated traffic to its verifier. It is NOT a security boundary.
//      Both verifiers produce equally-trusted req.user; do NOT use the
//      source field for trust-level discrimination, RBAC, or access-control
//      decisions in route handlers.
//
//   3. degradeOnInfraFailure (F-Auth-3 optionalAuth flag) NATURALLY
//      CONTRACTS to RS256-only traffic under this design. The flag exists
//      to keep public read-paths usable when Cognito/JWKS is unreachable;
//      it has no analogue for HS256 verification because tokenService has
//      no external dependency that can fail. HS256 traffic that fails
//      verification follows the standard token-rejection path (Case 2 of
//      the F-Auth-3 classifier).
//
//   4. Routing fallback: if `alg` cannot be parsed from the JWT header
//      (malformed token, missing header, etc.), the request routes to
//      tokenService in test environments (preserves auth-gaps.test.js
//      fixture compat) and to Cognito in non-test environments
//      (preserves AUTH_CONFIG_MISSING propagation contract). This compat
//      layer disappears once Track 8 (Option A — single-verifier
//      consolidation) lands and the dual path is removed.
//
// Track 8 will migrate to a single verifier (Option A) and delete this
// dual-verifier code path. Until then, the surface area MUST remain
// minimal: the only observable difference at the application boundary
// is req.user.source.
//
// Test coverage: tests/unit/middleware/f-auth-x1-dual-verifier.test.js
// ============================================================================

// F-AUTH-2 fix (Step 3 CP1): lazy-initialized verifiers.
// Pre-fix: CognitoJwtVerifier.create() ran at module-load time with
// `process.env.COGNITO_USER_POOL_ID || 'us-east-1_XXXXXXXXX'` placeholder
// fallbacks. If the verifier library's input-format regex tightens, the
// constructor would throw at require() time, taking down the entire server
// boot (every route file imports this middleware). The fallback masked
// missing config silently.
//
// Post-fix: verifiers instantiate lazily on first call via getter functions
// with memoized module-scope caches. Missing env-vars now produce a runtime
// AUTH_CONFIG_MISSING error wrapped via wrapVerifierError, NOT a boot crash.
let _idTokenVerifier = null;
let _accessTokenVerifier = null;

const getCognitoConfig = () => {
  const userPoolId = process.env.COGNITO_USER_POOL_ID;
  const clientId = process.env.COGNITO_CLIENT_ID;
  if (!userPoolId || !clientId) {
    const err = new Error('COGNITO_USER_POOL_ID or COGNITO_CLIENT_ID not configured');
    err.code = 'AUTH_CONFIG_MISSING';
    throw err;
  }
  return { userPoolId, clientId };
};

const getIdTokenVerifier = () => {
  if (_idTokenVerifier) return _idTokenVerifier;
  const { userPoolId, clientId } = getCognitoConfig();
  _idTokenVerifier = CognitoJwtVerifier.create({ userPoolId, tokenUse: 'id', clientId });
  return _idTokenVerifier;
};

const getAccessTokenVerifier = () => {
  if (_accessTokenVerifier) return _accessTokenVerifier;
  const { userPoolId, clientId } = getCognitoConfig();
  _accessTokenVerifier = CognitoJwtVerifier.create({ userPoolId, tokenUse: 'access', clientId });
  return _accessTokenVerifier;
};

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

// F-AUTH-X1: parse the JWT header and return the alg field if it's one we route
// on. Returns 'RS256' | 'HS256' | null. Never throws — a malformed token simply
// returns null and the caller applies the routing fallback (see Q4 §4 above).
// Reads ONLY the header — never decodes the payload, never validates signature.
const detectTokenAlgorithm = (token) => {
  if (typeof token !== 'string' || token.length === 0) return null;
  const dot = token.indexOf('.');
  if (dot < 1) return null;
  const headerB64 = token.slice(0, dot);
  try {
    const normalized = headerB64.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
    const headerJson = Buffer.from(padded, 'base64').toString('utf8');
    const header = JSON.parse(headerJson);
    if (header && typeof header.alg === 'string') {
      const alg = header.alg.toUpperCase();
      if (alg === 'RS256' || alg === 'HS256') return alg;
    }
  } catch (_err) {
    /* fallthrough → null */
  }
  return null;
};

// F-AUTH-X1: gated debug log emitted on successful verification. Logs ONLY
// path/verifier/alg/sub — never the token, the Authorization header, or the
// full decoded payload (see Q5 above + D5 decision).
const maybeAuthDebug = (req, source, alg, sub) => {
  if (process.env.AUTH_DEBUG !== 'true') return;
  console.debug('[F-AUTH-X1] verified', {
    path: req && req.path,
    verifier: source,
    alg,
    sub,
  });
};

// F-AUTH-X1: Cognito (RS256) verifier path. Preserves the existing id-token-
// then-access-token fallback so token_use:'access' tokens still verify.
const verifyViaCognito = async (token) => {
  try {
    try {
      const payload = await getIdTokenVerifier().verify(token);
      return { payload, source: 'cognito', alg: 'RS256' };
    } catch (idError) {
      try {
        const payload = await getAccessTokenVerifier().verify(token);
        return { payload, source: 'cognito', alg: 'RS256' };
      } catch (_accessError) {
        throw idError;
      }
    }
  } catch (error) {
    throw wrapVerifierError(error);
  }
};

// F-AUTH-X1: tokenService (HS256) verifier path. The same code path that has
// run under NODE_ENV === 'test' since the F-Auth-3 era — now active in all
// environments per the Phase 2 surface §Q4 routing decision.
const verifyViaHs256 = (token) => {
  try {
    const payload = verifyHs256Token(token);
    return { payload, source: 'local-hs256', alg: 'HS256' };
  } catch (error) {
    throw wrapVerifierError(error);
  }
};

const verifyToken = async (token) => {
  const alg = detectTokenAlgorithm(token);

  if (alg === 'RS256') return verifyViaCognito(token);
  if (alg === 'HS256') return verifyViaHs256(token);

  // Routing fallback for unparseable/missing alg. See Q8 §4 above.
  if (process.env.NODE_ENV === 'test') return verifyViaHs256(token);
  return verifyViaCognito(token);
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
      const { payload: decoded, source, alg } = await verifyToken(token);

      // Attach user info to request
      req.user = {
        id: decoded.sub, // Cognito subject ID (or HS256 sub)
        email: decoded.email,
        name: decoded.name,
        groups: decoded['cognito:groups'] || decoded.groups || [],
        tokenUse: decoded.token_use, // 'access' or 'id'
        issuedAt: decoded.iat,
        expiresAt: decoded.exp,
        source, // F-AUTH-X1: 'cognito' | 'local-hs256' — observability only
        raw: decoded,
      };

      maybeAuthDebug(req, source, alg, decoded && decoded.sub);

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
      const { payload: decoded, source, alg } = await verifyToken(token);
      req.user = {
        id: decoded.sub,
        email: decoded.email,
        name: decoded.name,
        groups: decoded['cognito:groups'] || [],
        tokenUse: decoded.token_use,
        issuedAt: decoded.iat,
        expiresAt: decoded.exp,
        source, // F-AUTH-X1: 'cognito' | 'local-hs256' — observability only
        raw: decoded,
      };
      maybeAuthDebug(req, source, alg, decoded && decoded.sub);
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
    const { payload: decoded, source, alg } = await verifyToken(parts[1]);
    req.user = {
      id: decoded.sub,
      email: decoded.email,
      name: decoded.name,
      groups: decoded['cognito:groups'] || decoded.groups || [],
      tokenUse: decoded.token_use,
      issuedAt: decoded.iat,
      expiresAt: decoded.exp,
      source, // F-AUTH-X1: 'cognito' | 'local-hs256' — observability only
      raw: decoded,
    };
    maybeAuthDebug(req, source, alg, decoded && decoded.sub);
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
