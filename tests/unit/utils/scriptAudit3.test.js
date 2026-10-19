// ============================================================================
// Script page audit 3 (2026-10-19), the server's side: a piece is charged
// once, the show rules and the coin pass read every header spelling, and the
// closet is the screen named Closet. No database, no network.
// ============================================================================

const { scriptWithCoinLines } = require('../../../src/utils/scriptMoney');
const { scriptWithShowRules } = require('../../../src/utils/scriptShowRules');
const { scriptCoverage } = require('../../../src/utils/scriptCoverage');
const { closetIndex, scriptBeats } = require('../../../src/utils/scriptWear');

const MONEY = { look: [{ id: 'p1', name: 'Gold Slip', amount: 120 }], recap: [], income: [] };

describe('Script page audit 3: the server', () => {
  test('a coin line three lines after its [WEAR] is its own; no second one goes in', () => {
    const script = '## BEAT: 8 · Transformation Loop\n[UI:OPEN Closet]\n[WEAR: p1]\nLala: yes.\nMe: she loves it.\n[STAT: coins -120]';
    expect(scriptWithCoinLines(script, MONEY)).toEqual({ script, added: 0 });
  });

  test.each([
    ['## Beat 6: Strategic Reaction'],
    ['### BEAT: 6 · Strategic Reaction'],
    ['**## BEAT: 6 · Strategic Reaction**'],
  ])('%s gets her voice click', (header) => {
    expect(scriptWithShowRules(`${header}\nLala: We need a look.`, {}).voice_clicks).toBe(1);
  });

  test('"Closet Sale Alert" in beat 7 is not the closet; the look goes on in beat 8', () => {
    const script = '## BEAT: 7 · Pulse\n[UI:OPEN Closet Sale Alert]\n\n## BEAT: 8 · Loop\n[UI:OPEN Closet]\n[WEAR: p1]';
    expect(closetIndex(scriptBeats(script))).toBe(1);
    const wear = scriptCoverage(script, { lockedPieces: [{ id: 'p1', name: 'Gold Slip' }] }).items.find((i) => i.kind === 'wear');
    expect(wear).toMatchObject({ beat: 8, target: 8 });
  });
});
