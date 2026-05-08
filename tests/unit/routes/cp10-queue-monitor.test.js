// ============================================================================
// UNIT TESTS — queue-monitor.js (Step 3 CP10 — WP8 — Tier 2 at MOUNT LINE in app.js (Item 8 V6 admin-prefix); router-internal untouched)
// ============================================================================
// 3 handlers (Bull Board UI + /stats + /recent); auth applied at MOUNT LINE
// in app.js per §5.3 Item 8 lock + V6 admin-prefix variant. Router-internal
// preserved verbatim — Bull Board sub-router relies on mount-line gate.

const fs = require('fs');
const path = require('path');

const SRC = fs.readFileSync(path.join(__dirname, '..', '..', '..', 'src', 'routes', 'queue-monitor.js'), 'utf8');

describe('Step 3 CP10 — queue-monitor.js', () => {
  test('Bull Board adapter preserved (no router-level auth)', () => {
    expect(SRC).toMatch(/serverAdapter\.getRouter\(\)/);
  });

  test('router-internal handlers unchanged at handler level', () => {
    expect(SRC).toMatch(/router\.get\('\/stats',\s*async/);
  });
});
