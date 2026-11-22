// ============================================================================
// UNIT TESTS — scripts.js (Step 3 CP9, D2 + D11 locks; the reads corrected
// 2026-11-21, the writes 2026-11-22)
// ============================================================================
// 10 handlers, each requireAuth + authorize(['ADMIN']):
//   - 4 GETs (list, search, single, history). CP9 classed them Tier 4 PUBLIC
//     because they did not read req.user, so they answered anyone with every
//     script, a script's text and its edit history. Evoni, 2026-11-21: they
//     are an ADMIN's
//     (docs/audit/F-AUTH-1_ScriptsReads_AdminOnly_Amendment_2026-11-21.md).
//     How they behave is in scripts-reads-admin-only.test.js.
//   - 6 writes. CP9 left them Tier 1, a sign-in alone (5 legacy
//     authenticateToken converted to requireAuth per D11; POST
//     /:scriptId/parse-scenes had no middleware). Evoni, 2026-11-22: they are
//     an ADMIN's
//     (docs/audit/F-AUTH-1_ScriptWrites_AdminOnly_Amendment3_2026-11-22.md).
//     How they behave is in scripts-writes-admin-only.test.js.

const fs = require('fs');
const path = require('path');

const SRC = fs.readFileSync(path.join(__dirname, '..', '..', '..', 'src', 'routes', 'scripts.js'), 'utf8');

describe('scripts.js — ADMIN reads, ADMIN writes', () => {
  test('imports requireAuth + authorize (legacy authenticateToken alias eliminated; optionalAuth gone)', () => {
    expect(SRC).toMatch(/const\s*\{\s*requireAuth,\s*authorize\s*\}\s*=\s*require\(['"]\.\.\/middleware\/auth['"]\)/);
    // No active import of authenticateToken (only allowed in comment-block prose)
    expect(SRC).not.toMatch(/const\s*\{[^}]*\bauthenticateToken\b[^}]*\}\s*=\s*require/);
  });

  test('the comment block names the correction and its register amendment', () => {
    expect(SRC).toMatch(/The four reads are an ADMIN's \(Evoni, 2026-11-21\)/);
    expect(SRC).toMatch(/F-AUTH-1_ScriptsReads_AdminOnly_/);
    expect(SRC).toMatch(/The six writes are an ADMIN's too \(Evoni, 2026-11-22\)/);
    expect(SRC).toMatch(/F-AUTH-1_ScriptWrites_AdminOnly_Amendment3_2026-11-22\.md/);
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

  describe('the 6 writes are an ADMIN\'s (were Tier 1: D11 legacy authenticateToken conversion)', () => {
    // requireAuth first, as CP9 put it; authorize(['ADMIN']) straight after, ahead of the handler.
    const ADMIN = String.raw`requireAuth,\s*authorize\(\['ADMIN'\]\),\s*asyncHandler`;
    test('POST /bulk-delete carries requireAuth (was authenticateToken) and authorize([\'ADMIN\'])', () => {
      expect(SRC).toMatch(/router\.post\(\s*\n?\s*'\/bulk-delete',\s*\n?\s*requireAuth,/);
      expect(SRC).toMatch(new RegExp(String.raw`router\.post\(\s*'\/bulk-delete',\s*${ADMIN}\(scriptsController\.bulkDelete\)`));
    });
    test('PATCH /:scriptId carries requireAuth (was authenticateToken) and authorize([\'ADMIN\'])', () => {
      expect(SRC).toMatch(/router\.patch\(\s*\n?\s*'\/:scriptId',\s*\n?\s*requireAuth,/);
      expect(SRC).toMatch(new RegExp(String.raw`router\.patch\(\s*'\/:scriptId',\s*${ADMIN}\(scriptsController\.updateScript\)`));
    });
    test('DELETE /:scriptId carries requireAuth (was authenticateToken) and authorize([\'ADMIN\'])', () => {
      expect(SRC).toMatch(/router\.delete\(\s*\n?\s*'\/:scriptId',\s*\n?\s*requireAuth,/);
      expect(SRC).toMatch(new RegExp(String.raw`router\.delete\(\s*'\/:scriptId',\s*${ADMIN}\(scriptsController\.deleteScript\)`));
    });
    test('POST /:scriptId/set-primary carries requireAuth (was authenticateToken) and authorize([\'ADMIN\'])', () => {
      expect(SRC).toMatch(/router\.post\(\s*\n?\s*'\/:scriptId\/set-primary',\s*\n?\s*requireAuth,/);
      expect(SRC).toMatch(new RegExp(String.raw`router\.post\(\s*'\/:scriptId\/set-primary',\s*${ADMIN}\(scriptsController\.setPrimary\)`));
    });
    test('POST /:scriptId/restore carries requireAuth (was authenticateToken) and authorize([\'ADMIN\'])', () => {
      expect(SRC).toMatch(/router\.post\(\s*\n?\s*'\/:scriptId\/restore',\s*\n?\s*requireAuth,/);
      expect(SRC).toMatch(new RegExp(String.raw`router\.post\(\s*'\/:scriptId\/restore',\s*${ADMIN}\(scriptsController\.restoreVersion\)`));
    });
    test('POST /:scriptId/parse-scenes carries requireAuth (was no-middleware sub-form b) and authorize([\'ADMIN\'])', () => {
      expect(SRC).toMatch(/router\.post\('\/:scriptId\/parse-scenes',\s*requireAuth,/);
      expect(SRC).toMatch(new RegExp(String.raw`router\.post\('\/:scriptId\/parse-scenes',\s*${ADMIN}\(scriptsController\.parseScenes\)`));
    });
    test('every write in the file carries both, and there are six', () => {
      // A route is its text up to the statement's closing ");".
      const writes = SRC.match(/^router\.(post|put|patch|delete)\([\s\S]*?\);$/gm) || [];
      expect(writes).toHaveLength(6);
      for (const route of writes) expect(route).toMatch(new RegExp(ADMIN));
    });
    test('no route in the file is without authorize([\'ADMIN\']): ten routes, ten checks, ten sign-ins', () => {
      expect(SRC.match(/^router\.\w+\(/gm)).toHaveLength(10);
      expect(SRC.match(/requireAuth,\s*authorize\(\['ADMIN'\]\),\s*asyncHandler\(scriptsController\.\w+\)/g)).toHaveLength(10);
      // One more requireAuth and authorize: the import.
      expect(SRC.match(/\brequireAuth\b/g)).toHaveLength(11);
      expect(SRC.match(/\bauthorize\b/g)).toHaveLength(11);
    });
  });

  test('nothing in the file is public: no optionalAuth, no PUBLIC route comment', () => {
    expect(SRC).not.toMatch(/\boptionalAuth\b/);
    expect(SRC).not.toMatch(/\/\/ PUBLIC:/);
  });
});
