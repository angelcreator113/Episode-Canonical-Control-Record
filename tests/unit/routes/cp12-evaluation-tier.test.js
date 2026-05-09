// CP12 — evaluation.js — lazy-noop closure + Tier 1 sweep + §5.51 NEW Tier 2 escalation (L136 admin)
const fs = require('fs');
const path = require('path');
const SRC = fs.readFileSync(path.join(__dirname, '..', '..', '..', 'src', 'routes', 'evaluation.js'), 'utf8');

describe('CP12 — evaluation.js lazy-noop closure + §5.51 escalation', () => {
  test('imports requireAuth + authorize', () => {
    expect(SRC).toMatch(/const \{ requireAuth, authorize \} = require\(['"]\.\.\/middleware\/auth['"]\)/);
  });
  test('lazy-noop residue absent', () => {
    expect(SRC).not.toMatch(/let optionalAuth/);
  });
  test('§5.51 escalation: POST /admin/reset-character-stats Tier 2 (requireAuth + authorize ADMIN)', () => {
    expect(SRC).toMatch(/router\.post\('\/admin\/reset-character-stats', requireAuth, authorize\(\['ADMIN'\]\),/);
  });
  test('POST /episodes/:id/evaluate carries requireAuth (Tier 1)', () => {
    expect(SRC).toMatch(/router\.post\('\/episodes\/:id\/evaluate', requireAuth,/);
  });
  test('POST /episodes/:id/override carries requireAuth (Tier 1)', () => {
    expect(SRC).toMatch(/router\.post\('\/episodes\/:id\/override', requireAuth,/);
  });
  test('GET /characters/:key/state carries requireAuth (Tier 1)', () => {
    expect(SRC).toMatch(/router\.get\('\/characters\/:key\/state', requireAuth,/);
  });
});
