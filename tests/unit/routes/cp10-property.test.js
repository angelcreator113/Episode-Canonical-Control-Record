// ============================================================================
// UNIT TESTS — propertyRoutes.js (Step 3 CP10 — WP3 — 9 Tier 1 ADD (UNIFORM; was no-auth pre-CP10))
// ============================================================================
// 9 handlers all Tier 1 (was zero middleware pre-CP10).
//
// 2026-11-22 (Evoni): four of the nine, the Property Manager's writes, are an
// ADMIN's (requireAuth, then authorize(['ADMIN'])). The other five stay a
// sign-in. docs/audit/F-AUTH-1_PropertyManagerWrites_AdminOnly_Amendment_2026-11-22.md

const fs = require('fs');
const path = require('path');

const SRC = fs.readFileSync(path.join(__dirname, '..', '..', '..', 'src', 'routes', 'propertyRoutes.js'), 'utf8');

describe('Step 3 CP10 — propertyRoutes.js', () => {
  test('requireAuth and authorize import', () => {
    expect(SRC).toMatch(/const\s*\{\s*requireAuth,\s*authorize\s*\}\s*=\s*require\(['"]\.\.\/middleware\/auth['"]\)/);
  });

  test('nine handlers: every one carries requireAuth first, four of them then authorize([\'ADMIN\'])', () => {
    const routes = SRC.match(/^router\.(get|post|put|patch|delete)\(.*$/gm) || [];
    expect(routes).toHaveLength(9);
    expect(routes.filter((line) => /^router\.\w+\('[^']*',\s*requireAuth,/.test(line))).toHaveLength(9);
    expect(routes.filter((line) => /requireAuth,\s*authorize\(\['ADMIN'\]\),/.test(line))).toHaveLength(4);
    expect(SRC.match(/authorize\(/g) || []).toHaveLength(4);
  });

  test('GET /templates carries requireAuth', () => {
    expect(SRC).toMatch(/router\.get\('\/templates',\s*requireAuth,\s*\(req, res\)/);
  });

  test('GET /style-presets carries requireAuth', () => {
    expect(SRC).toMatch(/router\.get\('\/style-presets',\s*requireAuth,\s*\(req, res\)/);
  });

  test('GET / carries requireAuth', () => {
    expect(SRC).toMatch(/router\.get\('\/',\s*requireAuth,\s*async/);
  });

  test('POST / carries requireAuth, then authorize([\'ADMIN\'])', () => {
    expect(SRC).toMatch(/router\.post\('\/',\s*requireAuth,\s*authorize\(\['ADMIN'\]\),\s*async/);
  });

  test('GET /:id carries requireAuth', () => {
    expect(SRC).toMatch(/router\.get\('\/:id',\s*requireAuth,\s*async/);
  });

  test('PATCH /:id carries requireAuth, then authorize([\'ADMIN\'])', () => {
    expect(SRC).toMatch(/router\.patch\('\/:id',\s*requireAuth,\s*authorize\(\['ADMIN'\]\),\s*async/);
  });

  test('POST /:id/rooms carries requireAuth, then authorize([\'ADMIN\'])', () => {
    expect(SRC).toMatch(/router\.post\('\/:id\/rooms',\s*requireAuth,\s*authorize\(\['ADMIN'\]\),\s*async/);
  });

  test('PATCH /:id/rooms/:roomId carries requireAuth, then authorize([\'ADMIN\'])', () => {
    expect(SRC).toMatch(/router\.patch\('\/:id\/rooms\/:roomId',\s*requireAuth,\s*authorize\(\['ADMIN'\]\),\s*async/);
  });

  test('POST /:id/rooms/:roomId/generate-empty carries requireAuth', () => {
    expect(SRC).toMatch(/router\.post\('\/:id\/rooms\/:roomId\/generate-empty',\s*requireAuth,\s*async/);
  });
});
