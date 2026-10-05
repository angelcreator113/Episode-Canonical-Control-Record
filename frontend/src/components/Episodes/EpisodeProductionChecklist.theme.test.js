/**
 * The Episode Production Checklist wears the studio theme (audit
 * VISUAL-01/02, batch 4, sixteenth screen): the checklist and the
 * coverage panel it renders set colors only through tokens; pink and
 * teal are family tokens for fills and borders and their text-safe twins
 * for text; the statuses, toast and badge read the token families.
 * Evoni's Episode mock (2026-10-05) makes it a hub: done lavender, the
 * actions lavender, the Timeline Editor raspberry.
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

  // Evoni's Episode mock (2026-10-05): the checklist is a hub (ChecklistHub.jsx,
  // ChecklistHub.css): done is lavender, required-and-missing pink, the
  // Timeline Editor button raspberry, the actions lavender.
  const hubJsx = readFileSync(resolve(__dirname, 'ChecklistHub.jsx'), 'utf8');
  const hubCss = readFileSync(resolve(__dirname, 'ChecklistHub.css'), 'utf8');

  test('the hub carries no color literal; pink text is its text-safe twin', () => {
    expect(stripTaskRefs(hubJsx)).not.toMatch(HEX);
    expect(stripTaskRefs(hubCss)).not.toMatch(HEX);
    expect(checklist).toMatch(/const PINK_TEXT = 'var\(--accent-dark\)';\s*const LAV_TEXT = 'var\(--lala-lavender-text\)';/);
    expect(checklist).not.toMatch(/color: [^,}]*'var\(--accent\)'/);
    expect(coverage).toMatch(/const TEAL = 'var\(--primary\)';\s*const TEAL_TEXT = 'var\(--primary-text\)';\s*const PINK_TEXT = 'var\(--accent-dark\)';/);
    expect(coverage).not.toMatch(/color: TEAL\b/);
  });

  test('done is lavender, the actions lavender, the Timeline Editor raspberry', () => {
    expect(hubCss).toMatch(/\.ckh-box\.is-on \{ border: none; background: var\(--lala-lavender\); color: var\(--text-inverse\); \}/);
    expect(hubCss).toMatch(/\.ckh-box\.is-required \{ border-color: var\(--accent\); \}/);
    expect(hubCss).toMatch(/\.ckh-timeline-open \{[^}]*background: var\(--accent-dark\);\s*color: var\(--text-inverse\);/);
    expect(hubCss).toMatch(/\.ckh-fix \{[^}]*color: var\(--lala-lavender-text\);/);
    expect(hubCss).toMatch(/\.ckh-evaluate \{[^}]*background: var\(--lala-lavender\); color: var\(--text-inverse\);/);
    expect(checklist).toMatch(/background: allRequired \? 'var\(--lala-lavender\)' : 'var\(--lala-parchment-3\)'/);
    expect(checklist).toMatch(/color: allRequired \? 'var\(--text-inverse\)' : 'var\(--text-secondary\)'/);
    expect(checklist).toMatch(/border: 'none', background: 'var\(--lala-lavender\)', color: 'var\(--text-inverse\)',\s*fontSize: 11, fontWeight: 600, cursor: locking/);
    expect(coverage).toMatch(/buttonStyle\(TEAL\)/);
    expect(coverage).toMatch(/buttonStyle\('var\(--danger\)'\)\}>Remove/);
  });

  test('statuses and the toast read the token families', () => {
    expect(checklist).toMatch(/complete: \{ label: 'Complete', color: LAV_TEXT, background: 'var\(--lala-lavender-soft\)' \}/);
    expect(checklist).toMatch(/in_progress: \{ label: 'In progress', color: 'var\(--warning-text\)', background: 'var\(--warning-bg\)' \}/);
    expect(hubCss).toMatch(/\.ckh-chip\.is-complete \{ background: var\(--lala-lavender-soft\); color: var\(--lala-lavender-text\); \}/);
    expect(hubCss).toMatch(/\.ckh-chip\.is-setup \{ background: var\(--warning-bg\); color: var\(--warning-text\); \}/);
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
      ['--text-inverse', '--lala-lavender'],
      ['--text-inverse', '--accent-dark'],
      ['--lala-lavender-text', '--surface-card'],
      ['--lala-lavender-text', '--lala-lavender-soft'],
      ['--accent-dark', '--accent-subtle'],
      ['--lala-ink-muted', '--surface-card'],
      ['--lala-ink-muted', '--lala-parchment-2'],
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
