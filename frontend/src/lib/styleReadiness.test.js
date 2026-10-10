/**
 * Style sheet readiness, the 12 chips (Tasks #2876, #2877): the rule is the
 * server's (tests/unit/services/styleSheetReadiness.test.js); the browser
 * reads its result from the style sheet, so the Style Page and the
 * Production checklist agree.
 */
import { describe, test, expect } from 'vitest';
import { READINESS_CHIPS, styleReadiness } from './styleReadiness';

describe('styleReadiness (reads the server result)', () => {
  test('twelve chips, in order', () => {
    expect(READINESS_CHIPS.map((c) => c.label)).toEqual(['Front', 'Side', 'Back', 'Hero', 'Hair', 'Nails', 'Beauty', 'Venue', 'Inspo', 'Wardrobe', 'Palette', 'Tagline']);
  });

  test("returns the sheet's readiness as the server computed it", () => {
    const items = READINESS_CHIPS.map((c, i) => ({ ...c, ready: i < 5 }));
    const readiness = { items, done: 5, total: 12, missing: items.filter((i) => !i.ready).map((i) => i.label) };
    expect(styleReadiness({ sheet: { readiness } })).toEqual(readiness);
  });

  test('before the sheet loads, nothing is ready', () => {
    const r = styleReadiness({ sheet: null });
    expect(r).toMatchObject({ done: 0, total: 12 });
    expect(r.missing).toHaveLength(12);
    expect(styleReadiness({ sheet: { readiness: { done: 7, total: 11 } } }).total).toBe(12);
  });
});
