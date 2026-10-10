/**
 * The Style Page wears the studio theme (Tasks #2813, #2876): colours only
 * through tokens, the one primary button is the primary, and every button,
 * chip and field is at least 44px tall. The sheet keeps its own printed
 * colours (StyleSheetTemplate.css), and its edit marks never print.
 */
import { describe, test, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { stripTaskRefs } from '../../styles/contrast';

const css = readFileSync(resolve(__dirname, 'EpisodeStylePage.css'), 'utf8');
const jsx = readFileSync(resolve(__dirname, 'EpisodeStylePage.jsx'), 'utf8');
const sheetCss = readFileSync(resolve(__dirname, 'StyleSheetTemplate.css'), 'utf8');
const HEX = /#[0-9a-f]{3,8}\b/i;
const rule = (src, sel) => src.slice(src.indexOf(sel), src.indexOf('}', src.indexOf(sel)));

describe('Style Page theme', () => {
  test('no colour literal in the stylesheet or the component', () => {
    expect(stripTaskRefs(css)).not.toMatch(HEX);
    expect(css).not.toMatch(/var\(--[a-z0-9-]+,\s*#/i);
    expect(stripTaskRefs(jsx)).not.toMatch(HEX);
  });

  test('the primary button reads the primary tokens', () => {
    expect(css).toMatch(/\.esp2-btn-primary \{ background: var\(--primary\); color: var\(--text-inverse\);/);
  });

  test('buttons, chips and fields are at least 44px', () => {
    for (const sel of ['.esp2-btn {', '.esp2-chip {', '.esp2-field input, .esp2-field textarea {']) {
      expect({ sel, ok: /min-height: 44px/.test(rule(css, sel)) }).toEqual({ sel, ok: true });
    }
    expect(css).toMatch(/\.esp2-icon-btn \{[^}]*width: 44px;[^}]*height: 44px;/);
    expect(css).toMatch(/\.esp2-swatch input \{ width: 44px; height: 44px;/);
  });

  test("the sheet's edit marks use the sheet's own colours and the in-place fields are 44px", () => {
    const edit = sheetCss.slice(sheetCss.indexOf('/* Edit mode'));
    expect(stripTaskRefs(edit)).not.toMatch(HEX);
    expect(rule(edit, '.ss-swap {')).toMatch(/min-height: 44px/);
    expect(rule(edit, '.ss-inplace {')).toMatch(/min-height: 44px/);
  });
});
