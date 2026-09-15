/**
 * POST /login response contract — Task #1456
 *
 * Exercises the route's success contract and Cognito exception → status/code
 * mapping by mocking cognitoPasswordAuthService (itself unit-tested against
 * a mocked SDK boundary in cognitoPasswordAuthService.test.js). No Cognito,
 * AWS, or host contact is made by this file.
 */

const express = require('express');
const request = require('supertest');

jest.mock('../../../src/services/cognitoPasswordAuthService', () => ({
  initiatePasswordAuth: jest.fn(),
}));

jest.mock('../../../src/services/tokenService', () => ({
  generateTokenPair: jest.fn(),
  refreshAccessToken: jest.fn(),
  revokeToken: jest.fn(),
  verifyToken: jest.fn(),
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

describe('POST /login', () => {
  let app;

  beforeEach(() => {
    jest.clearAllMocks();
    app = buildApp();
  });

  test('successful exchange returns exactly the pinned fields and mints no HS256 token', async () => {
    cognitoPasswordAuthService.initiatePasswordAuth.mockResolvedValue({
      accessToken: 'access-token-value',
      refreshToken: 'refresh-token-value',
      expiresIn: 3600,
      tokenType: 'Bearer',
      user: { id: 'u1', email: 'user@example.com', name: 'Test User', groups: ['EDITOR'] },
    });

    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'user@example.com', password: 'correct-password' });

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({
      accessToken: 'access-token-value',
      refreshToken: 'refresh-token-value',
      expiresIn: 3600,
      tokenType: 'Bearer',
      user: { id: 'u1', email: 'user@example.com', name: 'Test User', groups: ['EDITOR'] },
    });
    expect(Object.keys(res.body.data).sort()).toEqual(
      ['accessToken', 'expiresIn', 'refreshToken', 'tokenType', 'user'].sort()
    );
    expect(TokenService.generateTokenPair).not.toHaveBeenCalled();
  });

  test.each([
    ['NotAuthorizedException', 401, 'AUTH_INVALID_CREDENTIALS'],
    ['UserNotFoundException', 401, 'AUTH_INVALID_CREDENTIALS'],
    ['UserNotConfirmedException', 403, 'AUTH_USER_NOT_CONFIRMED'],
    ['PasswordResetRequiredException', 403, 'AUTH_PASSWORD_RESET_REQUIRED'],
    ['TooManyRequestsException', 429, 'AUTH_TOO_MANY_REQUESTS'],
    ['LimitExceededException', 429, 'AUTH_TOO_MANY_REQUESTS'],
  ])('%s maps to %i / %s', async (exceptionName, expectedStatus, expectedCode) => {
    const err = new Error('Cognito says no');
    err.name = exceptionName;
    cognitoPasswordAuthService.initiatePasswordAuth.mockRejectedValue(err);

    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'user@example.com', password: 'whatever1' });

    expect(res.status).toBe(expectedStatus);
    expect(res.body.code).toBe(expectedCode);
  });

  test('an unmapped exception maps to 500 without leaking the raw Cognito error', async () => {
    const err = new Error('Some internal Cognito detail: pool arn, account id, etc');
    err.name = 'InternalErrorException';
    cognitoPasswordAuthService.initiatePasswordAuth.mockRejectedValue(err);

    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'user@example.com', password: 'whatever1' });

    expect(res.status).toBe(500);
    expect(res.body.code).toBe('AUTH_LOGIN_ERROR');
    expect(JSON.stringify(res.body)).not.toContain('pool arn');
  });

  test('UserNotFoundException and NotAuthorizedException produce identical response bodies', async () => {
    const notFound = new Error('no such user');
    notFound.name = 'UserNotFoundException';
    cognitoPasswordAuthService.initiatePasswordAuth.mockRejectedValueOnce(notFound);
    const notFoundRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'nobody@example.com', password: 'whatever1' });

    const notAuthorized = new Error('wrong password');
    notAuthorized.name = 'NotAuthorizedException';
    cognitoPasswordAuthService.initiatePasswordAuth.mockRejectedValueOnce(notAuthorized);
    const notAuthorizedRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'nobody@example.com', password: 'wrong-password' });

    expect(notFoundRes.status).toBe(notAuthorizedRes.status);
    expect(notFoundRes.body).toEqual(notAuthorizedRes.body);
  });

  test('validateLoginRequest still rejects malformed requests before Cognito is contacted', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'not-an-email', password: 'whatever1' });

    expect(res.status).toBe(400);
    expect(cognitoPasswordAuthService.initiatePasswordAuth).not.toHaveBeenCalled();
  });
});
