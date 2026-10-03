/**
 * Producer Mode's chrome and its Overview wear the studio theme (audit
 * VISUAL-01, batch 4): the shared style object S and the Overview's
 * stylesheet set colors only through tokens, the primary action is
 * --primary, and the sub-tab bar is teal, not indigo.
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
    expect(S.primaryBtn.background).toBe('var(--primary)');
    expect(S.tabActive.borderBottom).toBe('2px solid var(--primary)');
    expect(S.card.background).toBe('var(--surface-card)');
    expect(S.cardTitle.color).toBe('var(--text-primary)');
  });

  test('the sub-tab bar is teal', () => {
    const bar = jsx.slice(jsx.indexOf('{/* ─── SUB-TABS ─── */}'), jsx.indexOf('OVERVIEW ════'));
    expect(bar).toMatch(/2px solid var\(--primary\)/);
    expect(bar).not.toMatch(/#6366f1/i);
  });

  test('the Overview stylesheet (.sov-*) and the show-context bar use tokens only, and the Overview button is the primary', () => {
    const sov = css.slice(css.indexOf('.sov-lala {'), css.indexOf('.sov-start button') + 200);
    expect(sov).not.toMatch(HEX);
    expect(sov).toMatch(/\.sov-btn\s*{[^}]*background:\s*var\(--primary\)/);
    const ctx = css.slice(css.indexOf('.wa-context'), css.indexOf('.wa-context-link') + 120);
    expect(ctx).not.toMatch(HEX);
  });
});
