/**
 * Producer Mode's shell to Evoni's redesign (2026-10-05; the pink accents
 * first came in 2026-10-05 from the episode page): a white show card with a
 * lavender-to-pink top line; the show as a lavender chip under inverse text;
 * the pill tabs in a soft pink band, the active pill pink with --accent-dark
 * text, the counts --accent-dark under inverse; the sub-tabs underlined in
 * --accent-dark; the shared primary action lavender. Pink is a line, a wash or
 * a fill under inverse text; every text pair reads 4.5:1. Cards keep their
 * pink top edge and border.
 */
import { describe, test, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { contrast, readToken } from '../styles/contrast';
import { S } from './WorldAdmin';

const jsx = readFileSync(resolve(__dirname, 'WorldAdmin.jsx'), 'utf8');
const css = readFileSync(resolve(__dirname, 'WorldAdmin.css'), 'utf8');
const tokens = readFileSync(resolve(__dirname, '../styles/design-tokens.css'), 'utf8');
const t = (name) => readToken([tokens], name);
const rule = (sel) => (css.match(new RegExp(`\\n${sel.replace(/[.]/g, '\\.')} \\{([^}]*)\\}`)) || [])[1] || '';

describe('Producer Mode shell', () => {
  test('the show card carries the lavender-to-pink line', () => {
    expect(rule('.wa-hero::before')).toMatch(/linear-gradient\(90deg, var\(--lala-lavender\), var\(--lala-lavender-light\), var\(--accent\)\)/);
    expect(rule('.wa-hero')).toMatch(/background: var\(--surface-card\)/);
    expect(jsx).toMatch(/<h1 className="wa-hero-title">Producer Mode<\/h1>/);
    expect(jsx).toMatch(/<Link className="wa-hero-back" to="\/shows">/);
  });

  test('the chips: the show lavender under inverse, the episode outlined lavender', () => {
    expect(rule('.wa-chip-show')).toMatch(/background: var\(--lala-lavender\); color: var\(--text-inverse\)/);
    expect(rule('.wa-chip-producing')).toMatch(/border: 1px solid var\(--lala-lavender\); color: var\(--lala-lavender-text\)/);
    expect(contrast(t('--text-inverse'), t('--lala-lavender'))).toBeGreaterThanOrEqual(4.5);
    expect(contrast(t('--lala-lavender-text'), t('--surface-card'))).toBeGreaterThanOrEqual(4.5);
    expect(contrast(t('--lala-lavender-text'), t('--lala-lavender-soft'))).toBeGreaterThanOrEqual(4.5);
    expect(contrast(t('--text-primary'), t('--lala-parchment-2'))).toBeGreaterThanOrEqual(4.5);
  });

  test('the pill tabs sit in a pink band; the active pill and the counts read', () => {
    expect(rule('.wa-tab-bar')).toMatch(/background: var\(--accent-subtle\); border: 1px solid var\(--accent-light\)/);
    expect(rule('.wa-tab-bar')).toMatch(/overflow-x: auto/);
    expect(rule('.wa-tab')).toMatch(/flex-shrink: 0; white-space: nowrap/);
    expect(rule('.wa-tab.active')).toMatch(/background: var\(--accent-subtle\); border: 2px solid var\(--accent\);[^}]*color: var\(--accent-dark\)/);
    expect(rule('.wa-tab-count')).toMatch(/background: var\(--accent-dark\); color: var\(--text-inverse\)/);
    expect(contrast(t('--accent-dark'), t('--accent-subtle'))).toBeGreaterThanOrEqual(4.5);
    expect(contrast(t('--text-inverse'), t('--accent-dark'))).toBeGreaterThanOrEqual(4.5);
    expect(contrast(t('--text-primary'), t('--surface-card'))).toBeGreaterThanOrEqual(4.5);
  });

  test('the sub-tabs are underlined in the pink accent', () => {
    expect(rule('.wa-subtab.active')).toMatch(/border-bottom-color: var\(--accent-dark\); color: var\(--text-primary\)/);
    expect(rule('.wa-subtab')).toMatch(/color: var\(--text-secondary\)/);
    expect(contrast(t('--text-secondary'), t('--surface-bg'))).toBeGreaterThanOrEqual(4.5);
  });

  test('the shared primary action is lavender under inverse text', () => {
    expect(S.primaryBtn.background).toBe('var(--lala-lavender)');
    expect(S.primaryBtn.color).toBe('var(--text-inverse)');
  });

  test('cards keep their pink top edge and border', () => {
    expect(jsx).toMatch(/card: \{[^}]*border: '1px solid var\(--accent-subtle\)', borderTop: '2px solid var\(--accent-light\)'/);
    expect(css).toMatch(/\.sov-card \{[^}]*border: 1px solid var\(--accent-subtle\); border-top: 2px solid var\(--accent-light\)/);
  });
});
