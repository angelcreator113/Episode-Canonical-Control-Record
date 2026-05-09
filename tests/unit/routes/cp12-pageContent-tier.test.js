// CP12 — pageContent.js — router.use(requireAuth) preset migration (§5.41 sub-discipline)
const fs = require('fs');
const path = require('path');
const SRC = fs.readFileSync(path.join(__dirname, '..', '..', '..', 'src', 'routes', 'pageContent.js'), 'utf8');

describe('CP12 — pageContent.js router-preset migration', () => {
  test('imports requireAuth', () => {
    expect(SRC).toMatch(/const \{ requireAuth \} = require\(['"]\.\.\/middleware\/auth['"]\)/);
  });
  test('§5.41 G6: authenticateToken alias absent', () => {
    expect(SRC).not.toMatch(/authenticateToken/);
  });
  test('§5.41 sub-discipline: router.use(requireAuth) preset migrated', () => {
    expect(SRC).toMatch(/router\.use\(requireAuth\)/);
    expect(SRC).not.toMatch(/router\.use\(optionalAuth\)/);
  });
  test('no optionalAuth survivors', () => {
    expect(SRC).not.toMatch(/optionalAuth/);
  });
  test('PUT /:pageName/:constantKey carries requireAuth (was authenticateToken)', () => {
    expect(SRC).toMatch(/router\.put\('\/:pageName\/:constantKey', requireAuth,/);
  });
  test('DELETE /:pageName/:constantKey carries requireAuth (was authenticateToken)', () => {
    expect(SRC).toMatch(/router\.delete\('\/:pageName\/:constantKey', requireAuth,/);
  });
});
