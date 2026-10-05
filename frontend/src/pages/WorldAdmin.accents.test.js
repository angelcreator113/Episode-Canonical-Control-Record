/**
 * Producer Mode wears the episode page's soft pink accents (Evoni,
 * 2026-10-05): the header's teal-to-pink line, a pink top edge and border
 * on the cards, the context bar's pink border and left edge, the tab row's
 * pink rule. Pink is a line or a wash, never under text; actions and the
 * active tab stay teal.
 */
import { describe, test, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const jsx = readFileSync(resolve(__dirname, 'WorldAdmin.jsx'), 'utf8');
const css = readFileSync(resolve(__dirname, 'WorldAdmin.css'), 'utf8');

describe('Producer Mode: soft pink accents', () => {
  test('the header carries the teal-to-pink line', () => {
    expect(css).toMatch(/\.wa-header::before \{[^}]*linear-gradient\(90deg, var\(--primary\), var\(--accent\)\)/);
  });
  test('cards have a pink top edge and border', () => {
    expect(jsx).toMatch(/card: \{[^}]*border: '1px solid var\(--accent-subtle\)', borderTop: '2px solid var\(--accent-light\)'/);
    expect(css).toMatch(/\.sov-card \{[^}]*border: 1px solid var\(--accent-subtle\); border-top: 2px solid var\(--accent-light\)/);
  });
  test('the context bar has the planning card\'s pink border and edge', () => {
    expect(css).toMatch(/\.wa-context-bar \{[^}]*border: 1px solid var\(--accent-light\); border-left: 4px solid var\(--accent-light\)/);
  });
  test('the active tab and the primary action stay teal', () => {
    expect(jsx).toMatch(/tabActive: \{[^}]*borderBottom: '2px solid var\(--primary\)'/);
    expect(jsx).toMatch(/primaryBtn: \{[^}]*background: 'var\(--primary\)'/);
  });
});
