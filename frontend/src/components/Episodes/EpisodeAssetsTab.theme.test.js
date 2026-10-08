/**
 * The Episode Assets tab wears the studio theme (audit VISUAL-01/02,
 * batch 4, eleventh screen): the tab and its stylesheet set colors only
 * through tokens; the link, upload and promote buttons are the primary
 * (they were purple and amber gradients under white); the readiness
 * ring, bar and status badges read the success, warning, danger and
 * teal families. Redesigned 2026-10-08: lavender actions and status
 * pills, in EpisodeAssetsTab.css.
 */
import { describe, test, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { contrast, readToken, stripTaskRefs } from '../../styles/contrast';

const jsx = readFileSync(resolve(__dirname, 'EpisodeAssetsTab.jsx'), 'utf8');
const css = readFileSync(resolve(__dirname, 'EpisodeAssetsTab.css'), 'utf8');
const tokens = readFileSync(resolve(__dirname, '../../styles/design-tokens.css'), 'utf8');
const HEX = /#[0-9a-f]{3,8}\b/i;

describe('Episode Assets theme', () => {
  test('the tab and its stylesheet carry no color literal and no gradient', () => {
    expect(stripTaskRefs(jsx)).not.toMatch(HEX);
    expect(stripTaskRefs(css)).not.toMatch(HEX);
    expect(css).not.toMatch(/linear-gradient/);
  });

  // The Assets redesign (2026-10-08) moved the tab's styles into
  // EpisodeAssetsTab.css (.eat-*, and .etl-* for the to-do lists); the old,
  // unused rules in that file were replaced.
  test('the actions are the lavender', () => {
    expect(css).toMatch(/\.eat-btn \{[^}]*background: var\(--surface-card\);\s*color: var\(--lala-lavender-text\);/);
    expect(css).toMatch(/\.etl-btn-primary \{[^}]*background: var\(--lala-lavender\); color: var\(--text-inverse\);/);
    expect(jsx).toMatch(/className="eat-btn"[^>]*>\s*<Images/);
  });

  test('the statuses and the readiness bar read the token families', () => {
    expect(css).toMatch(/\.eat-pill\.is-approved \{ background: var\(--success-bg\); color: var\(--success-text\); \}/);
    expect(css).toMatch(/\.eat-pill\.is-generated \{ background: var\(--lala-lavender-soft\); color: var\(--lala-lavender-text\); \}/);
    expect(css).toMatch(/\.eat-pill\.is-pending \{ background: var\(--warning-bg\); color: var\(--warning-text\); \}/);
    expect(css).toMatch(/\.eat-pill\.is-missing \{ background: var\(--lala-parchment-2\); color: var\(--lala-ink-muted\); \}/);
    expect(jsx).toMatch(/const tone = pct >= 80 \? 'is-high' : pct >= 50 \? 'is-mid' : 'is-low';/);
    expect(css).toMatch(/\.eat-bar\.is-low span \{ background: var\(--danger\); \}/);
    expect(css).toMatch(/\.eat-bar\.is-mid span \{ background: var\(--warning\); \}/);
    expect(css).toMatch(/\.eat-bar\.is-high span \{ background: var\(--success\); \}/);
    // Gold is never text on white.
    expect(css).not.toMatch(/(?<![-\w])color: var\(--lala-gold\)/);
  });

  test('every text pair the tab draws holds 4.5:1 or better', () => {
    const sources = [tokens];
    for (const [fg, bg] of [
      ['--text-inverse', '--primary'],
      ['--primary-text', '--primary-subtle'],
      ['--success-text', '--success-bg'],
      ['--success-text', '--surface-card'],
      ['--warning-text', '--warning-bg'],
      ['--warning-text', '--surface-card'],
      ['--danger-text', '--surface-card'],
      ['--text-secondary', '--lala-parchment-2'],
      ['--text-secondary', '--surface-card'],
      ['--text-primary', '--surface-card'],
      ['--text-inverse', '--lala-lavender'],
      ['--lala-lavender-text', '--surface-card'],
      ['--lala-lavender-text', '--lala-lavender-soft'],
      ['--lala-ink', '--surface-card'],
      ['--lala-ink-muted', '--surface-card'],
      ['--lala-ink-muted', '--lala-parchment-2'],
      ['--lala-gold-text', '--lala-gold-soft'],
    ]) {
      const ratio = contrast(readToken(sources, fg), readToken(sources, bg));
      expect({ fg, bg, ratio }).toMatchObject({ ratio: expect.any(Number) });
      expect(ratio).toBeGreaterThanOrEqual(4.5);
    }
    // White on the old amber promote button, kept below 4.5 so it is never reused.
    expect(contrast('#ffffff', '#f59e0b')).toBeLessThan(4.5);
  });
});
