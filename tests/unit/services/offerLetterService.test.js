/**
 * offerLetterService (Evoni, 2026-10-24): the offer letter that replaced the
 * career plan. Deal events only; THE TERMS come from the deal, never from
 * the model; the letter's words name no amount the terms do not state;
 * two attempts, then the no-AI letter; a budget refusal is thrown.
 */
jest.mock('canvas', () => { throw new Error('canvas not installed in unit tests'); }, { virtual: true });
const mockCreate = jest.fn();
jest.mock('@anthropic-ai/sdk', () => jest.fn().mockImplementation(() => ({ messages: { create: (...a) => mockCreate(...a) } })));

const {
  isOfferEvent, offerSender, offerTerms, termsKey, normalizeLetter, checkLetter, fallbackLetter, writeOfferLetter,
} = require('../../../src/services/offerLetterService');

const tool = (input) => ({ content: [{ type: 'tool_use', name: 'write_offer_letter', input }] });
const LETTER = {
  greeting: 'Dear Lala,', opening: 'Following our invitation, Maison Rue is pleased to offer you a partnership.',
  opportunity: 'We would love you to front the launch of our winter collection.', next_steps: 'Reply to accept.',
  closing: 'Warm regards,', sender_name: 'Celeste Rue', sender_title: 'Founder, Maison Rue',
};
const PARTNERSHIP = {
  name: 'Maison Rue Launch', host: 'Celeste Rue', host_brand: 'Maison Rue',
  deal_components: ['partnership_base', 'paid_for_content'], partnership_base_fee: 1200, bonus_terms: { slay: 300 },
};

beforeEach(() => {
  mockCreate.mockReset();
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

describe('who gets one, and from whom', () => {
  test('deal events only', () => {
    expect(isOfferEvent({ deal_type: 'paid_appearance' })).toBe(true);
    expect(isOfferEvent({ deal_components: [] })).toBe(true); // self-funded is a deal too
    expect(isOfferEvent({ name: 'A plain invitation' })).toBe(false);
  });

  test('from the brand when there is one, signed by the host', () => {
    expect(offerSender(PARTNERSHIP)).toMatchObject({ org: 'Maison Rue', person: 'Celeste Rue' });
    expect(offerSender({ host: 'Nia' })).toMatchObject({ org: 'Nia', person: 'Nia' });
  });
});

describe('offerTerms: the terms section, from the deal', () => {
  test('a partnership: the base fee, each deliverable with its fee, what is covered, the bonus', () => {
    const sections = offerTerms(PARTNERSHIP, {
      costs: [{ kind: 'travel', paid_by: 'brand', amount: 0 }, { kind: 'entry', paid_by: 'host', amount: 0 }],
      deliverables: [{ id: 'd-1', description: 'One reel in the coat', deliverable_type: 'reel', required: true, owed_to: 'brand', fee: 400, due_date: '2026-11-14' }],
    });
    expect(sections.map((s) => s.key)).toEqual(['fees', 'deliverables', 'covered', 'bonus']);
    expect(sections[0].lines).toEqual([{ label: 'Partnership base fee', detail: '', amount: 1200 }]);
    expect(sections[1].lines[0]).toMatchObject({ label: 'One reel in the coat', amount: 400 });
    expect(sections[1].lines[0].detail).toMatch(/due 2026-11-14 · for the brand · required/);
    expect(sections[2].lines.map((l) => [l.label, l.detail])).toEqual([['Travel', 'covered by Maison Rue'], ['Entry', 'covered by the host']]);
    expect(sections[3].lines).toEqual([{ label: 'Bonus if her look earns a Slay', detail: '', amount: 300 }]);
  });

  test('comped: attends as our guest, no amount', () => {
    const sections = offerTerms({ deal_type: 'invited_comped' }, { costs: [], deliverables: [] });
    expect(sections).toEqual([{ key: 'guest', title: 'Compensation', lines: [{ label: 'Attends as our guest', detail: 'No fee; entry covered', amount: null }] }]);
  });

  test('self-funded: the entry she pays', () => {
    const sections = offerTerms({ deal_components: [] }, { costs: [{ kind: 'entry', paid_by: 'lala', amount: 250 }], deliverables: [] });
    expect(sections).toEqual([{ key: 'entry', title: 'Her investment', lines: [{ label: 'Entry, paid by Lala', detail: '', amount: 250 }] }]);
  });

  test('no deal: no terms', () => {
    expect(offerTerms({ name: 'Plain' })).toEqual([]);
  });

  test('termsKey changes when an amount changes, and only then', () => {
    const a = offerTerms({ deal_type: 'paid_appearance', appearance_fee: 500, is_paid: true });
    const b = offerTerms({ deal_type: 'paid_appearance', appearance_fee: 500, is_paid: true });
    const c = offerTerms({ deal_type: 'paid_appearance', appearance_fee: 750, is_paid: true });
    expect(termsKey(a)).toBe(termsKey(b));
    expect(termsKey(a)).not.toBe(termsKey(c));
  });
});

describe('the letter', () => {
  const sections = [{ key: 'fees', title: 'Compensation', lines: [{ label: 'Appearance fee', detail: '', amount: 500 }] }];

  test('a forced tool call; the terms are given, and the words are told to state no amount', async () => {
    mockCreate.mockResolvedValueOnce(tool(LETTER));
    const out = await writeOfferLetter(PARTNERSHIP, { sections });
    const req = mockCreate.mock.calls[0][0];
    expect(req.tool_choice).toEqual({ type: 'tool', name: 'write_offer_letter' });
    expect(req.messages[0].content).toContain('Appearance fee: 500 Prime Coins');
    expect(req.messages[0].content).toMatch(/write no coin amount at all/);
    expect(req.messages[0].content).toMatch(/follows the event's invitation/);
    expect(out).toMatchObject({ source: 'claude', letter: LETTER, checks: { amounts: { ok: true, invented: [] } } });
  });

  test('words naming an amount the terms do not hold are retried, then the no-AI letter is used', async () => {
    mockCreate.mockResolvedValue(tool({ ...LETTER, opportunity: 'We will pay you 900 Prime Coins.' }));
    const out = await writeOfferLetter(PARTNERSHIP, { sections });
    expect(mockCreate).toHaveBeenCalledTimes(2);
    expect(mockCreate.mock.calls[1][0].messages.at(-1).content).toMatch(/named 900 Prime Coins/);
    expect(out.source).toBe('fallback');
    expect(out.letter.opening).toMatch(/Maison Rue is pleased to offer you a formal partnership/);
    expect(out.checks.amounts.ok).toBe(true);
  });

  test('a budget refusal is thrown', async () => {
    mockCreate.mockRejectedValueOnce(Object.assign(new Error('budget'), { code: 'AI_BUDGET_EXCEEDED' }));
    await expect(writeOfferLetter(PARTNERSHIP, { sections })).rejects.toMatchObject({ code: 'AI_BUDGET_EXCEEDED' });
  });

  test('the no-AI letter is formal, names the event and is signed for the brand', () => {
    const l = fallbackLetter({ ...PARTNERSHIP, venue_name: 'The Glasshouse', event_date: '2026-11-12', dress_code: 'Black tie' });
    expect(l.greeting).toBe('Dear Lala,');
    expect(l.opportunity).toMatch(/at The Glasshouse on 2026-11-12/);
    expect(l.opportunity).toMatch(/The terms of this offer are set out below\./);
    expect(l).toMatchObject({ sender_name: 'Celeste Rue', sender_title: 'On behalf of Maison Rue' });
  });

  test('normalizeLetter keeps the letter fields only, trimmed and capped', () => {
    const l = normalizeLetter({ opening: '  Hi  ', opportunity: 'x'.repeat(2000), evil: 'no' });
    expect(l.opening).toBe('Hi');
    expect(l.opportunity).toHaveLength(1400);
    expect(l).not.toHaveProperty('evil');
    expect(Object.keys(l)).toEqual(['greeting', 'opening', 'opportunity', 'next_steps', 'closing', 'sender_name', 'sender_title']);
  });

  test('checkLetter: only the terms\' amounts may appear', () => {
    expect(checkLetter({ opening: 'A fee of 500 Prime Coins.' }, sections).amounts.ok).toBe(true);
    expect(checkLetter({ opening: 'A fee of 600 coins.' }, sections).amounts).toEqual({ ok: false, invented: [600] });
  });
});
