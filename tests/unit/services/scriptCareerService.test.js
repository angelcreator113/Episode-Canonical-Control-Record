const { careerBlock, dealOf } = require('../../../src/services/scriptCareerService');

describe('scriptCareerService', () => {
  it('a legacy event: its one payment, else no deal', () => {
    expect(dealOf({ is_paid: true, payment_amount: 250, host: 'Sable' })).toEqual({ kind: 'legacy', payer: 'Sable', terms: ['Paid 250 coins'], bonus: null });
    expect(dealOf({ is_paid: false, payment_amount: 0 })).toBeNull();
  });

  it('a deal read from its deal_type when written before the components column', () => {
    expect(dealOf({ deal_type: 'paid_appearance', appearance_fee: 300, host: 'Sable' }))
      .toEqual({ kind: 'deal', payer: 'Sable', terms: ['Paid to appear (300 coins)'], bonus: null });
  });

  it('a self-funded deal says nobody is paying and weighs the cost', () => {
    const block = careerBlock({ deal: dealOf({ deal_components: [] }), deliverables: [], goals: [] });
    expect(block).toContain('nobody is paying her');
    expect(block).toContain('Beats 4-6: the invite lands');
    expect(block).not.toContain('Beat 12');
  });

  it('nothing to say: no block', () => {
    expect(careerBlock(null)).toBe('');
    expect(careerBlock({ deal: null, deliverables: [], goals: [] })).toBe('');
  });

  it('goals alone pin to Beat 11 and the hook', () => {
    const block = careerBlock({ deal: null, deliverables: [], goals: [{ label: 'Meet Jade', description: null }] });
    expect(block).toContain('- Meet Jade');
    expect(block).toContain('Beat 11: she works the room toward her goal by name');
    expect(block).toContain('Beat 14: the hook comes from her career');
    expect(block).not.toContain('THE DEAL');
  });
});
