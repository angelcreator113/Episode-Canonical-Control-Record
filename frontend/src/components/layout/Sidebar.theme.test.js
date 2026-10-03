/**
 * The sidebar wears the studio theme (docs/VISUAL_SYSTEM.md §4): its
 * palette is scoped to .ps-sidebar, every entry is a token, no :root block
 * competes with the pages', and the pairs it draws hold 4.5:1.
 */
import { describe, test, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { contrast, readToken } from '../../styles/contrast';

const tokens = readFileSync(resolve(__dirname, '../../styles/design-tokens.css'), 'utf8');
const sidebar = readFileSync(resolve(__dirname, 'Sidebar.css'), 'utf8');
const t = (name) => readToken([tokens, sidebar], name);

describe('Sidebar theme', () => {
  test('no :root palette; the .ps-sidebar scope sets colors only through tokens', () => {
    expect(sidebar).not.toMatch(/^:root\s*{/m);
    const scope = sidebar.slice(sidebar.indexOf('.ps-sidebar {'), sidebar.indexOf('}', sidebar.indexOf('.ps-sidebar {')));
    const colorLines = scope.split('\n').filter((l) => /^\s*--ps-(pink|blue|lav|gold|text|muted|border|bg|surface)/.test(l));
    expect(colorLines.length).toBeGreaterThanOrEqual(14);
    for (const l of colorLines) expect(l).toMatch(/:\s*var\(--[a-z0-9-]+\);/);
    // No hex literal anywhere in the file outside comments.
    const noComments = sidebar.replace(/\/\*[\s\S]*?\*\//g, '');
    expect(noComments).not.toMatch(/#[0-9a-f]{3,6}\b/i);
  });

  test.each([
    ['--ps-pink', '--ps-surface'],
    ['--ps-pink', '--ps-pink-light'],
    ['--ps-text', '--ps-surface'],
    ['--ps-text-mid', '--ps-surface'],
    ['--ps-muted', '--ps-surface'],
    ['--ps-muted', '--ps-bg'],
    ['--text-inverse', '--ps-pink'],
    ['--text-inverse', '--ps-blue'],
  ])('%s on %s holds 4.5:1', (fg, bg) => {
    expect(contrast(t(fg), t(bg))).toBeGreaterThanOrEqual(4.5);
  });
});
