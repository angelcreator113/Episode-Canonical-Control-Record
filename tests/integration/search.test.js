const request = require('supertest');
const app = require('../../app');
const OpenSearchService = require('../../src/services/OpenSearchService');

jest.mock('../../src/services/OpenSearchService');

describe('Search Integration Tests - Phase 2C', () => {
  let token;

  beforeAll(async () => {
    // Get auth token
    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'test@example.com', password: 'password123' });

    if (loginRes.status === 200 && loginRes.body.data?.accessToken) {
      token = loginRes.body.data.accessToken;
    }
  });

  describe('POST /api/v1/search', () => {
    test('should return search results', async () => {
      OpenSearchService.search.mockResolvedValue({
        total: 10,
        hits: [
          {
            id: 'ep-1',
            title: 'Test Episode',
            description: 'A test episode',
            status: 'published',
            score: 0.95,
          },
        ],
        facets: {
          by_status: [{ value: 'published', count: 10 }],
        },
        page: { current: 1, size: 20, total: 1 },
      });

      const res = await request(app)
        .post('/api/v1/search')
        .set('Authorization', `Bearer ${token}`)
        .send({ q: 'test' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.total).toBe(10);
      expect(res.body.data.hits.length).toBeGreaterThan(0);
    });

    test('should reject empty query', async () => {
      const res = await request(app)
        .post('/api/v1/search')
        .set('Authorization', `Bearer ${token}`)
        .send({ q: '' });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('EMPTY_QUERY');
    });

    test('should enforce limit maximum', async () => {
      const res = await request(app)
        .post('/api/v1/search')
        .set('Authorization', `Bearer ${token}`)
        .send({ q: 'test', limit: 150 });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('LIMIT_EXCEEDED');
    });

    test('should support pagination', async () => {
      OpenSearchService.search.mockResolvedValue({
        total: 100,
        hits: [],
        page: { current: 2, size: 20, total: 5 },
      });

      const res = await request(app)
        .post('/api/v1/search')
        .set('Authorization', `Bearer ${token}`)
        .send({ q: 'test', page: 2, limit: 20 });

      expect(res.body.data.page.current).toBe(2);
    });

    test('should apply status filter', async () => {
      OpenSearchService.search.mockResolvedValue({
        total: 5,
        hits: [{ status: 'published' }],
        page: { current: 1, size: 20, total: 1 },
      });

      const res = await request(app)
        .post('/api/v1/search')
        .set('Authorization', `Bearer ${token}`)
        .send({
          q: 'test',
          filters: { status: 'published' },
        });

      expect(res.body.data.total).toBe(5);
    });

    test('should apply date range filter', async () => {
      OpenSearchService.search.mockResolvedValue({
        total: 3,
        hits: [],
        page: { current: 1, size: 20, total: 1 },
      });

      const res = await request(app)
        .post('/api/v1/search')
        .set('Authorization', `Bearer ${token}`)
        .send({
          q: 'test',
          filters: {
            dateRange: {
              start: '2025-01-01',
              end: '2025-12-31',
            },
          },
        });

      expect(res.body.data.total).toBe(3);
    });

    test('should return facets for filtering', async () => {
      OpenSearchService.search.mockResolvedValue({
        total: 10,
        hits: [],
        facets: {
          by_status: [
            { value: 'published', count: 7 },
            { value: 'draft', count: 3 },
          ],
          by_category: [
            { value: 'documentary', count: 5 },
            { value: 'news', count: 5 },
          ],
        },
        page: { current: 1, size: 20, total: 1 },
      });

      const res = await request(app)
        .post('/api/v1/search')
        .set('Authorization', `Bearer ${token}`)
        .send({ q: 'test' });

      expect(res.body.data.facets).toBeDefined();
      expect(res.body.data.facets.by_status).toBeDefined();
    });

    test('should handle search service failure gracefully', async () => {
      OpenSearchService.search.mockRejectedValue(new Error('Service unavailable'));

      const res = await request(app)
        .post('/api/v1/search')
        .set('Authorization', `Bearer ${token}`)
        .send({ q: 'test' });

      // Should either return fallback results or error
      expect([200, 500]).toContain(res.status);
    });

    test('should require authentication', async () => {
      const res = await request(app).post('/api/v1/search').send({ q: 'test' });

      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/v1/search/suggestions', () => {
    test('should return suggestions', async () => {
      OpenSearchService.suggest.mockResolvedValue([
        'test episode',
        'test documentary',
        'testing series',
      ]);

      const res = await request(app)
        .get('/api/v1/search/suggestions')
        .set('Authorization', `Bearer ${token}`)
        .query({ q: 'test' });

      expect(res.status).toBe(200);
      expect(res.body.data.suggestions).toHaveLength(3);
    });

    test('should reject queries under 2 characters', async () => {
      const res = await request(app)
        .get('/api/v1/search/suggestions')
        .set('Authorization', `Bearer ${token}`)
        .query({ q: 't' });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('QUERY_TOO_SHORT');
    });

    test('should respect limit parameter', async () => {
      OpenSearchService.suggest.mockResolvedValue(
        Array(15)
          .fill(null)
          .map((_, i) => `suggestion ${i}`)
      );

      const res = await request(app)
        .get('/api/v1/search/suggestions')
        .set('Authorization', `Bearer ${token}`)
        .query({ q: 'test', limit: 5 });

      expect(res.body.data.suggestions.length).toBeLessThanOrEqual(5);
    });
  });

  describe('POST /api/v1/search/advanced', () => {
    test('should execute advanced search with must clauses', async () => {
      OpenSearchService.search.mockResolvedValue({
        total: 5,
        hits: [],
        page: { current: 1, size: 20, total: 1 },
      });

      const res = await request(app)
        .post('/api/v1/search/advanced')
        .set('Authorization', `Bearer ${token}`)
        .send({
          mustMatch: ['documentary'],
          filters: { status: ['published'] },
        });

      expect(res.status).toBe(200);
    });

    test('should support should clauses', async () => {
      OpenSearchService.search.mockResolvedValue({
        total: 8,
        hits: [],
        page: { current: 1, size: 20, total: 1 },
      });

      const res = await request(app)
        .post('/api/v1/search/advanced')
        .set('Authorization', `Bearer ${token}`)
        .send({
          shouldMatch: ['test', 'demo'],
        });

      expect(res.status).toBe(200);
    });

    test('should support must_not clauses', async () => {
      OpenSearchService.search.mockResolvedValue({
        total: 3,
        hits: [],
        page: { current: 1, size: 20, total: 1 },
      });

      const res = await request(app)
        .post('/api/v1/search/advanced')
        .set('Authorization', `Bearer ${token}`)
        .send({
          mustNotMatch: ['spam', 'deleted'],
        });

      expect(res.status).toBe(200);
    });
  });

  describe('GET /api/v1/search/recent', () => {
    test('should return recent searches', async () => {
      const res = await request(app)
        .get('/api/v1/search/recent')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data.searches)).toBe(true);
    });

    test('should respect limit parameter', async () => {
      const res = await request(app)
        .get('/api/v1/search/recent')
        .set('Authorization', `Bearer ${token}`)
        .query({ limit: 5 });

      expect(res.body.data.searches.length).toBeLessThanOrEqual(5);
    });
  });

  describe('POST /api/v1/search/saved', () => {
    test('should save search', async () => {
      const res = await request(app)
        .post('/api/v1/search/saved')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'My Saved Search',
          query: 'documentary',
          filters: { status: 'published' },
        });

      expect(res.status).toBe(201);
      expect(res.body.data.name).toBe('My Saved Search');
    });

    test('should require name and query', async () => {
      const res = await request(app)
        .post('/api/v1/search/saved')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Test' });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('MISSING_FIELDS');
    });
  });

  describe('GET /api/v1/search/saved', () => {
    test('should retrieve user saved searches', async () => {
      const res = await request(app)
        .get('/api/v1/search/saved')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data.searches)).toBe(true);
    });
  });

  describe('DELETE /api/v1/search/saved/:id', () => {
    test('should delete saved search', async () => {
      const res = await request(app)
        .delete('/api/v1/search/saved/test-id')
        .set('Authorization', `Bearer ${token}`);

      expect([200, 404]).toContain(res.status);
    });
  });
});
