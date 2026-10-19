// ============================================================================
// The show's rules, checked in the script (Evoni, 2026-10-17 and
// 2026-10-18), on the server: beat 8's coin lines, beat 9 reads the
// approved shopping list, beat 12 judged on four stats, beat 13 Lala's line
// and the event's costs, JustAWoman watches in silence once. Each finding is
// a coverage item the fix pass asks the writer for. Pure; no database.
// ============================================================================

const { scriptRuleFindings, scriptRuleItems, coinChange, statEntries } = require('../../../src/utils/scriptRuleChecks');
const { splitScriptBeats } = require('../../../src/utils/scriptBeatLocks');
const { CANONICAL_BEATS } = require('../../../src/constants/canonicalBeats');

const MONEY = { look: [{ id: 'p1', name: 'Velvet Blazer', amount: 120 }], recap: [{ label: 'Entry fee', amount: 45 }], income: [] };
const at = (number, ...lines) => ({ number, lines });
const find = (found, key) => found.find((f) => f.key === key);
const beat = (n, ...lines) => [`## BEAT: ${n} · ${CANONICAL_BEATS[n - 1].name}`, ...lines].join('\n');

describe('reading coin lines', () => {
  test('tolerant of the colon, a typographic minus, thousands and several stats', () => {
    expect(coinChange('[STAT: coins -50]')).toBe(-50);
    expect(coinChange('[STAT: coins: -50]')).toBe(-50);
    expect(coinChange('[STAT: coins −1,200]')).toBe(-1200);
    expect(coinChange('[STAT: stress +1, coins -50]')).toBe(-50);
    expect(coinChange('[STAT: stress +1]')).toBeNull();
    expect(statEntries('Me: hi')).toBeNull();
  });
});

describe('each rule passes and fails', () => {
  test('beat 8: a costing piece without its coin line, or with the wrong amount', () => {
    expect(find(scriptRuleFindings([at(8, '[WEAR: p1]', '[STAT: coins -120]')], { money: MONEY }), 'beat8').ok).toBe(true);
    expect(find(scriptRuleFindings([at(8, '[WEAR: p1]', 'Me: wow', 'Lala: yes', '[STAT: coins -120]')], { money: MONEY }), 'beat8-p1').ok).toBe(false);
    expect(find(scriptRuleFindings([at(8, '[WEAR: p1]', '[STAT: coins -100]')], { money: MONEY }), 'beat8-p1').text).toContain('comes off as -100 coins');
  });
  test('beat 9: the approved shopping list, shown and put away', () => {
    expect(find(scriptRuleFindings([at(9, '[UI:DISPLAY Shopping list]', '[UI:HIDE Shopping list]')], { shoppingApproved: true }), 'beat9').ok).toBe(true);
    expect(find(scriptRuleFindings([at(9, 'Me: to do')], { shoppingApproved: true }), 'beat9').ok).toBe(false);
    expect(find(scriptRuleFindings([at(9, 'Me: to do')], { shoppingApproved: false }), 'beat9')).toBeUndefined();
  });
  test('beat 12: four stats, no coins', () => {
    expect(find(scriptRuleFindings([at(12, '[STAT: reputation +1, brand_trust +1, influence +1, stress -1]')]), 'beat12').ok).toBe(true);
    const found = scriptRuleFindings([at(12, '[STAT: reputation +1]', '[STAT: coins -20]')]);
    expect(find(found, 'beat12').ok).toBe(false);
    expect(find(found, 'beat12-coins').ok).toBe(false);
  });
  test("beat 13: Lala's line; the event's costs there and nowhere else", () => {
    expect(find(scriptRuleFindings([at(13, 'Lala: that was us')]), 'beat13').ok).toBe(true);
    expect(find(scriptRuleFindings([at(13, 'Me: done')]), 'beat13').ok).toBe(false);
    const found = scriptRuleFindings([at(5, '[STAT: coins -45]'), at(13, 'Lala: ok')], { money: MONEY });
    expect(find(found, 'coins-5').text).toBe('Beat 5: the Entry fee comes off here [STAT: coins -45]; it comes off in beat 13 only.');
    expect(find(found, 'beat13-costs').ok).toBe(false);
    expect(find(scriptRuleFindings([at(13, 'Lala: ok', '[STAT: coins -45]')], { money: MONEY }), 'beat13-costs').ok).toBe(true);
  });
  test('JustAWoman watches in silence at least once, on a whole script', () => {
    expect(find(scriptRuleFindings([at(2, '(JustAWoman watches, silent.)')], { complete: true }), 'silent').ok).toBe(true);
    expect(find(scriptRuleFindings([at(2, 'Me: wow')], { complete: true }), 'silent').ok).toBe(false);
  });
});

describe('coverage items', () => {
  test('none unless the rules are given; each missing one targets its beat', () => {
    const script = CANONICAL_BEATS.map((c) => beat(c.number, c.number === 8 ? '[WEAR: p1]' : 'Me: hi')).join('\n\n');
    const { beats } = splitScriptBeats(script);
    expect(scriptRuleItems(beats)).toEqual([]);
    const items = scriptRuleItems(beats, { money: MONEY, shoppingApproved: true });
    const missing = items.filter((i) => i.beat === null).map((i) => [i.rule, i.target]);
    expect(missing).toEqual([['beat8-p1', 8], ['beat9', 9], ['beat12', 12], ['beat13', 13], ['beat13-costs', 13], ['silent', 11]]);
    expect(items.every((i) => i.kind === 'rule')).toBe(true);
    expect(items.find((i) => i.rule === 'beat8-p1').ask).toBe('Right after the [WEAR: p1] line, write the coin line for "Velvet Blazer" on its own line, exactly: [STAT: coins -120]');
  });
});
