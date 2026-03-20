/**
 * TokenService Unit Tests
 * Tests JWT generation, verification, revocation, and refresh
 */

jest.spyOn(console, 'warn').mockImplementation(() => {});

// Ensure test env is set
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-key-that-is-at-least-32-characters-long-for-security';
process.env.JWT_EXPIRY = '1h';
process.env.JWT_REFRESH_EXPIRY = '7d';

const jwt = require('jsonwebtoken');
const TokenService = require('../../../src/services/tokenService');

const sampleUser = {
  id: 'user-123',
  email: 'test@example.com',
  name: 'Test User',
  groups: ['viewer'],
  role: 'USER',
};

describe('TokenService', () => {
  beforeEach(() => {
    // Clear the blacklist between tests by creating a fresh Set
    TokenService.tokenBlacklist = new Set();
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('generateToken', () => {
    it('should generate a valid JWT string', () => {
      const token = TokenService.generateToken(sampleUser);
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3);
    });

    it('should include expected claims in payload', () => {
      const token = TokenService.generateToken(sampleUser);
      const decoded = jwt.decode(token);
      expect(decoded.sub).toBe('user-123');
      expect(decoded.email).toBe('test@example.com');
      expect(decoded.type).toBe('access');
      expect(decoded.jti).toBeDefined();
    });

    it('should generate a refresh token with type=refresh', () => {
      const token = TokenService.generateToken(sampleUser, 'refresh');
      const decoded = jwt.decode(token);
      expect(decoded.type).toBe('refresh');
    });

    it('should throw when JWT_SECRET is not set', () => {
      const original = process.env.JWT_SECRET;
      delete process.env.JWT_SECRET;
      expect(() => TokenService.generateToken(sampleUser)).toThrow('JWT_SECRET is not configured');
      process.env.JWT_SECRET = original;
    });

    it('should throw when JWT_SECRET is too short (< 32 chars)', () => {
      const original = process.env.JWT_SECRET;
      process.env.JWT_SECRET = 'short';
      expect(() => TokenService.generateToken(sampleUser)).toThrow('JWT_SECRET must be at least 32 characters');
      process.env.JWT_SECRET = original;
    });

    it('should include groups and role in the token', () => {
      const token = TokenService.generateToken({ ...sampleUser, groups: ['admin'], role: 'ADMIN' });
      const decoded = jwt.decode(token);
      expect(decoded.groups).toEqual(['admin']);
      expect(decoded.role).toBe('ADMIN');
    });

    it('should use user.userId as sub when user.id is absent', () => {
      const user = { userId: 'alt-id', email: 'alt@test.com' };
      const token = TokenService.generateToken(user);
      const decoded = jwt.decode(token);
      expect(decoded.sub).toBe('alt-id');
    });
  });

  describe('generateTokenPair', () => {
    it('should return accessToken, refreshToken, expiresIn, and tokenType', () => {
      const pair = TokenService.generateTokenPair(sampleUser);
      expect(pair).toHaveProperty('accessToken');
      expect(pair).toHaveProperty('refreshToken');
      expect(pair).toHaveProperty('expiresIn');
      expect(pair.tokenType).toBe('Bearer');
    });

    it('should return numeric expiresIn (milliseconds)', () => {
      const pair = TokenService.generateTokenPair(sampleUser);
      expect(typeof pair.expiresIn).toBe('number');
      expect(pair.expiresIn).toBeGreaterThan(0);
    });

    it('should generate distinct access and refresh tokens', () => {
      const pair = TokenService.generateTokenPair(sampleUser);
      expect(pair.accessToken).not.toBe(pair.refreshToken);
    });
  });

  describe('verifyToken', () => {
    it('should verify and return decoded payload for a valid access token', () => {
      const token = TokenService.generateToken(sampleUser);
      const decoded = TokenService.verifyToken(token, 'access');
      expect(decoded.sub).toBe('user-123');
      expect(decoded.email).toBe('test@example.com');
    });

    it('should throw for a tampered token', () => {
      const token = TokenService.generateToken(sampleUser) + 'tampered';
      expect(() => TokenService.verifyToken(token)).toThrow();
    });

    it('should throw when type mismatch (access token used as refresh)', () => {
      const token = TokenService.generateToken(sampleUser, 'access');
      expect(() => TokenService.verifyToken(token, 'refresh')).toThrow(/Invalid token type/);
    });

    it('should throw for a blacklisted (revoked) token', () => {
      const token = TokenService.generateToken(sampleUser);
      TokenService.revokeToken(token);
      expect(() => TokenService.verifyToken(token)).toThrow(/revoked/);
    });

    it('should throw for a completely invalid token string', () => {
      expect(() => TokenService.verifyToken('not.a.jwt')).toThrow();
    });
  });

  describe('revokeToken', () => {
    it('should add the token jti to the blacklist', () => {
      const token = TokenService.generateToken(sampleUser);
      const decoded = jwt.decode(token);
      TokenService.revokeToken(token);
      expect(TokenService.tokenBlacklist.has(decoded.jti)).toBe(true);
    });

    it('should not throw for invalid token input', () => {
      expect(() => TokenService.revokeToken('invalid-token')).not.toThrow();
    });

    it('should not throw for null input', () => {
      expect(() => TokenService.revokeToken(null)).not.toThrow();
    });
  });

  describe('refreshAccessToken', () => {
    it('should return a new accessToken and expiresIn', () => {
      const { refreshToken } = TokenService.generateTokenPair(sampleUser);
      const result = TokenService.refreshAccessToken(refreshToken);
      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('expiresIn');
      expect(result.tokenType).toBe('Bearer');
    });

    it('should produce a new access token with the same user sub', () => {
      const { refreshToken } = TokenService.generateTokenPair(sampleUser);
      const result = TokenService.refreshAccessToken(refreshToken);
      const decoded = jwt.decode(result.accessToken);
      expect(decoded.sub).toBe(sampleUser.id);
    });

    it('should throw when an access token is passed instead of refresh token', () => {
      const accessToken = TokenService.generateToken(sampleUser, 'access');
      expect(() => TokenService.refreshAccessToken(accessToken)).toThrow(/Token refresh failed/);
    });

    it('should throw when a revoked refresh token is used', () => {
      const { refreshToken } = TokenService.generateTokenPair(sampleUser);
      TokenService.revokeToken(refreshToken);
      expect(() => TokenService.refreshAccessToken(refreshToken)).toThrow();
    });
  });

  describe('generateTestToken', () => {
    it('should generate accessToken, refreshToken, user, expiresAt, and expiresIn', () => {
      const result = TokenService.generateTestToken();
      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(result).toHaveProperty('user');
      expect(result).toHaveProperty('expiresAt');
      expect(result).toHaveProperty('expiresIn');
    });

    it('should use default test user values', () => {
      const result = TokenService.generateTestToken();
      expect(result.user.email).toBe('test@episode-metadata.dev');
      expect(result.user.groups).toContain('USER');
    });

    it('should apply overrides to the test user', () => {
      const result = TokenService.generateTestToken({ email: 'admin@test.com', role: 'ADMIN' });
      expect(result.user.email).toBe('admin@test.com');
      expect(result.user.role).toBe('ADMIN');
    });

    it('should set expiresAt as a future Date', () => {
      const result = TokenService.generateTestToken();
      expect(result.expiresAt).toBeInstanceOf(Date);
      expect(result.expiresAt.getTime()).toBeGreaterThan(Date.now());
    });
  });
});
