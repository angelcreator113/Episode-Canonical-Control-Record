// ============================================================================
// UNIT TESTS — characterFollowRoutes.js (Step 3 CP6 — PROMOTE shape, no AI)
// ============================================================================
// 7 handlers all promoted to Tier 1 (requireAuth, per-handler).
// 3-level nested lazy-noop fallback at L11-21 removed.

const fs = require('fs');
const path = require('path');

const SRC = fs.readFileSync(path.join(__dirname, '..', '..', '..', 'src', 'routes', 'characterFollowRoutes.js'), 'utf8');

describe('Step 3 CP6 — characterFollowRoutes.js PROMOTE shape', () => {
  test('imports requireAuth from middleware/auth (3-level nested fallback removed)', () => {
    expect(SRC).toMatch(/const\s*\{\s*requireAuth,\s*authorize\s*\}\s*=\s*require\(['"]\.\.\/middleware\/auth['"]\)/);
  });

  describe('All 7 handlers carry requireAuth', () => {
    [
      ['get', '/'],
      ['get', '/tensions/:charA/:charB'],
      ['get', '/:characterKey'],
      ['post', '/generate/:characterKey'],
      ['post', '/generate-batch'],
      ['patch', '/:characterKey'],
      ['get', '/:characterKey/influence-context'],
    ].forEach(([verb, route]) => {
      // Production reads are an ADMIN's since 2026-11-15 (character privacy; tests/integration/characterReadPrivacy).
      test(`${verb.toUpperCase()} ${route} → requireAuth${verb === 'get' ? ' + ADMIN' : ''}`, () => {
        const escaped = route.replace(/\//g, '\\/');
        const admin = verb === 'get' ? "\\s*authorize\\(\\['ADMIN'\\]\\)," : '';
        const re = new RegExp(`router\\.${verb}\\('${escaped}',\\s*requireAuth,${admin}\\s*async`);
        expect(SRC).toMatch(re);
      });
    });
  });

  test('no optionalAuth references remain', () => {
    expect(SRC).not.toMatch(/\boptionalAuth\b/);
  });

  test('no try/catch nested fallback for auth import', () => {
    expect(SRC).not.toMatch(/try\s*\{[\s\S]{0,400}require\(['"]\.\.\/middleware\/auth['"]\)/);
    expect(SRC).not.toMatch(/\(\(req,\s*res,\s*next\)\s*=>\s*next\(\)\)/);
  });
});
