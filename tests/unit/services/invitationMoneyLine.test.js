/**
 * Invitation money line (Task #2375).
 *
 * buildInvitationContent used to test the BOOLEAN is_paid against the
 * string 'yes', so every non-free event read "N coins per guest" (and 100
 * when cost_coins was null). describeInvitationMoney now phrases the line
 * from the deal: fees earned, comped, or the entry cost Lala pays.
 */
jest.mock('canvas', () => { throw new Error('canvas not installed in unit tests'); }, { virtual: true });

const mockCreate = jest.fn();
jest.mock('@anthropic-ai/sdk', () => jest.fn().mockImplementation(() => ({
  messages: { create: (...args) => mockCreate(...args) },
})));

const {
  describeInvitationMoney,
  buildInvitationContent,
} = require('../../../src/services/invitationCompositingService');

describe('describeInvitationMoney — deal events', () => {
  it('paid_appearance: Lala earns the appearance fee', () => {
    const m = describeInvitationMoney({ deal_type: 'paid_appearance', appearance_fee: 500, cost_coins: 300 });
    expect(m.kind).toBe('earn');
    expect(m.text).toBe('Lala will earn appearance fee of 500 coins');
    expect(m.text).not.toMatch(/per guest|300/);
  });

  it('paid_appearance without a fee yet: paid, fee to be confirmed (no invented number)', () => {
    const m = describeInvitationMoney({ deal_type: 'paid_appearance', appearance_fee: null, cost_coins: 300 });
    expect(m.kind).toBe('earn');
    expect(m.text).toBe('a paid engagement for Lala — fee to be confirmed');
  });

  it('brand_partnership: names the partnership base, plus deliverables', () => {
    const m = describeInvitationMoney({ deal_type: 'brand_partnership', partnership_base_fee: 1200, appearance_required: false });
    expect(m.kind).toBe('earn');
    expect(m.text).toBe('Lala will earn partnership base of 1200 coins, plus payment for each agreed deliverable');
  });

  it('brand_partnership with a required appearance: names both fees', () => {
    const m = describeInvitationMoney({
      deal_type: 'brand_partnership', partnership_base_fee: 1200, appearance_fee: 400, appearance_required: true,
    });
    expect(m.text).toBe('Lala will earn partnership base of 1200 coins and appearance fee of 400 coins, plus payment for each agreed deliverable');
  });

  it('performance_booking and paid_deliverables are phrased as earnings too', () => {
    expect(describeInvitationMoney({ deal_type: 'performance_booking', performance_fee: 900 }).text)
      .toBe('Lala will earn performance fee of 900 coins, plus payment for each agreed deliverable');
    expect(describeInvitationMoney({ deal_type: 'paid_deliverables' }).text)
      .toBe('Lala will earn payment for each agreed deliverable');
    expect(describeInvitationMoney({ deal_type: 'appearance_plus_deliverables', appearance_fee: 250 }).text)
      .toBe('Lala will earn appearance fee of 250 coins, plus payment for each agreed deliverable');
  });

  it('invited_comped: complimentary, names the comped entry row', () => {
    const costs = [
      { kind: 'entry', paid_by: 'host', amount: 350 },
      { kind: 'extras', paid_by: 'lala', amount: 40 },
    ];
    const m = describeInvitationMoney({ deal_type: 'invited_comped', cost_coins: 999 }, { costs });
    expect(m.kind).toBe('comped');
    expect(m.text).toBe('complimentary — the 350-coin entry is comped by the host');
  });

  it('invited_comped without costs loaded falls back to cost_coins; with none, plain comped', () => {
    expect(describeInvitationMoney({ deal_type: 'invited_comped', cost_coins: 200 }).text)
      .toBe('complimentary — the 200-coin entry is comped by the host');
    expect(describeInvitationMoney({ deal_type: 'invited_comped', cost_coins: null }).text)
      .toBe('complimentary — Lala attends as the host\'s guest');
  });

  it('gifted: complimentary, names the gifted value when set', () => {
    const m = describeInvitationMoney({ deal_type: 'gifted', gifted_value: 800, cost_coins: 300 });
    expect(m.kind).toBe('comped');
    expect(m.text).toBe('complimentary — Lala attends as a gifted guest (gift valued at 800 coins)');
    expect(describeInvitationMoney({ deal_type: 'gifted' }).text)
      .toBe('complimentary — Lala attends as a gifted guest');
  });

  it('self_funded: the entry cost Lala pays, from her entry rows', () => {
    const costs = [
      { kind: 'entry', paid_by: 'lala', amount: 450 },
      { kind: 'extras', paid_by: 'lala', amount: 60 },
    ];
    const m = describeInvitationMoney({ deal_type: 'self_funded', cost_coins: 300 }, { costs });
    expect(m.kind).toBe('cost');
    expect(m.text).toBe('entry is 450 coins, paid by Lala');
  });

  it('self_funded without costs loaded falls back to cost_coins; with nothing, neutral', () => {
    expect(describeInvitationMoney({ deal_type: 'self_funded', cost_coins: 300 }).text)
      .toBe('entry is 300 coins, paid by Lala');
    const m = describeInvitationMoney({ deal_type: 'self_funded', cost_coins: 300 }, { costs: [] });
    expect(m.kind).toBe('neutral');
    expect(m.text).toBe('Lala attends at her own expense — entry details to follow');
  });

  it('an unknown deal type says nothing about money', () => {
    expect(describeInvitationMoney({ deal_type: 'mystery', cost_coins: 300 }).kind).toBe('neutral');
  });
});

describe('describeInvitationMoney — legacy events (deal_type null)', () => {
  it('legacy paid (boolean is_paid true): Lala earns payment_amount', () => {
    const m = describeInvitationMoney({ deal_type: null, is_paid: true, payment_amount: 750, cost_coins: 200 });
    expect(m.kind).toBe('earn');
    expect(m.text).toBe('Lala will earn 750 coins for attending');
  });

  it('legacy paid as the string "yes" still earns', () => {
    expect(describeInvitationMoney({ is_paid: 'yes', payment_amount: '120.00' }).text)
      .toBe('Lala will earn 120 coins for attending');
  });

  it('legacy free: is_free, is_paid "free", or cost 0 is complimentary', () => {
    for (const e of [{ is_free: true, cost_coins: 300 }, { is_paid: 'free', cost_coins: 300 }, { is_paid: false, cost_coins: 0 }]) {
      const m = describeInvitationMoney(e);
      expect(m.kind).toBe('comped');
      expect(m.text).toBe('complimentary — no cost to attend');
    }
  });

  it('legacy with a cost: the entry cost, never "per guest"', () => {
    const m = describeInvitationMoney({ is_paid: false, cost_coins: 250 });
    expect(m.kind).toBe('cost');
    expect(m.text).toBe('entry is 250 coins');
  });

  it('legacy with no cost_coins: neutral wording, never an invented 100', () => {
    const m = describeInvitationMoney({ is_paid: false, cost_coins: null });
    expect(m.kind).toBe('neutral');
    expect(m.text).toBe('entry details to follow');
    expect(m.text).not.toMatch(/100/);
  });
});

describe('buildInvitationContent uses the money line', () => {
  beforeEach(() => mockCreate.mockReset());

  it('hands the deal wording to the prose prompt', async () => {
    mockCreate.mockResolvedValue({ content: [{ text: 'OPENING: Hi.\nBODY: Body.\nCLOSING: Bye.' }] });
    await buildInvitationContent({ name: 'Gala', deal_type: 'paid_appearance', appearance_fee: 500, is_paid: true });
    const prompt = mockCreate.mock.calls[0][0].messages[0].content;
    expect(prompt).toContain('Investment: Lala will earn appearance fee of 500 coins');
    expect(prompt).not.toContain('per guest');
  });

  it('uses the sentence in the no-AI fallback body, with passed costs', async () => {
    mockCreate.mockRejectedValue(new Error('offline'));
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const content = await buildInvitationContent(
      { name: 'Soiree', deal_type: 'self_funded', cost_coins: 100 },
      { costs: [{ kind: 'entry', paid_by: 'lala', amount: 420 }] },
    );
    warn.mockRestore();
    expect(content.body).toContain('Entry is 420 coins.');
    expect(content.body).not.toContain('per guest');
  });
});
