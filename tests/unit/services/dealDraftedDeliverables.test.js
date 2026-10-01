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

const { V2_NEW_ANCHORS } = require('../../../src/migrations/20261001160000-add-deliverable-formats');

// Rate card v2 (D15): v1 plus the formats' anchors, so the Instagram post
// is priced (answer 8).
const card = rateCardFrom(
  2,
  Object.entries({ ...ANCHORS, ...V2_NEW_ANCHORS }).flatMap(([component, amounts]) => amounts.map((amount, i) => ({ component, career_tier: i + 1, amount }))),
  PREMIUMS.map(([kind, key, percent]) => ({ kind, key, percent }))
);

const types = (dealType, tier) => draftDeliverablesForDeal({ deal_type: dealType, career_tier: tier }, { card })
  .map((d) => (d.required ? d.deliverable_type : `${d.deliverable_type}?`));

describe('D12: the mapping, by deal type and tier', () => {
  // D15: drafted in the formats (Reel → Instagram Reel, Story Set (3) →
  // Instagram Stories ×3, Post → Instagram post).
  const R = 'instagram_reel'; const S = 'instagram_stories'; const P = 'instagram_post';
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
    expect(types('paid_deliverables', 9)).toEqual(['instagram_reel']);
    // tier option overrides the event's
    expect(draftDeliverablesForDeal({ deal_type: 'paid_deliverables', career_tier: 1 }, { tier: 4, card })).toHaveLength(3);
  });
});

describe('D12: priced from the rate anchors', () => {
  it('each format takes its anchor at the tier; the Instagram post at 0.5× the Reel (answer 8)', () => {
    expect(draftDeliverablesForDeal({ deal_type: 'paid_deliverables', career_tier: 4 }, { card })).toEqual([
      { deliverable_type: 'instagram_reel', platform: 'instagram', quantity: 1, description: 'Instagram Reel', required: true, owed_to: 'host', fee: 325 },
      { deliverable_type: 'instagram_stories', platform: 'instagram', quantity: 3, description: 'Instagram Stories (×3)', required: true, owed_to: 'host', fee: 160 },
      { deliverable_type: 'instagram_post', platform: 'instagram', quantity: 1, description: 'Instagram post', required: true, owed_to: 'host', fee: 165 },
    ]);
  });

  it('a brand partnership owes its package to the brand', () => {
    expect(draftDeliverablesForDeal({ deal_type: 'brand_partnership', career_tier: 2 }, { card })).toEqual([
      { deliverable_type: 'instagram_reel', platform: 'instagram', quantity: 1, description: 'Instagram Reel', required: true, owed_to: 'brand', fee: 125 },
      { deliverable_type: 'instagram_stories', platform: 'instagram', quantity: 3, description: 'Instagram Stories (×3)', required: true, owed_to: 'brand', fee: 60 },
    ]);
  });

  it('a paid appearance does not pay deliverables: its optional Instagram Stories have no fee', () => {
    expect(draftDeliverablesForDeal({ deal_type: 'paid_appearance', career_tier: 3 }, { card })).toEqual([
      { deliverable_type: 'instagram_stories', platform: 'instagram', quantity: 3, description: 'Instagram Stories (×3)', required: false, owed_to: 'host', fee: null },
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
