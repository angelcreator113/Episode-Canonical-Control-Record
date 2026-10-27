/** lib/myLittleList: the safe list's URLs and the plain-word helpers (Phase 2). */
import { describe, test, expect } from 'vitest';
import { listUrl, reviewUrl, progressPercent, refusalText, showsAtText, REASON_LABELS } from './myLittleList';

test('URLs: the phone\'s list at a position; the producer\'s review with every item', () => {
  expect(listUrl('ep 1', 6, 2)).toBe('/api/v1/episodes/ep%201/my-little-list?beat=6&line=2');
  expect(listUrl('ep-1')).toBe('/api/v1/episodes/ep-1/my-little-list');
  expect(listUrl('ep-1', 15, -1)).toBe('/api/v1/episodes/ep-1/my-little-list');
  expect(reviewUrl('ep-1', 5, 0)).toBe('/api/v1/episodes/ep-1/my-little-list/review?beat=5&line=0&all=1');
  expect(reviewUrl('ep-1')).toBe('/api/v1/episodes/ep-1/my-little-list/review?all=1');
});

test('progress', () => {
  expect(progressPercent({ done: 2, total: 6 })).toBe(33);
  expect(progressPercent({ done: 0, total: 0 })).toBe(0);
});

describe('refusalText', () => {
  test.each([
    ['COMPLETION_FROM_GAMEPLAY', 'That one ticks itself as she plays.'],
    ['PERSONAL_LIST_MIGRATION_PENDING', /saving waits/],
    ['LIST_ITEM_NOT_FOUND', /isn.t on her list/],
  ])('%s', (code, text) => {
    expect(refusalText({ response: { data: { code } } })).toEqual(typeof text === 'string' ? text : expect.stringMatching(text));
  });
  test('else the server\'s words, else the error\'s', () => {
    expect(refusalText({ response: { data: { error: 'title is required' } } })).toBe('title is required');
    expect(refusalText(new Error('Network Error'))).toBe('Network Error');
  });
});

test('showsAtText and the reasons', () => {
  expect(showsAtText({ beat: 0, line: 0 })).toBe('From the start');
  expect(showsAtText({ beat: 5, line: 3 })).toBe('From beat 5, line 4');
  expect(showsAtText({ beat: 5, line: null })).toBe('At the end of beat 5');
  expect(showsAtText(null)).toMatch(/Never/);
  expect(Object.keys(REASON_LABELS).sort()).toEqual(['duplicate_wording', 'needs_wording', 'no_reveal_rule', 'not_known_yet', 'spoiler']);
});
