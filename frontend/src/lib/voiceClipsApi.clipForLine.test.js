// A changed line never plays its old recording (Script tab audit 6, 2026-10-24).
import { test, expect } from 'vitest';
import { clipForLine, clipsByLine } from './voiceClipsApi';

const clips = clipsByLine([
  { id: 'a', beat_number: 3, line_index: 1, line_text: 'Hello there.' },
  { id: 'b', beat_number: 3, line_index: 2, line_text: 'See you  soon.' },
  { id: 'c', beat_number: 4, line_index: 0, line_text: 'Moved line.' },
]);

test('the clip at its place when its words are the line\'s', () => {
  expect(clipForLine(clips, 3, 1, 'Hello there.').id).toBe('a');
  expect(clipForLine(clips, 3, 2, 'See you soon.').id).toBe('b');
});
test('a line that changed: null, or the clip in the same beat with these words', () => {
  expect(clipForLine(clips, 3, 1, 'Hello, everyone.')).toBeNull();
  expect(clipForLine(clips, 3, 0, 'See you soon.').id).toBe('b');
  expect(clipForLine(clips, 3, 0, 'Moved line.')).toBeNull();
  expect(clipForLine(new Map(), 3, 0, 'x')).toBeNull();
});
