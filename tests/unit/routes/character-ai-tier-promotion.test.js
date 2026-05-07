// ============================================================================
// UNIT TESTS — characterAI.js (Step 3 CP6 — PROMOTE shape, all 5 AI POSTs)
// ============================================================================
// 5 AI POST handlers, all promoted optionalAuth → requireAuth + aiRateLimiter.
// Lazy-noop fallback at L26-31 removed.

const fs = require('fs');
const path = require('path');

const SRC = fs.readFileSync(path.join(__dirname, '..', '..', '..', 'src', 'routes', 'characterAI.js'), 'utf8');

describe('Step 3 CP6 — characterAI.js PROMOTE shape', () => {
  test('imports requireAuth + aiRateLimiter (lazy-noop removed)', () => {
    expect(SRC).toMatch(/const\s*\{\s*requireAuth\s*\}\s*=\s*require\(['"]\.\.\/middleware\/auth['"]\)/);
    expect(SRC).toMatch(/const\s*\{\s*aiRateLimiter\s*\}\s*=\s*require\(['"]\.\.\/middleware\/aiRateLimiter['"]\)/);
  });

  describe('All 5 AI POSTs at uniform requireAuth + aiRateLimiter shape', () => {
    ['/write-scene', '/character-monologue', '/build-profile', '/suggest-gaps', '/what-happens-next'].forEach((route) => {
      test(`POST ${route} → requireAuth + aiRateLimiter`, () => {
        const escaped = route.replace(/\//g, '\\/');
        const re = new RegExp(`router\\.post\\('${escaped}',\\s*requireAuth,\\s*aiRateLimiter,\\s*async`);
        expect(SRC).toMatch(re);
      });
    });
  });

  test('no optionalAuth handler-references remain', () => {
    const handlers = SRC.match(/^router\.(get|post|put|patch|delete)\([^\n]+/gm) || [];
    handlers.forEach((line) => expect(line).not.toMatch(/\boptionalAuth\b/));
  });

  test('no lazy-noop fallback', () => {
    expect(SRC).not.toMatch(/\(\(req,\s*res,\s*next\)\s*=>\s*next\(\)\)/);
  });
});
