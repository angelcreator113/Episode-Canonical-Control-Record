// CP12 — worldStudio.js — ZERO-EDIT verification (§5.45 polymorphic factory L2483 already Tier 4 PUBLIC since CP3)
const fs = require('fs');
const path = require('path');
const SRC = fs.readFileSync(path.join(__dirname, '..', '..', '..', 'src', 'routes', 'worldStudio.js'), 'utf8');

describe('CP12 — worldStudio.js zero-edit ratification', () => {
  test('the ecosystem preview (the §5.45 factory until SEC-5, 2026-10-29) is admin only', () => {
    expect(SRC).toMatch(/router\.post\('\/world\/generate-ecosystem-preview', requireAuth, authorize\(\['ADMIN'\]\),/);
  });
  test('worldStudio imports optionalAuth, requireAuth and authorize', () => {
    expect(SRC).toMatch(/const \{ optionalAuth, requireAuth, authorize \} = require\(['"]\.\.\/middleware\/auth['"]\)/);
  });
  test('worldStudio writes (Tier 1 since CP3) carry requireAuth', () => {
    expect(SRC).toMatch(/router\.post\('\/world\/generate-ecosystem', requireAuth,/);
    expect(SRC).toMatch(/router\.put\('\/world\/characters\/:id', requireAuth,/);
    expect(SRC).toMatch(/router\.delete\('\/world\/characters\/:id', requireAuth,/);
  });
});
