// ============================================================================
// UNIT TESTS — storyteller.js anchor file (Step 3 CP7, D1 lock)
// ============================================================================
// 37 handlers all promoted to Tier 1 (requireAuth).
// 1 AI POST (POST /chapters/:id/lines) gets aiRateLimiter (4 anthropic calls
// inside that single handler body — line analysis / threshold detection /
// emotional impact / lala emergence detection).
// Lazy-noop fallback at L47-52 removed.

const fs = require('fs');
const path = require('path');

const SRC = fs.readFileSync(path.join(__dirname, '..', '..', '..', 'src', 'routes', 'storyteller.js'), 'utf8');

describe('Step 3 CP7 — storyteller.js anchor Tier 1 sweep', () => {
  test('imports requireAuth + aiRateLimiter (lazy-noop removed)', () => {
    expect(SRC).toMatch(/const\s*\{\s*requireAuth\s*\}\s*=\s*require\(['"]\.\.\/middleware\/auth['"]\)/);
    expect(SRC).toMatch(/const\s*\{\s*aiRateLimiter\s*\}\s*=\s*require\(['"]\.\.\/middleware\/aiRateLimiter['"]\)/);
  });

  test('every handler line carries requireAuth (37 router.<verb> definitions)', () => {
    const handlers = SRC.match(/^router\.(get|post|put|patch|delete)\([^\n]+/gm) || [];
    expect(handlers.length).toBe(37);
    handlers.forEach((line) => expect(line).toMatch(/\brequireAuth\b/));
  });

  test('AI POST /chapters/:id/lines → requireAuth + aiRateLimiter', () => {
    expect(SRC).toMatch(/router\.post\('\/chapters\/:id\/lines',\s*requireAuth,\s*aiRateLimiter,\s*async/);
  });

  describe('Sample handlers — all Tier 1', () => {
    [
      ['get', '/books'], ['post', '/books'], ['get', '/books/:id'], ['put', '/books/:id'], ['delete', '/books/:id'],
      ['post', '/books/:id/chapters'], ['put', '/chapters/:id'], ['delete', '/chapters/:id'],
      ['put', '/lines/:id'], ['delete', '/lines/:id'], ['post', '/books/:id/approve-all'],
      ['post', '/echoes'], ['get', '/echoes'], ['put', '/echoes/:echoId'], ['delete', '/echoes/:echoId'],
      ['get', '/threads'], ['post', '/threads'], ['get', '/calendar/events'], ['post', '/calendar/events'],
    ].forEach(([verb, route]) => {
      test(`${verb.toUpperCase()} ${route} → requireAuth`, () => {
        const escaped = route.replace(/\//g, '\\/');
        const re = new RegExp(`router\\.${verb}\\('${escaped}',\\s*requireAuth\\b`);
        expect(SRC).toMatch(re);
      });
    });
  });

  test('no optionalAuth handler-references remain', () => {
    const handlers = SRC.match(/^router\.(get|post|put|patch|delete)\([^\n]+/gm) || [];
    handlers.forEach((line) => expect(line).not.toMatch(/\boptionalAuth\b/));
  });

  test('no lazy-noop fallback', () => {
    expect(SRC).not.toMatch(/let\s+optionalAuth;\s*try/);
    expect(SRC).not.toMatch(/\(\(req,\s*res,\s*next\)\s*=>\s*next\(\)\)/);
  });
});
