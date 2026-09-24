import { describe, it, expect } from 'vitest';
import {
  EVENT_CATEGORIES, EVENT_FORMATS, taxonomyLabel, resolveTaxonomyField,
} from './eventTaxonomy';

describe('eventTaxonomy lists', () => {
  it('has the ten categories and eight formats, no duplicates', () => {
    expect(EVENT_CATEGORIES).toHaveLength(10);
    expect(EVENT_FORMATS).toHaveLength(8);
    expect(new Set(EVENT_CATEGORIES).size).toBe(EVENT_CATEGORIES.length);
    expect(new Set(EVENT_FORMATS).size).toBe(EVENT_FORMATS.length);
  });

  it('cannot be mutated by a caller', () => {
    expect(Object.isFrozen(EVENT_CATEGORIES)).toBe(true);
    expect(Object.isFrozen(EVENT_FORMATS)).toBe(true);
  });
});

describe('taxonomyLabel', () => {
  it('title-cases snake_case values', () => {
    expect(taxonomyLabel('brunch_dining')).toBe('Brunch Dining');
    expect(taxonomyLabel('gala')).toBe('Gala');
  });

  it('returns empty for nothing', () => {
    expect(taxonomyLabel(null)).toBe('');
    expect(taxonomyLabel('  ')).toBe('');
  });
});

describe('resolveTaxonomyField', () => {
  it('is missing when empty, with no suggestion', () => {
    for (const v of [null, undefined, '', '   ']) {
      const f = resolveTaxonomyField(v, EVENT_FORMATS);
      expect(f).toEqual({ state: 'missing', value: null, inList: true });
      expect(f).not.toHaveProperty('suggestion');
    }
  });

  it('is set for an allowed value', () => {
    expect(resolveTaxonomyField('gala', EVENT_FORMATS)).toEqual({ state: 'set', value: 'gala', inList: true });
    expect(resolveTaxonomyField(' fashion ', EVENT_CATEGORIES)).toEqual({ state: 'set', value: 'fashion', inList: true });
  });

  it('is still set, but flagged, for a stored value outside the list', () => {
    expect(resolveTaxonomyField('rooftop_rave', EVENT_FORMATS)).toEqual({ state: 'set', value: 'rooftop_rave', inList: false });
  });
});
