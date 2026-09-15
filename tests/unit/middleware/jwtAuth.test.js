/**
 * JWT Authentication Middleware Tests
 *
 * Task #1451 — jwtAuth.js no longer calls TokenService.verifyToken directly.
 * authenticateJWT / optionalJWTAuth now delegate to auth.js's dual-verifier
 * verifyToken (F-AUTH-X1), so a single route accepts both HS256 (local) and
 * RS256 (Cognito) tokens. req.user is now built identically to auth.js's
 * shape: no `role`, no `tokenType` — instead `tokenUse`, `issuedAt`,
 * `expiresAt` (raw numeric claims), `source`, and `raw`.
 */

// Cognito env vars must be present BEFORE any auth.js require, otherwise the
// lazy getter throws AUTH_CONFIG_MISSING before reaching the mocked verifier.
// (tests/setup.js sets COGNITO_USER_POOL_ID but NOT COGNITO_CLIENT_ID.)
const ORIGINAL_COGNITO_CLIENT_ID = process.env.COGNITO_CLIENT_ID;
process.env.COGNITO_CLIENT_ID = process.env.COGNITO_CLIENT_ID || 'test-client-id';

afterAll(() => {
  if (ORIGINAL_COGNITO_CLIENT_ID === undefined) delete process.env.COGNITO_CLIENT_ID;
  else process.env.COGNITO_CLIENT_ID = ORIGINAL_COGNITO_CLIENT_ID;
});

jest.mock('../../../src/services/tokenService', () => ({
  verifyToken: jest.fn(),
  generateToken: jest.fn(),
  generateTokenPair: jest.fn(),
  refreshAccessToken: jest.fn(),
  revokeToken: jest.fn(),
  generateTestToken: jest.fn(),
}));

const mockIdVerify = jest.fn();
const mockAccessVerify = jest.fn();
jest.mock('aws-jwt-verify', () => ({
  CognitoJwtVerifier: {
    create: jest.fn((opts) => ({
      verify: opts.tokenUse === 'id' ? mockIdVerify : mockAccessVerify,
    })),
  },
}));

const tokenService = require('../../../src/services/tokenService');
const { authenticateJWT, optionalJWTAuth, requireGroup } = require('../../../src/middleware/jwtAuth');

// Synthesize a minimally-valid JWT-shaped token whose header carries the given alg.
// Body and signature are arbitrary — verification is mocked downstream.
const buildToken = (alg) => {
  const header = Buffer.from(JSON.stringify({ alg, typ: 'JWT', kid: 'test-kid' }))
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
  const body = Buffer.from(JSON.stringify({ sub: 'subject-stub' }))
    .toString('base64')
    .replace(/=/g, '');
  return `${header}.${body}.signature`;
};

const RS256_TOKEN = buildToken('RS256');
const HS256_TOKEN = buildToken('HS256');

const sampleClaims = (overrides = {}) => ({
  sub: 'user-abc',
  email: 'user@example.com',
  name: 'Test User',
  'cognito:groups': ['EDITOR'],
  token_use: 'id',
  iat: 1000,
  exp: 9999,
  ...overrides,
});

describe('JWT Authentication Middleware (delegates to auth.js#verifyToken)', () => {
  let mockReq, mockRes, mockNext;

  beforeEach(() => {
    mockReq = {
      headers: {},
      user: null,
    };

    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };

    mockNext = jest.fn();
    tokenService.verifyToken.mockReset();
    mockIdVerify.mockReset();
    mockAccessVerify.mockReset();
  });

  describe('authenticateJWT()', () => {
    test('should return 401 if no authorization header', async () => {
      mockReq.headers.authorization = undefined;

      await authenticateJWT(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'AUTH_MISSING_TOKEN',
        })
      );
    });

    test('should return 401 if authorization header missing Bearer prefix', async () => {
      mockReq.headers.authorization = 'token-without-bearer';

      await authenticateJWT(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'AUTH_INVALID_FORMAT',
        })
      );
    });

    test('HS256 token reaches the route: calls next() and never touches Cognito', async () => {
      mockReq.headers.authorization = `Bearer ${HS256_TOKEN}`;
      tokenService.verifyToken.mockReturnValue(sampleClaims({ sub: 'hs-user' }));

      await authenticateJWT(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
      expect(mockIdVerify).not.toHaveBeenCalled();
      expect(mockAccessVerify).not.toHaveBeenCalled();
      expect(mockReq.user).toEqual(
        expect.objectContaining({ id: 'hs-user', source: 'local-hs256' })
      );
    });

    test('RS256-shaped token reaches the route via the mocked Cognito verifier (no live pool)', async () => {
      mockReq.headers.authorization = `Bearer ${RS256_TOKEN}`;
      mockIdVerify.mockResolvedValue(sampleClaims({ sub: 'cognito-user' }));

      await authenticateJWT(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
      expect(tokenService.verifyToken).not.toHaveBeenCalled();
      expect(mockReq.user).toEqual(
        expect.objectContaining({ id: 'cognito-user', source: 'cognito' })
      );
    });

    test('attaches user info built the same way as auth.js: no role, no tokenType', async () => {
      mockReq.headers.authorization = `Bearer ${HS256_TOKEN}`;
      tokenService.verifyToken.mockReturnValue(
        sampleClaims({ sub: 'user-id-123', email: 'test@example.com', name: 'Test User' })
      );

      await authenticateJWT(mockReq, mockRes, mockNext);

      expect(mockReq.user).toBeDefined();
      expect(mockReq.user.id).toBe('user-id-123');
      expect(mockReq.user.email).toBe('test@example.com');
      expect(mockReq.user).not.toHaveProperty('role');
      expect(mockReq.user).not.toHaveProperty('tokenType');
    });

    test('groups fall back to `cognito:groups` then decoded.groups, matching auth.js', async () => {
      mockReq.headers.authorization = `Bearer ${HS256_TOKEN}`;
      tokenService.verifyToken.mockReturnValue({
        sub: 'user123',
        groups: ['plain-groups-claim'],
        exp: 9999,
      });

      await authenticateJWT(mockReq, mockRes, mockNext);

      expect(mockReq.user.groups).toEqual(['plain-groups-claim']);
    });

    test('handles token without any groups field', async () => {
      mockReq.headers.authorization = `Bearer ${HS256_TOKEN}`;
      tokenService.verifyToken.mockReturnValue({
        sub: 'user123',
        email: 'user@example.com',
        exp: 9999,
      });

      await authenticateJWT(mockReq, mockRes, mockNext);

      expect(mockReq.user.groups).toEqual([]);
      expect(mockNext).toHaveBeenCalled();
    });

    test('should return 401 if token verification fails', async () => {
      mockReq.headers.authorization = `Bearer ${HS256_TOKEN}`;

      tokenService.verifyToken.mockImplementation(() => {
        throw new Error('Invalid token signature');
      });

      await authenticateJWT(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'AUTH_INVALID_TOKEN',
        })
      );
      expect(mockNext).not.toHaveBeenCalled();
    });

    test('should handle case-insensitive Bearer keyword', async () => {
      mockReq.headers.authorization = 'bearer lowercase';

      tokenService.verifyToken.mockImplementation(() => {
        throw new Error('Token error');
      });

      await authenticateJWT(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
    });

    test('sets issuedAt/expiresAt from raw numeric claims (not a Date object) like auth.js', async () => {
      mockReq.headers.authorization = `Bearer ${HS256_TOKEN}`;

      tokenService.verifyToken.mockReturnValue(sampleClaims({ iat: 1000, exp: 9999 }));

      await authenticateJWT(mockReq, mockRes, mockNext);

      expect(mockReq.user.issuedAt).toBe(1000);
      expect(mockReq.user.expiresAt).toBe(9999);
    });
  });

  describe('optionalJWTAuth()', () => {
    test('no authorization header: req.user = null, still calls next()', async () => {
      mockReq.headers.authorization = undefined;

      await optionalJWTAuth(mockReq, mockRes, mockNext);

      expect(mockReq.user).toBeNull();
      expect(mockNext).toHaveBeenCalled();
    });

    test('HS256 token reaches the route via the same delegated verifier', async () => {
      mockReq.headers.authorization = `Bearer ${HS256_TOKEN}`;
      tokenService.verifyToken.mockReturnValue(sampleClaims({ sub: 'hs-user' }));

      await optionalJWTAuth(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockReq.user).toEqual(
        expect.objectContaining({ id: 'hs-user', source: 'local-hs256' })
      );
    });

    test('RS256-shaped token reaches the route via the mocked Cognito verifier', async () => {
      mockReq.headers.authorization = `Bearer ${RS256_TOKEN}`;
      mockIdVerify.mockResolvedValue(sampleClaims({ sub: 'cognito-user' }));

      await optionalJWTAuth(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockReq.user).toEqual(
        expect.objectContaining({ id: 'cognito-user', source: 'cognito' })
      );
    });

    test('invalid token: req.user = null, still calls next()', async () => {
      mockReq.headers.authorization = `Bearer ${HS256_TOKEN}`;
      tokenService.verifyToken.mockImplementation(() => {
        throw new Error('Token expired');
      });

      await optionalJWTAuth(mockReq, mockRes, mockNext);

      expect(mockReq.user).toBeNull();
      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('requireGroup() passes for a token whose groups contain ADMIN, under both token shapes', () => {
    test('HS256 token with ADMIN in groups passes requireGroup("ADMIN")', async () => {
      mockReq.headers.authorization = `Bearer ${HS256_TOKEN}`;
      tokenService.verifyToken.mockReturnValue(
        sampleClaims({ sub: 'hs-admin', 'cognito:groups': ['ADMIN'] })
      );

      await authenticateJWT(mockReq, mockRes, mockNext);
      expect(mockNext).toHaveBeenCalledTimes(1);

      const gateNext = jest.fn();
      requireGroup('ADMIN')(mockReq, mockRes, gateNext);

      expect(gateNext).toHaveBeenCalledTimes(1);
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    test('RS256-shaped token with ADMIN in groups passes requireGroup("ADMIN")', async () => {
      mockReq.headers.authorization = `Bearer ${RS256_TOKEN}`;
      mockIdVerify.mockResolvedValue(
        sampleClaims({ sub: 'cognito-admin', 'cognito:groups': ['ADMIN'] })
      );

      await authenticateJWT(mockReq, mockRes, mockNext);
      expect(mockNext).toHaveBeenCalledTimes(1);

      const gateNext = jest.fn();
      requireGroup('ADMIN')(mockReq, mockRes, gateNext);

      expect(gateNext).toHaveBeenCalledTimes(1);
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    test('a token without ADMIN in groups is rejected by requireGroup("ADMIN")', async () => {
      mockReq.headers.authorization = `Bearer ${HS256_TOKEN}`;
      tokenService.verifyToken.mockReturnValue(
        sampleClaims({ sub: 'hs-user', 'cognito:groups': ['EDITOR'] })
      );

      await authenticateJWT(mockReq, mockRes, mockNext);

      const gateNext = jest.fn();
      requireGroup('ADMIN')(mockReq, mockRes, gateNext);

      expect(gateNext).not.toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(403);
    });
  });

  describe('Error handling', () => {
    test('should handle null authorization header', async () => {
      mockReq.headers.authorization = null;

      await authenticateJWT(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
    });

    test('should handle empty authorization header', async () => {
      mockReq.headers.authorization = '';

      await authenticateJWT(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
    });

    test('should handle authorization header with multiple spaces between Bearer and token', async () => {
      mockReq.headers.authorization = 'Bearer   token';

      // This should fail because split(' ') will create more than 2 parts
      await authenticateJWT(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
    });

    test('should not call next() on authentication failure', async () => {
      mockReq.headers.authorization = `Bearer ${HS256_TOKEN}`;
      tokenService.verifyToken.mockImplementation(() => {
        throw new Error('Token expired');
      });

      await authenticateJWT(mockReq, mockRes, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('Response structure', () => {
    test('should return proper error response structure', async () => {
      mockReq.headers.authorization = 'invalid-header';

      await authenticateJWT(mockReq, mockRes, mockNext);

      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.any(String),
          message: expect.any(String),
          code: expect.any(String),
        })
      );
    });

    test('should not send response body when calling next()', async () => {
      mockReq.headers.authorization = `Bearer ${HS256_TOKEN}`;
      tokenService.verifyToken.mockReturnValue(sampleClaims());

      await authenticateJWT(mockReq, mockRes, mockNext);

      expect(mockRes.json).not.toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });
  });
});
