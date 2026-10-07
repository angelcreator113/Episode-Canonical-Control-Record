/**
 * Edit show (Evoni, 2026-10-07) wears the Overlays and Scene Sets style:
 * tokens only, the primary action lavender, errors on the danger pair,
 * one column at phone width.
 */
import { describe, test, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { contrast, readToken, stripTaskRefs } from '../styles/contrast';

const jsx = readFileSync(resolve(__dirname, 'EditShow.jsx'), 'utf8');
const css = readFileSync(resolve(__dirname, 'EditShow.css'), 'utf8');
const tokens = readFileSync(resolve(__dirname, '../styles/design-tokens.css'), 'utf8');
const HEX = /#[0-9a-f]{3,8}\b/i;

describe('Edit show theme', () => {
  test('no hex colours in the page or its stylesheet (the show colour is data, from lib/showEdit)', () => {
    expect(stripTaskRefs(jsx)).not.toMatch(HEX);
    expect(css).not.toMatch(HEX);
    expect(jsx).not.toMatch(/CreateShow\.css/);
  });

  test('the save is lavender, errors read the danger pair, titles are prose', () => {
    expect(css).toMatch(/\.esh-btn\.is-primary \{[^}]*background: var\(--lala-lavender\); color: var\(--text-inverse\)/);
    expect(css).toMatch(/\.esh-error \{[^}]*background: var\(--danger-bg\); color: var\(--danger-text\)/);
    expect(css).toMatch(/\.esh-title \{[^}]*font-family: var\(--font-prose\)/);
    expect(css).toMatch(/@media \(max-width: 640px\) \{[\s\S]*\.esh-grid \{ grid-template-columns: minmax\(0, 1fr\); \}/);
  });

  test('every text pair holds 4.5:1 or better', () => {
    for (const [fg, bg] of [
      ['--text-inverse', '--lala-lavender'],
      ['--lala-lavender-text', '--lala-lavender-soft'],
      ['--lala-lavender-text', '--surface-card'],
      ['--danger-text', '--danger-bg'],
      ['--danger-text', '--surface-card'],
      ['--success-text', '--success-bg'],
      ['--lala-ink', '--surface-card'],
    ]) {
      expect(contrast(readToken([tokens], fg), readToken([tokens], bg))).toBeGreaterThanOrEqual(4.5);
    }
  });
});
