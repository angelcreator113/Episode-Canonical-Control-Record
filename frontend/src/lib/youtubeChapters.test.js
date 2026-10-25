// YouTube chapters from a whole-episode take's beat markers: first at 0:00,
// at least 3, each 10 seconds or more; short beats are joined and it says so.
import { describe, test, expect } from 'vitest';
import { youtubeChapters, chapterClock, draftDescription, INTRO_TITLE } from './youtubeChapters';

const NAMES = { 1: 'Opening Ritual', 2: 'Login Sequence', 3: 'Welcome', 4: 'Interruption' };

describe('youtubeChapters', () => {
  test('whole-second clocks as YouTube reads them', () => {
    expect(chapterClock(0)).toBe('0:00');
    expect(chapterClock(65.9)).toBe('1:05');
    expect(chapterClock(3725)).toBe('1:02:05');
  });

  test('one chapter a beat, the first moved to 0:00 when it starts within 10 seconds', () => {
    const ch = youtubeChapters([{ beat: 1, t: 2.4 }, { beat: 2, t: 40 }, { beat: 3, t: 95.5 }], { names: NAMES, duration: 200 });
    expect(ch.ok).toBe(true);
    expect(ch.text).toBe('0:00 Opening Ritual\n0:40 Login Sequence\n1:35 Welcome');
    expect(ch.notes).toEqual([]);
  });

  test('a long wait before the first beat becomes an Intro chapter at 0:00', () => {
    const ch = youtubeChapters([{ beat: 1, t: 30 }, { beat: 2, t: 60 }, { beat: 3, t: 90 }], { names: NAMES });
    expect(ch.chapters[0]).toEqual({ t: 0, title: INTRO_TITLE, beats: [] });
    expect(ch.chapters).toHaveLength(4);
    expect(ch.notes[0]).toMatch(/Intro/);
  });

  test('a beat under 10 seconds is joined with the next, and the notes say so', () => {
    const ch = youtubeChapters([{ beat: 1, t: 0 }, { beat: 2, t: 30 }, { beat: 3, t: 35 }, { beat: 4, t: 80 }], { names: NAMES, duration: 120 });
    expect(ch.text).toBe('0:00 Opening Ritual\n0:30 Login Sequence & Welcome\n1:20 Interruption');
    expect(ch.notes.join(' ')).toMatch(/"Login Sequence" is under 10 seconds, so it is joined with "Welcome"/);
    expect(ch.ok).toBe(true);
  });

  test('a last beat under 10 seconds is joined with the one before', () => {
    const ch = youtubeChapters([{ beat: 1, t: 0 }, { beat: 2, t: 30 }, { beat: 3, t: 60 }, { beat: 4, t: 95 }], { names: NAMES, duration: 100 });
    expect(ch.chapters.map((c) => c.title)).toEqual(['Opening Ritual', 'Login Sequence', 'Welcome & Interruption']);
    expect(ch.ok).toBe(true);
  });

  test('fewer than 3 chapters is not usable on YouTube, and says why', () => {
    const ch = youtubeChapters([{ beat: 1, t: 0 }, { beat: 2, t: 30 }], { names: NAMES });
    expect(ch.ok).toBe(false);
    expect(ch.notes.join(' ')).toMatch(/at least 3 chapters/);
    expect(youtubeChapters([]).notes[0]).toMatch(/no beat markers/);
  });

  test('without names, the canonical beat names', () => {
    const ch = youtubeChapters([{ beat: 1, t: 0 }, { beat: 2, t: 30 }, { beat: 3, t: 60 }]);
    expect(ch.chapters[0].title).not.toBe('');
    expect(ch.chapters[0].title).not.toMatch(/undefined/);
  });

  test('the draft description: title, synopsis, then the chapters when usable', () => {
    const ch = youtubeChapters([{ beat: 1, t: 0 }, { beat: 2, t: 30 }, { beat: 3, t: 60 }], { names: NAMES });
    expect(draftDescription({ title: 'The Gala', synopsis: 'Lala gets invited.', chapters: ch }))
      .toBe('The Gala\n\nLala gets invited.\n\nChapters\n0:00 Opening Ritual\n0:30 Login Sequence\n1:00 Welcome');
    const bad = youtubeChapters([{ beat: 1, t: 0 }], { names: NAMES });
    expect(draftDescription({ title: 'The Gala', chapters: bad })).toBe('The Gala');
  });
});
