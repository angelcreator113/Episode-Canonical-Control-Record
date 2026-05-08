// ============================================================================
// UNIT TESTS — siteOrganizerRoutes.js (Step 3 CP10 — WP4 — Item 3 PRE-LOCKED Tier 2 (3 GETs))
// ============================================================================
// 3 GET handlers all Tier 2 per §5.3 Item 3 lock.

const fs = require('fs');
const path = require('path');

const SRC = fs.readFileSync(path.join(__dirname, '..', '..', '..', 'src', 'routes', 'siteOrganizerRoutes.js'), 'utf8');

describe('Step 3 CP10 — siteOrganizerRoutes.js', () => {
  test('requireAuth + authorize import', () => {
    expect(SRC).toMatch(/const\s*\{\s*requireAuth,\s*authorize\s*\}\s*=\s*require\(['"]\.\.\/middleware\/auth['"]\)/);
  });

  test('GET /scan Tier 2', () => {
    expect(SRC).toMatch(/router\.get\('\/scan',\s*requireAuth,\s*authorize\(\['ADMIN'\]\),/);
  });

  test('GET /agent/:name Tier 2', () => {
    expect(SRC).toMatch(/router\.get\('\/agent\/:name',\s*requireAuth,\s*authorize\(\['ADMIN'\]\),/);
  });

  test('GET /quick Tier 2', () => {
    expect(SRC).toMatch(/router\.get\('\/quick',\s*requireAuth,\s*authorize\(\['ADMIN'\]\),/);
  });
});
