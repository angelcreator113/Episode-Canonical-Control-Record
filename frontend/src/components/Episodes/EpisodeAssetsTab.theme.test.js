/**
 * The Episode Assets tab wears the studio theme (audit VISUAL-01/02,
 * batch 4, eleventh screen): the tab and its stylesheet set colors only
 * through tokens; the link, upload and promote buttons are the primary
 * (they were purple and amber gradients under white); the readiness
 * ring, bar and status badges read the success, warning, danger and
 * teal families.
 */
import { describe, test, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { contrast, readToken, stripTaskRefs } from '../../styles/contrast';

const jsx = readFileSync(resolve(__dirname, 'EpisodeAssetsTab.jsx'), 'utf8');
const css = readFileSync(resolve(__dirname, 'EpisodeAssetsTab.css'), 'utf8');
const tokens = readFileSync(resolve(__dirname, '../../styles/design-tokens.css'), 'utf8');
const HEX = /#[0-9a-f]{3,8}\b/i;

describe('Episode Assets theme', () => {
  test('the tab and its stylesheet carry no color literal and no gradient', () => {
    expect(stripTaskRefs(jsx)).not.toMatch(HEX);
    expect(stripTaskRefs(css)).not.toMatch(HEX);
    expect(css).not.toMatch(/linear-gradient/);
  });

  test('the buttons are the primary', () => {
    expect(css).toMatch(/\.btn-link-asset,\s*\.btn-upload\s*\{[^}]*background: var\(--primary\);/);
    expect(css).toMatch(/\.btn-promote-inline\s*\{[^}]*background: var\(--primary\);/);
    expect(jsx).toMatch(/border: '1px solid var\(--primary\)', color: 'var\(--primary-text\)', background: 'var\(--primary-subtle\)'/);
  });

  test('the statuses, the readiness ring and the bar read the token families', () => {
    expect(jsx).toMatch(/approved: \{ bg: 'var\(--success-bg\)', color: 'var\(--success-text\)', border: 'var\(--success-border\)'/);
    expect(jsx).toMatch(/generated: \{ bg: 'var\(--primary-subtle\)', color: 'var\(--primary-text\)', border: 'var\(--primary-light\)'/);
    expect(jsx).toMatch(/pending: \{ bg: 'var\(--warning-bg\)', color: 'var\(--warning-text\)', border: 'var\(--warning-border\)'/);
    expect(jsx).toMatch(/missing: \{ bg: 'var\(--lala-parchment-2\)', color: 'var\(--text-secondary\)', border: 'var\(--lala-parchment-3\)'/);
    expect(jsx).toMatch(/color: pct >= 80 \? 'var\(--success-text\)' : pct >= 50 \? 'var\(--warning-text\)' : 'var\(--danger-text\)'/);
    expect(jsx).toMatch(/background: pct >= 80 \? 'var\(--success\)' : pct >= 50 \? 'var\(--warning\)' : 'var\(--danger\)'/);
  });

  test('every text pair the tab draws holds 4.5:1 or better', () => {
    const sources = [tokens];
    for (const [fg, bg] of [
      ['--text-inverse', '--primary'],
      ['--primary-text', '--primary-subtle'],
      ['--success-text', '--success-bg'],
      ['--success-text', '--surface-card'],
      ['--warning-text', '--warning-bg'],
      ['--warning-text', '--surface-card'],
      ['--danger-text', '--surface-card'],
      ['--text-secondary', '--lala-parchment-2'],
      ['--text-secondary', '--surface-card'],
      ['--text-primary', '--surface-card'],
    ]) {
      const ratio = contrast(readToken(sources, fg), readToken(sources, bg));
      expect({ fg, bg, ratio }).toMatchObject({ ratio: expect.any(Number) });
      expect(ratio).toBeGreaterThanOrEqual(4.5);
    }
    // White on the old amber promote button, kept below 4.5 so it is never reused.
    expect(contrast('#ffffff', '#f59e0b')).toBeLessThan(4.5);
  });
});
