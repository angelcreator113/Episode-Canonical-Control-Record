/** The Society styles are tokens only, and their text pairs read 4.5:1. */
import { describe, test, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { contrast, readToken } from '../../styles/contrast';

const summary = readFileSync(resolve(__dirname, 'SocietySummary.css'), 'utf8');
const page = readFileSync(resolve(__dirname, '../../pages/SocialSystems.css'), 'utf8');
const jsx = readFileSync(resolve(__dirname, '../../pages/SocialSystems.jsx'), 'utf8');
const tokens = readFileSync(resolve(__dirname, '../../styles/design-tokens.css'), 'utf8');
const t = (name) => readToken([tokens], name);

describe('Society theme', () => {
  test('tokens only; the page keeps no literal colors, a data color is only an accent', () => {
    for (const css of [summary, page]) {
      const body = css.replace(/\/\*[\s\S]*?\*\//g, '');
      expect(body).not.toMatch(/#[0-9a-f]{3,8}\b/i);
      expect(body).not.toMatch(/rgba?\(/i);
    }
    expect(jsx).not.toMatch(/['"]#[0-9a-f]{3,8}['"]/i);
    expect(page).toMatch(/border-top: 4px solid var\(--item/);
    expect(page.replace(/border-(top|left): 4px solid var\(--item[^;]*;/g, '')).not.toMatch(/var\(--item/);
  });

  test('every archetype tone, the ladder and the buttons read', () => {
    const tones = [...summary.matchAll(/\.soc-tone-\d \{ --soc-soft: var\((--[a-z0-9-]+)\);\s+--soc-text: var\((--[a-z0-9-]+)\); \}/g)];
    expect(tones).toHaveLength(5);
    for (const [, soft, text] of tones) {
      expect(contrast(t(text), t(soft)), `${text} on ${soft}`).toBeGreaterThanOrEqual(4.5);
      expect(contrast(t('--text-primary'), t(soft))).toBeGreaterThanOrEqual(4.5);
    }
    for (const [fg, bg] of [['--text-inverse', '--danger'], ['--danger-text', '--danger-bg'], ['--danger-text', '--surface-card'], ['--text-secondary', '--danger-bg'], ['--text-secondary', '--surface-bg']]) {
      expect(contrast(t(fg), t(bg)), `${fg} on ${bg}`).toBeGreaterThanOrEqual(4.5);
    }
  });
});
