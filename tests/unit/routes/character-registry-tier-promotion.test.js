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
    // #1699: userInGroup joins the same import for the isAuthor field filter.
    // Evoni, 2026-10-19: authorize joins it for the ADMIN-only profile writes.
    expect(SRC).toMatch(/const\s*\{\s*requireAuth\s*,\s*userInGroup\s*,\s*authorize\s*\}\s*=\s*require\(['"]\.\.\/middleware\/auth['"]\)/);
  });

  test('imports aiRateLimiter (preserved — used by reference handler)', () => {
    expect(SRC).toMatch(/const\s*\{\s*aiRateLimiter\s*\}\s*=\s*require\(['"]\.\.\/middleware\/aiRateLimiter['"]\)/);
  });

  // 39: +2 for POST and DELETE /characters/:id/photo (profile and cover
  // photos from The Pulse Uploads, Task #2921), both requireAuth.
  // 40: +1 for POST /characters/:id/interior/generate (the character page's
  // Generate and Deepen), requireAuth + aiRateLimiter.
  // 41: +1 for POST /characters/:id/interior/apply (saving what Generate All's
  // preview drafted; no AI call), requireAuth.
  test('every handler line carries requireAuth (41 router.<verb> definitions)', () => {
    const handlers = SRC.match(/^router\.(get|post|put|patch|delete)\([^\n]+/gm) || [];
    expect(handlers.length).toBe(41);
    handlers.forEach((line) => {
      expect(line).toMatch(/\brequireAuth\b/);
    });
  });

  describe('D9 — reference handler at /characters/:id/deep-profile/generate is preserved verbatim', () => {
    // ADMIN joins between them (Evoni, 2026-10-19: every write in this file is ADMIN only).
    test('preserves the "requireAuth, …, aiRateLimiter" reference shape, ADMIN only', () => {
      expect(SRC).toMatch(/router\.post\('\/characters\/:id\/deep-profile\/generate',\s*requireAuth,\s*authorize\(\['ADMIN'\]\),\s*aiRateLimiter,\s*async/);
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
      // #1699: req.user carries Cognito groups, never a role, so the gate reads
      // the admin group. Still in the handler body, still field filtering only.
      expect(SRC).toMatch(/isAuthor\s*=\s*userInGroup\(req\.user,\s*'admin'\)/);
      expect(SRC).not.toMatch(/req\.user\??\.role/);
    });
    // Superseded by Evoni's ruling of 2026-10-19 ("this whole part of the
    // site is admin only"): every write in this file is ADMIN only, first the
    // profile's (the profile audit), then the rest (the profile follow-up);
    // the reads stay requireAuth.
    test('every write is ADMIN only, and no read is', () => {
      const handlers = SRC.match(/^router\.(get|post|put|patch|delete)\([^\n]+/gm) || [];
      const writes = handlers.filter((line) => !/^router\.get\(/.test(line));
      const reads = handlers.filter((line) => /^router\.get\(/.test(line));
      expect(writes.length).toBe(35);
      writes.forEach((line) => expect(line).toMatch(/requireAuth,\s*authorize\(\['ADMIN'\]\)/));
      reads.forEach((line) => expect(line).not.toMatch(/authorize\(/));
      expect((SRC.match(/authorize\(\['ADMIN'\]\)/g) || []).length).toBe(writes.length);
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
