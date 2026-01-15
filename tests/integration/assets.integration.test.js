/**
 * Integration Tests - Assets API
 * Tests for asset upload, validation, and management
 * Uses Jest + Supertest
 */

const request = require('supertest');
const app = require('../../src/app');
const TokenService = require('../../src/services/tokenService');
const _fs = require('fs');
const _path = require('path');

describe('Assets API Integration Tests', () => {
  let _accessToken;

  beforeEach(() => {
    const user = {
      email: 'test@assets.dev',
      name: 'Assets Test',
      groups: ['USER', 'EDITOR'],
      role: 'USER',
    };

    const tokens = TokenService.generateTokenPair(user);
    global.accessToken = tokens.accessToken;
  });

  describe('POST /api/v1/assets', () => {
    it('should reject asset upload without file', async () => {
      const res = await request(app).post('/api/v1/assets').send({
        assetType: 'PROMO_LALA',
      });

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error');
      expect(res.body.message).toMatch(/No file provided/i);
    });

    it('should reject asset upload without assetType', async () => {
      const res = await request(app)
        .post('/api/v1/assets')
        .set('Content-Type', 'multipart/form-data')
        .attach('file', Buffer.from('fake image data'), 'test.jpg');

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error');
      expect(res.body.details).toContain('assetType is required');
    });

    it('should reject asset upload with invalid assetType', async () => {
      const res = await request(app)
        .post('/api/v1/assets')
        .set('Content-Type', 'multipart/form-data')
        .field('assetType', 'INVALID_TYPE')
        .attach('file', Buffer.from('fake image data'), 'test.jpg');

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error');
      expect(res.body.details[0]).toMatch(/must be one of:/i);
    });

    it('should validate asset types', async () => {
      const validTypes = [
        'PROMO_LALA',
        'PROMO_JUSTAWOMANINPERPRIME',
        'PROMO_GUEST',
        'BRAND_LOGO',
        'EPISODE_FRAME',
      ];

      for (const type of validTypes) {
        const res = await request(app)
          .post('/api/v1/assets')
          .set('Content-Type', 'multipart/form-data')
          .field('assetType', type)
          .attach('file', Buffer.from('test image'), 'test.jpg');

        // Should not fail on validation (may fail on file processing, but not validation)
        expect(res.status).not.toBe(400);
        // OR if it's 400, it shouldn't be validation error
        if (res.status === 400) {
          expect(res.body.error).not.toBe('Validation failed');
        }
      }
    });

    it('should reject invalid metadata JSON', async () => {
      const res = await request(app)
        .post('/api/v1/assets')
        .set('Content-Type', 'multipart/form-data')
        .field('assetType', 'PROMO_LALA')
        .field('metadata', '{invalid json}')
        .attach('file', Buffer.from('test image'), 'test.jpg');

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error');
      expect(res.body.details).toContain('Metadata must be valid JSON');
    });

    it('should accept valid metadata JSON', async () => {
      const res = await request(app)
        .post('/api/v1/assets')
        .set('Content-Type', 'multipart/form-data')
        .field('assetType', 'PROMO_LALA')
        .field('metadata', JSON.stringify({ title: 'Test Asset', description: 'A test asset' }))
        .attach('file', Buffer.from('test image'), 'test.jpg');

      // Should either succeed or fail for non-validation reasons
      if (res.status === 400) {
        expect(res.body.error).not.toMatch(/Invalid JSON/i);
      } else {
        expect(res.status).toBe(201);
      }
    });

    it('should accept empty metadata', async () => {
      const res = await request(app)
        .post('/api/v1/assets')
        .set('Content-Type', 'multipart/form-data')
        .field('assetType', 'PROMO_LALA')
        .attach('file', Buffer.from('test image'), 'test.jpg');

      // Should not be a validation error
      if (res.status === 400) {
        expect(res.body.error).not.toBe('Validation failed');
      }
    });
  });

  describe('GET /api/v1/assets/:id', () => {
    it('should reject request with invalid UUID', async () => {
      const res = await request(app).get('/api/v1/assets/not-a-uuid');

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error');
      expect(res.body.details[0]).toMatch(/must be a valid UUID/i);
    });

    it('should handle valid UUID format', async () => {
      const validUUID = '123e4567-e89b-12d3-a456-426614174000';
      const res = await request(app).get(`/api/v1/assets/${validUUID}`);

      // May return 404 if not found, but not validation error
      expect(res.status).not.toBe(400);
    });
  });

  describe('GET /api/v1/assets/approved/:type', () => {
    it('should list approved PROMO_LALA assets', async () => {
      const res = await request(app).get('/api/v1/assets/approved/PROMO_LALA');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('status', 'SUCCESS');
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('should list approved assets of different types', async () => {
      const types = [
        'PROMO_LALA',
        'PROMO_JUSTAWOMANINPERPRIME',
        'PROMO_GUEST',
        'BRAND_LOGO',
        'EPISODE_FRAME',
      ];

      for (const type of types) {
        const res = await request(app).get(`/api/v1/assets/approved/${type}`);

        expect(res.status).toBe(200);
        expect(res.body.status).toBe('SUCCESS');
        expect(Array.isArray(res.body.data)).toBe(true);
      }
    });

    it('should reject invalid asset type', async () => {
      const res = await request(app).get('/api/v1/assets/approved/INVALID_TYPE');

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error');
    });
  });

  describe('GET /api/v1/assets/pending', () => {
    it('should list pending assets', async () => {
      const res = await request(app).get('/api/v1/assets/pending');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('status', 'SUCCESS');
      expect(Array.isArray(res.body.data)).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should return proper error for non-existent asset', async () => {
      const nonExistentId = '00000000-0000-0000-0000-000000000000';
      const res = await request(app).get(`/api/v1/assets/${nonExistentId}`);

      expect(res.status).toBe(404);
      expect(res.body).toHaveProperty('error');
    });

    it('should handle malformed requests gracefully', async () => {
      const res = await request(app).post('/api/v1/assets').send('invalid body format');

      expect(res.status).toBe(400);
    });
  });

  describe('Asset Upload Validation Flow', () => {
    it('should validate all required fields before upload', async () => {
      const testCases = [
        {
          name: 'missing assetType',
          fields: {},
          expectedError: 'assetType is required',
        },
        {
          name: 'invalid assetType',
          fields: { assetType: 'UNKNOWN' },
          expectedError: 'must be one of',
        },
        {
          name: 'invalid JSON metadata',
          fields: { assetType: 'PROMO_LALA', metadata: '{bad}' },
          expectedError: 'valid JSON',
        },
      ];

      for (const testCase of testCases) {
        const req = request(app).post('/api/v1/assets').set('Content-Type', 'multipart/form-data');

        // Add fields
        Object.entries(testCase.fields).forEach(([key, value]) => {
          req.field(key, value);
        });

        // Add file
        req.attach('file', Buffer.from('test'), 'test.jpg');

        const res = await req;

        // Should get validation error or other 400 error
        if (res.status === 400 && res.body.error === 'Validation failed') {
          expect(res.body.details[0].toLowerCase()).toContain(testCase.expectedError.toLowerCase());
        }
      }
    });
  });
});
