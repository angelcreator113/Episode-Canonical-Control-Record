// CP12 — assets.js — §5.21 12th 3-TIER ARCHITECTURAL FIRST: Tier 1 + Tier 2 + Tier 4
// G6-EXTENDED 14× authenticate→requireAuth (preserve authorize on 2 Tier 2 admin handlers)
const fs = require('fs');
const path = require('path');
const SRC = fs.readFileSync(path.join(__dirname, '..', '..', '..', 'src', 'routes', 'assets.js'), 'utf8');

describe('CP12 — assets.js §5.21 12th 3-TIER architectural first', () => {
  test('imports requireAuth + authorize (preserved per Tier 2)', () => {
    expect(SRC).toMatch(/const \{ requireAuth, authorize \} = require\(['"]\.\.\/middleware\/auth['"]\)/);
  });
  test('§5.41 G6-EXTENDED: authenticate alias absent', () => {
    expect(SRC).not.toMatch(/[^A-Za-z]authenticate[^A-Za-z]/);
  });
  test('no optionalAuth survivors', () => {
    expect(SRC).not.toMatch(/optionalAuth/);
  });
  test('Tier 4 PUBLIC marker present for 10 bare GET catalog reads (§5.21 12th)', () => {
    expect(SRC).toMatch(/PUBLIC: asset catalog reads are Tier 4/);
  });
  test('Tier 2 admin POST /:id/approve preserves authorize ADMIN (was authenticate+authorize)', () => {
    expect(SRC).toMatch(/router\.put\('\/:id\/approve', requireAuth, authorize\(\['ADMIN'\]\),/);
  });
  test('Tier 2 admin POST /:id/reject preserves authorize ADMIN (was authenticate+authorize)', () => {
    expect(SRC).toMatch(/router\.put\('\/:id\/reject', requireAuth, authorize\(\['ADMIN'\]\),/);
  });
  test('Tier 1 POST /labels carries requireAuth (was authenticate)', () => {
    expect(SRC).toMatch(/router\.post\('\/labels', requireAuth,/);
  });
  test('Tier 1 POST /search migrated bare → requireAuth', () => {
    expect(SRC).toMatch(/router\.post\('\/search', requireAuth,/);
  });
  test('Tier 1 POST / (upload) carries requireAuth + multer + validateAssetUpload PRESERVED', () => {
    expect(SRC).toMatch(/router\.post\('\/', upload\.single\('file'\), requireAuth, validateAssetUpload,/);
  });
  test('Tier 4 PUBLIC bare GETs unchanged (no middleware on / GET)', () => {
    expect(SRC).toMatch(/router\.get\('\/', async/);
    expect(SRC).toMatch(/router\.get\('\/pending', async/);
  });
});
