// CP12 — imageProcessing.js — G6-EXTENDED closure (authenticate→requireAuth) + Tier 1 sweep
const fs = require('fs');
const path = require('path');
const SRC = fs.readFileSync(path.join(__dirname, '..', '..', '..', 'src', 'routes', 'imageProcessing.js'), 'utf8');

describe('CP12 — imageProcessing.js G6-EXTENDED closure', () => {
  test('imports requireAuth', () => {
    expect(SRC).toMatch(/const \{ requireAuth \} = require\(['"]\.\.\/middleware\/auth['"]\)/);
  });
  test('§5.41 G6-EXTENDED: authenticate alias absent', () => {
    expect(SRC).not.toMatch(/[^A-Za-z]authenticate[^A-Za-z]/);
  });
  test('no optionalAuth survivors', () => {
    expect(SRC).not.toMatch(/optionalAuth/);
  });
  test('POST /:id/remove-background carries requireAuth (was optionalAuth)', () => {
    expect(SRC).toMatch(/router\.post\('\/:id\/remove-background', requireAuth,/);
  });
  test('POST /:id/enhance carries requireAuth (was authenticate)', () => {
    expect(SRC).toMatch(/router\.post\('\/:id\/enhance', requireAuth,/);
  });
  test('POST /:id/reset-processing carries requireAuth (was authenticate)', () => {
    expect(SRC).toMatch(/router\.post\('\/:id\/reset-processing', requireAuth,/);
  });
  test('GET /:id/processing-status migrated bare → Tier 1 requireAuth', () => {
    expect(SRC).toMatch(/router\.get\('\/:id\/processing-status', requireAuth,/);
  });
});
