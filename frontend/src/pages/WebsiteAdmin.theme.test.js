/** The Website page wears the studio theme (Task #2822): tokens only, the primary button, 44px controls. */
import { describe, test, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { stripTaskRefs } from '../styles/contrast';

const css = readFileSync(resolve(__dirname, 'WebsiteAdmin.css'), 'utf8');
const jsx = readFileSync(resolve(__dirname, 'WebsiteAdmin.jsx'), 'utf8');

describe('Website page theme', () => {
  test('no colour literal', () => {
    expect(stripTaskRefs(css)).not.toMatch(/#[0-9a-f]{3,8}\b/i);
    expect(stripTaskRefs(jsx)).not.toMatch(/#[0-9a-f]{3,8}\b/i);
  });
  test('primary button and 44px controls', () => {
    expect(css).toMatch(/\.wsa-btn-primary \{ background: var\(--primary\); color: var\(--text-inverse\);/);
    for (const sel of ['.wsa-btn {', '.wsa-switch button {', '.wsa-field input, .wsa-field select {']) {
      const rule = css.slice(css.indexOf(sel), css.indexOf('}', css.indexOf(sel)));
      expect({ sel, ok: /min-height: 44px/.test(rule) }).toEqual({ sel, ok: true });
    }
  });
});
