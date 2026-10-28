import { describe, it, expect } from 'vitest';
import {
  learnedPace, takeBeatTimes, beatParts, combinePace, withEpisode, activePace, paceText, median,
  takeReader, NOT_ENOUGH, RATIO_MAX, MAX_EPISODES, promptSeconds,
} from './learnedPace';
import { beatSeconds, lineSeconds, scriptSeconds, WORDS_PER_MINUTE } from './scriptRuntime';

// Her words in each beat of a realistic episode (beats 1-14).
const HER_WORDS = { 1: 100, 2: 300, 3: 250, 4: 200, 5: 350, 6: 280, 7: 150, 8: 320, 9: 260, 10: 120, 11: 411, 12: 195, 13: 434, 14: 272 };
const words = (n) => Array.from({ length: n }, (_, i) => `word${i}`).join(' ');
// Her words split over a few lines, Lala answering (15 words: 6 s), a tap
// on screen (3 s) and a scene note (hidden in the teleprompter).
const beatLines = (n) => [
  '(she sits at the vanity)',
  `JustAWoman: ${words(Math.ceil(n / 2))}`,
  `Lala: ${words(15)}`,
  '[UI:OPEN closet]',
  `Me: ${words(Math.floor(n / 2))}`,
];
const BEATS = Object.keys(HER_WORDS).map((k) => ({ number: Number(k), name: `Beat ${k}`, lines: beatLines(HER_WORDS[k]) }));

// Take 1: beats 1-11 over 22:19 (her real take's span; the markers in
// between are made up, with beat 5 interrupted by a long pause).
const TAKE_1 = {
  id: 'take-1', performer: 'justawoman', label: 'Full episode · take 1', duration_seconds: 22 * 60 + 19,
  beat_marks: [
    { beat: 1, t: 0 }, { beat: 2, t: 45 }, { beat: 3, t: 156 }, { beat: 4, t: 255 }, { beat: 5, t: 334.4 },
    { beat: 6, t: 763.4 }, { beat: 7, t: 868.7 }, { beat: 8, t: 931.7 }, { beat: 9, t: 1048.2 },
    { beat: 10, t: 1147.7 }, { beat: 11, t: 1200.9 },
  ],
};
// Take 2: her real markers. Beats 1-9 jumped past at 0:00, then beats 10-14
// at 0:09.4 / 0:10.4 / 2:42.5 / 3:59.2 / 6:39.3, over 8:23.
const TAKE_2 = {
  id: 'take-2', performer: 'justawoman', label: 'Full episode · take 2', duration_seconds: 8 * 60 + 23,
  beat_marks: [
    ...[1, 2, 3, 4, 5, 6, 7, 8, 9].map((beat) => ({ beat, t: 0 })),
    { beat: 10, t: 9.4 }, { beat: 11, t: 10.4 }, { beat: 12, t: 162.5 }, { beat: 13, t: 239.2 }, { beat: 14, t: 399.3 },
  ],
};

describe('lib/scriptRuntime with a pace', () => {
  it('keeps the standard estimate with no pace', () => {
    expect(lineSeconds('Me: one two three four five')).toBe(2);
    expect(lineSeconds('Me: one two three four five', null)).toBe(2);
    expect(beatSeconds(beatLines(150))).toBe(beatSeconds(beatLines(150), null));
  });
  it('times her lines at her pace and others at the standard', () => {
    const pace = { wpm: 300 };
    expect(lineSeconds('Me: one two three four five', pace)).toBe(1);
    expect(lineSeconds('JustAWoman: one two three four five', pace)).toBe(1);
    expect(lineSeconds('Lala: one two three four five', pace)).toBe(2);
    expect(lineSeconds('[UI:OPEN closet]', pace)).toBe(3);
    expect(lineSeconds('Lala: one two three four five', { wpm: 300, reader: null })).toBe(1);
    expect(lineSeconds('Lala: one two three four five', { wpm: 300, reader: 'Lala' })).toBe(1);
    expect(scriptSeconds(BEATS, pace)).toBeLessThan(scriptSeconds(BEATS));
  });
});

describe('lib/learnedPace takeBeatTimes', () => {
  it('times each beat of take 2 from its marker, leaving out the jump at 0:00', () => {
    expect(takeBeatTimes(TAKE_2)).toEqual([
      { beat: 10, seconds: 1 }, { beat: 11, seconds: 152.1 }, { beat: 12, seconds: 76.7 },
      { beat: 13, seconds: 160.1 }, { beat: 14, seconds: 103.7 },
    ]);
  });
  it('leaves out a beat at 0:00 and times the last beat to the end of the take', () => {
    const t = takeBeatTimes(TAKE_1);
    expect(t.map((x) => x.beat)).toEqual([2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
    expect(t[t.length - 1]).toEqual({ beat: 11, seconds: 138.1 });
  });
  it('a take of one beat counts its length; one from a later line does not', () => {
    expect(takeBeatTimes({ performer: 'justawoman', beat_number: 3, duration_seconds: 92.4 })).toEqual([{ beat: 3, seconds: 92.4 }]);
    expect(takeBeatTimes({ performer: 'justawoman', beat_number: 3, start_line: 4, duration_seconds: 40 })).toEqual([]);
    expect(takeBeatTimes({ performer: 'justawoman', beat_number: 3, end_beat_number: 5, duration_seconds: 300 })).toEqual([]);
    expect(takeBeatTimes({ performer: 'justawoman', beat_number: 3 })).toEqual([]);
  });
  it('a marker with no length after it is not timed', () => {
    expect(takeBeatTimes({ label: 'Full episode · take 3', beat_marks: [{ beat: 2, t: 5 }] })).toEqual([]);
  });
});

describe('lib/learnedPace beatParts', () => {
  it('splits her words from the cues, moments and hidden notes', () => {
    const p = beatParts(beatLines(150));
    expect(p.words).toBe(150);
    expect(p.herSeconds).toBeCloseTo(60, 5);
    expect(p.otherSeconds).toBeCloseTo(9, 5); // Lala 6 s + the tap 3 s; the note counts nothing
  });
  it('reading as Lala, her lines are Lala\'s', () => {
    const p = beatParts(beatLines(150), 'Lala');
    expect(p.herSeconds).toBeCloseTo(6, 5);
    expect(takeReader({ performer: 'justawoman', label: 'Full episode · take 2 · as Lala' })).toBe('Lala');
    expect(takeReader({ performer: 'guest' })).toBeNull();
  });
});

describe('lib/learnedPace learnedPace', () => {
  it('learns her pace from her two full-episode takes', () => {
    const p = learnedPace(BEATS, [TAKE_1, TAKE_2]);
    // take 1: beats 2-11 (beat 1 is at 0:00); take 2: 11-14 (beat 10 gone past in 1 s).
    expect(p.beatsUsed).toBe(14);
    expect(p.takesUsed).toBe(2);
    expect(p.confident).toBe(true);
    expect(p.factor).toBeGreaterThan(0.84);
    expect(p.factor).toBeLessThan(0.9);
    expect(p.wpm).toBeGreaterThanOrEqual(167);
    expect(p.wpm).toBeLessThanOrEqual(178);
    expect(p.wpm).toBe(Math.round(WORDS_PER_MINUTE / median(p.ratios.map((r) => Math.min(r, RATIO_MAX)))));
    // The paused beat 5 is clamped, not trusted.
    expect(Math.max(...p.ratios)).toBeGreaterThan(RATIO_MAX);
    // Beat times for the teleprompter: beat 10 from take 1 only.
    expect(p.beatTimes[10]).toBe(53);
    expect(p.beatTimes[11]).toBe(145); // median of 138.1 and 152.1
    expect(p.beatTimes[1]).toBeUndefined();
  });
  it('take 2 alone: four beats', () => {
    const p = learnedPace(BEATS, [TAKE_2]);
    expect(p.beatsUsed).toBe(4);
    expect(p.takesUsed).toBe(1);
    expect(p.confident).toBe(true);
    expect(p.wpm).toBeGreaterThan(165);
    expect(p.wpm).toBeLessThan(180);
  });
  it('leaves out beats a take only went past, and other performers', () => {
    const skim = { id: 's', performer: 'justawoman', label: 'Full episode · take 4', duration_seconds: 30, beat_marks: [{ beat: 2, t: 1 }, { beat: 3, t: 2.5 }, { beat: 4, t: 10 }] };
    const lala = { ...TAKE_2, id: 'lala', performer: 'lala' };
    const p = learnedPace(BEATS, [skim, lala]);
    expect(p.beatsUsed).toBe(0);
    expect(p.confident).toBe(false);
    expect(p.wpm).toBeNull();
    expect(learnedPace(BEATS, [lala], { performer: 'lala' }).beatsUsed).toBe(0); // Lala has few words a beat
  });
  it('needs three beats to be confident', () => {
    const one = { id: 'b', performer: 'justawoman', beat_number: 4, duration_seconds: 79.4 };
    const p = learnedPace(BEATS, [one]);
    expect(p.beatsUsed).toBe(1);
    expect(p.confident).toBe(false);
    expect(activePace(p)).toBeNull();
    expect(paceText(p)).toBe(NOT_ENOUGH);
  });
  it('nothing to learn from: no clips, no beats', () => {
    expect(learnedPace([], [])).toMatchObject({ wpm: null, factor: null, beatsUsed: 0, takesUsed: 0, confident: false });
    expect(learnedPace(null, null).beatsUsed).toBe(0);
  });
});

describe('lib/learnedPace show-wide', () => {
  it('combines episodes and keeps the newest', () => {
    const a = learnedPace(BEATS, [TAKE_1]);
    const b = learnedPace(BEATS, [TAKE_2]);
    let entries = withEpisode({}, 'ep1', a, '2026-10-20T00:00:00Z');
    entries = withEpisode(entries, 'ep2', b, '2026-10-28T00:00:00Z');
    const all = combinePace(entries);
    expect(all.beatsUsed).toBe(14);
    expect(all.takesUsed).toBe(2);
    expect(all.wpm).toBe(learnedPace(BEATS, [TAKE_1, TAKE_2]).wpm);
    expect(Object.keys(withEpisode(entries, 'ep2', { ratios: [] }))).toEqual(['ep1']);
    let many = {};
    for (let i = 0; i < MAX_EPISODES + 3; i += 1) many = withEpisode(many, `e${i}`, a, `2026-10-${String(i + 1).padStart(2, '0')}T00:00:00Z`);
    expect(Object.keys(many)).toHaveLength(MAX_EPISODES);
    expect(many.e0).toBeUndefined();
  });
  it('the pace is used only when on and learned', () => {
    const p = learnedPace(BEATS, [TAKE_1, TAKE_2]);
    expect(activePace(p)).toEqual({ wpm: p.wpm, reader: 'JustAWoman' });
    expect(activePace(p, 'standard')).toBeNull();
    expect(paceText(p)).toBe(`Your pace: ${p.wpm} words/min (from 2 takes)`);
  });
});

describe('lib/learnedPace promptSeconds', () => {
  it('scales spoken lines to her pace and leaves moments alone', () => {
    expect(promptSeconds({ kind: 'mine', seconds: 6 }, { wpm: 180 })).toBeCloseTo(5, 5);
    expect(promptSeconds({ kind: 'cue', seconds: 6 }, { wpm: 180 })).toBeCloseTo(5, 5);
    expect(promptSeconds({ kind: 'screen', seconds: 3 }, { wpm: 180 })).toBe(3);
    expect(promptSeconds({ kind: 'mine', seconds: 6 }, null)).toBe(6);
  });
});
