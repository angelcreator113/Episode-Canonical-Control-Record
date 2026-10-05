/**
 * WriteMode's memory cards (MemoryConfirmation: MemoryCard, its confirm
 * panel and the unused MemoryBankPanel) wear the studio theme (theme batch
 * 6, the last WriteMode panel; docs/VISUAL_SYSTEM.md §7): no hex or rgba;
 * every memory type and character type is a token family whose text reads
 * 4.5:1 on white and on its own surface; every text colour reads on
 * parchment and white.
 */
import { describe, test, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { contrast, readToken, stripTaskRefs } from '../styles/contrast';

const jsx = readFileSync(resolve(__dirname, 'MemoryConfirmation.jsx'), 'utf8');
const tokens = readFileSync(resolve(__dirname, '../styles/design-tokens.css'), 'utf8');
const t = (v) => readToken([tokens], v.replace(/^var\((--[a-z0-9-]+)\)$/, '$1'));
const tones = [...jsx.matchAll(/^\s{2}(\w+):\s*\{ fill: '([^']+)', bg: '([^']+)', color: '([^']+)', line: '([^']+)' \},$/gm)];

describe('WriteMode memory cards: studio tokens', () => {
  test('no hex or rgba colour', () => {
    expect(stripTaskRefs(jsx)).not.toMatch(/#[0-9a-f]{3,8}\b/i);
    expect(jsx).not.toMatch(/rgba?\(/);
  });

  test('each family reads as text on white and on its surface', () => {
    expect(tones.map((m) => m[1]).sort()).toEqual(['danger', 'gold', 'info', 'lavender', 'neutral', 'success', 'teal', 'warning']);
    for (const [, k, , bg, color] of tones) {
      expect(contrast(t(color), t('--surface-card')), `${k} on white`).toBeGreaterThanOrEqual(4.5);
      expect(contrast(t(color), t(bg)), `${k} on its surface`).toBeGreaterThanOrEqual(4.5);
    }
  });

  test('every text colour reads on parchment and white', () => {
    const colours = [...jsx.matchAll(/\bcolor: '(var\(--[a-z0-9-]+\))'/g)].map((m) => m[1]);
    expect(colours.length).toBeGreaterThan(20);
    for (const c of new Set(colours)) {
      expect(contrast(t(c), t('--surface-bg')), `${c} on parchment`).toBeGreaterThanOrEqual(4.5);
      expect(contrast(t(c), t('--surface-card')), `${c} on white`).toBeGreaterThanOrEqual(4.5);
    }
    // The gold confirm button: ink on the gold fill.
    expect(contrast(t('--text-primary'), t('--lala-gold'))).toBeGreaterThanOrEqual(4.5);
  });
});
