// CP12 — episodeScriptWriterRoutes.js — PE #7 §5.43 reference model gap closure (service-mediated AI POST)
// The four reads are an ADMIN's since 2026-11-22 (Evoni;
// docs/audit/F-AUTH-1_ScriptReads_AdminOnly_Amendment2_2026-11-22.md). How
// they behave is in episodeScriptWriter-reads-admin-only.test.js.
const fs = require('fs');
const path = require('path');
const SRC = fs.readFileSync(path.join(__dirname, '..', '..', '..', 'src', 'routes', 'episodeScriptWriterRoutes.js'), 'utf8');

describe('CP12 — episodeScriptWriterRoutes.js PE #7 closure (service-mediated)', () => {
  test('imports requireAuth + authorize', () => {
    expect(SRC).toMatch(/const \{ requireAuth, authorize \} = require\(['"]\.\.\/middleware\/auth['"]\)/);
  });
  test('imports aiRateLimiter (PE #7 closure)', () => {
    expect(SRC).toMatch(/const \{ aiRateLimiter \} = require\(['"]\.\.\/middleware\/aiRateLimiter['"]\)/);
  });
  test('AI POST /:episodeId/generate (service-mediated) carries requireAuth + aiRateLimiter', () => {
    expect(SRC).toMatch(/router\.post\('\/:episodeId\/generate', requireAuth, aiRateLimiter,/);
  });
  test('GET /:episodeId carries requireAuth + authorize([\'ADMIN\']) (was Tier 1)', () => {
    expect(SRC).toMatch(/router\.get\('\/:episodeId', requireAuth, authorize\(\['ADMIN'\]\),/);
  });
  test('every GET in the file carries both, and there are four', () => {
    const gets = SRC.match(/^router\.get\(.*$/gm) || [];
    expect(gets).toHaveLength(4);
    for (const line of gets) expect(line).toMatch(/requireAuth, authorize\(\['ADMIN'\]\),/);
  });
  test('no write names the admin group: they are Tier 1 as CP12 left them', () => {
    const writes = SRC.match(/^router\.(post|put|patch|delete)\(.*$/gm) || [];
    expect(writes).toHaveLength(3);
    for (const line of writes) {
      expect(line).toMatch(/\brequireAuth\b/);
      expect(line).not.toMatch(/authorize/);
    }
  });
  test('non-AI PUT /:scriptId carries requireAuth (Tier 1)', () => {
    expect(SRC).toMatch(/router\.put\('\/:scriptId', requireAuth,/);
  });
});
