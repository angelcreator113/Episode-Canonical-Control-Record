/**
 * eventCardDetails: what an Events card shows to Evoni's Producer Mode
 * redesign (2026-10-05).
 */
import { describe, test, expect } from 'vitest';
import { eventCardDetails } from './eventCardSummary';

describe('eventCardDetails', () => {
  test('the category, the place (venue · district · date, each only when set), the deal and the organizer', () => {
    const d = eventCardDetails({
      category: 'brand_launch', venue_name: 'Studio 9', lalaverse_district: 'Radiance Row', event_date: '2026-11-07',
      host_brand: 'Maison Belle', deal_type: 'paid_appearance', is_paid: true, payment_amount: 400,
      canon_consequences: { automation: {} },
    });
    expect(d.category).toBe('brand launch');
    expect(d.place).toEqual(['Studio 9', 'Radiance Row', '2026-11-07']);
    expect(d.deal).toEqual({ label: 'Paid appearance', pays: 'Paid: 400 coins' });
    expect(d.organizer).toBe('Maison Belle');
  });

  test('the saved copy fills a missing venue and district; nothing set reads as nulls and an empty place', () => {
    const saved = eventCardDetails({ canon_consequences: { automation: { venue_name: 'Echo Hall', lalaverse_district: 'Echo Park' } } });
    expect(saved.place).toEqual(['Echo Hall', 'Echo Park']);
    const bare = eventCardDetails({});
    expect(bare).toEqual({ category: null, place: [], deal: { label: null, pays: 'Unpaid' }, organizer: null });
  });
});
