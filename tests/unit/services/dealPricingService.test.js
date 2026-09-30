/**
 * Deal pricing (deal build PR 3, Task #2341; DEAL_DESIGN.md §11.1; Evoni's
 * QUESTION 4 answer, EVENT_EPISODE_FLOW.md §8(cc)). Pure: a rate card built
 * from the version 1 seed values, no database.
 */
const { proposeTerms, rateCardFrom, deliverableComponent, DEAL_COMPONENTS } = require('../../../src/services/dealPricingService');
const { ANCHORS, PREMIUMS } = require('../../../src/migrations/20260929200002-create-deal-rate-anchors');
const { DEAL_TYPES } = require('../../../src/models/WorldEvent');

const card = rateCardFrom(
  1,
  Object.entries(ANCHORS).flatMap(([component, amounts]) => amounts.map((amount, i) => ({ component, career_tier: i + 1, amount }))),
  PREMIUMS.map(([kind, key, percent]) => ({ kind, key, percent }))
);

const reel = { id: 'd-reel', description: 'One reel in the coat', deliverable_type: 'reel' };
const stories = { id: 'd-stories', description: 'Three stories', deliverable_type: 'stories' };
const post = { id: 'd-post', description: 'A feed post', deliverable_type: 'post' };

describe('proposeTerms (Task #2341)', () => {
  it('every deal type has a pricing plan', () => {
    expect(Object.keys(DEAL_COMPONENTS).sort()).toEqual([...DEAL_TYPES].sort());
  });

  it('paid appearance takes the anchor for the event\'s tier', () => {
    for (const [tier, fee] of [[1, 150], [3, 450], [5, 900]]) {
      const p = proposeTerms({ event: { deal_type: 'paid_appearance', career_tier: tier }, card });
      expect(p).toMatchObject({ ok: true, pricing_version: 1, career_tier: tier, appearance: { component: 'paid_appearance', anchor: fee, fee } });
    }
  });

  it('performance booking takes its own anchor', () => {
    expect(proposeTerms({ event: { deal_type: 'performance_booking', career_tier: 4 }, card }).appearance.fee).toBe(600);
  });

  it('deliverables take their component\'s anchor; an unmapped type is left to price by hand', () => {
    const p = proposeTerms({ event: { deal_type: 'appearance_plus_deliverables', career_tier: 2 }, deliverables: [reel, stories, post], card });
    expect(p.appearance.fee).toBe(250);
    expect(p.deliverables.map((l) => [l.id, l.component, l.fee])).toEqual([
      ['d-reel', 'reel', 125], ['d-stories', 'stories_3', 60], ['d-post', null, null],
    ]);
    expect(p.gaps).toEqual(['"A feed post" has no rate anchor; price it by hand.']);
  });

  it('a premium raises only the line it is chosen for', () => {
    const p = proposeTerms({
      event: { deal_type: 'appearance_plus_deliverables', career_tier: 3 },
      deliverables: [reel, stories],
      premiums: { deliverables: { 'd-reel': [{ kind: 'rush', key: '48h' }, { kind: 'usage', key: '30d' }] } },
      card,
    });
    expect(p.appearance.fee).toBe(450); // untouched
    expect(p.deliverables[0]).toMatchObject({ anchor: 225, fee: Math.round(225 * 1.25) }); // +10% +15% = +25%
    expect(p.deliverables[0].premiums).toEqual([{ kind: 'rush', key: '48h', percent: 10 }, { kind: 'usage', key: '30d', percent: 15 }]);
    expect(p.deliverables[1].fee).toBe(110); // untouched
  });

  it('exclusivity on the appearance, rounded to whole Prime Coins', () => {
    const p = proposeTerms({ event: { deal_type: 'paid_appearance', career_tier: 2 }, premiums: { appearance: [{ kind: 'exclusivity', key: '90d' }] }, card });
    expect(p.appearance.fee).toBe(350); // 250 × 1.40
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

  it('brand partnership base is not offered at Emerging: the fee stays empty and it says so', () => {
    const p = proposeTerms({ event: { deal_type: 'brand_partnership', career_tier: 1 }, deliverables: [reel], card });
    expect(p.ok).toBe(true);
    expect(p.appearance).toMatchObject({ component: 'brand_partnership_base', fee: null });
    expect(p.gaps).toContain('brand_partnership_base is not offered at tier 1.');
    expect(p.deliverables[0].fee).toBe(75);
    expect(proposeTerms({ event: { deal_type: 'brand_partnership', career_tier: 2 }, card }).appearance.fee).toBe(500);
  });

  it('self-funded, comped and gifted create no cash income', () => {
    for (const t of ['self_funded', 'invited_comped', 'gifted']) {
      const p = proposeTerms({ event: { deal_type: t, career_tier: 5 }, deliverables: [reel], card });
      expect(p.appearance.fee).toBe(0);
      expect(p.deliverables[0].fee).toBeNull();
    }
  });

  it('paid deliverables prices the deliverables and no appearance', () => {
    const p = proposeTerms({ event: { deal_type: 'paid_deliverables', career_tier: 5 }, deliverables: [reel], card });
    expect(p.appearance.fee).toBeNull();
    expect(p.deliverables[0].fee).toBe(450);
  });

  it('no deal type, an unknown one, or no card: a clear refusal', () => {
    expect(proposeTerms({ event: {}, card }).error).toMatch(/deal type/);
    expect(proposeTerms({ event: { deal_type: 'sponsorship' }, card }).ok).toBe(false);
    expect(proposeTerms({ event: { deal_type: 'paid_appearance' }, card: null }).error).toMatch(/no rate card/);
  });

  it('a missing or out-of-range tier reads as Emerging', () => {
    expect(proposeTerms({ event: { deal_type: 'paid_appearance', career_tier: null }, card }).appearance.fee).toBe(150);
    expect(proposeTerms({ event: { deal_type: 'paid_appearance', career_tier: 9 }, card }).appearance.fee).toBe(150);
  });

  it('deliverable types: reel and stories', () => {
    expect(deliverableComponent('Reel')).toBe('reel');
    expect(deliverableComponent('IG stories')).toBe('stories_3');
    expect(deliverableComponent('story')).toBe('stories_3');
    expect(deliverableComponent('post')).toBeNull();
    expect(deliverableComponent(null)).toBeNull();
  });
});
