'use strict';

/**
 * David's appearance is not decided (Evoni, 2026-10-16: "yes make the David
 * change"; docs/CANON.md). The writing tools follow the chapter's notes and
 * no longer forbid him to speak or appear in person.
 */
const fs = require('fs');
const path = require('path');

const read = (...p) => fs.readFileSync(path.join(__dirname, '..', '..', '..', ...p), 'utf8');

describe("David's appearance is not decided", () => {
  test('the appearance rules follow the chapter and forbid nothing', () => {
    const rules = read('frontend', 'src', 'data', 'characterAppearanceRules.js');
    const david = rules.slice(rules.indexOf('the_husband:'), rules.indexOf('the_comparison_creator:'));
    expect(david).toMatch(/appearance_mode: 'Not decided yet — follow the chapter'/);
    expect(david).toMatch(/do not invent a scene with him/);
    expect(david).not.toMatch(/NEVER speaks|cannot speak, appear physically|Interior Monologue Only/);
    expect(david).toMatch(/He cannot be villainized/); // still kind, still not the problem
    expect(rules).not.toMatch(/The Husband never speaks aloud/);
  });

  test("Write Mode's rules say the same", () => {
    const stories = read('src', 'routes', 'memories', 'stories.js');
    expect(stories).not.toMatch(/The Husband never speaks aloud/);
    expect(stories).toMatch(/The Husband \(David\): when and how he appears is not decided yet/);
  });

  test('CANON.md records it', () => {
    expect(read('docs', 'CANON.md')).toMatch(/\*\*David's appearance is not decided\*\*/);
  });
});
