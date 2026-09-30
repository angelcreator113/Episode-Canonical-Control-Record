/**
 * Deal pricing (deal build PR 3, Task #2341; DEAL_DESIGN.md §11.1, §12).
 * Evoni's QUESTION 4 answer and her Deal PR 3 ruling (2026-09-30),
 * EVENT_EPISODE_FLOW.md §8(cc); each test names the point it holds. Pure: a
 * rate card built from the version 1 seed values, no database.
 */
const {
  proposeTerms, rateCardFrom, missingPrices, dealComponents,
  DEAL_PLANS, DELIVERABLE_ANCHORS, EVENT_COMPONENTS,
} = require('../../../src/services/dealPricingService');
const { DELIVERABLE_TYPES, DELIVERABLE_TYPE_LABELS } = require('../../../src/services/eventTermsService');
const { ANCHORS, PREMIUMS } = require('../../../src/migrations/20260929200002-create-deal-rate-anchors');
const { DEAL_TYPES } = require('../../../src/models/WorldEvent');

const card = rateCardFrom(
  1,
  Object.entries(ANCHORS).flatMap(([component, amounts]) => amounts.map((amount, i) => ({ component, career_tier: i + 1, amount }))),
  PREMIUMS.map(([kind, key, percent]) => ({ kind, key, percent }))
);

const reel = { id: 'd-reel', description: 'One reel in the coat', deliverable_type: 'reel' };
const stories = { id: 'd-stories', description: 'Three stories', deliverable_type: 'story_set_3' };
const post = { id: 'd-post', description: 'A feed post', deliverable_type: 'post' };
const photos = { id: 'd-photos', description: 'Lookbook shots', deliverable_type: 'photo_set' };
const other = { id: 'd-other', description: 'Host a Q&A', deliverable_type: 'other' };
const legacy = { id: 'd-legacy', description: 'IG reel from the old form', deliverable_type: 'instagram_reel' };

const fees = (p) => Object.fromEntries(Object.entries(p.components).map(([k, c]) => [k, c.fee]));

describe('the plans (ruling 4)', () => {
  it('every deal type has a plan', () => {
    expect(Object.keys(DEAL_PLANS).sort()).toEqual([...DEAL_TYPES].sort());
  });

  it('the full mapping, as ruled', () => {
    const plan = (t, extra = {}) => ({ components: dealComponents({ deal_type: t, ...extra }), deliverables: DEAL_PLANS[t].deliverables, cash: DEAL_PLANS[t].cash });
    expect(plan('paid_appearance')).toEqual({ components: ['appearance'], deliverables: false, cash: true });
    expect(plan('paid_deliverables')).toEqual({ components: [], deliverables: true, cash: true });
    expect(plan('appearance_plus_deliverables')).toEqual({ components: ['appearance'], deliverables: true, cash: true });
    expect(plan('performance_booking')).toEqual({ components: ['performance'], deliverables: true, cash: true });
    expect(plan('brand_partnership')).toEqual({ components: ['partnership_base'], deliverables: true, cash: true });
    expect(plan('brand_partnership', { appearance_required: true })).toEqual({ components: ['partnership_base', 'appearance'], deliverables: true, cash: true });
    for (const t of ['self_funded', 'invited_comped', 'gifted']) expect(plan(t)).toEqual({ components: [], deliverables: false, cash: false });
  });

  it('each event component has its own column and anchor', () => {
    expect(EVENT_COMPONENTS).toEqual({
      appearance: { field: 'appearance_fee', anchor: 'paid_appearance', label: 'Appearance fee' },
      partnership_base: { field: 'partnership_base_fee', anchor: 'brand_partnership_base', label: 'Partnership base' },
      performance: { field: 'performance_fee', anchor: 'performance_booking', label: 'Performance fee' },
    });
  });
});

describe('proposeTerms', () => {
  it('paid appearance takes the Appearance anchor for the event\'s tier', () => {
    for (const [tier, fee] of [[1, 150], [3, 450], [5, 900]]) {
      const p = proposeTerms({ event: { deal_type: 'paid_appearance', career_tier: tier }, card });
      expect(p).toMatchObject({ ok: true, pricing_version: 1, career_tier: tier, cash: true });
      expect(p.components).toEqual({ appearance: { field: 'appearance_fee', anchor_component: 'paid_appearance', anchor: fee, fee, premiums: [], note: null } });
    }
  });

  it('ruling 1: the partnership base is its own component, not an appearance fee', () => {
    const p = proposeTerms({ event: { deal_type: 'brand_partnership', career_tier: 3 }, deliverables: [reel], card });
    expect(fees(p)).toEqual({ partnership_base: 900 });
    expect(p.components.partnership_base.field).toBe('partnership_base_fee');
    expect(p.deliverables[0].fee).toBe(225);
  });

  it('ruling 1: a partnership that requires an appearance adds the Appearance anchor separately', () => {
    const p = proposeTerms({ event: { deal_type: 'brand_partnership', career_tier: 3, appearance_required: true }, deliverables: [reel], card });
    expect(fees(p)).toEqual({ partnership_base: 900, appearance: 450 });
    expect(p.deliverables[0].fee).toBe(225);
  });

  it('ruling 4: performance booking takes the Performance anchor plus its deliverables', () => {
    const p = proposeTerms({ event: { deal_type: 'performance_booking', career_tier: 4 }, deliverables: [reel, stories], card });
    expect(fees(p)).toEqual({ performance: 600 });
    expect(p.deliverables.map((l) => l.fee)).toEqual([325, 160]);
  });

  it('ruling 2: Reel and Story Set (3) take their anchors; Post, Photo Set and Other are priced by hand', () => {
    const p = proposeTerms({ event: { deal_type: 'appearance_plus_deliverables', career_tier: 2 }, deliverables: [reel, stories, post, photos, other], card });
    expect(fees(p)).toEqual({ appearance: 250 });
    expect(p.deliverables.map((l) => [l.id, l.component, l.fee, l.price_required])).toEqual([
      ['d-reel', 'reel', 125, false], ['d-stories', 'stories_3', 60, false],
      ['d-post', null, null, true], ['d-photos', null, null, true], ['d-other', null, null, true],
    ]);
    expect(p.gaps).toEqual([
      '"A feed post": price required (Post is priced by hand).',
      '"Lookbook shots": price required (Photo Set is priced by hand).',
      '"Host a Q&A": price required (Other is never priced automatically).',
    ]);
  });

  it('ruling 2: no price depends on words in free text', () => {
    // A legacy row whose text says "reel" is not a Reel.
    const p = proposeTerms({ event: { deal_type: 'paid_deliverables', career_tier: 5 }, deliverables: [legacy, { ...reel, deliverable_type: 'Reel' }], card });
    expect(p.deliverables.map((l) => [l.component, l.fee])).toEqual([[null, null], [null, null]]);
    expect(p.gaps[0]).toBe('"IG reel from the old form": price required (no type is chosen).');
    expect(DELIVERABLE_ANCHORS).toEqual({ reel: 'reel', story_set_3: 'stories_3' });
  });

  it('ruling 3: premiums on one component add, not compound, and touch nothing else', () => {
    const p = proposeTerms({
      event: { deal_type: 'appearance_plus_deliverables', career_tier: 3 },
      deliverables: [reel, stories],
      premiums: { deliverables: { 'd-reel': [{ kind: 'rush', key: '48h' }, { kind: 'usage', key: '30d' }] } },
      card,
    });
    expect(p.components.appearance.fee).toBe(450); // untouched
    expect(p.deliverables[0]).toMatchObject({ anchor: 225, fee: 281 }); // 225 × 1.25 = 281.25, rounded once
    expect(p.deliverables[0].fee).not.toBe(Math.round(225 * 1.10 * 1.15)); // compounded would be 285
    expect(p.deliverables[0].premiums).toEqual([{ kind: 'rush', key: '48h', percent: 10 }, { kind: 'usage', key: '30d', percent: 15 }]);
    expect(p.deliverables[1].fee).toBe(110); // untouched
  });

  it('ruling 3: a premium on the partnership base raises the base, not the appearance', () => {
    const p = proposeTerms({
      event: { deal_type: 'brand_partnership', career_tier: 2, appearance_required: true },
      premiums: { partnership_base: [{ kind: 'exclusivity', key: '90d' }] },
      card,
    });
    expect(fees(p)).toEqual({ partnership_base: 700, appearance: 250 }); // 500 × 1.40
  });

  it('ruling 3: a premium on a component the deal lacks, or on a hand-priced line, is refused', () => {
    expect(proposeTerms({ event: { deal_type: 'brand_partnership', career_tier: 2 }, premiums: { appearance: [{ kind: 'rush', key: '48h' }] }, card }))
      .toMatchObject({ ok: false });
    expect(proposeTerms({ event: { deal_type: 'paid_deliverables', career_tier: 2 }, deliverables: [other], premiums: { deliverables: { 'd-other': [{ kind: 'rush', key: '48h' }] } }, card }).error)
      .toMatch(/no rate anchor, so no premium applies/);
  });

  it('paid_ad has no percent yet, so it is refused, not guessed', () => {
    const p = proposeTerms({ event: { deal_type: 'paid_appearance', career_tier: 1 }, premiums: { appearance: [{ kind: 'paid_ad', key: 'whitelisting' }] }, card });
    expect(p.ok).toBe(false);
    expect(p.error).toMatch(/no percent yet \(set before use\)/);
  });

  it('an unknown premium, or two of one kind on a line, is refused', () => {
    expect(proposeTerms({ event: { deal_type: 'paid_appearance', career_tier: 1 }, premiums: { appearance: [{ kind: 'rush', key: '12h' }] }, card }).ok).toBe(false);
    expect(proposeTerms({ event: { deal_type: 'paid_appearance', career_tier: 1 }, premiums: { appearance: [{ kind: 'rush', key: '48h' }, { kind: 'rush', key: '24h' }] }, card }).ok).toBe(false);
  });

  it('the partnership base is not offered at Emerging: price required, and it says so', () => {
    const p = proposeTerms({ event: { deal_type: 'brand_partnership', career_tier: 1 }, deliverables: [reel], card });
    expect(p.ok).toBe(true);
    expect(fees(p)).toEqual({ partnership_base: null });
    expect(p.gaps).toContain('Partnership base: price required (brand_partnership_base is not offered at tier 1).');
    expect(p.deliverables[0].fee).toBe(75);
  });

  it('ruling 4: self-funded and comped produce no income; gifted no cash, and records gifted value', () => {
    for (const t of ['self_funded', 'invited_comped', 'gifted']) {
      const p = proposeTerms({ event: { deal_type: t, career_tier: 5 }, deliverables: [reel], card });
      expect(p).toMatchObject({ ok: true, cash: false, components: {} });
      expect(p.deliverables[0]).toMatchObject({ fee: null, price_required: false });
    }
    expect(proposeTerms({ event: { deal_type: 'gifted', career_tier: 5 }, card }).note).toBe('Gifted: no cash income. Record the gifted value on the deal.');
    expect(proposeTerms({ event: { deal_type: 'self_funded', career_tier: 5 }, card }).note).toBe('No cash income for this deal type.');
  });

  it('no deal type, an unknown one, or no card: a clear refusal', () => {
    expect(proposeTerms({ event: {}, card }).error).toMatch(/deal type/);
    expect(proposeTerms({ event: { deal_type: 'sponsorship' }, card }).ok).toBe(false);
    expect(proposeTerms({ event: { deal_type: 'paid_appearance' }, card: null }).error).toMatch(/no rate card/);
  });

  it('a missing or out-of-range tier reads as Emerging', () => {
    expect(proposeTerms({ event: { deal_type: 'paid_appearance', career_tier: null }, card }).components.appearance.fee).toBe(150);
    expect(proposeTerms({ event: { deal_type: 'paid_appearance', career_tier: 9 }, card }).components.appearance.fee).toBe(150);
  });

  it('every fixed deliverable type has a label', () => {
    expect(Object.keys(DELIVERABLE_TYPE_LABELS)).toEqual(DELIVERABLE_TYPES);
  });
});

describe('missingPrices (ruling 6: "Missing is missing")', () => {
  it('Other with no price is missing; with a price, including 0, it is not', () => {
    const event = { deal_type: 'paid_deliverables' };
    expect(missingPrices(event, [{ ...other, fee: null }])).toEqual([{ kind: 'deliverable', key: 'd-other', label: '"Host a Q&A"' }]);
    expect(missingPrices(event, [{ ...other, fee: 40 }])).toEqual([]);
    expect(missingPrices(event, [{ ...other, fee: 0 }])).toEqual([]);
  });

  it('every priced component and paid deliverable of the deal is checked', () => {
    const event = { deal_type: 'brand_partnership', appearance_required: true, partnership_base_fee: 900, appearance_fee: null };
    expect(missingPrices(event, [{ ...reel, fee: 225 }, { ...post, fee: null }]).map((m) => m.label))
      .toEqual(['Appearance fee', '"A feed post"']);
    expect(missingPrices({ ...event, appearance_required: false }, [{ ...reel, fee: 225 }]).map((m) => m.label)).toEqual([]);
  });

  it('a performance booking needs its fee', () => {
    expect(missingPrices({ deal_type: 'performance_booking', performance_fee: null }).map((m) => m.key)).toEqual(['performance_fee']);
  });

  it('no deal type, and deal types with no cash income, have nothing missing', () => {
    expect(missingPrices({ deal_type: null }, [{ ...other, fee: null }])).toEqual([]);
    for (const t of ['self_funded', 'invited_comped', 'gifted']) expect(missingPrices({ deal_type: t }, [{ ...other, fee: null }])).toEqual([]);
  });

  it('a paid appearance with no deliverables to pay ignores deliverable fees', () => {
    expect(missingPrices({ deal_type: 'paid_appearance', appearance_fee: 250 }, [{ ...other, fee: null }])).toEqual([]);
  });
});
