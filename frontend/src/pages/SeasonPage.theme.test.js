/**
 * The Season page's colours (Evoni, 2026-10-25: the mockup's pinks and
 * purples, on this page only). They are page-scoped tokens on .szn-page in
 * SeasonPage.css, never the app's; every text pair the page draws holds
 * 4.5:1, so text is plum or ink and pink is a fill or an accent.
 */
import { describe, test, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { contrast, readToken } from '../styles/contrast';

const css = readFileSync(resolve(__dirname, 'SeasonPage.css'), 'utf8');
const jsx = ['SeasonPage.jsx', '../components/Show/SeasonPageRoadmap.jsx', '../components/Show/SeasonPageOverview.jsx', '../components/Show/SeasonPageParts.jsx']
  .map((f) => readFileSync(resolve(__dirname, f), 'utf8')).join('\n');

describe('Season page theme', () => {
  test('the colours are --sp-* tokens declared on .szn-page; the rules read them, and the JSX sets none', () => {
    const root = css.slice(css.indexOf('.szn-page {'), css.indexOf('}', css.indexOf('.szn-page {')));
    expect(root).toMatch(/--sp-pink: #D6247A;/);
    // Outside the token block, colours are tokens (the hero's shade and the shadows are rgba of the plum).
    const rules = css.replace(root, '').replace(/\/\*[\s\S]*?\*\//g, '');
    expect(rules).not.toMatch(/#[0-9a-f]{3,8}\b/i);
    expect(css).not.toMatch(/--lala-[a-z-]+:/); // the app's tokens are not redefined here
    expect(jsx).not.toMatch(/['"]#[0-9a-f]{3,8}['"]/i);
  });

  test('every text pair the page draws holds 4.5:1 or better', () => {
    const t = (name) => readToken([css], name);
    for (const [fg, bg] of [
      ['--sp-ink', '--sp-bg'], ['--sp-ink', '--sp-card'], ['--sp-ink', '--sp-pink-soft'],
      ['--sp-muted', '--sp-card'], ['--sp-muted', '--sp-bg'], ['--sp-muted', '--sp-pink-soft'],
      ['--sp-white', '--sp-pink'], ['--sp-white', '--sp-purple-fill'], ['--sp-white', '--sp-shade'], ['--sp-white', '--sp-green'],
      ['--sp-pink-deep', '--sp-card'], ['--sp-pink-deep', '--sp-bg'], ['--sp-pink-deep', '--sp-pink-soft'],
      ['--sp-purple', '--sp-card'], ['--sp-purple', '--sp-purple-soft'],
      ['--sp-gold-text', '--sp-gold-soft'], ['--sp-green', '--sp-green-soft'],
      ['--sp-gold', '--sp-shade'],
    ]) {
      const ratio = contrast(t(fg), t(bg));
      expect({ fg, bg, ratio }).toMatchObject({ ratio: expect.any(Number) });
      expect(ratio).toBeGreaterThanOrEqual(4.5);
    }
    // Pink as body text on the soft ground would fail: it is never used that way.
    expect(contrast(t('--sp-pink'), t('--sp-pink-soft'))).toBeLessThan(4.5);
  });

  test('a phone: 2×2 stat cards, the tabs scroll, one roadmap column, 44px targets, 12px text', () => {
    const phone = css.slice(css.indexOf('@media (max-width: 640px)'));
    expect(phone).toMatch(/\.szn-overview-row, \.szn-summary-row \{ grid-template-columns: minmax\(0, 1fr\); \}/);
    expect(css).toMatch(/@media \(max-width: 1180px\) \{[\s\S]*?\.szn-stats \{ grid-template-columns: repeat\(2, minmax\(0, 1fr\)\); \}[\s\S]*?\.szn-parts \{ grid-template-columns: minmax\(0, 1fr\); \}/);
    expect(css).toMatch(/\.szn-tabs \{[^}]*overflow-x: auto;/);
    expect(css).toMatch(/\.szn-tab \{[^}]*min-height: 44px;/);
    expect(css).toMatch(/\.szn-btn \{[^}]*min-height: 44px;/);
    const sizes = [...css.matchAll(/font-size: (\d+)px/g)].map((m) => Number(m[1]));
    expect(Math.min(...sizes)).toBeGreaterThanOrEqual(12);
  });
});
