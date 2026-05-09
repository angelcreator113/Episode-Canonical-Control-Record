// ============================================================================
// UNIT TESTS — cfoAgentRoutes.js (Step 3 CP10 — WP4 — 9 Tier 2 domain-semantic; 0 AI POSTs D3-verified)
// ============================================================================
// 9 handlers all Tier 2 (requireAuth + authorize(['ADMIN'])).
// D3 verification: cfoAgent service has no Anthropic — NO aiRateLimiter.

const fs = require('fs');
const path = require('path');

const SRC = fs.readFileSync(path.join(__dirname, '..', '..', '..', 'src', 'routes', 'cfoAgentRoutes.js'), 'utf8');

describe('Step 3 CP10 — cfoAgentRoutes.js', () => {
  test('requireAuth + authorize import present', () => {
    expect(SRC).toMatch(/const\s*\{\s*requireAuth,\s*authorize\s*\}\s*=\s*require\(['"]\.\.\/middleware\/auth['"]\)/);
  });

  test('9 Tier 2 ADMIN authorize calls present', () => {
    const matches = SRC.match(/authorize\(\['ADMIN'\]\)/g) || [];
    expect(matches.length).toBe(9);
  });

  test('GET /audit Tier 2', () => {
    expect(SRC).toMatch(/router\.get\('\/audit',\s*requireAuth,\s*authorize\(\['ADMIN'\]\),/);
  });

  test('PUT /budget Tier 2', () => {
    expect(SRC).toMatch(/router\.put\('\/budget',\s*requireAuth,\s*authorize\(\['ADMIN'\]\),/);
  });

  test('POST /scheduler/start Tier 2', () => {
    expect(SRC).toMatch(/router\.post\('\/scheduler\/start',\s*requireAuth,\s*authorize\(\['ADMIN'\]\),/);
  });

  test('no aiRateLimiter (D3 non-AI verified)', () => {
    expect(SRC).not.toMatch(/aiRateLimiter/);
  });
});
