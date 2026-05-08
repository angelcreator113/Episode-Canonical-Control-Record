// ============================================================================
// UNIT TESTS — feedEnhancedRoutes.js (Step 3 CP8 — PROMOTE + service-mediated)
// ============================================================================
// 10 handlers (surface-correction: not 8) all Tier 1.
// 2 service-mediated AI POSTs aiRateLimiter per D3 (post/:postId/ripple,
// :showId/chain/:eventId).
// 1 non-AI persistence POST (moments/:episodeId/persist) — plain requireAuth.

const fs = require('fs');
const path = require('path');

const SRC = fs.readFileSync(path.join(__dirname, '..', '..', '..', 'src', 'routes', 'feedEnhancedRoutes.js'), 'utf8');

describe('Step 3 CP8 — feedEnhancedRoutes.js PROMOTE shape', () => {
  test('imports requireAuth + aiRateLimiter', () => {
    expect(SRC).toMatch(/const\s*\{\s*requireAuth\s*\}\s*=\s*require\(['"]\.\.\/middleware\/auth['"]\)/);
    expect(SRC).toMatch(/const\s*\{\s*aiRateLimiter\s*\}\s*=\s*require\(['"]\.\.\/middleware\/aiRateLimiter['"]\)/);
  });

  describe('Service-mediated AI POSTs (2 — D3 lock)', () => {
    test('POST /post/:postId/ripple → requireAuth + aiRateLimiter', () => {
      expect(SRC).toMatch(/router\.post\('\/post\/:postId\/ripple',\s*requireAuth,\s*aiRateLimiter,\s*async/);
    });
    test('POST /:showId/chain/:eventId → requireAuth + aiRateLimiter', () => {
      expect(SRC).toMatch(/router\.post\('\/:showId\/chain\/:eventId',\s*requireAuth,\s*aiRateLimiter,\s*async/);
    });
  });

  test('Non-AI persistence POST /:showId/moments/:episodeId/persist → requireAuth (no aiRateLimiter)', () => {
    expect(SRC).toMatch(/router\.post\('\/:showId\/moments\/:episodeId\/persist',\s*requireAuth,\s*async/);
  });

  describe('GET handlers — Tier 1 (no Tier 4 disposition; analytics not catalog per D2)', () => {
    [
      ['/:showId/trending'],
      ['/event/:eventId/engagement'],
      ['/:showId/momentum'],
      ['/:showId/chain/:eventId'],
      ['/:showId/moments/:episodeId'],
      ['/:showId/viral'],
      ['/thread/:threadId'],
    ].forEach(([route]) => {
      test(`GET ${route} → requireAuth`, () => {
        const re = new RegExp(`router\\.get\\('${route.replace(/\//g, '\\/')}',\\s*requireAuth,\\s*async`);
        expect(SRC).toMatch(re);
      });
    });
  });

  test('GET /:showId/chain/:eventId does NOT have aiRateLimiter (only POST does)', () => {
    expect(SRC).toMatch(/router\.get\('\/:showId\/chain\/:eventId',\s*requireAuth,\s*async/);
  });

  test('no optionalAuth references remain', () => {
    expect(SRC).not.toMatch(/\boptionalAuth\b/);
  });
});
