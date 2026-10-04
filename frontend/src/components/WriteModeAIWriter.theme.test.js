/**
 * The WriteMode AI Writer panel wears the studio theme (theme batch 6, the
 * WriteMode panels, first screen; docs/VISUAL_SYSTEM.md §7): no hex or rgba
 * literal; each character type is a token family whose text reads 4.5:1 on
 * white and on its own surface, and whose fill carries the Insert button's
 * inverse text at 4.5:1 (it was the accent under parchment, 2.5–4.2:1). The muted ink
 * reads 4.5:1 on the resting pill wash.
 */
import { describe, test, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { contrast, readToken, stripTaskRefs } from '../styles/contrast';
import { TYPE_TONES } from './WriteModeAIWriter';

const jsx = readFileSync(resolve(__dirname, 'WriteModeAIWriter.jsx'), 'utf8');
const tokens = readFileSync(resolve(__dirname, '../styles/design-tokens.css'), 'utf8');
const t = (v) => readToken([tokens], v.match(/^var\((--[a-z0-9-]+)\)$/)[1]);

describe('WriteMode AI Writer: studio tokens', () => {
  test('no hex or rgba colour literal', () => {
    expect(stripTaskRefs(jsx)).not.toMatch(/#[0-9a-f]{3,8}\b/i);
    expect(jsx).not.toMatch(/rgba?\(/);
    expect(jsx).not.toMatch(/\$\{accent\}/);
  });

  test('every type tone reads 4.5:1 as text and under inverse text', () => {
    expect(Object.keys(TYPE_TONES).sort()).toEqual(['mirror', 'pressure', 'shadow', 'special', 'support']);
    for (const [type, tone] of Object.entries(TYPE_TONES)) {
      for (const k of ['line', 'bg', 'text', 'fill']) expect(tone[k], `${type}.${k}`).toMatch(/^var\(--[a-z0-9-]+\)$/);
      expect(contrast(t(tone.text), t('var(--surface-card)')), `${type} text on white`).toBeGreaterThanOrEqual(4.5);
      expect(contrast(t(tone.text), t(tone.bg)), `${type} text on its surface`).toBeGreaterThanOrEqual(4.5);
      expect(contrast(t('var(--text-inverse)'), t(tone.fill)), `${type} fill under inverse`).toBeGreaterThanOrEqual(4.5);
    }
  });

  test('the Insert button is the tone fill under inverse text; muted ink reads on the pill wash', () => {
    expect(jsx).toMatch(/background: tone\.fill/);
    expect(jsx).toMatch(/insertBtn: \{[^}]*color:\s*'var\(--text-inverse\)'/);
    expect(contrast(t('var(--text-secondary)'), t('var(--lala-parchment-2)'))).toBeGreaterThanOrEqual(4.5);
  });
});
