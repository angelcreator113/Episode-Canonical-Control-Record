/**
 * The episode's Wardrobe game wears the studio theme (Evoni's Episode
 * mock, 2026-10-05): colors only through tokens (it was Tailwind slate,
 * indigo and pink literals), Lock Outfit lavender, the look's header,
 * dress code and cost bar on the token families.
 */
import { describe, test, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { contrast, readToken, stripTaskRefs } from '../styles/contrast';

const jsx = readFileSync(resolve(__dirname, 'EpisodeWardrobeGameplay.jsx'), 'utf8');
const tokens = readFileSync(resolve(__dirname, '../styles/design-tokens.css'), 'utf8');

describe('Wardrobe game theme', () => {
  test('no color literal', () => {
    expect(stripTaskRefs(jsx)).not.toMatch(/#[0-9a-f]{3,8}\b/i);
  });
  test('Lock Outfit is lavender; the dress code is pink; the cost bar lavender', () => {
    expect(jsx).toMatch(/lockBtn: \{[^}]*background: 'var\(--lala-lavender\)'[^}]*color: 'var\(--text-inverse\)'/);
    expect(jsx).toMatch(/dressCode: \{[^}]*background: 'var\(--accent-subtle\)', color: 'var\(--lala-ink\)'/);
    expect(jsx).toMatch(/costBar: \{[^}]*background: 'var\(--lala-lavender-soft\)', color: 'var\(--lala-ink\)'/);
  });
  test('every text pair holds 4.5:1', () => {
    for (const [fg, bg] of [
      ['--text-inverse', '--lala-lavender'],
      ['--lala-ink', '--accent-subtle'],
      ['--lala-ink', '--lala-lavender-soft'],
      ['--lala-lavender-text', '--lala-lavender-soft'],
      ['--lala-ink-muted', '--lala-parchment'],
      ['--warning-text', '--warning-bg'],
      ['--success-text', '--success-bg'],
      ['--danger-text', '--danger-bg'],
    ]) {
      const ratio = contrast(readToken([tokens], fg), readToken([tokens], bg));
      expect({ fg, bg, ratio }).toMatchObject({ ratio: expect.any(Number) });
      expect(ratio).toBeGreaterThanOrEqual(4.5);
    }
  });
});
