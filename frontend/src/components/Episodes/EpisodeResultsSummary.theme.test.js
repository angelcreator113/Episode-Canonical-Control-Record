/**
 * Results as one page (Evoni's Episode mock, 2026-10-05) sets colors only
 * through tokens: lavender for how it went and the actions, pink for
 * Lala's stats and goals, amber for a missing teaser; every text pair it
 * draws holds 4.5:1.
 */
import { describe, test, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { contrast, readToken, stripTaskRefs } from '../../styles/contrast';

const jsx = readFileSync(resolve(__dirname, 'EpisodeResultsSummary.jsx'), 'utf8');
const css = readFileSync(resolve(__dirname, 'EpisodeResultsSummary.css'), 'utf8');
const tokens = readFileSync(resolve(__dirname, '../../styles/design-tokens.css'), 'utf8');
const HEX = /#[0-9a-f]{3,8}\b/i;

describe('Results summary theme', () => {
  test('no color literal; the families are the tokens', () => {
    expect(stripTaskRefs(jsx)).not.toMatch(HEX);
    expect(stripTaskRefs(css)).not.toMatch(HEX);
    expect(css).toMatch(/\.ers-primary \{[^}]*background: var\(--lala-lavender\); color: var\(--text-inverse\);/);
    expect(css).toMatch(/\.ers \.ers-label-pink \{ color: var\(--accent-dark\); \}/);
    expect(css).toMatch(/\.ers-teaser\.is-missing \{ border-color: var\(--warning-border\); background: var\(--warning-bg\); \}/);
  });

  test('every text pair holds 4.5:1', () => {
    for (const [fg, bg] of [
      ['--text-inverse', '--lala-lavender'],
      ['--lala-lavender-text', '--surface-card'],
      ['--lala-lavender-text', '--lala-lavender-soft'],
      ['--accent-dark', '--surface-card'],
      ['--lala-ink-muted', '--surface-card'],
      ['--lala-ink-muted', '--warning-bg'],
      ['--warning-text', '--warning-bg'],
      ['--success-text', '--surface-card'],
      ['--danger-text', '--surface-card'],
    ]) {
      const ratio = contrast(readToken([tokens], fg), readToken([tokens], bg));
      expect({ fg, bg, ratio }).toMatchObject({ ratio: expect.any(Number) });
      expect(ratio).toBeGreaterThanOrEqual(4.5);
    }
  });
});
