// ============================================================================
// UNIT TESTS — scripts.js (Step 3 CP9, D2 + D11 locks)
// ============================================================================
// 10 handlers (surface-correction: 10 not 9; agent missed POST /:scriptId/parse-scenes
// at L60 which had ZERO middleware and is now ADD requireAuth):
//   - 4 GETs Tier 4 PUBLIC (catalog reads — list, search, single, history)
//   - 6 writes Tier 1
//   - 5 legacy authenticateToken converted to requireAuth per D11 (largest
//     legacy-alias conversion in CP-zone work; CP7 had 1 instance)
// 6th cumulative §5.21 instance.

const fs = require('fs');
const path = require('path');

const SRC = fs.readFileSync(path.join(__dirname, '..', '..', '..', 'src', 'routes', 'scripts.js'), 'utf8');

describe('Step 3 CP9 — scripts.js mixed Tier 1+4 + legacy authenticateToken conversion', () => {
  test('imports requireAuth (legacy authenticateToken alias eliminated from active code)', () => {
    expect(SRC).toMatch(/const\s*\{\s*requireAuth\s*\}\s*=\s*require\(['"]\.\.\/middleware\/auth['"]\)/);
    // No active import of authenticateToken (only allowed in comment-block prose)
    expect(SRC).not.toMatch(/const\s*\{[^}]*\bauthenticateToken\b[^}]*\}\s*=\s*require/);
  });

  test('mixed-tier comment block documents §5.21 6th cumulative instance', () => {
    expect(SRC).toMatch(/§5\.21|mixed Tier 1\+4/);
    expect(SRC).toMatch(/6th cumulative instance/);
  });

  describe('Tier 4 PUBLIC GETs (4 catalog reads — D2)', () => {
    test('GET / (list) is no-middleware (Tier 4 PUBLIC)', () => {
      expect(SRC).toMatch(/router\.get\('\/',\s*asyncHandler/);
    });
    test('GET /search (catalog search) is no-middleware (Tier 4 PUBLIC)', () => {
      expect(SRC).toMatch(/router\.get\('\/search',\s*asyncHandler/);
    });
    test('GET /:scriptId (single read) is no-middleware (Tier 4 PUBLIC)', () => {
      expect(SRC).toMatch(/router\.get\('\/:scriptId',\s*asyncHandler/);
    });
    test('GET /:scriptId/history is no-middleware (Tier 4 PUBLIC)', () => {
      expect(SRC).toMatch(/router\.get\('\/:scriptId\/history',\s*asyncHandler/);
    });
  });

  describe('Tier 1 writes (6 — D11 legacy authenticateToken conversion)', () => {
    test('POST /bulk-delete carries requireAuth (was authenticateToken)', () => {
      expect(SRC).toMatch(/router\.post\(\s*\n?\s*'\/bulk-delete',\s*\n?\s*requireAuth,/);
    });
    test('PATCH /:scriptId carries requireAuth (was authenticateToken)', () => {
      expect(SRC).toMatch(/router\.patch\(\s*\n?\s*'\/:scriptId',\s*\n?\s*requireAuth,/);
    });
    test('DELETE /:scriptId carries requireAuth (was authenticateToken)', () => {
      expect(SRC).toMatch(/router\.delete\(\s*\n?\s*'\/:scriptId',\s*\n?\s*requireAuth,/);
    });
    test('POST /:scriptId/set-primary carries requireAuth (was authenticateToken)', () => {
      expect(SRC).toMatch(/router\.post\(\s*\n?\s*'\/:scriptId\/set-primary',\s*\n?\s*requireAuth,/);
    });
    test('POST /:scriptId/restore carries requireAuth (was authenticateToken)', () => {
      expect(SRC).toMatch(/router\.post\(\s*\n?\s*'\/:scriptId\/restore',\s*\n?\s*requireAuth,/);
    });
    test('POST /:scriptId/parse-scenes carries requireAuth (was no-middleware sub-form b)', () => {
      expect(SRC).toMatch(/router\.post\('\/:scriptId\/parse-scenes',\s*requireAuth,/);
    });
  });

  test('no optionalAuth references (file is Tier 1 + Tier 4-by-omission only)', () => {
    expect(SRC).not.toMatch(/\boptionalAuth\b/);
  });
});
