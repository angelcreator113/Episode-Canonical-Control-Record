// ============================================================================
// UNIT TESTS — beats.js (Step 3 CP11 — sub-form (b) ADD shape, AUTH-DISABLED banner removal)
// ============================================================================
// 5 handlers all Tier 1 (was zero-middleware pre-CP11 with TESTING banner per
// §5.57 v2.34 + CP6 character-clips precedent). Banner removed; requireAuth ADDed.
// DELETE /beats/:id is an ADMIN's since 2026-11-22 (a hard delete; Evoni,
// F-AUTH-1_DestructiveOps_ParseScript_AdminOnly_Amendment_2026-11-22.md); the
// other four stay sign-in.

const fs = require('fs');
const path = require('path');

const SRC = fs.readFileSync(path.join(__dirname, '..', '..', '..', 'src', 'routes', 'beats.js'), 'utf8');

describe('Step 3 CP11 — beats.js sub-form (b) ADD shape', () => {
  test('imports requireAuth and authorize from middleware/auth', () => {
    expect(SRC).toMatch(/const\s*\{\s*requireAuth,\s*authorize\s*\}\s*=\s*require\(['"]\.\.\/middleware\/auth['"]\)/);
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

  test('DELETE /beats/:id carries authorize([\'ADMIN\']) after requireAuth', () => {
    expect(SRC).toMatch(/router\.delete\('\/beats\/:id',\s*requireAuth,\s*authorize\(\['ADMIN'\]\),\s*asyncHandler\(beatController\.deleteBeat\)/);
  });

  test('the other four routes carry no group check: one authorize call in the file', () => {
    expect(SRC.match(/authorize\(/g)).toHaveLength(1);
    for (const line of SRC.split('\n').filter((l) => /^router\.(get|post|patch)\(/.test(l))) {
      expect(line).not.toMatch(/authorize/);
    }
  });
});
