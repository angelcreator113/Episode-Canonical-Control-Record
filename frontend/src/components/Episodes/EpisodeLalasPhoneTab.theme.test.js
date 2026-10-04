/**
 * The Episode Phone tab wears the studio theme (audit VISUAL-01/02,
 * batch 4, fourteenth screen): the tab's stylesheet and the missions
 * section it renders set colors only through tokens with no hex
 * fallback; the two buttons are the primary (they were gold under
 * white); the badge is ink on gold; scope pills read the teal, pink and
 * success families. The phone skins in PhonePreviewMode are show art,
 * which the audit keeps distinct from producer controls, and are not
 * covered here.
 */
import { describe, test, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { contrast, readToken, stripTaskRefs } from '../../styles/contrast';

const css = readFileSync(resolve(__dirname, 'EpisodeLalasPhoneTab.css'), 'utf8');
const tab = readFileSync(resolve(__dirname, 'EpisodeLalasPhoneTab.jsx'), 'utf8');
const missions = readFileSync(resolve(__dirname, 'EpisodePhoneMissionsTab.jsx'), 'utf8');
const tokens = readFileSync(resolve(__dirname, '../../styles/design-tokens.css'), 'utf8');
const HEX = /#[0-9a-f]{3,8}\b/i;

describe('Episode Phone theme', () => {
  test('the stylesheet, the tab and the missions section carry no color literal, not even as a var() fallback', () => {
    expect(stripTaskRefs(css)).not.toMatch(HEX);
    expect(css).not.toMatch(/var\(--[a-z0-9-]+,\s*#/i);
    expect(stripTaskRefs(tab)).not.toMatch(HEX);
    expect(stripTaskRefs(missions)).not.toMatch(HEX);
  });

  test('the buttons are the primary, the badge is ink on gold, gold is never text', () => {
    expect(css).toMatch(/\.lalas-phone-preview-btn\s*\{[^}]*background: var\(--primary\);\s*color: var\(--text-inverse\);/);
    expect(css).toMatch(/\.lalas-phone-preview-btn:hover:not\(:disabled\)\s*\{\s*background: var\(--primary-dark\);/);
    expect(css).toMatch(/\.lalas-phone-badge\s*\{[^}]*background: var\(--lala-gold\);\s*color: var\(--text-primary\);/);
    expect(css).not.toMatch(/(?<![-\w])color: var\(--lala-gold\)/);
    expect(css).not.toMatch(/background: var\(--lala-gold\);\s*color: var\(--text-inverse\)/);
    expect(missions).toMatch(/primaryBtn: \{[^}]*background: 'var\(--primary\)', border: 'none', color: 'var\(--text-inverse\)'/);
  });

  test('scope pills and states read the token families', () => {
    expect(missions).toMatch(/background: showWide \? 'var\(--primary-subtle\)' : 'var\(--accent-subtle\)'/);
    expect(missions).toMatch(/color: showWide \? 'var\(--primary-text\)' : 'var\(--accent-dark\)'/);
    expect(missions).toMatch(/background: 'var\(--success-bg\)', color: 'var\(--success-text\)'/);
    expect(missions).toMatch(/color: m\.is_active \? 'var\(--success-text\)' : 'var\(--text-secondary\)'/);
  });

  test('every text pair the tab draws holds 4.5:1 or better', () => {
    const sources = [tokens];
    for (const [fg, bg] of [
      ['--text-inverse', '--primary'],
      ['--text-inverse', '--primary-dark'],
      ['--text-primary', '--lala-gold'],
      ['--lala-gold-text', '--lala-surface'],
      ['--primary-text', '--primary-subtle'],
      ['--accent-dark', '--accent-subtle'],
      ['--success-text', '--success-bg'],
      ['--danger-text', '--danger-bg'],
      ['--lala-danger', '--lala-surface'],
      ['--text-secondary', '--surface-card'],
      ['--lala-ink-muted', '--lala-gold-soft'],
    ]) {
      const ratio = contrast(readToken(sources, fg), readToken(sources, bg));
      expect({ fg, bg, ratio }).toMatchObject({ ratio: expect.any(Number) });
      expect(ratio).toBeGreaterThanOrEqual(4.5);
    }
    expect(contrast(readToken(sources, '--text-inverse'), readToken(sources, '--lala-gold'))).toBeLessThan(4.5);
  });
});
