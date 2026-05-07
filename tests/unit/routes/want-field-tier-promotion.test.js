// ============================================================================
// UNIT TESTS — wantFieldRoutes.js (Step 3 CP6 — router.use migration)
// ============================================================================
// 2 handlers (surface-correction: not 3) gated by router.use(requireAuth).
// 1 AI POST (/:id/unfollow-thread) gets aiRateLimiter inline.
// File mounted at /api/v1/character-entanglements (name ↔ mount mismatch noted
// in surface §2 — discoverability concern only, no auth disposition impact).

const fs = require('fs');
const path = require('path');

const SRC = fs.readFileSync(path.join(__dirname, '..', '..', '..', 'src', 'routes', 'wantFieldRoutes.js'), 'utf8');

describe('Step 3 CP6 — wantFieldRoutes.js router.use migration', () => {
  test('imports requireAuth + aiRateLimiter', () => {
    expect(SRC).toMatch(/const\s*\{\s*requireAuth\s*\}\s*=\s*require\(['"]\.\.\/middleware\/auth['"]\)/);
    expect(SRC).toMatch(/const\s*\{\s*aiRateLimiter\s*\}\s*=\s*require\(['"]\.\.\/middleware\/aiRateLimiter['"]\)/);
  });

  test('router.use(requireAuth) gates the entire router', () => {
    expect(SRC).toMatch(/router\.use\(requireAuth\)/);
  });

  test('PUT /:id/want inherits auth from router.use, no inline middleware', () => {
    expect(SRC).toMatch(/router\.put\('\/:id\/want',\s*async/);
  });

  test('AI POST /:id/unfollow-thread carries aiRateLimiter inline', () => {
    expect(SRC).toMatch(/router\.post\('\/:id\/unfollow-thread',\s*aiRateLimiter,\s*async/);
  });

  test('no optionalAuth references remain', () => {
    expect(SRC).not.toMatch(/\boptionalAuth\b/);
  });
});
