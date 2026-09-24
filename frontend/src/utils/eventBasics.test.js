/**
 * eventBasics — Event Package Basics states and deterministic suggestions
 * (Task #1755).
 */
import { describe, test, expect } from 'vitest';
import {
  AUTO_DATE_KEY, FORMAT_START_TIMES, FORMAT_DRESS_CODES,
  suggestEventTime, suggestDressCode, isAutoScheduledDate, resolveEventBasics,
} from './eventBasics';
import { computeEventPackageReadiness, computeEventState } from './eventReadinessSections';
import { createRequire } from 'module';

// The server's own merge for PUT canon_consequences (PR #1749), so the
// label scenarios below replay what the route actually stores.
const { mergeCanonConsequences } = createRequire(import.meta.url)('../../../src/utils/canonConsequencesMerge.js');

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

describe('a Basics suggestion never satisfies readiness', () => {
  // Readiness (computeEventPackageReadiness, eventReadinessSections.js)
  // counts a Basics field only in the 'set' state. Before Task #1775 it did
  // not read time at all; now time is an Event identity item (a warning,
  // not a gate), so these tests pin that a suggested time stays missing and
  // an accepted one counts, while the gates and queue state do not move.
  const base = {
    source_profile_id: 7, outfit_pieces: [{ id: 'p1' }], venue_location_id: 'loc-1',
    scene_set_id: 'ss-1', invitation_asset_id: null, format: 'gala', prestige: 9,
  };
  const identityMissing = (r) => r.sections.find((s) => s.key === 'identity').missing.map((m) => m.key);

  test('a suggested time is still missing, and readiness is the same with or without it showing', () => {
    const before = computeEventPackageReadiness(base);
    const basics = resolveEventBasics(base);
    expect(basics.time.state).toBe('suggested');
    expect(identityMissing(before)).toContain('time');
    expect(computeEventPackageReadiness(base)).toEqual(before);
    expect(computeEventState(base)).toBe('needs_setup');
  });

  test('accepting a time satisfies the time item and leaves the gates alone', () => {
    const before = computeEventPackageReadiness(base);
    const after = computeEventPackageReadiness({ ...base, event_time: '20:00' });
    expect(identityMissing(after)).not.toContain('time');
    expect(after.gatesMet).toBe(before.gatesMet);
    expect(after.blocking.map((s) => s.key)).toEqual(before.blocking.map((s) => s.key));
  });
});

describe('auto-scheduled label across real saves (PUT merge replayed)', () => {
  const D = '2026-11-07'; // the create path's default, flagged
  const X = '2026-12-24'; // a date Evoni chose
  const guests = [{ profile_id: 1, featured: true }];
  const created = () => ({
    event_date: D,
    canon_consequences: { automation: { [AUTO_DATE_KEY]: D, guest_profiles: guests } },
  });
  // What PUT /world/:showId/events/:eventId stores: columns replaced,
  // canon_consequences merged two levels deep.
  const put = (stored, body) => ({
    ...stored,
    ...body,
    ...(body.canon_consequences !== undefined
      ? { canon_consequences: mergeCanonConsequences(stored.canon_consequences, body.canon_consequences) }
      : {}),
  });
  // The old eventDetailModal 💾 Save: the columns it holds plus the whole
  // canon_consequences copy it opened with, automation re-spread over it.
  const oldModalSave = (openedCopy, eventDate) => ({
    event_date: eventDate,
    canon_consequences: {
      ...openedCopy.canon_consequences,
      automation: { ...openedCopy.canon_consequences.automation, event_date: eventDate },
    },
  });

  test('a new event is labelled', () => {
    expect(isAutoScheduledDate(created())).toBe(true);
  });

  test('Package date save: label gone, flag deleted, guests kept', () => {
    const after = put(created(), { event_date: X, canon_consequences: { automation: { [AUTO_DATE_KEY]: null } } });
    expect(isAutoScheduledDate(after)).toBe(false);
    expect(after.canon_consequences.automation).not.toHaveProperty(AUTO_DATE_KEY);
    expect(after.canon_consequences.automation.guest_profiles).toEqual(guests);
  });

  test('old modal changes the date: stale flag re-sent, label still gone (flag and date disagree)', () => {
    const opened = created();
    const after = put(opened, oldModalSave(opened, X));
    expect(after.canon_consequences.automation[AUTO_DATE_KEY]).toBe(D);
    expect(after.event_date).toBe(X);
    expect(isAutoScheduledDate(after)).toBe(false);
  });

  test('stale old-modal save after a Package change reverts date and flag together: label shows, and the date really is the default again', () => {
    const opened = created(); // copy held in another tab
    const packageSaved = put(opened, { event_date: X, canon_consequences: { automation: { [AUTO_DATE_KEY]: null } } });
    const after = put(packageSaved, oldModalSave(opened, D));
    expect(after.event_date).toBe(D);
    expect(isAutoScheduledDate(after)).toBe(true);
  });

  test('residual: old editor sets the date back to exactly the default after changing it: label reappears', () => {
    const opened = created();
    const changed = put(opened, oldModalSave(opened, X));        // flag D left behind
    const back = put(changed, oldModalSave(changed, D));        // she picks D in the old editor
    expect(isAutoScheduledDate(back)).toBe(true);
    // Any Package date save clears it for good:
    const fixed = put(back, { event_date: D, canon_consequences: { automation: { [AUTO_DATE_KEY]: null } } });
    expect(isAutoScheduledDate(fixed)).toBe(false);
  });

  test('flag present but date column empty: no label (the date row reads the saved copy)', () => {
    const ev = { event_date: null, canon_consequences: { automation: { [AUTO_DATE_KEY]: D, event_date: D } } };
    expect(isAutoScheduledDate(ev)).toBe(false);
    expect(resolveEventBasics(ev).date).toMatchObject({ state: 'set', value: D, autoScheduled: false });
  });

  test('date equals the default with no flag (an existing or Package-saved event): no label', () => {
    expect(isAutoScheduledDate({ event_date: D, canon_consequences: { automation: {} } })).toBe(false);
  });
});
