/**
 * The Event Package's flow checks (src/utils/eventFlowChecks.js): smart
 * defaults from the brand host's other events and the venue, and clashes
 * (same in-world day, a double-booked guest, money). Pure.
 */
const { dayOf, mostUsed, smartDefaults, clashes, peopleAt } = require('../../../src/utils/eventFlowChecks');

const ev = (over = {}) => ({ id: 'e0', name: 'Velour Night', host_brand: 'Maison Velour', prestige: 5, dress_code: null, deal_type: null, canon_consequences: {}, ...over });

describe('dayOf', () => {
  test('the column, else the automation copy; a date with a time is its day', () => {
    expect(dayOf({ event_date: '2026-11-01' })).toBe('2026-11-01');
    expect(dayOf({ event_date: '2026-11-01T19:00:00Z' })).toBe('2026-11-01');
    expect(dayOf({ event_date: null, canon_consequences: { automation: { event_date: '2026-11-02' } } })).toBe('2026-11-02');
    expect(dayOf({ event_date: null, canon_consequences: '{"automation":{"event_date":"2026-11-03"}}' })).toBe('2026-11-03');
    expect(dayOf({ event_date: 'soon' })).toBeNull();
    expect(dayOf({})).toBeNull();
  });
});

describe('mostUsed', () => {
  test('groups text without case, keeps the first spelling, ties go to the first (newest)', () => {
    expect(mostUsed(['Black tie', 'black tie', 'Cocktail', null, ''])).toEqual({ value: 'Black tie', count: 2, of: 3 });
    expect(mostUsed(['Cocktail', 'Black tie'])).toEqual({ value: 'Cocktail', count: 1, of: 2 });
    expect(mostUsed([null, ''])).toBeNull();
  });
});

describe('smartDefaults', () => {
  const others = [
    ev({ id: 'e1', dress_code: 'Black tie', prestige: 8, deal_type: 'brand_partnership' }),
    ev({ id: 'e2', host_brand: 'maison velour', dress_code: 'black tie', prestige: 8, deal_type: 'paid_appearance' }),
    ev({ id: 'e3', dress_code: 'Cocktail', prestige: 6, deal_type: 'brand_partnership' }),
    ev({ id: 'e4', host_brand: 'Other Brand', dress_code: 'Casual', prestige: 2, deal_type: 'gifted' }),
  ];

  test("the brand's usual dress code, prestige and deal type, with how often", () => {
    expect(smartDefaults({ event: ev(), others })).toEqual([
      { field: 'dress_code', value: 'Black tie', source: 'brand', basis: "Maison Velour's usual, 2 of its 3 other events" },
      { field: 'prestige', value: 8, source: 'brand', basis: "Maison Velour's usual, 2 of its 3 other events" },
      { field: 'deal_type', value: 'brand_partnership', source: 'brand', basis: "Maison Velour's usual, 2 of its 3 other events" },
    ]);
  });

  test('a value the event already has is left out; no brand, no brand defaults', () => {
    const got = smartDefaults({ event: ev({ dress_code: 'BLACK TIE', prestige: 8 }), others });
    expect(got.map((s) => s.field)).toEqual(['deal_type']);
    expect(smartDefaults({ event: ev({ host_brand: null }), others })).toEqual([]);
    expect(smartDefaults({ event: ev({ host_brand: 'New Brand' }), others })).toEqual([]);
  });

  test("the venue's own dress code when the brand gives none; else the one most used there", () => {
    const venue = { id: 'loc-1', name: 'Club Noir', dress_code: 'All black' };
    expect(smartDefaults({ event: ev({ host_brand: null }), others, venue })).toEqual([
      { field: 'dress_code', value: 'All black', source: 'venue', basis: "Club Noir's own dress code" },
    ]);
    const there = [ev({ id: 'v1', host_brand: null, venue_location_id: 'loc-1', dress_code: 'Smart casual' }), ev({ id: 'v2', host_brand: null, canon_consequences: { automation: { venue_location_id: 'loc-1' } }, dress_code: 'smart casual' })];
    expect(smartDefaults({ event: ev({ host_brand: null }), others: there, venue: { id: 'loc-1', name: 'Club Noir', dress_code: null } })).toEqual([
      { field: 'dress_code', value: 'Smart casual', source: 'venue', basis: 'Used at Club Noir by 2 of 2 events' },
    ]);
    // The brand's dress code wins over the venue's.
    expect(smartDefaults({ event: ev(), others, venue }).filter((s) => s.field === 'dress_code')).toHaveLength(1);
    expect(smartDefaults({ event: ev(), others, venue })[0].source).toBe('brand');
  });

  test('the event itself never counts as its own past', () => {
    expect(smartDefaults({ event: ev({ id: 'e1' }), others: [others[0]] })).toEqual([]);
  });
});

describe('clashes', () => {
  const guests = (list) => ({ automation: { guest_profiles: list } });
  const me = ev({ event_date: '2026-11-01', source_profile_id: 7, canon_consequences: guests([{ id: 11, display_name: 'Nia' }, { profile_id: 12, handle: 'kofi' }]) });

  test('another event on the same day, and a guest double-booked across it', () => {
    const others = [
      ev({ id: 'x1', name: 'Gallery Late', event_date: '2026-11-01', canon_consequences: guests([{ id: 11, display_name: 'Nia' }]) }),
      ev({ id: 'x2', name: 'Next Week', event_date: '2026-11-08', canon_consequences: guests([{ id: 12 }]) }),
    ];
    const got = clashes({ event: me, others });
    expect(got.day).toBe('2026-11-01');
    expect(got.sameDay).toEqual([{ id: 'x1', name: 'Gallery Late' }]);
    expect(got.doubleBooked).toEqual([{ id: 11, name: 'Nia', events: [{ id: 'x1', name: 'Gallery Late' }] }]);
    expect(got.lines).toEqual([
      { kind: 'day', field: 'date', text: 'Gallery Late is on the same day.' },
      { kind: 'guest', field: 'guests', text: 'Nia is also at Gallery Late that day.' },
    ]);
  });

  test("the host counts as at their event; several same-day events are named", () => {
    const others = [
      ev({ id: 'x1', name: 'A', event_date: '2026-11-01', source_profile_id: 12 }),
      ev({ id: 'x3', name: 'B', event_date: '2026-11-01', canon_consequences: guests([7]) }),
    ];
    const got = clashes({ event: me, others });
    expect(got.lines[0].text).toBe('2 other events are on the same day (A, B).');
    expect(got.doubleBooked.map((p) => [p.id, p.events.map((e) => e.name)])).toEqual([[12, ['A']], [7, ['B']]]);
  });

  test('costs more than Lala has: one money line; affordable or unread: none', () => {
    const got = clashes({ event: me, others: [], affordability: { affordable: false, totalCost: 520.4, balance: 300 } });
    expect(got.money).toEqual({ totalCost: 520, balance: 300, short: 220 });
    expect(got.lines).toEqual([{ kind: 'money', field: 'money', text: 'Costs about 520 coins; Lala has 300, 220 short right now.' }]);
    expect(clashes({ event: me, others: [], affordability: { affordable: true, totalCost: 100, balance: 300 } }).lines).toEqual([]);
    expect(clashes({ event: me, others: [], affordability: null }).money).toBeNull();
  });

  test('no date: no day clashes', () => {
    const got = clashes({ event: ev(), others: [ev({ id: 'x', event_date: null })] });
    expect(got).toMatchObject({ day: null, sameDay: [], doubleBooked: [], lines: [] });
  });

  test('peopleAt: guests by any id key, then the creator host, once each', () => {
    expect(peopleAt(me).map((p) => p.id)).toEqual([11, 12, 7]);
    expect(peopleAt(me)[1].name).toBe('kofi');
  });
});

// Schedule and continuity (PR 1, Evoni 2026-11-13): warnings only.
describe('scheduleOf: when an event runs, read strictly', () => {
  const { scheduleOf, SUGGESTED_MINUTES } = require('../../../src/utils/eventFlowChecks');
  const at = (date, time, automation = {}) => ({ id: 'e', event_date: date, event_time: time, canon_consequences: { automation } });

  test('a date and a start with no end: three hours suggested, marked as a suggestion', () => {
    const s = scheduleOf(at('2026-03-14', '19:00'));
    expect(s).toMatchObject({ day: '2026-03-14', start_time: '19:00', end_time: '22:00', end_day: '2026-03-14', end_suggested: true, ends_another_day: false, verifiable: true, problems: [] });
    expect(s.end - s.start).toBe(SUGGESTED_MINUTES);
  });

  test('a suggested end can pass midnight, and says which day it ends', () => {
    expect(scheduleOf(at('2026-03-14', '22:30'))).toMatchObject({ end_time: '01:30', end_day: '2026-03-15', ends_another_day: true, end_suggested: true });
  });

  test('an end time at or before the start, with no end date, is the next day', () => {
    const s = scheduleOf(at('2026-03-14', '21:00', { event_end_time: '01:00' }));
    expect(s).toMatchObject({ end_time: '01:00', end_day: '2026-03-15', ends_another_day: true, end_suggested: false, verifiable: true });
    expect(s.end - s.start).toBe(240);
  });

  test('an end date makes a multi-day event of any length', () => {
    const s = scheduleOf(at('2026-03-14', '10:00', { event_end_time: '16:00', event_end_date: '2026-03-17' }));
    expect(s).toMatchObject({ end_day: '2026-03-17', end_time: '16:00', ends_another_day: true, verifiable: true });
    expect(s.end - s.start).toBe(3 * 24 * 60 + 360);
  });

  test('an end that is before the start, ends at the start, or an end date with no time: said, not guessed', () => {
    expect(scheduleOf(at('2026-03-14', '10:00', { event_end_time: '09:00', event_end_date: '2026-03-14' })).problems.map((p) => p.code)).toEqual(['end_before_start']);
    expect(scheduleOf(at('2026-03-14', '10:00', { event_end_time: '10:00' })).problems.map((p) => p.code)).toEqual(['end_equals_start']);
    expect(scheduleOf(at('2026-03-14', '10:00', { event_end_date: '2026-03-16' })).problems.map((p) => p.code)).toEqual(['end_time_missing']);
    for (const bad of [{ event_end_time: '09:00', event_end_date: '2026-03-14' }, { event_end_time: '10:00' }, { event_end_date: '2026-03-16' }]) {
      expect(scheduleOf(at('2026-03-14', '10:00', bad)).verifiable).toBe(false);
    }
  });

  test('a date or time that is not one is an explicit failure, never read as clear', () => {
    const typed = scheduleOf(at('Friday, March 15', '9:00 PM - 2:00 AM'));
    expect(typed.problems.map((p) => p.code)).toEqual(['date_unreadable', 'time_unreadable']);
    expect(typed).toMatchObject({ day: null, start: null, end: null, verifiable: false });
    expect(scheduleOf(at('2026-02-30', '19:00')).problems.map((p) => p.code)).toEqual(['date_unreadable']);
    expect(scheduleOf(at('2026-03-14', '24:00')).problems.map((p) => p.code)).toEqual(['time_unreadable']);
    expect(scheduleOf(at('2026-03-14', '19:00', { event_end_time: 'late' })).problems.map((p) => p.code)).toEqual(['end_unreadable']);
    expect(scheduleOf(at('2026-03-14', '19:00', { event_end_time: '23:00', event_end_date: 'Sunday' })).problems.map((p) => p.code)).toEqual(['end_date_unreadable']);
    expect(scheduleOf(at(null, null)).problems.map((p) => p.code)).toEqual(['date_missing', 'time_missing']);
  });

  test('the automation copy stands in for an empty column', () => {
    expect(scheduleOf({ id: 'e', event_date: null, event_time: '', canon_consequences: JSON.stringify({ automation: { event_date: '2026-03-14', event_time: '18:30' } }) }))
      .toMatchObject({ day: '2026-03-14', start_time: '18:30', verifiable: true });
  });

  test('an offset moves the comparison, not what is shown; a bad one is a failure', () => {
    const home = scheduleOf(at('2026-03-14', '19:00'));
    const away = scheduleOf(at('2026-03-14', '19:00', { utc_offset_minutes: 360 }));
    expect(away).toMatchObject({ start_time: '19:00', offset_minutes: 360, offset_set: true });
    expect(home.start - away.start).toBe(360);
    expect(home.offset_set).toBe(false);
    for (const bad of ['east', 1000, 12.5]) {
      expect(scheduleOf(at('2026-03-14', '19:00', { utc_offset_minutes: bad }))).toMatchObject({ verifiable: false, problems: [expect.objectContaining({ code: 'offset_unreadable' })] });
    }
  });

  test('provisional only while the date is still the suggested one', () => {
    expect(scheduleOf(at('2026-03-14', '19:00', { event_date_auto: '2026-03-14' })).provisional).toBe(true);
    expect(scheduleOf(at('2026-03-20', '19:00', { event_date_auto: '2026-03-14' })).provisional).toBe(false);
    expect(scheduleOf(at('2026-03-14', '19:00')).provisional).toBe(false);
  });
});

describe('scheduleCheck: who is in two places', () => {
  const { scheduleCheck, travelMinutesOf, TRAVEL_MINUTES } = require('../../../src/utils/eventFlowChecks');
  const guests = (...ids) => ids.map((id) => ({ profile_id: id, display_name: `P${id}` }));
  const event = (id, date, time, { end, endDate, host, guestIds = [], status = 'draft', auto = {} } = {}) => ({
    id, name: `Event ${id}`, status, event_date: date, event_time: time, source_profile_id: host ?? null,
    canon_consequences: { automation: { guest_profiles: guests(...guestIds), ...(end ? { event_end_time: end } : {}), ...(endDate ? { event_end_date: endDate } : {}), ...auto } },
  });
  const DAY = '2026-03-14';
  const kinds = (r) => r.conflicts.map((c) => [c.person.key, c.kind, c.severity]);

  test('two events on one day with nobody in common: no conflict', () => {
    const r = scheduleCheck({ event: event('a', DAY, '19:00', { guestIds: [1] }), others: [event('b', DAY, '19:00', { guestIds: [2] })] });
    expect(r.conflicts).toEqual([]);
    expect(r.lines.filter((l) => l.field === 'guests')).toEqual([]);
  });

  test('the same guest at two events on one day whose times do not cross, far enough apart: no conflict', () => {
    const r = scheduleCheck({ event: event('a', DAY, '11:00', { end: '13:00', guestIds: [1] }), others: [event('b', DAY, '21:00', { end: '23:00', guestIds: [1] })] });
    expect(r.conflicts).toEqual([]);
  });

  test('the same guest where the times cross: an overlap, in minutes; it is a guest conflict, for review', () => {
    const r = scheduleCheck({ event: event('a', DAY, '19:00', { end: '22:00', guestIds: [1] }), others: [event('b', DAY, '21:00', { end: '23:30', guestIds: [1] })] });
    expect(kinds(r)).toEqual([['profile:1', 'overlap', 'guest']]);
    expect(r.conflicts[0]).toMatchObject({ minutes: 60, provisional: false, other: { id: 'b', start_time: '21:00', end_time: '23:30' } });
    expect(r.conflicts[0].text).toBe('P1 is at Event b (21:00–23:30) at the same time: 1 h overlap.');
  });

  test('one minute of overlap is an overlap; ending as the next starts, in the same venue, is not', () => {
    const places = { a: { venue_id: 'v1', city: 'Echo Park', dream: true }, b: { venue_id: 'v1', city: 'Echo Park', dream: true } };
    const a = event('a', DAY, '19:00', { end: '21:00', guestIds: [1] });
    expect(scheduleCheck({ event: a, others: [event('b', DAY, '20:59', { end: '23:00', guestIds: [1] })], places }).conflicts[0]).toMatchObject({ kind: 'overlap', minutes: 1 });
    expect(scheduleCheck({ event: a, others: [event('b', DAY, '21:00', { end: '23:00', guestIds: [1] })], places }).conflicts).toEqual([]);
  });

  test('an overnight event reaches the next day: the date alone would have missed it', () => {
    const r = scheduleCheck({ event: event('a', DAY, '22:00', { end: '02:00', guestIds: [1] }), others: [event('b', '2026-03-15', '01:00', { end: '03:00', guestIds: [1] })] });
    expect(kinds(r)).toEqual([['profile:1', 'overlap', 'guest']]);
    expect(r.conflicts[0].minutes).toBe(60);
  });

  test('a multi-day event holds its people for every day of it', () => {
    const retreat = event('a', DAY, '10:00', { end: '16:00', endDate: '2026-03-17', guestIds: [1] });
    expect(scheduleCheck({ event: retreat, others: [event('b', '2026-03-16', '19:00', { end: '21:00', guestIds: [1] })] }).conflicts[0]).toMatchObject({ kind: 'overlap', minutes: 120 });
    expect(scheduleCheck({ event: retreat, others: [event('b', '2026-03-18', '19:00', { end: '21:00', guestIds: [1] })] }).conflicts).toEqual([]);
  });

  test('hosting both at once is a host conflict; hosting one and a guest at the other is a guest conflict', () => {
    const a = event('a', DAY, '19:00', { end: '22:00', host: 7 });
    expect(kinds(scheduleCheck({ event: a, others: [event('b', DAY, '20:00', { end: '23:00', host: 7 })] }))).toEqual([['profile:7', 'overlap', 'host']]);
    const mixed = scheduleCheck({ event: a, others: [event('b', DAY, '20:00', { end: '23:00', guestIds: [7] })] });
    expect(kinds(mixed)).toEqual([['profile:7', 'overlap', 'guest']]);
    expect(mixed.lines.find((l) => l.field === 'guests').kind).toBe('guest');
  });

  describe('travel between venues (0, 20 and 45 minutes by default)', () => {
    const echo = (venue) => ({ venue_id: venue, city: 'Echo Park', dream: true });
    const a = event('a', DAY, '18:00', { end: '20:00', guestIds: [1] });
    const next = (time) => [event('b', DAY, time, { end: '23:30', guestIds: [1] })];

    test('same city: a gap one minute short of 20 is flagged, exactly 20 is not', () => {
      const places = { a: echo('v1'), b: echo('v2') };
      const short = scheduleCheck({ event: a, others: next('20:19'), places });
      expect(short.conflicts[0]).toMatchObject({ kind: 'travel', minutes: 1, travel: { basis: 'same_city', minutes: 20, gap: 19 } });
      expect(short.conflicts[0].text).toBe('P1 is at Event b (20:19–23:30) with 19 min between them; getting there is taken as 20 min.');
      expect(scheduleCheck({ event: a, others: next('20:20'), places }).conflicts).toEqual([]);
    });

    test('different DREAM cities: 45 minutes', () => {
      const places = { a: echo('v1'), b: { venue_id: 'v2', city: 'radiance  row', dream: true } };
      expect(scheduleCheck({ event: a, others: next('20:44'), places }).conflicts[0]).toMatchObject({ kind: 'travel', travel: { basis: 'between_dream_cities', minutes: 45 } });
      expect(scheduleCheck({ event: a, others: next('20:45'), places }).conflicts).toEqual([]);
    });

    test('the direction does not matter: the earlier event can be either one', () => {
      const places = { a: echo('v1'), b: echo('v2') };
      const later = event('a', DAY, '20:10', { end: '23:00', guestIds: [1] });
      expect(scheduleCheck({ event: later, others: [event('b', DAY, '18:00', { end: '20:00', guestIds: [1] })], places }).conflicts[0]).toMatchObject({ kind: 'travel', travel: { gap: 10 } });
    });

    test('a venue whose city is not known: a short gap cannot be verified; a long one is left alone', () => {
      const places = { a: echo('v1'), b: { venue_id: null, city: null, dream: false } };
      expect(scheduleCheck({ event: a, others: next('20:30'), places }).conflicts[0]).toMatchObject({ kind: 'travel_unknown', travel: { basis: 'unknown' } });
      expect(scheduleCheck({ event: a, others: next('21:00'), places }).conflicts).toEqual([]);
    });

    test('a city outside the DREAM cities has no assumed journey: flagged within a day, not beyond', () => {
      const places = { a: echo('v1'), b: { venue_id: 'v9', city: 'Paris', dream: false } };
      expect(scheduleCheck({ event: a, others: next('23:00'), places }).conflicts[0]).toMatchObject({ kind: 'travel_unknown', travel: { basis: 'outside' } });
      expect(scheduleCheck({ event: a, others: [event('b', '2026-03-16', '09:00', { end: '10:00', guestIds: [1] })], places }).conflicts).toEqual([]);
    });

    test("the show's own minutes replace the defaults; anything else in their place is ignored", () => {
      expect(travelMinutesOf(null)).toEqual(TRAVEL_MINUTES);
      expect(travelMinutesOf({ continuity: { travel_minutes: { same_city: 5, between_dream_cities: -1, same_venue: 'none' } } })).toEqual({ same_venue: 0, same_city: 5, between_dream_cities: 45 });
      const places = { a: echo('v1'), b: echo('v2') };
      expect(scheduleCheck({ event: a, others: next('20:10'), places, travelMinutes: travelMinutesOf({ continuity: { travel_minutes: { same_city: 5 } } }) }).conflicts).toEqual([]);
    });
  });

  describe('Lala, by how she is linked', () => {
    const a = event('a', DAY, '19:00', { end: '22:00' });
    const b = event('b', DAY, '20:00', { end: '23:00' });

    test('linked to both: a conflict that names her level at the other event', () => {
      const r = scheduleCheck({ event: a, others: [b], lala: { a: { level: 'committed' }, b: { level: 'invited' } } });
      expect(kinds(r)).toEqual([['lala', 'overlap', 'lala']]);
      expect(r.conflicts[0].person).toMatchObject({ level: 'committed', other_level: 'invited' });
      expect(r.conflicts[0].text).toBe('Lala is invited to Event b (20:00–23:00) at the same time: 2 h overlap.');
    });

    test('not linked to one of them: she is not checked', () => {
      expect(scheduleCheck({ event: a, others: [b], lala: { a: { level: 'committed' } } }).conflicts).toEqual([]);
      expect(scheduleCheck({ event: a, others: [b], lala: {} }).conflicts).toEqual([]);
    });

    test('she is one person even when her profile is also on a guest list', () => {
      const withProfile = event('b', DAY, '20:00', { end: '23:00', guestIds: [99] });
      const r = scheduleCheck({ event: event('a', DAY, '19:00', { end: '22:00', guestIds: [99] }), others: [withProfile], lala: { a: { level: 'committed' }, b: { level: 'planned' } }, lalaProfileId: 99 });
      expect(kinds(r)).toEqual([['lala', 'overlap', 'lala']]);
    });
  });

  test('a declined or archived event holds nobody', () => {
    const a = event('a', DAY, '19:00', { end: '22:00', guestIds: [1] });
    for (const status of ['declined', 'archived']) {
      expect(scheduleCheck({ event: a, others: [event('b', DAY, '19:00', { end: '22:00', guestIds: [1], status })] }).conflicts).toEqual([]);
    }
    for (const status of ['draft', 'ready', 'used', 'filmed']) {
      expect(scheduleCheck({ event: a, others: [event('b', DAY, '19:00', { end: '22:00', guestIds: [1], status })] }).conflicts).toHaveLength(1);
    }
  });

  test('a time that cannot be read is "cannot verify" for people on the same or the next day, never "clear"', () => {
    const a = event('a', DAY, '19:00', { end: '22:00', guestIds: [1] });
    const r = scheduleCheck({ event: a, others: [event('b', DAY, '9 PM', { guestIds: [1] })] });
    expect(kinds(r)).toEqual([['profile:1', 'unverified', 'guest']]);
    expect(r.lines.find((l) => l.field === 'guests')).toMatchObject({ kind: 'verify' });
    expect(scheduleCheck({ event: a, others: [event('b', '2026-03-20', '9 PM', { guestIds: [1] })] }).conflicts).toEqual([]);
  });

  test("this event's own unreadable time is said first, and its shared people cannot be cleared", () => {
    const r = scheduleCheck({ event: event('a', DAY, 'evening', { guestIds: [1] }), others: [event('b', DAY, '19:00', { end: '22:00', guestIds: [1] })] });
    expect(r.schedule.verifiable).toBe(false);
    expect(r.lines[0]).toMatchObject({ kind: 'verify', field: 'date' });
    expect(kinds(r)).toEqual([['profile:1', 'unverified', 'guest']]);
  });

  test('another event with no readable date at all is counted as not checked', () => {
    const r = scheduleCheck({ event: event('a', DAY, '19:00', { end: '22:00', guestIds: [1] }), others: [event('b', 'Friday, March 15', '19:00', { guestIds: [1] }), event('c', null, null, { guestIds: [2] })] });
    expect(r.conflicts).toEqual([]);
    expect(r.unchecked).toBe(1);
    expect(r.lines.find((l) => l.field === 'guests').text).toBe('1 other event shares someone with this one but has no readable date, so it was not checked.');
  });

  test('a suggested date makes its conflicts provisional: counted in one line, not listed', () => {
    const auto = { event_date_auto: DAY };
    const a = event('a', DAY, '19:00', { end: '22:00', guestIds: [1, 2], auto });
    const r = scheduleCheck({ event: a, others: [event('b', DAY, '19:00', { end: '22:00', guestIds: [1], auto }), event('c', DAY, '20:00', { end: '21:00', guestIds: [2] })] });
    expect(r.conflicts.map((c) => c.provisional)).toEqual([true, true]);
    expect(r.lines.filter((l) => l.field === 'guests')).toEqual([{ kind: 'provisional', field: 'guests', text: '2 possible overlaps depend on a suggested date.' }]);
    expect(r.lines.find((l) => l.field === 'date' && l.kind === 'provisional')).toBeTruthy();
  });

  test('firm conflicts come before provisional ones, and hosts before Lala before guests', () => {
    const a = event('a', DAY, '19:00', { end: '22:00', host: 7, guestIds: [1] });
    const r = scheduleCheck({
      event: a,
      others: [event('b', DAY, '19:30', { end: '21:00', guestIds: [1] }), event('c', DAY, '20:00', { end: '21:00', host: 7 }), event('d', DAY, '20:00', { end: '21:00', guestIds: [1], auto: { event_date_auto: DAY } })],
      lala: { a: { level: 'committed' }, b: { level: 'planned' } },
    });
    expect(r.conflicts.map((c) => [c.other.id, c.severity, c.provisional])).toEqual([['c', 'host', false], ['b', 'lala', false], ['b', 'guest', false], ['d', 'guest', true]]);
  });

  test('with no end time the three-hour suggestion is what is checked, and the line says so', () => {
    const r = scheduleCheck({ event: event('a', DAY, '19:00', { guestIds: [1] }), others: [event('b', DAY, '21:30', { end: '23:00', guestIds: [1] })] });
    expect(r.schedule.end_suggested).toBe(true);
    expect(r.conflicts[0]).toMatchObject({ kind: 'overlap', minutes: 30 });
    expect(r.lines.find((l) => l.kind === 'end').text).toBe('No end time yet: checked as ending at 22:00 (three hours).');
  });

  test('the older same-day check is as it was', () => {
    const { clashes } = require('../../../src/utils/eventFlowChecks');
    const a = event('a', DAY, '11:00', { end: '13:00', guestIds: [1] });
    const c = clashes({ event: a, others: [event('b', DAY, '21:00', { end: '23:00', guestIds: [1] })] });
    expect(c.sameDay).toEqual([{ id: 'b', name: 'Event b' }]);
    expect(c.doubleBooked.map((p) => p.id)).toEqual([1]);
  });
});
