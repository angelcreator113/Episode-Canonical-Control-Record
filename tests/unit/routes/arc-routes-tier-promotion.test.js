// ============================================================================
// UNIT TESTS — arcRoutes.js (Step 3 CP7 — PROMOTE, no AI)
// ============================================================================
// 18 handlers; 17 pinned here (the AI draft route below). Lazy-noop fallback at L19-25 removed.

const fs = require('fs');
const path = require('path');

const SRC = fs.readFileSync(path.join(__dirname, '..', '..', '..', 'src', 'routes', 'arcRoutes.js'), 'utf8');

describe('Step 3 CP7 — arcRoutes.js PROMOTE shape', () => {
  test('imports requireAuth (lazy-noop removed)', () => {
    expect(SRC).toMatch(/const\s*\{\s*requireAuth\s*\}\s*=\s*require\(['"]\.\.\/middleware\/auth['"]\)/);
  });

  describe('All 17 handlers carry requireAuth', () => {
    [
      ['get', '/world/:showId/arc'],
      ['post', '/world/:showId/arc/seed'],
      ['post', '/world/:showId/arc/advance'],
      ['post', '/world/:showId/arc/advance/confirm'],
      ['get', '/world/:showId/arc/context'],
      ['put', '/world/:showId/arc/phase/:phase'],
      ['get', '/world/:showId/season/roadmap'],
      ['put', '/world/:showId/season/slots/:slotId/event'],
      ['put', '/world/:showId/season/slots/:slotId/episode'],
      ['put', '/world/:showId/season/slots/:slotId/intention'],
      ['get', '/world/:showId/season/event/:eventId'],
      ['get', '/world/:showId/season/threads'],
      ['post', '/world/:showId/season/threads'],
      ['put', '/world/:showId/season/threads/:threadId'],
      ['post', '/world/:showId/season/threads/:threadId/close'],
      ['post', '/world/:showId/season/threads/:threadId/reopen'],
      ['get', '/world/:showId/season/insights'],
    ].forEach(([verb, route]) => {
      test(`${verb.toUpperCase()} ${route} → requireAuth`, () => {
        const re = new RegExp(`router\\.${verb}\\('${route.replace(/\//g, '\\/')}',\\s*requireAuth,\\s*async`);
        expect(SRC).toMatch(re);
      });
    });
  });

  test('no Extend route: the season stays 24 slots (§8(ff) Q2)', () => {
    expect(SRC).not.toMatch(/router\.post\('\/world\/:showId\/arc\/extend'/);
  });

  test('the intention draft route is requireAuth + aiRateLimiter (it calls Claude)', () => {
    expect(SRC).toMatch(/router\.post\('\/world\/:showId\/season\/slots\/:slotId\/intention\/draft',\s*requireAuth,\s*aiRateLimiter,\s*async/);
  });

  test('no optionalAuth references remain', () => {
    expect(SRC).not.toMatch(/\boptionalAuth\b/);
  });

  test('no lazy-noop fallback', () => {
    expect(SRC).not.toMatch(/let\s+optionalAuth;\s*try/);
  });
});
