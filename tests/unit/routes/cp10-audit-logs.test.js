// ============================================================================
// UNIT TESTS — auditLogs.js (Step 3 CP10 — WP2 + WP4 — legacy alias + uniform Tier 2 (Item 5))
// ============================================================================
// 3 handlers all Tier 2 per §5.3 Item 5 lock (uniform application).
// Pre-CP10: 2 of 3 already at authenticate + authorize(['ADMIN']);
// L18 GET / promoted from no-auth to Tier 2.

const fs = require('fs');
const path = require('path');

const SRC = fs.readFileSync(path.join(__dirname, '..', '..', '..', 'src', 'routes', 'auditLogs.js'), 'utf8');

describe('Step 3 CP10 — auditLogs.js', () => {
  test('requireAuth + authorize import', () => {
    expect(SRC).toMatch(/const\s*\{\s*requireAuth,\s*authorize\s*\}\s*=\s*require\(['"]\.\.\/middleware\/auth['"]\)/);
  });

  test('GET / Tier 2 (PROMOTED)', () => {
    expect(SRC).toMatch(/router\.get\('\/',\s*requireAuth,\s*authorize\(\['ADMIN'\]\),/);
  });

  test('GET /stats Tier 2 (was authenticate, now requireAuth)', () => {
    expect(SRC).toMatch(/router\.get\('\/stats',\s*requireAuth,\s*authorize\(\['ADMIN'\]\),/);
  });

  test('GET /user/:userId Tier 2 (was authenticate, now requireAuth)', () => {
    expect(SRC).toMatch(/router\.get\('\/user\/:userId',\s*requireAuth,\s*authorize\(\['ADMIN'\]\),/);
  });

  test('no legacy authenticate alias remains', () => {
    expect(SRC).not.toMatch(/\bauthenticate\b\b(?!Token|JWT)/);
  });
});
