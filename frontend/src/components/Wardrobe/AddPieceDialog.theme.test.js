/**
 * Add piece (Evoni, 2026-10-07) wears the Overlays and Scene Sets style:
 * colours only through tokens; the primary action lavender, errors on the
 * danger pair; every text pair holds 4.5:1.
 */
import { describe, test, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { contrast, readToken, stripTaskRefs } from '../../styles/contrast';

const jsx = readFileSync(resolve(__dirname, 'AddPieceDialog.jsx'), 'utf8');
const css = readFileSync(resolve(__dirname, 'AddPieceDialog.css'), 'utf8');
const tokens = readFileSync(resolve(__dirname, '../../styles/design-tokens.css'), 'utf8');
const HEX = /#[0-9a-f]{3,8}\b/i;

describe('Add piece theme', () => {
  test('no hex colours in the dialog or its stylesheet, and no DM Mono', () => {
    expect(stripTaskRefs(jsx)).not.toMatch(HEX);
    expect(css).not.toMatch(HEX);
    expect(css + jsx).not.toMatch(/DM Mono/);
  });

  test('the primary action is lavender; errors read the danger pair', () => {
    expect(css).toMatch(/\.apd-btn\.is-primary \{[^}]*background: var\(--lala-lavender\); color: var\(--text-inverse\)/);
    expect(css).toMatch(/\.apd-error \{[^}]*background: var\(--danger-bg\); color: var\(--danger-text\)/);
    expect(css).toMatch(/\.apd-title \{[^}]*font-family: var\(--font-prose\)/);
  });

  test('one column at phone width', () => {
    expect(css).toMatch(/@media \(max-width: 640px\) \{[\s\S]*\.apd-grid \{ grid-template-columns: minmax\(0, 1fr\); \}/);
  });

  test('every text pair holds 4.5:1 or better', () => {
    for (const [fg, bg] of [
      ['--text-inverse', '--lala-lavender'],
      ['--lala-lavender-text', '--lala-lavender-soft'],
      ['--lala-lavender-text', '--surface-card'],
      ['--danger-text', '--danger-bg'],
      ['--lala-ink', '--surface-card'],
    ]) {
      expect(contrast(readToken([tokens], fg), readToken([tokens], bg))).toBeGreaterThanOrEqual(4.5);
    }
  });
});
