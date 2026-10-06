/** The Culture styles are tokens only, and their text pairs read 4.5:1. */
import { describe, test, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { contrast, readToken } from '../../styles/contrast';

const read = (p) => readFileSync(resolve(__dirname, p), 'utf8');
const year = read('CultureYear.css');
const page = read('../../pages/CultureEvents.css');
const jsx = ['../../pages/CultureEvents.jsx', 'EventsTab.jsx', 'AwardsMediaTab.jsx', 'HistoryTab.jsx', 'CultureYear.jsx'].map(read);
const tokens = read('../../styles/design-tokens.css');
const t = (name) => readToken([tokens], name);

describe('Culture theme', () => {
  test('tokens only; no literal color left in the page or its tabs', () => {
    for (const css of [year, page]) {
      const body = css.replace(/\/\*[\s\S]*?\*\//g, '');
      expect(body).not.toMatch(/#[0-9a-f]{3,8}\b/i);
      expect(body).not.toMatch(/rgba?\(/i);
    }
    for (const src of jsx) expect(src).not.toMatch(/['"]#[0-9a-f]{3,8}['"]/i);
  });

  test('every kind tone, the active tab and the buttons read', () => {
    const tones = [...year.matchAll(/\.is-\w+ +\{ --cy-soft: var\((--[a-z0-9-]+)\); +--cy-text: var\((--[a-z0-9-]+)\);/g)];
    expect(tones).toHaveLength(4);
    for (const [, soft, text] of tones) {
      expect(contrast(t(text), t(soft)), `${text} on ${soft}`).toBeGreaterThanOrEqual(4.5);
      expect(contrast(t(text), t('--surface-card')), `${text} on white`).toBeGreaterThanOrEqual(4.5);
    }
    for (const [fg, bg] of [['--text-inverse', '--accent-dark'], ['--accent-dark', '--accent-subtle'], ['--text-secondary', '--accent-subtle'], ['--success-text', '--success-bg'], ['--danger-text', '--danger-bg']]) {
      expect(contrast(t(fg), t(bg)), `${fg} on ${bg}`).toBeGreaterThanOrEqual(4.5);
    }
  });
});
