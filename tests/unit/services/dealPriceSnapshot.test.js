/**
 * An agreed deal's frozen prices (services/dealPriceSnapshot; Evoni,
 * 2026-10-19): the lines a snapshot holds, and when a second lock keeps it.
 */
const { snapshotLines, sameLines } = require('../../../src/services/dealPriceSnapshot');

const ANCHORS = {
  paid_appearance: { 3: { id: 'a-app-3', amount: 450 } },
  pulse_stories_3: { 3: { id: 'a-st-3', amount: 110 } },
  pulse_video: { 3: { id: 'a-vid-3', amount: 225 } },
};
const EVENT = { deal_type: 'appearance_plus_deliverables', appearance_fee: 450, pricing_version: 2 };
const DELIVERABLES = [
  { id: 'd1', deliverable_type: 'pulse_video', quantity: 1, fee: 270, description: 'One video' },
  { id: 'd2', deliverable_type: 'pulse_stories', quantity: 3, fee: 110 },
  { id: 'd3', deliverable_type: 'other', quantity: 1, fee: 80, description: 'A shout-out' },
  { id: 'd4', deliverable_type: 'pulse_post', quantity: 1, fee: null },
];

describe('snapshotLines', () => {
  const pricedFrom = { version: 2, career_tier: 3, deliverables: { d1: { premiums: ['rush:24h'] } } };
  const lines = snapshotLines({ event: EVENT, deliverables: DELIVERABLES, anchors: ANCHORS, pricedFrom });

  it('one line per agreed number: the component and each priced deliverable', () => {
    expect(lines.map((l) => l.line_key)).toEqual(['appearance_fee', 'd1', 'd2', 'd3']);
  });

  it('records type, band, unit price, quantity, total and the rate row', () => {
    expect(lines[0]).toEqual({
      line_kind: 'component', line_key: 'appearance_fee', deliverable_type: null, label: 'Appearance fee', unit: 'flat',
      career_tier: 3, band: 'Established', unit_price: 450, quantity: 1, total: 450,
      rate_anchor_id: 'a-app-3', rate_version: 2, premiums: [],
    });
    expect(lines[1]).toMatchObject({
      deliverable_type: 'pulse_video', unit: 'per piece', unit_price: 225, quantity: 1, total: 270,
      rate_anchor_id: 'a-vid-3', premiums: ['rush:24h'],
    });
    expect(lines[2]).toMatchObject({ deliverable_type: 'pulse_stories', unit: 'per 3 stories', unit_price: 110, quantity: 3, total: 110, rate_anchor_id: 'a-st-3' });
  });

  it('a hand-priced line keeps its total with no rate row', () => {
    expect(lines[3]).toMatchObject({ deliverable_type: 'other', unit: 'flat', unit_price: null, total: 80, rate_anchor_id: null, rate_version: null });
  });

  it('without priced_from, the band and version given are used', () => {
    const plain = snapshotLines({ event: EVENT, deliverables: [], anchors: ANCHORS, tier: 3, version: 2 });
    expect(plain).toHaveLength(1);
    expect(plain[0]).toMatchObject({ band: 'Established', rate_version: 2, rate_anchor_id: 'a-app-3' });
  });

  it('a deal that pays nothing has no lines', () => {
    expect(snapshotLines({ event: { deal_type: 'invited_comped' }, deliverables: DELIVERABLES, anchors: ANCHORS })).toEqual([]);
    expect(snapshotLines({ event: {}, deliverables: DELIVERABLES })).toEqual([]);
  });
});

describe('sameLines', () => {
  const a = [{ line_kind: 'component', line_key: 'appearance_fee', deliverable_type: null, quantity: 1, total: 450, unit_price: 450 }];

  it('a card change alone (unit price) is the same deal; a changed total or quantity is not', () => {
    expect(sameLines(a, [{ ...a[0], unit_price: 999 }])).toBe(true);
    expect(sameLines(a, [{ ...a[0], total: 500 }])).toBe(false);
    expect(sameLines(a, [{ ...a[0], quantity: 2 }])).toBe(false);
    expect(sameLines(a, [])).toBe(false);
  });
});
