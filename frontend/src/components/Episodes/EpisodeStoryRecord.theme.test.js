/** The Episode Story Record's styles are tokens only, and every text colour reads 4.5:1 where it sits. */
import { describe, test, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { contrast, readToken } from '../../styles/contrast';

const css = readFileSync(resolve(__dirname, 'EpisodeStoryRecord.css'), 'utf8');
const tokens = readFileSync(resolve(__dirname, '../../styles/design-tokens.css'), 'utf8');
const t = (name) => readToken([tokens], name);
const body = css.replace(/\/\*[\s\S]*?\*\//g, '');
const rules = [...body.matchAll(/([^{}]+)\{([^}]*)\}/g)].map(([, sel, decl]) => ({
  sel: sel.trim(),
  bg: decl.match(/background:\s*var\((--[a-z0-9-]+)\)/)?.[1],
  fg: decl.match(/(?:^|;|\s)color:\s*var\((--[a-z0-9-]+)\)/)?.[1],
}));

describe('The Episode Story Record theme', () => {
  test('tokens only', () => {
    expect(body).not.toMatch(/#[0-9a-f]{3,8}\b/i);
    expect(body).not.toMatch(/rgba?\(/i);
  });

  test('each text-on-fill pair reads 4.5:1', () => {
    const pairs = rules.filter((r) => r.bg && r.fg);
    expect(pairs.length).toBeGreaterThan(3);
    for (const r of pairs) expect(contrast(t(r.fg), t(r.bg)), r.sel).toBeGreaterThanOrEqual(4.5);
  });

  test('text with no fill of its own reads on the card', () => {
    const colours = new Set(rules.filter((r) => r.fg && !r.bg && r.fg !== '--text-inverse').map((r) => r.fg));
    expect(colours.size).toBeGreaterThan(3);
    for (const fg of colours) expect(contrast(t(fg), t('--surface-card')), fg).toBeGreaterThanOrEqual(4.5);
  });
});
