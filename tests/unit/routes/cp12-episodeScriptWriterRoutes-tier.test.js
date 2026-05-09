// CP12 — episodeScriptWriterRoutes.js — PE #7 §5.43 reference model gap closure (service-mediated AI POST)
const fs = require('fs');
const path = require('path');
const SRC = fs.readFileSync(path.join(__dirname, '..', '..', '..', 'src', 'routes', 'episodeScriptWriterRoutes.js'), 'utf8');

describe('CP12 — episodeScriptWriterRoutes.js PE #7 closure (service-mediated)', () => {
  test('imports requireAuth', () => {
    expect(SRC).toMatch(/const \{ requireAuth \} = require\(['"]\.\.\/middleware\/auth['"]\)/);
  });
  test('imports aiRateLimiter (PE #7 closure)', () => {
    expect(SRC).toMatch(/const \{ aiRateLimiter \} = require\(['"]\.\.\/middleware\/aiRateLimiter['"]\)/);
  });
  test('AI POST /:episodeId/generate (service-mediated) carries requireAuth + aiRateLimiter', () => {
    expect(SRC).toMatch(/router\.post\('\/:episodeId\/generate', requireAuth, aiRateLimiter,/);
  });
  test('non-AI GET /:episodeId carries requireAuth (Tier 1)', () => {
    expect(SRC).toMatch(/router\.get\('\/:episodeId', requireAuth,/);
  });
  test('non-AI PUT /:scriptId carries requireAuth (Tier 1)', () => {
    expect(SRC).toMatch(/router\.put\('\/:scriptId', requireAuth,/);
  });
});
