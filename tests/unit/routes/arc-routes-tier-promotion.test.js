// ============================================================================
// UNIT TESTS — arcRoutes.js (Step 3 CP7 — PROMOTE, no AI)
// ============================================================================
// 25 handlers; 23 pinned here (the two AI routes, the intention draft and the season proposal, below). Lazy-noop fallback at L19-25 removed.

const fs = require('fs');
const path = require('path');

const SRC = fs.readFileSync(path.join(__dirname, '..', '..', '..', 'src', 'routes', 'arcRoutes.js'), 'utf8');

describe('Step 3 CP7 — arcRoutes.js PROMOTE shape', () => {
  test('imports requireAuth, and authorize for the season setup writes (lazy-noop removed)', () => {
    expect(SRC).toMatch(/const\s*\{\s*requireAuth,\s*authorize\s*\}\s*=\s*require\(['"]\.\.\/middleware\/auth['"]\)/);
  });

  describe('The other handlers carry requireAuth', () => {
    [
      ['get', '/world/:showId/arc'],
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
      // Season arc proposals from the feed (2026-10-17).
      ['get', '/world/:showId/season/proposals'],
      ['post', '/world/:showId/season/proposals/:proposalId/accept'],
      ['post', '/world/:showId/season/proposals/:proposalId/dismiss'],
      // The reveal plan (stage E, 2026-10-18).
      ['get', '/world/:showId/season/reveals'],
      ['put', '/world/:showId/season/reveals'],
      ['delete', '/world/:showId/season/reveals/:revealId'],
    ].forEach(([verb, route]) => {
      test(`${verb.toUpperCase()} ${route} → requireAuth`, () => {
        const re = new RegExp(`router\\.${verb}\\('${route.replace(/\//g, '\\/')}',\\s*requireAuth,\\s*async`);
        expect(SRC).toMatch(re);
      });
    });
  });

  // Setting up a season (Evoni, 2026-10-24): the writes are admin-only on top of requireAuth.
  describe('The season setup writes carry requireAuth + authorize([\'ADMIN\'])', () => {
    [
      ['post', '/world/:showId/arc/seed'],
      ['put', '/world/:showId/arc/setup'],
      ['post', '/world/:showId/season/placement'],
      ['post', '/world/:showId/season/draft/accept'],
    ].forEach(([verb, route]) => {
      test(`${verb.toUpperCase()} ${route} → requireAuth + ADMIN`, () => {
        const re = new RegExp(`router\\.${verb}\\('${route.replace(/\//g, '\\/')}',\\s*requireAuth,\\s*authorize\\(\\['ADMIN'\\]\\),\\s*async`);
        expect(SRC).toMatch(re);
      });
    });
    test('GET /world/:showId/season/placement (the preview) → requireAuth', () => {
      expect(SRC).toMatch(/router\.get\('\/world\/:showId\/season\/placement',\s*requireAuth,\s*async/);
    });
    test('drafting the season is requireAuth + ADMIN + aiRateLimiter (it calls Claude)', () => {
      expect(SRC).toMatch(/router\.post\('\/world\/:showId\/season\/draft',\s*requireAuth,\s*authorize\(\['ADMIN'\]\),\s*aiRateLimiter,\s*async/);
    });
  });

  test('no Extend route: the season stays 24 slots (§8(ff) Q2)', () => {
    expect(SRC).not.toMatch(/router\.post\('\/world\/:showId\/arc\/extend'/);
  });

  test('the intention draft route is requireAuth + aiRateLimiter (it calls Claude)', () => {
    expect(SRC).toMatch(/router\.post\('\/world\/:showId\/season\/slots\/:slotId\/intention\/draft',\s*requireAuth,\s*aiRateLimiter,\s*async/);
  });

  test('asking for a season proposal is requireAuth + aiRateLimiter (it calls Claude)', () => {
    expect(SRC).toMatch(/router\.post\('\/world\/:showId\/season\/proposals',\s*requireAuth,\s*aiRateLimiter,\s*async/);
  });

  test('no optionalAuth references remain', () => {
    expect(SRC).not.toMatch(/\boptionalAuth\b/);
  });

  test('no lazy-noop fallback', () => {
    expect(SRC).not.toMatch(/let\s+optionalAuth;\s*try/);
  });
});
