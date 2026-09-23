/**
 * eventBasics — Event Package Basics states and deterministic suggestions
 * (Task #1755).
 */
import { describe, test, expect } from 'vitest';
import {
  AUTO_DATE_KEY, FORMAT_START_TIMES, FORMAT_DRESS_CODES,
  suggestEventTime, suggestDressCode, isAutoScheduledDate, resolveEventBasics,
} from './eventBasics';
import { computeEventReadiness, computeEventState } from './eventReadiness';

const FORMATS = ['cocktail_party', 'garden_soiree', 'gallery_opening', 'gala', 'brunch', 'concert', 'brand_launch', 'premiere'];

describe('suggestion tables', () => {
  test('cover exactly the eight format values', () => {
    expect(Object.keys(FORMAT_START_TIMES).sort()).toEqual([...FORMATS].sort());
    expect(Object.keys(FORMAT_DRESS_CODES).sort()).toEqual([...FORMATS].sort());
  });

  test('the auto-date key matches the backend helper', () => {
    expect(AUTO_DATE_KEY).toBe('event_date_auto');
  });
});

describe('suggestEventTime', () => {
  test('suggests from format', () => {
    expect(suggestEventTime({ format: 'gala' })).toEqual({ value: '20:00', basis: 'From format: gala' });
    expect(suggestEventTime({ format: 'brunch' }).value).toBe('11:00');
  });

  test('returns null with no format or an unknown one', () => {
    expect(suggestEventTime({})).toBeNull();
    expect(suggestEventTime({ format: null, prestige: 9 })).toBeNull();
    expect(suggestEventTime({ format: 'rave' })).toBeNull();
    expect(suggestEventTime(null)).toBeNull();
  });

  test('is deterministic', () => {
    const ev = { format: 'concert', prestige: 7 };
    expect(suggestEventTime(ev)).toEqual(suggestEventTime({ ...ev }));
  });
});

describe('suggestDressCode', () => {
  test('format first', () => {
    expect(suggestDressCode({ format: 'brunch', prestige: 5 }, { name: 'Club Noir', dress_code: 'all black' }))
      .toEqual({ value: 'casual chic', basis: 'From format: brunch' });
  });

  test('venue dress code when there is no format', () => {
    expect(suggestDressCode({ prestige: 5 }, { name: 'Club Noir', dress_code: 'all black' }))
      .toEqual({ value: 'all black', basis: 'From venue: Club Noir' });
  });

  test('high prestige elevates a non-formal base', () => {
    expect(suggestDressCode({ format: 'concert', prestige: 8 }))
      .toEqual({ value: 'edgy nightlife, elevated', basis: 'From format: concert · prestige 8' });
  });

  test('high prestige leaves an already formal base alone', () => {
    expect(suggestDressCode({ format: 'gala', prestige: 10 }).value).toBe('black tie formal');
  });

  test('prestige alone, or nothing, gives no suggestion', () => {
    expect(suggestDressCode({ prestige: 9 })).toBeNull();
    expect(suggestDressCode({ prestige: 9 }, { name: 'Loft', dress_code: '  ' })).toBeNull();
    expect(suggestDressCode({}, null)).toBeNull();
  });
});

describe('isAutoScheduledDate', () => {
  const auto = { [AUTO_DATE_KEY]: '2026-11-07' };

  test('true while the column equals the flagged default', () => {
    expect(isAutoScheduledDate({ event_date: '2026-11-07', canon_consequences: { automation: auto } })).toBe(true);
  });

  test('false once the date is changed, even if the flag is left behind', () => {
    expect(isAutoScheduledDate({ event_date: '2026-12-01', canon_consequences: { automation: auto } })).toBe(false);
  });

  test('false with no flag', () => {
    expect(isAutoScheduledDate({ event_date: '2026-11-07', canon_consequences: { automation: {} } })).toBe(false);
    expect(isAutoScheduledDate({ event_date: '2026-11-07' })).toBe(false);
  });
});

describe('resolveEventBasics — three states', () => {
  test('set / suggested / missing', () => {
    const b = resolveEventBasics({
      event_date: '2026-11-07', format: 'gala', prestige: 9,
      description: 'A night at the museum', dress_code: null, event_time: null,
      canon_consequences: { automation: { [AUTO_DATE_KEY]: '2026-11-07' } },
    });
    expect(b.date).toMatchObject({ state: 'set', value: '2026-11-07', autoScheduled: true });
    expect(b.time).toMatchObject({ state: 'suggested', value: null, suggestion: { value: '20:00' } });
    expect(b.description).toMatchObject({ state: 'set', value: 'A night at the museum' });
    expect(b.dressCode).toMatchObject({ state: 'suggested', suggestion: { value: 'black tie formal' } });
  });

  test('no inputs → missing, never a suggestion', () => {
    const b = resolveEventBasics({ prestige: 9 });
    expect(b.date.state).toBe('missing');
    expect(b.time).toEqual({ state: 'missing', value: null, suggestion: null, fromSavedCopy: false });
    expect(b.description.state).toBe('missing');
    expect(b.dressCode.state).toBe('missing');
  });

  test('a saved value beats a suggestion', () => {
    const b = resolveEventBasics({ format: 'gala', event_time: '21:15', dress_code: 'all white' });
    expect(b.time).toMatchObject({ state: 'set', value: '21:15', suggestion: null });
    expect(b.dressCode).toMatchObject({ state: 'set', value: 'all white', suggestion: null });
  });

  test('time from the automation copy counts as set and is marked saved copy', () => {
    const b = resolveEventBasics({ format: 'gala', canon_consequences: { automation: { event_time: '19:00' } } });
    expect(b.time).toMatchObject({ state: 'set', value: '19:00', fromSavedCopy: true });
  });

  test('suggest: false (a used event) turns suggestions into missing', () => {
    const b = resolveEventBasics({ format: 'gala' }, null, { suggest: false });
    expect(b.time.state).toBe('missing');
    expect(b.dressCode.state).toBe('missing');
  });
});

describe('readiness does not read Basics suggestions', () => {
  // computeEventReadiness gates on outfit, venue, scene set and invitation
  // only; computeEventState adds the organizer. Neither reads time, dress
  // code, description or date — so showing a suggestion can't change them.
  const base = {
    source_profile_id: 7, outfit_pieces: [{ id: 'p1' }], venue_location_id: 'loc-1',
    scene_set_id: 'ss-1', invitation_asset_id: null, format: 'gala', prestige: 9,
  };

  test('same readiness with and without a suggestion showing', () => {
    const before = computeEventReadiness(base);
    const basics = resolveEventBasics(base);
    expect(basics.time.state).toBe('suggested');
    expect(computeEventReadiness(base)).toEqual(before);
    expect(computeEventState(base)).toBe('needs_setup');
  });

  test('accepting a time does not change readiness either', () => {
    expect(computeEventReadiness({ ...base, event_time: '20:00' })).toEqual(computeEventReadiness(base));
  });
});
