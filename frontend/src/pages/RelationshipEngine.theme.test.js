/**
 * The Relationships page in the house palette (2026-10-24 layout audit):
 * the --lala-* tokens, Lora and DM Mono, nothing under 12px, a primary
 * button that reads 4.5:1, and tone colours (romance, steel, secrets, the
 * roles) dark enough to read as text.
 */
import { describe, test, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { contrast, readToken } from '../styles/contrast';
import { T, ROLE } from '../components/RelationshipEngine/tokens';

const read = (p) => readFileSync(resolve(__dirname, p), 'utf8');
const page = read('RelationshipEngine.css');
const sheets = [page, read('../components/RelationshipEngine/FamilyTree.css'), read('../components/RelationshipEngine/WhoKnows.css')];
const tokens = read('../styles/design-tokens.css');
const noComments = (css) => css.replace(/\/\*[\s\S]*?\*\//g, '');

describe('Relationships page theme', () => {
  test('draws in the house tokens and fonts', () => {
    expect((page.match(/var\(--lala-/g) || []).length).toBeGreaterThan(20);
    expect(page).toMatch(/--re-serif:\s*var\(--font-prose/);
    expect(page).toMatch(/--re-mono:\s*var\(--font-ui/);
    // (the :root block is left as it was: the app's Sidebar reads those names)
    for (const css of sheets) expect(noComments(css).replace(/:root \{[^}]*\}/, '')).not.toMatch(/Syne|DM Sans/);
    expect(T.font + T.fontBody + T.fontMono).not.toMatch(/Syne|DM Sans/);
  });

  test('no text under 12px, and the small token is 12px inside the page', () => {
    for (const css of sheets) {
      const sizes = [...noComments(css).matchAll(/font(?:-size)?:[^;]*?\b(\d+(?:\.\d+)?)px/g)].map((m) => Number(m[1]));
      sizes.forEach((px) => expect(px).toBeGreaterThanOrEqual(12));
    }
    expect(page).toMatch(/\.re-shell \{[^}]*--text-xs:\s*0\.75rem;/);
  });

  test('the primary button is ink on gold, 4.5:1 or better', () => {
    const rule = page.match(/\.cg-btn-primary \{([^}]*)\}/)[1];
    expect(rule).toMatch(/background: var\(--lala-gold/);
    expect(rule).toMatch(/color: var\(--lala-ink/);
    expect(contrast(readToken([tokens], '--lala-ink'), readToken([tokens], '--lala-gold'))).toBeGreaterThanOrEqual(4.5);
  });

  test('tone and role colours read 4.5:1 on white and on their tints', () => {
    for (const c of [T.rose, T.steel, T.orchid, T.goldText, T.inkDim, T.inkMid]) expect(contrast(c, '#ffffff'), c).toBeGreaterThanOrEqual(4.5);
    for (const [role, { color, bg }] of Object.entries(ROLE)) expect(contrast(color, bg), role).toBeGreaterThanOrEqual(4.5);
  });
});
