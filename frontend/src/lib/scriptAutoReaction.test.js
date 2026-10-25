/**
 * Lala's automatic reactions (Evoni, 2026-10-25): `Lala (automatic
 * reaction): …` and `Lala (auto): …` are played by the game. They are Lala
 * (auto: true), no voice click, no voice clip, and an on-screen cue on the
 * teleprompter. The server reads them the same (src/utils/scriptShowRules,
 * src/utils/scriptBeatParser).
 */
import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';
import { speakerLine, isAutoNote } from './scriptSpeaker';
import { readLine } from './scriptExport';
import { teleprompterLines, teleprompterIndexMap, teleprompterScript } from './teleprompterLines';
import { voiceOffLines } from './scriptShowRules';
import { scriptHealth } from './scriptHealth';

const require = createRequire(import.meta.url);
const server = require('../../../src/utils/scriptShowRules.js');
const { parseScript } = require('../../../src/utils/scriptBeatParser.js');

describe('the speaker parser', () => {
  it.each(['(auto)', '(Auto)', '(automatic reaction)', '(auto-reaction)', '(Automatic)', '( auto reaction )'])('%s is an automatic reaction', (note) => {
    expect(isAutoNote(note)).toBe(true);
    expect(speakerLine(`Lala ${note}: Ooh!`)).toMatchObject({ speaker: 'Lala', auto: true, words: 'Ooh!' });
  });

  it('only on Lala, and not for other notes', () => {
    expect(speakerLine('Lala (V.O.): hmm').auto).toBe(false);
    expect(speakerLine('Lala: hi').auto).toBe(false);
    expect(speakerLine('Marcus (auto): hi').auto).toBe(false);
    expect(speakerLine('LALA (AUTO): hi').auto).toBe(true);
    expect(isAutoNote('(automatically)')).toBe(false);
  });

  it('the export keeps the flag', () => {
    expect(readLine('Lala (auto): Wow')).toMatchObject({ type: 'dialogue', speaker: 'Lala', auto: true, text: 'Wow' });
    expect(readLine('Lala: Wow').auto).toBeUndefined();
  });
});

describe('the teleprompter', () => {
  it('shows it as an on-screen reaction cue, not a line to read', () => {
    const [cue] = teleprompterLines(['Lala (automatic reaction): Squeal!'], { screen: true });
    expect(cue).toMatchObject({ kind: 'screen', who: null, icon: 'react', auto: true, text: 'Lala reacts on her own: “Squeal!”' });
  });

  it('hides it without on-screen moments, and gives it no voice-clip index', () => {
    const lines = ['Lala: Hi', 'Lala (auto): Ooh', 'Me: Yes'];
    expect(teleprompterLines(lines).map((l) => l.text)).toEqual(['Hi', 'Yes']);
    expect(teleprompterIndexMap(lines)).toEqual([0, null, 1]);
  });

  it('is not a speaker for "Read as"', () => {
    const s = teleprompterScript('## BEAT: 3 · Welcome\nLala (auto): Yay\nMe: Hi');
    expect(s.beats[0].lines.map((l) => [l.kind, l.vi])).toEqual([['screen', null], ['mine', 0]]);
  });
});

describe('voice clicks', () => {
  const lines = ['[UI:CLICK VoiceIcon]', 'Lala: Hi', 'Lala (auto): Ooh!', 'Lala (automatic reaction): Wow'];

  it('needs none, on the page and on the server', () => {
    expect(voiceOffLines(lines)).toEqual([]);
    expect(server.voiceOffLines(lines)).toEqual([]);
    expect(voiceOffLines(['Lala: Hi'])).toEqual([0]);
  });

  it('Ready to film? does not ask for one', () => {
    const rows = scriptHealth({ beats: [{ id: 'beat-3', number: 3, lines: ['Lala (auto): Yay!'] }] });
    expect(rows.find((r) => r.key.startsWith('voice-'))).toBeUndefined();
  });

  it("the server's parser gives it no voice-activate warning", () => {
    const parsed = parseScript('## BEAT: OPENING_RITUAL\nLala (auto): Ooh!\nLala: Hi');
    expect(parsed.beats[0].speakers).toEqual(['lala']);
    const warns = parsed.warnings.filter((w) => w.code === 'lala_without_voice_activate');
    expect(warns).toHaveLength(1);
  });
});
