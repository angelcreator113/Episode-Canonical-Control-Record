// ============================================================================
// UNIT TESTS — mirrorFieldRoutes.js (Step 3 CP8 — router.use migration)
// ============================================================================
// 3 handlers gated by router.use(requireAuth).
// 1 AI POST aiRateLimiter inline (mirror/propose — direct anthropic).

const fs = require('fs');
const path = require('path');

const SRC = fs.readFileSync(path.join(__dirname, '..', '..', '..', 'src', 'routes', 'mirrorFieldRoutes.js'), 'utf8');

describe('Step 3 CP8 — mirrorFieldRoutes.js router.use migration', () => {
  test('imports requireAuth + aiRateLimiter', () => {
    expect(SRC).toMatch(/const\s*\{\s*requireAuth\s*\}\s*=\s*require\(['"]\.\.\/middleware\/auth['"]\)/);
    expect(SRC).toMatch(/const\s*\{\s*aiRateLimiter\s*\}\s*=\s*require\(['"]\.\.\/middleware\/aiRateLimiter['"]\)/);
  });

  test('router.use(requireAuth) gates the entire router', () => {
    expect(SRC).toMatch(/router\.use\(requireAuth\)/);
  });

  test('AI POST /:id/mirror/propose carries aiRateLimiter inline', () => {
    expect(SRC).toMatch(/router\.post\('\/:id\/mirror\/propose',\s*aiRateLimiter,\s*async/);
  });

  test('POST /:id/mirror/confirm has no inline aiRateLimiter (DB persistence)', () => {
    expect(SRC).toMatch(/router\.post\('\/:id\/mirror\/confirm',\s*async/);
  });

  test('GET /mirror/self-portrait inherits auth, no inline middleware', () => {
    expect(SRC).toMatch(/router\.get\('\/mirror\/self-portrait',\s*async/);
  });

  test('no optionalAuth references remain', () => {
    expect(SRC).not.toMatch(/\boptionalAuth\b/);
  });
});
