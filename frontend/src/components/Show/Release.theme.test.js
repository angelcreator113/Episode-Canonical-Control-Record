/**
 * Producer Mode's Release tab wears the studio theme (audit VISUAL-01/02,
 * batch 5, fifth and last screen): ShowDistributionTab and ShowInsightsTab
 * set colors only through tokens. The four platform brand marks (YouTube,
 * TikTok, Instagram, Facebook) stay as data, and only ever fill the on-state
 * toggle or edge a tile: never text, never a hex-alpha tint. The Save and
 * Enable actions are the primary; the enabled tile, the status line and
 * the hashtag chips read the teal family; the insight stats, tier cards,
 * P&L, wardrobe tiers and progress rows read the gold, teal, success,
 * warning, danger, info and pink families with text twins.
 */
import { describe, test, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { contrast, readToken, stripTaskRefs } from '../../styles/contrast';

const dist = readFileSync(resolve(__dirname, 'ShowDistributionTab.jsx'), 'utf8');
const ins = readFileSync(resolve(__dirname, 'ShowInsightsTab.jsx'), 'utf8');
const tokens = readFileSync(resolve(__dirname, '../../styles/design-tokens.css'), 'utf8');
const HEX = /#[0-9a-f]{3,8}\b/i;
const t = (name) => readToken([tokens], name);

const slice = (text, start, end) => {
  const a = text.indexOf(start);
  const b = end ? text.indexOf(end, a) : text.length;
  if (a < 0 || b < 0) throw new Error(`marker missing: ${start} / ${end}`);
  return text.slice(a, b);
};
const brands = slice(dist, 'const PLATFORMS = [', 'const S = {');
const distBody = slice(dist, 'const S = {');

describe('Release theme', () => {
  test.each([['ShowDistributionTab (below the brand marks)', distBody], ['ShowInsightsTab', ins]])('%s sets colors only through tokens', (_name, text) => {
    expect(stripTaskRefs(text)).not.toMatch(HEX);
    expect(text).not.toMatch(/linear-gradient/);
    expect(text).not.toMatch(/\$\{p\.color\}[0-9a-f]{2}|p\.color \+ '/);
  });

  test('the brand marks are data that only fills or edges, never text', () => {
    expect(brands.match(/color: '#[0-9A-F]{6}'/g)).toHaveLength(4);
    expect(distBody).not.toMatch(/color: (?:pd\.enabled \? )?p\.color/);
    expect(distBody).toMatch(/background: pd\.enabled \? p\.color : 'var\(--lala-parchment-3\)'/);
    expect(distBody).toMatch(/border: `2px solid \$\{isExpanded \? p\.color : pd\.enabled \? 'var\(--primary-light\)' : 'var\(--lala-parchment-3\)'\}`/);
    expect(distBody).toMatch(/border: `1px solid \$\{p\.color\}`, borderRadius: 10/);
  });

  test('the distribution actions are the primary and its tiles read the teal family', () => {
    expect(distBody).toMatch(/background: hasChanges \? 'var\(--primary\)' : 'var\(--lala-parchment-2\)', color: hasChanges \? 'var\(--text-inverse\)' : 'var\(--text-secondary\)'/);
    expect(distBody).toMatch(/border: 'none', background: 'var\(--primary\)', color: 'var\(--text-inverse\)', fontSize: 12, fontWeight: 600/);
    expect(distBody).toMatch(/background: pd\.enabled \? 'var\(--primary-subtle\)' : 'var\(--surface-bg\)'/);
    expect(distBody).toMatch(/color: pd\.enabled \? 'var\(--primary-text\)' : 'var\(--text-secondary\)'/);
    expect(distBody).toMatch(/background: 'var\(--primary-subtle\)', color: 'var\(--primary-text\)', borderRadius: 10, fontSize: 10/);
  });

  test('the insights read the families with text twins', () => {
    expect(ins).toMatch(/coins: 'var\(--lala-gold-text\)',\n  reputation: 'var\(--primary-text\)',\n  brand_trust: 'var\(--success-text\)',\n  influence: 'var\(--info-text\)',\n  stress: 'var\(--danger-text\)'/);
    expect(ins).toMatch(/slay: \{ color: 'var\(--lala-gold-text\)', fill: 'var\(--lala-gold\)', bg: 'var\(--lala-gold-soft\)'/);
    expect(ins).toMatch(/pass: \{ color: 'var\(--success-text\)', fill: 'var\(--success\)', bg: 'var\(--success-bg\)'/);
    expect(ins).toMatch(/safe: \{ color: 'var\(--warning-text\)', fill: 'var\(--warning\)', bg: 'var\(--warning-bg\)'/);
    expect(ins).toMatch(/fail: \{ color: 'var\(--danger-text\)', fill: 'var\(--danger\)', bg: 'var\(--danger-bg\)'/);
    expect(ins).toMatch(/background: TIER_CONFIG\[s\.tier\]\?\.fill \|\| 'var\(--text-secondary\)'/);
    expect(ins).toMatch(/background: net >= 0 \? 'var\(--success-bg\)' : 'var\(--danger-bg\)',\n\s+color: net >= 0 \? 'var\(--success-text\)' : 'var\(--danger-text\)'/);
    expect(ins).toMatch(/\{ tier: 'elite', color: 'var\(--accent-dark\)'/);
    expect(ins).toMatch(/\{ tier: 'luxury', color: 'var\(--lala-gold-text\)'/);
    expect(ins).toMatch(/color: 'var\(--lala-gold-text\)' \}\}>\$\{data\.wardrobeValue/);
    expect(ins).toMatch(/background: 'var\(--lala-parchment-2\)', borderRadius: 2, overflow: 'hidden'/);
  });

  test('every text pair the tab uses reads at 4.5:1 or better', () => {
    const pairs = [
      ['--text-inverse', '--primary'],
      ['--text-secondary', '--lala-parchment-2'],
      ['--text-secondary', '--surface-bg'],
      ['--text-secondary', '--surface-card'],
      ['--text-primary', '--surface-bg'],
      ['--primary-text', '--primary-subtle'],
      ['--primary-text', '--surface-card'],
      ['--lala-gold-text', '--lala-gold-soft'],
      ['--lala-gold-text', '--surface-card'],
      ['--success-text', '--success-bg'],
      ['--warning-text', '--warning-bg'],
      ['--danger-text', '--danger-bg'],
      ['--info-text', '--surface-card'],
      ['--accent-dark', '--surface-card'],
      ['--accent-dark', '--surface-bg'],
    ];
    for (const [fg, bg] of pairs) expect(contrast(t(fg), t(bg)), `${fg} on ${bg}`).toBeGreaterThanOrEqual(4.5);
    // retired: white on the brand red, white on gold, pure yellow on cream
    expect(contrast('#ffffff', '#FF0000')).toBeLessThan(4.5);
    expect(contrast('#ffffff', '#B8962E')).toBeLessThan(4.5);
    expect(contrast('#FFD700', '#FFFBEB')).toBeLessThan(4.5);
    expect(contrast('#eab308', '#fefce8')).toBeLessThan(4.5);
  });
});
