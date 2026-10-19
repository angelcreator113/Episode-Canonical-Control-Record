// ============================================================================
// Lala's coins in the script (Evoni, 2026-10-18): she starts the episode with
// the balance before it, each piece of the look comes off as it goes on, the
// event's own costs come off in the recap only, and beat 9 reads the approved
// shopping list. No database, no network.
// ============================================================================

const { moneyContext, scriptWithCoinLines } = require('../../../src/utils/scriptMoney');

const MONEY = {
  balanceBefore: 1900,
  look: [
    { id: 'jacket-1', name: 'Midnight Bloom Lace Peplum Jacket', amount: 120 },
    { id: 'bag-1', name: 'Crystal Constellation Bucket Minaudière', amount: 800 },
  ],
  recap: [{ label: 'Drinks × 2', amount: 100 }],
  covered: [{ label: 'Entry / ticket' }],
  income: [{ label: 'Content fee: Pulse video', amount: 439 }],
  shopping: {
    overlay: true,
    total: 920,
    lines: [
      { label: 'Statement jacket', pieces: ['Midnight Bloom Lace Peplum Jacket'], cost: 120, owned: false, filled: true, extra: false },
      { label: 'Shoes', pieces: ['Gold Strap Heels'], cost: 0, owned: true, filled: true, extra: false },
      { label: 'A scarf', pieces: [], cost: 0, owned: false, filled: false, extra: false },
      { label: 'Crystal Constellation Bucket Minaudière', pieces: ['Crystal Constellation Bucket Minaudière'], cost: 800, owned: false, filled: true, extra: true },
    ],
  },
};

describe('moneyContext', () => {
  const text = moneyContext(MONEY);
  test('she starts with the balance before the episode, and each piece comes off as it goes on', () => {
    expect(text).toContain("═══ LALA'S COINS ═══");
    expect(text).toContain('Lala starts this episode with 1,900 coins');
    expect(text).toContain('- Midnight Bloom Lace Peplum Jacket [WEAR: jacket-1]: [STAT: coins -120]');
    expect(text).toContain('- Crystal Constellation Bucket Minaudière [WEAR: bag-1]: [STAT: coins -800]');
    expect(text).toContain('After the look she has 980 coins');
  });
  test("the event's costs come off in the recap only; covered costs and what she is owed never do", () => {
    expect(text).toContain('Recap Panel (Beat 13) only, never earlier: Drinks × 2 [STAT: coins -100]');
    expect(text).toContain('never charged to Lala: Entry / ticket');
    expect(text).toContain('not paid in this episode (it is known next episode); never a coin line: Content fee: Pulse video (439)');
  });
  test('beat 9 reads the approved shopping list overlay, line by line', () => {
    expect(text).toContain('═══ APPROVED SHOPPING LIST ═══');
    expect(text).toContain('- Statement jacket: Midnight Bloom Lace Peplum Jacket — 120 coins');
    expect(text).toContain('- Shoes: Gold Strap Heels — already hers');
    expect(text).toContain('- A scarf — not filled');
    expect(text).toContain('- Also: Crystal Constellation Bucket Minaudière — 800 coins');
    expect(text).toContain('Total: 920 coins.');
    expect(text).toContain('Beat 9 (Reminder/Deadline): JustAWoman reads off this approved list on screen, [UI:DISPLAY Shopping list]');
    expect(text).toContain('[UI:HIDE Shopping list]');
  });
  test('without an approved list, beat 9 reads her to-do list; without money, nothing', () => {
    expect(moneyContext({ ...MONEY, shopping: null })).toContain('No shopping list is approved for this event');
    expect(moneyContext(null)).toBe('');
  });
});

describe('scriptWithCoinLines', () => {
  const script = [
    '## BEAT: 8 · Transformation Loop', '[UI:OPEN Closet]', 'Lala: this jacket', '[WEAR: jacket-1]', 'Me: and the bag', '[WEAR: bag-1]', '[STAT: coins -800]', '[WEAR: owned-1]',
    '', '## BEAT: 12 · Fashion Challenge', '[WEAR: jacket-1]',
  ].join('\n');
  test("adds a costing piece's coin line after its wear cue, once, where it is missing", () => {
    const out = scriptWithCoinLines(script, MONEY);
    expect(out.added).toBe(1);
    expect(out.script).toContain('[WEAR: jacket-1]\n[STAT: coins -120]\nMe: and the bag');
    expect(out.script).toContain('[WEAR: bag-1]\n[STAT: coins -800]\n[WEAR: owned-1]\n\n## BEAT: 12');
    // Worn again in the challenge: charged once.
    expect(out.script.endsWith('## BEAT: 12 · Fashion Challenge\n[WEAR: jacket-1]')).toBe(true);
  });
  test('an approved beat is left as it is, and nothing changes without costs', () => {
    expect(scriptWithCoinLines(script, MONEY, { skip: [0] })).toEqual({ script, added: 0 });
    expect(scriptWithCoinLines(script, { look: [] })).toEqual({ script, added: 0 });
  });
});
