/**
 * The stats panel's pure parts (Task #3164): which number boxes are
 * accepted, and each number's "before → after" text.
 */
const { spotsProblem, valueText, spotTexts, trendOf, SIZES, TREND_COLORS } = require('../../../src/services/statsPanelService');

const spot = (extra = {}) => ({ id: 's1', stat: 'coins', x: 10, y: 20, w: 15, h: 60, icon: null, color: null, ...extra });

describe('stats panel spots', () => {
  test('a good box passes; an empty list passes', () => {
    expect(spotsProblem([spot(), spot({ id: 's2', stat: 'followers', icon: 'coin_icon', color: '#B8962E' })])).toBeNull();
    expect(spotsProblem([])).toBeNull();
  });

  test('each problem is named in plain words', () => {
    expect(spotsProblem('x')).toBe('spots must be a list.');
    expect(spotsProblem(Array.from({ length: 9 }, (_, i) => spot({ id: `s${i}` })))).toMatch(/at most 8/);
    expect(spotsProblem([spot({ stat: 'mood' })])).toMatch(/the stat must be one of coins, reputation, influence, followers, stress/);
    expect(spotsProblem([spot({ x: 101 })])).toBe('Number 1: x must be a number from 0 to 100.');
    expect(spotsProblem([spot({ w: 0.5 })])).toBe('Number 1 is too small.');
    expect(spotsProblem([spot({ icon: '../etc' })])).toMatch(/icon is not one of the show's overlays/);
    expect(spotsProblem([spot({ color: 'red' })])).toBe('Number 1: the colour must be like #FFFFFF.');
    expect(spotsProblem([spot({ id: '' })])).toBe('Number 1 has no id.');
  });

  test('the sizes: YouTube 1080p and 4K, the 1920 × 220 master doubled', () => {
    expect(SIZES).toEqual({ '1080p': { width: 1920, height: 220 }, '4k': { width: 3840, height: 440 } });
  });
});

describe('before → after', () => {
  const before = { coins: 450, reputation: 2, influence: 1, scale: 10, followers: null };
  const after = { coins: 650, reputation: 3, influence: 2, scale: 10, followers: { count: 62500 } };

  test('coins as a count, reputation and influence out of ten, followers as a count; a dash when unknown', () => {
    expect(valueText(after, 'coins')).toBe('650');
    expect(valueText({ coins: 12500 }, 'coins')).toBe('12,500');
    expect(valueText(after, 'reputation')).toBe('3/10');
    expect(valueText(after, 'followers')).toBe('62,500');
    expect(valueText(before, 'followers')).toBe('—');
    expect(valueText({ influence: null }, 'influence')).toBe('—');
    expect(valueText(null, 'coins')).toBe('—');
  });

  test('each box reads "before → after"; followers are left out until either side has her numbers', () => {
    const spots = [spot(), spot({ id: 'r', stat: 'reputation' }), spot({ id: 'f', stat: 'followers' })];
    expect(spotTexts(spots, before, after).map((s) => [s.id, s.text])).toEqual([
      ['s1', '450 → 650'], ['r', '2/10 → 3/10'], ['f', '— → 62,500'],
    ]);
    expect(spotTexts(spots, before, { ...after, followers: null }).map((s) => s.id)).toEqual(['s1', 'r']);
  });
});

// Stress on the stats card (Evoni, 2026-10-25): lower is better, so a fall
// is green and a rise rose-red when the box has no colour of its own.
describe('stress on the panel', () => {
  const before = { coins: 900, reputation: 4, influence: 3, stress: 6, scale: 10 };
  test('a stress box is accepted and reads before → after out of the scale', () => {
    expect(spotsProblem([spot({ stat: 'stress' })])).toBeNull();
    expect(valueText(before, 'stress')).toBe('6/10');
  });
  test('lower is better: its trend and its colour', () => {
    expect(trendOf('stress', before, { ...before, stress: 4 })).toBe('better');
    expect(trendOf('stress', before, { ...before, stress: 8 })).toBe('worse');
    expect(trendOf('stress', before, before)).toBe('same');
    expect(trendOf('reputation', before, { ...before, reputation: 6 })).toBe('better');
    expect(trendOf('stress', null, before)).toBeNull();
    const [fell] = spotTexts([spot({ stat: 'stress' })], before, { ...before, stress: 4 });
    expect(fell).toMatchObject({ text: '6/10 → 4/10', trend: 'better', color: TREND_COLORS.better });
    const [rose] = spotTexts([spot({ stat: 'stress' })], before, { ...before, stress: 8 });
    expect(rose).toMatchObject({ text: '6/10 → 8/10', trend: 'worse', color: TREND_COLORS.worse });
    // Her own colour wins; other stats keep theirs.
    expect(spotTexts([spot({ stat: 'stress', color: '#B8962E' })], before, { ...before, stress: 8 })[0].color).toBe('#B8962E');
    expect(spotTexts([spot({ stat: 'reputation' })], before, { ...before, reputation: 2 })[0].color).toBeNull();
  });
});
