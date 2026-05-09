// ============================================================================
// UNIT TESTS — beats.js (Step 3 CP11 — sub-form (b) ADD shape, AUTH-DISABLED banner removal)
// ============================================================================
// 5 handlers all Tier 1 (was zero-middleware pre-CP11 with TESTING banner per
// §5.57 v2.34 + CP6 character-clips precedent). Banner removed; requireAuth ADDed.

const fs = require('fs');
const path = require('path');

const SRC = fs.readFileSync(path.join(__dirname, '..', '..', '..', 'src', 'routes', 'beats.js'), 'utf8');

describe('Step 3 CP11 — beats.js sub-form (b) ADD shape', () => {
  test('imports requireAuth from middleware/auth', () => {
    expect(SRC).toMatch(/const\s*\{\s*requireAuth\s*\}\s*=\s*require\(['"]\.\.\/middleware\/auth['"]\)/);
  });

  test('AUTH TEMPORARILY DISABLED banner removed', () => {
    expect(SRC).not.toMatch(/AUTH TEMPORARILY DISABLED/i);
  });

  test('GET /scenes/:sceneId/beats carries requireAuth', () => {
    expect(SRC).toMatch(/router\.get\('\/scenes\/:sceneId\/beats',\s*requireAuth,/);
  });

  test('POST /scenes/:sceneId/beats carries requireAuth', () => {
    expect(SRC).toMatch(/router\.post\('\/scenes\/:sceneId\/beats',\s*requireAuth,/);
  });

  test('GET /beats/:id carries requireAuth', () => {
    expect(SRC).toMatch(/router\.get\('\/beats\/:id',\s*requireAuth,/);
  });

  test('PATCH /beats/:id carries requireAuth', () => {
    expect(SRC).toMatch(/router\.patch\('\/beats\/:id',\s*requireAuth,/);
  });

  test('DELETE /beats/:id carries requireAuth', () => {
    expect(SRC).toMatch(/router\.delete\('\/beats\/:id',\s*requireAuth,/);
  });
});
