// Teleprompter batch 1 helpers (Evoni, 2026-10-20): reading marks, voice
// matching, rehearsal text; and the marks stay plain text for the Script tab.
import { describe, test, expect } from 'vitest';
import { markTokens, pauseCount, isBreath, spokenWords, normWord } from './teleprompterMarks';
import { advance, sameWord, speechErrorMessage, speechRecognition } from './voiceFollow';
import { durationText, diffText, rehearsalLine } from './rehearsal';
import { speakerLine } from './scriptSpeaker';
import { readLine } from './scriptExport';
import { lineSeconds } from './scriptRuntime';
import { teleprompterLines } from './teleprompterLines';
import { parseScriptIntoBeats } from '../components/Episodes/EpisodeScriptTab';

const w = (text) => spokenWords(text).map((x) => ({ w: x.w }));

describe('reading marks', () => {
  test('tokens, pauses, breaths, spoken words', () => {
    expect(markTokens('Wait // for *it* (breath) now [Breath]')).toEqual([
      { t: 'text', v: 'Wait ' }, { t: 'pause' }, { t: 'text', v: ' for ' }, { t: 'em', v: 'it' },
      { t: 'text', v: ' ' }, { t: 'breath' }, { t: 'text', v: ' now ' }, { t: 'breath' },
    ]);
    expect(pauseCount('a // b // c')).toBe(2);
    expect(isBreath('(breath)')).toBe(true);
    expect(isBreath('[ breath ]')).toBe(true);
    expect(isBreath('breath')).toBe(true);
    expect(isBreath('She takes a breath')).toBe(false);
    expect(spokenWords('Wait // for *it*, (breath) now!').map((x) => x.w)).toEqual(['wait', 'for', 'it', 'now']);
    expect(normWord('Café’s')).toBe('cafes');
  });

  test('a breath line is a breath for the teleprompter', () => {
    expect(teleprompterLines(['(breath)', '[breath]', '(She sits.)']).map((l) => l.kind)).toEqual(['breath', 'breath', 'direction']);
  });

  test("the Script tab reads a marked line as before: same speaker, same words, the marks plain text", () => {
    const line = 'Me: "Wait // for *it* (breath) now."';
    expect(speakerLine(line)).toMatchObject({ speaker: 'Prime', words: '"Wait // for *it* (breath) now."' });
    expect(readLine(line)).toMatchObject({ type: 'dialogue', speaker: 'Prime', text: 'Wait // for *it* (breath) now.' });
    expect(lineSeconds(line)).toBe(lineSeconds('Me: "Wait for *it* now."'));
    const beats = parseScriptIntoBeats(`## BEAT: 1 · Opening Ritual\n${line}\n[breath]`);
    expect(beats[0].lines).toEqual([line, '[breath]']);
  });
});

describe('voice matching', () => {
  const words = w('Okay besties, today we go somewhere completely new.');
  test('moves on with what she says, skips allowed, never back', () => {
    expect(advance(words, 0, ['okay', 'besties'])).toBe(2);
    expect(advance(words, 2, ['somewhere'])).toBe(6); // "today we go" skipped
    expect(advance(words, 6, ['okay'])).toBe(6); // behind her: no move
    expect(advance(words, 2, ['today', 'completely'])).toBe(7); // "we go somewhere" skipped
  });
  test('short words only match the very next word; near misses match', () => {
    expect(advance(w('the cat sat on a mat'), 0, ['a'])).toBe(0);
    expect(advance(w('the cat sat on a mat'), 4, ['a'])).toBe(5);
    expect(sameWord('somewhere', 'somewhat')).toBe(true); // shares "somew"
    expect(sameWord('besties', 'bestie')).toBe(true);
    expect(sameWord('cat', 'cut')).toBe(false);
    expect(advance(words, 0, Array(20).fill('zzz'))).toBe(0);
  });
  test('errors in plain words; support detection', () => {
    expect(speechErrorMessage('no-speech')).toBeNull();
    expect(speechErrorMessage('not-allowed')).toMatch(/blocked/);
    expect(speechErrorMessage('audio-capture', { recording: true })).toMatch(/while it records/);
    expect(speechRecognition({})).toBeNull();
    const C = function C() {};
    expect(speechRecognition({ webkitSpeechRecognition: C })).toBe(C);
  });
});

describe('rehearsal text', () => {
  test('durations and the summary line', () => {
    expect(durationText(112)).toBe('1m 52s');
    expect(durationText(45)).toBe('45s');
    expect(durationText(120)).toBe('2m');
    expect(diffText(112, 90)).toBe('+22s');
    expect(diffText(80, 90)).toBe('−10s');
    expect(diffText(90, 90)).toBe('on time');
    expect(rehearsalLine(8, 112, 90)).toBe('Beat 8: 1m 52s · est. 1m 30s · +22s');
  });
});
