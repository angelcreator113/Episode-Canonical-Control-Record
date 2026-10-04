/**
 * The Episode Scenes tab wears the studio theme (audit VISUAL-01/02,
 * batch 4, tenth screen): its stylesheet sets colors only through
 * tokens; the primary and picker-check are teal (they were indigo), the
 * accent button is the teal tint, the focus outline is the primary, and
 * gold is a border, a tint or gold text, never under white.
 */
import { describe, test, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { contrast, readToken, stripTaskRefs } from '../../styles/contrast';

const css = readFileSync(resolve(__dirname, 'EpisodeScenesTab.css'), 'utf8');
const jsx = readFileSync(resolve(__dirname, 'EpisodeScenesTab.jsx'), 'utf8');
const tokens = readFileSync(resolve(__dirname, '../../styles/design-tokens.css'), 'utf8');
const HEX = /#[0-9a-f]{3,8}\b/i;
const rule = (selector) => {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const m = new RegExp(`(?:^|[\\s,])${escaped}\\s*\\{`).exec(css);
  if (!m) throw new Error(`rule missing: ${selector}`);
  return css.slice(m.index, css.indexOf('}', m.index));
};

describe('Episode Scenes theme', () => {
  test('the stylesheet and the tab carry no color literal', () => {
    expect(stripTaskRefs(css)).not.toMatch(HEX);
    expect(stripTaskRefs(jsx)).not.toMatch(HEX);
    expect(css).not.toMatch(/linear-gradient/);
  });

  test('the primary, the picker check and the focus outline are teal; the accent button is the teal tint', () => {
    expect(rule('.est-btn-primary')).toMatch(/background: var\(--primary\);\s*color: var\(--text-inverse\);/);
    expect(rule('.est-btn-primary:hover')).toMatch(/background: var\(--primary-dark\);/);
    expect(rule('.est-btn-accent')).toMatch(/background: var\(--primary-subtle\);\s*color: var\(--primary-text\);/);
    expect(rule('.est-picker-check')).toMatch(/background: var\(--primary\);\s*color: var\(--text-inverse\);/);
    expect(css).toMatch(/\.est-beat-main:focus-visible \{ outline: 2px solid var\(--primary\);/);
    expect(css).not.toMatch(/(?<![-\w])color: var\(--lala-gold\)/);
    expect(css).not.toMatch(/background: var\(--lala-gold\);[^}]*color: var\(--text-inverse\)/);
  });

  test('badges and notes read text tokens on their surfaces', () => {
    expect(css).toMatch(/\.est-badge\.is-locked \{ background: var\(--lala-gold-soft\); color: var\(--lala-gold-text\);/);
    expect(css).toMatch(/\.est-badge\.is-chosen \{ background: var\(--text-primary\); color: var\(--surface-bg\); \}/);
    expect(rule('.est-warning')).toMatch(/background: var\(--warning-bg\);\s*color: var\(--warning-text\);/);
    expect(rule('.est-picker-linked-badge')).toMatch(/background: var\(--text-secondary\);\s*color: var\(--text-inverse\);/);
  });

  test('every text pair the tab draws holds 4.5:1 or better', () => {
    const sources = [tokens];
    for (const [fg, bg] of [
      ['--text-inverse', '--primary'],
      ['--text-inverse', '--primary-dark'],
      ['--text-inverse', '--text-secondary'],
      ['--surface-bg', '--text-primary'],
      ['--primary-text', '--primary-subtle'],
      ['--lala-gold-text', '--lala-gold-soft'],
      ['--lala-gold-text', '--surface-card'],
      ['--warning-text', '--warning-bg'],
      ['--danger-text', '--danger-bg'],
      ['--text-primary', '--surface-bg'],
      ['--text-secondary', '--lala-parchment-2'],
      ['--text-secondary', '--surface-card'],
    ]) {
      const ratio = contrast(readToken(sources, fg), readToken(sources, bg));
      expect({ fg, bg, ratio }).toMatchObject({ ratio: expect.any(Number) });
      expect(ratio).toBeGreaterThanOrEqual(4.5);
    }
    // White on the old indigo primary, kept below 4.5 so it is never reused.
    expect(contrast('#ffffff', '#6366f1')).toBeLessThan(4.5);
  });
});
