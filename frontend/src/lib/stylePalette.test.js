import { describe, test, expect } from 'vitest';
import { dominantColors } from './stylePalette';

describe('dominantColors (Task #2814)', () => {
  test('finds the main colours, most common first, as uppercase hex', () => {
    const crimson = Array(60).fill([160, 20, 40]);
    const gold = Array(30).fill([184, 150, 46]);
    const blush = Array(10).fill([233, 196, 213]);
    expect(dominantColors([...gold, ...crimson, ...blush], 3)).toEqual(['#A01428', '#B8962E', '#E9C4D5']);
  });

  test('sets aside white backgrounds and black shadows', () => {
    const px = [...Array(80).fill([255, 255, 255]), ...Array(10).fill([5, 5, 5]), ...Array(10).fill([173, 121, 182])];
    expect(dominantColors(px, 1)).toEqual(['#AD79B6']);
  });

  test('never more than k colours, and nothing from nothing', () => {
    const px = Array.from({ length: 200 }, (_, i) => [i % 256, (i * 3) % 256, (i * 7) % 256]);
    expect(dominantColors(px, 5).length).toBeLessThanOrEqual(5);
    expect(dominantColors([], 5)).toEqual([]);
  });
});
