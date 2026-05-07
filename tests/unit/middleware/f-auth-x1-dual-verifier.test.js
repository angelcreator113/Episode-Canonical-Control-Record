/* eslint-disable global-require */
/**
 * F-AUTH-X1 Phase 2 — Dual-verifier routing tests
 *
 * Covers the JWT-`alg` discriminator added to src/middleware/auth.js#verifyToken:
 *   RS256 → Cognito (aws-jwt-verify, lazy verifiers)
 *   HS256 → tokenService (jsonwebtoken HS256, JWT_SECRET-backed)
 *
 * Also covers:
 *   - req.user.source propagation through requireAuth / authenticateToken / optionalAuth
 *   - AUTH_DEBUG-gated console.debug emission (path / verifier / alg / sub only)
 *   - F-AUTH-2 lazy-init regression (no boot crash; AUTH_CONFIG_MISSING still wrapped)
 *
 * Future Track 8 (Option A — single-verifier consolidation) deprecates this file.
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

// Mock both verifier dependencies so we can drive outcomes per test.
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
const {
  verifyToken,
  authenticateToken,
  optionalAuth,
  requireAuth,
} = require('../../../src/middleware/auth');

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

describe('F-AUTH-X1 — detectTokenAlgorithm + verifyToken routing', () => {
  beforeEach(() => {
    tokenService.verifyToken.mockReset();
    mockIdVerify.mockReset();
    mockAccessVerify.mockReset();
    delete process.env.AUTH_DEBUG;
  });

  test('RS256 token routes to Cognito (id-token verifier) and never touches tokenService', async () => {
    mockIdVerify.mockResolvedValue(sampleClaims());

    const result = await verifyToken(RS256_TOKEN);

    expect(mockIdVerify).toHaveBeenCalledTimes(1);
    expect(mockIdVerify).toHaveBeenCalledWith(RS256_TOKEN);
    expect(tokenService.verifyToken).not.toHaveBeenCalled();
    expect(result).toEqual({
      payload: expect.objectContaining({ sub: 'user-abc' }),
      source: 'cognito',
      alg: 'RS256',
    });
  });

  test('RS256 token falls back to access-token verifier when id-token verifier rejects', async () => {
    mockIdVerify.mockRejectedValue(new Error('Token use mismatch'));
    mockAccessVerify.mockResolvedValue(sampleClaims({ token_use: 'access' }));

    const result = await verifyToken(RS256_TOKEN);

    expect(mockIdVerify).toHaveBeenCalledTimes(1);
    expect(mockAccessVerify).toHaveBeenCalledTimes(1);
    expect(tokenService.verifyToken).not.toHaveBeenCalled();
    expect(result.source).toBe('cognito');
    expect(result.alg).toBe('RS256');
  });

  test('RS256 token: when both Cognito verifiers reject, the original id-token error wraps via Error.cause', async () => {
    const idErr = new Error('Original id-token rejection');
    idErr.name = 'JwtInvalidClaimError';
    mockIdVerify.mockRejectedValue(idErr);
    mockAccessVerify.mockRejectedValue(new Error('Different access-token rejection'));

    await expect(verifyToken(RS256_TOKEN)).rejects.toMatchObject({
      cause: { name: 'JwtInvalidClaimError', message: 'Original id-token rejection' },
    });
    expect(tokenService.verifyToken).not.toHaveBeenCalled();
  });

  test('HS256 token routes to tokenService and never touches Cognito', async () => {
    tokenService.verifyToken.mockReturnValue(sampleClaims({ sub: 'hs-user' }));

    const result = await verifyToken(HS256_TOKEN);

    expect(tokenService.verifyToken).toHaveBeenCalledTimes(1);
    expect(tokenService.verifyToken).toHaveBeenCalledWith(HS256_TOKEN);
    expect(mockIdVerify).not.toHaveBeenCalled();
    expect(mockAccessVerify).not.toHaveBeenCalled();
    expect(result).toEqual({
      payload: expect.objectContaining({ sub: 'hs-user' }),
      source: 'local-hs256',
      alg: 'HS256',
    });
  });

  test('HS256 token: rejection wraps via Error.cause (so F-Auth-3 classifier walks the chain)', async () => {
    const rejectErr = new Error('Token has expired');
    rejectErr.name = 'TokenExpiredError';
    tokenService.verifyToken.mockImplementation(() => {
      throw rejectErr;
    });

    await expect(verifyToken(HS256_TOKEN)).rejects.toMatchObject({
      cause: { name: 'TokenExpiredError', message: 'Token has expired' },
    });
  });

  test('Token with non-RS256/HS256 alg (e.g. ES256) treats alg as unknown and applies the routing fallback', async () => {
    const es256Token = buildToken('ES256');
    // Test env → fallback routes to tokenService.
    tokenService.verifyToken.mockReturnValue(sampleClaims());

    const result = await verifyToken(es256Token);

    expect(tokenService.verifyToken).toHaveBeenCalledTimes(1);
    expect(result.source).toBe('local-hs256');
    expect(mockIdVerify).not.toHaveBeenCalled();
  });

  test('Malformed token (single segment, no dot) routes via fallback (test env → tokenService)', async () => {
    tokenService.verifyToken.mockReturnValue(sampleClaims());

    const result = await verifyToken('not-a-jwt');

    expect(tokenService.verifyToken).toHaveBeenCalledTimes(1);
    expect(result.source).toBe('local-hs256');
  });

  test('Malformed token (header is not valid base64-JSON) routes via fallback (test env → tokenService)', async () => {
    tokenService.verifyToken.mockReturnValue(sampleClaims());
    // First segment is non-base64 garbage; JSON.parse fails inside detectTokenAlgorithm.
    const result = await verifyToken('!!!notbase64!!!.body.sig');

    expect(tokenService.verifyToken).toHaveBeenCalledTimes(1);
    expect(result.source).toBe('local-hs256');
  });

  test('Routing is alg-driven, not env-driven: an HS256 token in production env still routes to tokenService', async () => {
    const original = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      tokenService.verifyToken.mockReturnValue(sampleClaims());
      const result = await verifyToken(HS256_TOKEN);
      expect(tokenService.verifyToken).toHaveBeenCalledTimes(1);
      expect(mockIdVerify).not.toHaveBeenCalled();
      expect(result.source).toBe('local-hs256');
    } finally {
      process.env.NODE_ENV = original;
    }
  });

  test('Routing is alg-driven, not env-driven: an RS256 token in test env still routes to Cognito', async () => {
    mockIdVerify.mockResolvedValue(sampleClaims());

    const result = await verifyToken(RS256_TOKEN);

    expect(mockIdVerify).toHaveBeenCalledTimes(1);
    expect(tokenService.verifyToken).not.toHaveBeenCalled();
    expect(result.source).toBe('cognito');
  });
});

describe('F-AUTH-X1 — req.user.source propagation through middleware callers', () => {
  let req;
  let res;
  let next;

  beforeEach(() => {
    req = { headers: {}, path: '/test', method: 'GET' };
    res = { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() };
    next = jest.fn();
    tokenService.verifyToken.mockReset();
    mockIdVerify.mockReset();
    mockAccessVerify.mockReset();
    delete process.env.AUTH_DEBUG;
  });

  test('requireAuth: RS256 token populates req.user.source = "cognito"', async () => {
    req.headers.authorization = `Bearer ${RS256_TOKEN}`;
    mockIdVerify.mockResolvedValue(sampleClaims({ sub: 'cognito-user' }));

    await requireAuth(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(req.user).toEqual(expect.objectContaining({
      id: 'cognito-user',
      source: 'cognito',
    }));
  });

  test('requireAuth: HS256 token populates req.user.source = "local-hs256"', async () => {
    req.headers.authorization = `Bearer ${HS256_TOKEN}`;
    tokenService.verifyToken.mockReturnValue(sampleClaims({ sub: 'local-user' }));

    await requireAuth(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(req.user).toEqual(expect.objectContaining({
      id: 'local-user',
      source: 'local-hs256',
    }));
  });

  test('authenticateToken: HS256 token populates req.user.source = "local-hs256"', async () => {
    req.headers.authorization = `Bearer ${HS256_TOKEN}`;
    tokenService.verifyToken.mockReturnValue(sampleClaims({ sub: 'local-user' }));

    await authenticateToken(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(req.user).toEqual(expect.objectContaining({
      id: 'local-user',
      source: 'local-hs256',
    }));
  });

  test('optionalAuth: RS256 token populates req.user.source = "cognito"', async () => {
    req.headers.authorization = `Bearer ${RS256_TOKEN}`;
    mockIdVerify.mockResolvedValue(sampleClaims({ sub: 'cognito-user' }));

    await optionalAuth(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(req.user).toEqual(expect.objectContaining({
      id: 'cognito-user',
      source: 'cognito',
    }));
  });

  test('optionalAuth: no Authorization header → req.user = null (source field absent, not "anonymous")', async () => {
    await optionalAuth(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(req.user).toBeNull();
  });
});

describe('F-AUTH-X1 — AUTH_DEBUG console.debug gating', () => {
  let req;
  let res;
  let next;
  let debugSpy;

  beforeEach(() => {
    req = { headers: {}, path: '/protected/resource', method: 'GET' };
    res = { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() };
    next = jest.fn();
    tokenService.verifyToken.mockReset();
    mockIdVerify.mockReset();
    debugSpy = jest.spyOn(console, 'debug').mockImplementation(() => {});
  });

  afterEach(() => {
    debugSpy.mockRestore();
    delete process.env.AUTH_DEBUG;
  });

  test('AUTH_DEBUG=true: console.debug fires once with path/verifier/alg/sub on success', async () => {
    process.env.AUTH_DEBUG = 'true';
    req.headers.authorization = `Bearer ${HS256_TOKEN}`;
    tokenService.verifyToken.mockReturnValue(sampleClaims({ sub: 'debug-user' }));

    await requireAuth(req, res, next);

    expect(debugSpy).toHaveBeenCalledTimes(1);
    expect(debugSpy.mock.calls[0][0]).toBe('[F-AUTH-X1] verified');
    expect(debugSpy.mock.calls[0][1]).toEqual({
      path: '/protected/resource',
      verifier: 'local-hs256',
      alg: 'HS256',
      sub: 'debug-user',
    });
  });

  test('AUTH_DEBUG unset: no console.debug emitted on successful verification', async () => {
    req.headers.authorization = `Bearer ${HS256_TOKEN}`;
    tokenService.verifyToken.mockReturnValue(sampleClaims());

    await requireAuth(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(debugSpy).not.toHaveBeenCalled();
  });

  test('AUTH_DEBUG=true: log payload contains ONLY path/verifier/alg/sub — never the token, the Authorization header, or full claims', async () => {
    process.env.AUTH_DEBUG = 'true';
    req.headers.authorization = `Bearer ${HS256_TOKEN}`;
    const fullClaims = sampleClaims({
      sub: 'safe-user',
      email: 'private@example.com',
      'cognito:groups': ['ADMIN'],
    });
    tokenService.verifyToken.mockReturnValue(fullClaims);

    await requireAuth(req, res, next);

    expect(debugSpy).toHaveBeenCalledTimes(1);
    const logBody = debugSpy.mock.calls[0][1];
    expect(Object.keys(logBody).sort()).toEqual(['alg', 'path', 'sub', 'verifier']);
    // Defensive: even if shape changes, assert no leakage of sensitive fields.
    const serialized = JSON.stringify(logBody);
    expect(serialized).not.toContain(HS256_TOKEN);
    expect(serialized).not.toContain('private@example.com');
    expect(serialized).not.toContain('Bearer ');
  });

  test('AUTH_DEBUG=true: failed verification emits NO debug log (success-only signal)', async () => {
    process.env.AUTH_DEBUG = 'true';
    req.headers.authorization = `Bearer ${HS256_TOKEN}`;
    tokenService.verifyToken.mockImplementation(() => {
      throw new Error('Token expired');
    });

    await requireAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(debugSpy).not.toHaveBeenCalled();
  });
});

describe('F-AUTH-X1 — F-AUTH-2 lazy-init regression', () => {
  test('Module-load with no Cognito env vars still does not throw (lazy-init preserved)', () => {
    const original = {
      pool: process.env.COGNITO_USER_POOL_ID,
      client: process.env.COGNITO_CLIENT_ID,
    };
    delete process.env.COGNITO_USER_POOL_ID;
    delete process.env.COGNITO_CLIENT_ID;
    jest.resetModules();
    expect(() => require('../../../src/middleware/auth')).not.toThrow();
    if (original.pool !== undefined) process.env.COGNITO_USER_POOL_ID = original.pool;
    if (original.client !== undefined) process.env.COGNITO_CLIENT_ID = original.client;
  });

  test('AUTH_CONFIG_MISSING still propagates via Error.cause for RS256-routed tokens when env vars absent', async () => {
    const original = {
      pool: process.env.COGNITO_USER_POOL_ID,
      client: process.env.COGNITO_CLIENT_ID,
    };
    delete process.env.COGNITO_USER_POOL_ID;
    delete process.env.COGNITO_CLIENT_ID;
    jest.resetModules();
    // NB: jest.mock('aws-jwt-verify', ...) at the top of THIS file mocks it for THIS module
    // graph; after resetModules the mock factory re-applies but the lazy verifier getters
    // hit getCognitoConfig() FIRST and throw AUTH_CONFIG_MISSING before reaching the mock.
    const freshAuth = require('../../../src/middleware/auth');
    await expect(freshAuth.verifyToken(RS256_TOKEN)).rejects.toMatchObject({
      cause: { code: 'AUTH_CONFIG_MISSING' },
    });
    if (original.pool !== undefined) process.env.COGNITO_USER_POOL_ID = original.pool;
    if (original.client !== undefined) process.env.COGNITO_CLIENT_ID = original.client;
    jest.resetModules();
  });
});
