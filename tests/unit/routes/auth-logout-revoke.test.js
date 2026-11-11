/**
 * POST /logout revokes the Cognito refresh token — Task #3797
 * (docs/audit/F-AUTH-1_LogoutRevocation_Ruling_2026-11-11.md, option (b)).
 *
 * The Cognito service is mocked (it is unit-tested against a mocked SDK in
 * cognitoRevokeRefreshToken.test.js), and so is the access-token check, which
 * has its own tests. No Cognito, AWS or host contact is made by this file.
 */

const express = require('express');
const request = require('supertest');

jest.mock('../../../src/services/cognitoPasswordAuthService', () => ({
  initiatePasswordAuth: jest.fn(),
  refreshWithCognito: jest.fn(),
  revokeRefreshToken: jest.fn(),
}));

let mockAllowRequest = true;
jest.mock('../../../src/middleware/jwtAuth', () => ({
  authenticateJWT: (req, res, next) => {
    if (!mockAllowRequest) return res.status(401).json({ error: 'Unauthorized', code: 'AUTH_INVALID_TOKEN' });
    req.user = { id: 'user-1' };
    return next();
  },
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

const REFRESH_TOKEN = 'a-cognito-refresh-token-that-is-long-enough-to-pass-validation';
const ACCESS_TOKEN = 'header.payload.signature';

// The response as it was before this change. The ruling keeps it unchanged.
const UNCHANGED_BODY = { success: true, message: 'Logout successful', data: { loggedOut: true } };

const everythingLogged = (...spies) => spies.flatMap((s) => s.mock.calls).map((args) => args.map(String).join(' ')).join('\n');

describe('POST /logout', () => {
  let app;
  let errorSpy;
  let warnSpy;
  let logSpy;

  beforeEach(() => {
    jest.clearAllMocks();
    mockAllowRequest = true;
    app = buildApp();
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    errorSpy.mockRestore();
    warnSpy.mockRestore();
    logSpy.mockRestore();
  });

  const logout = (body) =>
    request(app).post('/api/v1/auth/logout').set('Authorization', `Bearer ${ACCESS_TOKEN}`).send(body);

  test('revokes the refresh token from the body at Cognito, and answers as before', async () => {
    cognitoPasswordAuthService.revokeRefreshToken.mockResolvedValue(undefined);

    const res = await logout({ refreshToken: REFRESH_TOKEN });

    expect(res.status).toBe(200);
    expect(res.body).toEqual(UNCHANGED_BODY);
    expect(cognitoPasswordAuthService.revokeRefreshToken).toHaveBeenCalledTimes(1);
    expect(cognitoPasswordAuthService.revokeRefreshToken).toHaveBeenCalledWith(REFRESH_TOKEN);
    expect(errorSpy).not.toHaveBeenCalled();
  });

  test('still revokes a local HS256 token in the in-memory blacklist', async () => {
    cognitoPasswordAuthService.revokeRefreshToken.mockResolvedValue(undefined);
    const spy = jest.spyOn(TokenService, 'revokeToken');

    await logout({ refreshToken: REFRESH_TOKEN });

    expect(spy).toHaveBeenCalledWith(ACCESS_TOKEN);
    spy.mockRestore();
  });

  test('when Cognito fails it still answers success, unchanged, and logs the failure under the fixed prefix by name only', async () => {
    const err = Object.assign(new Error(`could not revoke ${REFRESH_TOKEN}`), { name: 'TooManyRequestsException' });
    cognitoPasswordAuthService.revokeRefreshToken.mockRejectedValue(err);

    const res = await logout({ refreshToken: REFRESH_TOKEN });

    expect(res.status).toBe(200);
    expect(res.body).toEqual(UNCHANGED_BODY);
    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(errorSpy).toHaveBeenCalledWith('[logout] COGNITO_REVOKE_FAILED', 'TooManyRequestsException');
  });

  test('when Cognito cannot be reached at all, the same: success, and the error code as the name', async () => {
    cognitoPasswordAuthService.revokeRefreshToken.mockRejectedValue(Object.assign(new Error('getaddrinfo ENOTFOUND'), { name: '', code: 'ENOTFOUND' }));

    const res = await logout({ refreshToken: REFRESH_TOKEN });

    expect(res.status).toBe(200);
    expect(res.body).toEqual(UNCHANGED_BODY);
    expect(errorSpy).toHaveBeenCalledWith('[logout] COGNITO_REVOKE_FAILED', 'ENOTFOUND');
  });

  test('no token appears in anything logged, on success or on failure', async () => {
    cognitoPasswordAuthService.revokeRefreshToken.mockResolvedValueOnce(undefined);
    await logout({ refreshToken: REFRESH_TOKEN });
    cognitoPasswordAuthService.revokeRefreshToken.mockRejectedValueOnce(Object.assign(new Error(`bad ${REFRESH_TOKEN}`), { name: 'NotAuthorizedException' }));
    await logout({ refreshToken: REFRESH_TOKEN });

    const logged = everythingLogged(errorSpy, warnSpy, logSpy);
    expect(logged).not.toContain(REFRESH_TOKEN);
    expect(logged).not.toContain(ACCESS_TOKEN);
  });

  test('no refresh token in the body (an older frontend): no Cognito call, a warning, and success', async () => {
    const res = await logout({});

    expect(res.status).toBe(200);
    expect(res.body).toEqual(UNCHANGED_BODY);
    expect(cognitoPasswordAuthService.revokeRefreshToken).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0][0]).toMatch(/^\[logout\] no usable refresh token in the request \(absent\)/);
  });

  test.each([
    ['a number', 12345],
    ['an object', { token: REFRESH_TOKEN }],
    ['too short', 'short'],
    ['too long', 'x'.repeat(8193)],
  ])('a malformed refresh token (%s) never fails the logout and is never sent to Cognito', async (_label, value) => {
    const res = await logout({ refreshToken: value });

    expect(res.status).toBe(200);
    expect(res.body).toEqual(UNCHANGED_BODY);
    expect(cognitoPasswordAuthService.revokeRefreshToken).not.toHaveBeenCalled();
    expect(warnSpy.mock.calls[0][0]).toMatch(/\(malformed\)/);
    expect(everythingLogged(errorSpy, warnSpy, logSpy)).not.toContain(REFRESH_TOKEN);
  });

  test('an empty body is treated as no token', async () => {
    const res = await request(app).post('/api/v1/auth/logout').set('Authorization', `Bearer ${ACCESS_TOKEN}`);

    expect(res.status).toBe(200);
    expect(cognitoPasswordAuthService.revokeRefreshToken).not.toHaveBeenCalled();
  });

  test('still needs a valid access token: a refused request revokes nothing', async () => {
    mockAllowRequest = false;

    const res = await logout({ refreshToken: REFRESH_TOKEN });

    expect(res.status).toBe(401);
    expect(cognitoPasswordAuthService.revokeRefreshToken).not.toHaveBeenCalled();
  });
});
