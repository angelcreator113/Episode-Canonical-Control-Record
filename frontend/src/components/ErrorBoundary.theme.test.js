/**
 * The error page wears the studio theme (audit VISUAL-01/02, batch 4, the
 * last follow-up from the screenshot pass): ErrorBoundary.css sets colors
 * only through tokens; the page is the parchment surface, not a grey
 * gradient; Try Again is the primary, Go Home the ink family; the details
 * summary reads teal text; the stack reads the success green on the dark
 * surface; the warning reads the warning family.
 */
import { describe, test, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { contrast, readToken, stripTaskRefs } from '../styles/contrast';

const css = readFileSync(resolve(__dirname, 'ErrorBoundary.css'), 'utf8');
const tokens = readFileSync(resolve(__dirname, '../styles/design-tokens.css'), 'utf8');
const HEX = /#[0-9a-f]{3,8}\b/i;
const rule = (selector) => {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const m = new RegExp(`(?:^|[\\s,])${escaped}\\s*\\{`).exec(css);
  if (!m) throw new Error(`rule missing: ${selector}`);
  return css.slice(m.index, css.indexOf('}', m.index));
};

describe('Error page theme', () => {
  test('the stylesheet carries no color literal, no color keyword and no gradient', () => {
    expect(stripTaskRefs(css)).not.toMatch(HEX);
    expect(css).not.toMatch(/\bwhite\b/);
    expect(css).not.toMatch(/gradient/);
    expect(css).not.toMatch(/var\(--[a-z0-9-]+,\s*#/i);
  });

  test('the page is the parchment surface and the actions read the primary and ink families', () => {
    expect(rule('.error-boundary')).toMatch(/background: var\(--surface-bg\);/);
    expect(rule('.error-boundary-content')).toMatch(/background: var\(--surface-card\);/);
    expect(rule('.error-actions .btn-primary')).toMatch(/background-color: var\(--primary\);\s*color: var\(--text-inverse\);/);
    expect(rule('.error-actions .btn-primary:hover')).toMatch(/background-color: var\(--primary-dark\);/);
    expect(rule('.error-actions .btn-secondary')).toMatch(/background-color: var\(--lala-parchment-2\);\s*color: var\(--text-primary\);/);
    expect(rule('.error-actions .btn-secondary:hover')).toMatch(/background-color: var\(--lala-parchment-3\);/);
  });

  test('the details, the stack and the warning read the token families', () => {
    expect(rule('.error-details')).toMatch(/background-color: var\(--surface-bg\);\s*border: 1px solid var\(--lala-parchment-3\);/);
    expect(rule('.error-details summary')).toMatch(/color: var\(--primary-text\);/);
    expect(rule('.error-details summary:hover')).toMatch(/color: var\(--primary-dark\);/);
    expect(rule('.error-details pre')).toMatch(/background-color: var\(--gray-800\);\s*color: var\(--success\);/);
    expect(rule('.error-warning')).toMatch(/background-color: var\(--warning-bg\);\s*border: 1px solid var\(--warning-border\);\s*border-radius: 4px;\s*color: var\(--warning-text\);/);
  });

  test('every text pair the page draws holds 4.5:1 or better', () => {
    const sources = [tokens];
    for (const [fg, bg] of [
      ['--text-inverse', '--primary'],
      ['--text-inverse', '--primary-dark'],
      ['--text-primary', '--surface-card'],
      ['--text-primary', '--lala-parchment-2'],
      ['--text-primary', '--lala-parchment-3'],
      ['--primary-text', '--surface-bg'],
      ['--primary-dark', '--surface-bg'],
      ['--success', '--gray-800'],
      ['--warning-text', '--warning-bg'],
    ]) {
      const ratio = contrast(readToken(sources, fg), readToken(sources, bg));
      expect({ fg, bg, ratio }).toMatchObject({ ratio: expect.any(Number) });
      expect(ratio).toBeGreaterThanOrEqual(4.5);
    }
  });
});
