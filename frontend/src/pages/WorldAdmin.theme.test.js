/**
 * Producer Mode's chrome and its Overview wear the studio theme (audit
 * VISUAL-01, batch 4): the shared style object S and the Overview's
 * stylesheet set colors only through tokens. Since the shell redesign
 * (Evoni, 2026-10-05) the shared primary action is lavender and the sub-tabs
 * are underlined in the pink accent; WorldAdmin.accents.test.js guards the shell.
 */
import { describe, test, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { S } from './WorldAdmin';

const jsx = readFileSync(resolve(__dirname, 'WorldAdmin.jsx'), 'utf8');
const css = readFileSync(resolve(__dirname, 'WorldAdmin.css'), 'utf8');
const HEX = /#[0-9a-f]{3,6}\b/i;

describe('Producer Mode theme', () => {
  test('S sets colors only through tokens', () => {
    const literal = Object.entries(S).filter(([, v]) => typeof v !== 'function');
    for (const [key, style] of literal) {
      for (const [prop, val] of Object.entries(style)) {
        if (typeof val === 'string') expect({ key, prop, val }).not.toMatchObject({ val: expect.stringMatching(HEX) });
      }
    }
    expect(S.primaryBtn.background).toBe('var(--lala-lavender)');
    expect(S.primaryBtn.color).toBe('var(--text-inverse)');
    expect(S.card.background).toBe('var(--surface-card)');
    expect(S.cardTitle.color).toBe('var(--text-primary)');
  });

  test('the sub-tabs carry no inline colour', () => {
    const bar = jsx.slice(jsx.indexOf('{/* ─── SUB-TABS ─── */}'), jsx.indexOf('OVERVIEW ════'));
    expect(bar).toMatch(/className=\{`wa-subtab/);
    expect(bar).not.toMatch(HEX);
    expect(bar).not.toMatch(/style=\{\{/);
  });

  test('the Overview stylesheet (.sov-*) and the shell use tokens only, and the Overview button is the primary', () => {
    const sov = css.slice(css.indexOf('.sov-lala {'), css.indexOf('.sov-start button') + 200);
    expect(sov).not.toMatch(HEX);
    expect(sov).toMatch(/\.sov-btn\s*{[^}]*background:\s*var\(--primary\)/);
    const shell = css.slice(css.indexOf('.wa-hero {'), css.indexOf('/* A section that failed to load'));
    expect(shell.length).toBeGreaterThan(1000);
    expect(shell).not.toMatch(HEX);
  });
});
