// The Teleprompter wears tokens only (Evoni, 2026-10-20): no colour literal in
// its stylesheet or components, and the dark reader's text pairs read 4.5:1.
import { describe, test, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { contrast, readToken, stripTaskRefs } from '../styles/contrast';

const css = readFileSync(resolve(__dirname, 'Teleprompter.css'), 'utf8');
const files = ['Teleprompter.jsx', '../components/Teleprompter/TeleprompterReader.jsx', '../components/Teleprompter/TeleprompterParts.jsx'].map((f) => readFileSync(resolve(__dirname, f), 'utf8'));
const tokens = readFileSync(resolve(__dirname, '../styles/design-tokens.css'), 'utf8');
const COLOUR = /#[0-9a-f]{3,8}\b|\b(?:rgba?|hsla?)\(/i;

describe('Teleprompter theme', () => {
  test('no colour literal in the stylesheet or the components', () => {
    expect(stripTaskRefs(css)).not.toMatch(COLOUR);
    files.forEach((f) => expect(stripTaskRefs(f)).not.toMatch(COLOUR));
  });
  test('reader text pairs are 4.5:1 or better on the reading surface and the bars', () => {
    const bg = readToken([tokens], '--studio-prompter-bg');
    const bar = readToken([tokens], '--studio-prompter-bar');
    ['ink', 'cue', 'dim', 'mark', 'rec', 'ok'].forEach((k) => {
      const fg = readToken([tokens], `--studio-prompter-${k}`);
      expect(contrast(fg, bg)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(fg, bar)).toBeGreaterThanOrEqual(4.5);
    });
  });
});
