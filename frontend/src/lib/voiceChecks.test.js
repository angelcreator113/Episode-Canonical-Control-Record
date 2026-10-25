import { describe, test, expect, vi } from 'vitest';

vi.mock('../services/api', () => ({ default: { get: vi.fn(), post: vi.fn() } }));

import { countSentences, hasWord, hasPhrase, speakerKeys, checkOf, beatContext, spokenLines, voiceDriftFlags, voiceHealthRows } from './voiceChecks';
import { scriptHealth } from './scriptHealth';

const beat = (number, lines, id = `b${number}`) => ({ id, number, lines, approved: false });

describe('countSentences', () => {
  test.each([
    ['', 0],
    ['Hi.', 1],
    ['Hi. Bye.', 2],
    ['Wait... what?! No.', 3],
    ['No end', 1],
    ['"Quoted. Twice."', 2],
    ['3.5 coins is fine.', 1],
    ['Okay… fine.', 2],
  ])('%j is %i', (text, n) => expect(countSentences(text)).toBe(n));
});

describe('hasWord', () => {
  test('whole word, any case', () => {
    expect(hasWord('That is LITERALLY it', 'literally')).toBe(true);
    expect(hasWord('literally.', 'literally')).toBe(true);
    expect(hasWord('Literallyyy', 'literally')).toBe(false);
    expect(hasWord('unliterally', 'literally')).toBe(false);
    expect(hasWord('anything', '')).toBe(false);
    expect(hasWord('a (b) c', '(b)')).toBe(true);
  });
});

describe('hasPhrase', () => {
  test('any case and spacing, curly apostrophes', () => {
    expect(hasPhrase('Okay   BESTIE, let’s go', "bestie, let's")).toBe(true);
    expect(hasPhrase('hello', 'bestie')).toBe(false);
    expect(hasPhrase('hello', '')).toBe(false);
  });
});

describe('speakerKeys', () => {
  test('her labels and Lala are known; the endpoint adds the rest; hers stay hers', () => {
    const m = speakerKeys([{ speaker: 'Marcus', characterKey: 'marcus_reid', name: 'Marcus Reid' }, { speaker: 'Prime', characterKey: 'oops' }, { speaker: '', characterKey: 'x' }, null]);
    expect(m.get('me')).toEqual({ characterKey: 'justawoman', name: 'JustAWoman' });
    expect(m.get('prime').characterKey).toBe('justawoman');
    expect(m.get('jawihp').characterKey).toBe('justawoman');
    expect(m.get('lala').characterKey).toBe('lala');
    expect(m.get('marcus')).toEqual({ characterKey: 'marcus_reid', name: 'Marcus Reid' });
    expect(speakerKeys(undefined).size).toBe(5);
  });
});

describe('checkOf', () => {
  test('reads the three checks, strings too; anything else is null', () => {
    expect(checkOf({ check_json: { type: 'max_sentences', n: 2 } })).toEqual({ type: 'max_sentences', n: 2 });
    expect(checkOf({ check_json: '{"type":"banned_word","word":" literally "}' })).toEqual({ type: 'banned_word', word: 'literally' });
    expect(checkOf({ check_json: { type: 'uses_phrase', phrase: 'bestie', every_n_lines: 4 } })).toEqual({ type: 'uses_phrase', phrase: 'bestie', every: 4 });
    expect(checkOf({ check_json: { type: 'max_sentences', n: 0 } })).toBeNull();
    expect(checkOf({ check_json: { type: 'tone' } })).toBeNull();
    expect(checkOf({ check_json: null })).toBeNull();
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(checkOf({ check_json: '{nope' })).toBeNull();
    expect(err).toHaveBeenCalled();
    err.mockRestore();
  });
});

describe('spokenLines', () => {
  test('numbers lines as the Script tab shows them and maps speakers to keys', () => {
    const beats = [beat(6, ['', '(She opens the closet.)', '[STAT: confidence +1]', '---', 'Me: Okay.', 'Lala: Hi bestie.', 'Stranger: who?', 'Marcus: Hey.'])];
    const lines = spokenLines(beats, [{ speaker: 'Marcus', characterKey: 'marcus', name: 'Marcus' }]);
    expect(lines.map((l) => [l.characterKey, l.lineNumber, l.words])).toEqual([
      ['justawoman', 2, 'Okay.'], ['lala', 3, 'Hi bestie.'], ['marcus', 5, 'Hey.'],
    ]);
    expect(lines[0].context).toBe('gameplay');
    expect(beatContext({ number: 12 })).toBe('cutscene');
    expect(spokenLines(null)).toEqual([]);
  });
});

describe('voiceDriftFlags', () => {
  const beats = [
    beat(2, ['Lala: One. Two.', 'Me: Let us go.']),
    beat(6, ['(Lala spins.)', 'Lala: I love it.', 'Lala: Okay. This. Is. It.', 'Lala: It is literally perfect.']),
    beat(12, ['Lala: One. Two. Three.']),
  ];

  test('max_sentences flags each line over, with beat and line', () => {
    const flags = voiceDriftFlags({ beats, rules: [{ id: 1, characterKey: 'lala', context: 'gameplay', check_json: { type: 'max_sentences', n: 2 } }] });
    expect(flags.map((f) => f.text)).toEqual(['Lala usually keeps it to 2 sentences — beat 6, line 3']);
  });

  test('a rule with no context holds in the cutscene too', () => {
    const flags = voiceDriftFlags({ beats, rules: [{ id: 1, characterKey: 'lala', check_json: { type: 'max_sentences', n: 2 } }] });
    expect(flags.map((f) => `${f.beatNumber}:${f.lineNumber}`)).toEqual(['6:3', '12:1']);
  });

  test('max 1 says "sentence"', () => {
    const flags = voiceDriftFlags({ beats: [beat(1, ['Me: A. B.'])], rules: [{ id: 3, characterKey: 'justawoman', check_json: { type: 'max_sentences', n: 1 } }] });
    expect(flags[0].text).toBe('JustAWoman usually keeps it to 1 sentence — beat 1, line 1');
  });

  test('banned_word flags the line with it', () => {
    const flags = voiceDriftFlags({ beats, rules: [{ id: 2, characterKey: 'lala', check_json: { type: 'banned_word', word: 'Literally' } }] });
    expect(flags).toHaveLength(1);
    expect(flags[0]).toMatchObject({ beatId: 'b6', beatNumber: 6, lineNumber: 4, severity: 'normal' });
    expect(flags[0].text).toBe("Lala doesn't say “Literally” — beat 6, line 4");
  });

  test('uses_phrase: one low note per character when n lines go without it', () => {
    const rules = [{ id: 5, characterKey: 'lala', check_json: { type: 'uses_phrase', phrase: 'bestie', every_n_lines: 3 } }];
    const flags = voiceDriftFlags({ beats, rules });
    expect(flags).toHaveLength(1);
    expect(flags[0]).toMatchObject({ severity: 'low', beatNumber: 2, lineNumber: 1 });
    expect(flags[0].text).toContain('Lala usually says “bestie” every 3 lines');
    // Said often enough: no note.
    const said = [beat(1, ['Lala: hi bestie', 'Lala: a', 'Lala: b', 'Lala: bestie!', 'Lala: c'])];
    expect(voiceDriftFlags({ beats: said, rules })).toEqual([]);
  });

  test('rules for other characters, unknown speakers and bad rules do nothing', () => {
    expect(voiceDriftFlags({ beats, rules: [{ id: 9, characterKey: 'marcus', check_json: { type: 'banned_word', word: 'it' } }] })).toEqual([]);
    expect(voiceDriftFlags({ beats, rules: [{ id: 9, characterKey: 'lala', check_json: { type: 'nope' } }, null, { id: 8, check_json: { type: 'banned_word', word: 'it' } }] })).toEqual([]);
    expect(voiceDriftFlags({ beats, rules: [{ id: 2, characterKey: 'lala', context: 'narration', check_json: { type: 'banned_word', word: 'literally' } }] })).toEqual([]);
    expect(voiceDriftFlags()).toEqual([]);
  });
});

describe('voiceHealthRows', () => {
  const beats = [beat(6, ['Lala: A. B. C.', 'Lala: D. E. F.', 'Lala: ok'])];
  test('one row per rule and beat, with how many more; a low note names no beat', () => {
    const rows = voiceHealthRows({ beats, rules: [
      { id: 1, characterKey: 'lala', check_json: { type: 'max_sentences', n: 2 } },
      { id: 2, characterKey: 'lala', check_json: { type: 'uses_phrase', phrase: 'bestie', every_n_lines: 2 } },
    ] });
    expect(rows).toEqual([
      { key: 'voice-drift-1-b6', ok: false, beatId: 'b6', text: 'Lala usually keeps it to 2 sentences — beat 6, line 1 (+1 more in this beat)' },
      { key: 'voice-drift-low-2', ok: false, low: true, beatId: null, text: expect.stringContaining('“bestie”') },
    ]);
  });
  test('all clear is one OK row; no checkable rules or none loaded is no row', () => {
    expect(voiceHealthRows({ beats, rules: [{ id: 1, characterKey: 'lala', check_json: { type: 'max_sentences', n: 5 } }] }))
      .toEqual([{ key: 'voice-drift', ok: true, beatId: null, text: 'Everyone sounds like themselves.' }]);
    expect(voiceHealthRows({ beats, rules: [{ id: 1, characterKey: 'lala', check_json: { type: 'vibe' } }] })).toEqual([]);
    expect(voiceHealthRows({ beats, rules: null })).toEqual([]);
    expect(voiceHealthRows({ beats: [beat(1, ['(silence)'])], rules: [{ id: 1, characterKey: 'lala', check_json: { type: 'max_sentences', n: 5 } }] })).toEqual([]);
  });
  test('scriptHealth carries them; without voice it is as before', () => {
    const rules = [{ id: 1, characterKey: 'lala', check_json: { type: 'max_sentences', n: 2 } }];
    const keys = scriptHealth({ beats, voice: { rules, speakers: [] } }).map((r) => r.key);
    expect(keys).toContain('voice-drift-1-b6');
    expect(scriptHealth({ beats }).some((r) => r.key.startsWith('voice-drift'))).toBe(false);
  });
});
