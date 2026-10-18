/** The Episodes Production board's styles are tokens only, and every text-on-fill pair reads 4.5:1. */
import { describe, test, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { contrast, readToken } from '../../styles/contrast';

const css = readFileSync(resolve(__dirname, 'ShowEpisodesBoard.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
const tokens = readFileSync(resolve(__dirname, '../../styles/design-tokens.css'), 'utf8');
const t = (name) => readToken([tokens], name);
const rules = [...css.matchAll(/([^{}]+)\{([^}]*)\}/g)].map(([, sel, body]) => ({
  sel: sel.trim(),
  bg: body.match(/background:\s*var\((--[a-z0-9-]+)\)/)?.[1],
  fg: body.match(/(?:^|;|\s)color:\s*var\((--[a-z0-9-]+)\)/)?.[1],
}));

describe('Episodes Production board theme', () => {
  test('tokens only', () => {
    expect(css).not.toMatch(/#[0-9a-f]{3,8}\b/i);
    expect(css).not.toMatch(/rgba?\(/i);
  });

  test('each text-on-fill pair reads 4.5:1', () => {
    const pairs = rules.filter((r) => r.bg && r.fg);
    expect(pairs.length).toBeGreaterThan(10);
    for (const r of pairs) expect(contrast(t(r.fg), t(r.bg)), r.sel).toBeGreaterThanOrEqual(4.5);
  });

  test('text with no fill of its own reads on white and on the pink wash', () => {
    const colours = new Set(rules.filter((r) => r.fg && !r.bg && r.fg !== '--text-inverse').map((r) => r.fg));
    for (const fg of colours) {
      for (const bg of ['--surface-card', '--accent-subtle']) expect(contrast(t(fg), t(bg)), `${fg} on ${bg}`).toBeGreaterThanOrEqual(4.5);
    }
  });
});
