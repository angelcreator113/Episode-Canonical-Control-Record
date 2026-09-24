import { describe, it, expect } from 'vitest';
import {
  sameEditorValue, changedFields, withoutOrganizerKeys, hydrateEventForModal,
  missingForMarkReady, ORGANIZER_KEYS,
} from './eventEditorChanges';

const NOW = new Date('2026-09-24T12:00:00Z');

describe('sameEditorValue', () => {
  it('treats every blank as the same', () => {
    for (const [a, b] of [[null, ''], [undefined, null], ['', []], [[], undefined]]) {
      expect(sameEditorValue(a, b)).toBe(true);
    }
  });
  it('compares numbers by value, strings exactly, arrays by content', () => {
    expect(sameEditorValue(5, '5')).toBe(true);
    expect(sameEditorValue(5, 6)).toBe(false);
    expect(sameEditorValue('chic', 'chic')).toBe(true);
    expect(sameEditorValue('chic', 'Chic')).toBe(false);
    expect(sameEditorValue(['a', 'b'], ['a', 'b'])).toBe(true);
    expect(sameEditorValue(['a'], ['a', 'b'])).toBe(false);
  });
});

describe('changedFields', () => {
  it('returns only the keys whose value changed', () => {
    const base = { name: 'Gala', prestige: 5, dress_code: 'chic' };
    const cur = { name: 'Gala Night', prestige: '5', dress_code: 'chic', host: '' };
    expect(changedFields(base, cur, ['name', 'prestige', 'dress_code', 'host'])).toEqual({ name: 'Gala Night' });
  });
  it('returns nothing when nothing changed', () => {
    const base = { a: 1, b: [], c: null };
    expect(changedFields(base, { a: 1, b: [], c: '' }, ['a', 'b', 'c'])).toEqual({});
  });
  it('ignores keys the current object does not have', () => {
    expect(changedFields({ a: 1 }, {}, ['a'])).toEqual({});
  });
});

describe('withoutOrganizerKeys', () => {
  it('drops host, host_brand and source_profile_id only', () => {
    expect(ORGANIZER_KEYS).toEqual(['host', 'host_brand', 'source_profile_id']);
    expect(withoutOrganizerKeys({ host: 'x', host_brand: 'Velour', source_profile_id: 'p', description: 'd' }))
      .toEqual({ description: 'd' });
  });
});

describe('hydrateEventForModal', () => {
  it('shows the same values the modal always showed, and says where each came from', () => {
    const ev = {
      id: 'e1', prestige: 7, event_date: null, event_time: null, dress_code: null,
      cost_coins: 100, strictness: null, deadline_type: null, host: null, venue_name: null,
      canon_consequences: { automation: { venue_name: 'Club Noir', content_category: 'fashion', host_display_name: 'Mika' } },
    };
    const { values, sources } = hydrateEventForModal(ev, NOW);
    expect(values.event_date).toBe('2026-10-08');
    expect(sources.event_date).toBe('derived');
    expect(values.event_time).toBe('20:00');
    expect(sources.event_time).toBe('derived');
    expect(values.dress_code).toBe('runway-ready');
    expect(sources.dress_code).toBe('derived');
    expect(values.cost_coins).toBe(100);
    expect(sources.cost_coins).toBe('column');
    expect(values.strictness).toBe(8);
    expect(sources.strictness).toBe('derived');
    expect(values.venue_name).toBe('Club Noir');
    expect(sources.venue_name).toBe('saved_copy');
    expect(values.host).toBe('Mika');
    expect(sources.host).toBe('saved_copy');
    expect(values.description).toBe('');
    expect(sources.description).toBe('empty');
    expect(values.color_palette).toEqual([]);
  });
  it("falls back to 'chic' when the host's category is unknown", () => {
    const { values, sources } = hydrateEventForModal({ canon_consequences: {} }, NOW);
    expect(values.dress_code).toBe('chic');
    expect(sources.dress_code).toBe('derived');
  });
  it('keeps a stored zero cost (nullish, not falsy)', () => {
    expect(hydrateEventForModal({ cost_coins: 0 }, NOW).sources.cost_coins).toBe('column');
  });
});

describe('missingForMarkReady', () => {
  const base = {
    host: 'Mika', venue_name: 'Club Noir', description: 'A night.',
    event_date: '2026-11-07', dress_code: 'black tie', canon_consequences: {},
  };
  it('passes when every required field is stored', () => {
    expect(missingForMarkReady(base, NOW)).toEqual([]);
  });
  it('counts an invented date or dress code as missing', () => {
    expect(missingForMarkReady({ ...base, event_date: null, dress_code: '' }, NOW)).toEqual(['Event Date', 'Dress Code']);
  });
  it('accepts a value stored only in the saved automation copy', () => {
    const ev = { ...base, venue_name: null, canon_consequences: { automation: { venue_name: 'Club Noir' } } };
    expect(missingForMarkReady(ev, NOW)).toEqual([]);
  });
});
