// CP12 — tierFeatures.js — cross-domain sweep — Tier 1 + 6 AI POST overlay
const fs = require('fs');
const path = require('path');
const SRC = fs.readFileSync(path.join(__dirname, '..', '..', '..', 'src', 'routes', 'tierFeatures.js'), 'utf8');

describe('CP12 — tierFeatures.js Tier 1 sweep + aiRateLimiter overlay', () => {
  // authorize came with the World Location writes (Evoni, 2026-11-22).
  test('imports requireAuth and authorize from middleware/auth', () => {
    expect(SRC).toMatch(/const \{ requireAuth, authorize \} = require\(['"]\.\.\/middleware\/auth['"]\)/);
  });
  test.each([
    ['post', '/world-locations'],
    ['put', '/world-locations/:locationId'],
    ['delete', '/world-locations/:locationId'],
  ])('%s %s is an ADMIN\'s (requireAuth + authorize, then the handler)', (method, route) => {
    expect(SRC).toContain(`router.${method}('${route}', requireAuth, authorize(['ADMIN']), async (req, res) => {`);
  });
  test('the three World Location writes are the only routes of the file that carry authorize', () => {
    expect(SRC.match(/authorize\(\['ADMIN'\]\)/g) || []).toHaveLength(3);
  });
  test('GET /world-locations stays a sign-in', () => {
    expect(SRC).toContain('router.get(\'/world-locations\', requireAuth, async (req, res) => {');
  });
  test('DELETE /world-locations/:locationId deletes through the one shared function, with no override and no model destroy', () => {
    const start = SRC.indexOf('router.delete(\'/world-locations/:locationId\'');
    const handler = SRC.slice(start, SRC.indexOf('\n});', start));
    expect(handler).toContain('deleteWorldLocation(db.sequelize, req.params.locationId, { userId: req.user?.id })');
    expect(handler).toContain('console.error(');
    expect(handler).not.toMatch(/\.destroy\(|DELETE FROM|req\.(query|body)|err\??\.message/);
  });
  test('imports aiRateLimiter from middleware/aiRateLimiter', () => {
    expect(SRC).toMatch(/const \{ aiRateLimiter \} = require\(['"]\.\.\/middleware\/aiRateLimiter['"]\)/);
  });
  test('lazy-noop residue absent (§5.8 closure)', () => {
    expect(SRC).not.toMatch(/let optionalAuth/);
    expect(SRC).not.toMatch(/try\s*\{[^}]*require\(['"]\.\.\/middleware\/auth['"]\)/);
  });
  test('no optionalAuth-on-writes survivors (§5.21 G1 closure)', () => {
    expect(SRC).not.toMatch(/router\.(post|put|patch|delete)\([^)]*optionalAuth/);
  });
  test('AI POST /continuity-check carries requireAuth + aiRateLimiter', () => {
    expect(SRC).toMatch(/router\.post\('\/continuity-check', requireAuth, aiRateLimiter,/);
  });
  test('AI POST /plot-hole-detection carries requireAuth + aiRateLimiter', () => {
    expect(SRC).toMatch(/router\.post\('\/plot-hole-detection', requireAuth, aiRateLimiter,/);
  });
  test('AI POST /generate-chapter-beats carries requireAuth + aiRateLimiter', () => {
    expect(SRC).toMatch(/router\.post\('\/generate-chapter-beats', requireAuth, aiRateLimiter,/);
  });
  test('AI POST /generate-book-outline carries requireAuth + aiRateLimiter', () => {
    expect(SRC).toMatch(/router\.post\('\/generate-book-outline', requireAuth, aiRateLimiter,/);
  });
  test('non-AI write /relationship-events carries requireAuth (no aiRateLimiter)', () => {
    expect(SRC).toMatch(/router\.post\('\/relationship-events', requireAuth, async/);
  });
});
