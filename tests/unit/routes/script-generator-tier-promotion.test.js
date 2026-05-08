// ============================================================================
// UNIT TESTS — scriptGenerator.js (Step 3 CP9, D1 + D3 locks)
// ============================================================================
// 7 handlers all Tier 1 throughout. Per D3 service-mediated AI POST verification
// at execution: 0 AI POSTs (surface-correction from forecast 1-2). Confirmed:
//   - POST /:templateId/generate is template-variable substitution (NOT AI)
//   - POST /:episodeId/script-suggestions returns hardcoded suggestion arrays (NOT AI)
//   - POST /:scriptId/parse-scenes uses local parser utility (NOT AI)
//   - POST /:showId/template is CRUD (NOT AI)
// All 7 handlers get plain requireAuth.

const fs = require('fs');
const path = require('path');

const SRC = fs.readFileSync(path.join(__dirname, '..', '..', '..', 'src', 'routes', 'scriptGenerator.js'), 'utf8');

describe('Step 3 CP9 — scriptGenerator.js PROMOTE shape (no AI POSTs per D3 verification)', () => {
  test('imports requireAuth (no aiRateLimiter — no AI POSTs)', () => {
    expect(SRC).toMatch(/const\s*\{\s*requireAuth\s*\}\s*=\s*require\(['"]\.\.\/middleware\/auth['"]\)/);
  });

  describe('All 7 handlers carry requireAuth', () => {
    [
      ['get', '/:showId/config'],
      ['put', '/:showId/config'],
      ['get', '/:showId/template'],
      ['post', '/:showId/template'],
      ['post', '/:episodeId/script-suggestions'],
      ['post', '/:templateId/generate'],
      ['post', '/:scriptId/parse-scenes'],
    ].forEach(([verb, route]) => {
      test(`${verb.toUpperCase()} ${route} → requireAuth`, () => {
        const escaped = route.replace(/\//g, '\\/');
        const re = new RegExp(`router\\.${verb}\\('${escaped}',\\s*requireAuth,\\s*async`);
        expect(SRC).toMatch(re);
      });
    });
  });

  test('no aiRateLimiter (D3 verification: 0 AI POSTs in this file — surface-correction)', () => {
    expect(SRC).not.toMatch(/aiRateLimiter/);
  });

  test('no optionalAuth references remain', () => {
    expect(SRC).not.toMatch(/\boptionalAuth\b/);
  });
});
