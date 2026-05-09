// CP12 — tierFeatures.js — cross-domain sweep — Tier 1 + 6 AI POST overlay
const fs = require('fs');
const path = require('path');
const SRC = fs.readFileSync(path.join(__dirname, '..', '..', '..', 'src', 'routes', 'tierFeatures.js'), 'utf8');

describe('CP12 — tierFeatures.js Tier 1 sweep + aiRateLimiter overlay', () => {
  test('imports requireAuth from middleware/auth', () => {
    expect(SRC).toMatch(/const \{ requireAuth \} = require\(['"]\.\.\/middleware\/auth['"]\)/);
  });
  test('imports aiRateLimiter from middleware/aiRateLimiter', () => {
    expect(SRC).toMatch(/const \{ aiRateLimiter \} = require\(['"]\.\.\/middleware\/aiRateLimiter['"]\)/);
  });
  test('lazy-noop residue absent (§5.8 closure)', () => {
    expect(SRC).not.toMatch(/let optionalAuth/);
    expect(SRC).not.toMatch(/try\s*\{[^}]*require\(['"]\.\.\/middleware\/auth['"]\)/);
  });
  test('no optionalAuth-on-writes survivors (§5.21 G1 closure)', () => {
    expect(SRC).not.toMatch(/router\.(post|put|patch|delete)\([^)]*optionalAuth/);
  });
  test('AI POST /continuity-check carries requireAuth + aiRateLimiter', () => {
    expect(SRC).toMatch(/router\.post\('\/continuity-check', requireAuth, aiRateLimiter,/);
  });
  test('AI POST /plot-hole-detection carries requireAuth + aiRateLimiter', () => {
    expect(SRC).toMatch(/router\.post\('\/plot-hole-detection', requireAuth, aiRateLimiter,/);
  });
  test('AI POST /generate-chapter-beats carries requireAuth + aiRateLimiter', () => {
    expect(SRC).toMatch(/router\.post\('\/generate-chapter-beats', requireAuth, aiRateLimiter,/);
  });
  test('AI POST /generate-book-outline carries requireAuth + aiRateLimiter', () => {
    expect(SRC).toMatch(/router\.post\('\/generate-book-outline', requireAuth, aiRateLimiter,/);
  });
  test('non-AI write /relationship-events carries requireAuth (no aiRateLimiter)', () => {
    expect(SRC).toMatch(/router\.post\('\/relationship-events', requireAuth, async/);
  });
});
