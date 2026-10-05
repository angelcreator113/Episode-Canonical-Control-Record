import { describe, test, expect } from 'vitest';
import { shortDate, shortTime, heroTiles, seasonLine, readinessTile, readinessHeadline, pageNav } from './eventPackageHero';

describe('Event Package header helpers', () => {
  test('dates and times read short; anything else as stored', () => {
    expect(shortDate('2026-11-12')).toBe('Thu, Nov 12');
    expect(shortDate('next Friday')).toBe('next Friday');
    expect(shortTime('18:30')).toBe('6:30 PM');
    expect(shortTime('09:05:00')).toBe('9:05 AM');
    expect(shortTime('00:15')).toBe('12:15 AM');
    expect(shortTime('dusk')).toBe('dusk');
    expect(shortDate(null)).toBeNull();
  });

  test('the five tiles, each saying so when nothing is set', () => {
    const tiles = heroTiles({
      event: { event_time: '18:30', lalaverse_district: 'Echo Park' },
      venueDate: { eventDate: '2026-11-12', venueName: 'Studio by Sable' },
      organizer: { name: 'STUDIO BY SABLE', handle: 'studiobysable', kind: 'creator' },
      projection: { complete: true, label: { text: 'Easy' } },
      dealLabel: 'Paid content',
      compensation: { isPaid: true, amount: 439 },
    });
    expect(tiles.map((t) => [t.key, t.value, t.sub])).toEqual([
      ['when', 'Thu, Nov 12', '6:30 PM'], ['where', 'Studio by Sable', 'Echo Park'], ['organizer', 'STUDIO BY SABLE', '@studiobysable'],
      ['deal', 'Paid content', 'Earns 439 coins'], ['challenge', 'Easy', 'projected'],
    ]);
    const bare = heroTiles({ event: {}, venueDate: {}, organizer: null, projection: { complete: false }, dealLabel: null, compensation: { amount: 0 } });
    expect(bare.map((t) => [t.value, t.empty])).toEqual([['No date', true], ['No venue', true], ['No organizer', true], ['No deal set', true], ['Not projected', true]]);
    expect(heroTiles({ event: {}, venueDate: {}, organizer: { name: 'Velour', kind: 'brand' }, projection: {}, dealLabel: 'Gifted', compensation: { isPaid: false, amount: 0 } })
      .filter((t) => ['organizer', 'deal'].includes(t.key)).map((t) => t.sub)).toEqual(['Brand', 'Unpaid']);
  });

  test('the season line', () => {
    expect(seasonLine({ in_slot: true, label: 'S1 · E1', season_number: 1, phase: { number: 1, title: 'Foundation' } })).toBe('S1 · E1 · Season 1 · Phase 1: Foundation');
    expect(seasonLine({ in_slot: false, season_number: 2 })).toBe('Season 2 · not on the roadmap yet');
    expect(seasonLine(null)).toBeNull();
  });

  test('a readiness tile, the headline, and the menu with each section\'s worst state', () => {
    expect(readinessTile({ key: 'place', label: 'Place', complete: true })).toEqual({ key: 'place', label: 'Place', kind: 'complete', text: 'Complete' });
    expect(readinessTile({ key: 'people', label: 'People', complete: false, kind: 'warning', missing: [{ label: 'Featured attendees' }, { label: 'Notes' }] }).text).toBe('Featured attendees +1');
    const readiness = {
      gatesMet: true, blockingItems: [], warningItems: [{}, {}],
      sections: [
        { key: 'organizer', complete: true }, { key: 'people', complete: false, kind: 'warning' },
        { key: 'identity', complete: true }, { key: 'invitation', complete: false, kind: 'warning' }, { key: 'look', complete: false, kind: 'blocking' },
      ],
    };
    expect(readinessHeadline(readiness)).toBe('Ready · 2 warnings to review');
    expect(readinessHeadline(readiness, 1)).toBe('Ready · 3 warnings to review');
    expect(readinessHeadline({ gatesMet: true, warningItems: [], blockingItems: [] })).toBe('Ready');
    expect(readinessHeadline({ gatesMet: false, warningItems: [], blockingItems: [{}] })).toBe('1 item needed to start');
    const nav = Object.fromEntries(pageNav(readiness).map((s) => [s.anchor, s.state]));
    // The Event covers the identity and the invitation: the worse of the two.
    expect(nav).toMatchObject({ identity: 'warning', people: 'warning', look: 'blocking', review: 'none' });
    expect(nav.invitation).toBeUndefined();
  });
});
