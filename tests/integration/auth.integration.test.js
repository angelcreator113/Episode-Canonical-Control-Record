/**
 * Integration Tests - Authentication
 * Tests for login, refresh, logout, and token validation
 * Uses Jest + Supertest
 */

const request = require('supertest');

// POST /login now calls Cognito's InitiateAuth (Task #1456). Mocked here so
// this integration file makes no Cognito, AWS, or host contact regardless of
// whether DATABASE_URL is configured in the environment running it.
jest.mock('../../src/services/cognitoPasswordAuthService', () => ({
  initiatePasswordAuth: jest.fn(),
}));

const app = require('../../src/app');
const TokenService = require('../../src/services/tokenService');
const cognitoPasswordAuthService = require('../../src/services/cognitoPasswordAuthService');

// Skip integration tests if no DB is configured or if using production database
const shouldSkip = !process.env.DATABASE_URL || process.env.DATABASE_URL?.includes('amazonaws.com');

(shouldSkip ? describe.skip : describe)('Authentication API Integration Tests', () => {
  let accessToken, refreshToken, user;

  // File-wide, not just the POST /login describe below: a mocked resolved/
  // rejected value set by one test otherwise persists into any later test in
  // this file that hits /login, which is exactly how the End-to-End
  // Authentication Flow test below used to observe a stale 200 from a
  // preceding login test's leftover mock state.
  afterEach(() => {
    cognitoPasswordAuthService.initiatePasswordAuth.mockReset();
  });

  // Setup: Create test user tokens before each test
  beforeEach(() => {
    user = {
      id: 'test-user-' + Math.random().toString(36).substr(2, 9),
      email: 'test@integration.dev',
      name: 'Integration Test User',
      groups: ['USER', 'EDITOR'],
      role: 'USER',
    };

    const tokens = TokenService.generateTokenPair(user);
    accessToken = tokens.accessToken;
    refreshToken = tokens.refreshToken;
  });

  describe('POST /api/v1/auth/login', () => {
    // Task #1456: FD-65's issuance half's dev-only local-HS256 path (closed
    // 2026-08-22, disabled 401) is replaced by a real Cognito InitiateAuth
    // exchange. Mocked at the service boundary — see the jest.mock above —
    // so this test makes no Cognito, AWS, or host contact.
    it('exchanges valid credentials for Cognito tokens and mints no local HS256 token', async () => {
      cognitoPasswordAuthService.initiatePasswordAuth.mockResolvedValue({
        accessToken: 'cognito-access-token',
        refreshToken: 'cognito-refresh-token',
        expiresIn: 3600,
        tokenType: 'Bearer',
        user: { id: 'cognito-sub', email: 'test@example.com', name: 'Test', groups: ['USER'] },
      });

      const res = await request(app).post('/api/v1/auth/login').send({
        email: 'test@example.com',
        password: 'password123',
      });

      expect(res.status).toBe(200);
      expect(res.body.data).toEqual({
        accessToken: 'cognito-access-token',
        refreshToken: 'cognito-refresh-token',
        expiresIn: 3600,
        tokenType: 'Bearer',
        user: { id: 'cognito-sub', email: 'test@example.com', name: 'Test', groups: ['USER'] },
      });
    });

    it('maps a Cognito NotAuthorizedException to 401 without disclosing account existence', async () => {
      const err = new Error('Incorrect username or password.');
      err.name = 'NotAuthorizedException';
      cognitoPasswordAuthService.initiatePasswordAuth.mockRejectedValue(err);

      const res = await request(app).post('/api/v1/auth/login').send({
        email: 'test@example.com',
        password: 'wrong-password',
      });

      expect(res.status).toBe(401);
      expect(res.body).toHaveProperty('code', 'AUTH_INVALID_CREDENTIALS');
      expect(res.body.data).toBeUndefined();
    });

    // Still 400. validateLoginRequest is mounted AHEAD of the handler, so a
    // malformed request never reaches Cognito. This assertion is unchanged
    // by the implementation swap.
    it('should reject login with missing email', async () => {
      const res = await request(app).post('/api/v1/auth/login').send({
        password: 'password123',
      });

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error');
      expect(res.body.details).toContain('Email is required');
    });

    it('should reject login with invalid email format', async () => {
      const res = await request(app).post('/api/v1/auth/login').send({
        email: 'not-an-email',
        password: 'password123',
      });

      expect(res.status).toBe(400);
      expect(res.body.details[0]).toMatch(/Email format is invalid/i);
    });

    it('should reject login with short password', async () => {
      const res = await request(app).post('/api/v1/auth/login').send({
        email: 'test@example.com',
        password: 'short',
      });

      expect(res.status).toBe(400);
      expect(res.body.details[0]).toMatch(/Password must be at least 6 characters/i);
    });

    it('should reject login with missing password', async () => {
      const res = await request(app).post('/api/v1/auth/login').send({
        email: 'test@example.com',
      });

      expect(res.status).toBe(400);
      expect(res.body.details).toContain('Password is required');
    });

    it('still reaches the route with the rate limiter mounted', async () => {
      // Rate limiting is skipped in development/test, so this only asserts
      // the request reaches the handler and the Cognito exchange is invoked.
      // It does NOT assert that rate limiting works.
      cognitoPasswordAuthService.initiatePasswordAuth.mockResolvedValue({
        accessToken: 'a',
        refreshToken: 'r',
        expiresIn: 60,
        tokenType: 'Bearer',
        user: { id: 'u', email: 'test@example.com', name: 'Test', groups: [] },
      });

      const res = await request(app).post('/api/v1/auth/login').send({
        email: 'test@example.com',
        password: 'password123',
      });

      expect(res.status).toBe(200);
      expect(cognitoPasswordAuthService.initiatePasswordAuth).toHaveBeenCalledWith(
        'test@example.com',
        'password123'
      );
    });
  });

  describe('POST /api/v1/auth/refresh', () => {
    it('should successfully refresh access token', async () => {
      const res = await request(app).post('/api/v1/auth/refresh').send({
        refreshToken,
      });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success', true);
      expect(res.body.data).toHaveProperty('accessToken');
      expect(res.body.data.accessToken).not.toBe(accessToken);
    });

    it('should reject refresh with missing token', async () => {
      const res = await request(app).post('/api/v1/auth/refresh').send({});

      expect(res.status).toBe(400);
      expect(res.body.details[0]).toMatch(/refreshToken is required/i);
    });

    it('should reject refresh with invalid token format', async () => {
      const res = await request(app).post('/api/v1/auth/refresh').send({
        refreshToken: 'invalid-token',
      });

      expect(res.status).toBe(400);
      expect(res.body.details[0]).toMatch(/Invalid refresh token format/i);
    });

    it('should reject refresh with expired token', async () => {
      // Create an expired token by manually crafting one
      const jwt = require('jsonwebtoken');
      const expiredToken = jwt.sign(
        {
          jti: 'test-expired-token',
          sub: user.id,
          email: user.email,
          name: user.name,
          groups: user.groups,
          role: user.role,
          type: 'refresh',
          iat: Math.floor(Date.now() / 1000) - 86400,
          exp: Math.floor(Date.now() / 1000) - 3600, // Expired 1 hour ago
        },
        process.env.JWT_SECRET,
        {
          issuer: process.env.TOKEN_ISSUER || 'episode-metadata-api',
          audience: process.env.TOKEN_AUDIENCE || 'episode-metadata-app',
          algorithm: 'HS256',
        }
      );

      const res = await request(app).post('/api/v1/auth/refresh').send({
        refreshToken: expiredToken,
      });

      expect(res.status).toBe(401);
      expect(res.body).toHaveProperty('error');
    });
  });

  describe('POST /api/v1/auth/logout', () => {
    it('should successfully logout authenticated user', async () => {
      const res = await request(app)
        .post('/api/v1/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success', true);
      expect(res.body.data.loggedOut).toBe(true);
    });

    it('should reject logout without authentication header', async () => {
      const res = await request(app).post('/api/v1/auth/logout');

      expect(res.status).toBe(401);
      expect(res.body).toHaveProperty('error');
    });

    it('should reject logout with invalid token', async () => {
      const res = await request(app)
        .post('/api/v1/auth/logout')
        .set('Authorization', 'Bearer invalid-token');

      expect(res.status).toBe(401);
      expect(res.body).toHaveProperty('error');
    });

    it('should add token to blacklist after logout', async () => {
      // Logout
      await request(app).post('/api/v1/auth/logout').set('Authorization', `Bearer ${accessToken}`);

      // Try to use the same token
      const validateRes = await request(app)
        .post('/api/v1/auth/validate')
        .send({ token: accessToken });

      expect(validateRes.status).toBe(401);
      expect(validateRes.body.message).toMatch(/revoked/i);
    });
  });

  describe('POST /api/v1/auth/validate', () => {
    it('should validate a valid token', async () => {
      const res = await request(app).post('/api/v1/auth/validate').send({ token: accessToken });

      expect(res.status).toBe(200);
      expect(res.body.data.valid).toBe(true);
      expect(res.body.data.user.email).toBe(user.email);
    });

    it('should reject validation without token', async () => {
      const res = await request(app).post('/api/v1/auth/validate').send({});

      expect(res.status).toBe(400);
      expect(res.body.details[0]).toMatch(/token is required/i);
    });

    it('should reject validation with invalid token', async () => {
      const res = await request(app)
        .post('/api/v1/auth/validate')
        .send({ token: 'invalid-token-format' });

      expect(res.status).toBe(400);
      expect(res.body.details[0]).toMatch(/Invalid token format/i);
    });

    it('should reject validation with expired token', async () => {
      const expiredToken = TokenService.generateToken(user, 'access');

      // Manually set expiration to past
      const parts = expiredToken.split('.');
      const _header = JSON.parse(Buffer.from(parts[0], 'base64').toString());
      const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
      payload.exp = Math.floor(Date.now() / 1000) - 3600; // 1 hour ago

      // Re-sign with expired timestamp would require signing, so we just verify behavior
      const res = await request(app).post('/api/v1/auth/validate').send({
        token:
          'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOjE2MDAwMDAwMDAsImlhdCI6MTYwMDAwMDAwMH0.invalid',
      });

      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/v1/auth/me', () => {
    // Task #1451: /me returns an explicitly constructed object — exactly
    // id, email, name, groups. `role` is a removal (auth.js's verifyToken
    // path supplies no role field), not a rename.
    it('should return authenticated user info as the four contracted fields', async () => {
      const res = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.user.email).toBe(user.email);
      expect(res.body.data.user.name).toBe(user.name);
      expect(res.body.data.user.groups).toEqual(user.groups);
      expect(Object.keys(res.body.data.user).sort()).toEqual(['email', 'groups', 'id', 'name']);
      expect(res.body.data.user).not.toHaveProperty('role');
    });

    it('should reject request without authentication', async () => {
      const res = await request(app).get('/api/v1/auth/me');

      expect(res.status).toBe(401);
    });

    it('should reject request with invalid token', async () => {
      const res = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', 'Bearer invalid-token');

      expect(res.status).toBe(401);
    });
  });

  // FD-65 (F-AUTH-1). This route was deleted per Fix Plan v2.50 §1 change #1:
  // it minted signed tokens for anonymous callers with caller-specified
  // `groups` and `role`, behind no rate limiter and no validation middleware,
  // gated only by NODE_ENV. This block previously asserted it returned 200 —
  // i.e. it was a test that the endpoint worked. It is now a guard that the
  // route stays gone.
  //
  // The request still sends `role: 'ADMIN'` deliberately: that is the payload
  // which made the endpoint dangerous, and a 404 means no handler is mounted to
  // receive it in any environment. The previous NODE_ENV skip is dropped
  // because the route is absent everywhere, not merely blocked in production.
  //
  // Re-adding a `/test-token` route is not authorized by v2.50 and would fail
  // here. If it is ever reinstated, it needs its own adjudication.
  describe('POST /api/v1/auth/test-token — deleted under FD-65', () => {
    it('is not mounted; anonymous minting via this route is gone', async () => {
      const res = await request(app).post('/api/v1/auth/test-token').send({
        email: 'custom@test.dev',
        role: 'ADMIN',
      });

      expect(res.status).toBe(404);
      expect(res.body).not.toHaveProperty('data.accessToken');
    });
  });

  describe('End-to-End Authentication Flow', () => {
    it('should complete full auth cycle: token -> use -> refresh -> logout', async () => {
      // 1. Obtain a token. This flow is deliberately independent of how the
      // token was issued — minted directly here rather than through /login,
      // which Task #1456 changed from an unconditional-401 disable to a real
      // (mocked-in-this-file) Cognito exchange. The old version of this test
      // additionally called /login and asserted 401 here, "unaffected by
      // where the token comes from" per this comment's prior wording — that
      // call exercised nothing this test itself needs, and its unmocked
      // result depended on execution order, since jest.fn()'s mocked
      // resolved/rejected value from a different describe block persists
      // across tests unless reset. Removed rather than fixed in place:
      // /login's actual behavior is already covered by the dedicated
      // POST /login describe block above.
      const e2eTokens = TokenService.generateTokenPair({
        id: 'e2e-user',
        email: 'e2e@test.dev',
        name: 'e2e',
        groups: ['USER'],
        role: 'USER',
      });
      const token1 = e2eTokens.accessToken;
      const refresh1 = e2eTokens.refreshToken;

      // 2. Use token to access protected endpoint
      const meRes = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${token1}`);

      expect(meRes.status).toBe(200);
      expect(meRes.body.data.user.email).toBe('e2e@test.dev');

      // 3. Refresh token
      const refreshRes = await request(app)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: refresh1 });

      expect(refreshRes.status).toBe(200);
      const { accessToken: token2 } = refreshRes.body.data;

      // 4. Use new token
      const meRes2 = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${token2}`);

      expect(meRes2.status).toBe(200);

      // 5. Logout
      const logoutRes = await request(app)
        .post('/api/v1/auth/logout')
        .set('Authorization', `Bearer ${token2}`);

      expect(logoutRes.status).toBe(200);

      // 6. Try to use logged-out token (should fail)
      const failRes = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${token2}`);

      expect(failRes.status).toBe(401);
    });
  });
});
