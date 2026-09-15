/**
 * GET /me contract — Task #1451
 *
 * /me no longer returns req.user verbatim. It returns an explicitly
 * constructed object with exactly `id`, `email`, `name`, `groups` —
 * independent of whichever middleware built req.user. `role`, `tokenType`,
 * and `expiresAt` (all present on req.user for other reasons, e.g.
 * observability or auth.js's own shape) must not leak into the response.
 */

const express = require('express');
const request = require('supertest');

// Bypass real token verification — /me's contract is what's under test here,
// not authenticateJWT's verification path (covered in jwtAuth.test.js).
jest.mock('../../../src/middleware/jwtAuth', () => ({
  authenticateJWT: (req, res, next) => next(),
}));

const authRoutes = require('../../../src/routes/auth');

const buildApp = (reqUser) => {
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => {
    req.user = reqUser;
    next();
  });
  app.use('/api/v1/auth', authRoutes);
  return app;
};

describe('GET /me response contract', () => {
  test('returns exactly id, email, name, groups — nothing else', async () => {
    const app = buildApp({
      id: 'user-abc',
      email: 'user@example.com',
      name: 'Test User',
      groups: ['ADMIN'],
      tokenUse: 'id',
      issuedAt: 1000,
      expiresAt: 9999,
      source: 'local-hs256',
      raw: { sub: 'user-abc' },
    });

    const res = await request(app).get('/api/v1/auth/me');

    expect(res.status).toBe(200);
    expect(res.body.data.user).toEqual({
      id: 'user-abc',
      email: 'user@example.com',
      name: 'Test User',
      groups: ['ADMIN'],
    });
    expect(Object.keys(res.body.data.user).sort()).toEqual(['email', 'groups', 'id', 'name']);
  });

  test('role, tokenType, and expiresAt do not appear in the response even when present on req.user', async () => {
    const app = buildApp({
      id: 'user-xyz',
      email: 'xyz@example.com',
      name: 'XYZ',
      groups: ['EDITOR'],
      role: 'ADMIN', // legacy field some callers might still set on req.user
      tokenType: 'jwt', // legacy field
      expiresAt: 123456,
      source: 'cognito',
    });

    const res = await request(app).get('/api/v1/auth/me');

    expect(res.status).toBe(200);
    expect(res.body.data.user).not.toHaveProperty('role');
    expect(res.body.data.user).not.toHaveProperty('tokenType');
    expect(res.body.data.user).not.toHaveProperty('expiresAt');
    expect(res.body.data.user).not.toHaveProperty('source');
  });

  test('works identically regardless of which verifier populated req.user (cognito vs local-hs256)', async () => {
    const cognitoApp = buildApp({
      id: 'cognito-user',
      email: 'c@example.com',
      name: 'Cognito User',
      groups: ['ADMIN'],
      source: 'cognito',
    });
    const localApp = buildApp({
      id: 'local-user',
      email: 'l@example.com',
      name: 'Local User',
      groups: ['ADMIN'],
      source: 'local-hs256',
    });

    const cognitoRes = await request(cognitoApp).get('/api/v1/auth/me');
    const localRes = await request(localApp).get('/api/v1/auth/me');

    expect(Object.keys(cognitoRes.body.data.user).sort()).toEqual(
      Object.keys(localRes.body.data.user).sort()
    );
  });
});
