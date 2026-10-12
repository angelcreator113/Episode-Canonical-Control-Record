// The closeness ledger's pure parts (Task #2983; The Pulse spec §9).
const { pairOf, clamp, handlesIn, NUDGE, AUTO_STEP, AUTO_MOMENT, MAX_ADJUST, CAUSES } = require('../../../src/services/pulseCloseness');

describe('pulseCloseness helpers', () => {
  test('a pair is always lower id first', () => {
    expect(pairOf(9, 3)).toEqual([3, 9]);
    expect(pairOf('3', '9')).toEqual([3, 9]);
  });

  test('closeness stays within 0–1, to three places', () => {
    expect(clamp(1.04)).toBe(1);
    expect(clamp(-0.2)).toBe(0);
    expect(clamp(0.7300000001)).toBe(0.73);
  });

  test('@handles in a post, once each, without trailing dots, lower case', () => {
    expect(handlesIn('big love to @Marcus.K. and @nia_x, @nia_x again')).toEqual(['marcus.k', 'nia_x']);
    expect(handlesIn('no handles, an email a@b is one char')).toEqual([]);
    expect(handlesIn(null)).toEqual([]);
  });

  test('every nudge is small enough to auto-accept on its own, and the limits hold together', () => {
    for (const n of Object.values(NUDGE)) expect(Math.abs(n)).toBeLessThanOrEqual(AUTO_STEP);
    expect(AUTO_STEP).toBeLessThan(AUTO_MOMENT);
    expect(MAX_ADJUST).toBeGreaterThan(AUTO_STEP);
    expect(CAUSES).toEqual(['comment', 'mention', 'ignored', 'override']);
  });
});
