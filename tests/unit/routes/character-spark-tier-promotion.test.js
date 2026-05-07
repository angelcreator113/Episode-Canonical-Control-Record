// ============================================================================
// UNIT TESTS — characterSparkRoute.js (Step 3 CP6 — PROMOTE shape)
// ============================================================================
// 5 handlers all promoted to Tier 1.
// 1 AI POST (/sparks/:id/prefill) gets aiRateLimiter.
// Lazy-noop fallback at L23-28 removed.
// Mount-collision compliance: this file is co-mounted at /api/v1/character-registry
// alongside characterRegistry.js per app.js:1120 (Collision A — CP2-shape).

const fs = require('fs');
const path = require('path');

const SRC = fs.readFileSync(path.join(__dirname, '..', '..', '..', 'src', 'routes', 'characterSparkRoute.js'), 'utf8');

describe('Step 3 CP6 — characterSparkRoute.js PROMOTE shape', () => {
  test('imports requireAuth + aiRateLimiter', () => {
    expect(SRC).toMatch(/const\s*\{\s*requireAuth\s*\}\s*=\s*require\(['"]\.\.\/middleware\/auth['"]\)/);
    expect(SRC).toMatch(/const\s*\{\s*aiRateLimiter\s*\}\s*=\s*require\(['"]\.\.\/middleware\/aiRateLimiter['"]\)/);
  });

  describe('Non-AI handlers (4 — requireAuth only)', () => {
    [['post', '/sparks'], ['get', '/sparks'], ['get', '/sparks/:id'], ['patch', '/sparks/:id']].forEach(([verb, route]) => {
      test(`${verb.toUpperCase()} ${route} → requireAuth (no aiRateLimiter)`, () => {
        const escaped = route.replace(/\//g, '\\/');
        const re = new RegExp(`router\\.${verb}\\('${escaped}',\\s*requireAuth,\\s*async`);
        expect(SRC).toMatch(re);
      });
    });
  });

  test('AI POST /sparks/:id/prefill → requireAuth + aiRateLimiter', () => {
    expect(SRC).toMatch(/router\.post\('\/sparks\/:id\/prefill',\s*requireAuth,\s*aiRateLimiter,\s*async/);
  });

  test('no optionalAuth references remain', () => {
    expect(SRC).not.toMatch(/\boptionalAuth\b/);
  });

  test('no lazy-noop fallback', () => {
    expect(SRC).not.toMatch(/\(\(req,\s*res,\s*next\)\s*=>\s*next\(\)\)/);
  });
});
