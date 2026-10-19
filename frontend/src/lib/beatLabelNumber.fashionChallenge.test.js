/**
 * Beat 12 is The Fashion Challenge (Evoni, 2026-10-18); a saved script that
 * still says Deliverable Creation keeps beat 12.
 */
import { test, expect } from 'vitest';
import { beatNumberForLabel } from './beatLabelNumber';
import { beatName } from './canonicalBeats';

test("beat 12's new name and its old one both read as beat 12", () => {
  expect(beatName(12)).toBe('Fashion Challenge');
  expect(beatNumberForLabel('Fashion Challenge')).toBe(12);
  expect(beatNumberForLabel('THE FASHION CHALLENGE')).toBe(12);
  expect(beatNumberForLabel('Deliverable Creation')).toBe(12);
});
