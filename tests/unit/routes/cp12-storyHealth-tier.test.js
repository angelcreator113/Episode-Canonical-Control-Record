// CP12 — storyHealth.js — lazy-noop closure + Tier 1 sweep
const fs = require('fs');
const path = require('path');
const SRC = fs.readFileSync(path.join(__dirname, '..', '..', '..', 'src', 'routes', 'storyHealth.js'), 'utf8');

describe('CP12 — storyHealth.js lazy-noop closure', () => {
  test('imports requireAuth', () => {
    expect(SRC).toMatch(/const \{ requireAuth \} = require\(['"]\.\.\/middleware\/auth['"]\)/);
  });
  test('lazy-noop residue absent (§5.8)', () => {
    expect(SRC).not.toMatch(/let optionalAuth/);
  });
  test('no optionalAuth survivors', () => {
    expect(SRC).not.toMatch(/optionalAuth/);
  });
  test('GET /dashboard carries requireAuth', () => {
    expect(SRC).toMatch(/router\.get\('\/dashboard', requireAuth,/);
  });
  test('POST /versions/chapter/:chapterId carries requireAuth', () => {
    expect(SRC).toMatch(/router\.post\('\/versions\/chapter\/:chapterId', requireAuth,/);
  });
  test('GET /search carries requireAuth', () => {
    expect(SRC).toMatch(/router\.get\('\/search', requireAuth,/);
  });
});
