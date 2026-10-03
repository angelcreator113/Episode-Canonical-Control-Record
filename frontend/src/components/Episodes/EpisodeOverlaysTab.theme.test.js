/**
 * The Episode Overlays tab wears the studio theme (audit VISUAL-01/02,
 * batch 4, fifteenth screen): its stylesheet sets colors only through
 * tokens with no hex fallback; the title statuses read the success,
 * warning and ink families; the cost reads gold text (it was the gold
 * hover, 3.56:1); the transparency checkerboard is parchment on white.
 */
import { describe, test, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { contrast, readToken } from '../../styles/contrast';

const css = readFileSync(resolve(__dirname, 'EpisodeOverlaysTab.css'), 'utf8');
const jsx = readFileSync(resolve(__dirname, 'EpisodeOverlaysTab.jsx'), 'utf8');
const tokens = readFileSync(resolve(__dirname, '../../styles/design-tokens.css'), 'utf8');
const HEX = /#[0-9a-f]{3,8}\b/i;
const stripRefs = (s) => s.replace(/#\d{3,4}\b/g, '');

describe('Episode Overlays theme', () => {
  test('the stylesheet and the tab carry no color literal, not even as a var() fallback', () => {
    expect(stripRefs(css)).not.toMatch(HEX);
    expect(css).not.toMatch(/var\(--[a-z0-9-]+,\s*#/i);
    expect(stripRefs(jsx)).not.toMatch(HEX);
  });

  test('statuses, the cost and the checkerboard read the tokens', () => {
    expect(css).toMatch(/\.eot-status-approved \{ color: var\(--success-text\); border-color: var\(--success-border\); background: var\(--success-bg\); \}/);
    expect(css).toMatch(/\.eot-status-outdated \{ color: var\(--warning-text\); border-color: var\(--warning-border\); background: var\(--warning-bg\); \}/);
    expect(css).toMatch(/\.eot-status-not_made \{ color: var\(--text-secondary\); background: var\(--lala-parchment-2\); \}/);
    expect(css).toMatch(/\.eot-cost \{ color: var\(--lala-gold-text\); \}/);
    expect(css).toMatch(/repeating-conic-gradient\(var\(--lala-parchment-2\) 0% 25%, var\(--surface-card\) 0% 50%\)/);
    expect(css).not.toMatch(/(?<![-\w])color: var\(--lala-gold(?:-hover)?\)/);
  });

  test('every text pair the tab draws holds 4.5:1 or better', () => {
    const sources = [tokens];
    for (const [fg, bg] of [
      ['--success-text', '--success-bg'],
      ['--warning-text', '--warning-bg'],
      ['--text-secondary', '--lala-parchment-2'],
      ['--text-secondary', '--surface-card'],
      ['--danger-text', '--surface-card'],
      ['--lala-gold-text', '--surface-card'],
      ['--lala-ink', '--lala-parchment'],
    ]) {
      const ratio = contrast(readToken(sources, fg), readToken(sources, bg));
      expect({ fg, bg, ratio }).toMatchObject({ ratio: expect.any(Number) });
      expect(ratio).toBeGreaterThanOrEqual(4.5);
    }
    // The gold hover as text, the old cost color, kept below 4.5 so it is never reused.
    expect(contrast(readToken(sources, '--lala-gold-hover'), readToken(sources, '--surface-card'))).toBeLessThan(4.5);
  });
});
