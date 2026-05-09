// CP12 — editMaps.js — V3 twin-mount + 2 Lambda-callback Tier 1 (PE #9 candidate)
const fs = require('fs');
const path = require('path');
const SRC = fs.readFileSync(path.join(__dirname, '..', '..', '..', 'src', 'routes', 'editMaps.js'), 'utf8');

describe('CP12 — editMaps.js Lambda-callback Tier 1 (PE #9)', () => {
  test('imports requireAuth', () => {
    expect(SRC).toMatch(/const \{ requireAuth \} = require\(['"]\.\.\/middleware\/auth['"]\)/);
  });
  test('no optionalAuth survivors', () => {
    expect(SRC).not.toMatch(/optionalAuth/);
  });
  test('Lambda-callback PUT /:id has requireAuth + Lambda rationale comment', () => {
    expect(SRC).toMatch(/Lambda-callback: requires service-account JWT/);
    expect(SRC).toMatch(/router\.put\('\/:id', requireAuth,/);
  });
  test('Lambda-callback PATCH /:id has requireAuth + Lambda rationale comment', () => {
    expect(SRC).toMatch(/router\.patch\('\/:id', requireAuth,/);
  });
  test('POST /:id/analyze carries requireAuth', () => {
    expect(SRC).toMatch(/router\.post\('\/:id\/analyze', requireAuth,/);
  });
  test('GET /:id/edit-map carries requireAuth', () => {
    expect(SRC).toMatch(/router\.get\('\/:id\/edit-map', requireAuth,/);
  });
});
