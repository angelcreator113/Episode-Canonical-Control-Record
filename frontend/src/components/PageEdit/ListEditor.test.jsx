/** ListEditor: a blank item shaped like its list; the controls' styles are tokens only and read 4.5:1. */
import { describe, test, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { blankLike } from './ListEditor';
import { contrast, readToken } from '../../styles/contrast';

const css = readFileSync(resolve(__dirname, 'ListEditor.css'), 'utf8');
const tokens = readFileSync(resolve(__dirname, '../../styles/design-tokens.css'), 'utf8');
const t = (name) => readToken([tokens], name);

describe('ListEditor', () => {
  test('a new item has the list\'s fields, empty', () => {
    expect(blankLike([{ name: 'Starlight', categories: ['A'], tier: 1, live: true, color: { text: 'x' } }]))
      .toEqual({ name: '', categories: [], tier: 0, live: false, color: {} });
    expect(blankLike([])).toEqual({ name: '' });
  });

  test('tokens only; every text pair reads', () => {
    const body = css.replace(/\/\*[\s\S]*?\*\//g, '');
    expect(body).not.toMatch(/#[0-9a-f]{3,8}\b/i);
    expect(body).not.toMatch(/rgba?\(/i);
    for (const [fg, bg] of [['--info-text', '--surface-card'], ['--text-inverse', '--info-text'], ['--danger-text', '--surface-card']]) {
      expect(contrast(t(fg), t(bg)), `${fg} on ${bg}`).toBeGreaterThanOrEqual(4.5);
    }
  });
});
