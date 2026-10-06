import { describe, test, expect } from 'vitest';
import { EVENTS_PER_PAGE, parseEventPage, paginateEvents, eventPageNumbers, readEventQuery, nextEventParams, eventRangeText } from './eventPagination';

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

describe('the queue in the URL', () => {
  test('readEventQuery: each value from the URL, else its default; an unknown sort is name', () => {
    expect(readEventQuery(new URLSearchParams(''))).toEqual({ search: '', state: 'all', deal: 'all', sort: 'name' });
    expect(readEventQuery(new URLSearchParams('evq=gala&evstate=ready&evdeal=gifted&evsort=cost')))
      .toEqual({ search: 'gala', state: 'ready', deal: 'gifted', sort: 'cost' });
    expect(readEventQuery(new URLSearchParams('evsort=nope')).sort).toBe('name');
  });

  test('nextEventParams: a filter change resets the page; defaults leave the URL; a page alone moves it', () => {
    const prev = new URLSearchParams('tab=events&evpage=7&evdeal=gifted');
    expect(nextEventParams(prev, { state: 'ready' }).toString()).toBe('tab=events&evdeal=gifted&evstate=ready');
    expect(nextEventParams(prev, { deal: 'all' }).toString()).toBe('tab=events');
    expect(nextEventParams(prev, { page: 3 }).toString()).toBe('tab=events&evpage=3&evdeal=gifted');
    expect(nextEventParams(prev, { search: '' }).get('evq')).toBeNull();
  });

  test('eventRangeText: the page range, the matching count and the total', () => {
    expect(eventRangeText({ page: 1, perPage: 9, matching: 260, total: 260 })).toBe('Showing 1–9 of 260 events');
    expect(eventRangeText({ page: 14, perPage: 9, matching: 120, total: 260 })).toBe('Showing 118–120 of 120 matching · 260 events');
    expect(eventRangeText({ page: 1, perPage: 9, matching: 1, total: 1 })).toBe('Showing 1 of 1 event');
    expect(eventRangeText({ page: 1, perPage: 9, matching: 0, total: 12 })).toBe('No events match · 12 events');
    expect(eventRangeText({ page: 1, perPage: 9, matching: 0, total: 0 })).toBe('No events yet');
  });
});

