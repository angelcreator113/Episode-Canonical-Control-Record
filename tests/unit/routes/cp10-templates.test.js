// ============================================================================
// UNIT TESTS — templates.js (Step 3 CP10 — WP2 + WP4 — legacy alias + uniform Tier 2 (Item 6 collapsed))
// ============================================================================
// 5 handlers all Tier 2 per §5.3 Item 6 collapsed-into-Item-5 lock.
// Pre-CP10: 3 of 5 already at authenticate + authorize(['ADMIN']);
// L21 GET / + L45 GET /:id promoted from no-auth to Tier 2.

const fs = require('fs');
const path = require('path');

const SRC = fs.readFileSync(path.join(__dirname, '..', '..', '..', 'src', 'routes', 'templates.js'), 'utf8');

describe('Step 3 CP10 — templates.js', () => {
  test('requireAuth + authorize import', () => {
    expect(SRC).toMatch(/const\s*\{\s*requireAuth,\s*authorize\s*\}\s*=\s*require\(['"]\.\.\/middleware\/auth['"]\)/);
  });

  test('GET / Tier 2 (PROMOTED)', () => {
    expect(SRC).toMatch(/router\.get\('\/',\s*requireAuth,\s*authorize\(\['ADMIN'\]\),/);
  });

  test('GET /:id Tier 2 (PROMOTED)', () => {
    expect(SRC).toMatch(/router\.get\('\/:id',\s*requireAuth,\s*authorize\(\['ADMIN'\]\),/);
  });

  test('POST / Tier 2 (was authenticate)', () => {
    expect(SRC).toMatch(/router\.post\('\/',\s*requireAuth,\s*authorize\(\['ADMIN'\]\),/);
  });

  test('PUT /:id Tier 2', () => {
    expect(SRC).toMatch(/router\.put\('\/:id',\s*requireAuth,\s*authorize\(\['ADMIN'\]\),/);
  });

  test('DELETE /:id Tier 2', () => {
    expect(SRC).toMatch(/router\.delete\('\/:id',\s*requireAuth,\s*authorize\(\['ADMIN'\]\),/);
  });
});
