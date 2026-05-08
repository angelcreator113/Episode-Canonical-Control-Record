// ============================================================================
// UNIT TESTS — arcTrackingRoutes.js (Step 3 CP7 — PROMOTE, no AI)
// ============================================================================
// 3 handlers all Tier 1.

const fs = require('fs');
const path = require('path');

const SRC = fs.readFileSync(path.join(__dirname, '..', '..', '..', 'src', 'routes', 'arcTrackingRoutes.js'), 'utf8');

describe('Step 3 CP7 — arcTrackingRoutes.js PROMOTE shape', () => {
  test('imports requireAuth', () => {
    expect(SRC).toMatch(/const\s*\{\s*requireAuth\s*\}\s*=\s*require\(['"]\.\.\/middleware\/auth['"]\)/);
  });

  describe('All 3 handlers carry requireAuth', () => {
    [['get', '/arc-tracking/:characterKey'], ['post', '/arc-tracking/update'], ['post', '/world/scenes/check-eligibility']].forEach(([verb, route]) => {
      test(`${verb.toUpperCase()} ${route} → requireAuth`, () => {
        const re = new RegExp(`router\\.${verb}\\('${route.replace(/\//g, '\\/')}',\\s*requireAuth,\\s*async`);
        expect(SRC).toMatch(re);
      });
    });
  });

  test('no optionalAuth references remain', () => {
    expect(SRC).not.toMatch(/\boptionalAuth\b/);
  });
});
