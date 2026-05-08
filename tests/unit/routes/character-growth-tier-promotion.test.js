// ============================================================================
// UNIT TESTS — characterGrowthRoute.js (Step 3 CP6 — PROMOTE shape)
// ============================================================================
// 4 handlers — cross-mounted at /api/v1/memories per app.js:1138 (CP4 cluster
// inheritance per surface §2 cross-mount entry; auth disposition unchanged
// from CP4 audit — only the 4 handlers in this file get promoted).
// 1 AI POST (/character-growth) gets aiRateLimiter.

const fs = require('fs');
const path = require('path');

const SRC = fs.readFileSync(path.join(__dirname, '..', '..', '..', 'src', 'routes', 'characterGrowthRoute.js'), 'utf8');

describe('Step 3 CP6 — characterGrowthRoute.js PROMOTE shape', () => {
  test('imports requireAuth + aiRateLimiter', () => {
    expect(SRC).toMatch(/const\s*\{\s*requireAuth\s*\}\s*=\s*require\(['"]\.\.\/middleware\/auth['"]\)/);
    expect(SRC).toMatch(/const\s*\{\s*aiRateLimiter\s*\}\s*=\s*require\(['"]\.\.\/middleware\/aiRateLimiter['"]\)/);
  });

  test('AI POST /character-growth → requireAuth + aiRateLimiter', () => {
    expect(SRC).toMatch(/router\.post\('\/character-growth',\s*requireAuth,\s*aiRateLimiter,\s*async/);
  });

  describe('Non-AI handlers (3 — requireAuth only)', () => {
    [['get', '/character-growth/flagged'], ['post', '/character-growth/:id/review'], ['get', '/character-growth/history/:characterId']].forEach(([verb, route]) => {
      test(`${verb.toUpperCase()} ${route} → requireAuth`, () => {
        const escaped = route.replace(/\//g, '\\/');
        const re = new RegExp(`router\\.${verb}\\('${escaped}',\\s*requireAuth,\\s*async`);
        expect(SRC).toMatch(re);
      });
    });
  });

  test('no optionalAuth references remain', () => {
    expect(SRC).not.toMatch(/\boptionalAuth\b/);
  });
});
