// CP12 — press.js — §5.21 10th instance Tier 1 + Tier 3 (NEW shape)
// 4 POSTs Tier 1; 2 D3-verified AI overlay; 2 polymorphic factory GETs PRESERVED verbatim.
const fs = require('fs');
const path = require('path');
const SRC = fs.readFileSync(path.join(__dirname, '..', '..', '..', 'src', 'routes', 'press.js'), 'utf8');

describe('CP12 — press.js Tier 1+3 §5.21 10th instance', () => {
  test('imports both optionalAuth (factory) and requireAuth', () => {
    expect(SRC).toMatch(/const \{ optionalAuth, requireAuth \} = require\(['"]\.\.\/middleware\/auth['"]\)/);
  });
  test('imports aiRateLimiter', () => {
    expect(SRC).toMatch(/const \{ aiRateLimiter \} = require\(['"]\.\.\/middleware\/aiRateLimiter['"]\)/);
  });
  test('§5.45 polymorphic factory GET /characters PRESERVED verbatim (Tier 3)', () => {
    expect(SRC).toMatch(/router\.get\('\/characters', optionalAuth\(\{ degradeOnInfraFailure: true \}\),/);
  });
  test('§5.45 polymorphic factory GET /characters/:slug PRESERVED verbatim (Tier 3)', () => {
    expect(SRC).toMatch(/router\.get\('\/characters\/:slug', optionalAuth\(\{ degradeOnInfraFailure: true \}\),/);
  });
  test('non-AI POST /seed-characters Tier 1 (no aiRateLimiter — D3 verified)', () => {
    expect(SRC).toMatch(/router\.post\('\/seed-characters', requireAuth,/);
  });
  test('non-AI POST /advance-career Tier 1 (no aiRateLimiter — D3 verified)', () => {
    expect(SRC).toMatch(/router\.post\('\/advance-career', requireAuth,/);
  });
  test('AI POST /generate-post carries requireAuth + aiRateLimiter (safeAI helper invoked)', () => {
    expect(SRC).toMatch(/router\.post\('\/generate-post', requireAuth, aiRateLimiter,/);
  });
  test('AI POST /generate-scene carries requireAuth + aiRateLimiter (safeAI helper invoked)', () => {
    expect(SRC).toMatch(/router\.post\('\/generate-scene', requireAuth, aiRateLimiter,/);
  });
});
