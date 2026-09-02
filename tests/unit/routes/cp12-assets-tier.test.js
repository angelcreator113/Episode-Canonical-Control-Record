// CP12 — assets.js — §5.21 12th 3-TIER ARCHITECTURAL FIRST: Tier 1 + Tier 2 + Tier 4
// G6-EXTENDED 14× authenticate→requireAuth (preserve authorize on 2 Tier 2 admin handlers)
const fs = require('fs');
const path = require('path');
const SRC = fs.readFileSync(path.join(__dirname, '..', '..', '..', 'src', 'routes', 'assets.js'), 'utf8');

describe('CP12 — assets.js §5.21 12th 3-TIER architectural first', () => {
  test('imports requireAuth + authorize + optionalAuth (Tier 2 preserved; optionalAuth added by FD-67 Option 1)', () => {
    expect(SRC).toMatch(/const \{ requireAuth, authorize, optionalAuth \} = require\(['"]\.\.\/middleware\/auth['"]\)/);
  });
  test('§5.41 G6-EXTENDED: authenticate alias absent', () => {
    expect(SRC).not.toMatch(/[^A-Za-z]authenticate[^A-Za-z]/);
  });
  test('optionalAuth present on the 10 Tier 4 catalog reads only, not on Tier 1/2 writes (FD-67 Option 1)', () => {
    const optionalAuthCount = (SRC.match(/\boptionalAuth\b/g) || []).length;
    // 1 import + 10 route declarations
    expect(optionalAuthCount).toBe(11);
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
  test('Tier 4 PUBLIC bare GETs now carry explicit optionalAuth (FD-67 Option 1 — global mount removed)', () => {
    expect(SRC).toMatch(/router\.get\('\/', optionalAuth, async/);
    expect(SRC).toMatch(/router\.get\('\/pending', optionalAuth, async/);
  });
});
