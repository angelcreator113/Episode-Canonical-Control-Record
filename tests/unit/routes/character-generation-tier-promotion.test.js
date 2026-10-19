// ============================================================================
// UNIT TESTS — characterGenerationRoutes.js (Step 3 CP6 — router.use migration)
// ============================================================================
// 6 handlers (surface-correction: not 7) gated by router.use(requireAuth) at the
// top. Only POST /generate at L43 is an AI POST (calls generateFullCharacter
// service which uses anthropic). Surface-correction: surface §6 listed 3 AI
// POSTs; verified body inspection confirms 1 only.

const fs = require('fs');
const path = require('path');

const SRC = fs.readFileSync(path.join(__dirname, '..', '..', '..', 'src', 'routes', 'characterGenerationRoutes.js'), 'utf8');

describe('Step 3 CP6 — characterGenerationRoutes.js router.use migration', () => {
  test('imports requireAuth + aiRateLimiter', () => {
    expect(SRC).toMatch(/const\s*\{\s*requireAuth\s*\}\s*=\s*require\(['"]\.\.\/middleware\/auth['"]\)/);
    expect(SRC).toMatch(/const\s*\{\s*aiRateLimiter\s*\}\s*=\s*require\(['"]\.\.\/middleware\/aiRateLimiter['"]\)/);
  });

  test('router.use(requireAuth) at the top of the router', () => {
    expect(SRC).toMatch(/router\.use\(requireAuth\)/);
  });

  test('router.use(optionalAuth) removed', () => {
    expect(SRC).not.toMatch(/router\.use\(optionalAuth\)/);
  });

  // Every write is ADMIN only (Evoni, 2026-10-19: "this whole part of the site is admin only").
  test('POST /generate (the sole AI POST) is ADMIN only and carries aiRateLimiter inline', () => {
    expect(SRC).toMatch(/router\.post\('\/generate',\s*authorize\(\['ADMIN'\]\),\s*aiRateLimiter,\s*async/);
  });

  describe('Non-AI handlers inherit auth from router.use, no inline aiRateLimiter; the writes are ADMIN only', () => {
    [['post', '/confirm', true], ['post', '/confirm-feed', true], ['get', '/depth/:id', false], ['patch', '/depth/:id', true]].forEach(([verb, route, admin]) => {
      test(`${verb.toUpperCase()} ${route} has no inline aiRateLimiter${admin ? ' and is ADMIN only' : ''}`, () => {
        const escaped = route.replace(/\//g, '\\/');
        const gate = admin ? "authorize\\(\\['ADMIN'\\]\\),\\s*" : '';
        const re = new RegExp(`router\\.${verb}\\('${escaped}',\\s*${gate}async`);
        expect(SRC).toMatch(re);
      });
    });
  });

  // Evoni, 2026-10-19 ("this whole part of the site is admin only"; the
  // profile audit): promoting a ghost is ADMIN only, still without aiRateLimiter.
  test('POST /promote-ghost/:characterId is ADMIN only, no inline aiRateLimiter', () => {
    expect(SRC).toMatch(/router\.post\('\/promote-ghost\/:characterId',\s*authorize\(\['ADMIN'\]\),\s*async/);
  });

  test('no optionalAuth references remain', () => {
    expect(SRC).not.toMatch(/\boptionalAuth\b/);
  });
});
