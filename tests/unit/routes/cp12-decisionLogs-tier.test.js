// CP12 — decisionLogs.js — Tier 1 sweep
const fs = require('fs');
const path = require('path');
const SRC = fs.readFileSync(path.join(__dirname, '..', '..', '..', 'src', 'routes', 'decisionLogs.js'), 'utf8');

describe('CP12 — decisionLogs.js Tier 1 sweep', () => {
  test('imports requireAuth', () => {
    expect(SRC).toMatch(/const \{ requireAuth \} = require\(['"]\.\.\/middleware\/auth['"]\)/);
  });
  test('no optionalAuth survivors', () => {
    expect(SRC).not.toMatch(/optionalAuth/);
  });
  test('POST / carries requireAuth', () => {
    expect(SRC).toMatch(/router\.post\('\/', requireAuth,/);
  });
  test('GET /episode/:episodeId carries requireAuth', () => {
    expect(SRC).toMatch(/router\.get\('\/episode\/:episodeId', requireAuth,/);
  });
  test('GET /scene/:sceneId carries requireAuth', () => {
    expect(SRC).toMatch(/router\.get\('\/scene\/:sceneId', requireAuth,/);
  });
});
