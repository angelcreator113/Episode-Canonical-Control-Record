// Named beat headers (Script tab audit, 2026-10-15): the Script tab and the
// server must number `## BEAT: TRANSFORMATION` the same way, or a lock means
// one beat on the page and another on the server.
import { describe, test, expect } from 'vitest';
import { createRequire } from 'node:module';
import { beatNumberForLabel, LABEL_NUMBERS, BEAT_SPLIT } from './beatLabelNumber';

const require = createRequire(import.meta.url);
const server = require('../../../src/utils/beatLabelNumber.js');

describe('beatNumberForLabel', () => {
  test('the same table as the server', () => {
    expect(LABEL_NUMBERS).toEqual(server.LABEL_NUMBERS);
  });

  test('a number wins, then a beat name; anything else is null', () => {
    expect(beatNumberForLabel('8 · Transformation Loop')).toBe(8);
    expect(beatNumberForLabel('TRANSFORMATION')).toBe(8);
    expect(beatNumberForLabel('INTERRUPTION #2')).toBe(7);
    expect(beatNumberForLabel('cliffhanger')).toBe(14);
    expect(beatNumberForLabel('Bonus scene')).toBeNull();
    expect(beatNumberForLabel('15')).toBeNull();
  });

  test('a header starts its line', () => {
    const parts = '## BEAT: 1 · A\nLala: "say ## BEAT: no"\n\n## BEAT: 2 · B\nx'.split(BEAT_SPLIT);
    expect(parts).toHaveLength(2);
    expect(parts[0]).toContain('say ## BEAT: no');
  });
});
