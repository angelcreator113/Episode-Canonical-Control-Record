// ============================================================================
// UNIT TESTS — character-clips.js (Step 3 CP6 — D7 ADD shape, sub-form b)
// ============================================================================
// 5 handlers, ALL previously zero-auth (sub-form b). Banner "AUTH TEMPORARILY
// DISABLED FOR TESTING" at L18 removed; requireAuth ADDed to all 5 handlers.

const fs = require('fs');
const path = require('path');

const SRC = fs.readFileSync(path.join(__dirname, '..', '..', '..', 'src', 'routes', 'character-clips.js'), 'utf8');

describe('Step 3 CP6 — character-clips.js sub-form (b) ADD shape', () => {
  test('imports requireAuth from middleware/auth', () => {
    expect(SRC).toMatch(/const\s*\{\s*requireAuth\s*\}\s*=\s*require\(['"]\.\.\/middleware\/auth['"]\)/);
  });

  describe('All 5 handlers carry requireAuth (ADD shape)', () => {
    [
      ['get', '/scenes/:sceneId/character-clips'],
      ['post', '/scenes/:sceneId/character-clips'],
      ['get', '/character-clips/:id'],
      ['patch', '/character-clips/:id'],
      ['delete', '/character-clips/:id'],
    ].forEach(([verb, route]) => {
      test(`${verb.toUpperCase()} ${route} → requireAuth`, () => {
        const escaped = route.replace(/\//g, '\\/');
        const re = new RegExp(`router\\.${verb}\\('${escaped}',\\s*requireAuth,`);
        expect(SRC).toMatch(re);
      });
    });
  });

  test('F-AUTH-4 obsolescence: "TESTING" banner removed', () => {
    expect(SRC).not.toMatch(/AUTH TEMPORARILY DISABLED FOR TESTING/i);
    expect(SRC).not.toMatch(/✅\s*AUTH/);
  });

  test('no optionalAuth references', () => {
    expect(SRC).not.toMatch(/\boptionalAuth\b/);
  });
});
