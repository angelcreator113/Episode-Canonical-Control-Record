import { describe, test, expect } from 'vitest';
import { pageCount, clampPage, pageSlice, pageRange, pageButtons } from './paging';

describe('paging', () => {
  test('pages, slices and ranges', () => {
    const items = Array.from({ length: 23 }, (_, i) => i + 1);
    expect(pageCount(23, 5)).toBe(5);
    expect(pageCount(0, 5)).toBe(1);
    expect(pageSlice(items, 2, 5)).toEqual([6, 7, 8, 9, 10]);
    expect(pageSlice(items, 5, 5)).toEqual([21, 22, 23]);
    expect(pageRange(5, 23, 5)).toEqual({ from: 21, to: 23 });
    expect(pageRange(1, 0, 5)).toEqual({ from: 0, to: 0 });
  });

  test('a page out of range is kept in range', () => {
    expect(clampPage(9, 12, 5)).toBe(3);
    expect(clampPage(0, 12, 5)).toBe(1);
    expect(pageSlice([1, 2, 3], 4, 5)).toEqual([1, 2, 3]);
  });

  test('page numbers: all when few, a gap between runs when many', () => {
    expect(pageButtons(1, 5)).toEqual([1, 2, 3, 4, 5]);
    expect(pageButtons(1, 12)).toEqual([1, 2, 3, 4, 'gap', 12]);
    expect(pageButtons(6, 12)).toEqual([1, 'gap', 5, 6, 7, 'gap', 12]);
    expect(pageButtons(12, 12)).toEqual([1, 'gap', 9, 10, 11, 12]);
  });
});

describe('paging what is not a list', () => {
  test('counts as none', () => {
    expect(pageSlice({}, 1)).toEqual([]);
    expect(pageSlice(null, 1)).toEqual([]);
  });
});
