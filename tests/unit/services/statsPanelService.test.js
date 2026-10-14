/**
 * The stats panel's pure parts (Task #3164): which number boxes are
 * accepted, and each number's "before → after" text.
 */
const { spotsProblem, valueText, spotTexts, SIZES } = require('../../../src/services/statsPanelService');

const spot = (extra = {}) => ({ id: 's1', stat: 'coins', x: 10, y: 20, w: 15, h: 60, icon: null, color: null, ...extra });

describe('stats panel spots', () => {
  test('a good box passes; an empty list passes', () => {
    expect(spotsProblem([spot(), spot({ id: 's2', stat: 'followers', icon: 'coin_icon', color: '#B8962E' })])).toBeNull();
    expect(spotsProblem([])).toBeNull();
  });

  test('each problem is named in plain words', () => {
    expect(spotsProblem('x')).toBe('spots must be a list.');
    expect(spotsProblem(Array.from({ length: 9 }, (_, i) => spot({ id: `s${i}` })))).toMatch(/at most 8/);
    expect(spotsProblem([spot({ stat: 'stress' })])).toMatch(/the stat must be one of coins, reputation, influence, followers/);
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
