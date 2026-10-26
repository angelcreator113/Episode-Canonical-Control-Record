/**
 * services/seasonAiHelpers, the parts that need no database: reading the
 * answer, cleaning what Evoni's page sends, turning a suggestion the season
 * cannot take into a note, the prompts, and the Focus call with a stub
 * client (one call; a budget refusal is never retried).
 */
const {
  readJson, cleanItems, cleanSuggestions, slotEditable, nextStepPrompt, focusPrompt, pitchPrompt, focusToday, SIDE_MODELS, MODELS,
} = require('../../../src/services/seasonAiHelpers');

const say = (text) => ({ content: [{ type: 'text', text }] });

describe('seasonAiHelpers', () => {
  beforeEach(() => jest.spyOn(console, 'error').mockImplementation(() => {}));
  afterEach(() => jest.restoreAllMocks());

  test('the models: Haiku for the side calls, the house model for the rest', () => {
    expect(SIDE_MODELS).toEqual(['claude-haiku-4-5-20251001']);
    expect(MODELS).toEqual(['claude-sonnet-4-6']);
  });

  test('readJson finds the object around any words, and throws when there is none', () => {
    expect(readJson(say('Here you go: {"line": "Do E3."} Thanks'))).toEqual({ line: 'Do E3.' });
    expect(() => readJson(say('no json'))).toThrow('not JSON');
  });

  test('cleanItems keeps title and detail, capped and clipped', () => {
    const many = Array.from({ length: 20 }, (_, i) => ({ kind: 'slots', title: `Item ${i} ${'x'.repeat(400)}`, detail: 'd', link: { tab: 'x' } }));
    const out = cleanItems(many, 12);
    expect(out).toHaveLength(12);
    expect(out[0].title.length).toBeLessThanOrEqual(300);
    expect(out[0]).not.toHaveProperty('link');
    expect(cleanItems([null, {}, { title: '' }], 12)).toEqual([]);
  });

  test('slotEditable follows the intention rule', () => {
    expect(slotEditable({})).toBe(true);
    expect(slotEditable({ accepted_at: new Date() })).toBe(false);
    expect(slotEditable({ episode_evaluation_status: 'accepted', episode_id: 'e' })).toBe(false);
    expect(slotEditable({ locked_at: new Date() })).toBe(false);
    expect(slotEditable({ locked_at: new Date(), episode_id: 'e' })).toBe(true);
  });

  test('cleanSuggestions: a full slot, a done slot or an out-of-order twist is a note; unknown threads are dropped', () => {
    const slots = [
      { id: 's1', slot_number: 1, accepted_at: new Date() },
      { id: 's2', slot_number: 2, story_purposes: [{ text: 'a', primary: true }, { text: 'b' }, { text: 'c' }] },
      { id: 's3', slot_number: 3 },
      { id: 's4', slot_number: 4 },
    ];
    const out = cleanSuggestions([
      { kind: 'purpose', slot: 3, text: 'Bring Ana back', why: 'gap', thread_id: 'nope' },
      { kind: 'purpose', slot: 2, text: 'Full', why: 'x' },
      { kind: 'purpose', slot: 1, text: 'Done', why: 'x' },
      { kind: 'twist', slot: 3, payoff_slot: 4, text: 'Ring', title: 'Ring' },
      { kind: 'twist', slot: 4, payoff_slot: 3, text: 'Backwards' },
      { kind: 'twist', slot: 3, text: 'No payoff yet' },
      { kind: 'other', text: 'Call her' },
      { kind: 'note', text: '' },
    ], { slots, threads: [{ id: 't1' }] });
    expect(out.map((s) => s.kind)).toEqual(['purpose', 'note', 'note', 'twist', 'note', 'twist']);
    expect(out[0]).toMatchObject({ slot_id: 's3', thread_id: null });
    expect(out[1].cannot_apply).toMatch(/three story purposes/);
    expect(out[3]).toMatchObject({ slot_id: 's3', payoff_slot_id: 's4' });
    expect(out[5]).toMatchObject({ slot_id: 's3', payoff_slot_id: null });
  });

  test('the prompts carry what they are given and ask for JSON', () => {
    const items = [{ title: 'E3 releases in 2 days.', detail: 'Thumbnail' }];
    const next = nextStepPrompt({ season: 'Season 2: Big', items, fit: { slot_number: 7, events: [{ name: 'Fabric and Form', reason: 'Moves Style' }] } });
    expect(next).toContain('- E3 releases in 2 days. (Thumbnail)');
    expect(next).toContain('E7');
    expect(next).toContain('- Fabric and Form: Moves Style');
    expect(next).toContain('{"sentences"');
    expect(focusPrompt([{ name: 'Lala · Season 2', items }])).toContain('Lala · Season 2:\n- E3 releases');
    const pitch = pitchPrompt({ arc: { season_number: 2, title: 'Big', logline: 'Lala goes big.', phases: [] }, slots: [{ slot_number: 1, event_name: 'Gala' }] });
    expect(pitch).toContain('Logline: Lala goes big.');
    expect(pitch).toContain('E1: Gala');
  });

  test('focusToday: one call, one line; a budget refusal is a plain 429, not retried', async () => {
    const create = jest.fn().mockResolvedValue(say('{"line": "Lock E3 today."}'));
    const seasons = [{ show: 'Lala', season_number: 2, items: [{ title: 'E3 releases tomorrow.' }] }];
    await expect(focusToday({ seasons, anthropic: { messages: { create } } })).resolves.toEqual({ line: 'Lock E3 today.' });
    expect(create).toHaveBeenCalledTimes(1);
    expect(create.mock.calls[0][0]).toMatchObject({ model: 'claude-haiku-4-5-20251001', max_tokens: 120 });

    const refused = jest.fn().mockRejectedValue(Object.assign(new Error('AI daily budget exceeded.'), { code: 'AI_BUDGET_EXCEEDED' }));
    await expect(focusToday({ seasons, anthropic: { messages: { create: refused } } })).rejects.toMatchObject({ status: 429, code: 'AI_BUDGET_EXCEEDED' });
    expect(refused).toHaveBeenCalledTimes(1);
  });

  test('focusToday with nothing waiting: a 400 and no call', async () => {
    const create = jest.fn();
    await expect(focusToday({ seasons: [{ show: 'Lala', items: [] }], anthropic: { messages: { create } } })).rejects.toMatchObject({ status: 400 });
    expect(create).not.toHaveBeenCalled();
  });
});
