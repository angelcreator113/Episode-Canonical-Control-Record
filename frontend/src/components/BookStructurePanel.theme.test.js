/**
 * The WriteMode Book Structure panel wears the studio theme (theme batch 6,
 * the WriteMode panels, third screen; docs/VISUAL_SYSTEM.md §7): no hex or
 * rgba in its style block; every text colour is a token that reads 4.5:1 on
 * the panel's surfaces (the parchment, the white cards and inputs, the gold
 * pill wash, the parchment badge); gold is text only as --lala-gold-text and
 * a line as --lala-gold / --lala-gold-line; Save is --primary under
 * --text-inverse with a --primary-dark hover (it was ink under parchment,
 * like WriteMode's own Save before part one).
 */
import { describe, test, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { contrast, readToken, stripTaskRefs } from '../styles/contrast';

const jsx = readFileSync(resolve(__dirname, 'BookStructurePanel.jsx'), 'utf8');
const tokens = readFileSync(resolve(__dirname, '../styles/design-tokens.css'), 'utf8');
const t = (name) => readToken([tokens], name);
const rule = (sel) => (jsx.match(new RegExp(`\\${sel} \\{([^}]*)\\}`)) || [])[1] || '';

describe('WriteMode Book Structure panel: studio tokens', () => {
  test('no hex or rgba', () => {
    expect(stripTaskRefs(jsx)).not.toMatch(/#[0-9a-f]{3,8}\b/i);
    expect(jsx).not.toMatch(/rgba?\(/);
  });

  test('every text colour is one of the readable tokens', () => {
    const colours = [...jsx.matchAll(/(?:^|[\s;{])color:\s*([^;]+);/g)].map((m) => m[1].trim());
    expect(colours.length).toBeGreaterThan(30);
    const allowed = ['var(--text-primary)', 'var(--text-secondary)', 'var(--lala-gold-text)', 'var(--text-inverse)'];
    for (const c of colours) expect(allowed).toContain(c);
  });

  test('Save is teal under inverse text, its hover the dark teal', () => {
    expect(rule('.bsp-save-btn')).toMatch(/background: var\(--primary\);\s*color: var\(--text-inverse\);/);
    expect(jsx).toMatch(/\.bsp-save-btn:hover \{ background: var\(--primary-dark\); \}/);
    expect(contrast(t('--text-inverse'), t('--primary'))).toBeGreaterThanOrEqual(4.5);
    expect(contrast(t('--text-inverse'), t('--primary-dark'))).toBeGreaterThanOrEqual(4.5);
  });

  test('the text tokens read 4.5:1 on the panel surfaces', () => {
    for (const bg of ['--surface-bg', '--surface-card', '--lala-gold-soft', '--lala-parchment-2']) {
      for (const fg of ['--text-primary', '--text-secondary', '--lala-gold-text']) {
        expect(contrast(t(fg), t(bg)), `${fg} on ${bg}`).toBeGreaterThanOrEqual(4.5);
      }
    }
  });
});
