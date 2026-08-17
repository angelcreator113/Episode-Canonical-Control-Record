// F-AUTH-1 FD-63 — Shape 1: bare declaration under the global mount.
//
// These routes were the static /api/v1 declarations that had no file-scope
// middleware. G1 saw them because its literal probe matched the verb chain on
// the same line; the fix here is to assert the promoted source, not the old
// optionalAuth state.
//
// Promoted at 8ba2b95c. Static source assertions; diff-lock only.
const fs = require('fs');
const path = require('path');

const read = (f) =>
  fs.readFileSync(path.join(__dirname, '..', '..', '..', 'src', 'routes', f), 'utf8');

const SRC = {
  decisions: read('decisions.js'),
  continuityEngine: read('continuityEngine.js'),
};

describe('F-AUTH-1 FD-63 Shape 1 — bare declarations', () => {
  describe.each(Object.entries(SRC))('%s.js', (name, src) => {
    test('imports requireAuth from middleware/auth', () => {
      expect(src).toMatch(
        /const \{ requireAuth \} = require\(['"]\.\.\/middleware\/auth['"]\)/
      );
    });

    test('no optionalAuth survivors, including in comments', () => {
      expect(src).not.toMatch(/optionalAuth/);
    });

    test('routes carry requireAuth inline', () => {
      const decls = src.match(/router\.(get|post|put|patch|delete)\([^\n]*/g) || [];
      expect(decls.length).toBeGreaterThan(0);
      decls.forEach((d) => {
        expect(d).toMatch(/requireAuth/);
      });
    });
  });

  // Total occurrences, import line included — a diff-lock, so it trips if a
  // later sweep drops a promotion. Each total reconciles against the file's
  // route count: decisions has 5 route declarations, all promoted inline, + 1
  // import = 6. continuityEngine has 14, all promoted inline, + 1 import = 15.
  test.each([
    ['decisions', 6],
    ['continuityEngine', 15],
  ])('%s.js carries %i requireAuth occurrences in total', (name, expected) => {
    const hits = SRC[name].match(/requireAuth/g) || [];
    expect(hits).toHaveLength(expected);
  });

  test('Shape 1 still exists as a shape — G1 would still catch these files', () => {
    Object.entries(SRC).forEach(([name, src]) => {
      const caseSensitiveG1 = src.match(/router\.(get|post|put|patch|delete)[^\n]*requireAuth/g) || [];
      expect(caseSensitiveG1.length).toBeGreaterThan(0);
    });
  });
});