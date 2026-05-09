// ============================================================================
// UNIT TESTS — admin.js (Step 3 CP10 — WP2 + WP4 — legacy alias + Tier 2 PRESERVED admin-lowercase per WP4 casing gate)
// ============================================================================
// 2 Tier 2 handlers; authorize-call casing preserved verbatim per WP4 casing
// gate option (c). PE candidate filed for Cognito-group canonicalization.

const fs = require('fs');
const path = require('path');

const SRC = fs.readFileSync(path.join(__dirname, '..', '..', '..', 'src', 'routes', 'admin.js'), 'utf8');

describe('Step 3 CP10 — admin.js', () => {
  test('requireAuth + authorize import present', () => {
    expect(SRC).toMatch(/const\s*\{\s*requireAuth,\s*authorize\s*\}\s*=\s*require\(['"]\.\.\/middleware\/auth['"]\)/);
  });

  test('POST /query carries requireAuth + authorize lowercase admin preserved + queryLimiter', () => {
    expect(SRC).toMatch(/router\.post\('\/query',\s*requireAuth,\s*authorize\(\['admin'\]\),\s*queryLimiter,/);
  });

  test('GET /create-video-compositions-table carries requireAuth + authorize lowercase admin', () => {
    expect(SRC).toMatch(/router\.get\('\/create-video-compositions-table',\s*requireAuth,\s*authorize\(\['admin'\]\),/);
  });

  test('queryLimiter rate-limiter preserved', () => {
    expect(SRC).toMatch(/queryLimiter/);
  });

  test('no authenticateToken legacy alias remains', () => {
    expect(SRC).not.toMatch(/\bauthenticateToken\b/);
  });
});
