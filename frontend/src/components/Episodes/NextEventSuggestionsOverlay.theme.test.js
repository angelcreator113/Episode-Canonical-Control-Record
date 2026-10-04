/**
 * The Next Event Suggestions overlay wears the studio theme (audit
 * VISUAL-01/02, batch 4, eighteenth screen): the overlay sets colors only
 * through tokens (the backdrop scrim and two shadows are the only rgba);
 * the pick button is the primary (it was gold under white); the top rank
 * is ink on gold and gold text, never gold as text (2.82:1); the score,
 * reasons, payment, cost and type chips read the success, warning,
 * danger and teal families; the slate greys are the ink tokens.
 */
import { describe, test, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { contrast, readToken, stripTaskRefs } from '../../styles/contrast';

const jsx = readFileSync(resolve(__dirname, 'NextEventSuggestionsOverlay.jsx'), 'utf8');
const tokens = readFileSync(resolve(__dirname, '../../styles/design-tokens.css'), 'utf8');
const HEX = /#[0-9a-f]{3,8}\b/i;

describe('Next Event Suggestions overlay theme', () => {
  test('the overlay carries no color literal and no gradient; rgba is the scrim and the shadows only', () => {
    expect(stripTaskRefs(jsx)).not.toMatch(HEX);
    expect(jsx).not.toMatch(/linear-gradient/);
    expect(jsx.match(/rgba\(/g)).toHaveLength(3);
    expect(jsx).toMatch(/background: 'rgba\(15, 23, 42, 0\.62\)'/);
    expect(jsx).toMatch(/boxShadow: '0 20px 60px rgba\(0,0,0,0\.3\)'/);
    expect(jsx).toMatch(/boxShadow: '0 1px 2px rgba\(0,0,0,0\.08\)'/);
  });

  test('the pick button is the primary; gold is a border, a fill under ink, or gold text', () => {
    expect(jsx).toMatch(/primaryBtn: \{[^}]*background: 'var\(--primary\)', border: 'none', color: 'var\(--text-inverse\)'/);
    expect(jsx).toMatch(/border: rank === 0 \? '2px solid var\(--lala-gold\)' : '1px solid var\(--lala-parchment-3\)'/);
    expect(jsx).toMatch(/background: rank === 0 \? 'var\(--lala-gold\)' : 'var\(--text-secondary\)',\s*color: rank === 0 \? 'var\(--text-primary\)' : 'var\(--text-inverse\)'/);
    expect(jsx).toMatch(/background: 'var\(--lala-gold-soft\)', border: '1px solid var\(--lala-gold-line\)'/);
    expect(jsx).toMatch(/background: 'var\(--lala-gold-soft\)', color: 'var\(--lala-gold-text\)'/);
    expect(jsx).toMatch(/pressured \? 'var\(--lala-gold-text\)' : 'var\(--text-primary\)'/);
    expect(jsx).not.toMatch(/color: 'var\(--lala-gold\)'/);
    expect(jsx).not.toMatch(/background: 'var\(--lala-gold\)'[^}]*color: 'var\(--text-inverse\)'/);
  });

  test('score, reasons and chips read the token families', () => {
    expect(jsx).toMatch(/background: score > 0 \? 'var\(--success-bg\)' : 'var\(--danger-bg\)',\s*color: score > 0 \? 'var\(--success-text\)' : 'var\(--danger-text\)'/);
    expect(jsx).toMatch(/boostIcon: \{ color: 'var\(--success-text\)'/);
    expect(jsx).toMatch(/blockIcon: \{ color: 'var\(--danger-text\)'/);
    expect(jsx).toMatch(/warnIcon: \{ color: 'var\(--warning-text\)'/);
    expect(jsx).toMatch(/r\.kind === 'boost' \? 'var\(--success-text\)' : r\.kind === 'warn' \? 'var\(--warning-text\)' : 'var\(--danger-text\)'/);
    expect(jsx).toMatch(/background: 'var\(--primary-subtle\)', color: 'var\(--primary-text\)'/);
    expect(jsx).toMatch(/background: s\.affordable \? 'var\(--warning-bg\)' : 'var\(--danger-bg\)', color: s\.affordable \? 'var\(--warning-text\)' : 'var\(--danger-text\)'/);
    expect(jsx).toMatch(/background: 'var\(--success-bg\)', color: 'var\(--success-text\)'/);
    expect(jsx).toMatch(/background: 'var\(--lala-parchment-2\)', color: 'var\(--text-secondary\)'/);
    expect(jsx).toMatch(/background: 'var\(--lala-parchment-2\)', color: 'var\(--text-primary\)'/);
  });

  test('every text pair the overlay draws holds 4.5:1 or better', () => {
    const sources = [tokens];
    for (const [fg, bg] of [
      ['--text-inverse', '--primary'],
      ['--text-inverse', '--text-secondary'],
      ['--text-primary', '--lala-gold'],
      ['--lala-gold-text', '--lala-gold-soft'],
      ['--lala-gold-text', '--surface-card'],
      ['--text-primary', '--lala-gold-soft'],
      ['--text-secondary', '--lala-gold-soft'],
      ['--text-primary', '--surface-card'],
      ['--text-primary', '--surface-bg'],
      ['--text-secondary', '--surface-card'],
      ['--text-secondary', '--surface-bg'],
      ['--text-secondary', '--lala-parchment-2'],
      ['--text-primary', '--lala-parchment-2'],
      ['--primary-text', '--primary-subtle'],
      ['--success-text', '--success-bg'],
      ['--success-text', '--surface-card'],
      ['--warning-text', '--warning-bg'],
      ['--warning-text', '--surface-card'],
      ['--danger-text', '--danger-bg'],
      ['--danger-text', '--surface-card'],
      ['--danger-text', '--surface-bg'],
    ]) {
      const ratio = contrast(readToken(sources, fg), readToken(sources, bg));
      expect({ fg, bg, ratio }).toMatchObject({ ratio: expect.any(Number) });
      expect(ratio).toBeGreaterThanOrEqual(4.5);
    }
    // Gold as text and white on gold, the old palette, kept below 4.5 so they are never reused.
    expect(contrast(readToken(sources, '--lala-gold'), readToken(sources, '--surface-card'))).toBeLessThan(4.5);
    expect(contrast(readToken(sources, '--text-inverse'), readToken(sources, '--lala-gold'))).toBeLessThan(4.5);
  });
});
