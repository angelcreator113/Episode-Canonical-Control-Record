/**
 * The Episode Todo list wears the studio theme (audit VISUAL-01/02,
 * batch 4, seventeenth screen): the component sets colors only through
 * tokens; the wardrobe list wears the gold family and the career list
 * the teal family (fills for borders and check squares, soft tints for
 * surfaces, text twins for labels; the fills as text were 2.82:1 and
 * 4.5:1 short on white); Generate, Lock and Done are the primary (they
 * were gold and indigo under white); the completion states read the
 * success family; errors read the danger family.
 */
import { describe, test, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { contrast, readToken } from '../../styles/contrast';

const jsx = readFileSync(resolve(__dirname, 'EpisodeTodoList.jsx'), 'utf8');
const tokens = readFileSync(resolve(__dirname, '../../styles/design-tokens.css'), 'utf8');
const HEX = /#[0-9a-f]{3,8}\b/i;
const stripRefs = (s) => s.replace(/#\d{3,4}\b/g, '');

describe('Episode Todo list theme', () => {
  test('the component carries no color literal and no gradient; the only rgba is the modal scrim', () => {
    expect(stripRefs(jsx)).not.toMatch(HEX);
    expect(jsx).not.toMatch(/linear-gradient/);
    expect(jsx.match(/rgba\(/g)).toHaveLength(1);
    expect(jsx).toMatch(/background: 'rgba\(0,0,0,0\.7\)'/);
  });

  test('the two lists read the gold and teal families, text through their text twins', () => {
    expect(jsx).toMatch(/const GOLD = 'var\(--lala-gold\)';\s*const GOLD_TEXT = 'var\(--lala-gold-text\)';\s*const TEAL = 'var\(--primary\)';\s*const TEAL_TEXT = 'var\(--primary-text\)';/);
    expect(jsx).toMatch(/wardrobe: \{ edge: GOLD, text: GOLD_TEXT, soft: 'var\(--lala-gold-soft\)', line: 'var\(--lala-gold-line\)', check: 'var\(--text-primary\)' \}/);
    expect(jsx).toMatch(/career: \{ edge: TEAL, text: TEAL_TEXT, soft: 'var\(--primary-subtle\)', line: 'var\(--primary-light\)', check: 'var\(--text-inverse\)' \}/);
    // No label is drawn in a fill color.
    expect(jsx).not.toMatch(/color: (?:GOLD|TEAL)\b/);
    expect(jsx).not.toMatch(/color: list\.edge/);
    expect(jsx).toMatch(/color: isWardrobe \? GOLD_TEXT : 'var\(--text-secondary\)'/);
    expect(jsx).toMatch(/color: !isWardrobe \? TEAL_TEXT : 'var\(--text-secondary\)'/);
    expect(jsx).toMatch(/color: GOLD_TEXT, fontWeight: 500 \}\}>optional/);
  });

  test('Generate, Lock and Done are the primary; the check squares hold ink on gold and white on teal', () => {
    expect(jsx).toMatch(/background: generating \? 'var\(--lala-parchment-2\)' : 'var\(--primary\)',\s*color: generating \? 'var\(--text-secondary\)' : 'var\(--text-inverse\)'/);
    expect(jsx).toMatch(/background: generatingCareer \? 'var\(--lala-parchment-2\)' : 'var\(--primary\)',\s*color: generatingCareer \? 'var\(--text-secondary\)' : 'var\(--text-inverse\)'/);
    expect(jsx).toMatch(/background: 'var\(--primary\)', color: 'var\(--text-inverse\)', border: 'none',/);
    expect(jsx).toMatch(/background: 'var\(--primary\)', color: 'var\(--text-inverse\)',\s*border: 'none', borderRadius: 8, padding: '10px 0'/);
    expect(jsx).toMatch(/background: excluded \? 'transparent' : list\.edge,/);
    expect(jsx).toMatch(/color: list\.check, fontSize: 11/);
    expect(jsx).not.toMatch(/background: GOLD, color: 'var\(--text-inverse\)'/);
  });

  test('completion and errors read the success and danger families', () => {
    expect(jsx).toMatch(/background: completion\.all_required_done && isWardrobe \? 'var\(--success-bg\)' : list\.soft/);
    expect(jsx).toMatch(/background: 'var\(--success-bg\)', color: 'var\(--success-text\)', borderRadius: 4, fontWeight: 700 \}\}>LOCKED/);
    expect(jsx).toMatch(/background: completion\.all_required_done \? 'var\(--success\)' : GOLD,/);
    expect(jsx).toMatch(/background: task\.completed \? 'var\(--success-text\)' : 'transparent'/);
    expect(jsx).toMatch(/background: excluded \? 'var\(--surface-bg\)' : task\.completed \? 'var\(--success-bg\)' : 'transparent'/);
    expect(jsx.match(/background: 'var\(--danger-bg\)', color: 'var\(--danger-text\)'/g)).toHaveLength(2);
  });

  test('every text pair the list draws holds 4.5:1 or better', () => {
    const sources = [tokens];
    for (const [fg, bg] of [
      ['--text-inverse', '--primary'],
      ['--text-inverse', '--success-text'],
      ['--text-primary', '--lala-gold'],
      ['--lala-gold-text', '--lala-gold-soft'],
      ['--text-primary', '--lala-gold-soft'],
      ['--text-secondary', '--lala-gold-soft'],
      ['--success-text', '--lala-gold-soft'],
      ['--primary-text', '--primary-subtle'],
      ['--text-secondary', '--primary-subtle'],
      ['--success-text', '--success-bg'],
      ['--text-secondary', '--success-bg'],
      ['--text-primary', '--success-bg'],
      ['--text-secondary', '--surface-bg'],
      ['--text-secondary', '--lala-parchment-2'],
      ['--danger-text', '--danger-bg'],
    ]) {
      const ratio = contrast(readToken(sources, fg), readToken(sources, bg));
      expect({ fg, bg, ratio }).toMatchObject({ ratio: expect.any(Number) });
      expect(ratio).toBeGreaterThanOrEqual(4.5);
    }
    // Gold as text and white on gold, the old wardrobe palette, kept below 4.5 so they are never reused.
    expect(contrast(readToken(sources, '--lala-gold'), readToken(sources, '--surface-card'))).toBeLessThan(4.5);
    expect(contrast(readToken(sources, '--text-inverse'), readToken(sources, '--lala-gold'))).toBeLessThan(4.5);
  });
});
