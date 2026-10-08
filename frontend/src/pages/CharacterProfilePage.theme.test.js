/** The character page's own styles (from its marker down) are tokens only, and each text-on-fill pair reads 4.5:1. */
import { describe, test, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { contrast, readToken } from '../styles/contrast';

const all = readFileSync(resolve(__dirname, 'CharacterProfilePage.css'), 'utf8');
const css = all.slice(all.indexOf('/* ═══ The character page'));
const tokens = readFileSync(resolve(__dirname, '../styles/design-tokens.css'), 'utf8');
const t = (name) => readToken([tokens], name);

describe('The character page theme', () => {
  test('the marker is there, and below it tokens only', () => {
    expect(css.length).toBeGreaterThan(1000);
    const body = css.replace(/\/\*[\s\S]*?\*\//g, '');
    expect(body).not.toMatch(/#[0-9a-f]{3,8}\b/i);
    expect(body).not.toMatch(/rgba?\(/i);
  });

  test('each text-on-fill pair reads 4.5:1', () => {
    const rules = [...css.matchAll(/([^{}]+)\{([^}]*)\}/g)]
      .map(([, sel, body]) => ({ sel: sel.trim(), bg: body.match(/background:\s*var\((--[a-z0-9-]+)\)/)?.[1], fg: body.match(/(?:^|;|\s)color:\s*var\((--[a-z0-9-]+)\)/)?.[1] }))
      .filter((r) => r.bg && r.fg);
    expect(rules.length).toBeGreaterThan(8);
    for (const r of rules) expect(contrast(t(r.fg), t(r.bg)), r.sel).toBeGreaterThanOrEqual(4.5);
  });

  test('the kinds of "Where they show up" read on their wash', () => {
    const kinds = [...css.matchAll(/\.ch-show(?:\.is-[a-z]+)? \{([^}]*)\}/g)].map(([, body]) => ({
      bg: body.match(/background:\s*var\((--[a-z0-9-]+)\)/)?.[1], fg: body.match(/--kind:\s*var\((--[a-z0-9-]+)\)/)?.[1],
    })).filter((k) => k.bg && k.fg);
    expect(kinds).toHaveLength(5);
    for (const k of kinds) expect(contrast(t(k.fg), t(k.bg))).toBeGreaterThanOrEqual(4.5);
  });
});
