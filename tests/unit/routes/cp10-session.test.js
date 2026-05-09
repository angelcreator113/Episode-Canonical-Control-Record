// ============================================================================
// UNIT TESTS — session.js (Step 3 CP10 — WP3 — 1 Tier 1 ADD)
// ============================================================================
// 1 handler — Tier 1 (was no-auth pre-CP10).

const fs = require('fs');
const path = require('path');

const SRC = fs.readFileSync(path.join(__dirname, '..', '..', '..', 'src', 'routes', 'session.js'), 'utf8');

describe('Step 3 CP10 — session.js', () => {
  test('requireAuth import', () => {
    expect(SRC).toMatch(/const\s*\{\s*requireAuth\s*\}\s*=\s*require\(['"]\.\.\/middleware\/auth['"]\)/);
  });

  test('GET /brief carries requireAuth', () => {
    expect(SRC).toMatch(/router\.get\('\/brief',\s*requireAuth,/);
  });
});
