/**
 * Drafted deliverables (ruling D12, Evoni, 2026-09-30; Task #2395).
 * "Propose terms drafts deliverables from the deal type, scaled to the job
 * … Auto-drafted, editable, priced from the rate anchors."
 *
 * Pure: draftDeliverablesForDeal against a rate card built from the version
 * 1 seed values, no database. The mapping by deal type and tier is pinned
 * in full; INFERRED parts are named in dealPricingService.
 */
const {
  draftDeliverablesForDeal, draftedDeliverableTypes, rateCardFrom, proposeTerms, DEAL_PLANS,
} = require('../../../src/services/dealPricingService');
const { ANCHORS, PREMIUMS } = require('../../../src/migrations/20260929200002-create-deal-rate-anchors');

const card = rateCardFrom(
  1,
  Object.entries(ANCHORS).flatMap(([component, amounts]) => amounts.map((amount, i) => ({ component, career_tier: i + 1, amount }))),
  PREMIUMS.map(([kind, key, percent]) => ({ kind, key, percent }))
);

const types = (dealType, tier) => draftDeliverablesForDeal({ deal_type: dealType, career_tier: tier }, { card })
  .map((d) => (d.required ? d.deliverable_type : `${d.deliverable_type}?`));

describe('D12: the mapping, by deal type and tier', () => {
  const R = 'reel'; const S = 'story_set_3'; const P = 'post';
  const table = {
    //                             T1          T2          T3             T4                T5
    self_funded:                  [[],         [],         [],            [],               []],
    invited_comped:               [[],         [],         [],            [],               []],
    gifted:                       [[],         [],         [],            [],               []],
    paid_appearance:              [[`${S}?`],  [`${S}?`],  [`${S}?`],     [`${S}?`],        [`${S}?`]],
    paid_deliverables:            [[R],        [R],        [R, S],        [R, S, P],        [R, S, P]],
    appearance_plus_deliverables: [[R],        [R],        [R],           [R, S],           [R, S]],
    performance_booking:          [[R],        [R],        [R],           [R, S],           [R, S]],
    brand_partnership:            [[R, S],     [R, S],     [R, S],        [R, S, P],        [R, S, P]],
  };

  it('covers every deal type', () => {
    expect(Object.keys(table).sort()).toEqual(Object.keys(DEAL_PLANS).sort());
  });

  for (const [dealType, byTier] of Object.entries(table)) {
    it(dealType, () => {
      expect([1, 2, 3, 4, 5].map((tier) => types(dealType, tier))).toEqual(byTier);
    });
  }

  it('paid deliverables stay within 1–3 pieces', () => {
    for (const tier of [1, 2, 3, 4, 5]) {
      const n = draftedDeliverableTypes('paid_deliverables', tier).length;
      expect(n).toBeGreaterThanOrEqual(1);
      expect(n).toBeLessThanOrEqual(3);
    }
  });

  it('no deal type, an unknown one, or a tier out of range', () => {
    expect(draftDeliverablesForDeal({ deal_type: null }, { card })).toEqual([]);
    expect(draftDeliverablesForDeal({ deal_type: 'barter' }, { card })).toEqual([]);
    // tierOf: out of range reads as Emerging.
    expect(types('paid_deliverables', 9)).toEqual(['reel']);
    // tier option overrides the event's
    expect(draftDeliverablesForDeal({ deal_type: 'paid_deliverables', career_tier: 1 }, { tier: 4, card })).toHaveLength(3);
  });
});

describe('D12: priced from the rate anchors', () => {
  it('Reel and Story Set take the anchor at the tier; a Post is "Price required" (ruling 2)', () => {
    expect(draftDeliverablesForDeal({ deal_type: 'paid_deliverables', career_tier: 4 }, { card })).toEqual([
      { deliverable_type: 'reel', description: 'Reel', required: true, owed_to: 'host', fee: 325 },
      { deliverable_type: 'story_set_3', description: 'Story Set (3)', required: true, owed_to: 'host', fee: 160 },
      { deliverable_type: 'post', description: 'Post', required: true, owed_to: 'host', fee: null },
    ]);
  });

  it('a brand partnership owes its package to the brand', () => {
    expect(draftDeliverablesForDeal({ deal_type: 'brand_partnership', career_tier: 2 }, { card })).toEqual([
      { deliverable_type: 'reel', description: 'Reel', required: true, owed_to: 'brand', fee: 125 },
      { deliverable_type: 'story_set_3', description: 'Story Set (3)', required: true, owed_to: 'brand', fee: 60 },
    ]);
  });

  it('a paid appearance does not pay deliverables: its optional Story Set has no fee', () => {
    expect(draftDeliverablesForDeal({ deal_type: 'paid_appearance', career_tier: 3 }, { card })).toEqual([
      { deliverable_type: 'story_set_3', description: 'Story Set (3)', required: false, owed_to: 'host', fee: null },
    ]);
  });

  it('without a rate card nothing is priced', () => {
    expect(draftDeliverablesForDeal({ deal_type: 'paid_deliverables', career_tier: 3 }).map((d) => d.fee)).toEqual([null, null]);
  });

  it('the drafted fees agree with proposeTerms at the same tier', () => {
    for (const dealType of Object.keys(DEAL_PLANS)) {
      for (const tier of [1, 2, 3, 4, 5]) {
        const event = { deal_type: dealType, career_tier: tier };
        const drafts = draftDeliverablesForDeal(event, { card }).map((d, i) => ({ ...d, id: `draft-${i}` }));
        const proposal = proposeTerms({ event, deliverables: drafts, card });
        expect(proposal.ok).toBe(true);
        expect(proposal.deliverables.map((l) => l.fee)).toEqual(drafts.map((d) => d.fee));
      }
    }
  });
});
