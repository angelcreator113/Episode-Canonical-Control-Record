/**
 * The show's rules, checked in the script (Evoni, 2026-10-17 and
 * 2026-10-18): beat 8's coin lines, beat 9 reads the approved shopping
 * list, beat 12 judged on four stats, beat 13 Lala's line and the event's
 * costs, JustAWoman watches in silence once. The server's copy
 * (src/utils/scriptRuleChecks.js) is the same code.
 */
import { describe, test, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import * as rules from './scriptRuleChecks';
import { scriptHealth } from './scriptHealth';

const require = createRequire(import.meta.url);
const server = require('../../../src/utils/scriptRuleChecks.js');

const MONEY = {
  look: [{ id: 'p1', name: 'Velvet Blazer', amount: 120 }, { id: 'p2', name: 'Gold Heels', amount: 80 }],
  recap: [{ label: 'Entry fee', amount: 45 }],
  income: [{ label: 'Content fee', amount: 300 }],
};
const at = (number, ...lines) => ({ id: `beat-${number}`, number, lines, approved: false });
const find = (found, key) => found.find((f) => f.key === key);

describe('coin lines, read tolerantly', () => {
  test('coins -50, coins: -50, a typographic minus, -1,200 and several stats in one tag', () => {
    expect(rules.coinChange('[STAT: coins -50]')).toBe(-50);
    expect(rules.coinChange('[STAT: coins: -50]')).toBe(-50);
    expect(rules.coinChange('[STAT: coins −50]')).toBe(-50);
    expect(rules.coinChange('[STAT: coins -1,200]')).toBe(-1200);
    expect(rules.coinChange('[STAT: coins +300]')).toBe(300);
    expect(rules.coinChange('[STAT: reputation +2, coins -50]')).toBe(-50);
    expect(rules.coinChange('[STAT: reputation +2]')).toBeNull();
    expect(rules.coinChange('Lala: coins -50')).toBeNull();
    expect(rules.statEntries('[STAT: reputation +2 brand trust: -1 stress +3]'))
      .toEqual([{ stat: 'reputation', value: 2 }, { stat: 'brand_trust', value: -1 }, { stat: 'stress', value: 3 }]);
  });
});

describe('beat 8: each piece that costs her comes off as it goes on', () => {
  test('each costing piece followed by its own coin line passes', () => {
    const found = rules.scriptRuleFindings([at(8, '[UI:OPEN Closet]', '[WEAR: p1]', '[STAT: coins -120]', 'Me: next', '[WEAR: p2]', 'Lala: love', '[STAT: coins: -80]')], { money: MONEY });
    expect(find(found, 'beat8')).toMatchObject({ ok: true, beat: 8 });
    expect(found.some((f) => f.key.startsWith('beat8-'))).toBe(false);
  });
  test('a piece worn without its coin line, or with the wrong amount, is flagged', () => {
    const found = rules.scriptRuleFindings([at(8, '[WEAR: p1]', 'Me: gorgeous', 'Lala: yes', '[STAT: coins -120]', '[WEAR: p2]', '[STAT: coins -60]')], { money: MONEY });
    expect(find(found, 'beat8-p1')).toMatchObject({ ok: false, beat: 8, text: 'Beat 8: the Velvet Blazer goes on without its coin line [STAT: coins -120].' });
    expect(find(found, 'beat8-p1').ask).toContain('[STAT: coins -120]');
    expect(find(found, 'beat8-p2')).toMatchObject({ ok: false, text: 'Beat 8: the Gold Heels comes off as -60 coins; it costs [STAT: coins -80].' });
    expect(find(found, 'beat8')).toBeUndefined();
  });
  test("the next piece's coin line is not this piece's", () => {
    const found = rules.scriptRuleFindings([at(8, '[WEAR: p1]', '[WEAR: p2]', '[STAT: coins -80]')], { money: MONEY });
    expect(find(found, 'beat8-p1').text).toContain('without its coin line');
    expect(find(found, 'beat8-p2')).toBeUndefined();
  });
  test('no money read, no beat 8 check', () => {
    expect(rules.scriptRuleFindings([at(8, '[WEAR: p1]')], {}).some((f) => f.key.startsWith('beat8'))).toBe(false);
  });
});

describe('beat 9 reads the approved shopping list', () => {
  test('DISPLAY then HIDE passes; neither, or no HIDE, is flagged; only when the list is approved', () => {
    expect(find(rules.scriptRuleFindings([at(9, '[UI:DISPLAY Shopping list]', 'Me: the blazer, 120', '[UI:HIDE Shopping list]')], { shoppingApproved: true }), 'beat9').ok).toBe(true);
    expect(find(rules.scriptRuleFindings([at(9, 'Me: reminders')], { shoppingApproved: true }), 'beat9'))
      .toMatchObject({ ok: false, text: 'Beat 9: the approved shopping list never comes up: [UI:DISPLAY Shopping list].' });
    expect(find(rules.scriptRuleFindings([at(9, '[UI:DISPLAY Shopping list]')], { shoppingApproved: true }), 'beat9').text).toContain('[UI:HIDE Shopping list]');
    expect(find(rules.scriptRuleFindings([at(9, 'Me: reminders')], { shoppingApproved: false }), 'beat9')).toBeUndefined();
    expect(find(rules.scriptRuleFindings([at(9, 'Me: reminders')], {}), 'beat9')).toBeUndefined();
  });
});

describe('beat 12 is judged on her standing, never on money', () => {
  test('the four stats pass; a missing one and any coin line are flagged', () => {
    const four = ['[STAT: reputation +2]', '[STAT: brand_trust +1]', '[STAT: influence +1]', '[STAT: stress -1]'];
    expect(find(rules.scriptRuleFindings([at(12, ...four)]), 'beat12').ok).toBe(true);
    const short = rules.scriptRuleFindings([at(12, '[STAT: reputation +2, influence +1]', '[STAT: coins -50]')]);
    expect(find(short, 'beat12')).toMatchObject({ ok: false, text: "Beat 12: the room's verdict doesn't move her brand_trust, stress: [STAT: brand_trust ±n] [STAT: stress ±n]." });
    expect(find(short, 'beat12-coins')).toMatchObject({ ok: false, text: 'Beat 12: a coin line [STAT: coins -50]; the challenge is judged on her standing, never on money.' });
  });
});

describe("beat 13: Lala's line, and the event's costs there only", () => {
  test('Lala says how it feels; her thoughts or no line are flagged', () => {
    expect(find(rules.scriptRuleFindings([at(13, 'Lala: that felt like me')]), 'beat13').ok).toBe(true);
    expect(find(rules.scriptRuleFindings([at(13, 'Lala (V.O.): wow')]), 'beat13'))
      .toMatchObject({ ok: false, text: 'Beat 13: Lala never says how the outcome feels.' });
  });
  test('the event costs come off in beat 13; anywhere else, or her pay, is flagged', () => {
    const ok = rules.scriptRuleFindings([at(8, '[WEAR: p1]', '[STAT: coins -120]'), at(13, 'Lala: worth it', '[STAT: coins -45]')], { money: MONEY });
    expect(find(ok, 'beat13-costs').ok).toBe(true);
    expect(ok.some((f) => f.key.startsWith('coins-'))).toBe(false);
    const off = rules.scriptRuleFindings([
      at(4, '[STAT: coins -45]'), at(6, '[STAT: coins -10]'),
      at(8, '[WEAR: p1]', '[STAT: coins -120]', '[STAT: coins -45]'),
      at(13, 'Lala: paid', '[STAT: coins +300]'),
    ], { money: MONEY });
    expect(find(off, 'coins-4').text).toBe('Beat 4: the Entry fee comes off here [STAT: coins -45]; it comes off in beat 13 only.');
    expect(find(off, 'coins-6').text).toBe("Beat 6: a coin line [STAT: coins -10]; her coins change only in beat 8 (the look) and beat 13 (the event's costs).");
    expect(find(off, 'coins-8').text).toContain('the Entry fee comes off here');
    expect(find(off, 'coins-13').text).toBe('Beat 13: a coin line pays her [STAT: coins +300]; what she is owed is not paid in this episode.');
    expect(find(off, 'beat13-costs')).toMatchObject({ ok: false, text: "Beat 13: the Entry fee [STAT: coins -45] doesn't come off." });
  });
});

describe('JustAWoman on camera: she watches in silence at least once', () => {
  test('judged on a whole script only', () => {
    expect(find(rules.scriptRuleFindings([at(3, '(JustAWoman watches, silent.)')], { complete: true }), 'silent')).toMatchObject({ ok: true, beat: 11 });
    expect(find(rules.scriptRuleFindings([at(3, 'Me: (stunned silence)')], { complete: true }), 'silent').ok).toBe(true);
    expect(find(rules.scriptRuleFindings([at(3, 'Me: "silent night"')], { complete: true }), 'silent').ok).toBe(false);
    expect(find(rules.scriptRuleFindings([at(3, 'Me: hi')], { complete: false }), 'silent')).toBeUndefined();
  });
});

describe('the tab reads its money and the shopping list', () => {
  test("the Money page's lines sorted as the writer's copy sorts them", () => {
    const data = { lines: [
      { look: true, source: { id: 7 }, label: 'Velvet Blazer', amount: 120 },
      { look: true, source: { id: 8 }, label: 'Owned Bag', amount: 0 },
      { kind: 'expense', label: 'Entry fee', amount: 45 },
      { kind: 'expense', label: 'Hair', amount: 30, covered: true },
      { kind: 'expense', label: 'Bonus spend', amount: 10, conditional: true },
      { kind: 'income', label: 'Content fee', amount: 300 },
    ] };
    expect(rules.scriptMoneyFrom(data)).toEqual({
      look: [{ id: '7', name: 'Velvet Blazer', amount: 120 }],
      recap: [{ label: 'Entry fee', amount: 45 }],
      income: [{ label: 'Content fee', amount: 300 }],
    });
    expect(rules.scriptMoneyFrom([])).toBeNull();
    expect(rules.scriptMoneyFrom(null)).toBeNull();
  });
  test('whether the shopping list is approved: from the event, null when not read', () => {
    expect(rules.shoppingListApproved(null)).toBeNull();
    expect(rules.shoppingListApproved({ canon_consequences: { documents: { shopping_list: { status: 'approved' } } } })).toBe(true);
    expect(rules.shoppingListApproved({ canon_consequences: JSON.stringify({ documents: { shopping_list: { status: 'draft' } } }) })).toBe(false);
    expect(rules.shoppingListApproved({ canon_consequences: {} })).toBe(false);
  });
});

describe('"Ready to film?" rows', () => {
  const canonical = Array.from({ length: 14 }, (_, i) => ({ number: i + 1, name: `B${i + 1}` }));
  test('each rule is a row on its beat; none without the rules read', () => {
    const beats = canonical.map((c) => at(c.number, 'Me: hi'));
    beats[7] = at(8, '[UI:OPEN Closet]', '[WEAR: p1]', 'Me: yes');
    const rows = scriptHealth({ beats, canonical, rules: { money: MONEY, shoppingApproved: true } });
    expect(rows.find((r) => r.key === 'rule-beat8-p1')).toEqual({ key: 'rule-beat8-p1', ok: false, beatId: 'beat-8', text: 'Beat 8: the Velvet Blazer goes on without its coin line [STAT: coins -120].' });
    expect(rows.find((r) => r.key === 'rule-beat9')).toMatchObject({ ok: false, beatId: 'beat-9' });
    expect(rows.find((r) => r.key === 'rule-beat12')).toMatchObject({ ok: false, beatId: 'beat-12' });
    expect(rows.find((r) => r.key === 'rule-beat13')).toMatchObject({ ok: false, beatId: 'beat-13' });
    expect(rows.find((r) => r.key === 'rule-beat13-costs')).toMatchObject({ ok: false, beatId: 'beat-13' });
    expect(rows.find((r) => r.key === 'rule-silent')).toMatchObject({ ok: false, beatId: 'beat-11' });
    // Before "approved" and "saved", as the other checks are.
    expect(rows.findIndex((r) => r.key === 'rule-silent')).toBeLessThan(rows.findIndex((r) => r.key === 'approved'));
    expect(scriptHealth({ beats, canonical }).some((r) => r.key.startsWith('rule-'))).toBe(false);
    // No money read: no coin rows, the other rules still.
    const noMoney = scriptHealth({ beats, canonical, rules: { money: null, shoppingApproved: null } });
    expect(noMoney.some((r) => /^rule-(beat8|beat9|coins|beat13-costs)/.test(r.key))).toBe(false);
    expect(noMoney.some((r) => r.key === 'rule-beat12')).toBe(true);
  });
});

test("the server's copy is the same code and finds the same", () => {
  const shared = (text) => text.slice(text.search(/^\/\/ BEGIN SHARED$/m), text.search(/^\/\/ END SHARED$/m));
  const here = readFileSync(require.resolve('./scriptRuleChecks.js'), 'utf8');
  const there = readFileSync(require.resolve('../../../src/utils/scriptRuleChecks.js'), 'utf8');
  expect(shared(here).length).toBeGreaterThan(100);
  expect(shared(there)).toBe(shared(here));
  const beats = [at(8, '[WEAR: p1]'), at(12, '[STAT: coins -5]'), at(13, 'Me: hi')];
  expect(server.scriptRuleFindings(beats, { money: MONEY, complete: true })).toEqual(rules.scriptRuleFindings(beats, { money: MONEY, complete: true }));
});
