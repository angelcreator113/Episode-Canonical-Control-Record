// F-AUTH-1 FD-63 — Shape 4: router variable not named `router`.
//
// Two routers declared on `luxuryFilterRouter` and `seasonRhythmRouter`. Their
// three write sites carried optionalAuth INLINE, on the same line as the verb —
// the exact shape §21's G1 was written to catch. G1 missed them because its
// pattern is the literal `router\.` matched case-sensitively by grep -E, and
// `Router.post` does not match `router\.post`.
//
// Fix Plan v2.45 §4.1 rules this instrument disagreement rather than a separate
// finding: the sites were inventoried in PE #51 and confirmed present by the
// 2026-08-16 pre-flight, which finds them because Select-String defaults to
// case-insensitive matching. Two instruments, same source, opposite answers.
//
// Promoted at 8ba2b95c. Static source assertions; diff-lock only.
const fs = require('fs');
const path = require('path');

const read = (f) =>
  fs.readFileSync(path.join(__dirname, '..', '..', '..', 'src', 'routes', f), 'utf8');

const SRC = {
  luxuryFilterRoutes: read('luxuryFilterRoutes.js'),
  seasonRhythmRoutes: read('seasonRhythmRoutes.js'),
};

const VAR = {
  luxuryFilterRoutes: 'luxuryFilterRouter',
  seasonRhythmRoutes: 'seasonRhythmRouter',
};

describe('F-AUTH-1 FD-63 Shape 4 — non-`router` variable names', () => {
  describe.each(Object.entries(SRC))('%s.js', (name, src) => {
    test('imports requireAuth from middleware/auth', () => {
      expect(src).toMatch(
        /const \{ requireAuth \} = require\(['"]\.\.\/middleware\/auth['"]\)/
      );
    });

    test('no optionalAuth survivors, including in comments', () => {
      expect(src).not.toMatch(/optionalAuth/);
    });

    test(`declares its router as ${'%s'} — the shape that defeats a literal router\\. pattern`, () => {
      const v = VAR[name];
      expect(src).toMatch(new RegExp(`const ${v}\\s*=\\s*express\\.Router\\(\\)`));
    });

    test('declares no route on a variable literally named `router`', () => {
      expect(src).not.toMatch(/\brouter\.(get|post|put|patch|delete)\(/);
    });

    test('every route declaration carries requireAuth inline', () => {
      const v = VAR[name];
      const decls =
        src.match(new RegExp(`${v}\\.(get|post|put|patch|delete)\\([^\\n]*`, 'g')) || [];
      expect(decls.length).toBeGreaterThan(0);
      decls.forEach((d) => {
        expect(d).toMatch(/requireAuth/);
      });
    });
  });

  test.each([
    ['luxuryFilterRoutes', 4],
    ['seasonRhythmRoutes', 4],
  ])('%s.js carries %i requireAuth occurrences', (name, expected) => {
    const hits = SRC[name].match(/requireAuth/g) || [];
    expect(hits).toHaveLength(expected);
  });

  // luxuryFilterRoutes counts 4 for 2 handlers because its header comment at
  // line 2 also named the middleware and was corrected with the code.
  test('luxuryFilterRoutes.js header comment names requireAuth, not optionalAuth', () => {
    expect(SRC.luxuryFilterRoutes).toMatch(/tightened regex \+ requireAuth/);
  });

  describe('the specific promoted sites', () => {
    test.each([
      ["luxuryFilterRouter.post('/validate', requireAuth,", 'luxuryFilterRoutes'],
      ["luxuryFilterRouter.post('/quick-check', requireAuth,", 'luxuryFilterRoutes'],
      ["seasonRhythmRouter.post('/validate', requireAuth,", 'seasonRhythmRoutes'],
      [
        "seasonRhythmRouter.get('/arc-health/:showId/:episodeNumber', requireAuth,",
        'seasonRhythmRoutes',
      ],
      ["seasonRhythmRouter.get('/season-health/:showId', requireAuth,", 'seasonRhythmRoutes'],
    ])('%s', (decl, file) => {
      expect(SRC[file]).toContain(decl);
    });
  });

  // Regression guard on the instrument itself. If a future refactor renames
  // these variables to `router`, §21's G1 would begin reporting them and the
  // Shape 4 miss would silently disappear — which would be a fix, but should be
  // a noticed one. This asserts the current shape, not that it is desirable.
  test('Shape 4 still exists as a shape — G1 would still miss these files', () => {
    Object.entries(SRC).forEach(([name, src]) => {
      const caseSensitiveG1 =
        src.match(/router\.(post|put|patch|delete)[^\n]*requireAuth/g) || [];
      expect(caseSensitiveG1).toEqual([]);
    });
  });
});