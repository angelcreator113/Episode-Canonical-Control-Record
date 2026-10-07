/**
 * The show's Overlays library (Evoni, 2026-10-07) wears the Producer Mode
 * style: colours only through tokens (no hex, no var() fallback), no inline
 * colours in the page, prose titles, sans text, and the primary action is
 * the filled lavender pill.
 */
import { describe, test, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const css = readFileSync(resolve(__dirname, 'ProductionOverlaysTab.css'), 'utf8');
const jsx = readFileSync(resolve(__dirname, 'ProductionOverlaysTab.jsx'), 'utf8');
const HEX = /#[0-9a-f]{3,8}\b/i;
const rule = (selector) => {
  const at = css.indexOf(`${selector} {`);
  if (at < 0) throw new Error(`rule missing: ${selector}`);
  return css.slice(at, css.indexOf('}', at));
};

describe('Show Overlays library theme', () => {
  test('no colour literals in the stylesheet or the page', () => {
    expect(css).not.toMatch(HEX);
    expect(css).not.toMatch(/var\(--[a-z0-9-]+,\s*#/i);
    expect(jsx).not.toMatch(HEX);
    expect(jsx).not.toMatch(/style=\{\{/);
  });

  test('prose titles, sans text, no monospace', () => {
    expect(rule('.sol-title')).toMatch(/font-family: var\(--font-prose\)/);
    expect(rule('.sol-card-name')).toMatch(/font-family: var\(--font-prose\)/);
    expect(rule('.sol')).toMatch(/font-family: var\(--font-sans\)/);
    expect(css).not.toMatch(/DM Mono|--font-ui|monospace/);
  });

  test('the primary action is the filled lavender pill; the others lavender outline', () => {
    expect(rule('.sol-btn.is-primary')).toMatch(/background: var\(--lala-lavender\);\s*color: var\(--text-inverse\)/);
    expect(rule('.sol-btn')).toMatch(/border-radius: 999px/);
    expect(rule('.sol-btn')).toMatch(/color: var\(--lala-lavender-text\)/);
  });
});
