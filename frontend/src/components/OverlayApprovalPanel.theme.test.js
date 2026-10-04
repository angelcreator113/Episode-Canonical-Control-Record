/**
 * The overlay approval panel wears the studio theme (audit VISUAL-01/02,
 * batch 4 follow-up from the screenshot pass): the panel that renders the
 * Wardrobe Shopping List and Social Tasks overlays inside the event detail
 * modal sets colors only through tokens; its list family is gold for the
 * wardrobe list and teal for social tasks, a fill for borders and bars and
 * a text twin for labels (gold and indigo as text, and under white, were
 * 2.82:1 and 4.5:1 short); the primary action is the primary; Approve is
 * white on the success text; the social-task timing phases read the
 * warning, teal and success families (they tinted with hex alpha suffixes,
 * which a token cannot carry).
 */
import { describe, test, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { contrast, readToken } from '../styles/contrast';

const jsx = readFileSync(resolve(__dirname, 'OverlayApprovalPanel.jsx'), 'utf8');
const tokens = readFileSync(resolve(__dirname, '../styles/design-tokens.css'), 'utf8');
// A color literal is quoted, follows a colon or "solid"; "Task #2292" is a reference.
const COLOR = /(?<=['":(]\s?|solid\s)#[0-9a-f]{3,8}\b/i;

describe('Overlay approval panel theme', () => {
  test('the panel carries no color literal, no gradient and no hex alpha tint', () => {
    expect(jsx).not.toMatch(COLOR);
    expect(jsx).not.toMatch(/linear-gradient/);
    expect(jsx).not.toMatch(/\$\{[a-zA-Z]+\}[0-9a-f]{2}\b/);
  });

  test('the list family is a fill and a text twin, never gold or teal as text', () => {
    expect(jsx).toMatch(/const accent = isWardrobe \? 'var\(--lala-gold\)' : 'var\(--primary\)';\s*const accentText = isWardrobe \? 'var\(--lala-gold-text\)' : 'var\(--primary-text\)';/);
    expect(jsx).not.toMatch(/color: accent\b/);
    expect(jsx).toMatch(/color: modalTab === tab\.key \? accentText : 'var\(--text-secondary\)'/);
    expect(jsx).toMatch(/color: accentText, textDecoration: 'none'/);
    expect(jsx).toMatch(/color: accentText, marginLeft: 4, fontSize: 8/);
    expect(jsx).toMatch(/borderLeft: `3px solid \$\{t\.completed \? 'var\(--success\)' : accent\}`/);
  });

  test('the buttons read the primary, success, danger and ink families', () => {
    expect(jsx).toMatch(/const accentBtn = btn\('var\(--primary\)', 'var\(--text-inverse\)'\);/);
    expect(jsx).toMatch(/const outlineBtn = btn\('var\(--surface-bg\)', accentText, `1px solid \$\{accent\}`\);/);
    expect(jsx).toMatch(/const greenBtn = btn\('var\(--success-text\)', 'var\(--text-inverse\)'\);/);
    expect(jsx).toMatch(/const redBtn = btn\('var\(--surface-card\)', 'var\(--danger-text\)', '1px solid var\(--danger-border\)'\);/);
    expect(jsx).toMatch(/const grayBtn = btn\('var\(--lala-parchment-2\)', 'var\(--text-secondary\)', '1px solid var\(--lala-parchment-3\)'\);/);
  });

  test('timing phases, chips and the toast read the token families', () => {
    expect(jsx).toMatch(/const TIMING_COLORS = \{ before: 'var\(--warning\)', during: 'var\(--primary\)', after: 'var\(--success\)' \};/);
    expect(jsx).toMatch(/const TIMING_TEXT = \{ before: 'var\(--warning-text\)', during: 'var\(--primary-text\)', after: 'var\(--success-text\)' \};/);
    expect(jsx).toMatch(/const TIMING_BG = \{ before: 'var\(--warning-bg\)', during: 'var\(--primary-subtle\)', after: 'var\(--success-bg\)' \};/);
    expect(jsx).toMatch(/color: TIMING_TEXT\[phase\], textTransform: 'uppercase'/);
    expect(jsx).toMatch(/background: timingBg, color: timingText/);
    expect(jsx.match(/background: 'var\(--primary-subtle\)', color: 'var\(--primary-text\)'/g)).toHaveLength(2);
    expect(jsx).toMatch(/background: toast\.type === 'error' \? 'var\(--danger-bg\)' : 'var\(--success-bg\)',\s*color: toast\.type === 'error' \? 'var\(--danger-text\)' : 'var\(--success-text\)'/);
  });

  test('every text pair the panel draws holds 4.5:1 or better', () => {
    const sources = [tokens];
    for (const [fg, bg] of [
      ['--text-inverse', '--primary'],
      ['--text-inverse', '--success-text'],
      ['--lala-gold-text', '--surface-bg'],
      ['--lala-gold-text', '--lala-gold-soft'],
      ['--primary-text', '--surface-bg'],
      ['--primary-text', '--primary-subtle'],
      ['--danger-text', '--surface-card'],
      ['--danger-text', '--danger-bg'],
      ['--text-secondary', '--lala-parchment-2'],
      ['--text-secondary', '--surface-card'],
      ['--text-primary', '--surface-bg'],
      ['--warning-text', '--warning-bg'],
      ['--warning-text', '--surface-card'],
      ['--success-text', '--success-bg'],
      ['--success-text', '--surface-card'],
    ]) {
      const ratio = contrast(readToken(sources, fg), readToken(sources, bg));
      expect({ fg, bg, ratio }).toMatchObject({ ratio: expect.any(Number) });
      expect(ratio).toBeGreaterThanOrEqual(4.5);
    }
    // Gold as text, white on gold and white on the old indigo and green, kept below 4.5 so they are never reused.
    expect(contrast(readToken(sources, '--lala-gold'), readToken(sources, '--surface-card'))).toBeLessThan(4.5);
    expect(contrast(readToken(sources, '--text-inverse'), readToken(sources, '--lala-gold'))).toBeLessThan(4.5);
    expect(contrast('#ffffff', '#6366f1')).toBeLessThan(4.5);
    expect(contrast('#ffffff', '#16a34a')).toBeLessThan(4.5);
  });
});
