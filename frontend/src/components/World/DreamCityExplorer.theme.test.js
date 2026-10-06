/** The city explorer's styles are tokens only, and every city's text reads 4.5:1. */
import { describe, test, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { contrast, readToken } from '../../styles/contrast';

const css = readFileSync(resolve(__dirname, 'DreamCityExplorer.css'), 'utf8');
const tokens = readFileSync(resolve(__dirname, '../../styles/design-tokens.css'), 'utf8');
const t = (name) => readToken([tokens], name);

describe('DreamCityExplorer theme', () => {
  test('tokens only', () => {
    const body = css.replace(/\/\*[\s\S]*?\*\//g, '');
    expect(body).not.toMatch(/#[0-9a-f]{3,8}\b/i);
    expect(body).not.toMatch(/rgba?\(/i);
  });

  test('each of the five cities has a tone whose text reads on its wash and on white', () => {
    const tones = [...css.matchAll(/\.dce-city-([a-z]) \{([^}]*)\}/g)];
    expect(tones.map((m) => m[1])).toEqual(['d', 'r', 'e', 'a', 'm']);
    for (const [, letter, body] of tones) {
      const v = Object.fromEntries([...body.matchAll(/(--city-[a-z]+):\s*var\((--[a-z0-9-]+)\)/g)].map(([, k, tok]) => [k, t(tok)]));
      expect(contrast(v['--city-text'], v['--city-soft']), letter).toBeGreaterThanOrEqual(4.5);
      expect(contrast(v['--city-text'], t('--surface-card')), letter).toBeGreaterThanOrEqual(4.5);
      expect(contrast(t('--text-primary'), v['--city-soft']), letter).toBeGreaterThanOrEqual(4.5);
    }
  });
});
