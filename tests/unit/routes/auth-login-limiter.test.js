/**
 * POST /login rate limit: only failed attempts count.
 *
 * Evoni, 2026-10-23: signing out and back in a few times hit "Too many login
 * attempts" because successful sign-ins counted toward the 5 per 15 minutes.
 * The limiter skips itself under NODE_ENV=test, so these requests run with
 * NODE_ENV=production and a freshly loaded router (its own limiter store).
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

const buildApp = () => {
  let authRoutes;
  jest.isolateModules(() => {
    authRoutes = require('../../../src/routes/auth');
  });
  const app = express();
  app.use(express.json());
  app.use('/api/v1/auth', authRoutes);
  return app;
};

const login = (app, password) => request(app)
  .post('/api/v1/auth/login')
  .send({ email: 'user@example.com', password });

describe('POST /login rate limit', () => {
  const env = process.env.NODE_ENV;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NODE_ENV = 'production';
  });

  afterEach(() => {
    process.env.NODE_ENV = env;
  });

  test('successful sign-ins do not count toward the limit', async () => {
    cognitoPasswordAuthService.initiatePasswordAuth.mockResolvedValue({
      accessToken: 'a', refreshToken: 'r', expiresIn: 3600, tokenType: 'Bearer',
      user: { id: 'u1', email: 'user@example.com', name: 'User', groups: [] },
    });
    const app = buildApp();
    for (let i = 0; i < 8; i += 1) {
      const res = await login(app, 'correct-password');
      expect(res.status).toBe(200);
    }
  });

  test('failed attempts still stop at five', async () => {
    const err = new Error('wrong password');
    err.name = 'NotAuthorizedException';
    cognitoPasswordAuthService.initiatePasswordAuth.mockRejectedValue(err);
    const app = buildApp();
    for (let i = 0; i < 5; i += 1) {
      const res = await login(app, 'wrong-password');
      expect(res.status).toBe(401);
    }
    const sixth = await login(app, 'wrong-password');
    expect(sixth.status).toBe(429);
    expect(cognitoPasswordAuthService.initiatePasswordAuth).toHaveBeenCalledTimes(5);
  });
});
