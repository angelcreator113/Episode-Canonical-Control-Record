// ============================================================================
// UNIT TESTS — characterDepthRoutes.js (Step 3 CP6 — PROMOTE shape)
// ============================================================================
// 5 handlers all promoted to Tier 1 (requireAuth).
// 2 AI POSTs get aiRateLimiter (/generate, /generate/:dimension).
// Surface-correction: /confirm at L379 is data persistence, not AI — does NOT
// get aiRateLimiter (surface §6 listed it as "READ MORE" — confirmed non-AI).
// Lazy-noop fallback at L22-27 removed.

const fs = require('fs');
const path = require('path');

const SRC = fs.readFileSync(path.join(__dirname, '..', '..', '..', 'src', 'routes', 'characterDepthRoutes.js'), 'utf8');

describe('Step 3 CP6 — characterDepthRoutes.js PROMOTE shape', () => {
  test('imports requireAuth + aiRateLimiter', () => {
    expect(SRC).toMatch(/const\s*\{\s*requireAuth\s*\}\s*=\s*require\(['"]\.\.\/middleware\/auth['"]\)/);
    expect(SRC).toMatch(/const\s*\{\s*aiRateLimiter\s*\}\s*=\s*require\(['"]\.\.\/middleware\/aiRateLimiter['"]\)/);
  });

  describe('Tier 1 non-AI handlers (3 — requireAuth only)', () => {
    [['get', '/:charId'], ['put', '/:charId'], ['post', '/:charId/confirm']].forEach(([verb, route]) => {
      test(`${verb.toUpperCase()} ${route} → requireAuth (no aiRateLimiter)`, () => {
        const escaped = route.replace(/\//g, '\\/');
        const re = new RegExp(`router\\.${verb}\\('${escaped}',\\s*requireAuth,\\s*async`);
        expect(SRC).toMatch(re);
      });
    });
  });

  describe('Tier 1 + aiRateLimiter (2 AI POSTs PROMOTE)', () => {
    ['/:charId/generate', '/:charId/generate/:dimension'].forEach((route) => {
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
