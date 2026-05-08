// ============================================================================
// UNIT TESTS — scriptAnalysis.js (Step 3 CP9, D7 sub-form b ADD shape)
// ============================================================================
// 3 handlers — sub-form (b) ADD shape; all 3 had ZERO middleware pre-CP9.
// 1 service-mediated AI POST gets aiRateLimiter (POST /:scriptId/analyze
// → claudeService.analyzeScript wraps Anthropic).
// Mounted at /api/scripts (NO /v1) — D13 NEW topology variant 5th in registry.

const fs = require('fs');
const path = require('path');

const SRC = fs.readFileSync(path.join(__dirname, '..', '..', '..', 'src', 'routes', 'scriptAnalysis.js'), 'utf8');

describe('Step 3 CP9 — scriptAnalysis.js sub-form (b) ADD shape', () => {
  test('imports requireAuth + aiRateLimiter', () => {
    expect(SRC).toMatch(/const\s*\{\s*requireAuth\s*\}\s*=\s*require\(['"]\.\.\/middleware\/auth['"]\)/);
    expect(SRC).toMatch(/const\s*\{\s*aiRateLimiter\s*\}\s*=\s*require\(['"]\.\.\/middleware\/aiRateLimiter['"]\)/);
  });

  test('AI POST /:scriptId/analyze → requireAuth + aiRateLimiter (service-mediated per §5.58)', () => {
    expect(SRC).toMatch(/router\.post\('\/:scriptId\/analyze',\s*requireAuth,\s*aiRateLimiter,\s*async/);
  });

  test('GET /:scriptId/metadata → requireAuth (non-AI Tier 1)', () => {
    expect(SRC).toMatch(/router\.get\('\/:scriptId\/metadata',\s*requireAuth,\s*async/);
  });

  test('PUT /:scriptId/ai-analysis → requireAuth (non-AI Tier 1; toggles AI-enable flag)', () => {
    expect(SRC).toMatch(/router\.put\('\/:scriptId\/ai-analysis',\s*requireAuth,\s*async/);
  });

  test('no optionalAuth references (file is pure Tier 1)', () => {
    expect(SRC).not.toMatch(/\boptionalAuth\b/);
  });

  test('no zero-middleware handlers remain (sub-form b ADD applied)', () => {
    const handlers = SRC.match(/^router\.(get|post|put|patch|delete)\([^\n]+/gm) || [];
    handlers.forEach((line) => expect(line).toMatch(/\brequireAuth\b/));
  });
});
