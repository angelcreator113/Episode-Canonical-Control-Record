// ============================================================================
// UNIT TESTS — jobs.js (Step 3 CP10 — WP2 — 5 legacy authenticateToken → requireAuth conversions)
// ============================================================================
// 5 handlers all Tier 1 (was authenticateToken legacy alias; converted per §5.41).

const fs = require('fs');
const path = require('path');

const SRC = fs.readFileSync(path.join(__dirname, '..', '..', '..', 'src', 'routes', 'jobs.js'), 'utf8');

describe('Step 3 CP10 — jobs.js', () => {
  test('requireAuth import', () => {
    expect(SRC).toMatch(/const\s*\{\s*requireAuth\s*\}\s*=\s*require\(['"]\.\.\/middleware\/auth['"]\)/);
  });

  test('no authenticateToken legacy alias', () => {
    expect(SRC).not.toMatch(/\bauthenticateToken\b/);
  });
});
