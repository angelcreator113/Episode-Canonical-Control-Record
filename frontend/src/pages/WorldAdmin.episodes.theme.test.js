/**
 * The Producer Mode Episodes tab wears the studio theme (audit
 * VISUAL-01/02, batch 5, first screen): the Results ledger slice (the
 * tier distribution, the financial summary, the episode rows and their
 * expanded stat, event, location, wardrobe, money, evaluation and
 * unlock panels) and the Production board (ShowEpisodesBoard) set colors
 * only through tokens. The tier palette is a fill, a surface, a border
 * and a text twin per tier (it tinted fills with hex alpha suffixes,
 * which a token cannot carry); Generate Script is the primary (it was a
 * green gradient under white); the ledger's teal, pink, gold and family
 * chips read text twins. The Season Plan sub-tab migrates next.
 */
import { describe, test, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { contrast, readToken, stripTaskRefs } from '../styles/contrast';

const jsx = readFileSync(resolve(__dirname, 'WorldAdmin.jsx'), 'utf8');
const board = readFileSync(resolve(__dirname, '../components/Show/ShowEpisodesBoard.jsx'), 'utf8');
const tokens = readFileSync(resolve(__dirname, '../styles/design-tokens.css'), 'utf8');
const HEX = /#[0-9a-f]{3,8}\b/i;

const slice = (text, start, end) => {
  const a = text.indexOf(start);
  const b = text.indexOf(end, a);
  if (a < 0 || b < 0) throw new Error(`marker missing: ${start} / ${end}`);
  return text.slice(a, b);
};
const ledger = slice(jsx, 'EPISODE LEDGER', "{activeTab === 'events' && (");

describe('Episodes tab theme', () => {
  test('the Results ledger slice and the Production board set colors only through tokens', () => {
    expect(stripTaskRefs(ledger)).not.toMatch(HEX);
    expect(ledger).not.toMatch(/linear-gradient/);
    expect(stripTaskRefs(board)).not.toMatch(HEX);
  });

  test('the tier palette is a fill, a surface, a border and a text twin per tier, never a hex alpha tint', () => {
    expect(jsx).toMatch(/const TIER_COLORS = \{ slay: 'var\(--lala-gold\)', pass: 'var\(--success\)', safe: 'var\(--warning\)', fail: 'var\(--danger\)' \};/);
    expect(jsx).toMatch(/const TIER_BG = \{ slay: 'var\(--lala-gold-soft\)', pass: 'var\(--success-bg\)', safe: 'var\(--warning-bg\)', fail: 'var\(--danger-bg\)' \};/);
    expect(jsx).toMatch(/const TIER_BORDER = \{ slay: 'var\(--lala-gold-line\)', pass: 'var\(--success-border\)', safe: 'var\(--warning-border\)', fail: 'var\(--danger-border\)' \};/);
    expect(jsx).toMatch(/const TIER_TEXT = \{ slay: 'var\(--lala-gold-text\)', pass: 'var\(--success-text\)', safe: 'var\(--warning-text\)', fail: 'var\(--danger-text\)' \};/);
    expect(jsx).not.toMatch(/TIER_COLORS\[[a-z]+\] \+ '/);
    expect(jsx).not.toMatch(/\$\{TIER_COLORS\[[a-z]+\]\}[0-9a-f]{2}\b/);
    expect(ledger).toMatch(/background: TIER_BG\[tier\], border: `2px solid \$\{TIER_BORDER\[tier\]\}`/);
    expect(jsx).toMatch(/tierPill: \(t\) => \(\{[^}]*background: TIER_BG\[t\], color: TIER_TEXT\[t\] \}\)/);
    expect(board).toMatch(/const TIERS = \{ slay: \{ e: '👑', c: 'var\(--lala-gold-text\)' \}, pass: \{ e: '✨', c: 'var\(--success-text\)' \}, safe: \{ e: '😐', c: 'var\(--warning-text\)' \}, fail: \{ e: '💔', c: 'var\(--danger-text\)' \} \};/);
  });

  test('Generate Script is the primary; the money, event and wardrobe chips read the families', () => {
    expect(ledger).toMatch(/background: generating \? 'var\(--lala-parchment-2\)' : 'var\(--primary\)', color: generating \? 'var\(--text-secondary\)' : 'var\(--text-inverse\)'/);
    expect(ledger).toMatch(/background: net >= 0 \? 'var\(--success-bg\)' : 'var\(--danger-bg\)', border: `1px solid \$\{net >= 0 \? 'var\(--success-border\)' : 'var\(--danger-border\)'\}`/);
    expect(ledger).toMatch(/color: v > 0 \? 'var\(--success-text\)' : v < 0 \? 'var\(--danger-text\)' : 'var\(--text-primary\)'/);
    expect(ledger).toMatch(/background: 'var\(--primary-subtle\)', borderRadius: 4, fontSize: 10, color: 'var\(--primary-text\)'/);
    expect(ledger).toMatch(/background: 'var\(--accent-subtle\)', border: '1px solid var\(--accent-light\)', borderRadius: 6, fontSize: 10, color: 'var\(--accent-dark\)'/);
    expect(ledger).toMatch(/background: 'var\(--warning-bg\)', borderRadius: 6, fontSize: 11, fontWeight: 600, color: 'var\(--warning-text\)'/);
    expect(ledger).toMatch(/background: 'var\(--surface-bg\)', borderColor: 'var\(--lala-parchment-3\)', color: 'var\(--lala-gold-text\)'/);
    expect(ledger).toMatch(/background: 'var\(--primary-subtle\)', borderColor: 'var\(--primary-light\)', color: 'var\(--primary-text\)'/);
    expect(ledger).toMatch(/border: isExpanded \? '2px solid var\(--primary\)' : '1px solid var\(--lala-parchment-3\)'/);
    expect(ledger).not.toMatch(/color: 'var\(--lala-gold\)'/);
  });

  test('every text pair the tab draws holds 4.5:1 or better', () => {
    const sources = [tokens];
    for (const [fg, bg] of [
      ['--text-inverse', '--primary'],
      ['--text-primary', '--surface-card'],
      ['--text-primary', '--lala-gold-soft'],
      ['--text-primary', '--success-bg'],
      ['--text-primary', '--warning-bg'],
      ['--text-primary', '--danger-bg'],
      ['--text-secondary', '--surface-card'],
      ['--text-secondary', '--surface-bg'],
      ['--text-secondary', '--lala-parchment-2'],
      ['--success-text', '--success-bg'],
      ['--success-text', '--surface-card'],
      ['--danger-text', '--danger-bg'],
      ['--danger-text', '--surface-card'],
      ['--warning-text', '--warning-bg'],
      ['--lala-gold-text', '--lala-gold-soft'],
      ['--lala-gold-text', '--surface-bg'],
      ['--primary-text', '--primary-subtle'],
      ['--primary-text', '--surface-card'],
      ['--accent-dark', '--accent-subtle'],
    ]) {
      const ratio = contrast(readToken(sources, fg), readToken(sources, bg));
      expect({ fg, bg, ratio }).toMatchObject({ ratio: expect.any(Number) });
      expect(ratio).toBeGreaterThanOrEqual(4.5);
    }
    // The old tier fills as text and white on the old green, kept below 4.5 so they are never reused.
    expect(contrast('#FFD700', '#ffffff')).toBeLessThan(4.5);
    expect(contrast('#eab308', '#ffffff')).toBeLessThan(4.5);
    expect(contrast('#ffffff', '#22c55e')).toBeLessThan(4.5);
  });
});
