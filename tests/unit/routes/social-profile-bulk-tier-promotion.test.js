// ============================================================================
// UNIT TESTS — socialProfileBulkRoutes.js (Step 3 CP8 — PROMOTE shape)
// ============================================================================
// 9 handlers (surface-correction: not 8) all Tier 1.
// 5 AI POSTs aiRateLimiter (parse-paste, parse-csv, parse-file, generate, generate-job).
// Lazy-noop fallback removed.

const fs = require('fs');
const path = require('path');

const SRC = fs.readFileSync(path.join(__dirname, '..', '..', '..', 'src', 'routes', 'socialProfileBulkRoutes.js'), 'utf8');

describe('Step 3 CP8 — socialProfileBulkRoutes.js PROMOTE shape', () => {
  test('imports requireAuth + aiRateLimiter (lazy-noop removed)', () => {
    expect(SRC).toMatch(/const\s*\{\s*requireAuth\s*\}\s*=\s*require\(['"]\.\.\/middleware\/auth['"]\)/);
    expect(SRC).toMatch(/const\s*\{\s*aiRateLimiter\s*\}\s*=\s*require\(['"]\.\.\/middleware\/aiRateLimiter['"]\)/);
  });

  describe('AI POSTs (5 — PROMOTE)', () => {
    ['/parse-paste', '/parse-csv', '/generate', '/generate-job'].forEach((route) => {
      test(`POST ${route} → requireAuth + aiRateLimiter`, () => {
        const re = new RegExp(`router\\.post\\('${route.replace(/\//g, '\\/')}',\\s*requireAuth,\\s*aiRateLimiter,\\s*async`);
        expect(SRC).toMatch(re);
      });
    });
    test('POST /parse-file → requireAuth + aiRateLimiter + multer upload.single', () => {
      expect(SRC).toMatch(/router\.post\('\/parse-file',\s*requireAuth,\s*aiRateLimiter,\s*upload\.single\('file'\),\s*async/);
    });
  });

  describe('Non-AI handlers (4 — requireAuth only)', () => {
    [['get', '/jobs'], ['get', '/jobs/:id'], ['get', '/jobs/:id/stream'], ['post', '/jobs/:id/cancel']].forEach(([verb, route]) => {
      test(`${verb.toUpperCase()} ${route} → requireAuth (no aiRateLimiter)`, () => {
        const escaped = route.replace(/\//g, '\\/');
        const re = new RegExp(`router\\.${verb}\\('${escaped}',\\s*requireAuth,\\s*(?:async|\\(req)`);
        expect(SRC).toMatch(re);
      });
    });
  });

  test('no optionalAuth references remain', () => {
    expect(SRC).not.toMatch(/\boptionalAuth\b/);
  });

  test('no lazy-noop fallback', () => {
    expect(SRC).not.toMatch(/let\s+optionalAuth;\s*try/);
  });
});
