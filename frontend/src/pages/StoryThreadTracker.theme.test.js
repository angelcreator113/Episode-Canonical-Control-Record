/**
 * The Story Thread Tracker (StoryThreadTracker, /story-threads) wears the
 * studio theme (theme batch 6, the Story Engine pages, fourth screen;
 * docs/VISUAL_SYSTEM.md §7): no hex or rgba and no hex-alpha suffix; the
 * thread statuses and the continuity severities are token families in TONES
 * (a text twin, a wash, a line, a fill); every family reads 4.5:1 as text on
 * white, on the page's parchment and on its own wash (the old pastels were
 * 2.0–3.8:1 on white); the filled buttons carry --text-inverse at 4.5:1 (they
 * were the pastel gold and green under white, 2.2:1 and 2.0:1).
 */
import { describe, test, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { contrast, readToken, stripTaskRefs } from '../styles/contrast';
import { TONES, STATUS_TONES, SEVERITY_TONES } from './StoryThreadTracker';

const jsx = readFileSync(resolve(__dirname, 'StoryThreadTracker.jsx'), 'utf8');
const tokens = readFileSync(resolve(__dirname, '../styles/design-tokens.css'), 'utf8');
const t = (name) => readToken([tokens], name);
const v = (ref) => t(ref.match(/^var\((--[a-z0-9-]+)\)$/)[1]);

describe('Story Thread Tracker: studio tokens', () => {
  test('no hex, rgba or alpha-suffixed colour', () => {
    expect(stripTaskRefs(jsx)).not.toMatch(/#[0-9a-f]{3,8}\b/i);
    expect(jsx).not.toMatch(/rgba?\(/);
    expect(jsx).not.toMatch(/\}[0-9a-f]{2}`/i);
  });

  test('every family reads 4.5:1 as text on white, parchment and its own wash', () => {
    for (const [k, tone] of Object.entries(TONES)) {
      for (const key of ['text', 'soft', 'line', 'fill']) expect(tone[key], `${k}.${key}`).toMatch(/^var\(--[a-z0-9-]+\)$/);
      for (const bg of ['--surface-card', '--surface-bg', '--lala-parchment-2']) {
        expect(contrast(v(tone.text), t(bg)), `${k} text on ${bg}`).toBeGreaterThanOrEqual(4.5);
      }
      expect(contrast(v(tone.text), v(tone.soft)), `${k} text on its wash`).toBeGreaterThanOrEqual(4.5);
    }
  });

  test('statuses and severities take families', () => {
    const families = new Set(Object.values(TONES));
    expect(Object.keys(STATUS_TONES).sort()).toEqual(['active', 'dormant', 'dropped', 'resolved']);
    expect(Object.keys(SEVERITY_TONES).sort()).toEqual(['high', 'low', 'medium']);
    for (const tone of [...Object.values(STATUS_TONES), ...Object.values(SEVERITY_TONES)]) expect(families.has(tone)).toBe(true);
  });

  test('the filled buttons carry inverse text at 4.5:1', () => {
    expect(jsx).toMatch(/onFill: 'var\(--text-inverse\)'/);
    const fills = [...jsx.matchAll(/background: ([\w.]+), color: C\.onFill/g)].map((m) => m[1]);
    expect(fills.sort()).toEqual(['C.accent', 'TONES.success.fill', 'TONES.success.fill']);
    expect(contrast(t('--text-inverse'), v(TONES.gold.text))).toBeGreaterThanOrEqual(4.5);
    expect(contrast(t('--text-inverse'), v(TONES.success.fill))).toBeGreaterThanOrEqual(4.5);
  });
});
