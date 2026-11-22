// ============================================================================
// UNIT TESTS — search.js (Step 3 CP10 — WP2 + WP3 — 9 legacy alias conversions + 1 Tier 1 ADD (L17 GET /))
// ============================================================================
// 10 handlers; was 9 legacy authenticateToken + 1 zero-middleware. 9 are
// Tier 1. GET /scripts is an ADMIN's since 2026-11-22 (Evoni;
// docs/audit/F-AUTH-1_ScriptReads_AdminOnly_Amendment2_2026-11-22.md); how it
// behaves is in search-scripts-admin-only.test.js.

const fs = require('fs');
const path = require('path');

const SRC = fs.readFileSync(path.join(__dirname, '..', '..', '..', 'src', 'routes', 'search.js'), 'utf8');

describe('Step 3 CP10 — search.js', () => {
  test('requireAuth + authorize import', () => {
    expect(SRC).toMatch(/const\s*\{\s*requireAuth,\s*authorize\s*\}\s*=\s*require\(['"]\.\.\/middleware\/auth['"]\)/);
  });

  test('GET /scripts carries requireAuth + authorize([\'ADMIN\']) (was Tier 1)', () => {
    expect(SRC).toMatch(/router\.get\('\/scripts',\s*requireAuth,\s*authorize\(\['ADMIN'\]\),/);
  });

  test('GET / Tier 1 ADDED', () => {
    expect(SRC).toMatch(/router\.get\('\/',\s*requireAuth,/);
  });

  test('no authenticateToken legacy alias', () => {
    expect(SRC).not.toMatch(/\bauthenticateToken\b/);
  });
});
