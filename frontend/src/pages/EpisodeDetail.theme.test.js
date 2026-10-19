/**
 * The Episode shell wears the studio theme (audit VISUAL-01/02, batch 4,
 * seventh screen): EpisodeDetail's stylesheet and page set colors only
 * through tokens, and its --ed-* palette aliases the tokens. Evoni's
 * Episode mock (2026-10-05) restyles the header and tabs: a pink tab band
 * with a raspberry active tab and "N left" badge, raspberry Production
 * pills (marked with aria-current), a lavender show chip. Her studio
 * mockup (2026-10-19) moves the page to the --studio-* pink palette.
 */
import { describe, test, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { contrast, readToken, stripTaskRefs } from '../styles/contrast';

const css = readFileSync(resolve(__dirname, 'EpisodeDetail.css'), 'utf8');
const jsx = readFileSync(resolve(__dirname, 'EpisodeDetail.jsx'), 'utf8');
const tokens = readFileSync(resolve(__dirname, '../styles/design-tokens.css'), 'utf8');
const HEX = /#[0-9a-f]{3,8}\b/i;
// Task and issue references ("Task #2361", "since #534") are not colors.
// Every declaration block for a selector (the shell repeats selectors
// inside media queries), joined, so an assertion sees them all.
const rule = (selector) => {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`(?:^|[\\s,])${escaped}\\s*\\{`, 'g');
  const bodies = [];
  let m;
  while ((m = re.exec(css))) bodies.push(css.slice(m.index, css.indexOf('}', m.index)));
  if (!bodies.length) throw new Error(`rule missing: ${selector}`);
  return bodies.join('\n');
};

describe('Episode shell theme', () => {
  test('the stylesheet and the page carry no color literal, not even as a var() fallback or inside a gradient', () => {
    expect(stripTaskRefs(css)).not.toMatch(HEX);
    expect(css).not.toMatch(/var\(--[a-z0-9-]+,\s*#/i);
    expect(stripTaskRefs(jsx)).not.toMatch(HEX);
  });

  test('the page palette aliases the tokens', () => {
    const page = rule('.ed-page');
    expect(page).toMatch(/background: var\(--surface-bg\);/);
    expect(page).toMatch(/--ed-primary: var\(--primary\);/);
    expect(page).toMatch(/--ed-primary-dark: var\(--primary-dark\);/);
    expect(page).toMatch(/--ed-text: var\(--text-primary\);/);
    expect(page).toMatch(/--ed-muted: var\(--text-secondary\);/);
    expect(page).toMatch(/--ed-border: var\(--lala-parchment-3\);/);
    expect(page).toMatch(/--ed-danger: var\(--danger\);/);
    expect(page).toMatch(/--ed-success: var\(--success\);/);
  });

  // Evoni's studio mockup (2026-10-19) supersedes the pink tab band of her
  // 2026-10-05 mock on this page (her ruling: the studio palette on the
  // episode page only): a soft pink page, a white tab bar whose chosen tab is
  // a magenta gradient pill, magenta Production pills, a lavender show pill.
  const redesign = css.slice(css.indexOf('The studio header'));

  test('the page is the studio pink; the main tabs a white bar, the chosen one a magenta gradient pill; Production counts what is left', () => {
    expect(jsx).toMatch(/className="ed-page ed-studio"/);
    expect(redesign).toMatch(/\.ed-page\.ed-studio \{ background: var\(--studio-page\);/);
    expect(redesign).toMatch(/\.ed-page\.ed-studio \.ed-tabs-modern \{[^}]*border: 1px solid var\(--studio-line\);[^}]*background: var\(--studio-card\);/);
    expect(redesign).toMatch(/\.ed-page\.ed-studio \.ed-tab\.ed-tab-active,\s*\.ed-page\.ed-studio \.ed-tab\.ed-tab-active:hover \{\s*background: var\(--studio-gradient\);\s*color: var\(--text-inverse\);/);
    expect(redesign).toMatch(/\.ed-tab-badge \{[^}]*background: var\(--studio-magenta-soft\);\s*color: var\(--studio-magenta\);/);
    expect(jsx).toMatch(/data-testid="ed-production-left">\{checksLeft\} left</);
    expect(jsx).toMatch(/aria-current=\{activeTab === t\.key \? 'page' : undefined\}/);
    expect(redesign).toMatch(/\.ed-page\.ed-studio \.eds-show-pill \{[^}]*background: var\(--studio-purple-soft\); color: var\(--studio-purple\);/);
    expect(redesign).toMatch(/\.ed-page\.ed-studio \.eds-primary \{[^}]*background: var\(--studio-gradient\); color: var\(--text-inverse\);/);
    expect(rule('.ed-btn-primary-action')).toMatch(/background: var\(--primary\);\s*color: var\(--text-inverse\);/);
    // No later rule can outrank the chosen tab's pill.
    expect(css).not.toMatch(/\.ed-tab-active[^{]*\{[^}]*!important/);
  });

  test('the Production pills are magenta when chosen and mark it with aria-current', () => {
    expect(jsx).toMatch(/aria-current=\{epSubTab === s\.key \? 'page' : undefined\}/);
    expect(jsx).toMatch(/className=\{`ed-subpill\$\{epSubTab === s\.key \? ' is-active' : ''\}`\}/);
    expect(redesign).toMatch(/\.ed-subpill \{[^}]*border: 1px solid var\(--studio-line-strong\);[^}]*color: var\(--studio-magenta\);/);
    expect(redesign).toMatch(/\.ed-subpill\.is-active \{ background: var\(--studio-magenta\); border-color: var\(--studio-magenta\); color: var\(--text-inverse\);/);
  });

  test('the studio header draws no rgba and every interactive piece is 44px tall or more', () => {
    expect(redesign).not.toMatch(/rgba?\(/);
    for (const sel of ['.ed-page.ed-studio .ed-ep-step', '.ed-page.ed-studio .ed-btn-more']) {
      expect(rule(sel)).toMatch(/width: 44px; height: 44px;/);
    }
    for (const sel of ['.ed-page.ed-studio .ed-status-select select', '.ed-page.ed-studio .ed-balance-chip', '.ed-page.ed-studio .ed-tab', '.ed-page.ed-studio .eds-primary']) {
      expect(rule(sel)).toMatch(/min-height: 44px;/);
    }
    expect(redesign).toMatch(/\.ed-page\.ed-studio \.ed-tab:focus-visible,[^{]*\{\s*outline: 2px solid var\(--studio-magenta\);/);
  });

  test('the evaluation verdicts read text tokens on their surfaces', () => {
    // Results → Evaluation moved to EpisodeResultsPages (the Results redesign, 2026-10-08).
    const results = readFileSync(resolve(__dirname, '../components/Episodes/EpisodeResultsPages.jsx'), 'utf8');
    expect(results).toMatch(/slay: \{ color: 'var\(--lala-gold-text\)', bg: 'var\(--lala-gold-soft\)'/);
    expect(results).toMatch(/pass: \{ color: 'var\(--success-text\)', bg: 'var\(--success-bg\)'/);
    expect(results).toMatch(/safe: \{ color: 'var\(--warning-text\)', bg: 'var\(--warning-bg\)'/);
    expect(results).toMatch(/fail: \{ color: 'var\(--danger-text\)', bg: 'var\(--danger-bg\)'/);
  });

  test('every text pair the shell draws holds 4.5:1 or better', () => {
    const sources = [tokens];
    for (const [fg, bg] of [
      ['--text-inverse', '--primary'],
      ['--text-inverse', '--primary-dark'],
      ['--primary-text', '--primary-subtle'],
      ['--primary-text', '--surface-card'],
      ['--text-primary', '--surface-bg'],
      ['--text-secondary', '--surface-bg'],
      ['--text-secondary', '--surface-card'],
      ['--lala-gold-text', '--lala-gold-soft'],
      ['--lala-gold-text', '--surface-card'],
      ['--success-text', '--success-bg'],
      ['--warning-text', '--warning-bg'],
      ['--danger-text', '--danger-bg'],
      ['--accent-dark', '--accent-subtle'],
      ['--primary-subtle', '--gray-900'],
      ['--lala-parchment-3', '--gray-800'],
      // The redesign's header and tabs.
      ['--text-inverse', '--accent-dark'],
      ['--accent-dark', '--surface-card'],
      ['--text-inverse', '--lala-lavender'],
      ['--lala-lavender-text', '--surface-card'],
      ['--lala-ink', '--lala-parchment-2'],
      ['--lala-ink', '--surface-card'],
      // The studio header and tabs (Evoni's mockup, 2026-10-19).
      ['--studio-ink', '--studio-card'],
      ['--studio-ink', '--studio-page'],
      ['--studio-ink-muted', '--studio-card'],
      ['--studio-ink-muted', '--studio-page'],
      ['--studio-purple', '--studio-purple-soft'],
      ['--studio-magenta', '--studio-magenta-soft'],
      ['--studio-magenta', '--studio-card'],
      ['--text-inverse', '--studio-magenta'],
      ['--studio-ok', '--studio-ok-soft'],
    ]) {
      const ratio = contrast(readToken(sources, fg), readToken(sources, bg));
      expect({ fg, bg, ratio }).toMatchObject({ ratio: expect.any(Number) });
      expect(ratio).toBeGreaterThanOrEqual(4.5);
    }
    // The pairs the shell used to draw, kept below 4.5 so they are never
    // reused as text: the old pink tab text and the old blue primary.
    expect(contrast('#ec4899', '#ffffff')).toBeLessThan(4.5);
    expect(contrast('#ffffff', '#3b82f6')).toBeLessThan(4.5);
  });
});

// Script page audit 4 (2026-10-19): the compact header keeps the Episodes
// crumb, the way back to the show, at every width.
describe('the compact header keeps Episodes', () => {
  test('the crumbs stay; only Home and the title crumb fold away', () => {
    expect(css).not.toMatch(/\.is-compact \.eds-crumbs\s*[,{]/);
    expect(css).toMatch(/\.is-compact \.eds-crumbs li:not\(\.eds-crumb-episodes\)\s*\{[^}]*display:\s*none/);
    expect(jsx).toMatch(/className="eds-crumb-episodes"/);
  });
});
