/**
 * The public site's tokens (docs/design/2026-10-landing-and-stylesheet.md
 * Part 1, "Design tokens"; Task #2807): the six spec colours and two fonts,
 * scoped to `.site` so no studio page changes, and the spec's contrast
 * rules (plum buttons with ivory text; orchid for accents only).
 */
import { describe, test, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { contrast, readToken } from './contrast';

const here = (f) => resolve(__dirname, f);
const site = readFileSync(here('site-tokens.css'), 'utf8');
const token = (name) => readToken([site], name);

describe('public site tokens', () => {
  test('the six spec colours, exactly', () => {
    expect(token('--site-ivory')).toBe('#FAF6F1');
    expect(token('--site-blush')).toBe('#E9C4D5');
    expect(token('--site-orchid')).toBe('#AD79B6');
    expect(token('--site-ice')).toBe('#B7DFEA');
    expect(token('--site-champagne')).toBe('#D6B77C');
    expect(token('--site-plum')).toBe('#30253D');
    expect(token('--site-lavender')).toBe('#E4DAF1');
    expect(token('--site-lavender-deep')).toBe('#CFBFE6');
  });

  test('display and body fonts, with fallbacks', () => {
    expect(token('--site-font-display')).toBe("'Cormorant Garamond', 'Lora', Georgia, serif");
    expect(token('--site-font-body')).toMatch(/^'DM Sans', system-ui/);
    expect(site).toMatch(/@import url\('https:\/\/fonts\.googleapis\.com\/css2\?family=Cormorant\+Garamond/);
  });

  test('scoped to .site: nothing is declared on :root, and every rule is under .site', () => {
    expect(site).not.toMatch(/:root/);
    const selectors = site.replace(/\/\*[\s\S]*?\*\//g, '').replace(/@import url\([^)]*\);/g, '')
      .match(/(^|})\s*([^{}]+)\{/g).map((s) => s.replace(/[{}]/g, '').trim());
    for (const sel of selectors) {
      for (const part of sel.split(',')) expect(part.trim()).toMatch(/^\.site(\s|$)/);
    }
  });

  test('buttons: plum with ivory text, ivory with plum outline, champagne closing button', () => {
    expect(token('--site-btn-primary-bg')).toBe('#30253D');
    expect(token('--site-btn-primary-text')).toBe('#FAF6F1');
    expect(token('--site-btn-secondary-bg')).toBe('#FAF6F1');
    expect(token('--site-btn-secondary-border')).toBe('#30253D');
    expect(token('--site-btn-closing-bg')).toBe('#D6B77C');
  });

  test('every text pair the spec uses holds WCAG AA (4.5:1)', () => {
    const pairs = [
      ['--site-plum', '--site-ivory'],
      ['--site-plum', '--site-blush'],
      ['--site-plum', '--site-ice'],
      ['--site-plum', '--site-champagne'],
      ['--site-plum', '--site-white'],
      ['--site-btn-primary-text', '--site-btn-primary-bg'],
      ['--site-btn-secondary-text', '--site-btn-secondary-bg'],
      ['--site-btn-closing-text', '--site-btn-closing-bg'],
      ['--site-feature-text', '--site-feature-bg'],
      ['--site-feature-text', '--site-feature-deep'],
      ['--site-btn-closing-text', '--site-btn-closing-bg'],
      ['--site-btn-secondary-text', '--site-feature-bg'],
    ];
    for (const [fg, bg] of pairs) {
      expect({ pair: `${fg} on ${bg}`, ratio: contrast(token(fg), token(bg)) >= 4.5 }).toEqual({ pair: `${fg} on ${bg}`, ratio: true });
    }
  });

  test('orchid is accent-only: white text on it fails AA, as the spec warns', () => {
    expect(contrast('#FFFFFF', token('--site-orchid'))).toBeLessThan(4.5);
  });

  test('the studio tokens are untouched: design-tokens.css declares no --site- token', () => {
    expect(readFileSync(here('design-tokens.css'), 'utf8')).not.toMatch(/--site-/);
  });
});
