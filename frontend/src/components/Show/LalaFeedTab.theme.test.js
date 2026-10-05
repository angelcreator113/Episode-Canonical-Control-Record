/**
 * Lala's Feed (Evoni's redesign, 2026-10-05) sets colours only through
 * tokens: lavender actions and the lavender feed bar under inverse text,
 * drafts on the warning family, live posts lavender.
 */
import { describe, test, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { contrast, readToken } from '../../styles/contrast';

const jsx = readFileSync(resolve(__dirname, 'LalaFeedTab.jsx'), 'utf8');
const css = readFileSync(resolve(__dirname, '../../pages/WorldAdmin.css'), 'utf8');
const tokens = readFileSync(resolve(__dirname, '../../styles/design-tokens.css'), 'utf8');
const lf = css.slice(css.indexOf("/* Lala's Feed (Evoni's redesign"));

describe("Lala's Feed theme", () => {
  test('colours only through tokens', () => {
    expect(jsx).not.toMatch(/#[0-9a-f]{3,8}\b/i);
    expect(lf).not.toMatch(/#[0-9a-f]{3,8}\b/i);
    expect(lf).toMatch(/\.wa-lf-primary \{[^}]*background: var\(--lala-lavender\); color: var\(--text-inverse\);/);
    expect(lf).toMatch(/\.wa-lf-status\.draft \{ background: var\(--warning-bg\); color: var\(--warning-text\); \}/);
    expect(lf).toMatch(/\.wa-lf-view\.active \{ background: var\(--accent-dark\); border-color: var\(--accent-dark\); color: var\(--text-inverse\); \}/);
  });

  test('every text pair holds 4.5:1 or better', () => {
    for (const [fg, bg] of [
      ['--text-inverse', '--lala-lavender'], ['--text-inverse', '--accent-dark'], ['--accent-dark', '--surface-card'],
      ['--accent-dark', '--accent-subtle'], ['--text-primary', '--lala-parchment'], ['--text-secondary', '--surface-card'],
      ['--warning-text', '--warning-bg'], ['--lala-lavender-text', '--lala-lavender-soft'], ['--lala-lavender-text', '--surface-card'],
      ['--danger-text', '--surface-card'], ['--success-text', '--lala-parchment'], ['--text-primary', '--lala-lavender-soft'],
    ]) {
      const ratio = contrast(readToken([tokens], fg), readToken([tokens], bg));
      expect({ fg, bg, ratio }).toMatchObject({ ratio: expect.any(Number) });
      expect(ratio).toBeGreaterThanOrEqual(4.5);
    }
  });
});
