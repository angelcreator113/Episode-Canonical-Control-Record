/**
 * The rate card editor's pure parts (services/rateCard; Evoni, 2026-10-19):
 * the band a tier prices at, the price lookup, the editor's table, what a
 * save would change, and the record a priced deal keeps.
 */
const {
  bandOf, priceFor, cardTable, planChanges, pricedFrom,
} = require('../../../src/services/rateCard');
const { formatAnchorPrice } = require('../../../src/utils/deliverableFormats');
const { careerTierFromReputation } = require('../../../src/utils/careerTiers');

const CARD = {
  version: 2,
  anchors: {
    paid_appearance: { 1: 150, 2: 250, 3: 450, 4: 650, 5: 900 },
    brand_partnership_base: { 1: null, 2: 500, 3: 900, 4: 1300, 5: 1800 },
    pulse_video: { 1: 75, 2: 125, 3: 225, 4: 325, 5: 450 },
    pulse_stories_3: { 1: 35, 2: 60, 3: 110, 4: 160, 5: 225 },
  },
  premiums: { rush: { '48h': 10, '24h': 20 }, paid_ad: { whitelisting: null } },
};

describe('bandOf: the band a deal is priced at', () => {
  it('names the five career tiers', () => {
    expect(bandOf(1)).toEqual({ tier: 1, key: 'emerging', label: 'Emerging' });
    expect(bandOf(3)).toEqual({ tier: 3, key: 'established', label: 'Established' });
    expect(bandOf('5')).toEqual({ tier: 5, key: 'elite', label: 'Elite' });
  });

  it('an unknown tier is Emerging, as the pricing reads it', () => {
    expect(bandOf(0).tier).toBe(1);
    expect(bandOf(9).tier).toBe(1);
    expect(bandOf(null).tier).toBe(1);
  });

  it("Lala's reputation picks her band: 0-2 Emerging … 9-10 Elite", () => {
    expect(bandOf(careerTierFromReputation(2)).label).toBe('Emerging');
    expect(bandOf(careerTierFromReputation(5)).label).toBe('Established');
    expect(bandOf(careerTierFromReputation(8)).label).toBe('Influential');
    expect(bandOf(careerTierFromReputation(10)).label).toBe('Elite');
  });
});

describe('priceFor: the price lookup', () => {
  it('reads the amount at the tier', () => {
    expect(priceFor(CARD, 'pulse_video', 3)).toBe(225);
    expect(priceFor(CARD, 'paid_appearance', 5)).toBe(900);
  });

  it('null where the card offers nothing, has no such row, or there is no card', () => {
    expect(priceFor(CARD, 'brand_partnership_base', 1)).toBeNull();
    expect(priceFor(CARD, 'go_live', 3)).toBeNull();
    expect(priceFor(null, 'pulse_video', 3)).toBeNull();
  });

  it('an edited card prices a deliverable from the edited cell', () => {
    const edited = { ...CARD, anchors: { ...CARD.anchors, pulse_video: { ...CARD.anchors.pulse_video, 3: 300 } } };
    expect(formatAnchorPrice({ deliverable_type: 'pulse_video', quantity: 2 }, 3, edited)).toBe(600);
    expect(formatAnchorPrice({ deliverable_type: 'pulse_video', quantity: 2 }, 3, CARD)).toBe(450);
  });
});

describe('cardTable', () => {
  it('lists the components in the card order with labels and units, and the five bands', () => {
    const t = cardTable(CARD);
    expect(t.version).toBe(2);
    expect(t.tiers.map((b) => b.label)).toEqual(['Emerging', 'Rising', 'Established', 'Influential', 'Elite']);
    expect(t.anchors.map((a) => a.component)).toEqual(['paid_appearance', 'brand_partnership_base', 'pulse_video', 'pulse_stories_3']);
    expect(t.anchors[2]).toMatchObject({ label: 'Pulse video', unit: 'per piece', amounts: { 1: 75, 3: 225, 5: 450 } });
    expect(t.anchors[3].unit).toBe('per 3 stories');
    expect(t.anchors[1].amounts[1]).toBeNull();
    expect(t.premiums.find((p) => p.kind === 'paid_ad').keys).toEqual([{ key: 'whitelisting', percent: null }]);
  });

  it('null without a card', () => {
    expect(cardTable(null)).toBeNull();
  });
});

describe('planChanges: what a save would change', () => {
  it('keeps only the cells that change, with from and to', () => {
    const plan = planChanges(CARD, {
      anchors: [
        { component: 'pulse_video', career_tier: 3, amount: 250 },
        { component: 'pulse_video', career_tier: 4, amount: 325 }, // unchanged
        { component: 'brand_partnership_base', career_tier: 1, amount: 300 }, // offered now
        { component: 'paid_appearance', career_tier: 5, amount: '' }, // no longer offered
      ],
      premiums: [{ kind: 'paid_ad', key: 'whitelisting', percent: 30 }, { kind: 'rush', key: '48h', percent: 10 }],
    });
    expect(plan.ok).toBe(true);
    expect(plan.anchors).toEqual([
      { component: 'pulse_video', career_tier: 3, from: 225, to: 250 },
      { component: 'brand_partnership_base', career_tier: 1, from: null, to: 300 },
      { component: 'paid_appearance', career_tier: 5, from: 900, to: null },
    ]);
    expect(plan.premiums).toEqual([{ kind: 'paid_ad', key: 'whitelisting', from: null, to: 30 }]);
  });

  it('refuses a component or premium not on the card, a bad tier, a bad number, and a cell changed twice', () => {
    const plan = planChanges(CARD, {
      anchors: [
        { component: 'go_live', career_tier: 3, amount: 10 },
        { component: 'pulse_video', career_tier: 6, amount: 10 },
        { component: 'pulse_video', career_tier: 2, amount: -5 },
        { component: 'pulse_video', career_tier: 1, amount: 12.5 },
        { component: 'pulse_video', career_tier: 3, amount: 200 },
        { component: 'pulse_video', career_tier: 3, amount: 210 },
      ],
      premiums: [{ kind: 'rush', key: '12h', percent: 30 }, { kind: 'rush', key: '24h', percent: 9000 }],
    });
    expect(plan.ok).toBe(false);
    expect(plan.errors).toHaveLength(7);
    expect(plan.errors.join(' ')).toMatch(/go_live: not on the rate card/);
    expect(plan.errors.join(' ')).toMatch(/changed twice/);
  });

  it('no card, nothing to change', () => {
    expect(planChanges(null, {}).ok).toBe(false);
  });
});

describe('pricedFrom: what a deal keeps about its pricing', () => {
  const proposal = {
    ok: true, pricing_version: 3, career_tier: 3,
    components: {
      appearance: { field: 'appearance_fee', anchor_component: 'paid_appearance', anchor: 450, fee: 450, premiums: [] },
      performance: { field: 'performance_fee', anchor_component: 'performance_booking', anchor: null, fee: null, premiums: [] },
    },
    deliverables: [
      { id: 'd1', component: 'pulse_video', anchor: 250, fee: 300, premiums: [{ kind: 'rush', key: '24h', percent: 20 }] },
      { id: 'd2', component: null, anchor: null, fee: null, premiums: [] },
    ],
  };

  it('records the rate row, its amount then, the fee, the premiums and the band', () => {
    const rec = pricedFrom(proposal, { at: '2026-10-19T12:00:00Z' });
    expect(rec).toEqual({
      version: 3, career_tier: 3, band: 'Established', at: '2026-10-19T12:00:00.000Z',
      components: { appearance_fee: { rate: { version: 3, component: 'paid_appearance', career_tier: 3 }, anchor: 450, fee: 450, premiums: [] } },
      deliverables: { d1: { rate: { version: 3, component: 'pulse_video', career_tier: 3 }, anchor: 250, fee: 300, premiums: ['rush:24h'] } },
    });
  });

  it('null for a proposal that failed', () => {
    expect(pricedFrom({ ok: false })).toBeNull();
    expect(pricedFrom(null)).toBeNull();
  });
});
