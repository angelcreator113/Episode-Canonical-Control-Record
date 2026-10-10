/**
 * The style sheet panel wears the studio theme (Task #2814): no colour
 * literal in the panel's stylesheet or component, the primary button reads
 * the primary tokens, and its controls are 44px. The printed sheet keeps its
 * own palette in StyleSheetTemplate.css.
 */
import { describe, test, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { stripTaskRefs } from '../../styles/contrast';

const css = readFileSync(resolve(__dirname, 'EpisodeStyleSheetPanel.css'), 'utf8');
const jsx = readFileSync(resolve(__dirname, 'EpisodeStyleSheetPanel.jsx'), 'utf8');
const sheetCss = readFileSync(resolve(__dirname, 'StyleSheetTemplate.css'), 'utf8');
const HEX = /#[0-9a-f]{3,8}\b/i;

describe('Style sheet panel theme', () => {
  test('no colour literal in the panel', () => {
    expect(stripTaskRefs(css)).not.toMatch(HEX);
    expect(css).not.toMatch(/var\(--[a-z0-9-]+,\s*#/i);
    expect(stripTaskRefs(jsx)).not.toMatch(HEX);
  });

  test('the primary button and the 44px controls', () => {
    expect(css).toMatch(/\.ssp-btn-primary \{ background: var\(--primary\); color: var\(--text-inverse\);/);
    expect(css).toMatch(/\.ssp-btn, \.ssp-mini-btn \{[^}]*min-height: 44px;/);
    expect(css).toMatch(/\.ssp-field input, \.ssp-field select \{[^}]*min-height: 44px;/);
  });

  test("the sheet's own colours are the spec's: blush, lilac, ivory, champagne gold, plum", () => {
    for (const hex of ['#E9C4D5', '#FAF6F1', '#D6B77C', '#30253D']) expect(sheetCss).toContain(hex);
    expect(sheetCss).toMatch(/background: linear-gradient\(180deg, var\(--ss-blush\) 0%, var\(--ss-lilac\) 45%, var\(--ss-ivory\) 100%\)/);
  });
});
