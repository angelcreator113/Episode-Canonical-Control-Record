// ============================================================================
// UNIT TESTS — search.js (Step 3 CP10 — WP2 + WP3 — 9 legacy alias conversions + 1 Tier 1 ADD (L17 GET /))
// ============================================================================
// 10 handlers all Tier 1; was 9 legacy authenticateToken + 1 zero-middleware.

const fs = require('fs');
const path = require('path');

const SRC = fs.readFileSync(path.join(__dirname, '..', '..', '..', 'src', 'routes', 'search.js'), 'utf8');

describe('Step 3 CP10 — search.js', () => {
  test('requireAuth import', () => {
    expect(SRC).toMatch(/const\s*\{\s*requireAuth\s*\}\s*=\s*require\(['"]\.\.\/middleware\/auth['"]\)/);
  });

  test('GET / Tier 1 ADDED', () => {
    expect(SRC).toMatch(/router\.get\('\/',\s*requireAuth,/);
  });

  test('no authenticateToken legacy alias', () => {
    expect(SRC).not.toMatch(/\bauthenticateToken\b/);
  });
});
