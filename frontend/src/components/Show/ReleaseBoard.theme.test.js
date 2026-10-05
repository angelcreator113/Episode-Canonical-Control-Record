/**
 * Release → Next release (Evoni's redesign, 2026-10-05) sets colours only
 * through tokens: the checklist's ready bar is lavender and in progress
 * pink; draft posts read the warning family and live ones lavender; tiers
 * read the lavender, pink, warning and danger families with text twins.
 */
import { describe, test, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { contrast, readToken } from '../../styles/contrast';

const jsx = readFileSync(resolve(__dirname, 'ReleaseBoard.jsx'), 'utf8');
const css = readFileSync(resolve(__dirname, '../../pages/WorldAdmin.css'), 'utf8');
const tokens = readFileSync(resolve(__dirname, '../../styles/design-tokens.css'), 'utf8');
const rel = css.slice(css.indexOf('/* Release → Next release'));

describe('Release board theme', () => {
  test('colours only through tokens', () => {
    expect(jsx).not.toMatch(/#[0-9a-f]{3,8}\b/i);
    expect(rel).not.toMatch(/#[0-9a-f]{3,8}\b/i);
    expect(rel).toMatch(/\.wa-rel-ready li\.state-ready \{ border-top-color: var\(--lala-lavender\); \}/);
    expect(rel).toMatch(/\.wa-rel-ready li\.state-progress \{ border-top-color: var\(--accent\); \}/);
    expect(rel).toMatch(/\.wa-rel-status\.draft \{ background: var\(--warning-bg\); color: var\(--warning-text\); \}/);
  });

  test('every text pair holds 4.5:1 or better', () => {
    for (const [fg, bg] of [
      ['--text-primary', '--accent-subtle'], ['--text-secondary', '--accent-subtle'], ['--accent-dark', '--accent-subtle'],
      ['--text-primary', '--surface-card'], ['--text-secondary', '--surface-card'], ['--lala-lavender-text', '--surface-card'],
      ['--lala-lavender-text', '--lala-lavender-soft'], ['--warning-text', '--warning-bg'], ['--danger-text', '--danger-bg'],
      ['--text-primary', '--lala-parchment'], ['--text-secondary', '--lala-parchment'], ['--lala-lavender-text', '--lala-parchment'],
      ['--text-secondary', '--lala-parchment-2'],
    ]) {
      const ratio = contrast(readToken([tokens], fg), readToken([tokens], bg));
      expect({ fg, bg, ratio }).toMatchObject({ ratio: expect.any(Number) });
      expect(ratio).toBeGreaterThanOrEqual(4.5);
    }
  });
});
