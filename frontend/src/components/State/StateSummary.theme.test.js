/** The State styles are tokens only, and their text pairs read 4.5:1. */
import { describe, test, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { contrast, readToken } from '../../styles/contrast';

const summary = readFileSync(resolve(__dirname, 'StateSummary.css'), 'utf8');
const page = readFileSync(resolve(__dirname, '../../pages/WorldDashboard.css'), 'utf8');
const jsx = [resolve(__dirname, 'StateSummary.jsx'), resolve(__dirname, '../../pages/WorldDashboard.jsx')].map((p) => readFileSync(p, 'utf8'));
const tokens = readFileSync(resolve(__dirname, '../../styles/design-tokens.css'), 'utf8');
const t = (name) => readToken([tokens], name);

describe('State theme', () => {
  test('tokens only; no literal colors in the styles or the markup', () => {
    for (const css of [summary, page]) {
      const body = css.replace(/\/\*[\s\S]*?\*\//g, '');
      expect(body).not.toMatch(/#[0-9a-f]{3,8}\b/i);
      expect(body).not.toMatch(/rgba?\(/i);
    }
    for (const src of jsx) {
      expect(src).not.toMatch(/['"]#[0-9a-f]{3,8}['"]/i);
      expect(src).not.toMatch(/style=\{\{\s*(background|color|border)/);
    }
  });

  test("every tension tone's state word reads on white, and the blue text pairs read", () => {
    for (const css of [summary, page]) {
      const tones = [...css.matchAll(/-tone-[a-z]+\s*\{ --(?:st|wd)-text: var\((--[a-z0-9-]+)\);/g)];
      expect(tones).toHaveLength(4);
      for (const [, text] of tones) {
        expect(contrast(t(text), t('--surface-card')), `${text} on white`).toBeGreaterThanOrEqual(4.5);
      }
    }
    for (const [fg, bg] of [['--text-inverse', '--info-text'], ['--info-text', '--info-bg'], ['--info-text', '--surface-card'], ['--text-primary', '--info-bg'], ['--text-secondary', '--surface-card'], ['--text-secondary', '--surface-bg'], ['--warning-text', '--warning-bg'], ['--danger-text', '--surface-card']]) {
      expect(contrast(t(fg), t(bg)), `${fg} on ${bg}`).toBeGreaterThanOrEqual(4.5);
    }
  });
});
