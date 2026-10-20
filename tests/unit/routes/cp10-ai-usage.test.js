// ============================================================================
// UNIT TESTS — aiUsageRoutes.js (Step 3 CP10 — WP3 — 7 GETs Tier 1 (DB tracking, NOT AI per Q8 + D3 verified))
// ============================================================================
// 7 GET handlers all Tier 1 (DB queries on ai_usage_logs; no Anthropic calls).
// Per §5.58 D3 lock: NOT AI POSTs despite filename — file-level verification.

const fs = require('fs');
const path = require('path');

const SRC = fs.readFileSync(path.join(__dirname, '..', '..', '..', 'src', 'routes', 'aiUsageRoutes.js'), 'utf8');

describe('Step 3 CP10 — aiUsageRoutes.js', () => {
  test('requireAuth import present', () => {
    // authorize joined it for the cost page's ADMIN endpoint (Evoni, 2026-10-19).
    expect(SRC).toMatch(/const\s*\{\s*requireAuth,\s*authorize\s*\}\s*=\s*require\(['"]\.\.\/middleware\/auth['"]\)/);
  });

  test('GET /cost-overview is ADMIN only', () => {
    expect(SRC).toMatch(/router\.get\('\/cost-overview',\s*requireAuth,\s*authorize\(\['ADMIN'\]\),/);
  });

  test('GET /summary carries requireAuth', () => {
    expect(SRC).toMatch(/router\.get\('\/summary',\s*requireAuth,/);
  });

  test('GET /by-model carries requireAuth', () => {
    expect(SRC).toMatch(/router\.get\('\/by-model',\s*requireAuth,/);
  });

  test('GET /by-route carries requireAuth', () => {
    expect(SRC).toMatch(/router\.get\('\/by-route',\s*requireAuth,/);
  });

  test('GET /daily carries requireAuth', () => {
    expect(SRC).toMatch(/router\.get\('\/daily',\s*requireAuth,/);
  });

  test('GET /recent carries requireAuth', () => {
    expect(SRC).toMatch(/router\.get\('\/recent',\s*requireAuth,/);
  });

  test('GET /optimizations carries requireAuth', () => {
    expect(SRC).toMatch(/router\.get\('\/optimizations',\s*requireAuth,/);
  });

  test('GET /cache-stats carries requireAuth', () => {
    expect(SRC).toMatch(/router\.get\('\/cache-stats',\s*requireAuth,/);
  });

  // Evoni, 2026-10-20: every AI Costs route is ADMIN only.
  test('every route is ADMIN only', () => {
    const routes = SRC.match(/^router\.get\([^\n]+/gm) || [];
    expect(routes.length).toBe(8);
    routes.forEach((line) => expect(line).toMatch(/requireAuth,\s*authorize\(\['ADMIN'\]\),/));
  });

  test('no aiRateLimiter (D3-verified non-AI)', () => {
    expect(SRC).not.toMatch(/aiRateLimiter/);
  });

  test('no optionalAuth', () => {
    expect(SRC).not.toMatch(/\boptionalAuth\b/);
  });
});
