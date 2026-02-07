/**
 * Token Service
 * Handles JWT token generation, validation, and refresh
 * Implements security best practices for JWT handling
 */

const jwt = require('jsonwebtoken');
const crypto = require('crypto');

class TokenService {
  // Token blacklist for revoked tokens (in production, use Redis)
  static tokenBlacklist = new Set();

  /**
   * Generate a JWT token for a user
   * @param {object} user - User object with id, email, etc.
   * @param {string} type - 'access' or 'refresh'
   * @returns {string} JWT token
   */
  static generateToken(user, type = 'access') {
    const secret = process.env.JWT_SECRET;

    if (!secret) {
      throw new Error('JWT_SECRET is not configured in environment variables');
    }

    if (secret.length < 32) {
      throw new Error('JWT_SECRET must be at least 32 characters for security');
    }

    const expiresIn =
      type === 'refresh' ? process.env.JWT_REFRESH_EXPIRY || '7d' : process.env.JWT_EXPIRY || '1h';

    const jti = crypto.randomBytes(16).toString('hex'); // Unique token ID
    const payload = {
      jti, // Unique token identifier
      sub: user.id || user.userId,
      email: user.email,
      name: user.name || user.email.split('@')[0],
      groups: user.groups || [],
      role: user.role || 'USER',
      type, // 'access' or 'refresh'
      iat: Math.floor(Date.now() / 1000),
    };

    const signOptions = {
      expiresIn,
      algorithm: 'HS256',
    };

    // Only add issuer and audience in non-test environments
    if (process.env.NODE_ENV !== 'test') {
      signOptions.issuer = process.env.TOKEN_ISSUER || 'episode-metadata-api';
      signOptions.audience = process.env.TOKEN_AUDIENCE || 'episode-metadata-app';
    }

    const token = jwt.sign(payload, secret, signOptions);

    return token;
  }

  /**
   * Generate both access and refresh tokens
   * @param {object} user - User object
   * @returns {object} { accessToken, refreshToken, expiresIn }
   */
  static generateTokenPair(user) {
    const accessToken = this.generateToken(user, 'access');
    const refreshToken = this.generateToken(user, 'refresh');

    // Decode to get expiry
    const decoded = jwt.decode(accessToken);
    const expiresIn = decoded.exp * 1000 - Date.now();

    return {
      accessToken,
      refreshToken,
      expiresIn,
      tokenType: 'Bearer',
    };
  }

  /**
   * Verify a JWT token
   * @param {string} token - JWT token to verify
   * @returns {object} Decoded token payload
   */
  static verifyToken(token, type = 'access') {
    try {
      const verifyOptions = {
        algorithms: ['HS256'],
      };

      // In production, enforce issuer and audience. In test, they're optional
      if (process.env.NODE_ENV !== 'test') {
        verifyOptions.issuer = process.env.TOKEN_ISSUER || 'episode-metadata-api';
        verifyOptions.audience = process.env.TOKEN_AUDIENCE || 'episode-metadata-app';
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET, verifyOptions);

      // Check if token is blacklisted (revoked)
      if (this.tokenBlacklist.has(decoded.jti)) {
        throw new Error('Token has been revoked');
      }

      // Verify token type if specified
      if (type && decoded.type !== type) {
        throw new Error(`Invalid token type. Expected: ${type}, Got: ${decoded.type}`);
      }

      // Verify required claims
      if (!decoded.sub || !decoded.email) {
        throw new Error('Missing required token claims');
      }

      return decoded;
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        throw new Error('Token has expired');
      } else if (error.name === 'JsonWebTokenError') {
        throw new Error('Invalid token signature');
      } else if (error.message.includes('revoked')) {
        throw error; // Re-throw revoked token error as-is
      }
      throw new Error(`Token verification failed: ${error.message}`);
    }
  }

  /**
   * Revoke a token (add to blacklist)
   * @param {string} token - JWT token to revoke
   */
  static revokeToken(token) {
    try {
      const decoded = jwt.decode(token);
      if (decoded && decoded.jti) {
        this.tokenBlacklist.add(decoded.jti);
      }
    } catch (error) {
      console.warn('Failed to revoke token:', error.message);
    }
  }

  /**
   * Refresh an access token using a refresh token
   * @param {string} refreshToken - Refresh token
   * @returns {object} New { accessToken, expiresIn }
   */
  static refreshAccessToken(refreshToken) {
    try {
      const decoded = this.verifyToken(refreshToken, 'refresh');

      const newAccessToken = this.generateToken(
        {
          id: decoded.sub,
          email: decoded.email,
          name: decoded.name,
          groups: decoded.groups,
          role: decoded.role,
        },
        'access'
      );

      const decodedAccess = jwt.decode(newAccessToken);
      const expiresIn = decodedAccess.exp * 1000 - Date.now();

      return {
        accessToken: newAccessToken,
        expiresIn,
        tokenType: 'Bearer',
      };
    } catch (error) {
      throw new Error(`Token refresh failed: ${error.message}`);
    }
  }

  /**
   * Generate a test token for development
   * Useful for testing without Cognito
   * @param {object} overrides - Override default test user properties
   * @returns {object} { token, user, expiresAt }
   */
  static generateTestToken(overrides = {}) {
    const testUser = {
      id: 'test-user-' + crypto.randomBytes(8).toString('hex'),
      email: overrides.email || 'test@episode-metadata.dev',
      name: overrides.name || 'Test User',
      groups: overrides.groups || ['USER', 'EDITOR'],
      role: overrides.role || 'USER',
      ...overrides,
    };

    const { accessToken, refreshToken, expiresIn } = this.generateTokenPair(testUser);
    const decoded = jwt.decode(accessToken);

    return {
      accessToken,
      refreshToken,
      user: testUser,
      expiresAt: new Date(decoded.exp * 1000),
      expiresIn,
    };
  }
}

module.exports = TokenService;

// Export individual methods for easier importing
module.exports.generateToken = TokenService.generateToken.bind(TokenService);
module.exports.verifyToken = TokenService.verifyToken.bind(TokenService);
module.exports.generateTokenPair = TokenService.generateTokenPair.bind(TokenService);
module.exports.refreshAccessToken = TokenService.refreshAccessToken.bind(TokenService);
module.exports.revokeToken = TokenService.revokeToken.bind(TokenService);
module.exports.generateTestToken = TokenService.generateTestToken.bind(TokenService);

