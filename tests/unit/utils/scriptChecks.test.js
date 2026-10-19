// ============================================================================
// Script checks that gave wrong answers, on the server (Script page audit,
// 2026-10-19). Coin lines in any form, and only in the closet beat; wear
// cues counted in the closet beat; beat 9 reads the Shopping list; `## Beat
// 5:` headers read by the parser; the show rules' voice and reveal checks.
// Pure: no database, no network.
// ============================================================================

const { scriptWithCoinLines } = require('../../../src/utils/scriptMoney');
const { scriptCoverage } = require('../../../src/utils/scriptCoverage');
const { todoModeAt } = require('../../../src/utils/scriptTodo');
const { scriptBeats } = require('../../../src/utils/scriptWear');
const { parseScript } = require('../../../src/utils/scriptBeatParser');
const { headerNumber, normalizeBeatHeaders } = require('../../../src/utils/beatLabelNumber');
const { voiceOffLines, revealCheck } = require('../../../src/utils/scriptShowRules');

const MONEY = { look: [{ id: 'jacket-1', name: 'Jacket', amount: 120 }, { id: 'bag-1', name: 'Bag', amount: 1200 }] };

describe('scriptWithCoinLines', () => {
  test('a coin line written in another form is not added twice', () => {
    for (const written of ['[STAT: coins: -120]', '[STAT: coins −120]', '[STAT: coins - 120]', '[STAT: coins -120, reputation +1]']) {
      const script = `## BEAT: 8 · Transformation Loop\n[UI:OPEN Closet]\n[WEAR: jacket-1]\n${written}`;
      expect(scriptWithCoinLines(script, MONEY)).toEqual({ script, added: 0 });
    }
    const thousands = '## BEAT: 8 · Transformation Loop\n[WEAR: bag-1]\n[STAT: coins -1,200]';
    expect(scriptWithCoinLines(thousands, MONEY)).toEqual({ script: thousands, added: 0 });
  });

  test('only the closet beat is charged: a wear cue in an earlier or later beat is not', () => {
    const script = [
      '## BEAT: 4 · Interruption Pulse 1', '[WEAR: jacket-1]', '',
      '## BEAT: 8 · Transformation Loop', '[UI:OPEN Closet]', '[WEAR: jacket-1]', '[WEAR: bag-1]', '',
      '## BEAT: 12 · Fashion Challenge', '[WEAR: bag-1]',
    ].join('\n');
    const out = scriptWithCoinLines(script, MONEY);
    expect(out.added).toBe(2);
    expect(out.script).toContain('## BEAT: 4 · Interruption Pulse 1\n[WEAR: jacket-1]\n\n## BEAT: 8');
    expect(out.script).toContain('[UI:OPEN Closet]\n[WEAR: jacket-1]\n[STAT: coins -120]\n[WEAR: bag-1]\n[STAT: coins -1200]');
    expect(out.script.endsWith('## BEAT: 12 · Fashion Challenge\n[WEAR: bag-1]')).toBe(true);
  });

  test('a script with no closet beat gets no coin line', () => {
    const script = '## BEAT: 12 · Fashion Challenge\n[WEAR: bag-1]';
    expect(scriptWithCoinLines(script, MONEY)).toEqual({ script, added: 0 });
  });

  test('closetNumber names the closet beat for one beat written on its own', () => {
    const beat = '## BEAT: 8 · Transformation Loop\n[WEAR: jacket-1]';
    expect(scriptWithCoinLines(beat, MONEY, { closetNumber: 8 }).added).toBe(1);
    const challenge = '## BEAT: 12 · Fashion Challenge\n[UI:OPEN Closet]\n[WEAR: jacket-1]';
    expect(scriptWithCoinLines(challenge, MONEY, { closetNumber: 8 }).added).toBe(0);
  });
});

describe('scriptCoverage wear cues', () => {
  test('a wear cue only in the Fashion Challenge is not the look put on in the closet', () => {
    const script = '## BEAT: 8 · Transformation Loop\n[UI:OPEN Closet]\nLala: yes\n\n## BEAT: 12 · Fashion Challenge\n[WEAR: jacket-1]';
    const wear = scriptCoverage(script, { lockedPieces: [{ id: 'jacket-1', name: 'Jacket' }] }).items.find((i) => i.kind === 'wear');
    expect(wear).toMatchObject({ beat: null, target: 8 });
  });
});

describe('todoModeAt', () => {
  test('beat 9, after the closet, reads the Shopping list even with the deal locked', () => {
    const beats = scriptBeats('## BEAT: 8 · Transformation Loop\n[UI:OPEN Closet]\n\n## BEAT: 9 · Reminder/Deadline\nMe: the list\n\n## BEAT: 10 · Event Travel\nMe: go');
    expect(todoModeAt(beats, 1, { dealLocked: true })).toEqual({ mode: 'shopping', source: 'auto' });
    expect(todoModeAt(beats, 2, { dealLocked: true })).toEqual({ mode: 'deal', source: 'auto' });
  });
});

describe('Beat N headers', () => {
  test('`## Beat 5: Reveal` is beat 5 to the parser and the tab', () => {
    expect(normalizeBeatHeaders('## Beat 5: Reveal')).toBe('## BEAT: 5 · Reveal');
    expect(headerNumber('Beat 4 · Pulse')).toBe(4);
    const parsed = parseScript('## Beat 4: Pulse\nMe: hi\n\n## Beat 5: Reveal\nMe: read it');
    expect(parsed.beats.length).toBe(2);
  });
});

describe('show rules on the server', () => {
  test('an acting note is not her thoughts, and VOICE_ACTIVATE turns her voice on', () => {
    expect(voiceOffLines(['Lala (nervously): hi'])).toEqual([0]);
    expect(voiceOffLines(['[UI:VOICE_ACTIVATE Lala]', 'Lala: hi'])).toEqual([]);
  });
  test('the letter shows only when it is brought up; Blog Index is not the login', () => {
    expect(revealCheck(['[UI:NOTIFY Mail: You are invited!]', '[UI:OPEN Blog Index]'])).toEqual({ login: [], invitation: false });
  });
});
