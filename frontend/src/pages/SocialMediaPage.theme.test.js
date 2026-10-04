/**
 * Social Media wears the studio theme (audit VISUAL-01/02 rule: new chrome
 * always in tokens; redesigned 2026-10-04 as the 2009 wall with a purple
 * banner): no hex literal in the page or the stylesheet; the banner is
 * --lala-lavender under --text-inverse; links and names read
 * --lala-lavender-text on white and on the lavender wash; the avatar fill
 * is never text; the draft badge reads the warning text on the warning bg.
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
  test('the banner is lavender under inverse text; the active nav is the dark lavender', () => {
    expect(css).toMatch(/\.sm-banner \{[^}]*background: var\(--lala-lavender\); color: var\(--text-inverse\)/);
    expect(css).toMatch(/\.sm-nav button\.active, \.sm-nav a\.active \{ background: var\(--lala-lavender-dark\); \}/);
    expect(contrast(t('--text-inverse'), t('--lala-lavender'))).toBeGreaterThanOrEqual(4.5);
    expect(contrast(t('--text-inverse'), t('--lala-lavender-dark'))).toBeGreaterThanOrEqual(4.5);
  });
  test('links and names read lavender text on white and on the wash; buttons are lavender under inverse', () => {
    expect(css).toMatch(/\.sm-page a \{ color: var\(--lala-lavender-text\)/);
    expect(css).toMatch(/\.sm-name \{ color: var\(--lala-lavender-text\); \}/);
    expect(css).toMatch(/\.sm-btn \{[^}]*background: var\(--lala-lavender\); color: var\(--text-inverse\)/);
    expect(contrast(t('--lala-lavender-text'), t('--surface-card'))).toBeGreaterThanOrEqual(4.5);
    expect(contrast(t('--lala-lavender-text'), t('--lala-lavender-soft'))).toBeGreaterThanOrEqual(4.5);
    expect(contrast(t('--text-primary'), t('--lala-lavender-light'))).toBeGreaterThanOrEqual(4.5);
    expect(contrast(t('--warning-text'), t('--warning-bg'))).toBeGreaterThanOrEqual(4.5);
  });
});
