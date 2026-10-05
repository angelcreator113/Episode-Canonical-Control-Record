/**
 * WriteMode's Lala panel wears the studio theme (theme batch 6, the WriteMode
 * panels; docs/VISUAL_SYSTEM.md §7). It sits on WriteMode's parchment but was
 * written for a dark surface: cream text at 0.15-0.7 alpha, about 1:1 on
 * parchment. Now: no hex or rgba; every text colour a readable token; each
 * canon tier a token family; the toast fills carry inverse text at 4.5:1.
 */
import { describe, test, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { contrast, readToken, stripTaskRefs } from '../styles/contrast';

const jsx = readFileSync(resolve(__dirname, 'LalaSceneDetection.jsx'), 'utf8');
const tokens = readFileSync(resolve(__dirname, '../styles/design-tokens.css'), 'utf8');
const t = (v) => readToken([tokens], v.replace(/^var\((--[a-z0-9-]+)\)$/, '$1'));

describe('WriteMode Lala panel: studio tokens', () => {
  test('no hex or rgba colour', () => {
    expect(stripTaskRefs(jsx)).not.toMatch(/#[0-9a-f]{3,8}\b/i);
    expect(jsx).not.toMatch(/rgba?\(/);
  });

  test('every text colour reads 4.5:1 on parchment and white', () => {
    const colours = [...jsx.matchAll(/color:\s*'(var\(--[a-z0-9-]+\))'/g)].map((m) => m[1]);
    const consts = [...jsx.matchAll(/const GOLD\s*=\s*'(var\(--[a-z0-9-]+\))'/g)].map((m) => m[1]);
    expect(colours.length).toBeGreaterThan(15);
    for (const c of new Set([...colours, ...consts])) {
      if (c === 'var(--text-inverse)') continue;
      expect(contrast(t(c), t('--surface-bg')), `${c} on parchment`).toBeGreaterThanOrEqual(4.5);
      expect(contrast(t(c), t('--surface-card')), `${c} on white`).toBeGreaterThanOrEqual(4.5);
    }
  });

  test('each canon tier reads on its own surface', () => {
    const tones = [...jsx.matchAll(/tone: \{ line: '([^']+)',\s*bg: '([^']+)',\s*text: '([^']+)' \}/g)];
    expect(tones).toHaveLength(4);
    for (const [, , bg, text] of tones) expect(contrast(t(text), t(bg))).toBeGreaterThanOrEqual(4.5);
  });

  test('the toast fills carry inverse text', () => {
    for (const fill of ['--danger', '--info-text', '--success-text']) {
      expect(jsx).toContain(`'var(${fill})'`);
      expect(contrast(t('--text-inverse'), t(fill))).toBeGreaterThanOrEqual(4.5);
    }
  });
});
