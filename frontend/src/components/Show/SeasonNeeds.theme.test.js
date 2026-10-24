/** SeasonNeeds's styles (planner PR 3) are tokens only, and every text-on-fill pair reads 4.5:1. */
import { describe, test, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { contrast, readToken } from '../../styles/contrast';

const css = readFileSync(resolve(__dirname, 'SeasonNeeds.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
const tokens = readFileSync(resolve(__dirname, '../../styles/design-tokens.css'), 'utf8');
const t = (name) => readToken([tokens], name);
const rules = [...css.matchAll(/([^{}]+)\{([^}]*)\}/g)].map(([, sel, body]) => ({
  sel: sel.trim(), bg: body.match(/background:\s*var\((--[a-z0-9-]+)\)/)?.[1], fg: body.match(/(?:^|;|\s)color:\s*var\((--[a-z0-9-]+)\)/)?.[1],
}));

describe('SeasonNeeds theme', () => {
  test('tokens only', () => {
    expect(css).not.toMatch(/#[0-9a-f]{3,8}\b/i);
    expect(css).not.toMatch(/rgba?\(/i);
  });
  test('text reads 4.5:1 on its fill, on white and on the gold card', () => {
    for (const r of rules.filter((x) => x.bg && x.fg)) expect(contrast(t(r.fg), t(r.bg)), r.sel).toBeGreaterThanOrEqual(4.5);
    for (const fg of new Set(rules.filter((x) => x.fg && !x.bg && x.fg !== '--text-inverse').map((x) => x.fg))) {
      for (const bg of ['--surface-card', '--lala-gold-soft', '--accent-subtle']) expect(contrast(t(fg), t(bg)), `${fg} on ${bg}`).toBeGreaterThanOrEqual(4.5);
    }
  });
});
