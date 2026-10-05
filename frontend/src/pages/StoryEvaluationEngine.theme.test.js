/**
 * The Story Evaluation engine wears the studio theme (theme batch 6, the
 * Story Engine pages, first screen; docs/VISUAL_SYSTEM.md §7): its light
 * palette and its voices are tokens, every text key reads 4.5:1 on the
 * page's surfaces and on its own wash, and the gold actions are
 * --lala-gold-text under --text-inverse (they were #c9a96e under white,
 * 2.2:1). Two blocks keep literals: the dark palette (no dark tokens exist)
 * and the print export, which opens a window with no stylesheet.
 */
import { describe, test, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { contrast, readToken, stripTaskRefs } from '../styles/contrast';

const jsx = readFileSync(resolve(__dirname, 'StoryEvaluationEngine.jsx'), 'utf8');
const css = readFileSync(resolve(__dirname, 'StoryEvaluationEngine.css'), 'utf8');
const tokens = readFileSync(resolve(__dirname, '../styles/design-tokens.css'), 'utf8');
const v = (ref) => readToken([tokens], ref.match(/^var\((--[a-z0-9-]+)\)$/)[1]);
const objectBlock = (name) => (jsx.match(new RegExp(`const ${name} = \\{[\\s\\S]*?\\n\\};`)) || [''])[0];
const palette = (name) => Object.fromEntries([...objectBlock(name).matchAll(/^\s{2}(\w+):\s*'([^']+)',$/gm)].map(([, k, val]) => [k, val]));

const LIGHT = palette('T_LIGHT');
const live = jsx
  .replace(objectBlock('T_DARK'), '')
  .replace(objectBlock('PRINT_VOICE_INK'), '')
  .split('\n').filter((l) => !/parts\.push\(|printWin\.document\.write\(/.test(l)).join('\n');

describe('Story Evaluation engine: studio tokens', () => {
  test('no hex or rgba outside the dark palette and the print export', () => {
    expect(objectBlock('T_DARK')).not.toBe('');
    expect(objectBlock('PRINT_VOICE_INK')).not.toBe('');
    expect(stripTaskRefs(live)).not.toMatch(/#[0-9a-f]{3,8}\b/i);
    expect(live).not.toMatch(/rgba?\(/);
    expect(stripTaskRefs(css)).not.toMatch(/#[0-9a-f]{3,8}\b/i);
    expect(css).not.toMatch(/rgba?\(/);
  });

  test('no hex-alpha suffix on a token value', () => {
    expect(live).not.toMatch(/\$\{[\w.[\]? :]+\}[0-9a-f]{2}`/i);
  });

  test('every light key is a token, and the dark palette has the same keys', () => {
    for (const [k, val] of Object.entries(LIGHT)) expect(val, k).toMatch(/^var\(--[a-z0-9-]+\)$/);
    expect(Object.keys(palette('T_DARK')).sort()).toEqual(Object.keys(LIGHT).sort());
  });

  test('every text key reads 4.5:1 on the surfaces and on its own wash', () => {
    const surfaces = ['bg', 'surface', 'surfaceAlt'];
    const pairs = { text: null, textDim: 'faintSoft', textFaint: 'faintSoft', accent: 'accentSoft', red: 'redSoft',
      green: 'greenSoft', blue: 'blueSoft', purple: 'purpleSoft', orange: null };
    for (const [fg, wash] of Object.entries(pairs)) {
      for (const bg of surfaces) expect(contrast(v(LIGHT[fg]), v(LIGHT[bg])), `${fg} on ${bg}`).toBeGreaterThanOrEqual(4.5);
      if (wash) expect(contrast(v(LIGHT[fg]), v(LIGHT[wash])), `${fg} on ${wash}`).toBeGreaterThanOrEqual(4.5);
    }
    expect(contrast(v(LIGHT.onAccent), v(LIGHT.accentFill))).toBeGreaterThanOrEqual(4.5);
    expect(contrast(v(LIGHT.onAccent), v(LIGHT.green))).toBeGreaterThanOrEqual(4.5);
    expect(contrast(v(LIGHT.onAccent), v(LIGHT.blue))).toBeGreaterThanOrEqual(4.5);
    expect(contrast(v(LIGHT.onAccent), v(LIGHT.purple))).toBeGreaterThanOrEqual(4.5);
  });

  test('each voice reads 4.5:1 on white, on parchment and on its own surface', () => {
    const voices = [...jsx.matchAll(/accent: '(var\([^']+\))',\s*bg: '(var\([^']+\))',/g)];
    expect(voices).toHaveLength(3);
    for (const [, accent, bg] of voices) {
      expect(contrast(v(accent), v('var(--surface-card)'))).toBeGreaterThanOrEqual(4.5);
      expect(contrast(v(accent), v('var(--surface-bg)'))).toBeGreaterThanOrEqual(4.5);
      expect(contrast(v(accent), v(bg))).toBeGreaterThanOrEqual(4.5);
    }
  });

  test('gold actions are the gold-text fill under inverse text, never under literal white', () => {
    expect(live).not.toMatch(/background: T\.accent, color/);
    expect(live).toMatch(/background: disabled \? T\.border : T\.accentFill,\s*color: disabled \? T\.textDim : T\.onAccent,/);
    expect(live.match(/background: T\.accentFill, color: T\.onAccent,/g)).toHaveLength(3);
  });
});
