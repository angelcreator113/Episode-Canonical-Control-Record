import { describe, test, expect } from 'vitest';
import {
  DEAL_TYPE_NOT_SET, readinessCounts, eventCardMetaParts, matchesDealTypeFilter, dealTypeFilterOptions,
} from './eventCardSummary';
import { computeEventPackageReadiness } from './eventReadinessSections';
import { DEAL_TYPES } from './eventTerms';

describe('eventCardSummary (Task #2361)', () => {
  test('readinessCounts counts satisfied items over every package item', () => {
    const readiness = { sections: [
      { items: [{ satisfied: true }, { satisfied: false }] },
      { items: [{ satisfied: true }] },
    ] };
    expect(readinessCounts(readiness)).toEqual({ ready: 2, total: 3 });
    expect(readinessCounts(null)).toEqual({ ready: 0, total: 0 });
  });

  test('readinessCounts over a real event: total is every package item, ready grows as items are set', () => {
    const bare = readinessCounts(computeEventPackageReadiness({ id: 'e', name: 'Gala' }));
    expect(bare.total).toBeGreaterThan(1);
    expect(bare.ready).toBeLessThan(bare.total);
    const more = readinessCounts(computeEventPackageReadiness({ id: 'e', name: 'Gala', category: 'party', format: 'gala' }));
    expect(more.total).toBe(bare.total);
    expect(more.ready).toBe(bare.ready + 2);
  });

  test('meta line: organizer · date · deal type; missing date and deal type are left out', () => {
    const ev = {
      source_profile_id: 'p-1',
      canon_consequences: { automation: { host_profile_id: 'p-1', host_display_name: 'Maison Belle', host: 'Maison Belle' } },
      event_date: '2026-10-12',
      deal_type: 'paid_appearance',
    };
    const parts = eventCardMetaParts(ev);
    expect(parts.map((p) => p.key)).toEqual(['organizer', 'date', 'deal_type']);
    expect(parts[1].text).toBe('2026-10-12');
    expect(parts[2].text).toBe('Paid appearance');

    expect(eventCardMetaParts({})).toEqual([{ key: 'organizer', text: 'No organizer', missing: true }]);
  });

  test('deal-type filter: all, a type, or not set', () => {
    const paid = { deal_type: 'paid_appearance' };
    const none = { deal_type: null };
    expect(matchesDealTypeFilter(paid, 'all')).toBe(true);
    expect(matchesDealTypeFilter(paid, 'paid_appearance')).toBe(true);
    expect(matchesDealTypeFilter(paid, 'gifted')).toBe(false);
    expect(matchesDealTypeFilter(none, DEAL_TYPE_NOT_SET)).toBe(true);
    expect(matchesDealTypeFilter(paid, DEAL_TYPE_NOT_SET)).toBe(false);

    const options = dealTypeFilterOptions([paid, none, { deal_type: 'gifted' }]);
    expect(options[0]).toEqual({ key: 'all', label: 'All deal types', count: 3 });
    expect(options).toHaveLength(DEAL_TYPES.length + 2);
    expect(options.find((o) => o.key === 'paid_appearance').count).toBe(1);
    expect(options[options.length - 1]).toEqual({ key: DEAL_TYPE_NOT_SET, label: 'Deal type not set', count: 1 });
  });
});
