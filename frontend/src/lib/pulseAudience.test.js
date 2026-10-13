/**
 * pulseAudience — the frontend mirror of src/services/pulseAudience.js
 * (Task 3033), pinned to it: the same table and the same answer at every
 * boundary. The label reads "Nano tier".
 */
import { describe, test, expect } from 'vitest';
import { createRequire } from 'module';
import { TIERS, tierFor, tierLabel } from './pulseAudience';

const nodeRequire = createRequire(import.meta.url);
const backend = nodeRequire('../../../src/services/pulseAudience.js');

describe('pinned to the backend', () => {
  test('the same tiers, labels and starting counts', () => {
    expect(TIERS).toEqual(backend.TIERS);
  });

  test('the same tier at and either side of every boundary', () => {
    const counts = [null, undefined, '', 'lots', -1, ...backend.TIERS.flatMap((t) => [t.from - 1, t.from, t.from + 1]), 5e8];
    for (const n of counts) expect(tierFor(n)).toEqual(backend.tierFor(n));
  });
});

describe('tierLabel', () => {
  test('999 is Emerging, 1,000 is Nano, and so on; no count, no label', () => {
    expect(tierLabel(999)).toBe('Emerging tier');
    expect(tierLabel(1000)).toBe('Nano tier');
    expect(tierLabel(10000)).toBe('Micro tier');
    expect(tierLabel(50000)).toBe('Mid-tier');
    expect(tierLabel(250000)).toBe('Macro tier');
    expect(tierLabel(1000000)).toBe('Mega tier');
    expect(tierLabel(null)).toBe('');
  });
});
