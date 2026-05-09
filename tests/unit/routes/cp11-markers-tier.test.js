// ============================================================================
// UNIT TESTS — markers.js (Step 3 CP11 — sub-form (b) ADD shape, AUTH-DISABLED banner removal)
// ============================================================================
// 7 handlers all Tier 1 (was zero-middleware pre-CP11 with TESTING banner per
// §5.57 v2.34 + CP6 character-clips precedent). Banner removed; requireAuth ADDed.

const fs = require('fs');
const path = require('path');

const SRC = fs.readFileSync(path.join(__dirname, '..', '..', '..', 'src', 'routes', 'markers.js'), 'utf8');

describe('Step 3 CP11 — markers.js sub-form (b) ADD shape', () => {
  test('imports requireAuth from middleware/auth', () => {
    expect(SRC).toMatch(/const\s*\{\s*requireAuth\s*\}\s*=\s*require\(['"]\.\.\/middleware\/auth['"]\)/);
  });

  test('AUTH TEMPORARILY DISABLED banner removed', () => {
    expect(SRC).not.toMatch(/AUTH TEMPORARILY DISABLED/i);
  });

  test('GET /episodes/:episodeId/markers carries requireAuth', () => {
    expect(SRC).toMatch(/router\.get\('\/episodes\/:episodeId\/markers',\s*requireAuth,/);
  });

  test('POST /episodes/:episodeId/markers carries requireAuth', () => {
    expect(SRC).toMatch(/router\.post\('\/episodes\/:episodeId\/markers',\s*requireAuth,/);
  });

  test('GET /episodes/:episodeId/markers/by-type/:markerType carries requireAuth', () => {
    expect(SRC).toMatch(/router\.get\(\s*\n?\s*'\/episodes\/:episodeId\/markers\/by-type\/:markerType',\s*\n?\s*requireAuth,/);
  });

  test('GET /markers/:id carries requireAuth', () => {
    expect(SRC).toMatch(/router\.get\('\/markers\/:id',\s*requireAuth,/);
  });

  test('PUT /markers/:id carries requireAuth', () => {
    expect(SRC).toMatch(/router\.put\('\/markers\/:id',\s*requireAuth,/);
  });

  test('DELETE /markers/:id carries requireAuth', () => {
    expect(SRC).toMatch(/router\.delete\('\/markers\/:id',\s*requireAuth,/);
  });

  test('POST /markers/:id/auto-scene-link carries requireAuth', () => {
    expect(SRC).toMatch(/router\.post\('\/markers\/:id\/auto-scene-link',\s*requireAuth,/);
  });
});
