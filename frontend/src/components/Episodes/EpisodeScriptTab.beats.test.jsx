/**
 * Episode creation step 7 (§8(j)): "every generated script beat keeps its
 * canonical beat number". The Script tab reads the number from a canonical
 * header, `## BEAT: 5 · Reveal`, instead of the beat's position.
 */
import { vi, describe, test, expect } from 'vitest';

vi.mock('../../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn() },
}));

import { parseScriptIntoBeats } from './EpisodeScriptTab';

describe('parseScriptIntoBeats', () => {
  test('a canonical header names its beat by number, wherever it sits', () => {
    const beats = parseScriptIntoBeats('## BEAT: 4 · Interruption Pulse 1\nMe: ping\n## BEAT: 5 · Reveal\nLala: oh\n');
    expect(beats.map((b) => [b.number, b.name])).toEqual([[4, 'Interruption Pulse 1'], [5, 'Reveal']]);
    expect(beats[1].lines).toEqual(['Lala: oh']);
  });

  test('an older name-only header still falls back to its position', () => {
    const beats = parseScriptIntoBeats('## BEAT: OPENING_RITUAL\nx\n## BEAT: LOGIN\ny');
    expect(beats.map((b) => [b.number, b.name])).toEqual([[1, 'Opening Ritual'], [2, 'Login Sequence']]);
  });

  test('a number outside 1-14 is not a canonical beat and keeps its position', () => {
    const beats = parseScriptIntoBeats('## BEAT: 99 · Extra\nx');
    expect(beats[0]).toMatchObject({ number: 1, rawLabel: '99 · Extra' });
  });
});
