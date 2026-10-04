/**
 * The Episode Distribution tab wears the studio theme (audit
 * VISUAL-01/02, batch 4, twelfth screen): the tab and its stylesheet set
 * colors only through tokens, except the four platforms' own brand marks
 * (YouTube, TikTok, Instagram, Facebook), which are not ours to retune;
 * Save, the primary and the tag chips are the primary (they were green
 * and purple gradients); the statuses read text tokens; the remove
 * button is the danger family; the focus ring is the primary.
 */
import { describe, test, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { contrast, readToken, stripTaskRefs } from '../../styles/contrast';

const jsx = readFileSync(resolve(__dirname, 'EpisodeDistributionTab.jsx'), 'utf8');
const css = readFileSync(resolve(__dirname, 'EpisodeDistributionTab.css'), 'utf8');
const tokens = readFileSync(resolve(__dirname, '../../styles/design-tokens.css'), 'utf8');
const HEX = /#[0-9a-f]{3,8}\b/i;
// The platforms' brand marks are the one allowed block of literals.
const platforms = jsx.slice(jsx.indexOf('const PLATFORMS = {'), jsx.indexOf('const STATUS_OPTIONS'));
const outsidePlatforms = jsx.replace(platforms, '');

describe('Episode Distribution theme', () => {
  test('the tab carries no color literal outside the platform brand marks, and the stylesheet none at all', () => {
    expect(platforms).toMatch(/color: '#FF0000'/);
    expect(stripTaskRefs(outsidePlatforms)).not.toMatch(HEX);
    expect(stripTaskRefs(css)).not.toMatch(HEX);
    expect(css).not.toMatch(/linear-gradient/);
    expect(css).not.toMatch(/rgba\((?:139, 92, 246|102, 126, 234|16, 185, 129),/);
  });

  test('Save, the primary and the tag chips are the primary; the remove button is the danger family', () => {
    expect(css).toMatch(/\.episode-distribution-tab \.btn-save\s*\{[^}]*background: var\(--primary\);/);
    expect(css).toMatch(/\.episode-distribution-tab \.btn-primary\s*\{\s*background: var\(--primary\);/);
    expect(css).toMatch(/\.episode-distribution-tab \.btn-remove-thumb\s*\{[^}]*background: var\(--danger\);/);
    expect(css).toMatch(/\.episode-distribution-tab \.btn-remove-thumb:hover\s*\{\s*background: var\(--danger-text\);/);
    expect(css).toMatch(/\.episode-distribution-tab \.form-select:focus\s*\{\s*outline: none;\s*border-color: var\(--primary\);/);
    expect(jsx).toMatch(/border: '1px solid var\(--lala-gold\)', background: 'var\(--surface-bg\)', color: 'var\(--lala-gold-text\)'/);
  });

  test('statuses and the toggle read the token families', () => {
    expect(jsx).toMatch(/\{ value: 'scheduled', label: 'Scheduled', color: 'var\(--warning-text\)' \}/);
    expect(jsx).toMatch(/\{ value: 'published', label: 'Published', color: 'var\(--success-text\)' \}/);
    expect(css).toMatch(/\.status-enabled\s*\{\s*color: var\(--success-text\);/);
    expect(css).toMatch(/input:checked \+ \.toggle-slider\s*\{\s*background: var\(--success\);/);
  });

  test('every text pair the tab draws holds 4.5:1 or better', () => {
    const sources = [tokens];
    for (const [fg, bg] of [
      ['--text-inverse', '--primary'],
      ['--text-inverse', '--danger'],
      ['--text-inverse', '--danger-text'],
      ['--lala-gold-text', '--surface-bg'],
      ['--success-text', '--surface-card'],
      ['--warning-text', '--surface-card'],
      ['--text-secondary', '--surface-card'],
      ['--text-secondary', '--lala-parchment-2'],
      ['--text-primary', '--surface-card'],
    ]) {
      const ratio = contrast(readToken(sources, fg), readToken(sources, bg));
      expect({ fg, bg, ratio }).toMatchObject({ ratio: expect.any(Number) });
      expect(ratio).toBeGreaterThanOrEqual(4.5);
    }
    // White on the old green save gradient, kept below 4.5 so it is never reused.
    expect(contrast('#ffffff', '#10b981')).toBeLessThan(4.5);
  });
});
