// ============================================================================
// UNIT TESTS — characters.js (Step 3 CP6 — D7 ADD shape, sub-form b)
// ============================================================================
// 2 GET-only handlers, both ADDed requireAuth (sub-form b ADD shape).
// Mounted at /api/v1/characters per app.js:779. No mount-collision; this is the
// legacy lightweight reads file, distinct from characterRegistry.js (mounted
// at /api/v1/character-registry).

const fs = require('fs');
const path = require('path');

const SRC = fs.readFileSync(path.join(__dirname, '..', '..', '..', 'src', 'routes', 'characters.js'), 'utf8');

describe('Step 3 CP6 — characters.js sub-form (b) ADD shape', () => {
  test('imports requireAuth from middleware/auth', () => {
    expect(SRC).toMatch(/const\s*\{\s*requireAuth\s*\}\s*=\s*require\(['"]\.\.\/middleware\/auth['"]\)/);
  });

  test("GET '/' (list characters) carries requireAuth", () => {
    expect(SRC).toMatch(/router\.get\('\/',\s*requireAuth,\s*async/);
  });

  test("GET '/:id' (get single character) carries requireAuth", () => {
    expect(SRC).toMatch(/router\.get\('\/:id',\s*requireAuth,\s*async/);
  });

  test('no optionalAuth references', () => {
    expect(SRC).not.toMatch(/\boptionalAuth\b/);
  });
});
