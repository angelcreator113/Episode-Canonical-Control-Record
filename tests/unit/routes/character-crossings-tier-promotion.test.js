// ============================================================================
// UNIT TESTS — characterCrossingRoutes.js (Step 3 CP6 — router.use migration)
// ============================================================================
// 6 handlers (surface-correction: not 7) gated by router.use(requireAuth).
// 1 AI POST (/:id/propose-gap) gets aiRateLimiter inline.

const fs = require('fs');
const path = require('path');

const SRC = fs.readFileSync(path.join(__dirname, '..', '..', '..', 'src', 'routes', 'characterCrossingRoutes.js'), 'utf8');

describe('Step 3 CP6 — characterCrossingRoutes.js router.use migration', () => {
  test('imports requireAuth + aiRateLimiter', () => {
    expect(SRC).toMatch(/const\s*\{\s*requireAuth,\s*authorize\s*\}\s*=\s*require\(['"]\.\.\/middleware\/auth['"]\)/);
    expect(SRC).toMatch(/const\s*\{\s*aiRateLimiter\s*\}\s*=\s*require\(['"]\.\.\/middleware\/aiRateLimiter['"]\)/);
  });

  test('router.use(requireAuth) at the top of the router', () => {
    expect(SRC).toMatch(/router\.use\(requireAuth\)/);
  });

  test('AI POST /:id/propose-gap carries aiRateLimiter inline', () => {
    expect(SRC).toMatch(/router\.post\('\/:id\/propose-gap',\s*aiRateLimiter,\s*async/);
  });

  // Production reads are an ADMIN's since 2026-11-15 (character privacy; tests/integration/characterReadPrivacy).
  describe('Non-AI handlers (5) inherit auth, no inline aiRateLimiter; the reads are ADMIN', () => {
    [['get', '/'], ['post', '/'], ['put', '/:id'], ['put', '/:id/confirm-gap'], ['get', '/tracker']].forEach(([verb, route]) => {
      test(`${verb.toUpperCase()} ${route} has no inline aiRateLimiter`, () => {
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
