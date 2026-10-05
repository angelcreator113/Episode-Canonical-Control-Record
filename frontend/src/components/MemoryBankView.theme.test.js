/**
 * The WriteMode Memory Bank wears the studio theme (theme batch 6, the
 * WriteMode panels, fourth screen; docs/VISUAL_SYSTEM.md §7): no hex or rgba
 * in the view or its stylesheet, and no colour through the Storyteller's
 * `--st-*` variables (StorytellerPage.css sets them on :root, so once that
 * page had loaded the bank's gold turned pink, #d4789a). Every memory type,
 * status and character type is a token family whose text reads 4.5:1 on
 * white and on its own surface; the primary action is --primary under
 * --text-inverse (it was gold under white, 3.3:1).
 */
import { describe, test, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { contrast, readToken, stripTaskRefs } from '../styles/contrast';

const jsx = readFileSync(resolve(__dirname, 'MemoryBankView.jsx'), 'utf8');
const css = readFileSync(resolve(__dirname, 'MemoryBankView.css'), 'utf8');
const tokens = readFileSync(resolve(__dirname, '../styles/design-tokens.css'), 'utf8');
const t = (name) => readToken([tokens], name);
const v = (ref) => t(ref.match(/^var\((--[a-z0-9-]+)\)$/)[1]);
const block = (src, sel) => (src.match(new RegExp(`\\n${sel.replace(/[.:]/g, '\\$&')} \\{([^}]*)\\}`)) || [])[1] || '';

// The tone table, read from the source (the view imports a stylesheet, so the
// test reads the literal table rather than importing the component).
const tones = Object.fromEntries([...jsx.matchAll(/^\s{2}(\w+):\s*\{ fill: '([^']+)', bg: '([^']+)', text: '([^']+)', line: '([^']+)' \},$/gm)]
  .map(([, k, fill, bg, text, line]) => [k, { fill, bg, text, line }]));

describe('WriteMode Memory Bank: studio tokens', () => {
  test('no hex or rgba in the view or the stylesheet, and no --st- colour', () => {
    expect(stripTaskRefs(jsx)).not.toMatch(/#[0-9a-f]{3,8}\b/i);
    expect(jsx).not.toMatch(/rgba?\(/);
    expect(stripTaskRefs(css)).not.toMatch(/#[0-9a-f]{3,8}\b/i);
    expect(css).not.toMatch(/rgba?\(/);
    expect(css).not.toMatch(/var\(--st-(?!mono|serif|sans)/);
  });

  test('every tone reads 4.5:1 as text on white and on its own surface', () => {
    expect(Object.keys(tones).sort()).toEqual(['danger', 'gold', 'info', 'lavender', 'neutral', 'success', 'teal', 'warning']);
    for (const [k, tone] of Object.entries(tones)) {
      expect(contrast(v(tone.text), t('--surface-card')), `${k} text on white`).toBeGreaterThanOrEqual(4.5);
      expect(contrast(v(tone.text), v(tone.bg)), `${k} text on its surface`).toBeGreaterThanOrEqual(4.5);
      expect(contrast(v(tone.text), t('--surface-bg')), `${k} text on parchment`).toBeGreaterThanOrEqual(4.5);
    }
  });

  test('every stylesheet text colour is a readable token', () => {
    const colours = [...css.matchAll(/(?:^|[\s;{])color:\s*([^;]+);/g)].map((m) => m[1].trim());
    expect(colours.length).toBeGreaterThan(30);
    const allowed = ['var(--text-primary)', 'var(--text-secondary)', 'var(--text-inverse)', 'var(--lala-gold-text)',
      'var(--danger-text)', 'var(--success-text)', 'var(--info-text)'];
    for (const c of colours) expect(allowed).toContain(c);
  });

  test('the primary action is teal under inverse text', () => {
    expect(block(css, '.mb-action-btn.primary')).toMatch(/background: var\(--primary\);[\s\S]*color: var\(--text-inverse\);/);
    expect(block(css, '.mb-action-btn.primary:hover')).toMatch(/background: var\(--primary-dark\);/);
    expect(contrast(t('--text-inverse'), t('--primary'))).toBeGreaterThanOrEqual(4.5);
    expect(contrast(t('--text-inverse'), t('--primary-dark'))).toBeGreaterThanOrEqual(4.5);
    // The extract hover is a gold fill under ink.
    expect(contrast(t('--text-primary'), t('--lala-gold'))).toBeGreaterThanOrEqual(4.5);
  });
});
