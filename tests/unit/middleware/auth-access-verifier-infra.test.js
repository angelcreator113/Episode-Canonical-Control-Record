/**
 * A deploy signed Evoni out (2026-10-23). The app signs in with Cognito
 * access tokens, so the id-token verifier fails on token_use for nearly every
 * request and the access-token verifier decides. Each verifier fetches its
 * own JWKS, cold after a restart. When the access verifier could not reach
 * Cognito, requireAuth used to report the id verifier's "wrong token_use"
 * error: a good token got 401 AUTH_INVALID_TOKEN (refresh, retry, sign out)
 * instead of 503 AUTH_SERVICE_UNAVAILABLE.
 */

const ORIGINAL_COGNITO_CLIENT_ID = process.env.COGNITO_CLIENT_ID;
process.env.COGNITO_CLIENT_ID = process.env.COGNITO_CLIENT_ID || 'test-client-id';
afterAll(() => {
  if (ORIGINAL_COGNITO_CLIENT_ID === undefined) delete process.env.COGNITO_CLIENT_ID;
  else process.env.COGNITO_CLIENT_ID = ORIGINAL_COGNITO_CLIENT_ID;
});

const mockIdVerify = jest.fn();
const mockAccessVerify = jest.fn();
jest.mock('aws-jwt-verify', () => ({
  CognitoJwtVerifier: {
    create: jest.fn((opts) => ({
      verify: opts.tokenUse === 'id' ? mockIdVerify : mockAccessVerify,
    })),
  },
}));

const { requireAuth, verifyToken } = require('../../../src/middleware/auth');

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
const ACCESS_TOKEN = `${b64({ alg: 'RS256', kid: 'k1' })}.${b64({ sub: 's', token_use: 'access' })}.sig`;

const tokenUseError = () => {
  const e = new Error('Token use not allowed: access. Expected: id');
  e.name = 'CognitoJwtInvalidTokenUseError';
  return e;
};
const fetchError = () => {
  const e = new Error('Response time-out (after 3000 ms.)');
  e.name = 'FetchError';
  return e;
};

const run = async () => {
  const req = { headers: { authorization: `Bearer ${ACCESS_TOKEN}` }, path: '/x', method: 'GET' };
  const res = { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() };
  const next = jest.fn();
  await requireAuth(req, res, next);
  return { res, next };
};

describe('access-token verifier infra failures', () => {
  let log;
  let err;
  beforeEach(() => {
    mockIdVerify.mockReset();
    mockAccessVerify.mockReset();
    log = jest.spyOn(console, 'log').mockImplementation(() => {});
    err = jest.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => { log.mockRestore(); err.mockRestore(); });

  test('the access verifier cannot fetch its JWKS: 503, not 401', async () => {
    mockIdVerify.mockRejectedValue(tokenUseError());
    mockAccessVerify.mockRejectedValue(fetchError());
    const { res, next } = await run();
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'AUTH_SERVICE_UNAVAILABLE' }));
  });

  test('a network code on the access verifier is also infra', async () => {
    mockIdVerify.mockRejectedValue(tokenUseError());
    const e = new Error('connect ETIMEDOUT');
    e.code = 'ETIMEDOUT';
    mockAccessVerify.mockRejectedValue(e);
    await expect(verifyToken(ACCESS_TOKEN)).rejects.toMatchObject({ cause: { code: 'ETIMEDOUT' } });
  });

  test('a genuinely expired access token is still 401 AUTH_INVALID_TOKEN', async () => {
    const expired = new Error('Token expired');
    expired.name = 'JwtExpiredError';
    mockIdVerify.mockRejectedValue(expired);
    mockAccessVerify.mockRejectedValue(expired);
    const { res } = await run();
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'AUTH_INVALID_TOKEN' }));
  });

  test('the id verifier\'s own infra failure still wins (unchanged)', async () => {
    mockIdVerify.mockRejectedValue(fetchError());
    mockAccessVerify.mockRejectedValue(tokenUseError());
    const { res } = await run();
    expect(res.status).toHaveBeenCalledWith(503);
  });
});
