/**
 * The Episode Production Checklist wears the studio theme (audit
 * VISUAL-01/02, batch 4, sixteenth screen): the checklist and the
 * coverage panel it renders set colors only through tokens; pink and
 * teal are family tokens for fills and borders and their text-safe twins
 * for text; Generate Episode, Resume setup, the fix buttons and the
 * coverage actions are the primary (they were gold and indigo gradients
 * under white); the statuses, toast and badge read the token families.
 */
import { describe, test, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { contrast, readToken, stripTaskRefs } from '../../styles/contrast';

const checklist = readFileSync(resolve(__dirname, 'EpisodeProductionChecklist.jsx'), 'utf8');
const coverage = readFileSync(resolve(__dirname, 'ProductionCoveragePanel.jsx'), 'utf8');
const tokens = readFileSync(resolve(__dirname, '../../styles/design-tokens.css'), 'utf8');
const HEX = /#[0-9a-f]{3,8}\b/i;

describe('Episode Production Checklist theme', () => {
  test('the checklist and the coverage panel carry no color literal and no gradient', () => {
    expect(stripTaskRefs(checklist)).not.toMatch(HEX);
    expect(stripTaskRefs(coverage)).not.toMatch(HEX);
    expect(checklist).not.toMatch(/linear-gradient/);
    expect(coverage).not.toMatch(/linear-gradient/);
  });

  test('pink and teal are family tokens for fills and their text twins for text', () => {
    expect(checklist).toMatch(/const PINK = 'var\(--accent\)';\s*const PINK_TEXT = 'var\(--accent-dark\)';\s*const TEAL = 'var\(--primary\)';\s*const TEAL_TEXT = 'var\(--primary-text\)';/);
    expect(coverage).toMatch(/const TEAL = 'var\(--primary\)';\s*const TEAL_TEXT = 'var\(--primary-text\)';\s*const PINK_TEXT = 'var\(--accent-dark\)';/);
    // No text is drawn in the fill color.
    expect(checklist).not.toMatch(/color: (?:checked \? [^:]+ : item\.required \? )?PINK\b/);
    expect(checklist).not.toMatch(/color: TEAL\b/);
    expect(coverage).not.toMatch(/color: TEAL\b/);
    expect(coverage).not.toMatch(/\bPINK\b/);
  });

  test('every action is the primary and the badge is ink on gold', () => {
    expect(checklist).toMatch(/background: allRequired \? 'var\(--primary\)' : 'var\(--lala-parchment-3\)'/);
    expect(checklist).toMatch(/border: 'none', background: 'var\(--primary\)', color: 'var\(--text-inverse\)', fontSize: 11/);
    expect(checklist).toMatch(/border: 'none', background: 'var\(--primary\)', color: 'var\(--text-inverse\)',\s*fontSize: 11, fontWeight: 600, cursor: locking/);
    expect(checklist).toMatch(/background: 'var\(--primary\)',\s*color: 'var\(--text-inverse\)', fontSize: 14, fontWeight: 700/);
    expect(checklist).toMatch(/color: allRequired \? 'var\(--text-inverse\)' : 'var\(--text-secondary\)'/);
    expect(checklist).not.toMatch(/color: 'var\(--surface-card\)'/);
    expect(checklist).toMatch(/background: unavailable \? 'var\(--lala-parchment-3\)' : 'var\(--lala-gold\)',\s*color: unavailable \? 'var\(--text-secondary\)' : 'var\(--text-primary\)'/);
    expect(coverage).toMatch(/buttonStyle\(TEAL\)/);
    expect(coverage).toMatch(/buttonStyle\('var\(--danger\)'\)\}>Remove/);
  });

  test('statuses and the toast read the token families', () => {
    expect(checklist).toMatch(/complete: \{ label: 'Complete', color: TEAL_TEXT, background: 'var\(--primary-subtle\)' \}/);
    expect(checklist).toMatch(/in_progress: \{ label: 'In progress', color: 'var\(--warning-text\)', background: 'var\(--warning-bg\)' \}/);
    expect(checklist).toMatch(/background: toast\.type === 'error' \? 'var\(--danger-bg\)' : 'var\(--success-bg\)'/);
    expect(checklist).toMatch(/color: toast\.type === 'error' \? 'var\(--danger-text\)' : 'var\(--success-text\)'/);
    expect(checklist).toMatch(/background: 'var\(--accent-subtle\)', border: '1px solid var\(--accent\)', fontSize: 12, color: 'var\(--text-primary\)'/);
  });

  test('every text pair the checklist draws holds 4.5:1 or better', () => {
    const sources = [tokens];
    for (const [fg, bg] of [
      ['--text-inverse', '--primary'],
      ['--text-inverse', '--danger'],
      ['--text-primary', '--lala-gold'],
      ['--accent-dark', '--surface-card'],
      ['--primary-text', '--primary-subtle'],
      ['--primary-text', '--surface-card'],
      ['--warning-text', '--warning-bg'],
      ['--warning-text', '--surface-card'],
      ['--success-text', '--success-bg'],
      ['--danger-text', '--danger-bg'],
      ['--text-primary', '--accent-subtle'],
      ['--text-secondary', '--surface-bg'],
      ['--text-secondary', '--lala-parchment-2'],
    ]) {
      const ratio = contrast(readToken(sources, fg), readToken(sources, bg));
      expect({ fg, bg, ratio }).toMatchObject({ ratio: expect.any(Number) });
      expect(ratio).toBeGreaterThanOrEqual(4.5);
    }
    // Pink and teal fills as text, and white on gold, kept below 4.5 so they are never reused.
    expect(contrast(readToken(sources, '--accent'), readToken(sources, '--surface-card'))).toBeLessThan(4.5);
    expect(contrast(readToken(sources, '--text-inverse'), readToken(sources, '--lala-gold'))).toBeLessThan(4.5);
  });
});
