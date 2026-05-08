// ============================================================================
// UNIT TESTS — feedPostRoutes.js mixed Tier 1+4 (Step 3 CP8, D2 lock)
// ============================================================================
// 6 handlers (surface-correction: not 7) — mixed Tier 1+4 disposition (5th
// cumulative §5.21 instance):
//   - 3 GETs Tier 4 PUBLIC (timeline catalog reads)
//   - 2 writes Tier 1 (PUT /:postId, DELETE /:postId)
//   - 1 service-mediated AI POST aiRateLimiter (POST /:episodeId/generate)

const fs = require('fs');
const path = require('path');

const SRC = fs.readFileSync(path.join(__dirname, '..', '..', '..', 'src', 'routes', 'feedPostRoutes.js'), 'utf8');

describe('Step 3 CP8 — feedPostRoutes.js mixed Tier 1+4', () => {
  test('imports optionalAuth + requireAuth + aiRateLimiter', () => {
    expect(SRC).toMatch(/const\s*\{\s*optionalAuth,\s*requireAuth\s*\}\s*=\s*require\(['"]\.\.\/middleware\/auth['"]\)/);
    expect(SRC).toMatch(/const\s*\{\s*aiRateLimiter\s*\}\s*=\s*require\(['"]\.\.\/middleware\/aiRateLimiter['"]\)/);
  });

  test('mixed-tier comment block documents §5.21 5th cumulative instance', () => {
    expect(SRC).toMatch(/§5\.21|mixed Tier 1\+4/);
    expect(SRC).toMatch(/5th cumulative instance/);
  });

  describe('Tier 4 PUBLIC GETs (3 timeline catalog reads)', () => {
    [
      ['get', '/'],
      ['get', '/:showId/timeline'],
      ['get', '/episode/:episodeId'],
    ].forEach(([verb, route]) => {
      test(`${verb.toUpperCase()} ${route} uses optionalAuth (Tier 4)`, () => {
        const re = new RegExp(`router\\.${verb}\\('${route.replace(/\//g, '\\/')}',\\s*optionalAuth,\\s*async`);
        expect(SRC).toMatch(re);
      });
    });
  });

  test('AI POST /:episodeId/generate → requireAuth + aiRateLimiter', () => {
    expect(SRC).toMatch(/router\.post\('\/:episodeId\/generate',\s*requireAuth,\s*aiRateLimiter,\s*async/);
  });

  describe('Tier 1 writes (2)', () => {
    [['put', '/:postId'], ['delete', '/:postId']].forEach(([verb, route]) => {
      test(`${verb.toUpperCase()} ${route} → requireAuth`, () => {
        const escaped = route.replace(/\//g, '\\/');
        const re = new RegExp(`router\\.${verb}\\('${escaped}',\\s*requireAuth,\\s*async`);
        expect(SRC).toMatch(re);
      });
    });
  });

  test('no optionalAuth survivors on writes', () => {
    const writeHandlers = SRC.match(/^router\.(post|put|patch|delete)\([^\n]+/gm) || [];
    writeHandlers.forEach((line) => expect(line).not.toMatch(/optionalAuth/));
  });
});
