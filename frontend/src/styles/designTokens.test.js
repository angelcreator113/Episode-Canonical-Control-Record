/**
 * The studio theme's contrast and single source (audit VISUAL-01/02,
 * 2026-10-03): every documented text/background pair holds 4.5:1 (sRGB,
 * WCAG), index.css no longer redeclares the tokens it imports, and the
 * primary button is one token.
 */
import { describe, test, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { contrast, readToken } from './contrast';

const here = (f) => resolve(__dirname, f);
const tokens = readFileSync(here('design-tokens.css'), 'utf8');
const index = readFileSync(here('../index.css'), 'utf8');
const shared = readFileSync(here('shared-components.css'), 'utf8');

const token = (name) => readToken([tokens], name);

const PAIRS = [
  ['--text-inverse', '--primary'],
  ['--text-inverse', '--primary-dark'],
  ['--text-primary', '--primary-subtle'],
  ['--primary-text', '--surface-card'],
  ['--accent-dark', '--surface-card'],
  ['--accent-dark', '--accent-subtle'],
  ['--text-primary', '--accent-subtle'],
  ['--text-secondary', '--surface-card'],
  ['--text-secondary', '--surface-bg'],
  ['--text-muted', '--surface-card'],
  ['--secondary', '--surface-card'],
  ['--lala-gold-text', '--surface-card'],
  ['--text-primary', '--lala-gold'],
  ['--text-inverse', '--danger'],
  ['--text-primary', '--surface-bg'],
];

describe('studio theme', () => {
  test.each(PAIRS)('%s on %s holds 4.5:1', (fg, bg) => {
    expect(contrast(token(fg), token(bg))).toBeGreaterThanOrEqual(4.5);
  });

  test('the pairs the audit measured as failing are not used as text pairs', () => {
    expect(contrast('#FFFFFF', token('--lala-gold'))).toBeLessThan(4.5); // so white-on-gold stays banned
    expect(contrast(token('--text-faint'), token('--surface-card'))).toBeLessThan(4.5); // decorative only
    expect(contrast(token('--accent'), token('--surface-card'))).toBeLessThan(4.5); // pink is not a text color
  });

  test('index.css no longer redeclares the tokens it imports', () => {
    const root = index.slice(index.indexOf(':root {'), index.indexOf('}', index.indexOf(':root {')));
    for (const name of ['--primary', '--text-primary', '--text-secondary', '--text-muted', '--secondary', '--success', '--warning', '--danger', '--info', '--border']) {
      expect(root).not.toMatch(new RegExp(`^\\s*${name}:\\s*#`, 'm'));
    }
  });

  test('the primary button is one token, with a hover and a focus ring', () => {
    const rule = shared.slice(shared.indexOf('.btn-primary {'), shared.indexOf('.btn-secondary {'));
    expect(rule).toMatch(/background:\s*var\(--primary\);/);
    expect(rule).not.toMatch(/linear-gradient/);
    expect(rule).toMatch(/\.btn-primary:hover:not\(:disabled\)\s*{[^}]*background:\s*var\(--primary-dark\)/);
    expect(rule).toMatch(/focus-visible[^}]*box-shadow:\s*var\(--focus-ring\)/);
  });
});
