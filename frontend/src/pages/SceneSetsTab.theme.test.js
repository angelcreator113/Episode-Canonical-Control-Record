/**
 * The Scene Sets stylesheets wear the studio theme (audit VISUAL-01/02,
 * batch 4, nineteenth screen, part one: the stylesheets; the page
 * component's inline styles follow): SceneSetsTab.css and the
 * DressedAngles styles set colors only through tokens with no hex
 * fallback; the local `--ss-*` palette aliases the tokens; the four
 * color gradients are gone; Generate, the active filter pill, the
 * active scope button and the promote hover are the primary (they were
 * indigo gradients and gold under white); gold is a border, a fill
 * under ink or gold text, never text itself; the lightbox's light text
 * is parchment on its dark surfaces; the ready badge is white on the
 * success text, not on a translucent green.
 */
import { describe, test, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { contrast, readToken } from '../styles/contrast';

const css = readFileSync(resolve(__dirname, 'SceneSetsTab.css'), 'utf8');
const dressed = readFileSync(resolve(__dirname, '../components/SceneSets/DressedAngles.css'), 'utf8');
const tokens = readFileSync(resolve(__dirname, '../styles/design-tokens.css'), 'utf8');
const HEX = /#[0-9a-f]{3,8}\b/i;
const stripRefs = (s) => s.replace(/#\d{3,4}\b/g, '');
// Every block a selector opens (media-query duplicates included), joined.
const rule = (selector) => {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`(?:^|[\\s,])${escaped}\\s*\\{`, 'g');
  const blocks = [];
  let m;
  while ((m = re.exec(css))) blocks.push(css.slice(m.index, css.indexOf('}', m.index)));
  if (!blocks.length) throw new Error(`rule missing: ${selector}`);
  return blocks.join('\n');
};

describe('Scene Sets stylesheet theme', () => {
  test('the stylesheets carry no color literal, not even as a var() fallback, and no color gradient', () => {
    expect(stripRefs(css)).not.toMatch(HEX);
    expect(stripRefs(dressed)).not.toMatch(HEX);
    expect(css).not.toMatch(/var\(--[a-z0-9-]+,\s*#/i);
    expect(dressed).not.toMatch(/var\(--[a-z0-9-]+,\s*#/i);
    // The skeleton shimmer and the hero scrim are the two gradients left, both token or rgba.
    expect(css.match(/gradient\(/g)).toHaveLength(2);
    expect(css).toMatch(/linear-gradient\(135deg, var\(--lala-parchment-2\) 25%, var\(--lala-parchment-3\) 50%, var\(--lala-parchment-2\) 75%\)/);
    expect(css).toMatch(/linear-gradient\(transparent, rgba\(0, 0, 0, 0\.75\)\)/);
  });

  test('the local palette aliases the tokens', () => {
    expect(css).toMatch(/--ss-parchment: var\(--surface-bg\);\s*--ss-gold: var\(--lala-gold\);\s*--ss-gold-text: var\(--lala-gold-text\);\s*--ss-gold-light: var\(--lala-gold-soft\);\s*--ss-ink: var\(--text-primary\);\s*--ss-muted: var\(--text-secondary\);\s*--ss-border: var\(--lala-parchment-3\);\s*--ss-surface: var\(--surface-bg\);/);
  });

  test('the actions are the primary; gold is never text nor under white', () => {
    expect(rule('.scene-sets-btn-generate')).toMatch(/background: var\(--primary\);\s*color: var\(--text-inverse\);/);
    expect(rule('.scene-sets-filter-pill.active')).toMatch(/background: var\(--primary\);\s*color: var\(--text-inverse\);/);
    expect(rule('.scene-sets-scope-btn.active')).toMatch(/background: var\(--primary\); color: var\(--text-inverse\);/);
    expect(rule('.scene-sets-lightbox-promote:hover')).toMatch(/background: var\(--primary\);\s*border-color: var\(--primary\);\s*color: var\(--text-inverse\);/);
    expect(rule('.scene-sets-angle-regen:hover')).toMatch(/background: var\(--primary\);/);
    expect(rule('.scene-sets-franchise-badge')).toMatch(/background: var\(--lala-gold\);\s*color: var\(--text-primary\);/);
    expect(rule('.scene-sets-progress-bar-fill')).toMatch(/background: var\(--lala-gold\);/);
    expect(rule('.scene-sets-base-ready-badge')).toMatch(/background: var\(--success-text\);\s*color: var\(--text-inverse\);/);
    expect(css).not.toMatch(/(?<![-\w])color: var\(--(?:lala-gold|ss-gold)\)/);
    expect(dressed).not.toMatch(/(?<![-\w])color: var\(--lala-gold\)/);
    expect(css).not.toMatch(/background: var\(--(?:lala-gold|ss-gold)\);[^}]*color: var\(--(?:text-inverse|surface-card)\)/);
    expect(css).not.toMatch(/rgba\((?:184, 150, 46|212, 175, 55), 0\.(?:85|9)\)/);
  });

  test('the dark lightbox reads parchment, placeholders read the faint ink', () => {
    expect(rule('.scene-sets-lightbox-info p')).toMatch(/color: var\(--lala-parchment-3\);/);
    expect(rule('.scene-sets-prompt-preview-section label')).toMatch(/color: var\(--lala-parchment-3\);/);
    expect(rule('.scene-sets-search-input::placeholder')).toMatch(/color: var\(--text-faint\);/);
    expect(rule('.scene-sets-card-preview')).toMatch(/background: var\(--primary-subtle\);/);
  });

  test('every text pair the stylesheets draw holds 4.5:1 or better', () => {
    const sources = [tokens];
    for (const [fg, bg] of [
      ['--text-inverse', '--primary'],
      ['--text-inverse', '--success-text'],
      ['--text-inverse', '--gray-900'],
      ['--lala-parchment-3', '--gray-900'],
      ['--text-primary', '--lala-gold'],
      ['--lala-gold-text', '--surface-card'],
      ['--lala-gold-text', '--surface-bg'],
      ['--lala-gold-text', '--lala-gold-soft'],
      ['--primary-text', '--primary-subtle'],
      ['--primary-text', '--surface-card'],
      ['--text-primary', '--surface-bg'],
      ['--text-primary', '--primary-subtle'],
      ['--text-primary', '--lala-gold-soft'],
      ['--text-secondary', '--surface-card'],
      ['--text-secondary', '--surface-bg'],
      ['--text-secondary', '--lala-parchment-2'],
      ['--success-text', '--success-bg'],
      ['--warning-text', '--warning-bg'],
      ['--danger-text', '--danger-bg'],
      ['--danger-text', '--surface-card'],
    ]) {
      const ratio = contrast(readToken(sources, fg), readToken(sources, bg));
      expect({ fg, bg, ratio }).toMatchObject({ ratio: expect.any(Number) });
      expect(ratio).toBeGreaterThanOrEqual(4.5);
    }
    // Gold as text, white on gold and white on the old translucent green, kept below 4.5 so they are never reused.
    expect(contrast(readToken(sources, '--lala-gold'), readToken(sources, '--surface-card'))).toBeLessThan(4.5);
    expect(contrast(readToken(sources, '--text-inverse'), readToken(sources, '--lala-gold'))).toBeLessThan(4.5);
    expect(contrast('#ffffff', '#16a34a')).toBeLessThan(4.5);
  });
});
