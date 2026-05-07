// ============================================================================
// UNIT TESTS — characterGenerator.js (Step 3 CP6 — D7 ADD shape disposition)
// ============================================================================
// 7 handlers (1 GET + 6 POST). All promoted to requireAuth.
// 3 AI POSTs (/propose-seeds, /generate-batch, /rewrite-field) get aiRateLimiter.
// Surface-correction logged in CP6 closing report: surface §6 originally
// listed 2 AI POSTs; /rewrite-field at L1198 was missed (calls anthropic at L1213).

const fs = require('fs');
const path = require('path');

const SRC = fs.readFileSync(path.join(__dirname, '..', '..', '..', 'src', 'routes', 'characterGenerator.js'), 'utf8');

describe('Step 3 CP6 — characterGenerator.js Tier 1 sweep', () => {
  test('imports requireAuth + aiRateLimiter (lazy-noop at L17-23 removed)', () => {
    expect(SRC).toMatch(/const\s*\{\s*requireAuth\s*\}\s*=\s*require\(['"]\.\.\/middleware\/auth['"]\)/);
    expect(SRC).toMatch(/const\s*\{\s*aiRateLimiter\s*\}\s*=\s*require\(['"]\.\.\/middleware\/aiRateLimiter['"]\)/);
  });

  describe('Tier 1 non-AI handlers (4 handlers — requireAuth only)', () => {
    [['get', '/ecosystem'], ['post', '/check-staging'], ['post', '/commit'], ['post', '/seed-relationships']].forEach(([verb, route]) => {
      test(`${verb.toUpperCase()} ${route} → requireAuth (no aiRateLimiter)`, () => {
        const escaped = route.replace(/\//g, '\\/');
        const re = new RegExp(`router\\.${verb}\\('${escaped}',\\s*requireAuth,\\s*async`);
        expect(SRC).toMatch(re);
      });
    });
  });

  describe('Tier 1 + aiRateLimiter (3 AI POSTs PROMOTE)', () => {
    ['/propose-seeds', '/generate-batch', '/rewrite-field'].forEach((route) => {
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
