/**
 * Social Media wears the studio theme from birth (2026-10-04; audit
 * VISUAL-01/02 rule: new chrome always in tokens): the page and its
 * stylesheet carry no hex literal; the active tab and chip are the primary;
 * the function tags read the family text tokens on the family backgrounds.
 */
import { describe, test, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { contrast, readToken } from '../styles/contrast';

const css = readFileSync(resolve(__dirname, 'SocialMediaPage.css'), 'utf8');
const jsx = readFileSync(resolve(__dirname, 'SocialMediaPage.jsx'), 'utf8');
const tokens = readFileSync(resolve(__dirname, '../styles/design-tokens.css'), 'utf8');
const HEX = /#[0-9a-f]{3,8}\b/i;
const t = (name) => readToken([tokens, css], name);

describe('Social Media: studio tokens', () => {
  test('no hex literal in the page or the stylesheet', () => {
    expect(css).not.toMatch(HEX);
    expect(jsx).not.toMatch(HEX);
  });
  test('the active tab and chip are the primary; the family tags read their text tokens', () => {
    expect(css).toMatch(/\.sm-tab\.active \{[^}]*border-bottom-color: var\(--primary\)/);
    expect(css).toMatch(/\.sm-chip\.active \{[^}]*background: var\(--primary\);[^}]*color: var\(--text-inverse\)/);
    expect(contrast(t('--text-inverse'), t('--primary'))).toBeGreaterThanOrEqual(4.5);
    for (const fam of ['danger', 'success', 'warning', 'info']) {
      expect(css).toMatch(new RegExp(`background: var\\(--${fam}-bg\\); color: var\\(--${fam}-text\\)`));
      expect(contrast(t(`--${fam}-text`), t(`--${fam}-bg`))).toBeGreaterThanOrEqual(4.5);
    }
    expect(contrast(t('--primary-text'), t('--primary-subtle'))).toBeGreaterThanOrEqual(4.5);
  });
});
