// ============================================================================
// EXAMPLE UNIT TEST
// ============================================================================
// Tests for core application functionality
// Run with: npm run test:unit

describe('Health Check Endpoint', () => {
  let app;

  beforeAll(() => {
    app = require('../../src/app');
  });

  it('should return healthy status', (done) => {
    const request = require('supertest');
    request(app)
      .get('/health')
      .expect(200)
      .expect((res) => {
        expect(res.body).toHaveProperty('status', 'healthy');
        expect(res.body).toHaveProperty('timestamp');
        expect(res.body).toHaveProperty('version');
      })
      .end(done);
  });
});
