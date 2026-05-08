// ============================================================================
// UNIT TESTS — upgradeRoutes.js (Step 3 CP10 — WP3 + WP7 — 16 Tier 1 + 5 AI POSTs aiRateLimiter (D3-verified))
// ============================================================================
// 16 handlers; 5 AI POSTs per D3 verification (direct Anthropic invocation):
//   POST /session/brief, /reviews/post-generation, /multi-product/:storyId/generate,
//   /tech-knowledge/ingest-document, /tech-knowledge/extract-conversation.
// Other 11 handlers Tier 1 only.

const fs = require('fs');
const path = require('path');

const SRC = fs.readFileSync(path.join(__dirname, '..', '..', '..', 'src', 'routes', 'upgradeRoutes.js'), 'utf8');

describe('Step 3 CP10 — upgradeRoutes.js', () => {
  test('requireAuth import', () => {
    expect(SRC).toMatch(/const\s*\{\s*requireAuth\s*\}\s*=\s*require\(['"]\.\.\/middleware\/auth['"]\)/);
  });

  test('aiRateLimiter import', () => {
    expect(SRC).toMatch(/const\s*\{\s*aiRateLimiter\s*\}\s*=\s*require\(['"]\.\.\/middleware\/aiRateLimiter['"]\)/);
  });

  test('POST /session/brief AI', () => {
    expect(SRC).toMatch(/router\.post\('\/session\/brief',\s*requireAuth,\s*aiRateLimiter,/);
  });

  test('POST /reviews/post-generation AI', () => {
    expect(SRC).toMatch(/router\.post\('\/reviews\/post-generation',\s*requireAuth,\s*aiRateLimiter,/);
  });

  test('POST /multi-product/:storyId/generate AI', () => {
    expect(SRC).toMatch(/router\.post\('\/multi-product\/:storyId\/generate',\s*requireAuth,\s*aiRateLimiter,/);
  });

  test('POST /tech-knowledge/ingest-document AI', () => {
    expect(SRC).toMatch(/router\.post\('\/tech-knowledge\/ingest-document',\s*requireAuth,\s*aiRateLimiter,/);
  });

  test('POST /tech-knowledge/extract-conversation AI', () => {
    expect(SRC).toMatch(/router\.post\('\/tech-knowledge\/extract-conversation',\s*requireAuth,\s*aiRateLimiter,/);
  });

  test('no optionalAuth references', () => {
    expect(SRC).not.toMatch(/\boptionalAuth\b/);
  });
});
