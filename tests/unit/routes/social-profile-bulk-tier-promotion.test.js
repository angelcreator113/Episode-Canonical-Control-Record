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
  // Evoni, 2026-10-19 (the profile follow-up): authorize joins the import;
  // every POST here is ADMIN only, the job reads are not.
  test('imports requireAuth + aiRateLimiter (lazy-noop removed)', () => {
    expect(SRC).toMatch(/const\s*\{\s*requireAuth,\s*authorize\s*\}\s*=\s*require\(['"]\.\.\/middleware\/auth['"]\)/);
    expect(SRC).toMatch(/const\s*\{\s*aiRateLimiter\s*\}\s*=\s*require\(['"]\.\.\/middleware\/aiRateLimiter['"]\)/);
  });

  describe('AI POSTs (5 — PROMOTE)', () => {
    ['/parse-paste', '/parse-csv', '/generate', '/generate-job'].forEach((route) => {
      test(`POST ${route} → requireAuth + ADMIN + aiRateLimiter`, () => {
        const re = new RegExp(`router\\.post\\('${route.replace(/\//g, '\\/')}',\\s*requireAuth,\\s*authorize\\(\\['ADMIN'\\]\\),\\s*aiRateLimiter,\\s*async`);
        expect(SRC).toMatch(re);
      });
    });
    test('POST /parse-file → requireAuth + ADMIN + aiRateLimiter + multer upload.single', () => {
      expect(SRC).toMatch(/router\.post\('\/parse-file',\s*requireAuth,\s*authorize\(\['ADMIN'\]\),\s*aiRateLimiter,\s*upload\.single\('file'\),\s*async/);
    });
  });

  describe('Non-AI handlers (4 — requireAuth only)', () => {
    [['get', '/jobs'], ['get', '/jobs/:id'], ['get', '/jobs/:id/stream'], ['post', '/jobs/:id/cancel']].forEach(([verb, route]) => {
      test(`${verb.toUpperCase()} ${route} → requireAuth (no aiRateLimiter)`, () => {
        const escaped = route.replace(/\//g, '\\/');
        const admin = verb === 'get' ? '' : "\\s*authorize\\(\\['ADMIN'\\]\\),";
        const re = new RegExp(`router\\.${verb}\\('${escaped}',\\s*requireAuth,${admin}\\s*(?:async|\\(req)`);
        expect(SRC).toMatch(re);
      });
    });
    test('every POST is ADMIN only, and no GET is', () => {
      const handlers = SRC.match(/^router\.(get|post|put|patch|delete)\([^\n]+/gm) || [];
      handlers.filter((l) => !/^router\.get\(/.test(l)).forEach((l) => expect(l).toMatch(/requireAuth,\s*authorize\(\['ADMIN'\]\)/));
      handlers.filter((l) => /^router\.get\(/.test(l)).forEach((l) => expect(l).not.toMatch(/authorize\(/));
    });
  });

  test('no optionalAuth references remain', () => {
    expect(SRC).not.toMatch(/\boptionalAuth\b/);
  });

  test('no lazy-noop fallback', () => {
    expect(SRC).not.toMatch(/let\s+optionalAuth;\s*try/);
  });
});
