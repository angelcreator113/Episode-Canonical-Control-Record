/**
 * POST /refresh response contract — Task #1563 (F-AUTH-1 v2.77 §8(a))
 *
 * Exercises the route's success contract and Cognito exception -> status/code
 * mapping by mocking cognitoPasswordAuthService (itself unit-tested against a
 * mocked SDK boundary in cognitoPasswordAuthService.test.js). No Cognito,
 * AWS, or host contact is made by this file.
 */

const express = require('express');
const request = require('supertest');

jest.mock('../../../src/services/cognitoPasswordAuthService', () => ({
  initiatePasswordAuth: jest.fn(),
  refreshWithCognito: jest.fn(),
}));

const cognitoPasswordAuthService = require('../../../src/services/cognitoPasswordAuthService');
const TokenService = require('../../../src/services/tokenService');
const authRoutes = require('../../../src/routes/auth');

const buildApp = () => {
  const app = express();
  app.use(express.json());
  app.use('/api/v1/auth', authRoutes);
  return app;
};

// >= 50 chars, so it clears validateRefreshRequest's length check and
// reaches the handler regardless of shape — same as a real Cognito refresh
// token would.
const VALID_REFRESH_TOKEN = 'a-cognito-refresh-token-that-is-long-enough-to-pass-validation';

describe('POST /refresh', () => {
  let app;

  beforeEach(() => {
    jest.clearAllMocks();
    app = buildApp();
  });

  test('successful exchange returns exactly the pinned key set, never idToken or refreshToken', async () => {
    cognitoPasswordAuthService.refreshWithCognito.mockResolvedValue({
      accessToken: 'new-access-token',
      expiresIn: 3600,
      tokenType: 'Bearer',
    });

    const res = await request(app)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: VALID_REFRESH_TOKEN });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toEqual({
      accessToken: 'new-access-token',
      expiresIn: 3600,
      tokenType: 'Bearer',
    });
    expect(Object.keys(res.body.data).sort()).toEqual(['accessToken', 'expiresIn', 'tokenType'].sort());
    expect(res.body.data).not.toHaveProperty('idToken');
    expect(res.body.data).not.toHaveProperty('refreshToken');
    expect(cognitoPasswordAuthService.refreshWithCognito).toHaveBeenCalledWith(VALID_REFRESH_TOKEN);
  });

  test('never calls TokenService.refreshAccessToken — no alg branching', async () => {
    cognitoPasswordAuthService.refreshWithCognito.mockResolvedValue({
      accessToken: 'a',
      expiresIn: 60,
      tokenType: 'Bearer',
    });
    const spy = jest.spyOn(TokenService, 'refreshAccessToken');

    await request(app).post('/api/v1/auth/refresh').send({ refreshToken: VALID_REFRESH_TOKEN });

    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  test.each([
    ['NotAuthorizedException', 401, 'AUTH_REFRESH_FAILED'],
    ['TooManyRequestsException', 429, 'AUTH_REFRESH_RATE_LIMITED'],
  ])('%s maps to %i / %s without leaking provider text', async (exceptionName, expectedStatus, expectedCode) => {
    const err = new Error('some detailed Cognito provider explanation, pool arn, account id, etc');
    err.name = exceptionName;
    cognitoPasswordAuthService.refreshWithCognito.mockRejectedValue(err);

    const res = await request(app)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: VALID_REFRESH_TOKEN });

    expect(res.status).toBe(expectedStatus);
    expect(res.body.code).toBe(expectedCode);
    expect(JSON.stringify(res.body)).not.toContain('pool arn');
  });

  test('network/SDK-unreachable error maps to 503 AUTH_SERVICE_UNAVAILABLE without leaking provider text', async () => {
    const err = new Error('connect ECONNREFUSED 127.0.0.1:443');
    err.code = 'ECONNREFUSED';
    cognitoPasswordAuthService.refreshWithCognito.mockRejectedValue(err);

    const res = await request(app)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: VALID_REFRESH_TOKEN });

    expect(res.status).toBe(503);
    expect(res.body.code).toBe('AUTH_SERVICE_UNAVAILABLE');
    expect(JSON.stringify(res.body)).not.toContain('ECONNREFUSED');
  });

  test('config-missing error (secret configured, SECRET_HASH unavailable) maps to 500 AUTH_CONFIG_MISSING without leaking provider text', async () => {
    const err = new Error('Cognito refresh requires a per-user SECRET_HASH, which this endpoint cannot compute');
    err.code = 'AUTH_CONFIG_MISSING';
    cognitoPasswordAuthService.refreshWithCognito.mockRejectedValue(err);

    const res = await request(app)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: VALID_REFRESH_TOKEN });

    expect(res.status).toBe(500);
    expect(res.body.code).toBe('AUTH_CONFIG_MISSING');
    expect(JSON.stringify(res.body)).not.toContain('SECRET_HASH');
  });

  test('an unmapped exception falls back to 401 AUTH_REFRESH_FAILED without leaking provider text', async () => {
    const err = new Error('Some internal Cognito detail: pool arn, account id, etc');
    err.name = 'InternalErrorException';
    cognitoPasswordAuthService.refreshWithCognito.mockRejectedValue(err);

    const res = await request(app)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: VALID_REFRESH_TOKEN });

    expect(res.status).toBe(401);
    expect(res.body.code).toBe('AUTH_REFRESH_FAILED');
    expect(JSON.stringify(res.body)).not.toContain('pool arn');
  });

  test('a local HS256 refresh token now gets 401 AUTH_REFRESH_FAILED — passed to Cognito like any other string, not special-cased by alg', async () => {
    const user = { id: 'u1', email: 'user@example.com', name: 'Test User', groups: ['USER'], role: 'USER' };
    const { refreshToken: hs256RefreshToken } = TokenService.generateTokenPair(user);

    // Cognito rejects an arbitrary non-Cognito string the same way it
    // rejects any other unrecognized refresh token.
    const err = new Error('Invalid Refresh Token');
    err.name = 'NotAuthorizedException';
    cognitoPasswordAuthService.refreshWithCognito.mockRejectedValue(err);

    const res = await request(app)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: hs256RefreshToken });

    expect(res.status).toBe(401);
    expect(res.body.code).toBe('AUTH_REFRESH_FAILED');
    expect(cognitoPasswordAuthService.refreshWithCognito).toHaveBeenCalledWith(hs256RefreshToken);
  });

  test('missing refresh token still returns 400 before Cognito is contacted', async () => {
    const res = await request(app).post('/api/v1/auth/refresh').send({});

    expect(res.status).toBe(400);
    expect(cognitoPasswordAuthService.refreshWithCognito).not.toHaveBeenCalled();
  });
});
