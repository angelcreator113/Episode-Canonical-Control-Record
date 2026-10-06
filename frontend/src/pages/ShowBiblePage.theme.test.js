/** The Show Bible's styles are tokens only, and its gold and chips read 4.5:1. */
import { describe, test, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { contrast, readToken } from '../styles/contrast';

const css = readFileSync(resolve(__dirname, 'ShowBiblePage.css'), 'utf8');
const jsx = readFileSync(resolve(__dirname, 'ShowBiblePage.jsx'), 'utf8');
const tokens = readFileSync(resolve(__dirname, '../styles/design-tokens.css'), 'utf8');
const t = (name) => readToken([tokens], name);

describe('ShowBiblePage theme', () => {
  test('tokens only, in the stylesheet and the page', () => {
    const body = css.replace(/\/\*[\s\S]*?\*\//g, '');
    expect(body).not.toMatch(/#[0-9a-f]{3,8}\b/i);
    expect(body).not.toMatch(/rgba?\(/i);
    expect(jsx).not.toMatch(/['"]#[0-9a-f]{3,8}['"]/i);
    expect(jsx).not.toMatch(/style=\{\{/);
  });

  test('the text pairs read', () => {
    const pairs = [
      ['--text-primary', '--lala-gold'], ['--lala-gold-text', '--lala-gold-soft'], ['--lala-gold-text', '--surface-card'],
      ['--text-secondary', '--surface-bg'], ['--danger-text', '--danger-bg'], ['--info-text', '--info-bg'],
      ['--success-text', '--success-bg'], ['--lala-lavender-text', '--lala-lavender-soft'], ['--text-secondary', '--lala-gold-soft'],
    ];
    for (const [fg, bg] of pairs) expect(contrast(t(fg), t(bg)), `${fg} on ${bg}`).toBeGreaterThanOrEqual(4.5);
  });
});
