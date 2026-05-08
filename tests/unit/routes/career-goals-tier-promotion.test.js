// ============================================================================
// UNIT TESTS — careerGoals.js (Step 3 CP7 — PROMOTE, no AI)
// ============================================================================
// 7 handlers all Tier 1. Lazy-noop fallback at L20-26 removed.

const fs = require('fs');
const path = require('path');

const SRC = fs.readFileSync(path.join(__dirname, '..', '..', '..', 'src', 'routes', 'careerGoals.js'), 'utf8');

describe('Step 3 CP7 — careerGoals.js PROMOTE shape', () => {
  test('imports requireAuth (lazy-noop removed)', () => {
    expect(SRC).toMatch(/const\s*\{\s*requireAuth\s*\}\s*=\s*require\(['"]\.\.\/middleware\/auth['"]\)/);
  });

  describe('All 7 handlers carry requireAuth', () => {
    [
      ['get', '/world/:showId/goals'],
      ['post', '/world/:showId/goals/seed'],
      ['post', '/world/:showId/goals'],
      ['put', '/world/:showId/goals/:goalId'],
      ['delete', '/world/:showId/goals/:goalId'],
      ['post', '/world/:showId/goals/sync'],
      ['get', '/world/:showId/suggest-events'],
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
