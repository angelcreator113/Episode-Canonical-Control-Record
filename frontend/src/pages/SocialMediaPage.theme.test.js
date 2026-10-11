/**
 * The Pulse wears its own tokens (Task 2926; Evoni's mockup): no hex
 * literal in the page or its stylesheet; every --pulse-* text token is AA on
 * the card (and the muted grey on the soft fill too); the primary button is
 * white on --pulse-button; pink and violet are decoration, never text; post
 * cards are solid, the glass is for frame pieces only.
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

describe('The Pulse: tokens', () => {
  test('no hex literal in the page or the stylesheet', () => {
    expect(css).not.toMatch(HEX);
    expect(jsx).not.toMatch(HEX);
  });

  test('text tokens are AA on the card; the muted grey also on the soft fill; the button is white on its rose', () => {
    for (const name of ['--pulse-ink', '--pulse-heading', '--pulse-muted', '--pulse-link', '--pulse-rose', '--pulse-tag']) {
      expect(contrast(t(name), t('--pulse-card'))).toBeGreaterThanOrEqual(4.5);
    }
    expect(contrast(t('--pulse-muted'), t('--pulse-soft'))).toBeGreaterThanOrEqual(4.5);
    expect(contrast(t('--text-inverse'), t('--pulse-button'))).toBeGreaterThanOrEqual(4.5);
    expect(contrast(t('--pulse-director-ink'), t('--pulse-director'))).toBeGreaterThanOrEqual(4.5);
    expect(css).toMatch(/\.pl-button \{[^}]*background: var\(--pulse-button\); color: var\(--text-inverse\)/);
  });

  test('pink and violet are never text colours', () => {
    expect(css).not.toMatch(/(^|[;{\s])color: var\(--pulse-(pink|violet)\)/);
  });

  test('post cards are solid; the glass is only on frame pieces', () => {
    expect(css).toMatch(/\.pl-card, \.pl-post, \.pl-composer \{ background: var\(--pulse-card\)/);
    const glassRules = css.split('}').filter((rule) => rule.includes('var(--pulse-glass)')).map((rule) => rule.split('{')[0].trim());
    for (const selector of glassRules) expect(selector).not.toMatch(/pl-post|pl-card|pl-comment/);
  });
});
