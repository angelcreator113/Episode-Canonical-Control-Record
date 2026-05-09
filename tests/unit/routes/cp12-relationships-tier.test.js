// CP12 — relationships.js — lazy-noop closure + Tier 1 sweep + 2 AI POST overlay
const fs = require('fs');
const path = require('path');
const SRC = fs.readFileSync(path.join(__dirname, '..', '..', '..', 'src', 'routes', 'relationships.js'), 'utf8');

describe('CP12 — relationships.js lazy-noop closure + AI overlay', () => {
  test('imports requireAuth from middleware/auth (direct destructure)', () => {
    expect(SRC).toMatch(/const \{ requireAuth \} = require\(['"]\.\.\/middleware\/auth['"]\)/);
  });
  test('imports aiRateLimiter', () => {
    expect(SRC).toMatch(/const \{ aiRateLimiter \} = require\(['"]\.\.\/middleware\/aiRateLimiter['"]\)/);
  });
  test('lazy-noop residue absent (§5.8)', () => {
    expect(SRC).not.toMatch(/let optionalAuth/);
    expect(SRC).not.toMatch(/let requireAuth\s*;/);
  });
  test('no optionalAuth survivors', () => {
    expect(SRC).not.toMatch(/optionalAuth/);
  });
  test('AI POST /generate carries requireAuth + aiRateLimiter', () => {
    expect(SRC).toMatch(/router\.post\('\/generate', requireAuth, aiRateLimiter,/);
  });
  test('AI POST /generate-family carries requireAuth + aiRateLimiter', () => {
    expect(SRC).toMatch(/router\.post\('\/generate-family', requireAuth, aiRateLimiter,/);
  });
  test('GET / carries requireAuth (Tier 1)', () => {
    expect(SRC).toMatch(/router\.get\('\/', requireAuth,/);
  });
});
