/**
 * WriteMode's Continuity Guard wears the studio theme (theme batch 6, the
 * WriteMode panels; docs/VISUAL_SYSTEM.md §7): no hex or rgba; every text
 * colour reads 4.5:1 on parchment and white; the count badge and each
 * rewrite option's Accept fill carry inverse text at 4.5:1.
 */
import { describe, test, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { contrast, readToken, stripTaskRefs } from '../styles/contrast';

const jsx = readFileSync(resolve(__dirname, 'ContinuityGuard.jsx'), 'utf8');
const tokens = readFileSync(resolve(__dirname, '../styles/design-tokens.css'), 'utf8');
const t = (v) => readToken([tokens], v.replace(/^var\((--[a-z0-9-]+)\)$/, '$1'));

describe('WriteMode Continuity Guard: studio tokens', () => {
  test('no hex or rgba colour', () => {
    expect(stripTaskRefs(jsx)).not.toMatch(/#[0-9a-f]{3,8}\b/i);
    expect(jsx).not.toMatch(/rgba?\(/);
  });

  test('every text colour reads on parchment and white', () => {
    const colours = [...jsx.matchAll(/\bcolor:\s*'(var\(--[a-z0-9-]+\))'/g)].map((m) => m[1]);
    expect(colours.length).toBeGreaterThan(20);
    for (const c of new Set(colours)) {
      if (c === 'var(--text-inverse)') continue;
      expect(contrast(t(c), t('--surface-bg')), `${c} on parchment`).toBeGreaterThanOrEqual(4.5);
      expect(contrast(t(c), t('--surface-card')), `${c} on white`).toBeGreaterThanOrEqual(4.5);
    }
  });

  test('the badge and the Accept fills carry inverse text', () => {
    const fills = [...jsx.matchAll(/fill:\s*'(var\(--[a-z0-9-]+\))'/g)].map((m) => m[1]);
    expect(fills).toHaveLength(3);
    for (const f of [...fills, 'var(--danger)', 'var(--success-text)']) {
      expect(contrast(t('--text-inverse'), t(f)), `inverse on ${f}`).toBeGreaterThanOrEqual(4.5);
    }
    expect(jsx).toMatch(/background: config\.fill/);
  });
});
