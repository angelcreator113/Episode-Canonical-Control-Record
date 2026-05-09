// CP12 — consciousness.js — lazy-noop closure + Tier 1 sweep + 4 AI overlay
const fs = require('fs');
const path = require('path');
const SRC = fs.readFileSync(path.join(__dirname, '..', '..', '..', 'src', 'routes', 'consciousness.js'), 'utf8');

describe('CP12 — consciousness.js lazy-noop closure + AI overlay', () => {
  test('imports requireAuth', () => {
    expect(SRC).toMatch(/const \{ requireAuth \} = require\(['"]\.\.\/middleware\/auth['"]\)/);
  });
  test('imports aiRateLimiter', () => {
    expect(SRC).toMatch(/const \{ aiRateLimiter \} = require\(['"]\.\.\/middleware\/aiRateLimiter['"]\)/);
  });
  test('lazy-noop residue absent', () => {
    expect(SRC).not.toMatch(/let optionalAuth/);
  });
  test('AI POST /generate carries requireAuth + aiRateLimiter', () => {
    expect(SRC).toMatch(/router\.post\('\/generate', requireAuth, aiRateLimiter,/);
  });
  test('AI POST /generate-lala carries requireAuth + aiRateLimiter', () => {
    expect(SRC).toMatch(/router\.post\('\/generate-lala', requireAuth, aiRateLimiter,/);
  });
  test('AI POST /dilemma-triggers carries requireAuth + aiRateLimiter', () => {
    expect(SRC).toMatch(/router\.post\('\/dilemma-triggers', requireAuth, aiRateLimiter,/);
  });
  test('AI POST /interview-next carries requireAuth + aiRateLimiter', () => {
    expect(SRC).toMatch(/router\.post\('\/interview-next', requireAuth, aiRateLimiter,/);
  });
  test('non-AI POST /save carries requireAuth', () => {
    expect(SRC).toMatch(/router\.post\('\/save', requireAuth,/);
  });
});
