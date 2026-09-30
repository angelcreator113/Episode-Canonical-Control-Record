/**
 * The deal type's fixed rule (deal build PR 2, Task #2330;
 * docs/DEAL_DESIGN.md §2.2 and §6, QUESTIONS 2 and 9). Pure: no database.
 */
const { draftDealType, OPPORTUNITY_DEAL_TYPES } = require('../../../src/services/dealTypeDraftService');
const { DEAL_TYPES } = require('../../../src/models/WorldEvent');

describe('draftDealType', () => {
  it('maps every approved opportunity type, with source opportunity', () => {
    expect(OPPORTUNITY_DEAL_TYPES).toEqual({
      modeling: 'paid_appearance', runway: 'paid_appearance', casting_call: 'paid_appearance',
      editorial: 'paid_deliverables', campaign: 'paid_deliverables',
      brand_deal: 'appearance_plus_deliverables',
      ambassador: 'brand_partnership',
      podcast: 'performance_booking', interview: 'performance_booking', panel: 'performance_booking',
      award_show: 'invited_comped',
      pr_gifting: 'gifted',
    });
    for (const [type, deal] of Object.entries(OPPORTUNITY_DEAL_TYPES)) {
      expect(draftDealType({ opportunity_type: type, event_type: 'invite' })).toEqual({ deal_type: deal, source: 'opportunity' });
      expect(DEAL_TYPES).toContain(deal);
    }
  });

  it('an unmapped opportunity type falls through to the rule', () => {
    expect(draftDealType({ opportunity_type: 'something_new', event_type: 'fail_test' })).toEqual({ deal_type: 'self_funded', source: 'rule' });
  });

  it('brand_partnership needs both a brand and a brand-owed deliverable', () => {
    const brand = { owed_to: 'brand' };
    const host = { owed_to: 'host' };
    expect(draftDealType({ event_type: 'invite', host_brand: 'Velour', deliverables: [host, brand] }).deal_type).toBe('brand_partnership');
    expect(draftDealType({ event_type: 'invite', host_brand: 'Velour', deliverables: [host] }).deal_type).toBe('invited_comped');
    expect(draftDealType({ event_type: 'invite', host_brand: '  ', deliverables: [brand] }).deal_type).toBe('invited_comped');
    expect(draftDealType({ event_type: 'invite', host_brand: null, deliverables: [brand] }).deal_type).toBe('invited_comped');
  });

  it('invite, guest and upgrade are invited_comped; everything else self_funded', () => {
    for (const t of ['invite', 'guest', 'upgrade']) expect(draftDealType({ event_type: t })).toEqual({ deal_type: 'invited_comped', source: 'rule' });
    for (const t of ['fail_test', 'deliverable', 'brand_deal', undefined]) expect(draftDealType({ event_type: t })).toEqual({ deal_type: 'self_funded', source: 'rule' });
  });

  it('the opportunity wins over the rule', () => {
    expect(draftDealType({ opportunity_type: 'podcast', event_type: 'invite', host_brand: 'Velour', deliverables: [{ owed_to: 'brand' }] }).deal_type)
      .toBe('performance_booking');
  });
});
