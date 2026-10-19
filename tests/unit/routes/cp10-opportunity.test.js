// ============================================================================
// UNIT TESTS — opportunityRoutes.js (Step 3 CP10 — WP1 + WP3 — final lazy-noop elimination (25th file) + 9 Tier 1)
// ============================================================================
// 9 handlers all Tier 1. CP1+CP4-CP10 cumulative lazy-noop
// elimination: 25 files post-CP10 (final residue removed at CP10 per §5.8).

const fs = require('fs');
const path = require('path');

const SRC = fs.readFileSync(path.join(__dirname, '..', '..', '..', 'src', 'routes', 'opportunityRoutes.js'), 'utf8');

describe('Step 3 CP10 — opportunityRoutes.js', () => {
  test('requireAuth import (lazy-noop removed)', () => {
    // authorize joined the import when Beat 14's attach and detach became ADMIN only (Evoni, 2026-10-19).
    expect(SRC).toMatch(/const\s*\{\s*requireAuth\s*(?:,\s*authorize\s*)?\}\s*=\s*require\(['"]\.\.\/middleware\/auth['"]\)/);
  });

  test('no lazy-noop fallback (final elimination)', () => {
    expect(SRC).not.toMatch(/let\s+optionalAuth;\s*try/);
  });

  test('no optionalAuth references', () => {
    expect(SRC).not.toMatch(/\boptionalAuth\b/);
  });
});
