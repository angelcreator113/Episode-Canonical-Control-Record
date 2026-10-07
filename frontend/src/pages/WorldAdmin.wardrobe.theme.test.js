/**
 * The Producer Mode Wardrobe wears the studio theme (audit VISUAL-01/02,
 * batch 5, third screen): the Assets → Wardrobe sub-tab slice of
 * WorldAdmin.jsx (the bulk bar, the view and category pills, the type
 * cards, the filters, the item editor and its gameplay panel, the item
 * cards, the pager, the upload and outfit-set modals, the usage modal and
 * the lightbox) sets colors only through tokens. The selected pills and
 * the filled actions are the primary (they were slate and indigo under
 * white); the bulk selection is ink on gold; warnings, dangers, tags and
 * prices read their families; the gameplay panels are gold text on the
 * page surface with gold-line borders.
 */
import { describe, test, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { contrast, readToken, stripTaskRefs } from '../styles/contrast';

const jsx = readFileSync(resolve(__dirname, 'WorldAdmin.jsx'), 'utf8');
const tokens = readFileSync(resolve(__dirname, '../styles/design-tokens.css'), 'utf8');
const css = readFileSync(resolve(__dirname, 'WorldAdmin.css'), 'utf8');
const HEX = /#[0-9a-f]{3,8}\b/i;

const slice = (text, start, end) => {
  const a = text.indexOf(start);
  const b = text.indexOf(end, a);
  if (a < 0 || b < 0) throw new Error(`marker missing: ${start} / ${end}`);
  return text.slice(a, b);
};
const wardrobe = slice(jsx, "{activeTab === 'wardrobe' && subTab === 'wardrobe-items' && (() => {", "{activeTab === 'characters' && subTab === 'characters-list' && (");

describe('Wardrobe theme', () => {
  test('the Wardrobe slice sets colors only through tokens, with no gradient and no hex alpha tint', () => {
    expect(stripTaskRefs(wardrobe)).not.toMatch(HEX);
    expect(wardrobe).not.toMatch(/linear-gradient/);
    expect(wardrobe).not.toMatch(/var\(--[a-z-]+\)[0-9a-f]{2}\b/);
  });

  test('the closet to the redesign: the view toggle lavender, the pills pink when chosen, the bulk selection ink on gold', () => {
    expect(wardrobe).toMatch(/background: wardrobeViewMode === mode \? 'var\(--lala-lavender\)' : 'var\(--surface-card\)',\s*color: wardrobeViewMode === mode \? 'var\(--text-inverse\)' : 'var\(--text-secondary\)'/);
    expect(wardrobe).toMatch(/className=\{`wa-wd-pill\$\{on \? ' active' : ''\}`\}/);
    expect(css).toMatch(/\.wa-wd-pill\.active \{ background: var\(--accent-dark\); border-color: var\(--accent-dark\); color: var\(--text-inverse\); \}/);
    expect(css).toMatch(/\.wa-wd-add \{[^}]*border: 1px solid var\(--lala-lavender\); background: var\(--surface-card\); color: var\(--lala-lavender-text\)/);
    expect(wardrobe).toMatch(/background: isBulkSelected \? 'var\(--lala-gold\)' : 'rgba\(255,255,255,0\.9\)'/);
    expect(wardrobe).toMatch(/isBulkSelected && <span style=\{\{ color: 'var\(--text-primary\)'/);
    expect(wardrobe).toMatch(/background: 'var\(--danger\)', color: 'var\(--text-inverse\)', border: 'none', borderRadius: 4, fontSize: 10/);
    // Add piece is its own dialog now (components/Wardrobe/AddPieceDialog, 2026-10-07).
    expect(wardrobe).toMatch(/<AddPieceDialog\b/);
    expect(wardrobe).toMatch(/background: promotingVariant \? 'var\(--text-secondary\)' : 'var\(--primary-dark\)', color: 'var\(--text-inverse\)'/);
    expect(wardrobe).toMatch(/background: sendingToPhone \? 'var\(--text-secondary\)' : 'var\(--accent-dark\)', color: 'var\(--text-inverse\)'/);
    expect(wardrobe).not.toMatch(/color: 'var\(--lala-gold\)'/);
    expect(wardrobe).not.toMatch(/background: 'var\(--lala-gold\)'[^}]*color: 'var\(--text-inverse\)'/);
  });

  test('warnings, dangers, tags, prices and the gameplay panels read the families', () => {
    expect(wardrobe).toMatch(/background: 'var\(--warning-bg\)', borderRadius: 6, border: '1px solid var\(--warning-border\)'/);
    expect(wardrobe).toMatch(/<span className="wa-wd-unassigned"/);
    expect(css).toMatch(/\.wa-wd-unassigned \{[^}]*background: var\(--warning-bg\); border: 1px solid var\(--warning-border\); color: var\(--warning-text\)/);
    expect(wardrobe).toMatch(/background: 'var\(--accent-subtle\)', borderRadius: 4, fontSize: 9, color: 'var\(--accent-dark\)'/);
    expect(wardrobe).toMatch(/\{owned \? 'Owned' : coinCost > 0 \? `\$\{coinCost\.toLocaleString\(\)\} coins` : 'Free'\}/);
    expect(wardrobe).toMatch(/background: 'var\(--surface-bg\)', border: '1px solid var\(--lala-gold-line\)', borderRadius: 8 \}\}>/);
    expect(wardrobe).toMatch(/borderTop: '1px dashed var\(--lala-gold-line\)'/);
    expect(wardrobe).toMatch(/color: 'var\(--lala-gold-text\)', fontFamily: "'DM Mono', monospace", letterSpacing: 0\.5, marginBottom: 10 \}\}>🎮 GAMEPLAY/);
  });

  test('every text pair the slice draws holds 4.5:1 or better', () => {
    const sources = [tokens];
    for (const [fg, bg] of [
      ['--text-inverse', '--primary'],
      ['--text-inverse', '--primary-dark'],
      ['--text-inverse', '--accent-dark'],
      ['--accent-dark', '--surface-card'],
      ['--lala-lavender-text', '--surface-card'],
      ['--text-primary', '--lala-parchment-2'],
      ['--text-inverse', '--text-secondary'],
      ['--text-primary', '--lala-gold'],
      ['--text-primary', '--surface-card'],
      ['--text-primary', '--primary-subtle'],
      ['--text-secondary', '--surface-card'],
      ['--text-secondary', '--surface-bg'],
      ['--primary-text', '--surface-card'],
      ['--warning-text', '--warning-bg'],
      ['--danger-text', '--danger-bg'],
      ['--accent-dark', '--accent-subtle'],
      ['--success-text', '--surface-card'],
      ['--lala-gold-text', '--surface-bg'],
      ['--lala-gold-text', '--surface-card'],
    ]) {
      const ratio = contrast(readToken(sources, fg), readToken(sources, bg));
      expect({ fg, bg, ratio }).toMatchObject({ ratio: expect.any(Number) });
      expect(ratio).toBeGreaterThanOrEqual(4.5);
    }
    // White on the old amber selection, kept below 4.5 so it is never reused.
    expect(contrast('#ffffff', '#eab308')).toBeLessThan(4.5);
    expect(contrast(readToken(sources, '--text-inverse'), readToken(sources, '--lala-gold'))).toBeLessThan(4.5);
  });
});
