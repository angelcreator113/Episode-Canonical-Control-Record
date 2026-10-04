/**
 * The WriteMode Scenes panel wears the studio theme (theme batch 6, the
 * WriteMode panels, second screen; docs/VISUAL_SYSTEM.md §7): no hex, rgba
 * or gradient in its style block; every text colour is a token that reads
 * 4.5:1 on the surfaces the panel uses (the parchment, the white AI cards,
 * the gold wash of the AI results, the success and danger washes). Gold is
 * text only as --lala-gold-text, never dimmed by opacity; the scene dinkus
 * is a glyph and stays gold.
 */
import { describe, test, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { contrast, readToken, stripTaskRefs } from '../styles/contrast';

const jsx = readFileSync(resolve(__dirname, 'ScenesPanel.jsx'), 'utf8');
const tokens = readFileSync(resolve(__dirname, '../styles/design-tokens.css'), 'utf8');
const t = (name) => readToken([tokens], name);
const rule = (sel) => (jsx.match(new RegExp(`\\${sel} \\{([^}]*)\\}`)) || [])[1] || '';

describe('WriteMode Scenes panel: studio tokens', () => {
  test('no hex, rgba or gradient', () => {
    expect(stripTaskRefs(jsx)).not.toMatch(/#[0-9a-f]{3,8}\b/i);
    expect(jsx).not.toMatch(/rgba?\(/);
    expect(jsx).not.toMatch(/gradient\(/);
  });

  test('every text colour is one of the readable tokens', () => {
    const colours = [...jsx.matchAll(/(?:^|[\s;{])color:\s*([^;]+);/g)].map((m) => m[1].trim());
    expect(colours.length).toBeGreaterThan(30);
    const allowed = ['var(--text-primary)', 'var(--text-secondary)', 'var(--lala-gold-text)',
      'var(--danger-text)', 'var(--success-text)', 'var(--lala-gold)'];
    for (const c of colours) expect(allowed).toContain(c);
    // Gold as a colour is only the dinkus glyph.
    expect(colours.filter((c) => c === 'var(--lala-gold)')).toHaveLength(1);
    expect(rule('.scenes-panel-scene-dinkus')).toMatch(/color: var\(--lala-gold\)/);
  });

  test('the AI plan button is full-strength gold text, not dimmed', () => {
    expect(rule('.scenes-panel-ai-plan-btn')).toMatch(/color: var\(--lala-gold-text\)/);
    expect(rule('.scenes-panel-ai-plan-btn')).not.toMatch(/opacity/);
  });

  test('the text tokens read 4.5:1 on the panel surfaces', () => {
    for (const bg of ['--surface-bg', '--surface-card', '--lala-gold-soft', '--lala-parchment-2']) {
      for (const fg of ['--text-primary', '--text-secondary', '--lala-gold-text']) {
        expect(contrast(t(fg), t(bg)), `${fg} on ${bg}`).toBeGreaterThanOrEqual(4.5);
      }
    }
    expect(contrast(t('--success-text'), t('--success-bg'))).toBeGreaterThanOrEqual(4.5);
    expect(contrast(t('--danger-text'), t('--danger-bg'))).toBeGreaterThanOrEqual(4.5);
  });
});
