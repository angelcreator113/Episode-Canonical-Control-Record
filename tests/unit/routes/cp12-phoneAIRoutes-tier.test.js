// CP12 — phoneAIRoutes.js — PE #7 §5.43 reference model gap closure (V3 param-in-mount sub-form)
const fs = require('fs');
const path = require('path');
const SRC = fs.readFileSync(path.join(__dirname, '..', '..', '..', 'src', 'routes', 'phoneAIRoutes.js'), 'utf8');

describe('CP12 — phoneAIRoutes.js PE #7 closure (§5.43 ref model)', () => {
  test('imports requireAuth', () => {
    expect(SRC).toMatch(/const \{ requireAuth \} = require\(['"]\.\.\/middleware\/auth['"]\)/);
  });
  test('imports aiRateLimiter (PE #7 closure)', () => {
    expect(SRC).toMatch(/const \{ aiRateLimiter \} = require\(['"]\.\.\/middleware\/aiRateLimiter['"]\)/);
  });
  test('AI POST /add-zones carries requireAuth + aiRateLimiter', () => {
    expect(SRC).toMatch(/router\.post\('\/add-zones', requireAuth, aiRateLimiter,/);
  });
  test('AI POST /fill-content-zone carries requireAuth + aiRateLimiter', () => {
    expect(SRC).toMatch(/router\.post\('\/fill-content-zone', requireAuth, aiRateLimiter,/);
  });
});
