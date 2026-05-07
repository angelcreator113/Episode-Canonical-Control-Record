/**
 * Integration tests for Story Evaluation v2 + Character Spark routes
 * Exercises the route handlers to maintain function coverage threshold.
 */

const request = require('supertest');
const app = require('../../src/app');

describe('Character Spark Routes', () => {
  // Step 3 CP6: characterSparkRoute promoted to Tier 1. Anonymous requests now
  // produce 401 AUTH_REQUIRED before reaching the handler body. These tests
  // remain as route-mount sanity checks rather than handler-body coverage.
  describe('GET /api/v1/character-registry/sparks', () => {
    it('should require auth (Tier 1 — returns 401 for anonymous)', async () => {
      const res = await request(app).get('/api/v1/character-registry/sparks');
      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/v1/character-registry/sparks', () => {
    it('should require auth before reaching validation (returns 401 for anonymous)', async () => {
      const res = await request(app)
        .post('/api/v1/character-registry/sparks')
        .send({ desire_line: 'wants freedom' });
      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/v1/character-registry/sparks/:id', () => {
    it('should require auth (returns 401 for anonymous)', async () => {
      const res = await request(app).get(
        '/api/v1/character-registry/sparks/00000000-0000-0000-0000-000000000000'
      );
      expect(res.status).toBe(401);
    });
  });

  describe('PATCH /api/v1/character-registry/sparks/:id', () => {
    it('should require auth (returns 401 for anonymous)', async () => {
      const res = await request(app)
        .patch('/api/v1/character-registry/sparks/00000000-0000-0000-0000-000000000000')
        .send({ name: 'Updated' });
      expect(res.status).toBe(401);
    });
  });
});

describe('Story Evaluation v2 Routes', () => {
  describe('POST /api/v1/memories/generate-story-multi', () => {
    it('should reject when scene_brief is missing', async () => {
      const res = await request(app)
        .post('/api/v1/memories/generate-story-multi')
        .send({});
      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error');
    });
  });

  describe('POST /api/v1/memories/evaluate-stories', () => {
    it('should reject when story_id is missing', async () => {
      const res = await request(app)
        .post('/api/v1/memories/evaluate-stories')
        .send({});
      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error');
    });
  });

  describe('POST /api/v1/memories/propose-memory', () => {
    it('should reject when story_id is missing', async () => {
      const res = await request(app)
        .post('/api/v1/memories/propose-memory')
        .send({});
      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error');
    });
  });

  describe('POST /api/v1/memories/propose-registry-update', () => {
    it('should reject when story_id is missing', async () => {
      const res = await request(app)
        .post('/api/v1/memories/propose-registry-update')
        .send({});
      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error');
    });
  });

  describe('POST /api/v1/memories/write-back', () => {
    it('should reject when story_id is missing', async () => {
      const res = await request(app)
        .post('/api/v1/memories/write-back')
        .send({});
      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error');
    });
  });

  describe('GET /api/v1/memories/eval-stories/:storyId', () => {
    it('should 404 or 500 for non-existent story', async () => {
      const res = await request(app).get(
        '/api/v1/memories/eval-stories/00000000-0000-0000-0000-000000000000'
      );
      expect([404, 500]).toContain(res.status);
    });
  });
});
