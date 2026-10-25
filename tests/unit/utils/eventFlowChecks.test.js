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
