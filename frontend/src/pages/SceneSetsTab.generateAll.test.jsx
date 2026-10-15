/**
 * Generate All (audit of the Scene Sets page, 2026-10-15): it makes the
 * set's pending angles and retries its failed ones; the server makes a few
 * per click, and the page says how many are left instead of waiting on them.
 */
import { describe, test, expect } from 'vitest';
import { generateAllTargets, generateAllOutcome } from './SceneSetsTab';

describe('generateAllTargets', () => {
  test('pending and failed angles, in card order; finished and generating ones are left', () => {
    const set = { angles: [
      { id: 'c', generation_status: 'failed', sort_order: 2 },
      { id: 'a', generation_status: 'complete', sort_order: 0 },
      { id: 'b', generation_status: 'pending', sort_order: 1 },
      { id: 'd', generation_status: 'generating', sort_order: 3 },
    ] };
    expect(generateAllTargets(set).map(a => a.id)).toEqual(['b', 'c']);
  });
  test('a set whose only waiting angles failed still has targets', () => {
    expect(generateAllTargets({ angles: [{ id: 'x', generation_status: 'failed' }] })).toHaveLength(1);
    expect(generateAllTargets({})).toEqual([]);
  });
});

describe('generateAllOutcome', () => {
  test('says how many were made, how many failed, and how many wait for the next click', () => {
    expect(generateAllOutcome({ completed: 3, failed: 0, remaining: 4 }))
      .toEqual({ tone: 'success', text: '3 angles generated. 4 more waiting: click Generate All Angles again for the next batch.' });
    expect(generateAllOutcome({ completed: 1, failed: 0, remaining: 0 })).toEqual({ tone: 'success', text: '1 angle generated.' });
    expect(generateAllOutcome({ completed: 2, failed: 1, remaining: 0 })).toEqual({ tone: 'error', text: '2 completed, 1 failed.' });
  });
});
