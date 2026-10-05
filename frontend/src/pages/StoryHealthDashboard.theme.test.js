/**
 * The Story Health dashboard wears the studio theme (theme batch 6, the Story
 * Engine pages, second screen; docs/VISUAL_SYSTEM.md §7): no hex or rgba in
 * the page or its own stylesheet; it no longer imports StoryEngine.css,
 * whose .se-page (100dvh, overflow hidden) cut the page off below the
 * velocity chart; every stat number and phase name is a text token that reads
 * 4.5:1 on white, and every other text colour reads 4.5:1 on the page's
 * surfaces (the stat numbers were 2.2–4.5:1, three of the four phase names
 * 2.3–3.7:1, the greys 1.5–3.5:1).
 */
import { describe, test, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { contrast, readToken, stripTaskRefs } from '../styles/contrast';
import { PHASE_TONES, STAT_TONES } from './StoryHealthDashboard';

const jsx = readFileSync(resolve(__dirname, 'StoryHealthDashboard.jsx'), 'utf8');
const css = readFileSync(resolve(__dirname, 'StoryHealthDashboard.css'), 'utf8');
const tokens = readFileSync(resolve(__dirname, '../styles/design-tokens.css'), 'utf8');
const t = (name) => readToken([tokens], name);
const v = (ref) => t(ref.match(/^var\((--[a-z0-9-]+)\)$/)[1]);
const surfaces = ['--surface-card', '--surface-bg'];

describe('Story Health dashboard: studio tokens', () => {
  test('no hex or rgba in the page or its stylesheet', () => {
    expect(stripTaskRefs(jsx)).not.toMatch(/#[0-9a-f]{3,8}\b/i);
    expect(jsx).not.toMatch(/rgba?\(/);
    expect(stripTaskRefs(css)).not.toMatch(/#[0-9a-f]{3,8}\b/i);
    expect(css).not.toMatch(/rgba?\(/);
  });

  test('the page has its own stylesheet and scrolls with the app', () => {
    expect(jsx).not.toMatch(/StoryEngine\.css/);
    expect(jsx).toMatch(/import '\.\/StoryHealthDashboard\.css';/);
    expect(jsx).not.toMatch(/se-page|var\(--se-/);
    expect(css).not.toMatch(/\.shd-page \{[^}]*overflow/);
    expect(css).not.toMatch(/100dvh|100vh/);
  });

  test('every stat number and phase name reads 4.5:1 on white and parchment', () => {
    expect(Object.keys(STAT_TONES)).toHaveLength(8);
    expect(new Set(Object.values(STAT_TONES)).size).toBe(8);
    expect(Object.keys(PHASE_TONES).sort()).toEqual(['crisis', 'establishment', 'integration', 'pressure']);
    const texts = [...Object.values(STAT_TONES), ...Object.values(PHASE_TONES).map((p) => p.text)];
    for (const ref of texts) {
      for (const bg of surfaces) expect(contrast(v(ref), t(bg)), `${ref} on ${bg}`).toBeGreaterThanOrEqual(4.5);
    }
  });

  test('every stylesheet text colour is a readable token', () => {
    const colours = [...css.matchAll(/(?:^|[\s;{])color:\s*([^;]+);/g)].map((m) => m[1].trim());
    expect(colours.length).toBeGreaterThan(10);
    for (const c of colours) {
      expect(['var(--text-primary)', 'var(--text-secondary)']).toContain(c);
      for (const bg of [...surfaces, '--lala-parchment-2']) {
        expect(contrast(v(c), t(bg)), `${c} on ${bg}`).toBeGreaterThanOrEqual(4.5);
      }
    }
  });
});
