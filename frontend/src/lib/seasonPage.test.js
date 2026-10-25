/** The Season page's pure helpers (lib/seasonPage, 2026-10-25). */
import { describe, test, expect } from 'vitest';
import { SEASON_TABS, seasonPageHref, tabFrom, dateRange, dayLabel, seasonStats, slotPicture, filterSlots, revealMatrix, heroChips } from './seasonPage';

const slot = (n, state, extra = {}) => ({ id: `s${n}`, slot_number: n, phase: n <= 8 ? 1 : n <= 16 ? 2 : 3, state, ...extra });

describe('seasonPage helpers', () => {
  test('tabs: a known key, else Overview', () => {
    expect(tabFrom('story')).toBe('story');
    expect(tabFrom('calendar')).toBe('overview');
    expect(tabFrom(null)).toBe('overview');
    // The Production Plan's old address opens Episodes (2026-10-25).
    expect(tabFrom('production')).toBe('episodes');
  });

  test('the eight tabs, in order, each with its note', () => {
    expect(SEASON_TABS.map((t) => t.key)).toEqual(['overview', 'roadmap', 'episodes', 'events', 'opportunities', 'story', 'goals', 'results']);
    for (const t of SEASON_TABS) expect(t.note).toMatch(/\.$/);
  });

  test('seasonPageHref: the tab, then any extra values; Overview has no ?tab=', () => {
    expect(seasonPageHref('show-1')).toBe('/shows/show-1/season');
    expect(seasonPageHref('show-1', 'overview')).toBe('/shows/show-1/season');
    expect(seasonPageHref('show-1', 'results')).toBe('/shows/show-1/season?tab=results');
    expect(seasonPageHref('show 1', 'opportunities', { deal_with: 'The Column', empty: '' })).toBe('/shows/show%201/season?tab=opportunities&deal_with=The+Column');
  });

  test('dates are calendar days, never shifted', () => {
    expect(dayLabel('2026-01-05')).toBe('Jan 5, 2026');
    expect(dateRange('2026-01-05', '2026-03-29')).toBe('Jan 5, 2026 – Mar 29, 2026');
    expect(dateRange('2026-01-05', null)).toBe('From Jan 5, 2026');
    expect(dateRange(null, null)).toBeNull();
    expect(dayLabel('Spring gala night')).toBeNull();
  });

  test('stats: the budget is the ledger or null, never a guess', () => {
    const roadmap = { slot_count: 24, counts: { done: 1 }, phases: [{ phase: 1, slots: [slot(1, 'done'), slot(2, 'event_ready'), slot(3, 'needs_event')] }] };
    const s = seasonStats({ roadmap, goals: [{ status: 'completed' }, { status: 'active' }, { status: 'failed' }], insights: null });
    expect(s.slots).toEqual({ total: 24, done: 1, remaining: 23 });
    expect(s.goals).toEqual({ total: 2, done: 1, remaining: 1 });
    expect(s.events).toEqual({ scheduled: 2, remaining: 22 });
    expect(s.budget).toBeNull();
    const withMoney = seasonStats({ roadmap, insights: { money: { season: { spend: 5, income: 2, net: -3 }, balance: 10, trend: [{ balance_after: 10 }] } } });
    expect(withMoney.budget).toEqual(expect.objectContaining({ balance: 10, spend: 5, income: 2, net: -3, has_ledger: true }));
  });

  test("a card's picture: episode thumbnail, else event cover, else part picture, else none", () => {
    const arc = { phases: [{ phase: 1, picture_url: 'P1' }, { phase: 2 }] };
    const episodes = [{ id: 'e1', thumbnail_url: 'T' }, { id: 'e2' }];
    const events = [{ id: 'v1', invitation_url: 'I' }];
    expect(slotPicture(slot(1, 'done', { episode: { id: 'e1' }, event: { id: 'v1' } }), { episodes, events, arc })).toBe('T');
    expect(slotPicture(slot(2, 'in_production', { episode: { id: 'e2' }, event: { id: 'v1' } }), { episodes, events, arc })).toBe('I');
    expect(slotPicture(slot(3, 'needs_event'), { episodes, events, arc })).toBe('P1');
    expect(slotPicture(slot(9, 'needs_event'), { episodes, events, arc })).toBeNull();
  });

  test('filters, the reveal matrix, the hero chips', () => {
    const slots = [slot(1, 'done'), slot(9, 'event_ready'), slot(10, 'needs_event')];
    expect(filterSlots(slots, { part: '2' }).map((s) => s.slot_number)).toEqual([9, 10]);
    expect(filterSlots(slots, { status: 'event_ready' }).map((s) => s.slot_number)).toEqual([9]);
    expect(revealMatrix({
      secrets: [{ id: 'a', text: 'A' }, { id: 'b', text: 'B' }],
      reveals: [{ secret_id: 'a', slot_number: 8, intent: 'hint' }, { secret_id: 'a', slot_number: 4, intent: 'hint' }, { secret_id: 'a', slot_number: 21, intent: 'reveal' }],
    })).toEqual([{ id: 'a', name: 'A', who: null, hints: [4, 8], reveal: 21 }]);
    expect(heroChips({ roadmap: { slot_count: 24 }, arc: { phases: [1, 2, 3], starts_on: '2026-01-05', ends_on: '2026-03-29' } }))
      .toEqual(['24 Episodes', '3 Parts', 'Jan 5, 2026 – Mar 29, 2026']);
  });
});
