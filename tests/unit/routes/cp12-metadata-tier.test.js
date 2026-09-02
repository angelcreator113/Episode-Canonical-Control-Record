// CP12 — metadata.js — §5.21 14th instance: Tier 2-eq + Tier 4 (NEW shape, NO Tier 1)
const fs = require('fs');
const path = require('path');
const SRC = fs.readFileSync(path.join(__dirname, '..', '..', '..', 'src', 'routes', 'metadata.js'), 'utf8');

describe('CP12 — metadata.js §5.21 14th NEW shape (Tier 2-eq + Tier 4)', () => {
  test('imports requireAuth + optionalAuth (G6 closure; optionalAuth added by FD-67 Option 1)', () => {
    expect(SRC).toMatch(/const \{ requireAuth, optionalAuth \} = require\(['"]\.\.\/middleware\/auth['"]\)/);
  });
  test('§5.41 G6: authenticateToken alias absent', () => {
    expect(SRC).not.toMatch(/authenticateToken/);
  });
  test('Tier 4 PUBLIC marker present for 5 bare GET catalog reads', () => {
    expect(SRC).toMatch(/PUBLIC: metadata catalog reads are Tier 4/);
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
  test('Tier 4 PUBLIC bare GETs now carry explicit optionalAuth (FD-67 Option 1 — global mount removed)', () => {
    expect(SRC).toMatch(/router\.get\('\/', optionalAuth, asyncHandler/);
    expect(SRC).toMatch(/router\.get\('\/:id', optionalAuth, asyncHandler/);
  });
});
