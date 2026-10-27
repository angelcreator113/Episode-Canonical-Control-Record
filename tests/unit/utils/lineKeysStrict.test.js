'use strict';

/**
 * The strict identity plan (A1c R1; spec §2.4 and §4.2; design rules 1-4):
 * an exact unique line keeps its identity; a repeated line keeps its
 * identities only when its copies match one for one and cross no other
 * match; a similar line is a suggestion, never a match. Used only by the
 * counts-only log in R1; nothing is stored.
 */

const { planLineIdentity } = require('../../../src/utils/lineKeys');

const plan = (before, after) => planLineIdentity(before.join('\n'), after.join('\n'));

describe('planLineIdentity (strict)', () => {
  test('an unchanged script keeps every line', () => {
    const p = plan(['A one.', 'B two.', 'C three.'], ['A one.', 'B two.', 'C three.']);
    expect(p.counts).toMatchObject({ lines_before: 3, lines_after: 3, kept_exact: 3, new: 0, removed: 0, uncertain_group: 0, uncertain_similar: 0 });
  });

  test('a pure deletion keeps the rest', () => {
    const p = plan(['A one.', 'B two.', 'C three.'], ['A one.', 'C three.']);
    expect(p.counts).toMatchObject({ kept_exact: 2, removed: 1, new: 0, uncertain_group: 0 });
    expect(p.pairs).toEqual([{ old: 0, new: 0, kind: 'kept' }, { old: 2, new: 1, kind: 'kept' }]);
  });

  test('[Yes., Hello, Yes.] -> [Yes., Yes., Hello]: the repeated line is uncertain, Hello is kept', () => {
    const p = plan(['Yes.', 'Hello', 'Yes.'], ['Yes.', 'Yes.', 'Hello']);
    expect(p.counts).toMatchObject({ kept_exact: 1, kept_group: 0, uncertain_group: 2, new: 2, removed: 2 });
    expect(p.pairs).toEqual([{ old: 1, new: 2, kind: 'kept' }]);
  });

  test('a repeated line that crosses nothing keeps its copies in order', () => {
    const p = plan(['Yes.', 'Hello', 'Yes.'], ['Yes.', 'Hello', 'Yes.', 'Bye.']);
    expect(p.counts).toMatchObject({ kept_exact: 1, kept_group: 2, new: 1, uncertain_group: 0 });
  });

  test('a repeated line whose count changed is uncertain', () => {
    const p = plan(['Yes.', 'Hello'], ['Yes.', 'Hello', 'Yes.']);
    expect(p.counts).toMatchObject({ kept_exact: 1, uncertain_group: 2, kept_group: 0 });
  });

  test('an edited line is a suggestion, never a match', () => {
    const p = plan(['Lala: I love this dress so much.'], ['Lala: I love this dress so very much.']);
    expect(p.pairs).toEqual([]);
    expect(p.counts).toMatchObject({ kept_exact: 0, uncertain_similar: 1, new: 1, removed: 1 });
  });

  test('a line moved to another beat is counted as moved', () => {
    const before = ['## BEAT: 1 · Opening Ritual', 'A one.', '## BEAT: 2 · Creator Welcome', 'B two.'];
    const after = ['## BEAT: 1 · Opening Ritual', '## BEAT: 2 · Creator Welcome', 'B two.', 'A one.'];
    expect(plan(before, after).counts.moved).toBeGreaterThanOrEqual(1);
  });
});
