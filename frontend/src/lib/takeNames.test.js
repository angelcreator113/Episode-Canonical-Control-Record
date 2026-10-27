// Unique take names (Evoni, 2026-10-27): every recording counts, saved or
// not, and a download carries the date and time.
import { describe, test, expect } from 'vitest';
import { nextTakeNumber, takeNumberOf, takeStamp, downloadName } from './teleprompterLines';
import { takeFileName } from './takeFile';
import { marksFileName } from './fullEpisodeTake';

const AT = new Date(2026, 9, 27, 14, 58);

describe('take numbers', () => {
  test('the number in a take\'s name', () => {
    expect(takeNumberOf('Beat 8 · Transformation Loop · take 2')).toBe(2);
    expect(takeNumberOf('Full episode · take 12 · as Lala')).toBe(12);
    expect(takeNumberOf('Beat 3 · Retake the mistake')).toBeNull();
    expect(takeNumberOf(null)).toBeNull();
  });

  test('one more than the highest of the saved, the kept-on-phone and the used-this-visit takes', () => {
    expect(nextTakeNumber()).toBe(1);
    expect(nextTakeNumber({ savedLabels: ['Full episode · take 1'] })).toBe(2);
    // An unsaved take 1 on the phone: the next is take 2, not another take 1.
    expect(nextTakeNumber({ savedLabels: [], others: [1] })).toBe(2);
    // Saved take 3 (take 2 was discarded): the next is 4, not 2.
    expect(nextTakeNumber({ savedLabels: ['Beat 2 · take 1', 'Beat 2 · take 3'] })).toBe(4);
    expect(nextTakeNumber({ savedLabels: ['Beat 2 · take 1'], others: [undefined, null, 4] })).toBe(5);
    // Clips without a number in their name still count by how many there are.
    expect(nextTakeNumber({ savedLabels: ['clip.mp4', 'other.mov'] })).toBe(3);
  });
});

describe('file names carry the date and time', () => {
  test('a take\'s download', () => {
    expect(takeStamp(AT)).toBe('2026-10-27 14-58');
    expect(takeFileName('Full episode · take 2', 'mp4', AT.getTime())).toBe('Full episode - take 2 - 2026-10-27 14-58.mp4');
    expect(takeFileName('Beat 8 · Transformation Loop · take 2', 'webm', AT)).toBe('Beat 8 - Transformation Loop - take 2 - 2026-10-27 14-58.webm');
    // Without a time, as before.
    expect(takeFileName('Beat 1 · take 1', 'mp4')).toBe('Beat 1 - take 1.mp4');
    expect(downloadName('video/webm', AT)).toBe('Teleprompter take 2026-10-27 14-58.webm');
    expect(takeStamp('not a date')).toBeNull();
  });

  test('the markers file', () => {
    expect(marksFileName('Full episode · take 2', AT.getTime())).toBe('Full episode - take 2 - 2026-10-27 14-58 - beat markers.txt');
    expect(marksFileName('Full episode · take 2')).toBe('Full episode - take 2 - beat markers.txt');
  });
});
