/**
 * requestValidation Middleware Unit Tests
 * Tests all validation and sanitization functions
 */

const {
  validateEmail,
  validateUUID,
  sanitizeString,
  validateLoginRequest,
  validateRefreshRequest,
  validateTokenRequest,
  validateEpisodeQuery,
  validateUUIDParam,
  validateAssetUpload,
} = require('../../../src/middleware/requestValidation');

// Helper to build mock req/res/next
function buildMocks(overrides = {}) {
  const req = { body: {}, query: {}, params: {}, ...overrides };
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
  const next = jest.fn();
  return { req, res, next };
}

describe('requestValidation', () => {
  describe('validateEmail', () => {
    it('should return true for valid email addresses', () => {
      expect(validateEmail('user@example.com')).toBe(true);
      expect(validateEmail('user.name+tag@domain.co.uk')).toBe(true);
      expect(validateEmail('a@b.c')).toBe(true);
    });

    it('should return false for invalid email addresses', () => {
      expect(validateEmail('notanemail')).toBe(false);
      expect(validateEmail('@domain.com')).toBe(false);
      expect(validateEmail('user@')).toBe(false);
      expect(validateEmail('user @domain.com')).toBe(false);
      expect(validateEmail('')).toBe(false);
    });
  });

  describe('validateUUID', () => {
    it('should return true for valid UUIDs', () => {
      expect(validateUUID('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
      expect(validateUUID('123e4567-e89b-12d3-a456-426614174000')).toBe(true);
    });

    it('should return false for invalid UUIDs', () => {
      expect(validateUUID('not-a-uuid')).toBe(false);
      expect(validateUUID('12345')).toBe(false);
      expect(validateUUID('')).toBe(false);
      expect(validateUUID('550e8400-e29b-41d4-a716')).toBe(false);
    });
  });

  describe('sanitizeString', () => {
    it('should remove <script> tags', () => {
      const result = sanitizeString('<script>alert("xss")</script>Hello');
      expect(result).not.toContain('<script>');
      expect(result).toContain('Hello');
    });

    it('should remove <iframe> tags', () => {
      const result = sanitizeString('<iframe src="evil.com"></iframe>Clean');
      expect(result).not.toContain('<iframe>');
      expect(result).toContain('Clean');
    });

    it('should remove javascript: protocols', () => {
      const result = sanitizeString('javascript:alert(1) text');
      expect(result).not.toContain('javascript:');
    });

    it('should trim whitespace', () => {
      expect(sanitizeString('  hello  ')).toBe('hello');
    });

    it('should return non-string input as-is', () => {
      expect(sanitizeString(42)).toBe(42);
      expect(sanitizeString(null)).toBe(null);
    });

    it('should preserve safe text unchanged (after trim)', () => {
      expect(sanitizeString('normal text')).toBe('normal text');
    });
  });

  describe('validateLoginRequest', () => {
    it('should call next for valid email and password', () => {
      const { req, res, next } = buildMocks({
        body: { email: 'user@example.com', password: 'secret123' },
      });
      validateLoginRequest(req, res, next);
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should return 400 when email is missing', () => {
      const { req, res, next } = buildMocks({ body: { password: 'secret123' } });
      validateLoginRequest(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(next).not.toHaveBeenCalled();
    });

    it('should return 400 for invalid email format', () => {
      const { req, res, next } = buildMocks({ body: { email: 'bad-email', password: 'secret123' } });
      validateLoginRequest(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
      const body = res.json.mock.calls[0][0];
      expect(body.details).toContain('Email format is invalid');
    });

    it('should return 400 when email exceeds 254 characters', () => {
      // Build an email > 254 chars: 250 'a's + '@b.com' = 256 chars
      const longEmail = 'a'.repeat(250) + '@b.com';
      const { req, res, next } = buildMocks({ body: { email: longEmail, password: 'secret123' } });
      validateLoginRequest(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should return 400 when password is missing', () => {
      const { req, res, next } = buildMocks({ body: { email: 'user@example.com' } });
      validateLoginRequest(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
      const body = res.json.mock.calls[0][0];
      expect(body.details).toContain('Password is required');
    });

    it('should return 400 when password is too short (< 6 chars)', () => {
      const { req, res, next } = buildMocks({ body: { email: 'user@example.com', password: '123' } });
      validateLoginRequest(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
      const body = res.json.mock.calls[0][0];
      expect(body.details).toContain('Password must be at least 6 characters');
    });

    it('should return 400 when password exceeds 512 characters', () => {
      const longPassword = 'a'.repeat(513);
      const { req, res, next } = buildMocks({ body: { email: 'user@example.com', password: longPassword } });
      validateLoginRequest(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should lowercase the email before calling next', () => {
      const { req, res, next } = buildMocks({
        body: { email: 'User@Example.COM', password: 'secret123' },
      });
      validateLoginRequest(req, res, next);
      expect(next).toHaveBeenCalled();
      expect(req.body.email).toBe('user@example.com');
    });
  });

  describe('validateRefreshRequest', () => {
    const validToken = 'a'.repeat(50);

    it('should call next for valid refreshToken', () => {
      const { req, res, next } = buildMocks({ body: { refreshToken: validToken } });
      validateRefreshRequest(req, res, next);
      expect(next).toHaveBeenCalled();
    });

    it('should return 400 when refreshToken is missing', () => {
      const { req, res, next } = buildMocks({ body: {} });
      validateRefreshRequest(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
      const body = res.json.mock.calls[0][0];
      expect(body.details).toContain('refreshToken is required');
    });

    it('should return 400 when refreshToken is too short (< 50 chars)', () => {
      const { req, res, next } = buildMocks({ body: { refreshToken: 'short' } });
      validateRefreshRequest(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
      const body = res.json.mock.calls[0][0];
      expect(body.details).toContain('Invalid refresh token format');
    });

    it('should return 400 when refreshToken is not a string', () => {
      const { req, res, next } = buildMocks({ body: { refreshToken: 12345 } });
      validateRefreshRequest(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe('validateTokenRequest', () => {
    const validToken = 'b'.repeat(50);

    it('should call next for valid token', () => {
      const { req, res, next } = buildMocks({ body: { token: validToken } });
      validateTokenRequest(req, res, next);
      expect(next).toHaveBeenCalled();
    });

    it('should return 400 when token is missing', () => {
      const { req, res, next } = buildMocks({ body: {} });
      validateTokenRequest(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
      const body = res.json.mock.calls[0][0];
      expect(body.details).toContain('token is required');
    });

    it('should return 400 when token is too short', () => {
      const { req, res, next } = buildMocks({ body: { token: 'tiny' } });
      validateTokenRequest(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe('validateEpisodeQuery', () => {
    it('should call next for valid query params', () => {
      const { req, res, next } = buildMocks({ query: { page: '1', limit: '10' } });
      validateEpisodeQuery(req, res, next);
      expect(next).toHaveBeenCalled();
    });

    it('should call next with no params (uses defaults)', () => {
      const { req, res, next } = buildMocks({ query: {} });
      validateEpisodeQuery(req, res, next);
      expect(next).toHaveBeenCalled();
    });

    it('should return 400 for non-numeric page', () => {
      const { req, res, next } = buildMocks({ query: { page: 'abc' } });
      validateEpisodeQuery(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
      const body = res.json.mock.calls[0][0];
      expect(body.details).toContain('page must be a number');
    });

    it('should return 400 for page < 1', () => {
      const { req, res, next } = buildMocks({ query: { page: '0' } });
      validateEpisodeQuery(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should return 400 for limit > 100', () => {
      const { req, res, next } = buildMocks({ query: { limit: '101' } });
      validateEpisodeQuery(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
      const body = res.json.mock.calls[0][0];
      expect(body.details).toContain('limit must be between 1 and 100');
    });

    it('should return 400 for limit < 1', () => {
      const { req, res, next } = buildMocks({ query: { limit: '0' } });
      validateEpisodeQuery(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should return 400 for invalid status value', () => {
      const { req, res, next } = buildMocks({ query: { status: 'invalid_status' } });
      validateEpisodeQuery(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
      const body = res.json.mock.calls[0][0];
      expect(body.details[0]).toContain('status must be one of');
    });

    it('should accept valid status values', () => {
      for (const status of ['draft', 'published', 'approved', 'pending']) {
        const { req, res, next } = buildMocks({ query: { status } });
        validateEpisodeQuery(req, res, next);
        expect(next).toHaveBeenCalled();
      }
    });

    it('should return 400 for search string too long (> 500 chars)', () => {
      const { req, res, next } = buildMocks({ query: { search: 'a'.repeat(501) } });
      validateEpisodeQuery(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should sanitize the search string', () => {
      const { req, res, next } = buildMocks({
        query: { search: '<script>alert(1)</script>clean' },
      });
      validateEpisodeQuery(req, res, next);
      expect(next).toHaveBeenCalled();
      expect(req.query.search).not.toContain('<script>');
    });
  });

  describe('validateUUIDParam', () => {
    it('should call next for valid UUID param', () => {
      const middleware = validateUUIDParam('id');
      const { req, res, next } = buildMocks({
        params: { id: '550e8400-e29b-41d4-a716-446655440000' },
      });
      middleware(req, res, next);
      expect(next).toHaveBeenCalled();
    });

    it('should call next for valid integer param', () => {
      const middleware = validateUUIDParam('id');
      const { req, res, next } = buildMocks({ params: { id: '42' } });
      middleware(req, res, next);
      expect(next).toHaveBeenCalled();
    });

    it('should return 400 for missing param', () => {
      const middleware = validateUUIDParam('id');
      const { req, res, next } = buildMocks({ params: {} });
      middleware(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should return 400 for invalid param format', () => {
      const middleware = validateUUIDParam('id');
      const { req, res, next } = buildMocks({ params: { id: 'invalid-param-not-uuid' } });
      middleware(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
      const body = res.json.mock.calls[0][0];
      expect(body.details[0]).toContain('id must be a valid UUID or integer ID');
    });

    it('should use the provided paramName', () => {
      const middleware = validateUUIDParam('episodeId');
      const { req, res, next } = buildMocks({ params: {} });
      middleware(req, res, next);
      const body = res.json.mock.calls[0][0];
      expect(body.details[0]).toContain('episodeId');
    });
  });

  describe('validateAssetUpload', () => {
    it('should call next for valid assetType', () => {
      const { req, res, next } = buildMocks({ body: { assetType: 'LALA_VIDEO' } });
      validateAssetUpload(req, res, next);
      expect(next).toHaveBeenCalled();
    });

    it('should return 400 when assetType is missing', () => {
      const { req, res, next } = buildMocks({ body: {} });
      validateAssetUpload(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
      const body = res.json.mock.calls[0][0];
      expect(body.details).toContain('assetType is required');
    });

    it('should return 400 for invalid assetType', () => {
      const { req, res, next } = buildMocks({ body: { assetType: 'NOT_A_TYPE' } });
      validateAssetUpload(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should accept all valid asset types', () => {
      const validTypes = [
        'PROMO_LALA', 'LALA_VIDEO', 'LALA_HEADSHOT', 'LALA_FULLBODY',
        'PROMO_JUSTAWOMANINHERPRIME', 'BRAND_LOGO', 'BRAND_BANNER', 'BRAND_SOCIAL',
        'PROMO_GUEST', 'GUEST_VIDEO', 'GUEST_HEADSHOT',
        'BACKGROUND_VIDEO', 'BACKGROUND_IMAGE', 'EPISODE_FRAME', 'PROMO_VIDEO', 'EPISODE_VIDEO',
        'CLOTHING_DRESS', 'CLOTHING_TOP', 'CLOTHING_BOTTOM', 'CLOTHING_SHOES',
        'CLOTHING_ACCESSORIES', 'CLOTHING_JEWELRY', 'CLOTHING_PERFUME',
      ];
      for (const assetType of validTypes) {
        const { req, res, next } = buildMocks({ body: { assetType } });
        validateAssetUpload(req, res, next);
        expect(next).toHaveBeenCalled();
      }
    });

    it('should call next when valid JSON string metadata is provided', () => {
      const { req, res, next } = buildMocks({
        body: { assetType: 'LALA_VIDEO', metadata: '{"key":"value"}' },
      });
      validateAssetUpload(req, res, next);
      expect(next).toHaveBeenCalled();
    });

    it('should call next when metadata is an object', () => {
      const { req, res, next } = buildMocks({
        body: { assetType: 'LALA_VIDEO', metadata: { key: 'value' } },
      });
      validateAssetUpload(req, res, next);
      expect(next).toHaveBeenCalled();
    });

    it('should return 400 for invalid JSON string metadata', () => {
      const { req, res, next } = buildMocks({
        body: { assetType: 'LALA_VIDEO', metadata: '{bad json}' },
      });
      validateAssetUpload(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
      const body = res.json.mock.calls[0][0];
      expect(body.details).toContain('Metadata must be valid JSON');
    });

    it('should return 400 when metadata is not an object or string', () => {
      const { req, res, next } = buildMocks({
        body: { assetType: 'LALA_VIDEO', metadata: 12345 },
      });
      validateAssetUpload(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
    });
  });
});
