// ============================================================================
// UNIT TESTS — feedRelationshipRoutes.js (Step 3 CP8 — router.use migration)
// ============================================================================
// 7 handlers gated by router.use(requireAuth).
// 1 service-mediated AI POST aiRateLimiter inline (generate-ripples).
// Suggested pairs (2026-10-17): POST /suggestions ADMIN + aiRateLimiter;
// keep and dismiss ADMIN.
// POST /auto-generate was removed with Task #3115: the map edits The Pulse's
// own table, so there is nothing left to copy.

const fs = require('fs');
const path = require('path');

const SRC = fs.readFileSync(path.join(__dirname, '..', '..', '..', 'src', 'routes', 'feedRelationshipRoutes.js'), 'utf8');

describe('Step 3 CP8 — feedRelationshipRoutes.js router.use migration', () => {
  test('imports requireAuth + aiRateLimiter', () => {
    expect(SRC).toMatch(/const\s*\{\s*requireAuth(\s*,\s*authorize)?\s*\}\s*=\s*require\(['"]\.\.\/middleware\/auth['"]\)/);
    expect(SRC).toMatch(/const\s*\{\s*aiRateLimiter\s*\}\s*=\s*require\(['"]\.\.\/middleware\/aiRateLimiter['"]\)/);
  });

  test('suggested pairs: making, keeping and dismissing them is ADMIN only; suggesting is rate-limited (2026-10-17)', () => {
    expect(SRC).toMatch(/router\.post\('\/suggestions',\s*authorize\(\['ADMIN'\]\),\s*aiRateLimiter,/);
    expect(SRC).toMatch(/router\.post\('\/suggestions\/:key\/keep',\s*authorize\(\['ADMIN'\]\),/);
    expect(SRC).toMatch(/router\.post\('\/suggestions\/:key\/dismiss',\s*authorize\(\['ADMIN'\]\),/);
  });

  test('router.use(requireAuth) gates the entire router', () => {
    expect(SRC).toMatch(/router\.use\(requireAuth\)/);
  });

  describe('Service-mediated AI POSTs (1)', () => {
    test('POST /auto-generate is gone (Task #3115)', () => {
      expect(SRC).not.toMatch(/auto-generate/);
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
