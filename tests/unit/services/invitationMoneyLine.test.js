/**
 * Invitation money line (Task #2375).
 *
 * buildInvitationContent used to test the BOOLEAN is_paid against the
 * string 'yes', so every non-free event read "N coins per guest" (and 100
 * when cost_coins was null). describeInvitationMoney now states the deal,
 * per Evoni's invitation ruling of 2026-09-30 (docs/EVENT_EPISODE_FLOW.md
 * §8(cc)): in the host's voice, in Prime Coins, what Lala is paid (fees and
 * each deliverable with its fee), what she pays (entry, if self-funded),
 * what is covered and by whom, and any bonus; comped and gifted events say
 * so without price talk.
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

// No amount: D15's quantities ("7 days", "3 Instagram Stories") are
// digits too, so it is the coin amounts that are refused.
const NO_PRICE = /\d[\d,]*\s*(?:Prime Coins|coins)|Prime Coins|coins/;

describe('describeInvitationMoney — deal events (invitation ruling)', () => {
  it('paid_appearance: the appearance fee, in Prime Coins, in the host\'s voice', () => {
    const m = describeInvitationMoney({ deal_type: 'paid_appearance', appearance_fee: 1500, cost_coins: 300 }, { costs: [], deliverables: [] });
    expect(m.kind).toBe('earn');
    expect(m.text).toBe('We will pay you an appearance fee of 1,500 Prime Coins.');
    expect(m.sentence).toBe(m.text);
    expect(m.text).not.toMatch(/per guest|300/);
  });

  it('paid_appearance with no fee yet: fee to be confirmed, no invented number', () => {
    const m = describeInvitationMoney({ deal_type: 'paid_appearance', appearance_fee: null }, { costs: [], deliverables: [] });
    expect(m.text).toBe('Your fee will be confirmed.');
  });

  it('brand_partnership: base, appearance when required, each deliverable with its fee, covered, bonus', () => {
    const m = describeInvitationMoney({
      deal_type: 'brand_partnership', host_brand: 'Maison Vero',
      partnership_base_fee: 1200, appearance_required: true, appearance_fee: 400,
      bonus_terms: { slay: 200, pass: 100 },
    }, {
      costs: [
        { kind: 'travel', label: 'Car', amount: 80, paid_by: 'host' },
        { kind: 'glam', label: null, amount: 60, paid_by: 'brand' },
        { kind: 'styling', label: 'Tailor', amount: 50, paid_by: 'lala' },
      ],
      deliverables: [
        { deliverable_type: 'instagram_reel', fee: 300 },
        { deliverable_type: 'instagram_stories', quantity: 3, fee: 120 },
        { deliverable_type: 'grwm_video', platform: 'tiktok', quantity: 1, fee: null },
      ],
    });
    expect(m.kind).toBe('earn');
    expect(m.text).toBe([
      'We will pay you a partnership base fee of 1,200 Prime Coins and an appearance fee of 400 Prime Coins.',
      // D15: the natural phrase ("1 TikTok GRWM, 3 Instagram Stories").
      'For your content, we will pay 300 Prime Coins for 1 Instagram Reel, 120 Prime Coins for 3 Instagram Stories and 1 TikTok GRWM (fee to be confirmed).',
      'We are covering your car.',
      'Maison Vero is covering your glam.',
      'If your look earns a Slay, we will add a bonus of 200 Prime Coins; for a Pass, 100 Prime Coins.',
    ].join(' '));
    // A cost Lala pays on a paid deal is not "what she pays" (entry, if self-funded).
    expect(m.text).not.toMatch(/Tailor|tailor/);
  });

  it('performance_booking and paid_deliverables: fees and deliverables; unloaded deliverables stay generic', () => {
    expect(describeInvitationMoney({ deal_type: 'performance_booking', performance_fee: 600 }, { costs: [], deliverables: [] }).text)
      .toBe('We will pay you a performance fee of 600 Prime Coins.');
    expect(describeInvitationMoney({ deal_type: 'paid_deliverables' }, { costs: [], deliverables: [{ description: 'Unboxing video', deliverable_type: 'other', fee: 250 }] }).text)
      .toBe('For your content, we will pay 250 Prime Coins for "Unboxing video".');
    expect(describeInvitationMoney({ deal_type: 'paid_deliverables' }).text)
      .toBe('We will pay a fee for each piece of content we agree.');
    expect(describeInvitationMoney({ deal_type: 'paid_deliverables' }, { costs: [], deliverables: [] }).text)
      .toBe('Your fee will be confirmed.');
  });

  it('invited_comped: says so, names what the host covers, no price talk', () => {
    const m = describeInvitationMoney({ deal_type: 'invited_comped', cost_coins: 350, bonus_terms: { slay: 200 } }, {
      costs: [{ kind: 'entry', label: 'Entry / ticket', amount: 350, paid_by: 'host' }],
      deliverables: [{ deliverable_type: 'link_in_bio', platform: 'instagram', quantity: 7, fee: 300 }],
    });
    expect(m.kind).toBe('comped');
    expect(m.text).toBe('You attend as our guest, with our compliments. We are covering your entry / ticket. In return, we ask for a link in bio on Instagram (7 days).');
    expect(m.text).not.toMatch(NO_PRICE);
  });

  it('gifted: says so, no gift value and no price talk', () => {
    const m = describeInvitationMoney({ deal_type: 'gifted', gifted_value: 800 }, { costs: [], deliverables: [] });
    expect(m.kind).toBe('comped');
    expect(m.text).toBe('You attend as our gifted guest, with our compliments.');
    expect(m.text).not.toMatch(NO_PRICE);
  });

  it('self_funded: the entry Lala pays, what the host covers, any bonus', () => {
    const m = describeInvitationMoney({ deal_type: 'self_funded', cost_coins: 100, bonus_terms: { pass: 50 } }, {
      costs: [
        { kind: 'entry', label: 'Entry / ticket', amount: 450, paid_by: 'lala' },
        { kind: 'extras', label: 'Drinks', amount: 100, paid_by: 'host' },
      ],
      deliverables: [],
    });
    expect(m.kind).toBe('cost');
    expect(m.text).toBe('Entry is 450 Prime Coins, paid by you. We are covering your drinks. If your look earns a Pass, we will add a bonus of 50 Prime Coins.');
  });

  it('self_funded without costs loaded falls back to cost_coins; with nothing, entry details follow', () => {
    expect(describeInvitationMoney({ deal_type: 'self_funded', cost_coins: 300 }).text).toBe('Entry is 300 Prime Coins, paid by you.');
    const none = describeInvitationMoney({ deal_type: 'self_funded', cost_coins: 0 }, { costs: [], deliverables: [] });
    expect(none.kind).toBe('neutral');
    expect(none.text).toBe('Entry details will follow.');
  });

  it('an unknown deal type says nothing about money', () => {
    const m = describeInvitationMoney({ deal_type: 'mystery', cost_coins: 500 });
    expect(m.kind).toBe('neutral');
    expect(m.text).toBe('The terms will be confirmed.');
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

describe('buildInvitationContent states the deal', () => {
  beforeEach(() => mockCreate.mockReset());

  it('hands the terms to the prose prompt, in the host\'s voice and Prime Coins', async () => {
    mockCreate.mockResolvedValue({ content: [{ text: 'OPENING: Hi.\nBODY: Body.\nCLOSING: Bye.' }] });
    await buildInvitationContent(
      { name: 'Gala', deal_type: 'paid_appearance', appearance_fee: 500, is_paid: true, event_type: 'brand_deal', success_unlock: 'post a reel' },
      { costs: [], deliverables: [] },
    );
    const prompt = mockCreate.mock.calls[0][0].messages[0].content;
    expect(prompt).toContain('Terms (the host speaking, in Prime Coins): We will pay you an appearance fee of 500 Prime Coins.');
    expect(prompt).toContain('mention no price at all');
    expect(prompt).not.toContain('Deliverable: post a reel');
    expect(prompt).not.toContain('per guest');
  });

  it('a legacy event keeps the Investment line', async () => {
    mockCreate.mockResolvedValue({ content: [{ text: 'OPENING: Hi.\nBODY: Body.\nCLOSING: Bye.' }] });
    await buildInvitationContent({ name: 'Gala', is_paid: true, payment_amount: 750 });
    const prompt = mockCreate.mock.calls[0][0].messages[0].content;
    expect(prompt).toContain('Investment: Lala will earn 750 coins for attending');
  });

  it('uses the statement in the no-AI fallback body, with passed costs', async () => {
    mockCreate.mockRejectedValue(new Error('offline'));
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const content = await buildInvitationContent(
      { name: 'Soiree', deal_type: 'self_funded', cost_coins: 100 },
      { costs: [{ kind: 'entry', paid_by: 'lala', amount: 420 }], deliverables: [] },
    );
    warn.mockRestore();
    expect(content.body).toContain('Entry is 420 Prime Coins, paid by you.');
    expect(content.body).not.toContain('per guest');
  });
});

describe('describeInvitationMoney — D14 components (2026-09-30)', () => {
  test('a combination no deal type had: appearance + performance fee + gifted, each named once', () => {
    const m = describeInvitationMoney(
      { deal_components: ['paid_to_appear', 'performance_fee', 'gifted_items'], appearance_fee: 300, performance_fee: 500 },
      { costs: [], deliverables: [] }
    );
    expect(m.kind).toBe('earn');
    expect(m.text).toBe('We will pay you a performance fee of 500 Prime Coins and an appearance fee of 300 Prime Coins. We are also gifting you pieces to keep.');
  });

  test('a retainer pays its base and asks for content without fees', () => {
    const m = describeInvitationMoney(
      { deal_components: ['partnership_base'], partnership_base_fee: 900 },
      { costs: [], deliverables: [{ deliverable_type: 'instagram_reel', fee: 300 }] }
    );
    expect(m.text).toBe('We will pay you a partnership base fee of 900 Prime Coins. In return, we ask for 1 Instagram Reel.');
  });

  test('gifted with entry covered reads as a gifted guest, with no price talk', () => {
    const m = describeInvitationMoney({ deal_components: ['gifted_items', 'entry_covered'] }, { costs: [], deliverables: [] });
    expect(m).toMatchObject({ kind: 'comped', text: 'You attend as our gifted guest, with our compliments.' });
  });
});
