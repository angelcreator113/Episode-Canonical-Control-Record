// ============================================================================
// The free fixes the paid fix pass used to be asked for (Script page audit 3,
// 2026-10-19): a beat 8 coin line with the wrong amount, a + coin line, and
// the phone in the cutscene (beats 11-13) are mended in code, never in an
// approved beat. Pure; no database, no network.
// ============================================================================

const { scriptWithAutoFixes } = require('../../../src/utils/scriptAutoFixes');

const MONEY = { balanceBefore: 1000, look: [{ id: 'w1', name: 'Gold dress', amount: 300 }, { id: 'w2', name: 'Pearl heels', amount: 100 }], recap: [{ label: 'Entry', amount: 150 }] };
const script = (beats) => Object.entries(beats).map(([n, body]) => `## BEAT: ${n}\n${body}`).join('\n\n');

test('a wrong coin amount right after a costing piece is set to its cost', () => {
  const s = script({ 8: '[UI:OPEN Closet]\nMe: the dress\n[WEAR: w1]\n[STAT: coins -250]\nMe: heels\n[WEAR: w2]\n[STAT: coins -100]' });
  const out = scriptWithAutoFixes(s, MONEY);
  expect(out.coin_amounts).toBe(1);
  expect(out.script).toContain('[WEAR: w1]\n[STAT: coins -300]\nMe: heels');
  expect(out.script).toContain('[WEAR: w2]\n[STAT: coins -100]');
});

test('the next piece\'s coin line is never taken for this piece\'s', () => {
  const s = script({ 8: '[UI:OPEN Closet]\n[WEAR: w1]\n[WEAR: w2]\n[STAT: coins -100]' });
  const out = scriptWithAutoFixes(s, MONEY);
  expect(out.coin_amounts).toBe(0);
  expect(out.script).toBe(s);
});

test('a + coin line is taken out in any beat; a coin line with other stats is left for the writer', () => {
  const s = script({ 13: '[UI:DISPLAY Stats Panel]\nLala: wow\n[STAT: coins -150]\n[STAT: coins +200]', 14: 'Me: paid?\n[STAT: coins +50, reputation +1]' });
  const out = scriptWithAutoFixes(s, null);
  expect(out.plus_coins).toBe(1);
  expect(out.script).not.toContain('[STAT: coins +200]');
  expect(out.script).toContain('[STAT: coins -150]');
  expect(out.script).toContain('[STAT: coins +50, reputation +1]');
});

test('the phone in the cutscene is taken out; its overlays stay, and beat 14 keeps its phone', () => {
  const s = script({
    11: 'Mira: welcome\n[UI:CLICK Voice Icon]\nLala: hi\n[UI:SHOW phone]\n[UI:OPEN Messages]',
    13: '[UI:DISPLAY Stats Panel]\nLala: done\n[UI:HIDE Stats Panel]',
    14: '[UI:CLICK Voice Icon]\nLala: next',
  });
  const out = scriptWithAutoFixes(s, null);
  expect(out.cutscene_lines).toBe(3);
  expect(out.script).toContain('## BEAT: 11\nMira: welcome\nLala: hi');
  expect(out.script).not.toMatch(/## BEAT: 11[\s\S]*\[UI:(CLICK|SHOW|OPEN)[\s\S]*## BEAT: 13/);
  expect(out.script).toContain('[UI:DISPLAY Stats Panel]\nLala: done\n[UI:HIDE Stats Panel]');
  expect(out.script).toContain('## BEAT: 14\n[UI:CLICK Voice Icon]\nLala: next');
});

test('approved beats are never changed', () => {
  const s = script({ 8: '[UI:OPEN Closet]\n[WEAR: w1]\n[STAT: coins -250]', 11: '[UI:CLICK Voice Icon]\nLala: hi', 13: '[STAT: coins +200]' });
  const out = scriptWithAutoFixes(s, MONEY, { skip: [0, 1, 2] });
  expect(out.script).toBe(s);
  expect(out.coin_amounts + out.plus_coins + out.cutscene_lines).toBe(0);
});

test('one beat written on its own is read by its own number', () => {
  const out = scriptWithAutoFixes('## BEAT: 8 · Transformation Loop\n[WEAR: w1]\n[STAT: coins -1]', MONEY, { closetNumber: 8 });
  expect(out.script).toBe('## BEAT: 8 · Transformation Loop\n[WEAR: w1]\n[STAT: coins -300]');
});

test('a clean script comes back as it was', () => {
  const s = script({ 8: '[UI:OPEN Closet]\n[WEAR: w1]\n[STAT: coins -300]', 13: 'Lala: ok\n[STAT: coins -150]' });
  expect(scriptWithAutoFixes(s, MONEY)).toEqual({ script: s, coin_amounts: 0, plus_coins: 0, cutscene_lines: 0 });
});
