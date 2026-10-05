import { describe, test, expect } from 'vitest';
import { visibleSlice, showMoreLabel } from './showMore';

describe('showMore', () => {
  test('folds what is past the limit until opened', () => {
    expect(visibleSlice([1, 2, 3, 4], false, 2)).toEqual({ shown: [1, 2], hidden: 2 });
    expect(visibleSlice([1, 2, 3, 4], true, 2)).toEqual({ shown: [1, 2, 3, 4], hidden: 0 });
    expect(visibleSlice([1, 2], false, 2)).toEqual({ shown: [1, 2], hidden: 0 });
    expect(visibleSlice(null, false, 2)).toEqual({ shown: [], hidden: 0 });
  });

  test('labels the toggle', () => {
    expect(showMoreLabel(false, 3, 'parts')).toBe('Show 3 more parts');
    expect(showMoreLabel(false, 1)).toBe('Show 1 more');
    expect(showMoreLabel(true, 0, 'parts')).toBe('Show less');
  });
});
