// Named beat headers (Script tab audit, 2026-10-15): the Script tab and the
// server must number `## BEAT: TRANSFORMATION` the same way, or a lock means
// one beat on the page and another on the server.
import { describe, test, expect } from 'vitest';
import { createRequire } from 'node:module';
import { beatNumberForLabel, LABEL_NUMBERS, BEAT_SPLIT, normalizeBeatHeaders } from './beatLabelNumber';

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

// Script tab re-audit (2026-10-15): Windows line ends and Markdown-dressed
// headers read the same on the page and on the server.
describe('normalizeBeatHeaders', () => {
  const pasted = '**## BEAT: 1 · Opening Ritual**\r\nLala: "Hi"\r\n### BEAT: 2\r\nLala: "Two"\r\n__## BEAT: Welcome__\r\nMe: three\r\nLala: "## BEAT: stays in a line"';
  test('the same as the server', () => {
    expect(normalizeBeatHeaders(pasted)).toBe(server.normalizeBeatHeaders(pasted));
    expect(normalizeBeatHeaders(pasted)).toBe('## BEAT: 1 · Opening Ritual\nLala: "Hi"\n## BEAT: 2\nLala: "Two"\n## BEAT: Welcome\nMe: three\nLala: "## BEAT: stays in a line"');
  });

  test('a plain header is left exactly as written', () => {
    expect(normalizeBeatHeaders('  ##BEAT:3 · x\ny')).toBe('  ##BEAT:3 · x\ny');
  });

  test('a header is one line', () => {
    expect('## BEAT: 1\nx\n##\nBEAT: tail'.split(BEAT_SPLIT)).toHaveLength(1);
  });
});
