/**
 * The Event Package wears the studio theme (audit VISUAL-01/02, batch 4,
 * fifth screen): its stylesheet and the venue-look styles set colors only
 * through tokens (no hex fallbacks, so a token edit reaches the page), the
 * primary action is teal, gold is never under white nor used as text, and
 * the Continue bar's pink and teal are the tokens.
 */
import { describe, test, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { contrast, readToken } from '../styles/contrast';

const css = readFileSync(resolve(__dirname, 'EventPackagePage.css'), 'utf8');
const look = readFileSync(resolve(__dirname, '../components/EventPackage/EventLookImage.css'), 'utf8');
const jsx = readFileSync(resolve(__dirname, 'EventPackagePage.jsx'), 'utf8');
const tokens = readFileSync(resolve(__dirname, '../styles/design-tokens.css'), 'utf8');
const HEX = /#[0-9a-f]{3,8}\b/i;
// Task references ("Task #1642") are not colors.
const stripTaskRefs = (s) => s.replace(/#\d{4}\b/g, '');
const rule = (selector) => {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const m = new RegExp(`${escaped}\\s*\\{`).exec(css);
  if (!m) throw new Error(`rule missing: ${selector}`);
  return css.slice(m.index, css.indexOf('}', m.index));
};

describe('Event Package theme', () => {
  test('the stylesheets carry no color literal, not even as a var() fallback', () => {
    expect(stripTaskRefs(css)).not.toMatch(HEX);
    expect(stripTaskRefs(look)).not.toMatch(HEX);
    expect(css).not.toMatch(/var\(--[a-z0-9-]+,\s*#/i);
    expect(jsx).not.toMatch(/color=["']#|color: ['"]#|background: ['"]#/);
  });

  test('the primary action is teal, never gold under white', () => {
    expect(rule('.epp-btn-primary')).toMatch(/background: var\(--primary\);\s*border-color: var\(--primary\);\s*color: var\(--text-inverse\);/);
    expect(rule('.epp-next-btn.epp-btn-primary')).toMatch(/background: var\(--epp-teal-deep\)/);
    expect(rule('.epp-btn.epp-look-use')).toMatch(/background: var\(--primary\)/);
    expect(css).not.toMatch(/background: var\(--lala-gold\);[^}]*color: var\(--(?:text-inverse|lala-surface|surface-card)\)/);
  });

  test('gold is a border or a fill under ink, never text; pink text is --accent-dark', () => {
    expect(css).not.toMatch(/(?<![-\w])color: var\(--lala-gold(?:-hover)?\)/);
    expect(look).not.toMatch(/(?<![-\w])color: var\(--lala-gold(?:-hover)?\)/);
    expect(css).not.toMatch(/(?<![-\w])color: var\(--accent(?:-light)?\)/);
    expect(rule('.epp-scene-set-link')).toMatch(/color: var\(--lala-gold-text\)/);
  });

  test("the Continue bar's own pink and teal are the tokens", () => {
    const next = rule('.epp-next');
    expect(next).toMatch(/--epp-pink: var\(--accent-light\)/);
    expect(next).toMatch(/--epp-pink-soft: var\(--accent-subtle\)/);
    expect(next).toMatch(/--epp-teal: var\(--primary-light\)/);
    expect(next).toMatch(/--epp-teal-soft: var\(--primary-subtle\)/);
    expect(next).toMatch(/--epp-teal-deep: var\(--primary\)/);
  });

  test('the statuses read the token families', () => {
    expect(rule('.epp-status-ready')).toMatch(/background: var\(--success-bg\); color: var\(--success-text\)/);
    expect(rule('.epp-status-used')).toMatch(/background: var\(--primary-subtle\); color: var\(--primary-text\)/);
    expect(rule('.epp-used-banner')).toMatch(/background: var\(--primary-subtle\);\s*color: var\(--primary-text\)/);
    expect(rule('.epp-invitation-error')).toMatch(/background: var\(--danger-bg\);\s*color: var\(--danger-text\)/);
    expect(rule('.epp-money-warnings')).toMatch(/background: var\(--warning-bg\);\s*color: var\(--warning-text\)/);
  });

  test('every text pair the page draws holds 4.5:1 or better', () => {
    const sources = [tokens];
    const pairs = [
      ['--text-inverse', '--primary'],
      ['--text-inverse', '--primary-dark'],
      ['--lala-gold-text', '--lala-surface'],
      ['--lala-gold-text', '--lala-gold-soft'],
      ['--lala-ink', '--lala-parchment'],
      ['--lala-ink-muted', '--lala-surface'],
      ['--lala-ink-muted', '--lala-parchment-2'],
      ['--accent-dark', '--accent-subtle'],
      ['--primary-text', '--primary-subtle'],
      ['--success-text', '--success-bg'],
      ['--warning-text', '--warning-bg'],
      ['--danger-text', '--danger-bg'],
      ['--danger-text', '--lala-surface'],
      ['--lala-danger', '--lala-surface'],
    ];
    for (const [fg, bg] of pairs) {
      const ratio = contrast(readToken(sources, fg), readToken(sources, bg));
      expect({ fg, bg, ratio }).toMatchObject({ ratio: expect.any(Number) });
      expect(ratio).toBeGreaterThanOrEqual(4.5);
    }
    // The pairs the page used to draw, kept below 4.5 so they are never
    // reused as text: white on gold, gold and its hover as text on white,
    // the light pink as text.
    expect(contrast(readToken(sources, '--text-inverse'), readToken(sources, '--lala-gold'))).toBeLessThan(4.5);
    expect(contrast(readToken(sources, '--lala-gold'), readToken(sources, '--lala-surface'))).toBeLessThan(4.5);
    expect(contrast(readToken(sources, '--lala-gold-hover'), readToken(sources, '--lala-surface'))).toBeLessThan(4.5);
    expect(contrast(readToken(sources, '--accent-light'), readToken(sources, '--lala-surface'))).toBeLessThan(4.5);
  });
});
