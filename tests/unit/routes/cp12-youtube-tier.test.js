// CP12 — youtube.js — V5 legacy-prefix mount, Tier 1 sweep
const fs = require('fs');
const path = require('path');
const SRC = fs.readFileSync(path.join(__dirname, '..', '..', '..', 'src', 'routes', 'youtube.js'), 'utf8');

describe('CP12 — youtube.js Tier 1 (V5 legacy-prefix)', () => {
  test('imports requireAuth', () => {
    expect(SRC).toMatch(/const \{ requireAuth \} = require\(['"]\.\.\/middleware\/auth['"]\)/);
  });
  test('no optionalAuth survivors', () => {
    expect(SRC).not.toMatch(/optionalAuth/);
  });
  test('POST /analyze carries requireAuth', () => {
    expect(SRC).toMatch(/router\.post\('\/analyze', requireAuth,/);
  });
  test('GET /metadata carries requireAuth', () => {
    expect(SRC).toMatch(/router\.get\('\/metadata', requireAuth,/);
  });
  test('GET /library carries requireAuth', () => {
    expect(SRC).toMatch(/router\.get\('\/library', requireAuth,/);
  });
  test('DELETE /:id carries requireAuth', () => {
    expect(SRC).toMatch(/router\.delete\('\/:id', requireAuth,/);
  });
  test('POST /:id/detect-scenes carries requireAuth', () => {
    expect(SRC).toMatch(/router\.post\('\/:id\/detect-scenes', requireAuth,/);
  });
});
