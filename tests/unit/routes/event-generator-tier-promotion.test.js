// ============================================================================
// UNIT TESTS — eventGeneratorRoute.js (Step 3 CP7 — PROMOTE, AI POST)
// ============================================================================
// 1 handler: POST /generate-events — Tier 1 + aiRateLimiter.

const fs = require('fs');
const path = require('path');

const SRC = fs.readFileSync(path.join(__dirname, '..', '..', '..', 'src', 'routes', 'eventGeneratorRoute.js'), 'utf8');

describe('Step 3 CP7 — eventGeneratorRoute.js PROMOTE shape', () => {
  test('imports requireAuth + aiRateLimiter', () => {
    expect(SRC).toMatch(/const\s*\{\s*requireAuth\s*\}\s*=\s*require\(['"]\.\.\/middleware\/auth['"]\)/);
    expect(SRC).toMatch(/const\s*\{\s*aiRateLimiter\s*\}\s*=\s*require\(['"]\.\.\/middleware\/aiRateLimiter['"]\)/);
  });

  test('POST /generate-events → requireAuth + aiRateLimiter', () => {
    expect(SRC).toMatch(/router\.post\('\/generate-events',\s*requireAuth,\s*aiRateLimiter,\s*async/);
  });

  test('no optionalAuth references remain', () => {
    expect(SRC).not.toMatch(/\boptionalAuth\b/);
  });
});
