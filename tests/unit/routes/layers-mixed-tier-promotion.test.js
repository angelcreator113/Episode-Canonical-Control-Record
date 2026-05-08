// ============================================================================
// UNIT TESTS — layers.js (Step 3 CP9, D2 lock)
// ============================================================================
// 9 handlers — mixed Tier 1+4 disposition (7th cumulative §5.21 instance):
//   - 2 GETs Tier 4 PUBLIC (layer catalog: GET /, GET /:id)
//   - 7 writes Tier 1
// No AI POSTs (no anthropic imports; no service-mediated AI signals).

const fs = require('fs');
const path = require('path');

const SRC = fs.readFileSync(path.join(__dirname, '..', '..', '..', 'src', 'routes', 'layers.js'), 'utf8');

describe('Step 3 CP9 — layers.js mixed Tier 1+4', () => {
  test('imports optionalAuth + requireAuth (mixed-tier import shape)', () => {
    expect(SRC).toMatch(/const\s*\{\s*optionalAuth,\s*requireAuth\s*\}\s*=\s*require\(['"]\.\.\/middleware\/auth['"]\)/);
  });

  test('mixed-tier comment block documents §5.21 7th cumulative instance', () => {
    expect(SRC).toMatch(/§5\.21|mixed Tier 1\+4/);
    expect(SRC).toMatch(/7th cumulative instance/);
  });

  describe('Tier 4 PUBLIC GETs (2 layer-catalog reads — D2)', () => {
    test('GET / (list layers) uses optionalAuth (Tier 4)', () => {
      expect(SRC).toMatch(/router\.get\('\/',\s*optionalAuth,\s*async/);
    });
    test('GET /:id (single layer) uses optionalAuth (Tier 4)', () => {
      expect(SRC).toMatch(/router\.get\('\/:id',\s*optionalAuth,\s*async/);
    });
  });

  describe('Tier 1 writes (7)', () => {
    [
      ['post', '/'],
      ['put', '/:id'],
      ['delete', '/:id'],
      ['post', '/:id/assets'],
      ['put', '/assets/:assetId'],
      ['delete', '/assets/:assetId'],
      ['post', '/bulk-create'],
    ].forEach(([verb, route]) => {
      test(`${verb.toUpperCase()} ${route} → requireAuth`, () => {
        const escaped = route.replace(/\//g, '\\/');
        const re = new RegExp(`router\\.${verb}\\('${escaped}',\\s*requireAuth,\\s*async`);
        expect(SRC).toMatch(re);
      });
    });
  });

  test('no aiRateLimiter (no AI POSTs in this file)', () => {
    expect(SRC).not.toMatch(/aiRateLimiter/);
  });

  test('no optionalAuth survivors on writes', () => {
    const writeHandlers = SRC.match(/^router\.(post|put|patch|delete)\([^\n]+/gm) || [];
    writeHandlers.forEach((line) => expect(line).not.toMatch(/optionalAuth/));
  });
});
