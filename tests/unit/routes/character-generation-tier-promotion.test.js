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

  test('POST /generate (the sole AI POST) carries aiRateLimiter inline', () => {
    expect(SRC).toMatch(/router\.post\('\/generate',\s*aiRateLimiter,\s*async/);
  });

  describe('Non-AI handlers (5) inherit auth from router.use, no inline aiRateLimiter', () => {
    [['post', '/confirm'], ['post', '/confirm-feed'], ['post', '/promote-ghost/:characterId'], ['get', '/depth/:id'], ['patch', '/depth/:id']].forEach(([verb, route]) => {
      test(`${verb.toUpperCase()} ${route} has no inline aiRateLimiter`, () => {
        const escaped = route.replace(/\//g, '\\/');
        const re = new RegExp(`router\\.${verb}\\('${escaped}',\\s*async`);
        expect(SRC).toMatch(re);
      });
    });
  });

  test('no optionalAuth references remain', () => {
    expect(SRC).not.toMatch(/\boptionalAuth\b/);
  });
});
