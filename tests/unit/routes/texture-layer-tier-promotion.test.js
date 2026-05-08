// ============================================================================
// UNIT TESTS — textureLayerRoutes.js (Step 3 CP9, D2 + D7 locks)
// ============================================================================
// 5 handlers — sub-form (b) ADD shape + mixed Tier 1+4 (8th cumulative §5.21):
//   - 2 GETs Tier 4 PUBLIC (character-keyed catalog reads)
//   - 2 service-mediated AI POSTs aiRateLimiter (generate + regenerate; per §5.58
//     classification: textureLayerService.generateTextureLayer wraps Anthropic)
//   - 1 non-AI POST plain requireAuth (confirm — DB persistence)
// All 5 handlers were ZERO middleware pre-CP9 (sub-form b).

const fs = require('fs');
const path = require('path');

const SRC = fs.readFileSync(path.join(__dirname, '..', '..', '..', 'src', 'routes', 'textureLayerRoutes.js'), 'utf8');

describe('Step 3 CP9 — textureLayerRoutes.js sub-form (b) ADD + mixed Tier 1+4', () => {
  test('imports optionalAuth + requireAuth + aiRateLimiter', () => {
    expect(SRC).toMatch(/const\s*\{\s*optionalAuth,\s*requireAuth\s*\}\s*=\s*require\(['"]\.\.\/middleware\/auth['"]\)/);
    expect(SRC).toMatch(/const\s*\{\s*aiRateLimiter\s*\}\s*=\s*require\(['"]\.\.\/middleware\/aiRateLimiter['"]\)/);
  });

  test('mixed-tier comment block documents §5.21 8th cumulative instance', () => {
    expect(SRC).toMatch(/§5\.21|mixed Tier 1\+4/);
    expect(SRC).toMatch(/8th cumulative instance/);
  });

  describe('Tier 4 PUBLIC GETs (2 character-keyed catalog reads — D2)', () => {
    test('GET /:characterKey/:storyNumber uses optionalAuth (Tier 4)', () => {
      expect(SRC).toMatch(/router\.get\('\/:characterKey\/:storyNumber',\s*optionalAuth,\s*async/);
    });
    test('GET /:characterKey uses optionalAuth (Tier 4)', () => {
      expect(SRC).toMatch(/router\.get\('\/:characterKey',\s*optionalAuth,\s*async/);
    });
  });

  describe('AI POSTs (2 service-mediated — D3 + D7)', () => {
    test('POST /generate → requireAuth + aiRateLimiter', () => {
      expect(SRC).toMatch(/router\.post\('\/generate',\s*requireAuth,\s*aiRateLimiter,\s*async/);
    });
    test('POST /regenerate/:storyNumber/:layer → requireAuth + aiRateLimiter', () => {
      expect(SRC).toMatch(/router\.post\('\/regenerate\/:storyNumber\/:layer',\s*requireAuth,\s*aiRateLimiter,\s*async/);
    });
  });

  test('Non-AI POST /confirm/:storyNumber → requireAuth (no aiRateLimiter — DB persistence)', () => {
    expect(SRC).toMatch(/router\.post\('\/confirm\/:storyNumber',\s*requireAuth,\s*async/);
  });

  test('no zero-middleware handlers remain (sub-form b ADD applied)', () => {
    const writeHandlers = SRC.match(/^router\.(post|put|patch|delete)\([^\n]+/gm) || [];
    writeHandlers.forEach((line) => expect(line).toMatch(/\brequireAuth\b/));
  });
});
