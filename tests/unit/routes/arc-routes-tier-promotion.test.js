// ============================================================================
// UNIT TESTS — arcRoutes.js (Step 3 CP7 — PROMOTE, no AI)
// ============================================================================
// 7 handlers all Tier 1. Lazy-noop fallback at L19-25 removed.

const fs = require('fs');
const path = require('path');

const SRC = fs.readFileSync(path.join(__dirname, '..', '..', '..', 'src', 'routes', 'arcRoutes.js'), 'utf8');

describe('Step 3 CP7 — arcRoutes.js PROMOTE shape', () => {
  test('imports requireAuth (lazy-noop removed)', () => {
    expect(SRC).toMatch(/const\s*\{\s*requireAuth\s*\}\s*=\s*require\(['"]\.\.\/middleware\/auth['"]\)/);
  });

  describe('All 7 handlers carry requireAuth', () => {
    [
      ['get', '/world/:showId/arc'],
      ['post', '/world/:showId/arc/seed'],
      ['post', '/world/:showId/arc/advance'],
      ['post', '/world/:showId/arc/advance/confirm'],
      ['get', '/world/:showId/arc/context'],
      ['put', '/world/:showId/arc/phase/:phase'],
      ['post', '/world/:showId/arc/extend'],
    ].forEach(([verb, route]) => {
      test(`${verb.toUpperCase()} ${route} → requireAuth`, () => {
        const re = new RegExp(`router\\.${verb}\\('${route.replace(/\//g, '\\/')}',\\s*requireAuth,\\s*async`);
        expect(SRC).toMatch(re);
      });
    });
  });

  test('no optionalAuth references remain', () => {
    expect(SRC).not.toMatch(/\boptionalAuth\b/);
  });

  test('no lazy-noop fallback', () => {
    expect(SRC).not.toMatch(/let\s+optionalAuth;\s*try/);
  });
});
