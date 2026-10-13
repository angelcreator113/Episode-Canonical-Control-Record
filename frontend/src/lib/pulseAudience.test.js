/**
 * pulseAudience — the frontend mirror of src/services/pulseAudience.js
 * (Task 3033), pinned to it: the same table and the same answer at every
 * boundary. The label reads "Nano tier".
 */
import { describe, test, expect } from 'vitest';
import { createRequire } from 'module';
import { TIERS, tierFor, tierLabel, followersText } from './pulseAudience';

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

describe('followersText (Task 3062)', () => {
  test('the canon count with its tier; the estimate marked; nothing with neither', () => {
    expect(followersText({ count: 12400, estimated: false })).toBe('12,400 followers · Micro tier');
    expect(followersText({ count: 60000 })).toBe('60,000 followers · Mid-tier');
    expect(followersText({ count: 1 })).toBe('1 follower · Emerging tier');
    expect(followersText({ count: 0 })).toBe('0 followers · Emerging tier');
    expect(followersText({ count: null, estimated: true, estimate: '12k' })).toBe('About 12k followers (estimate)');
    expect(followersText({ count: null, estimated: true })).toBe('');
    expect(followersText(null)).toBe('');
  });
});
