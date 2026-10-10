/**
 * The Lookbook tab wears the studio theme (Task #2813): colours only
 * through tokens, the one primary button is the primary, and every button
 * is at least 44px tall.
 */
import { describe, test, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { stripTaskRefs } from '../../styles/contrast';

const css = readFileSync(resolve(__dirname, 'EpisodeLookbookTab.css'), 'utf8');
const jsx = readFileSync(resolve(__dirname, 'EpisodeLookbookTab.jsx'), 'utf8');
const HEX = /#[0-9a-f]{3,8}\b/i;

describe('Lookbook theme', () => {
  test('no colour literal in the stylesheet or the component', () => {
    expect(stripTaskRefs(css)).not.toMatch(HEX);
    expect(css).not.toMatch(/var\(--[a-z0-9-]+,\s*#/i);
    expect(stripTaskRefs(jsx)).not.toMatch(HEX);
  });

  test('the primary button reads the primary tokens', () => {
    expect(css).toMatch(/\.elb-btn-primary \{ background: var\(--primary\); color: var\(--text-inverse\);/);
  });

  test('buttons, chips and inputs are at least 44px', () => {
    for (const sel of ['.elb-btn {', '.elb-chip {', '.elb-input {', '.elb-venue-state {']) {
      const rule = css.slice(css.indexOf(sel), css.indexOf('}', css.indexOf(sel)));
      expect({ sel, ok: /min-height: 44px/.test(rule) }).toEqual({ sel, ok: true });
    }
    expect(css).toMatch(/\.elb-icon-btn \{[^}]*width: 44px;[^}]*height: 44px;/);
  });
});
