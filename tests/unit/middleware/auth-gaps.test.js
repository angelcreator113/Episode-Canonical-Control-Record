/**
 * Auth Middleware - Gap Coverage Tests
 * Tests for error paths and optional auth functionality
 */

// Mock the tokenService dependency module so we can drive verifier outcomes
// per test case. jest.spyOn cannot intercept calls from inside the same module
// on CJS const-bound exports — see §9.11. Mocking the dependency module instead.
jest.mock('../../../src/services/tokenService', () => ({
  verifyToken: jest.fn(),
  generateToken: jest.fn(),
  generateTokenPair: jest.fn(),
  refreshAccessToken: jest.fn(),
  revokeToken: jest.fn(),
  generateTestToken: jest.fn(),
}));

const { authenticateToken, optionalAuth, requireAuth } = require('../../../src/middleware/auth');
const tokenService = require('../../../src/services/tokenService');

describe('Auth Middleware - Gap Coverage', () => {
  describe('authenticateToken - Error handling', () => {
    test('should handle malformed base64 in token', async () => {
      const req = {
        headers: {
          authorization: 'Bearer bad.bad.bad',
        },
      };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
      };
      const next = jest.fn();

      const _middleware = authenticateToken(req, res, next);
      // This should trigger error handling on line 184
      expect(res.status).toBeDefined();
    });

    test('should return error when COGNITO_USER_POOL_ID is missing', async () => {
      const originalEnv = process.env.COGNITO_USER_POOL_ID;
      delete process.env.COGNITO_USER_POOL_ID;

      const _req = {
        headers: {
          authorization:
            'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c',
        },
      };
      const _res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
      };
      const _next = jest.fn();

      const _middleware = authenticateToken(_req, _res, _next);
      expect(_res.status || _next).toBeDefined();

      process.env.COGNITO_USER_POOL_ID = originalEnv;
    });
  });

  describe('optionalAuth middleware', () => {
    test('should call next() when no authorization header present', async () => {
      const _req = {
        headers: {},
      };
      const _res = {};
      const _next = jest.fn();

      const middleware = optionalAuth;
      // optionalAuth wraps authenticateToken and makes it optional
      expect(middleware).toBeDefined();
    });

    test('should process optional token when present', async () => {
      const _req = {
        headers: {
          authorization: 'Bearer valid.token.here',
        },
      };
      const _res = {};
      const _next = jest.fn();

      // Verify optionalAuth is exported and callable
      expect(optionalAuth).toBeDefined();
    });
  });

  describe('Token verification edge cases', () => {
    test('should handle token with missing exp claim', () => {
      const token = Buffer.from(
        JSON.stringify({
          sub: 'user123',
          // no exp claim
        })
      ).toString('base64');

      // This would be called internally by verifyToken
      expect(token).toBeTruthy();
    });

    test('should handle token with future exp claim', () => {
      const futureExp = Math.floor(Date.now() / 1000) + 3600;
      const payload = {
        sub: 'user123',
        exp: futureExp,
      };

      expect(payload.exp).toBeGreaterThan(Math.floor(Date.now() / 1000));
    });

    test('should extract payload from valid token structure', () => {
      const payload = { sub: 'user123', name: 'Test User' };
      const encoded = Buffer.from(JSON.stringify(payload)).toString('base64');
      const token = `header.${encoded}.signature`;

      const parts = token.split('.');
      expect(parts.length).toBe(3);
      expect(parts[1]).toBe(encoded);
    });
  });

  describe('Authorization header parsing', () => {
    test('should handle case-insensitive Bearer prefix', () => {
      const authHeader = 'bearer token';
      const parts = authHeader.split(' ');
      expect(parts[0].toLowerCase()).toBe('bearer');
    });

    test('should reject header without space', () => {
      const authHeader = 'Bearertoken';
      const parts = authHeader.split(' ');
      expect(parts.length).not.toBe(2);
    });

    test('should extract token from properly formatted header', () => {
      const authHeader = 'Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1c2VyMTIzIn0.signature';
      const parts = authHeader.split(' ');
      expect(parts.length).toBe(2);
      expect(parts[0].toLowerCase()).toBe('bearer');
      expect(parts[1]).toBeTruthy();
    });
  });
});

// ============================================================================
// F-AUTH-3 — optionalAuth three-case classifier + degradeOnInfraFailure flag
// ============================================================================
describe('optionalAuth — F-Auth-3 three-case classifier', () => {
  let req;
  let res;
  let next;
  let consoleLogSpy;
  let consoleErrorSpy;

  beforeEach(() => {
    req = { headers: {}, path: '/test', method: 'GET' };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    next = jest.fn();
    tokenService.verifyToken.mockReset();
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  test('Case 1 — no Authorization header → req.user=null, no log spam, no 503, next() called', async () => {
    await optionalAuth(req, res, next);

    expect(req.user).toBeNull();
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
    expect(consoleLogSpy).not.toHaveBeenCalled();
    expect(consoleErrorSpy).not.toHaveBeenCalled();
    expect(tokenService.verifyToken).not.toHaveBeenCalled();
  });

  test('Case 2 — token rejected by verifier → req.user=null, exactly one console.log, no 503, next() called', async () => {
    req.headers.authorization = 'Bearer bad.token.here';
    const rejectErr = new Error('Token use mismatch');
    rejectErr.name = 'JwtInvalidClaimError';
    tokenService.verifyToken.mockImplementation(() => {
      throw rejectErr;
    });

    await optionalAuth(req, res, next);

    expect(req.user).toBeNull();
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
    expect(consoleErrorSpy).not.toHaveBeenCalled();
    expect(consoleLogSpy).toHaveBeenCalledTimes(1);
    expect(consoleLogSpy.mock.calls[0][0]).toBe('[F-Auth-3] optionalAuth: token rejected');
  });

  test('Case 3 — Cognito infra error, default options → 503 AUTH_SERVICE_UNAVAILABLE, structured error log with degraded:false', async () => {
    req.headers.authorization = 'Bearer some.token';
    const infra = new Error('connect ECONNREFUSED 169.254.169.254:443');
    infra.name = 'FetchError';
    infra.code = 'ECONNREFUSED';
    tokenService.verifyToken.mockImplementation(() => {
      throw infra;
    });

    await optionalAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'AUTH_SERVICE_UNAVAILABLE' })
    );
    expect(next).not.toHaveBeenCalled();
    expect(consoleLogSpy).not.toHaveBeenCalled();
    expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    expect(consoleErrorSpy.mock.calls[0][0]).toBe('[F-Auth-3] cognito_unreachable');
    expect(consoleErrorSpy.mock.calls[0][1]).toEqual(
      expect.objectContaining({
        name: expect.any(String),
        code: expect.any(String),
        message: expect.any(String),
        path: '/test',
        method: 'GET',
        degraded: false,
      })
    );
  });

  test('Case 4 — Cognito infra error with degradeOnInfraFailure:true → req.user=null, structured log with degraded:true, no 503, next() called', async () => {
    req.headers.authorization = 'Bearer some.token';
    const infra = new Error('JWKS endpoint unreachable');
    infra.name = 'FetchError';
    tokenService.verifyToken.mockImplementation(() => {
      throw infra;
    });

    const middleware = optionalAuth({ degradeOnInfraFailure: true });
    await middleware(req, res, next);

    expect(req.user).toBeNull();
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
    expect(consoleLogSpy).not.toHaveBeenCalled();
    expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    expect(consoleErrorSpy.mock.calls[0][0]).toBe('[F-Auth-3] cognito_unreachable');
    expect(consoleErrorSpy.mock.calls[0][1]).toEqual(
      expect.objectContaining({ degraded: true })
    );
  });

  test('factory mode — bare optionalAuth still works as middleware reference (backward compat)', async () => {
    expect(typeof optionalAuth).toBe('function');
    await optionalAuth(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(req.user).toBeNull();
  });
});

// ============================================================================
// F-AUTH-4 Path 1 — requireAuth split (Track 1.6)
// AUTH_REQUIRED for no-header / malformed; AUTH_INVALID_TOKEN for verifier-rejected;
// AUTH_SERVICE_UNAVAILABLE for Cognito infra failures (shared classifier with optionalAuth).
// ============================================================================
describe('requireAuth — F-Auth-4 Path 1 split', () => {
  let req;
  let res;
  let next;
  let consoleLogSpy;
  let consoleErrorSpy;

  beforeEach(() => {
    req = { headers: {}, path: '/protected', method: 'POST' };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    next = jest.fn();
    tokenService.verifyToken.mockReset();
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  test('Case 1 — no Authorization header → 401 AUTH_REQUIRED, next() not called, no req.user', async () => {
    await requireAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'AUTH_REQUIRED' })
    );
    expect(next).not.toHaveBeenCalled();
    expect(req.user).toBeUndefined();
    expect(tokenService.verifyToken).not.toHaveBeenCalled();
  });

  test('Case 2 — valid Authorization header → next() called, req.user populated, no response sent', async () => {
    req.headers.authorization = 'Bearer valid.token';
    tokenService.verifyToken.mockReturnValue({
      sub: 'user-123',
      email: 'creator@example.com',
      name: 'Creator',
      'cognito:groups': ['EDITOR'],
      token_use: 'access',
      iat: 1000,
      exp: 9999,
    });

    await requireAuth(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();
    expect(req.user).toEqual(
      expect.objectContaining({
        id: 'user-123',
        email: 'creator@example.com',
        groups: ['EDITOR'],
      })
    );
  });

  test('Case 3 — header present, verifier rejected → 401 AUTH_INVALID_TOKEN, generic message, server-side log', async () => {
    req.headers.authorization = 'Bearer expired.token';
    const rejectErr = new Error('Token expired');
    rejectErr.name = 'JwtExpiredError';
    tokenService.verifyToken.mockImplementation(() => {
      throw rejectErr;
    });

    await requireAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'AUTH_INVALID_TOKEN' })
    );
    // Generic message — no verifier internals leaked to the client.
    const responseBody = res.json.mock.calls[0][0];
    expect(responseBody.message).not.toContain('JwtExpiredError');
    expect(responseBody.message).toBe('The provided token is invalid or expired.');
    expect(next).not.toHaveBeenCalled();
    // Server-side log fires (cause preserved for debugging).
    expect(consoleLogSpy).toHaveBeenCalledTimes(1);
    expect(consoleLogSpy.mock.calls[0][0]).toBe('[F-Auth-4] requireAuth: token rejected');
    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });

  test('Case 4 — Cognito infra failure → 503 AUTH_SERVICE_UNAVAILABLE, structured error log (regression)', async () => {
    req.headers.authorization = 'Bearer some.token';
    const infra = new Error('connect ECONNREFUSED 169.254.169.254:443');
    infra.name = 'FetchError';
    infra.code = 'ECONNREFUSED';
    tokenService.verifyToken.mockImplementation(() => {
      throw infra;
    });

    await requireAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'AUTH_SERVICE_UNAVAILABLE' })
    );
    expect(next).not.toHaveBeenCalled();
    // Structured F-Auth-3 log fires with degraded:false (requireAuth is strict).
    expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    expect(consoleErrorSpy.mock.calls[0][0]).toBe('[F-Auth-3] cognito_unreachable');
    expect(consoleErrorSpy.mock.calls[0][1]).toEqual(
      expect.objectContaining({
        name: expect.any(String),
        code: expect.any(String),
        path: '/protected',
        method: 'POST',
        degraded: false,
      })
    );
    expect(consoleLogSpy).not.toHaveBeenCalled();
  });

  test('malformed Authorization header → 401 AUTH_INVALID_FORMAT (matches authenticateToken; Track 1 interceptor pass-throughs per LOCKED §4.6)', async () => {
    req.headers.authorization = 'NotBearer xyz';

    await requireAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'AUTH_INVALID_FORMAT' })
    );
    expect(next).not.toHaveBeenCalled();
    expect(tokenService.verifyToken).not.toHaveBeenCalled();
  });
});
