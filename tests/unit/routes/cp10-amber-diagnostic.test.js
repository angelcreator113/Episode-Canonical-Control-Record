// ============================================================================
// UNIT TESTS — amberDiagnosticRoutes.js (Step 3 CP10 — WP3 + WP7 — 8 Tier 1 + 1 AI POST aiRateLimiter (D3-verified at L491))
// ============================================================================
// 8 handlers; 1 AI POST per D3 verification (POST /findings/:id/execute
// invokes Anthropic at L491). Other 7 handlers Tier 1 only.

const fs = require('fs');
const path = require('path');

const SRC = fs.readFileSync(path.join(__dirname, '..', '..', '..', 'src', 'routes', 'amberDiagnosticRoutes.js'), 'utf8');

describe('Step 3 CP10 — amberDiagnosticRoutes.js', () => {
  test('requireAuth + authorize import', () => {
    expect(SRC).toMatch(/const\s*\{\s*requireAuth,\s*authorize\s*\}\s*=\s*require\(['"]\.\.\/middleware\/auth['"]\)/);
  });

  test('all 8 handlers are ADMIN only (P0 admin authorization)', () => {
    const routes = SRC.match(/router\.(get|post)\('[^']+',[^\n]*/g) || [];
    expect(routes).toHaveLength(8);
    for (const r of routes) expect(r).toMatch(/,\s*requireAuth,\s*authorize\(\['ADMIN'\]\),/);
  });

  test('aiRateLimiter import', () => {
    expect(SRC).toMatch(/const\s*\{\s*aiRateLimiter\s*\}\s*=\s*require\(['"]\.\.\/middleware\/aiRateLimiter['"]\)/);
  });

  test('POST /findings/:id/execute → requireAuth + authorize ADMIN + aiRateLimiter', () => {
    expect(SRC).toMatch(/router\.post\('\/findings\/:id\/execute',\s*requireAuth,\s*authorize\(\['ADMIN'\]\),\s*aiRateLimiter,/);
  });

  test('no optionalAuth references', () => {
    expect(SRC).not.toMatch(/\boptionalAuth\b/);
  });
});
