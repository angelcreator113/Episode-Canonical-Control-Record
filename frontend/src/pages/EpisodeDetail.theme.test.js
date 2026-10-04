/**
 * The Episode shell wears the studio theme (audit VISUAL-01/02, batch 4,
 * seventh screen): EpisodeDetail's stylesheet and page set colors only
 * through tokens, its --ed-* palette aliases the tokens (it was Tailwind
 * blue), the active tab and every primary action are teal (they were
 * pink, purple and blue gradients), and the sub-tab bar marks the active
 * tab with aria-current.
 */
import { describe, test, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { contrast, readToken, stripTaskRefs } from '../styles/contrast';

const css = readFileSync(resolve(__dirname, 'EpisodeDetail.css'), 'utf8');
const jsx = readFileSync(resolve(__dirname, 'EpisodeDetail.jsx'), 'utf8');
const tokens = readFileSync(resolve(__dirname, '../styles/design-tokens.css'), 'utf8');
const HEX = /#[0-9a-f]{3,8}\b/i;
// Task and issue references ("Task #2361", "since #534") are not colors.
// Every declaration block for a selector (the shell repeats selectors
// inside media queries), joined, so an assertion sees them all.
const rule = (selector) => {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`(?:^|[\\s,])${escaped}\\s*\\{`, 'g');
  const bodies = [];
  let m;
  while ((m = re.exec(css))) bodies.push(css.slice(m.index, css.indexOf('}', m.index)));
  if (!bodies.length) throw new Error(`rule missing: ${selector}`);
  return bodies.join('\n');
};

describe('Episode shell theme', () => {
  test('the stylesheet and the page carry no color literal, not even as a var() fallback or inside a gradient', () => {
    expect(stripTaskRefs(css)).not.toMatch(HEX);
    expect(css).not.toMatch(/var\(--[a-z0-9-]+,\s*#/i);
    expect(stripTaskRefs(jsx)).not.toMatch(HEX);
  });

  test('the page palette aliases the tokens', () => {
    const page = rule('.ed-page');
    expect(page).toMatch(/background: var\(--surface-bg\);/);
    expect(page).toMatch(/--ed-primary: var\(--primary\);/);
    expect(page).toMatch(/--ed-primary-dark: var\(--primary-dark\);/);
    expect(page).toMatch(/--ed-text: var\(--text-primary\);/);
    expect(page).toMatch(/--ed-muted: var\(--text-secondary\);/);
    expect(page).toMatch(/--ed-border: var\(--lala-parchment-3\);/);
    expect(page).toMatch(/--ed-danger: var\(--danger\);/);
    expect(page).toMatch(/--ed-success: var\(--success\);/);
  });

  test('the active tab and the primary actions are teal', () => {
    expect(css).toMatch(/\.ed-tab\.ed-tab-active\s*\{\s*color: var\(--primary-text\) !important;\s*background: var\(--primary-subtle\) !important;/);
    expect(css).not.toMatch(/\.ed-tab\.ed-tab-active[^{]*\{[^}]*(?<![-\w])color: var\(--accent[a-z-]*\)/);
    expect(rule('.ed-tab.is-active')).toMatch(/background: var\(--primary\);\s*color: var\(--text-inverse\);/);
    expect(rule('.ed-btn-primary-action')).toMatch(/background: var\(--primary\);\s*color: var\(--text-inverse\);/);
    expect(rule('.ed-btn-thumbnail')).toMatch(/background: var\(--primary\);/);
    expect(rule('.ed-show-link')).toMatch(/background: var\(--primary\);/);
    expect(css).not.toMatch(/(?<![-\w])color: var\(--accent\)/);
    expect(css).not.toMatch(/(?<![-\w])color: var\(--lala-gold\)/);
  });

  test('the sub-tab bar is teal and marks the active sub-tab with aria-current', () => {
    expect(jsx).toMatch(/aria-current=\{epSubTab === s\.key \? 'page' : undefined\}/);
    expect(jsx).toMatch(/borderBottom: epSubTab === s\.key \? '2px solid var\(--primary\)'/);
    expect(jsx).toMatch(/color: epSubTab === s\.key \? 'var\(--primary-text\)' : 'var\(--text-secondary\)'/);
  });

  test('the evaluation verdicts read text tokens on their surfaces', () => {
    expect(jsx).toMatch(/slay: \{ color: 'var\(--lala-gold-text\)', bg: 'var\(--lala-gold-soft\)'/);
    expect(jsx).toMatch(/pass: \{ color: 'var\(--success-text\)', bg: 'var\(--success-bg\)'/);
    expect(jsx).toMatch(/safe: \{ color: 'var\(--warning-text\)', bg: 'var\(--warning-bg\)'/);
    expect(jsx).toMatch(/fail: \{ color: 'var\(--danger-text\)', bg: 'var\(--danger-bg\)'/);
  });

  test('every text pair the shell draws holds 4.5:1 or better', () => {
    const sources = [tokens];
    for (const [fg, bg] of [
      ['--text-inverse', '--primary'],
      ['--text-inverse', '--primary-dark'],
      ['--primary-text', '--primary-subtle'],
      ['--primary-text', '--surface-card'],
      ['--text-primary', '--surface-bg'],
      ['--text-secondary', '--surface-bg'],
      ['--text-secondary', '--surface-card'],
      ['--lala-gold-text', '--lala-gold-soft'],
      ['--lala-gold-text', '--surface-card'],
      ['--success-text', '--success-bg'],
      ['--warning-text', '--warning-bg'],
      ['--danger-text', '--danger-bg'],
      ['--accent-dark', '--accent-subtle'],
      ['--primary-subtle', '--gray-900'],
      ['--lala-parchment-3', '--gray-800'],
    ]) {
      const ratio = contrast(readToken(sources, fg), readToken(sources, bg));
      expect({ fg, bg, ratio }).toMatchObject({ ratio: expect.any(Number) });
      expect(ratio).toBeGreaterThanOrEqual(4.5);
    }
    // The pairs the shell used to draw, kept below 4.5 so they are never
    // reused as text: the old pink tab text and the old blue primary.
    expect(contrast('#ec4899', '#ffffff')).toBeLessThan(4.5);
    expect(contrast('#ffffff', '#3b82f6')).toBeLessThan(4.5);
  });
});
