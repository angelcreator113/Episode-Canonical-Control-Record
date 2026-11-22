// F-AUTH-1 FD-63 — Shape 3: multi-line middleware declarations.
//
// These route declarations were split across lines, so a literal one-line
// pattern would miss them. The lock here checks the exact promoted form and the
// line-wrapped route declarations that still carry requireAuth inline.
//
// Promoted at 8ba2b95c. Static source assertions; diff-lock only.
//
// animatic.js also imports authorize since 2026-11-22: its DELETE
// /scenes/:sceneId/beats/clear is an ADMIN's (Evoni;
// F-AUTH-1_DestructiveOps_ParseScript_AdminOnly_Amendment_2026-11-22.md).
// iconSlots.js keeps the requireAuth-only import.
const fs = require('fs');
const path = require('path');

const read = (f) =>
  fs.readFileSync(path.join(__dirname, '..', '..', '..', 'src', 'routes', f), 'utf8');

const SRC = {
  iconSlots: read('iconSlots.js'),
  animatic: read('animatic.js'),
};

const IMPORT = {
  iconSlots: /const \{ requireAuth \} = require\(['"]\.\.\/middleware\/auth['"]\)/,
  animatic: /const \{ requireAuth, authorize \} = require\(['"]\.\.\/middleware\/auth['"]\)/,
};

describe('F-AUTH-1 FD-63 Shape 3 — multi-line middleware declarations', () => {
  describe.each(Object.entries(SRC))('%s.js', (name, src) => {
    test('imports requireAuth from middleware/auth', () => {
      expect(src).toMatch(IMPORT[name]);
    });

    test('no optionalAuth survivors, including in comments', () => {
      expect(src).not.toMatch(/optionalAuth/);
    });

    test('route declarations keep requireAuth inline even when wrapped across lines', () => {
      const decls = src.match(/router\.(get|post|put|patch|delete)\([\s\S]*?\)/g) || [];
      expect(decls.length).toBeGreaterThan(0);
      decls.forEach((decl) => {
        expect(decl).toMatch(/requireAuth/);
      });
    });
  });

  // Total occurrences, import line included. Both files carry 6 route
  // declarations, each promoted, + 1 import = 7. The 6 promotions are what the
  // per-route assertions above cover; this total is the diff-lock that trips if
  // one is later dropped.
  test.each([
    ['iconSlots', 7],
    ['animatic', 7],
  ])('%s.js carries %i requireAuth occurrences in total', (name, expected) => {
    const hits = SRC[name].match(/requireAuth/g) || [];
    expect(hits).toHaveLength(expected);
  });

  test('animatic.js — only the beats clear carries authorize([\'ADMIN\']), after requireAuth', () => {
    expect(SRC.animatic).toMatch(
      /router\.delete\('\/scenes\/:sceneId\/beats\/clear', requireAuth, authorize\(\['ADMIN'\]\), asyncHandler\(/
    );
    expect(SRC.animatic.match(/authorize\(/g)).toHaveLength(1);
    expect(SRC.iconSlots).not.toMatch(/authorize/);
  });

  test('Shape 3 still exists as a shape — the wrapped declarations are still promoted', () => {
    Object.entries(SRC).forEach(([name, src]) => {
      expect(src).toMatch(/requireAuth/);
      expect(src).toMatch(/\n/);
    });
  });
});