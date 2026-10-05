/**
 * WriteMode's Narrative Intelligence wears the studio theme (theme batch 6,
 * the WriteMode panels; docs/VISUAL_SYSTEM.md §7): no hex or rgba; each
 * suggestion type is a token family whose label reads 4.5:1 on its wash and
 * on white; every text colour reads on parchment and white; the Accept and
 * intimate-scene buttons carry inverse text at 4.5:1.
 */
import { describe, test, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { contrast, readToken, stripTaskRefs } from '../styles/contrast';

const jsx = readFileSync(resolve(__dirname, 'NarrativeIntelligence.jsx'), 'utf8');
const tokens = readFileSync(resolve(__dirname, '../styles/design-tokens.css'), 'utf8');
const t = (v) => readToken([tokens], v.replace(/^var\((--[a-z0-9-]+)\)$/, '$1'));

describe('WriteMode Narrative Intelligence: studio tokens', () => {
  test('no hex or rgba colour', () => {
    expect(stripTaskRefs(jsx)).not.toMatch(/#[0-9a-f]{3,8}\b/i);
    expect(jsx).not.toMatch(/rgba?\(/);
  });

  test('each suggestion type reads on its wash and on white', () => {
    const types = [...jsx.matchAll(/color:  '(var\([^']+\))',\n    icon:   '[^']+',\n    bg:     '(var\([^']+\))'/g)];
    expect(types).toHaveLength(6);
    for (const [, text, bg] of types) {
      expect(contrast(t(text), t(bg)), `${text} on ${bg}`).toBeGreaterThanOrEqual(4.5);
      expect(contrast(t(text), t('--surface-card'))).toBeGreaterThanOrEqual(4.5);
    }
  });

  test('every other text colour reads on parchment and white', () => {
    const colours = [...jsx.matchAll(/\bcolor: '(var\(--[a-z0-9-]+\))'/g)].map((m) => m[1]);
    expect(colours.length).toBeGreaterThan(15);
    for (const c of new Set(colours)) {
      if (c === 'var(--text-inverse)') continue;
      expect(contrast(t(c), t('--surface-bg')), `${c} on parchment`).toBeGreaterThanOrEqual(4.5);
      expect(contrast(t(c), t('--surface-card')), `${c} on white`).toBeGreaterThanOrEqual(4.5);
    }
  });

  test('the filled buttons carry inverse text', () => {
    for (const fill of ['--success-text', '--accent-dark']) {
      expect(jsx).toContain(`background: 'var(${fill})'`);
      expect(contrast(t('--text-inverse'), t(fill))).toBeGreaterThanOrEqual(4.5);
    }
  });
});
