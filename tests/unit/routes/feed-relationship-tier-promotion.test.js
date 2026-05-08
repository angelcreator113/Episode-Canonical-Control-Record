// ============================================================================
// UNIT TESTS — feedRelationshipRoutes.js (Step 3 CP8 — router.use migration)
// ============================================================================
// 8 handlers gated by router.use(requireAuth).
// 2 service-mediated AI POSTs aiRateLimiter inline (auto-generate, generate-ripples).

const fs = require('fs');
const path = require('path');

const SRC = fs.readFileSync(path.join(__dirname, '..', '..', '..', 'src', 'routes', 'feedRelationshipRoutes.js'), 'utf8');

describe('Step 3 CP8 — feedRelationshipRoutes.js router.use migration', () => {
  test('imports requireAuth + aiRateLimiter', () => {
    expect(SRC).toMatch(/const\s*\{\s*requireAuth\s*\}\s*=\s*require\(['"]\.\.\/middleware\/auth['"]\)/);
    expect(SRC).toMatch(/const\s*\{\s*aiRateLimiter\s*\}\s*=\s*require\(['"]\.\.\/middleware\/aiRateLimiter['"]\)/);
  });

  test('router.use(requireAuth) gates the entire router', () => {
    expect(SRC).toMatch(/router\.use\(requireAuth\)/);
  });

  describe('Service-mediated AI POSTs (2)', () => {
    test('POST /auto-generate carries aiRateLimiter inline', () => {
      expect(SRC).toMatch(/router\.post\('\/auto-generate',\s*aiRateLimiter,\s*async/);
    });
    test('POST /:id/generate-ripples carries aiRateLimiter inline', () => {
      expect(SRC).toMatch(/router\.post\('\/:id\/generate-ripples',\s*aiRateLimiter,\s*async/);
    });
  });

  describe('Non-AI handlers (6) inherit auth, no inline aiRateLimiter', () => {
    [['get', '/'], ['post', '/'], ['put', '/:id'], ['delete', '/:id'], ['get', '/canvas'], ['get', '/profiles']].forEach(([verb, route]) => {
      test(`${verb.toUpperCase()} ${route} has no inline aiRateLimiter`, () => {
        const escaped = route.replace(/\//g, '\\/');
        const re = new RegExp(`router\\.${verb}\\('${escaped}',\\s*async`);
        expect(SRC).toMatch(re);
      });
    });
  });

  test('no optionalAuth references remain', () => {
    expect(SRC).not.toMatch(/\boptionalAuth\b/);
  });
});
