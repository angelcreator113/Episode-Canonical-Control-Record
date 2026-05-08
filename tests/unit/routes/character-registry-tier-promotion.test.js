// ============================================================================
// UNIT TESTS — characterRegistry.js anchor file (Step 3 CP6, D1 + D9 locks)
// ============================================================================
// 37 handlers — 36 promoted to Tier 1 (requireAuth) + 1 PRESERVED at L1882
// (formerly L1896 pre-edit; reference shape requireAuth + aiRateLimiter, the
// first anchor file in F-AUTH-1 zone with built-in reference pattern at
// surface time per CP6 architectural finding).
// Dual lazy-noop fallback at L12-26 (both optionalAuth + requireAuth) removed.
// Item 16 inspection: L658 isAuthor field-filtering is response-shape only,
// NOT a permission gate — defaults to Tier 1 per D6 (NOT escalated to Tier 2).

const fs = require('fs');
const path = require('path');

const SRC = fs.readFileSync(path.join(__dirname, '..', '..', '..', 'src', 'routes', 'characterRegistry.js'), 'utf8');

describe('Step 3 CP6 — characterRegistry.js anchor file Tier 1 sweep', () => {
  test('imports requireAuth from middleware/auth (lazy-noop dual fallback removed)', () => {
    expect(SRC).toMatch(/const\s*\{\s*requireAuth\s*\}\s*=\s*require\(['"]\.\.\/middleware\/auth['"]\)/);
  });

  test('imports aiRateLimiter (preserved — used by reference handler)', () => {
    expect(SRC).toMatch(/const\s*\{\s*aiRateLimiter\s*\}\s*=\s*require\(['"]\.\.\/middleware\/aiRateLimiter['"]\)/);
  });

  test('every handler line carries requireAuth (37 router.<verb> definitions)', () => {
    const handlers = SRC.match(/^router\.(get|post|put|patch|delete)\([^\n]+/gm) || [];
    expect(handlers.length).toBe(37);
    handlers.forEach((line) => {
      expect(line).toMatch(/\brequireAuth\b/);
    });
  });

  describe('D9 — reference handler at /characters/:id/deep-profile/generate is preserved verbatim', () => {
    test('preserves exact "requireAuth, aiRateLimiter" reference shape', () => {
      expect(SRC).toMatch(/router\.post\('\/characters\/:id\/deep-profile\/generate',\s*requireAuth,\s*aiRateLimiter,\s*async/);
    });
    test('reference handler has not been duplicated or re-applied', () => {
      const refMatches = SRC.match(/\/characters\/:id\/deep-profile\/generate'/g) || [];
      expect(refMatches.length).toBe(1);
    });
  });

  describe('CP6 zone hygiene', () => {
    test('no optionalAuth handler-references remain', () => {
      // Only requireAuth handler-references; the handler bodies may still
      // read req.user (Item 16 isAuthor at L658) — that's fine.
      const handlers = SRC.match(/^router\.(get|post|put|patch|delete)\([^\n]+/gm) || [];
      handlers.forEach((line) => {
        expect(line).not.toMatch(/\boptionalAuth\b/);
      });
    });
    test('no lazy-noop fallback ((req,res,next)=>next())', () => {
      expect(SRC).not.toMatch(/\(\(req,\s*res,\s*next\)\s*=>\s*next\(\)\)/);
    });
    test('no try/catch require pattern for auth import', () => {
      expect(SRC).not.toMatch(/try\s*\{[\s\S]{0,200}require\(['"]\.\.\/middleware\/auth['"]\)/);
    });
  });

  describe('Item 16 inspection (D6 — defaults Tier 1; escalation NOT triggered)', () => {
    test('author-gate at L658 remains in handler body (response-shape filtering, not permission gate)', () => {
      expect(SRC).toMatch(/isAuthor\s*=\s*req\.user\?\.role\s*===\s*'author'/);
    });
    test('no authorize\\(\\[\'ADMIN\'\\]\\) calls were added (Item 16 NOT escalated)', () => {
      expect(SRC).not.toMatch(/authorize\(\[?'ADMIN'\]?\)/);
    });
  });

  describe('Per-handler structural assertions — anchor file', () => {
    const handlerSamples = [
      ['get', '/registries'],
      ['post', '/registries'],
      ['get', '/registries/default'],
      ['get', '/registries/:id'],
      ['put', '/registries/:id'],
      ['delete', '/registries/:id'],
      ['post', '/registries/:id/characters'],
      ['get', '/characters/:id'],
      ['post', '/characters/:id/plot-threads'],
      ['put', '/characters/:id'],
      ['delete', '/characters/:id'],
      ['post', '/characters/bulk-delete'],
      ['post', '/characters/bulk-status'],
      ['post', '/characters/bulk-move'],
      ['post', '/characters/:id/clone'],
      ['post', '/characters/:id/portrait'],
      ['delete', '/characters/:id/portrait'],
      ['post', '/characters/:id/sync-social'],
      ['post', '/characters/sync-all-social'],
    ];
    handlerSamples.forEach(([verb, route]) => {
      test(`${verb.toUpperCase()} ${route} carries requireAuth`, () => {
        const escaped = route.replace(/\//g, '\\/').replace(/:/g, ':');
        const re = new RegExp(`router\\.${verb}\\('${escaped}',\\s*requireAuth\\b`);
        expect(SRC).toMatch(re);
      });
    });
  });
});
