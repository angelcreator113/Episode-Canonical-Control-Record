// ============================================================================
// UNIT TESTS — processing.js (Step 3 CP10 — WP2 + WP3 + WP5 — 7 Tier 1 ADD (GETs) + 4 Tier 2-equivalent (requirePermission preserved))
// ============================================================================
// 11 handlers; 7 GETs Tier 1; 4 mutates Tier 2-equivalent (requireAuth +
// requirePermission preserved per §5.55/§5.59 4-way classification).

const fs = require('fs');
const path = require('path');

const SRC = fs.readFileSync(path.join(__dirname, '..', '..', '..', 'src', 'routes', 'processing.js'), 'utf8');

describe('Step 3 CP10 — processing.js', () => {
  test('requireAuth import', () => {
    expect(SRC).toMatch(/const\s*\{\s*requireAuth\s*\}\s*=\s*require\(['"]\.\.\/middleware\/auth['"]\)/);
  });

  test('requirePermission import preserved', () => {
    expect(SRC).toMatch(/const\s*\{\s*requirePermission\s*\}\s*=\s*require\(['"]\.\.\/middleware\/rbac['"]\)/);
  });

  test('POST / chain requireAuth + requirePermission(processing, create)', () => {
    expect(SRC).toMatch(/requirePermission\('processing',\s*'create'\)/);
  });

  test('PUT /:id chain requireAuth + requirePermission(processing, edit)', () => {
    expect(SRC).toMatch(/requirePermission\('processing',\s*'edit'\)/);
  });

  test('DELETE /:id chain requireAuth + requirePermission(processing, delete)', () => {
    expect(SRC).toMatch(/requirePermission\('processing',\s*'delete'\)/);
  });

  test('no authenticateToken legacy alias', () => {
    expect(SRC).not.toMatch(/\bauthenticateToken\b/);
  });
});
