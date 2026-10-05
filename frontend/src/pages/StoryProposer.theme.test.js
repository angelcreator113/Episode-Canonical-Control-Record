/**
 * The Scene Proposer (StoryProposer, /scene-proposer) wears the studio theme
 * (theme batch 6, the Story Engine pages, third screen; docs/VISUAL_SYSTEM.md
 * §7): no hex or rgba; every scene type and tone is a token family in TONES
 * (a text twin, a wash, a line, a fill) in place of a hex with an alpha
 * suffix; each family's text reads 4.5:1 on white, on the page's parchment
 * and on its own wash; the primary actions are --primary under
 * --text-inverse (they were ink under parchment).
 */
import { describe, test, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { contrast, readToken, stripTaskRefs } from '../styles/contrast';
import { TONES, SCENE_TYPE_CONFIG, TONE_CONFIG } from './StoryProposer';

const jsx = readFileSync(resolve(__dirname, 'StoryProposer.jsx'), 'utf8');
const tokens = readFileSync(resolve(__dirname, '../styles/design-tokens.css'), 'utf8');
const t = (name) => readToken([tokens], name);
const v = (ref) => t(ref.match(/^var\((--[a-z0-9-]+)\)$/)[1]);

describe('Scene Proposer: studio tokens', () => {
  test('no hex, rgba or alpha-suffixed colour', () => {
    expect(stripTaskRefs(jsx)).not.toMatch(/#[0-9a-f]{3,8}\b/i);
    expect(jsx).not.toMatch(/rgba?\(/);
    expect(jsx).not.toMatch(/\}[0-9a-f]{2}`/i);
    expect(jsx).not.toMatch(/\+ '[0-9a-f]{2}'/i);
  });

  test('every family reads 4.5:1 as text on white, parchment and its own wash', () => {
    expect(Object.keys(TONES).sort()).toEqual(['danger', 'gold', 'info', 'lavender', 'neutral', 'success', 'warning']);
    for (const [k, tone] of Object.entries(TONES)) {
      for (const key of ['text', 'soft', 'line', 'fill']) expect(tone[key], `${k}.${key}`).toMatch(/^var\(--[a-z0-9-]+\)$/);
      for (const bg of ['--surface-card', '--surface-bg', '--lala-parchment-2']) {
        expect(contrast(v(tone.text), t(bg)), `${k} text on ${bg}`).toBeGreaterThanOrEqual(4.5);
      }
      expect(contrast(v(tone.text), v(tone.soft)), `${k} text on its wash`).toBeGreaterThanOrEqual(4.5);
    }
  });

  test('every scene type and tone takes a family', () => {
    const families = new Set(Object.values(TONES));
    expect(Object.keys(SCENE_TYPE_CONFIG)).toHaveLength(8);
    expect(Object.keys(TONE_CONFIG)).toHaveLength(5);
    for (const conf of [...Object.values(SCENE_TYPE_CONFIG), ...Object.values(TONE_CONFIG)]) {
      expect(families.has(conf.tone), conf.label).toBe(true);
      expect(conf.color, conf.label).toBeUndefined();
    }
  });

  test('the primary actions are teal under inverse text', () => {
    expect(jsx).toMatch(/action:\s+'var\(--primary\)'/);
    expect(jsx).toMatch(/onAction:\s+'var\(--text-inverse\)'/);
    expect(jsx.match(/background: C\.action, border: 'none'/g)).toHaveLength(2);
    expect(jsx).toMatch(/background: accepting \? C\.bgDeep : C\.action,/);
    expect(jsx).not.toMatch(/color: C\.bg\b/);
    expect(contrast(t('--text-inverse'), t('--primary'))).toBeGreaterThanOrEqual(4.5);
  });
});
