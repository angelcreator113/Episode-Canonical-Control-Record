// ============================================================================
// UNIT TESTS — scripts.js (Step 3 CP9, D2 + D11 locks; the reads corrected
// 2026-11-21)
// ============================================================================
// 10 handlers:
//   - 4 GETs (list, search, single, history): requireAuth + authorize(['ADMIN']).
//     CP9 classed them Tier 4 PUBLIC because they did not read req.user, so
//     they answered anyone with every script, a script's text and its edit
//     history. Evoni, 2026-11-21: they are an ADMIN's
//     (docs/audit/F-AUTH-1_ScriptsReads_AdminOnly_Amendment_2026-11-21.md).
//     How they behave is in scripts-reads-admin-only.test.js.
//   - 6 writes Tier 1, as CP9 left them (5 legacy authenticateToken converted
//     to requireAuth per D11; POST /:scriptId/parse-scenes had no middleware).

const fs = require('fs');
const path = require('path');

const SRC = fs.readFileSync(path.join(__dirname, '..', '..', '..', 'src', 'routes', 'scripts.js'), 'utf8');

describe('scripts.js — ADMIN reads, Tier 1 writes', () => {
  test('imports requireAuth + authorize (legacy authenticateToken alias eliminated; optionalAuth gone)', () => {
    expect(SRC).toMatch(/const\s*\{\s*requireAuth,\s*authorize\s*\}\s*=\s*require\(['"]\.\.\/middleware\/auth['"]\)/);
    // No active import of authenticateToken (only allowed in comment-block prose)
    expect(SRC).not.toMatch(/const\s*\{[^}]*\bauthenticateToken\b[^}]*\}\s*=\s*require/);
  });

  test('the comment block names the correction and its register amendment', () => {
    expect(SRC).toMatch(/The four reads are an ADMIN's \(Evoni, 2026-11-21\)/);
    expect(SRC).toMatch(/F-AUTH-1_ScriptsReads_AdminOnly_/);
  });

  describe('the 4 reads are an ADMIN\'s', () => {
    const ADMIN = String.raw`requireAuth,\s*authorize\(\['ADMIN'\]\),\s*asyncHandler`;
    test('GET / (list)', () => {
      expect(SRC).toMatch(new RegExp(String.raw`router\.get\('\/',\s*${ADMIN}`));
    });
    test('GET /search', () => {
      expect(SRC).toMatch(new RegExp(String.raw`router\.get\('\/search',\s*${ADMIN}`));
    });
    test('GET /:scriptId (single read)', () => {
      expect(SRC).toMatch(new RegExp(String.raw`router\.get\('\/:scriptId',\s*${ADMIN}`));
    });
    test('GET /:scriptId/history', () => {
      expect(SRC).toMatch(new RegExp(String.raw`router\.get\('\/:scriptId\/history',\s*${ADMIN}`));
    });
    test('every GET in the file carries both, and there are four', () => {
      const gets = SRC.match(/^router\.get\(.*$/gm) || [];
      expect(gets).toHaveLength(4);
      for (const line of gets) expect(line).toMatch(/requireAuth,\s*authorize\(\['ADMIN'\]\)/);
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

  test('nothing in the file is public: no optionalAuth, no PUBLIC route comment', () => {
    expect(SRC).not.toMatch(/\boptionalAuth\b/);
    expect(SRC).not.toMatch(/\/\/ PUBLIC:/);
  });
});
