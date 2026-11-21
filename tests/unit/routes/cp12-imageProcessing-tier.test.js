// CP12 — imageProcessing.js — G6-EXTENDED closure (authenticate→requireAuth) + Tier 1 sweep
const fs = require('fs');
const path = require('path');
const SRC = fs.readFileSync(path.join(__dirname, '..', '..', '..', 'src', 'routes', 'imageProcessing.js'), 'utf8');

describe('CP12 — imageProcessing.js G6-EXTENDED closure', () => {
  // authorize joined the import on 2026-11-16: starting or undoing processing is an ADMIN's (Evoni).
  test('imports requireAuth and authorize', () => {
    expect(SRC).toMatch(/const \{ requireAuth, authorize \} = require\(['"]\.\.\/middleware\/auth['"]\)/);
  });
  test('the three processing writes are an ADMIN\'s; the status read keeps requireAuth alone', () => {
    for (const path of ['remove-background', 'enhance', 'reset-processing']) {
      expect(SRC).toMatch(new RegExp(`router\\.post\\('/:id/${path}', requireAuth, authorize\\(\\['ADMIN'\\]\\), `));
    }
    // Still requireAuth alone as its sign-in tier (no authorize); after it
    // comes only the document-presentation rule (V2-2a-1, 2026-11-20).
    const status = SRC.slice(SRC.indexOf("router.get('/:id/processing-status'"), SRC.indexOf("router.get('/:id/processing-status'") + 400);
    expect(status).toMatch(/^router\.get\('\/:id\/processing-status', requireAuth,\s*(\/\/[^\n]*\n\s*)?hideDocumentPresentations\(/);
    expect(status.slice(0, status.indexOf('async (req, res)'))).not.toMatch(/authorize\(/);
  });
  test('§5.41 G6-EXTENDED: authenticate alias absent', () => {
    expect(SRC).not.toMatch(/[^A-Za-z]authenticate[^A-Za-z]/);
  });
  test('no optionalAuth survivors', () => {
    expect(SRC).not.toMatch(/optionalAuth/);
  });
  test('POST /:id/remove-background carries requireAuth (was optionalAuth)', () => {
    expect(SRC).toMatch(/router\.post\('\/:id\/remove-background', requireAuth,/);
  });
  test('POST /:id/enhance carries requireAuth (was authenticate)', () => {
    expect(SRC).toMatch(/router\.post\('\/:id\/enhance', requireAuth,/);
  });
  test('POST /:id/reset-processing carries requireAuth (was authenticate)', () => {
    expect(SRC).toMatch(/router\.post\('\/:id\/reset-processing', requireAuth,/);
  });
  test('GET /:id/processing-status migrated bare → Tier 1 requireAuth', () => {
    expect(SRC).toMatch(/router\.get\('\/:id\/processing-status', requireAuth,/);
  });
});
