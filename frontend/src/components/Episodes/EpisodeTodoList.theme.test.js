/**
 * The Episode Todo list wears the studio theme (audit VISUAL-01/02,
 * batch 4, seventeenth screen): the component sets colors only through
 * tokens; the wardrobe list wears the gold family and the career list
 * the teal family (fills for borders and check squares, soft tints for
 * surfaces, text twins for labels; the fills as text were 2.82:1 and
 * 4.5:1 short on white); Generate, Lock and Done are the primary (they
 * were gold and indigo under white); the completion states read the
 * success family; errors read the danger family.
 */
import { describe, test, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { contrast, readToken, stripTaskRefs } from '../../styles/contrast';

const jsx = readFileSync(resolve(__dirname, 'EpisodeTodoList.jsx'), 'utf8');
const tokens = readFileSync(resolve(__dirname, '../../styles/design-tokens.css'), 'utf8');
const HEX = /#[0-9a-f]{3,8}\b/i;

// The Assets redesign (2026-10-08): the list's styles moved to
// EpisodeAssetsTab.css (.etl-*). The wardrobe list keeps the gold accent,
// the career list takes the lavender; actions are the lavender.
const css = readFileSync(resolve(__dirname, 'EpisodeAssetsTab.css'), 'utf8');

describe('Episode Todo list theme', () => {
  test('the list carries no color literal and no gradient', () => {
    expect(stripTaskRefs(jsx)).not.toMatch(HEX);
    expect(jsx).not.toMatch(/linear-gradient/);
    expect(css).toMatch(/\.etl-modal \{[^}]*background: rgba\(0, 0, 0, 0\.7\);/);
  });

  test('each list has its accent; gold is never text', () => {
    expect(css).toMatch(/\.etl\.is-wardrobe \{ --list-edge: var\(--lala-gold\); --list-text: var\(--lala-gold-text\); --list-soft: var\(--lala-gold-soft\); --list-line: var\(--lala-gold-line\); --list-check: var\(--text-primary\); \}/);
    expect(css).toMatch(/\.etl\.is-career \{ --list-edge: var\(--lala-lavender\);[^}]*--list-check: var\(--text-inverse\); \}/);
    expect(css).toMatch(/\.etl-tag\.is-optional \{ color: var\(--list-text\); \}/);
    expect(css).toMatch(/\.etl-tab\.is-on\.is-wardrobe \{[^}]*color: var\(--lala-gold-text\);/);
    expect(css).not.toMatch(/(?<![-\w])color: var\(--(?:lala-gold|list-edge)\)/);
  });

  test('Generate, Lock and Done are the lavender; checks and completion read the success family', () => {
    expect(css).toMatch(/\.etl-btn-primary \{[^}]*background: var\(--lala-lavender\); color: var\(--text-inverse\);/);
    expect(jsx).toMatch(/className="etl-btn-primary" onClick=\{handleGenerate\}/);
    expect(jsx).toMatch(/className="etl-btn-primary" onClick=\{handleLock\}/);
    expect(jsx).toMatch(/className="etl-btn-primary is-wide"[^\n]*>Done<\/button>/);
    expect(css).toMatch(/\.etl-toggle \{[^}]*background: var\(--list-edge\); color: var\(--list-check\);/);
    expect(css).toMatch(/\.etl-check\.is-done \{ border: none; background: var\(--success-text\); color: var\(--text-inverse\); \}/);
    expect(css).toMatch(/\.etl-task\.is-done \{ background: var\(--success-bg\); \}/);
    expect(css).toMatch(/\.etl-head\.is-done \{ background: var\(--success-bg\); \}/);
    expect(css).toMatch(/\.etl-progress\.is-done span \{ background: var\(--success\); \}/);
    expect(css).toMatch(/\.etl-locked \{[^}]*background: var\(--success-bg\); color: var\(--success-text\);/);
    expect(css).toMatch(/\.etl-error \{[^}]*background: var\(--danger-bg\); color: var\(--danger-text\);/);
  });

  test('every text pair the list draws holds 4.5:1 or better', () => {
    const sources = [tokens];
    for (const [fg, bg] of [
      ['--text-inverse', '--primary'],
      ['--text-inverse', '--success-text'],
      ['--text-primary', '--lala-gold'],
      ['--lala-gold-text', '--lala-gold-soft'],
      ['--text-primary', '--lala-gold-soft'],
      ['--text-secondary', '--lala-gold-soft'],
      ['--success-text', '--lala-gold-soft'],
      ['--primary-text', '--primary-subtle'],
      ['--text-secondary', '--primary-subtle'],
      ['--success-text', '--success-bg'],
      ['--text-secondary', '--success-bg'],
      ['--text-primary', '--success-bg'],
      ['--text-secondary', '--surface-bg'],
      ['--text-secondary', '--lala-parchment-2'],
      ['--danger-text', '--danger-bg'],
      ['--text-inverse', '--lala-lavender'],
      ['--lala-lavender-text', '--surface-card'],
      ['--lala-lavender-text', '--lala-lavender-soft'],
      ['--lala-ink', '--surface-card'],
      ['--lala-ink-muted', '--surface-card'],
      ['--lala-ink-muted', '--success-bg'],
    ]) {
      const ratio = contrast(readToken(sources, fg), readToken(sources, bg));
      expect({ fg, bg, ratio }).toMatchObject({ ratio: expect.any(Number) });
      expect(ratio).toBeGreaterThanOrEqual(4.5);
    }
    // Gold as text and white on gold, the old wardrobe palette, kept below 4.5 so they are never reused.
    expect(contrast(readToken(sources, '--lala-gold'), readToken(sources, '--surface-card'))).toBeLessThan(4.5);
    expect(contrast(readToken(sources, '--text-inverse'), readToken(sources, '--lala-gold'))).toBeLessThan(4.5);
  });
});
