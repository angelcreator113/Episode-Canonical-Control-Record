// CP12 — stories.js — G6 closure + Tier 1 sweep + 2 AI POST overlay
// Frontend gate outcome (b): bare GETs migrated to Tier 1 (NovelAssembler/StoryReviewPanel/SocialImport are auth-required).
const fs = require('fs');
const path = require('path');
const SRC = fs.readFileSync(path.join(__dirname, '..', '..', '..', 'src', 'routes', 'stories.js'), 'utf8');

describe('CP12 — stories.js G6 closure + Tier 1 (frontend gate (b))', () => {
  test('imports requireAuth', () => {
    expect(SRC).toMatch(/const \{ requireAuth \} = require\(['"]\.\.\/middleware\/auth['"]\)/);
  });
  test('imports aiRateLimiter', () => {
    expect(SRC).toMatch(/const \{ aiRateLimiter \} = require\(['"]\.\.\/middleware\/aiRateLimiter['"]\)/);
  });
  test('§5.41 G6: authenticateToken alias absent', () => {
    expect(SRC).not.toMatch(/authenticateToken/);
  });
  test('no optionalAuth survivors', () => {
    expect(SRC).not.toMatch(/optionalAuth/);
  });
  test('GET /character/:charKey migrated to Tier 1 (frontend gate (b))', () => {
    expect(SRC).toMatch(/router\.get\('\/character\/:charKey', requireAuth,/);
  });
  test('GET /:id migrated to Tier 1 (frontend gate (b))', () => {
    expect(SRC).toMatch(/router\.get\('\/:id', requireAuth,/);
  });
  test('GET /assemblies/:id migrated to Tier 1', () => {
    expect(SRC).toMatch(/router\.get\('\/assemblies\/:id', requireAuth,/);
  });
  test('AI POST /social/import carries requireAuth + aiRateLimiter', () => {
    expect(SRC).toMatch(/router\.post\('\/social\/import', requireAuth, aiRateLimiter,/);
  });
  test('AI POST /social/:id/detect-lala carries requireAuth + aiRateLimiter', () => {
    expect(SRC).toMatch(/router\.post\('\/social\/:id\/detect-lala', requireAuth, aiRateLimiter,/);
  });
  test('non-AI POST /assemblies carries requireAuth', () => {
    expect(SRC).toMatch(/router\.post\('\/assemblies', requireAuth,/);
  });
});
