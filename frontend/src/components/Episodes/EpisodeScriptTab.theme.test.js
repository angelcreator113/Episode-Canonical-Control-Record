/**
 * The Episode Script tab wears the studio theme (audit VISUAL-01/02,
 * batch 4, ninth screen): the tab and its stylesheet set colors only
 * through tokens; the act and speaker colors are the text-safe family
 * tokens; Save, Approve Beat, Generate and Save Final Script are the
 * primary (they were purple, gold and green gradients); the approved
 * badge is ink on gold; the toast, guard and generate error read text
 * tokens on their surfaces. Evoni's Episode mock (2026-10-05) makes the
 * page's actions lavender and adds the script's card and the side panel
 * (EpisodeScriptPage.css). The Script tab restyle (2026-10-08) moved the
 * tab's inline styles into EpisodeScriptPage.css classes; the same pairs
 * are checked there. EpisodeScriptTab.css, imported nowhere, was deleted
 * (Script page audit, 2026-10-19); the stylesheet checked is the page's.
 */
import { describe, test, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { contrast, readToken, stripTaskRefs } from '../../styles/contrast';

const jsx = readFileSync(resolve(__dirname, 'EpisodeScriptTab.jsx'), 'utf8');
const page = readFileSync(resolve(__dirname, 'EpisodeScriptPage.css'), 'utf8');
const tokens = readFileSync(resolve(__dirname, '../../styles/design-tokens.css'), 'utf8');
const HEX = /#[0-9a-f]{3,8}\b/i;

describe('Episode Script theme', () => {
  test('the tab and its stylesheet carry no color literal and no gradient', () => {
    expect(stripTaskRefs(jsx)).not.toMatch(HEX);
    expect(stripTaskRefs(page)).not.toMatch(HEX);
    expect(jsx).not.toMatch(/linear-gradient/);
    expect(page).not.toMatch(/linear-gradient/);
    // No raw rgb()/rgba()/hsl() either: translucent colours mix a token
    // (Script page audit, 2026-10-19).
    expect(page).not.toMatch(/\b(?:rgba?|hsla?)\(/);
    expect(stripTaskRefs(jsx)).not.toMatch(/\b(?:rgba?|hsla?)\(/);
  });

  test('the dead EpisodeScriptTab.css is gone and nothing imports it', () => {
    expect(existsSync(resolve(__dirname, 'EpisodeScriptTab.css'))).toBe(false);
    expect(jsx).not.toMatch(/EpisodeScriptTab\.css/);
    expect(jsx).toMatch(/import '\.\/EpisodeScriptPage\.css';/);
  });

  test('acts and speakers read the text-safe family tokens', () => {
    expect(jsx).toMatch(/name: 'Opening Ritual',\s+icon: '🎬', color: 'var\(--primary-text\)'/);
    expect(jsx).toMatch(/name: 'Reveal',\s+icon: '✨', color: 'var\(--lala-gold-text\)'/);
    expect(jsx).toMatch(/name: 'Transformation Loop',\s+icon: '👗', color: 'var\(--accent-dark\)'/);
    expect(jsx).toMatch(/name: 'The Event',\s+icon: '🏆', color: 'var\(--info-text\)'/);
    expect(jsx).toMatch(/name: 'Cliffhanger',\s+icon: '🔥', color: 'var\(--success-text\)'/);
    expect(jsx).toMatch(/const sc = \{ Prime: 'var\(--primary-text\)', Lala: 'var\(--accent-dark\)', Kelli: 'var\(--info-text\)', Guest: 'var\(--success-text\)' \};/);
  });

  // The studio look (Evoni's mockup, 2026-10-19) replaced the lavender
  // actions and the gold approved chip: primary actions are the studio's
  // magenta, Unlock and APPROVED are the studio's green on its tint, NEEDS
  // REVISION and DRAFT read their own pairs.
  test('every action is the studio magenta (the mockup) and each status badge reads its own pair', () => {
    expect(stripTaskRefs(page)).not.toMatch(HEX);
    expect(page).toMatch(/\.esp-btn-primary \{[^}]*background: var\(--studio-gradient\);\s*color: var\(--text-inverse\);/);
    expect(page).toMatch(/\.esp-btn-primary\.is-saved \{ background: var\(--success-bg\); color: var\(--success-text\); \}/);
    expect(page).toMatch(/\.esp-lock-btn \{[^}]*background: var\(--studio-magenta\); color: var\(--text-inverse\);/);
    expect(page).toMatch(/\.esp-lock-btn\.is-locked \{ background: var\(--studio-ok-soft\); color: var\(--studio-ok\);/);
    expect(page).toMatch(/\.esp-status\.is-approved \{ background: var\(--studio-ok-soft\); color: var\(--studio-ok\); \}/);
    expect(page).toMatch(/\.esp-status\.is-revision \{ background: var\(--studio-warn-soft\); color: var\(--studio-warn\); \}/);
    expect(page).toMatch(/\.esp-status\.is-draft \{ background: var\(--studio-draft-soft\); color: var\(--studio-draft\); \}/);
    for (const label of ["'Save'", '💾 Save now', 'Generate Script', '💾 Save Final Script']) {
      expect(jsx).toMatch(new RegExp(`className=\\{?[\`"]esp-btn-primary[^>]*>[^<]*${label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`));
    }
    expect(page).toMatch(/\.esp-btn \{[^}]*background: var\(--studio-card\);\s*color: var\(--studio-purple\);/);
    expect(page).not.toMatch(/color: var\(--lala-gold-text\)[^}]*background: var\(--gray-900\)/);
    // No inline colour left in the tab but the two act/speaker variables.
    expect((jsx.match(/style=\{\{/g) || []).length).toBe(2);
  });

  test('the toast, guard result and generate error read text tokens on their surfaces', () => {
    expect(page).toMatch(/\.esp-toast\.is-error \{ background: var\(--danger-bg\); color: var\(--danger-text\);/);
    expect(page).toMatch(/\.esp-toast\.is-success \{ background: var\(--success-bg\); color: var\(--success-text\);/);
    expect(page).toMatch(/\.esp-guard\.is-bad \.esp-guard-title \{ color: var\(--danger-text\); \}/);
    expect(page).toMatch(/\.esp-guard\.is-ok \.esp-guard-title \{ color: var\(--success-text\); \}/);
    expect(page).toMatch(/\.esp-error \{[^}]*background: var\(--danger-bg\); color: var\(--danger-text\); border: 1px solid var\(--danger-border\);/);
    expect(page).toMatch(/\.esp-unsaved-banner \{[^}]*background: var\(--accent-subtle\); border: 1px solid var\(--accent\); color: var\(--text-primary\);/);
  });

  test('every text pair the tab draws holds 4.5:1 or better', () => {
    const sources = [tokens];
    for (const [fg, bg] of [
      ['--text-inverse', '--primary'],
      ['--text-primary', '--lala-gold'],
      ['--primary-text', '--surface-card'],
      ['--primary-text', '--primary-subtle'],
      ['--lala-gold-text', '--surface-card'],
      ['--lala-gold-text', '--lala-gold-soft'],
      ['--accent-dark', '--surface-card'],
      ['--info-text', '--surface-card'],
      ['--success-text', '--surface-card'],
      ['--success-text', '--success-bg'],
      ['--danger-text', '--danger-bg'],
      ['--warning-text', '--surface-card'],
      ['--text-primary', '--accent-subtle'],
      ['--lala-gold', '--gray-900'],
      ['--lala-parchment-3', '--gray-900'],
      ['--text-inverse', '--gray-900'],
      // The mock's actions, card and side panel.
      ['--text-inverse', '--lala-lavender'],
      ['--lala-lavender-text', '--surface-card'],
      ['--lala-lavender-text', '--lala-lavender-soft'],
      ['--lala-ink-muted', '--surface-card'],
      ['--accent-dark', '--accent-subtle'],
      ['--lala-ink', '--accent-subtle'],
      // The restyle: ink and muted ink on the gold tint and the lavender tint.
      ['--lala-ink', '--lala-gold-soft'],
      ['--lala-ink-muted', '--lala-gold-soft'],
      ['--lala-ink', '--lala-lavender-soft'],
      ['--lala-gold-text', '--lala-gold-soft'],
      // The studio look (Evoni's mockup, 2026-10-19).
      ['--text-inverse', '--studio-magenta'],
      ['--text-inverse', '--studio-magenta-hover'],
      ['--text-inverse', '--studio-purple'],
      ['--text-inverse', '--studio-ok'],
      ['--studio-ink', '--studio-card'],
      ['--studio-ink', '--studio-page'],
      ['--studio-ink', '--studio-magenta-soft'],
      ['--studio-ink-muted', '--studio-card'],
      ['--studio-ink-muted', '--studio-page'],
      ['--studio-ink-muted', '--studio-magenta-soft'],
      ['--studio-magenta', '--studio-card'],
      ['--studio-magenta', '--studio-magenta-soft'],
      ['--studio-purple', '--studio-card'],
      ['--studio-purple', '--studio-purple-soft'],
      ['--studio-ok', '--studio-ok-soft'],
      ['--studio-warn', '--studio-warn-soft'],
      ['--studio-draft', '--studio-draft-soft'],
    ]) {
      const ratio = contrast(readToken(sources, fg), readToken(sources, bg));
      expect({ fg, bg, ratio }).toMatchObject({ ratio: expect.any(Number) });
      expect(ratio).toBeGreaterThanOrEqual(4.5);
    }
    // White on the lightest end of the studio gradient (the primary buttons).
    expect(contrast('#ffffff', '#D01C80')).toBeGreaterThanOrEqual(4.5);
    // White on the old gold save gradient and on the old purple, kept
    // below 4.5 so they are never reused.
    expect(contrast('#ffffff', '#C9A83A')).toBeLessThan(4.5);
    expect(contrast('#ffffff', '#D4AF37')).toBeLessThan(4.5);
  });
});
