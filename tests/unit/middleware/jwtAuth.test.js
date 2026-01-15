/**
 * JWT Authentication Middleware Tests
 * Tests JWT token verification and user extraction
 */

jest.mock('../../../src/services/tokenService');
const TokenService = require('../../../src/services/tokenService');
const { authenticateJWT } = require('../../../src/middleware/jwtAuth');

describe('JWT Authentication Middleware', () => {
  let mockReq, mockRes, mockNext;

  beforeEach(() => {
    mockReq = {
      headers: {},
      user: null,
    };

    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };

    mockNext = jest.fn();
    jest.clearAllMocks();
  });

  describe('authenticateJWT()', () => {
    test('should return 401 if no authorization header', async () => {
      mockReq.headers.authorization = undefined;

      await authenticateJWT(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'AUTH_MISSING_TOKEN',
        })
      );
    });

    test('should return 401 if authorization header missing Bearer prefix', async () => {
      mockReq.headers.authorization = 'token-without-bearer';

      await authenticateJWT(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'AUTH_INVALID_FORMAT',
        })
      );
    });

    test('should call next() with valid JWT token', async () => {
      const mockToken = 'valid.jwt.token';
      mockReq.headers.authorization = `Bearer ${mockToken}`;

      TokenService.verifyToken.mockReturnValue({
        sub: 'user123',
        email: 'user@example.com',
        name: 'Test User',
        groups: ['editor'],
        role: 'ADMIN',
        exp: Math.floor(Date.now() / 1000) + 3600,
      });

      await authenticateJWT(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    test('should attach user info to request object', async () => {
      const mockToken = 'valid.jwt.token';
      mockReq.headers.authorization = `Bearer ${mockToken}`;

      const decodedToken = {
        sub: 'user-id-123',
        email: 'test@example.com',
        name: 'Test User',
        groups: ['admin'],
        role: 'ADMIN',
        exp: Math.floor(Date.now() / 1000) + 3600,
      };

      TokenService.verifyToken.mockReturnValue(decodedToken);

      await authenticateJWT(mockReq, mockRes, mockNext);

      expect(mockReq.user).toBeDefined();
      expect(mockReq.user.id).toBe('user-id-123');
      expect(mockReq.user.email).toBe('test@example.com');
      expect(mockReq.user.tokenType).toBe('jwt');
    });

    test('should handle token without groups field', async () => {
      mockReq.headers.authorization = 'Bearer valid.token';

      TokenService.verifyToken.mockReturnValue({
        sub: 'user123',
        email: 'user@example.com',
        exp: Math.floor(Date.now() / 1000) + 3600,
      });

      await authenticateJWT(mockReq, mockRes, mockNext);

      expect(mockReq.user.groups).toEqual([]);
      expect(mockNext).toHaveBeenCalled();
    });

    test('should set default role if not provided', async () => {
      mockReq.headers.authorization = 'Bearer token';

      TokenService.verifyToken.mockReturnValue({
        sub: 'user123',
        exp: Math.floor(Date.now() / 1000) + 3600,
      });

      await authenticateJWT(mockReq, mockRes, mockNext);

      expect(mockReq.user.role).toBe('USER');
    });

    test('should return 401 if token verification fails', async () => {
      mockReq.headers.authorization = 'Bearer invalid.token';

      TokenService.verifyToken.mockImplementation(() => {
        throw new Error('Invalid token signature');
      });

      await authenticateJWT(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'AUTH_INVALID_TOKEN',
        })
      );
      expect(mockNext).not.toHaveBeenCalled();
    });

    test('should handle case-insensitive Bearer keyword', async () => {
      mockReq.headers.authorization = 'bearer lowercase';

      TokenService.verifyToken.mockImplementation(() => {
        throw new Error('Token error');
      });

      await authenticateJWT(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
    });

    test('should not call next() on authentication failure', async () => {
      mockReq.headers.authorization = 'Bearer invalid';

      TokenService.verifyToken.mockImplementation(() => {
        throw new Error('Token expired');
      });

      await authenticateJWT(mockReq, mockRes, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
    });

    test('should set expiresAt timestamp correctly', async () => {
      mockReq.headers.authorization = 'Bearer valid.token';
      const nowSeconds = Math.floor(Date.now() / 1000);
      const expSeconds = nowSeconds + 3600;

      TokenService.verifyToken.mockReturnValue({
        sub: 'user123',
        exp: expSeconds,
      });

      await authenticateJWT(mockReq, mockRes, mockNext);

      expect(mockReq.user.expiresAt).toBeInstanceOf(Date);
      expect(mockReq.user.expiresAt.getTime()).toBe(expSeconds * 1000);
    });

    test('should preserve all token claims', async () => {
      mockReq.headers.authorization = 'Bearer token';

      const claims = {
        sub: 'user123',
        email: 'user@example.com',
        name: 'Full Name',
        groups: ['group1', 'group2'],
        role: 'ADMIN',
        customClaim: 'customValue',
        exp: Math.floor(Date.now() / 1000) + 3600,
      };

      TokenService.verifyToken.mockReturnValue(claims);

      await authenticateJWT(mockReq, mockRes, mockNext);

      expect(mockReq.user.id).toBe(claims.sub);
      expect(mockReq.user.email).toBe(claims.email);
      expect(mockReq.user.groups).toEqual(claims.groups);
      expect(mockReq.user.role).toBe(claims.role);
    });
  });

  describe('Error handling', () => {
    test('should handle null authorization header', async () => {
      mockReq.headers.authorization = null;

      await authenticateJWT(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
    });

    test('should handle empty authorization header', async () => {
      mockReq.headers.authorization = '';

      await authenticateJWT(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
    });

    test('should handle authorization header with extra spaces', async () => {
      mockReq.headers.authorization = 'Bearer  token-with-spaces';

      TokenService.verifyToken.mockImplementation(() => {
        throw new Error('Token error');
      });

      await authenticateJWT(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalled();
    });

    test('should handle authorization header with multiple spaces between Bearer and token', async () => {
      mockReq.headers.authorization = 'Bearer   token';

      // This should fail because split(' ') will create more than 2 parts
      await authenticateJWT(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
    });

    test('should handle token service throwing unexpected errors', async () => {
      mockReq.headers.authorization = 'Bearer token';

      TokenService.verifyToken.mockImplementation(() => {
        throw new Error('Unexpected service error');
      });

      await authenticateJWT(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
    });

    test('should handle token with missing exp claim', async () => {
      mockReq.headers.authorization = 'Bearer token';

      TokenService.verifyToken.mockReturnValue({
        sub: 'user123',
        // No exp claim
      });

      await authenticateJWT(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
      // expiresAt will be based on undefined * 1000 = NaN
    });
  });

  describe('Response structure', () => {
    test('should return proper error response structure', async () => {
      mockReq.headers.authorization = 'invalid-header';

      await authenticateJWT(mockReq, mockRes, mockNext);

      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.any(String),
          message: expect.any(String),
          code: expect.any(String),
        })
      );
    });

    test('should not send response body when calling next()', async () => {
      mockReq.headers.authorization = 'Bearer valid.token';

      TokenService.verifyToken.mockReturnValue({
        sub: 'user123',
        exp: Math.floor(Date.now() / 1000) + 3600,
      });

      await authenticateJWT(mockReq, mockRes, mockNext);

      expect(mockRes.json).not.toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });
  });
});
