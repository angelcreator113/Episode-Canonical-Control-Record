// CP12 — therapy.js — lazy-noop closure + Tier 1 sweep + 5 AI overlay (incl. AI GET)
const fs = require('fs');
const path = require('path');
const SRC = fs.readFileSync(path.join(__dirname, '..', '..', '..', 'src', 'routes', 'therapy.js'), 'utf8');

describe('CP12 — therapy.js lazy-noop closure + AI overlay', () => {
  test('imports requireAuth', () => {
    expect(SRC).toMatch(/const \{ requireAuth \} = require\(['"]\.\.\/middleware\/auth['"]\)/);
  });
  test('imports aiRateLimiter', () => {
    expect(SRC).toMatch(/const \{ aiRateLimiter \} = require\(['"]\.\.\/middleware\/aiRateLimiter['"]\)/);
  });
  test('lazy-noop residue absent', () => {
    expect(SRC).not.toMatch(/let optionalAuth/);
  });
  test('AI POST /session-open carries requireAuth + aiRateLimiter', () => {
    expect(SRC).toMatch(/router\.post\('\/session-open', requireAuth, aiRateLimiter,/);
  });
  test('AI POST /session-respond carries requireAuth + aiRateLimiter', () => {
    expect(SRC).toMatch(/router\.post\('\/session-respond', requireAuth, aiRateLimiter,/);
  });
  test('AI POST /reveal carries requireAuth + aiRateLimiter', () => {
    expect(SRC).toMatch(/router\.post\('\/reveal', requireAuth, aiRateLimiter,/);
  });
  test('AI GET /dilemmas carries requireAuth + aiRateLimiter (rare AI-on-GET pattern)', () => {
    expect(SRC).toMatch(/router\.get\('\/dilemmas', requireAuth, aiRateLimiter,/);
  });
  test('AI POST /dilemma-profile carries requireAuth + aiRateLimiter', () => {
    expect(SRC).toMatch(/router\.post\('\/dilemma-profile', requireAuth, aiRateLimiter,/);
  });
});
