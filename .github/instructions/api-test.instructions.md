---
description: "Use when writing tests for Express routes, API endpoint tests, or route-health validation. Covers Jest patterns, auth mocking, and response assertions for this project."
applyTo: "tests/**"
---
# API Testing Guidelines

## Test File Structure
```javascript
const request = require('supertest');
const app = require('../../app');

describe('Route Group Name', () => {
  describe('GET /api/v1/memories/endpoint', () => {
    it('returns 200 with valid response', async () => {
      const res = await request(app)
        .get('/api/v1/memories/endpoint')
        .expect(200);
      
      expect(res.body).toHaveProperty('expectedField');
    });
  });
});
```

## Auth Patterns

### Testing with optionalAuth
Most routes use `optionalAuth` — test both authenticated and unauthenticated:
```javascript
// Unauthenticated request (should still work)
await request(app).get('/api/v1/memories/public-endpoint');

// Authenticated request (use test token)
await request(app)
  .get('/api/v1/memories/endpoint')
  .set('Authorization', `Bearer ${testToken}`);
```

### Mocking Auth
```javascript
jest.mock('../../src/middleware/auth', () => ({
  optionalAuth: (req, res, next) => {
    req.user = { id: 'test-user-id' };
    next();
  }
}));
```

## Response Assertions

### JSON Responses
```javascript
expect(res.body).toMatchObject({
  success: true,
  data: expect.any(Object)
});
```

### SSE Streaming Responses
```javascript
const res = await request(app)
  .get('/api/v1/memories/stream-endpoint')
  .expect('Content-Type', /text\/event-stream/);
```

### Error Responses
```javascript
await request(app)
  .get('/api/v1/memories/bad-endpoint')
  .expect(400)
  .expect(res => {
    expect(res.body.error).toBeDefined();
  });
```

## Database Considerations
- Tests run against real Neon DB (test schema recommended)
- Use transactions or cleanup in `afterEach`
- Character IDs: use known test characters or create in `beforeAll`

## Key Test Locations
- `tests/routes/` — route-specific tests
- `tests/integration/` — cross-route tests
- `tests/route-health.test.js` — basic endpoint availability

## Run Commands
```bash
npm test                    # All tests with coverage
npm test -- --testPathPattern=route-health  # Specific test file
npm run validate            # Includes route-health in validation
```
