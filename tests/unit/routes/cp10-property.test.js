// ============================================================================
// UNIT TESTS — propertyRoutes.js (Step 3 CP10 — WP3 — 9 Tier 1 ADD (UNIFORM; was no-auth pre-CP10))
// ============================================================================
// 9 handlers all Tier 1 (was zero middleware pre-CP10).

const fs = require('fs');
const path = require('path');

const SRC = fs.readFileSync(path.join(__dirname, '..', '..', '..', 'src', 'routes', 'propertyRoutes.js'), 'utf8');

describe('Step 3 CP10 — propertyRoutes.js', () => {
  test('requireAuth import', () => {
    expect(SRC).toMatch(/const\s*\{\s*requireAuth\s*\}\s*=\s*require\(['"]\.\.\/middleware\/auth['"]\)/);
  });

  test('GET /templates carries requireAuth', () => {
    expect(SRC).toMatch(/router\.get\('\/templates',\s*requireAuth,/);
  });

  test('GET /style-presets carries requireAuth', () => {
    expect(SRC).toMatch(/router\.get\('\/style-presets',\s*requireAuth,/);
  });

  test('GET / carries requireAuth', () => {
    expect(SRC).toMatch(/router\.get\('\/',\s*requireAuth,/);
  });

  test('POST / carries requireAuth', () => {
    expect(SRC).toMatch(/router\.post\('\/',\s*requireAuth,/);
  });

  test('GET /:id carries requireAuth', () => {
    expect(SRC).toMatch(/router\.get\('\/:id',\s*requireAuth,/);
  });

  test('PATCH /:id carries requireAuth', () => {
    expect(SRC).toMatch(/router\.patch\('\/:id',\s*requireAuth,/);
  });

  test('POST /:id/rooms carries requireAuth', () => {
    expect(SRC).toMatch(/router\.post\('\/:id\/rooms',\s*requireAuth,/);
  });

  test('PATCH /:id/rooms/:roomId carries requireAuth', () => {
    expect(SRC).toMatch(/router\.patch\('\/:id\/rooms\/:roomId',\s*requireAuth,/);
  });

  test('POST /:id/rooms/:roomId/generate-empty carries requireAuth', () => {
    expect(SRC).toMatch(/router\.post\('\/:id\/rooms\/:roomId\/generate-empty',\s*requireAuth,/);
  });
});
