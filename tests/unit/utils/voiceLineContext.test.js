'use strict';

/**
 * Voice Studio B1 (design R2.6, R5.5 B1-5): where a take's stored line
 * stands in the script now. Every case of the design's table, and the line
 * counting the take's position names. Pure.
 */

const lc = require('../../../src/utils/voiceLineContext');

const beat = (n, ...lines) => [`## BEAT: ${n} · Beat ${n}`, ...lines].join('\n');
const script = (...beats) => beats.join('\n\n');
const at = (text, b, i) => lc.lineAt(lc.lineContexts(text), b, i).ctx;
const resolveIn = (assocText, b, i, nowText) => lc.resolve(lc.associationOf(at(assocText, b, i)), lc.lineContexts(nowText));

const BASE = script(
  beat(6, 'Lala: "This is my moment."', 'Guest: "Love the look!"', 'Lala: Okay.', '(Lala twirls)', 'Prime: right'),
  beat(8, 'Lala: "Closet time."'),
);

describe('normalising a line', () => {
  test('the same rule as lineKeys.normaliseLine (A1d matches these hashes against it)', () => {
    const { normaliseLine } = require('../../../src/utils/lineKeys');
    for (const s of ['Lala: “Hi”  —  it’s ‘me’', '  tabs\tand   spaces ', 'a – b ‐ c − d', '', null, 'Prime: ″quoted″ ‚x‛ ′y′']) {
      expect(lc.normaliseLine(s)).toBe(normaliseLine(s));
    }
  });
});

describe('counting the lines a take can be tied to', () => {
  test('dialogue, actions and narration count; moments, tags, rules and automatic reactions do not', () => {
    const text = beat(6, '[UI:OPEN Closet]', 'Lala: one', '[SFX: ding]', 'Lala (auto): "Ooh"', '---', '(she sits)', '[STAT: coins +5]', 'Then the lights go out over the room.', 'Me: hi');
    const lines = lc.lineContexts(text).beats.get(6).lines;
    expect(lines.map((l) => [l.line_index, l.speaker_key, l.words])).toEqual([
      [0, 'lala', 'one'], [1, null, 'she sits'], [2, null, 'Then the lights go out over the room.'], [3, 'justawoman', 'hi'],
    ]);
    expect(lines[3].prime).toBe(true);
  });

  test('a note before the colon and one before the words are both the delivery note', () => {
    const lines = lc.lineContexts(beat(6, 'Lala (softly): "Mine."', 'Lala: (whispering) Mine.')).beats.get(6).lines;
    expect(lines.map((l) => l.delivery_note)).toEqual(['(softly)', '(whispering)']);
    expect(lines[0].row_hash).not.toBe(lines[1].row_hash);
  });

  test('identical lines are counted by occurrence, and have the same row but different contexts', () => {
    const lines = lc.lineContexts(beat(4, 'Lala: Okay.', 'Prime: Wait.', 'Lala: Okay.')).beats.get(4).lines;
    expect(lines.map((l) => l.occurrence)).toEqual([1, 1, 2]);
    expect(lines[0].row_hash).toBe(lines[2].row_hash);
    expect(lines[0].context_hash).not.toBe(lines[2].context_hash);
  });

  test('a beat number used twice is never resolved', () => {
    const text = script(beat(5, 'Lala: a'), beat(5, 'Lala: b'));
    expect(lc.lineAt(lc.lineContexts(text), 5, 0)).toEqual({ ctx: null, reason: 'duplicate_beat' });
  });
});

describe('resolve: the design table (R2.6), case by case', () => {
  test('unchanged: bound', () => {
    expect(resolveIn(BASE, 6, 2, BASE)).toMatchObject({ status: 'bound', line_index: 2 });
  });

  test('another beat edited: still bound', () => {
    const now = BASE.replace('Lala: "Closet time."', 'Lala: "Closet time, now!"');
    expect(resolveIn(BASE, 6, 2, now).status).toBe('bound');
  });

  test('a line inserted above: moved (the only such line), needing a person', () => {
    const now = BASE.replace('Guest: "Love the look!"', 'Guest: "Hi!"\nGuest: "Love the look!"');
    expect(resolveIn(BASE, 6, 2, now)).toMatchObject({ status: 'moved', reason: 'moved', line_index: 3 });
  });

  test('a neighbour edited: the unchanged line at its place stays bound, flagged for review', () => {
    const now = BASE.replace('Guest: "Love the look!"', 'Guest: "Love it!"');
    expect(resolveIn(BASE, 6, 2, now)).toMatchObject({ status: 'bound', reason: 'neighbours_changed', line_index: 2 });
  });

  test('an edited line with an identical twin elsewhere: moved or edited, a person decides', () => {
    const text = beat(4, 'Lala: Okay.', 'Prime: Wait.', 'Lala: Okay.');
    const edited = beat(4, 'Lala: Fine then.', 'Prime: Wait.', 'Lala: Okay.');
    expect(resolveIn(text, 4, 0, edited)).toMatchObject({ status: 'ambiguous', reason: 'moved_or_edited', candidates: [2] });
    // Another speaker at its place now: a plain move (a line inserted above).
    const inserted = beat(4, 'Guest: Hi.', 'Lala: Okay.', 'Prime: Wait.');
    expect(resolveIn(beat(4, 'Lala: Okay.', 'Prime: Wait.'), 4, 0, inserted)).toMatchObject({ status: 'moved', candidates: [1] });
  });

  test('identical lines: bound only with position and both neighbours', () => {
    const text = beat(4, 'Lala: Okay.', 'Prime: Wait.', 'Lala: Okay.', 'Lala: Fine.');
    expect(resolveIn(text, 4, 2, text).status).toBe('bound');
    // The first "Okay." deleted: the second moves up, and Lala's next line takes its place. From the text alone
    // that is also an edit of this line, so a person decides (never moved silently).
    const deletedFirst = beat(4, 'Prime: Wait.', 'Lala: Okay.', 'Lala: Fine.');
    expect(resolveIn(text, 4, 2, deletedFirst)).toMatchObject({ status: 'ambiguous', reason: 'moved_or_edited', candidates: [1] });
    // Both still there, a line added above: either could be the take's line. A person picks.
    const added = beat(4, 'Guest: Hey.', 'Lala: Okay.', 'Prime: Wait.', 'Lala: Okay.', 'Lala: Fine.');
    expect(resolveIn(text, 4, 2, added)).toMatchObject({ status: 'ambiguous', reason: 'ambiguous_duplicate', candidates: [1, 3] });
  });

  test('the second of two identical lines never takes the first one\'s take silently', () => {
    const text = beat(4, 'Lala: Okay.', 'Lala: Okay.', 'Prime: Go.');
    // A take tied to line 0; line 0 removed, so line 1 slides to position 0. Same row, different
    // neighbours, now the only such line: bound but flagged, so a person reviews it before it plays.
    const removed = beat(4, 'Lala: Okay.', 'Prime: Go.');
    expect(resolveIn(text, 4, 0, removed)).toMatchObject({ status: 'bound', reason: 'neighbours_changed' });
    // Line 1 removed instead, and a third identical line kept: either could be the take's. A person picks.
    const three = beat(4, 'Lala: Okay.', 'Lala: Okay.', 'Lala: Okay.', 'Prime: Go.');
    const middleGone = beat(4, 'Lala: Okay.', 'Lala: Okay.', 'Prime: Go.');
    expect(resolveIn(three, 4, 1, middleGone)).toMatchObject({ status: 'ambiguous', candidates: [0, 1] });
    // Unchanged repeated lines each stay bound to their own place.
    for (const i of [0, 1, 2]) expect(resolveIn(three, 4, i, three)).toMatchObject({ status: 'bound', reason: null, line_index: i });
  });

  test('repeated dialogue: occurrence counts identical lines in a beat; the index alone names each one', () => {
    const three = beat(4, 'Lala: Okay.', 'Prime: Go.', 'Lala: Okay.', 'Lala: Okay.');
    const lines = lc.lineContexts(three).beats.get(4).lines;
    expect(lines.map((c) => [c.line_index, c.occurrence])).toEqual([[0, 1], [1, 1], [2, 2], [3, 3]]);
    // Within one script (beat, index) and (beat, row, occurrence) name the same line, so occurrence
    // adds nothing to the approval's identity.
    const byIndex = new Map(lines.map((c) => [c.line_index, `${c.row_hash}:${c.occurrence}`]));
    expect(new Set(byIndex.values()).size).toBe(lines.length);
  });

  test('speaker changed, same words: unbound (speaker_changed)', () => {
    const now = BASE.replace('Lala: Okay.', 'Guest: Okay.');
    expect(resolveIn(BASE, 6, 2, now)).toMatchObject({ status: 'unbound', reason: 'speaker_changed' });
  });

  test('delivery note changed: unbound (note_changed)', () => {
    const now = BASE.replace('Lala: Okay.', 'Lala (sighs): Okay.');
    expect(resolveIn(BASE, 6, 2, now)).toMatchObject({ status: 'unbound', reason: 'note_changed' });
  });

  test('words changed: unbound (words_changed)', () => {
    const now = BASE.replace('Lala: Okay.', 'Lala: Fine then.');
    expect(resolveIn(BASE, 6, 2, now)).toMatchObject({ status: 'unbound', reason: 'words_changed' });
  });

  test('line moved to another beat: unbound with a hint, never applied', () => {
    const now = script(beat(6, 'Lala: "This is my moment."', 'Guest: "Love the look!"', '(Lala twirls)', 'Prime: right'), beat(8, 'Lala: Okay.', 'Lala: "Closet time."'));
    expect(resolveIn(BASE, 6, 2, now)).toMatchObject({ status: 'unbound', reason: 'beat_changed', hint_beat: 8 });
  });

  test('line removed: unbound (line_removed)', () => {
    const now = BASE.replace('\nLala: Okay.', '').replace('\n(Lala twirls)', '').replace('\nPrime: right', '');
    expect(resolveIn(BASE, 6, 2, now)).toMatchObject({ status: 'unbound', reason: 'line_removed' });
  });

  test('beat renumbered: unbound', () => {
    const now = BASE.replace('## BEAT: 6 · Beat 6', '## BEAT: 7 · Beat 7');
    expect(resolveIn(BASE, 6, 2, now)).toMatchObject({ status: 'unbound', reason: 'beat_changed', hint_beat: 7 });
  });

  test('script restored to the same text: bound again (approval validity is decided elsewhere, R4.1)', () => {
    const edited = BASE.replace('Lala: Okay.', 'Lala: Fine then.');
    expect(resolveIn(BASE, 6, 2, edited).status).toBe('unbound');
    expect(resolveIn(BASE, 6, 2, BASE).status).toBe('bound');
  });
});
