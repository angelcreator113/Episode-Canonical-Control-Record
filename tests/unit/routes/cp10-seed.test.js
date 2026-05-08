// ============================================================================
// UNIT TESTS — seed.js (Step 3 CP10 — WP6 — Tier 5 env-gated (app.js mount) + Tier 2 inside (3 handlers; Item 7))
// ============================================================================
// 3 POST handlers all Tier 2 per §5.3 Item 7 lock.
// Tier 5 mount-expression env gate in src/app.js (NODE_ENV !== 'production').

const fs = require('fs');
const path = require('path');

const SRC = fs.readFileSync(path.join(__dirname, '..', '..', '..', 'src', 'routes', 'seed.js'), 'utf8');

describe('Step 3 CP10 — seed.js', () => {
  test('requireAuth + authorize import', () => {
    expect(SRC).toMatch(/const\s*\{\s*requireAuth,\s*authorize\s*\}\s*=\s*require\(['"]\.\.\/middleware\/auth['"]\)/);
  });

  test('POST /episodes Tier 2', () => {
    expect(SRC).toMatch(/router\.post\('\/episodes',\s*requireAuth,\s*authorize\(\['ADMIN'\]\),/);
  });

  test('POST /templates Tier 2', () => {
    expect(SRC).toMatch(/router\.post\('\/templates',\s*requireAuth,\s*authorize\(\['ADMIN'\]\),/);
  });

  test('POST /all Tier 2', () => {
    expect(SRC).toMatch(/router\.post\('\/all',\s*requireAuth,\s*authorize\(\['ADMIN'\]\),/);
  });
});
