/** The YouTube thumbnail builder's styles are tokens only, and its pairs read 4.5:1 (docs/VISUAL_SYSTEM.md §3). */
import { describe, test, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { contrast, readToken } from '../styles/contrast';

const css = readFileSync(resolve(__dirname, 'YouTubeThumbnailStudio.css'), 'utf8');
const jsx = readFileSync(resolve(__dirname, 'YouTubeThumbnailStudio.jsx'), 'utf8');
const tokens = readFileSync(resolve(__dirname, '../styles/design-tokens.css'), 'utf8');
const t = (name) => readToken([tokens], name);

describe('YouTube thumbnail builder theme', () => {
  test('tokens only, in the stylesheet and the component', () => {
    const body = css.replace(/\/\*[\s\S]*?\*\//g, '');
    expect(body).not.toMatch(/#[0-9a-f]{3,8}\b/i);
    expect(body).not.toMatch(/rgba?\(/i);
    expect(jsx.replace(/\/\*[\s\S]*?\*\//g, '')).not.toMatch(/['"`]#[0-9a-f]{3,8}\b/i);
  });

  // Evoni, 2026-10-22, on her phone: Layers and Assets side by side, each
  // about 260px, every layer's name cut to one letter. Checked in Chromium
  // at 375, 560 and 900px.
  test('on a phone, Layers and Assets stack, and a narrow layer list puts its buttons under the name', () => {
    const block = (head) => {
      const at = css.indexOf(head);
      expect(at, head).toBeGreaterThan(-1);
      return css.slice(at, css.indexOf('\n}', at));
    };
    expect(block('@media (max-width: 760px)')).toMatch(/\.yts-bottom \{ grid-template-columns: minmax\(0, 1fr\); \}/);
    expect(css).toMatch(/\.yts-layers \{[^}]*container-type: inline-size;/);
    const narrow = block('@container (max-width: 420px)');
    expect(narrow).toMatch(/\.yts-layer \{ flex-wrap: wrap; \}/);
    expect(narrow).toMatch(/\.yts-layer-name \{ flex: 1 1 calc\(100% - 56px\); \}/);
  });

  test('each text-on-fill pair reads 4.5:1', () => {
    const rules = [...css.matchAll(/([^{}]+)\{([^}]*)\}/g)]
      .map(([, sel, b]) => ({ sel: sel.trim(), bg: b.match(/background:\s*var\((--[a-z0-9-]+)\)/)?.[1], fg: b.match(/(?:^|;|\s)color:\s*var\((--[a-z0-9-]+)\)/)?.[1] }))
      .filter((r) => r.bg && r.fg);
    expect(rules.length).toBeGreaterThan(8);
    for (const r of rules) expect(contrast(t(r.fg), t(r.bg)), r.sel).toBeGreaterThanOrEqual(4.5);
  });
});
