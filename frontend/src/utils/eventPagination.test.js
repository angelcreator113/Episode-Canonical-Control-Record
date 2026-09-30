import { describe, test, expect } from 'vitest';
import { EVENTS_PER_PAGE, parseEventPage, paginateEvents, eventPageNumbers } from './eventPagination';

const list = (n) => Array.from({ length: n }, (_, i) => i + 1);

describe('eventPagination (Task #2360)', () => {
  test('9 per page; 50 events make 6 pages, the last holding 5', () => {
    expect(EVENTS_PER_PAGE).toBe(9);
    expect(paginateEvents(list(50), 1)).toEqual({ page: 1, totalPages: 6, pageItems: [1, 2, 3, 4, 5, 6, 7, 8, 9] });
    expect(paginateEvents(list(50), 6).pageItems).toEqual([46, 47, 48, 49, 50]);
  });

  test('a page past the end clamps to the last page; an empty list is one page', () => {
    expect(paginateEvents(list(10), 9)).toMatchObject({ page: 2, totalPages: 2, pageItems: [10] });
    expect(paginateEvents([], 3)).toEqual({ page: 1, totalPages: 1, pageItems: [] });
  });

  test('parseEventPage accepts positive integers only', () => {
    expect(parseEventPage('4')).toBe(4);
    expect(parseEventPage(null)).toBe(1);
    expect(parseEventPage('0')).toBe(1);
    expect(parseEventPage('-2')).toBe(1);
    expect(parseEventPage('abc')).toBe(1);
  });

  test('page numbers: all up to 7 pages, windowed with gaps past that', () => {
    expect(eventPageNumbers(1, 7)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(eventPageNumbers(1, 12)).toEqual([1, 2, 'gap', 12]);
    expect(eventPageNumbers(6, 12)).toEqual([1, 'gap', 5, 6, 7, 'gap', 12]);
    expect(eventPageNumbers(12, 12)).toEqual([1, 'gap', 11, 12]);
  });
});
