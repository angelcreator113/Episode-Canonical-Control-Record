// ============================================================================
// UNIT TESTS — undergroundRoutes.js (Step 3 CP8 — router.use migration, no AI)
// ============================================================================
// 3 handlers gated by router.use(requireAuth). No AI POSTs.

const fs = require('fs');
const path = require('path');

const SRC = fs.readFileSync(path.join(__dirname, '..', '..', '..', 'src', 'routes', 'undergroundRoutes.js'), 'utf8');

describe('Step 3 CP8 — undergroundRoutes.js router.use migration', () => {
  test('imports requireAuth (no aiRateLimiter — no AI POSTs)', () => {
    expect(SRC).toMatch(/const\s*\{\s*requireAuth\s*\}\s*=\s*require\(['"]\.\.\/middleware\/auth['"]\)/);
  });

  test('router.use(requireAuth) gates the entire router', () => {
    expect(SRC).toMatch(/router\.use\(requireAuth\)/);
  });

  describe('All 3 handlers inherit auth from router.use', () => {
    [['put', '/:id/visibility'], ['get', '/feed'], ['get', '/underground']].forEach(([verb, route]) => {
      test(`${verb.toUpperCase()} ${route} has no inline middleware`, () => {
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
