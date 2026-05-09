// CP12 — calendarRoutes.js — Tier 1 sweep + router.use(requireAuth) preset (§5.41 sub-discipline)
const fs = require('fs');
const path = require('path');
const SRC = fs.readFileSync(path.join(__dirname, '..', '..', '..', 'src', 'routes', 'calendarRoutes.js'), 'utf8');

describe('CP12 — calendarRoutes.js router-preset migration + AI overlay', () => {
  test('imports requireAuth from middleware/auth', () => {
    expect(SRC).toMatch(/const \{ requireAuth \} = require\(['"]\.\.\/middleware\/auth['"]\)/);
  });
  test('imports aiRateLimiter for AI handlers', () => {
    expect(SRC).toMatch(/const \{ aiRateLimiter \} = require\(['"]\.\.\/middleware\/aiRateLimiter['"]\)/);
  });
  test('router.use(requireAuth) preset migrated from optionalAuth', () => {
    expect(SRC).toMatch(/router\.use\(requireAuth\)/);
    expect(SRC).not.toMatch(/router\.use\(optionalAuth\)/);
  });
  test('no optionalAuth survivors', () => {
    expect(SRC).not.toMatch(/optionalAuth/);
  });
  test('AI POST /events/:id/ripples/generate carries requireAuth + aiRateLimiter', () => {
    expect(SRC).toMatch(/router\.post\('\/events\/:id\/ripples\/generate', requireAuth, aiRateLimiter,/);
  });
  test('AI POST /auto-detect carries requireAuth + aiRateLimiter', () => {
    expect(SRC).toMatch(/router\.post\('\/auto-detect', requireAuth, aiRateLimiter,/);
  });
  test('non-AI write /markers carries requireAuth', () => {
    expect(SRC).toMatch(/router\.post\('\/markers', requireAuth,/);
  });
});
