/**
 * Beat plan coverage (audit GATE-01, 2026-10-03): plans with 0, 1, 13, 14
 * unique and 14 with a duplicate produce explicit statuses; zero beats never
 * reads complete.
 */
const { beatPlanCoverage, CANONICAL_NUMBERS } = require('../../../src/utils/beatPlanCoverage');

const rows = (...numbers) => numbers.map((n) => ({ beat_number: n }));
const all14 = () => rows(...CANONICAL_NUMBERS);

describe('beatPlanCoverage', () => {
  test('the canonical beats are 1 to 14', () => {
    expect(CANONICAL_NUMBERS).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]);
  });

  test('no plan is never complete', () => {
    for (const input of [[], null, undefined]) {
      const c = beatPlanCoverage(input);
      expect(c).toMatchObject({ complete: false, expected: 14, present: 0, duplicates: [], unknown: 0 });
      expect(c.missing).toEqual(CANONICAL_NUMBERS);
      expect(c.text).toBe('0 of 14 beats · missing beats 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13 and 14');
    }
  });

  test('one beat is one of fourteen, not a plan', () => {
    const c = beatPlanCoverage(rows(1));
    expect(c.complete).toBe(false);
    expect(c.present).toBe(1);
    expect(c.missing).toHaveLength(13);
  });

  test('thirteen names the one missing beat', () => {
    const c = beatPlanCoverage(rows(...CANONICAL_NUMBERS.filter((n) => n !== 7)));
    expect(c).toMatchObject({ complete: false, present: 13, missing: [7], text: '13 of 14 beats · missing beat 7' });
  });

  test('fourteen unique beats, in any order and as strings, is complete', () => {
    const shuffled = [...all14()].reverse().map((r) => ({ beat_number: String(r.beat_number) }));
    expect(beatPlanCoverage(shuffled)).toEqual({ complete: true, expected: 14, present: 14, missing: [], duplicates: [], unknown: 0, text: '14 of 14 beats' });
  });

  test('a duplicated beat is not coverage, even with fourteen rows', () => {
    const c = beatPlanCoverage(rows(1, 2, 3, 4, 5, 5, 7, 8, 9, 10, 11, 12, 13, 14));
    expect(c).toMatchObject({ complete: false, present: 13, missing: [6], duplicates: [5] });
    expect(c.text).toBe('13 of 14 beats · missing beat 6 · beat 5 appears more than once');
  });

  test('rows outside the canonical beats are counted as unknown', () => {
    const c = beatPlanCoverage([...all14(), { beat_number: 15 }, { beat_number: 'x' }, {}]);
    expect(c).toMatchObject({ complete: false, present: 14, missing: [], duplicates: [], unknown: 3 });
    expect(c.text).toBe('14 of 14 beats · 3 rows have no canonical beat number');
  });
});
