/**
 * Integration Tests - Episodes API
 * Tests for episode listing, filtering, and detail retrieval
 * Uses Jest + Supertest
 */

const request = require('supertest');
const app = require('../../src/app');
const TokenService = require('../../src/services/tokenService');

// Skip integration tests if using production database
const shouldSkip = process.env.DATABASE_URL?.includes('amazonaws.com');

(shouldSkip ? describe.skip : describe)('Episodes API Integration Tests', () => {
  let _accessToken;

  beforeEach(() => {
    const user = {
      email: 'test@episodes.dev',
      name: 'Episodes Test',
      groups: ['USER', 'EDITOR'],
      role: 'USER',
    };

    const tokens = TokenService.generateTokenPair(user);
    global.accessToken = tokens.accessToken;
  });

  describe('GET /api/v1/episodes', () => {
    it('should list episodes with pagination', async () => {
      const res = await request(app).get('/api/v1/episodes').query({ page: 1, limit: 10 });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('data');
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body).toHaveProperty('pagination');
    });

    it('should reject invalid page parameter', async () => {
      const res = await request(app).get('/api/v1/episodes').query({ page: 'invalid', limit: 10 });

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error');
      expect(res.body.details).toContain('page must be a number');
    });

    it('should reject invalid limit parameter', async () => {
      const res = await request(app).get('/api/v1/episodes').query({ page: 1, limit: 200 });

      expect(res.status).toBe(400);
      expect(res.body.details[0]).toMatch(/limit must be between 1 and 100/i);
    });

    it('should reject page less than 1', async () => {
      const res = await request(app).get('/api/v1/episodes').query({ page: 0, limit: 10 });

      expect(res.status).toBe(400);
      expect(res.body.details).toContain('page must be >= 1');
    });

    it('should filter by status', async () => {
      const res = await request(app)
        .get('/api/v1/episodes')
        .set('Authorization', `Bearer ${global.accessToken}`)
        .query({ status: 'approved', page: 1, limit: 10 });

      expect(res.status).toBe(200);
      if (res.body.data.length > 0) {
        res.body.data.forEach((episode) => {
          expect(episode.status?.toLowerCase()).toBe('approved');
        });
      }
    });

    it('should reject invalid status filter', async () => {
      const res = await request(app).get('/api/v1/episodes').query({ status: 'invalid_status' });

      expect(res.status).toBe(400);
      expect(res.body.details[0]).toMatch(/status must be one of:/i);
    });

    it('should search by title/description', async () => {
      const res = await request(app)
        .get('/api/v1/episodes')
        .query({ search: 'test', page: 1, limit: 10 });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('data');
    });

    it('should reject search string that is too long', async () => {
      const longSearch = 'a'.repeat(501);
      const res = await request(app).get('/api/v1/episodes').query({ search: longSearch });

      expect(res.status).toBe(400);
      expect(res.body.details).toContain('search is too long (max 500 characters)');
    });

    it('should handle multiple query parameters together', async () => {
      const res = await request(app).get('/api/v1/episodes').query({
        page: 2,
        limit: 20,
        status: 'approved',
        search: 'episode',
      });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('data');
      expect(res.body).toHaveProperty('pagination');
    });
  });

  describe('GET /api/v1/episodes/:id', () => {
    it('should reject request with invalid UUID format', async () => {
      const res = await request(app).get('/api/v1/episodes/invalid-id');

      expect(res.status).toBe(400);
      expect(res.body.details[0]).toMatch(/must be a valid UUID/i);
    });

    it('should handle request with valid UUID format', async () => {
      const validUUID = '123e4567-e89b-12d3-a456-426614174000';
      const res = await request(app).get(`/api/v1/episodes/${validUUID}`);

      // May return 404 if episode doesn't exist, but shouldn't be validation error
      expect(res.status).not.toBe(400);
      expect(res.body).not.toHaveProperty('details');
    });

    it('should return episode details if found', async () => {
      // First, get an episode from the list
      const listRes = await request(app).get('/api/v1/episodes').query({ limit: 1 });

      if (listRes.body.data.length > 0) {
        const episodeId = listRes.body.data[0].id;
        const res = await request(app).get(`/api/v1/episodes/${episodeId}`);

        expect(res.status).toBe(200);
        expect(res.body.data.id).toBe(episodeId);
        expect(res.body.data).toHaveProperty('title');
        expect(res.body.data).toHaveProperty('status');
      }
    });
  });

  describe('End-to-End Episode Workflow', () => {
    it('should complete full episode viewing workflow', async () => {
      // 1. List episodes
      const listRes = await request(app).get('/api/v1/episodes').query({ page: 1, limit: 10 });

      expect(listRes.status).toBe(200);
      expect(Array.isArray(listRes.body.data)).toBe(true);

      if (listRes.body.data.length > 0) {
        const episode = listRes.body.data[0];

        // 2. Get episode details
        const detailRes = await request(app).get(`/api/v1/episodes/${episode.id}`);

        expect(detailRes.status).toBe(200);
        expect(detailRes.body.data.id).toBe(episode.id);
        expect(detailRes.body.data).toHaveProperty('title');
        expect(detailRes.body.data).toHaveProperty('status');
        expect(detailRes.body.data).toHaveProperty('created_at');
      }
    });

    it('should filter and browse episodes', async () => {
      // Get approved episodes
      const approvedRes = await request(app)
        .get('/api/v1/episodes')
        .set('Authorization', `Bearer ${global.accessToken}`)
        .query({ status: 'approved', page: 1, limit: 5 });

      expect(approvedRes.status).toBe(200);

      // Get pending episodes
      const pendingRes = await request(app)
        .get('/api/v1/episodes')
        .set('Authorization', `Bearer ${global.accessToken}`)
        .query({ status: 'pending', page: 1, limit: 5 });

      expect(pendingRes.status).toBe(200);

      // Both requests should succeed regardless of count
      expect(approvedRes.body).toHaveProperty('pagination');
      expect(pendingRes.body).toHaveProperty('pagination');
    });
  });

  describe('Error Handling', () => {
    it('should return proper error for non-existent episode', async () => {
      const nonExistentId = '00000000-0000-0000-0000-000000000000';
      const res = await request(app).get(`/api/v1/episodes/${nonExistentId}`);

      expect(res.status).toBe(404);
      expect(res.body).toHaveProperty('error');
    });

    it('should handle database errors gracefully', async () => {
      // Attempt malformed query should still be caught
      const res = await request(app).get('/api/v1/episodes').query({ page: -1 });

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error');
    });
  });
});
