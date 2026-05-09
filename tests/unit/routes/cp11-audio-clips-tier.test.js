// ============================================================================
// UNIT TESTS — audio-clips.js (Step 3 CP11 — sub-form (b) ADD shape, AUTH-DISABLED banner removal)
// ============================================================================
// 5 handlers all Tier 1 (was zero-middleware pre-CP11 with TESTING banner per
// §5.57 v2.34 + CP6 character-clips precedent). Banner removed; requireAuth ADDed.

const fs = require('fs');
const path = require('path');

const SRC = fs.readFileSync(path.join(__dirname, '..', '..', '..', 'src', 'routes', 'audio-clips.js'), 'utf8');

describe('Step 3 CP11 — audio-clips.js sub-form (b) ADD shape', () => {
  test('imports requireAuth from middleware/auth', () => {
    expect(SRC).toMatch(/const\s*\{\s*requireAuth\s*\}\s*=\s*require\(['"]\.\.\/middleware\/auth['"]\)/);
  });

  test('AUTH TEMPORARILY DISABLED banner removed', () => {
    expect(SRC).not.toMatch(/AUTH TEMPORARILY DISABLED/i);
  });

  test('GET /scenes/:sceneId/audio-clips carries requireAuth', () => {
    expect(SRC).toMatch(/router\.get\('\/scenes\/:sceneId\/audio-clips',\s*requireAuth,/);
  });

  test('POST /scenes/:sceneId/audio-clips carries requireAuth', () => {
    expect(SRC).toMatch(/router\.post\('\/scenes\/:sceneId\/audio-clips',\s*requireAuth,/);
  });

  test('GET /audio-clips/:id carries requireAuth', () => {
    expect(SRC).toMatch(/router\.get\('\/audio-clips\/:id',\s*requireAuth,/);
  });

  test('PATCH /audio-clips/:id carries requireAuth', () => {
    expect(SRC).toMatch(/router\.patch\('\/audio-clips\/:id',\s*requireAuth,/);
  });

  test('DELETE /audio-clips/:id carries requireAuth', () => {
    expect(SRC).toMatch(/router\.delete\('\/audio-clips\/:id',\s*requireAuth,/);
  });
});
