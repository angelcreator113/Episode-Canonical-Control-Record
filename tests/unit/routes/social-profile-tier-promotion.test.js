// ============================================================================
// UNIT TESTS — socialProfileRoutes.js anchor file (Step 3 CP8, D1 + D2 + D11)
// ============================================================================
// 39 handlers — mixed Tier 1+4 disposition (4th cumulative §5.21 instance):
//   - 3 GETs Tier 4 PUBLIC (GET /, GET /:id/followers, GET /:id)
//   - 36 handlers Tier 1 (requireAuth)
//   - 8 handlers preserve guardJustAWomanRecord per §5.55 (record-content gate)
//   - 2 AI POSTs aiRateLimiter (POST /generate + POST /:id/regenerate; PROMOTE)
//   - generateRateLimits in-handler call preserved on POST /generate per §5.55

const fs = require('fs');
const path = require('path');

const SRC = fs.readFileSync(path.join(__dirname, '..', '..', '..', 'src', 'routes', 'socialProfileRoutes.js'), 'utf8');

describe('Step 3 CP8 — socialProfileRoutes.js anchor mixed Tier 1+4', () => {
  test('imports optionalAuth + requireAuth + aiRateLimiter (mixed-tier import shape)', () => {
    expect(SRC).toMatch(/const\s*\{\s*optionalAuth,\s*requireAuth\s*\}\s*=\s*require\(['"]\.\.\/middleware\/auth['"]\)/);
    expect(SRC).toMatch(/const\s*\{\s*aiRateLimiter\s*\}\s*=\s*require\(['"]\.\.\/middleware\/aiRateLimiter['"]\)/);
  });

  test('mixed-tier comment block documents §5.21 4th cumulative instance', () => {
    expect(SRC).toMatch(/§5\.21|mixed Tier 1\+4/);
    expect(SRC).toMatch(/4th cumulative instance/);
  });

  describe('Tier 4 PUBLIC GETs (3 catalog reads — D2 lock)', () => {
    [
      ['get', '/'],
      ['get', '/:id/followers'],
      ['get', '/:id'],
    ].forEach(([verb, route]) => {
      test(`${verb.toUpperCase()} ${route} uses optionalAuth (Tier 4)`, () => {
        const re = new RegExp(`router\\.${verb}\\('${route.replace(/\//g, '\\/')}',\\s*optionalAuth,\\s*async`);
        expect(SRC).toMatch(re);
      });
    });
  });

  describe('AI POSTs (2 — D1 + D11 locks)', () => {
    test('POST /generate → requireAuth + aiRateLimiter (in-handler generateRateLimits preserved per §5.55)', () => {
        // ADMIN before the AI limiter (Evoni, 2026-10-19, the profile follow-up).
      expect(SRC).toMatch(/router\.post\('\/generate',\s*requireAuth,\s*authorize\(\['ADMIN'\]\),\s*aiRateLimiter,\s*async/);
    });
    test('POST /:id/regenerate → requireAuth + aiRateLimiter + guardJustAWomanRecord', () => {
      expect(SRC).toMatch(/router\.post\('\/:id\/regenerate',\s*requireAuth,\s*authorize\(\['ADMIN'\]\),\s*aiRateLimiter,\s*guardJustAWomanRecord,\s*async/);
    });
  });

  describe('guardJustAWomanRecord preservation (8 handlers per §5.55)', () => {
    [
      ['post', '/:id/finalize'],
      ['post', '/:id/cross'],
      ['put', '/:id'],
      ['patch', '/:id'],
      ['post', '/:id/regenerate'],
      ['delete', '/:id'],
      ['post', '/:id/approve'],
      ['post', '/:id/reject-crossing'],
    ].forEach(([verb, route]) => {
      test(`${verb.toUpperCase()} ${route} preserves guardJustAWomanRecord after requireAuth`, () => {
        const escaped = route.replace(/\//g, '\\/');
        const re = new RegExp(`router\\.${verb}\\('${escaped}',\\s*requireAuth,(\\s*authorize\\(\\['ADMIN'\\]\\),)?(\\s*aiRateLimiter,)?\\s*guardJustAWomanRecord,\\s*async`);
        expect(SRC).toMatch(re);
      });
    });
  });

  // Evoni, 2026-10-19 ("this whole part of the site is admin only"; the
  // profile audit): editing a profile is ADMIN only.
  test('PUT and PATCH /:id are ADMIN only, guard kept', () => {
    expect(SRC).toMatch(/router\.put\('\/:id',\s*requireAuth,\s*authorize\(\['ADMIN'\]\),\s*guardJustAWomanRecord,\s*async/);
    expect(SRC).toMatch(/router\.patch\('\/:id',\s*requireAuth,\s*authorize\(\['ADMIN'\]\),\s*guardJustAWomanRecord,\s*async/);
  });

  test('guardJustAWomanRecord function definition preserved verbatim', () => {
    expect(SRC).toMatch(/function guardJustAWomanRecord\(req,\s*res,\s*next\)/);
    expect(SRC).toMatch(/is_justawoman_record/);
    expect(SRC).toMatch(/This record is locked/);
  });

  test('generateRateLimits Map + checkRateLimit preserved verbatim per §5.55', () => {
    expect(SRC).toMatch(/const generateRateLimits\s*=\s*new Map\(\)/);
    expect(SRC).toMatch(/function checkRateLimit\(req,\s*res\)/);
    expect(SRC).toMatch(/Rate limit exceeded/);
  });

  test('lazy-noop fallback removed', () => {
    expect(SRC).not.toMatch(/let\s+optionalAuth;\s*try/);
  });

  test('every write handler ends up requireAuth (zero optionalAuth survivors on writes)', () => {
    const writeHandlers = SRC.match(/^router\.(post|put|patch|delete)\([^\n]+/gm) || [];
    writeHandlers.forEach((line) => expect(line).not.toMatch(/^router\.(post|put|patch|delete)\([^,]+,\s*optionalAuth\b/));
  });

  // Evoni, 2026-10-19 (the profile follow-up): every Pulse people write is
  // ADMIN only; crossing-preview writes nothing and calls no AI, so it is not.
  test('every write but crossing-preview is ADMIN only, and no read is', () => {
    const handlers = SRC.match(/^router\.(get|post|put|patch|delete)\([^\n]+/gm) || [];
    const writes = handlers.filter((l) => !/^router\.get\(/.test(l));
    writes.filter((l) => !/'\/:id\/crossing-preview'/.test(l))
      .forEach((l) => expect(l).toMatch(/requireAuth,\s*authorize\(\['ADMIN'\]\)/));
    expect(writes.find((l) => /'\/:id\/crossing-preview'/.test(l))).not.toMatch(/authorize\(/);
    handlers.filter((l) => /^router\.get\(/.test(l)).forEach((l) => expect(l).not.toMatch(/authorize\(/));
  });

  describe('Sample Tier 1 handlers', () => {
    [
      ['post', '/bulk/finalize'],
      ['post', '/bulk/cross'],
      ['get', '/export'],
      ['post', '/:id/followers'],
      ['delete', '/:id/followers/:characterKey'],
      ['get', '/network'],
      ['get', '/analytics/composition'],
      ['get', '/templates'],
      ['post', '/templates'],
    ].forEach(([verb, route]) => {
      test(`${verb.toUpperCase()} ${route} → requireAuth`, () => {
        const escaped = route.replace(/\//g, '\\/');
        const re = new RegExp(`router\\.${verb}\\('${escaped}',\\s*requireAuth\\b`);
        expect(SRC).toMatch(re);
      });
    });
  });
});
