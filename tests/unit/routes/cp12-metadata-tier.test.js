// CP12 — metadata.js — §5.21 14th instance: Tier 2-eq writes. Its five reads were Tier 4 (public)
// until 2026-11-22; they are an ADMIN's (docs/audit/F-AUTH-1_MetadataReads_AdminOnly_Amendment_2026-11-22.md;
// behaviour in metadata-reads-admin-only.test.js).
const fs = require('fs');
const path = require('path');
const SRC = fs.readFileSync(path.join(__dirname, '..', '..', '..', 'src', 'routes', 'metadata.js'), 'utf8');

describe('CP12 — metadata.js: Tier 2-eq writes, ADMIN reads', () => {
  test('imports requireAuth + authorize, and no optionalAuth', () => {
    expect(SRC).toMatch(/const \{ requireAuth, authorize \} = require\(['"]\.\.\/middleware\/auth['"]\)/);
    expect(SRC).not.toMatch(/optionalAuth,/);
  });
  test('§5.41 G6: authenticateToken alias absent', () => {
    expect(SRC).not.toMatch(/authenticateToken/);
  });
  test('no read is marked public', () => {
    expect(SRC).not.toMatch(/\/\/ PUBLIC:/);
  });
  test('Tier 2-equivalent POST / preserves requirePermission (chain: requireAuth then requirePermission)', () => {
    expect(SRC).toMatch(/requireAuth,\s*\n?\s*requirePermission\('metadata', 'create'\)/);
  });
  test('Tier 2-equivalent PUT /:id preserves requirePermission edit', () => {
    expect(SRC).toMatch(/requireAuth,\s*\n?\s*requirePermission\('metadata', 'edit'\)/);
  });
  test('Tier 2-equivalent DELETE /:id preserves requirePermission delete', () => {
    expect(SRC).toMatch(/requireAuth,\s*\n?\s*requirePermission\('metadata', 'delete'\)/);
  });
  test('each of the five GETs needs a sign-in in the admin group', () => {
    const gets = SRC.match(/^router\.get\(.*$/gm);
    expect(gets).toHaveLength(5);
    for (const line of gets) expect(line).toMatch(/^router\.get\('[^']+', requireAuth, authorize\(\['ADMIN'\]\), asyncHandler\(/);
  });
});
