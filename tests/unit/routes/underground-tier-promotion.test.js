// ============================================================================
// UNIT TESTS — undergroundRoutes.js (Step 3 CP8 — router.use migration, no AI)
// ============================================================================
// 3 handlers gated by router.use(requireAuth). No AI POSTs.

const fs = require('fs');
const path = require('path');

const SRC = fs.readFileSync(path.join(__dirname, '..', '..', '..', 'src', 'routes', 'undergroundRoutes.js'), 'utf8');

describe('Step 3 CP8 — undergroundRoutes.js router.use migration', () => {
  test('imports requireAuth (no aiRateLimiter — no AI POSTs)', () => {
    expect(SRC).toMatch(/const\s*\{\s*requireAuth,\s*authorize\s*\}\s*=\s*require\(['"]\.\.\/middleware\/auth['"]\)/);
  });

  test('router.use(requireAuth) gates the entire router', () => {
    expect(SRC).toMatch(/router\.use\(requireAuth\)/);
  });

  // Production reads are an ADMIN's since 2026-11-15 (character privacy; tests/integration/characterReadPrivacy).
  describe('All 3 handlers inherit auth from router.use; the reads are ADMIN', () => {
    [['put', '/:id/visibility'], ['get', '/feed'], ['get', '/underground']].forEach(([verb, route]) => {
      test(`${verb.toUpperCase()} ${route} ${verb === 'get' ? 'is ADMIN only' : 'has no inline middleware'}`, () => {
        const escaped = route.replace(/\//g, '\\/');
        const admin = verb === 'get' ? "\\s*authorize\\(\\['ADMIN'\\]\\)," : '';
        const re = new RegExp(`router\\.${verb}\\('${escaped}',${admin}\\s*async`);
        expect(SRC).toMatch(re);
      });
    });
  });

  test('no optionalAuth references remain', () => {
    expect(SRC).not.toMatch(/\boptionalAuth\b/);
  });
});
