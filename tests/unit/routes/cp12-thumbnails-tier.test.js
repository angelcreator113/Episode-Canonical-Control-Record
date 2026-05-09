// CP12 — thumbnails.js — §5.21 13th: 3-TIER (Tier 1 + Tier 2-eq + Tier 4) — 2nd architectural first
const fs = require('fs');
const path = require('path');
const SRC = fs.readFileSync(path.join(__dirname, '..', '..', '..', 'src', 'routes', 'thumbnails.js'), 'utf8');

describe('CP12 — thumbnails.js §5.21 13th 3-TIER (2nd architectural first)', () => {
  test('imports requireAuth (G6 closure)', () => {
    expect(SRC).toMatch(/const \{ requireAuth \} = require\(['"]\.\.\/middleware\/auth['"]\)/);
  });
  test('§5.41 G6: authenticateToken alias absent', () => {
    expect(SRC).not.toMatch(/authenticateToken/);
  });
  test('Tier 4 PUBLIC marker present for 7 bare GET catalog reads', () => {
    expect(SRC).toMatch(/PUBLIC: thumbnail catalog reads are Tier 4/);
  });
  test('Tier 2-equivalent POST / preserves requirePermission create', () => {
    expect(SRC).toMatch(/requireAuth,\s*\n?\s*requirePermission\('thumbnails', 'create'\)/);
  });
  test('Tier 2-equivalent PUT /:id preserves requirePermission edit', () => {
    expect(SRC).toMatch(/requireAuth,\s*\n?\s*requirePermission\('thumbnails', 'edit'\)/);
  });
  test('Tier 2-equivalent DELETE /:id preserves requirePermission delete', () => {
    expect(SRC).toMatch(/requireAuth,\s*\n?\s*requirePermission\('thumbnails', 'delete'\)/);
  });
  test('Tier 1 POST /:id/publish carries requireAuth (no requirePermission)', () => {
    expect(SRC).toMatch(/router\.post\(\s*\n?\s*'\/:id\/publish',\s*\n?\s*requireAuth,/);
  });
  test('Tier 1 POST /:id/unpublish carries requireAuth (no requirePermission)', () => {
    expect(SRC).toMatch(/router\.post\(\s*\n?\s*'\/:id\/unpublish',\s*\n?\s*requireAuth,/);
  });
  test('Tier 1 POST /:id/set-primary carries requireAuth (no requirePermission)', () => {
    expect(SRC).toMatch(/router\.post\(\s*\n?\s*'\/:id\/set-primary',\s*\n?\s*requireAuth,/);
  });
  test('Tier 4 PUBLIC bare GET / unchanged', () => {
    expect(SRC).toMatch(/router\.get\('\/', asyncHandler/);
  });
});
