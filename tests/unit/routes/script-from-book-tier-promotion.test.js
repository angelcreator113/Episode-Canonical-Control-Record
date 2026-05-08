// ============================================================================
// UNIT TESTS — generate-script-from-book.js (Step 3 CP7 — PROMOTE, AI POST + SSE)
// ============================================================================
// 1 handler: POST /generate-script-from-book — Tier 1 + aiRateLimiter.
// Streaming SSE AI POST. Lazy-noop fallback at L26-32 removed.

const fs = require('fs');
const path = require('path');

const SRC = fs.readFileSync(path.join(__dirname, '..', '..', '..', 'src', 'routes', 'generate-script-from-book.js'), 'utf8');

describe('Step 3 CP7 — generate-script-from-book.js PROMOTE shape (SSE AI POST)', () => {
  test('imports requireAuth + aiRateLimiter', () => {
    expect(SRC).toMatch(/const\s*\{\s*requireAuth\s*\}\s*=\s*require\(['"]\.\.\/middleware\/auth['"]\)/);
    expect(SRC).toMatch(/const\s*\{\s*aiRateLimiter\s*\}\s*=\s*require\(['"]\.\.\/middleware\/aiRateLimiter['"]\)/);
  });

  test('POST /generate-script-from-book → requireAuth + aiRateLimiter', () => {
    expect(SRC).toMatch(/router\.post\('\/generate-script-from-book',\s*requireAuth,\s*aiRateLimiter,\s*async/);
  });

  test('no optionalAuth references remain', () => {
    expect(SRC).not.toMatch(/\boptionalAuth\b/);
  });

  test('no lazy-noop fallback', () => {
    expect(SRC).not.toMatch(/let\s+optionalAuth;\s*try/);
  });
});
