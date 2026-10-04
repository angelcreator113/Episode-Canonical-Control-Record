/**
 * The Episode Money tab wears the studio theme (audit VISUAL-01/02,
 * batch 4, thirteenth screen): its stylesheet sets colors only through
 * tokens with no hex fallback; the one button is the primary (it was
 * gold under white); gold is a border or gold text; the chips read the
 * warning and success families; the positive tone is the success text.
 */
import { describe, test, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { contrast, readToken, stripTaskRefs } from '../../styles/contrast';

const css = readFileSync(resolve(__dirname, 'EpisodeMoneyTab.css'), 'utf8');
const jsx = readFileSync(resolve(__dirname, 'EpisodeMoneyTab.jsx'), 'utf8');
const spending = readFileSync(resolve(__dirname, 'EpisodeSpendingSection.jsx'), 'utf8');
const tokens = readFileSync(resolve(__dirname, '../../styles/design-tokens.css'), 'utf8');
const HEX = /#[0-9a-f]{3,8}\b/i;

describe('Episode Money theme', () => {
  test('the stylesheet and the components carry no color literal, not even as a var() fallback', () => {
    expect(stripTaskRefs(css)).not.toMatch(HEX);
    expect(css).not.toMatch(/var\(--[a-z0-9-]+,\s*#/i);
    expect(stripTaskRefs(jsx)).not.toMatch(HEX);
    expect(stripTaskRefs(spending)).not.toMatch(HEX);
  });

  test('the button is the primary and gold is never under white nor text', () => {
    expect(css).toMatch(/\.em-button\s*\{[^}]*background: var\(--primary\);\s*color: var\(--text-inverse\);/);
    expect(css).not.toMatch(/(?<![-\w])color: var\(--lala-gold\)/);
    expect(css).not.toMatch(/background: var\(--lala-gold\);[^}]*color: var\(--(?:text-inverse|lala-surface|surface-card)\)/);
    expect(css).toMatch(/--em-positive: var\(--success-text\);/);
  });

  test('the chips read the warning and success families', () => {
    expect(css).toMatch(/\.em-chip-pending \{ color: var\(--warning-text\); border-color: var\(--warning-border\); background: var\(--warning-bg\); \}/);
    expect(css).toMatch(/\.em-chip-posted \{ color: var\(--em-positive\); border-color: var\(--success-border\); background: var\(--success-bg\); \}/);
    expect(css).toMatch(/\.em-recon-chip-outstanding \{ color: var\(--warning-text\); border-color: var\(--warning-border\); background: var\(--warning-bg\); \}/);
    expect(css).toMatch(/\.em-chip-conditional \{[^}]*color: var\(--lala-gold-text\);/);
  });

  test('every text pair the tab draws holds 4.5:1 or better', () => {
    const sources = [tokens];
    for (const [fg, bg] of [
      ['--text-inverse', '--primary'],
      ['--success-text', '--success-bg'],
      ['--success-text', '--lala-surface'],
      ['--warning-text', '--warning-bg'],
      ['--lala-gold-text', '--lala-surface'],
      ['--lala-danger', '--lala-surface'],
      ['--lala-ink-muted', '--lala-surface'],
      ['--lala-ink-muted', '--lala-parchment-2'],
      ['--lala-ink', '--lala-parchment'],
    ]) {
      const ratio = contrast(readToken(sources, fg), readToken(sources, bg));
      expect({ fg, bg, ratio }).toMatchObject({ ratio: expect.any(Number) });
      expect(ratio).toBeGreaterThanOrEqual(4.5);
    }
    // White on gold, the old button, kept below 4.5 so it is never reused.
    expect(contrast(readToken(sources, '--text-inverse'), readToken(sources, '--lala-gold'))).toBeLessThan(4.5);
  });
});
