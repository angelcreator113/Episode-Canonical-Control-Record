/**
 * create-angles' outcome in words (audit SCENE-02, 2026-10-03): a partial
 * result names the failed views and their reasons and reads as an error;
 * nothing new is not a failure.
 */
import { describe, test, expect } from 'vitest';
import { createAnglesOutcome } from './SceneSetsTab';

describe('createAnglesOutcome', () => {
  test('all made, some existing, one failed, nothing to make, a plain failure', () => {
    expect(createAnglesOutcome({ success: true, data: { created: [{ angle_label: 'WIDE' }, { angle_label: 'CLOSE' }], existing: [], failed: [] } }))
      .toEqual({ tone: 'success', text: '2 camera angles created — ready to generate images' });
    expect(createAnglesOutcome({ success: true, data: { created: [{ angle_label: 'CLOSE' }], existing: ['WIDE'], failed: [] } }))
      .toEqual({ tone: 'success', text: '1 camera angle created · 1 already there — ready to generate images' });
    expect(createAnglesOutcome({ success: false, code: 'ANGLES_PARTIAL', data: { created: [{ angle_label: 'WIDE' }], existing: [], failed: [{ angle_label: 'CLOSE', reason: 'disk full' }] } }))
      .toEqual({ tone: 'error', text: '1 camera angle created · 1 failed: CLOSE (disk full) — try again for just those' });
    expect(createAnglesOutcome({ success: true, data: { created: [], existing: ['WIDE', 'CLOSE'], failed: [] } }))
      .toEqual({ tone: 'success', text: '0 camera angles created · 2 already there' });
    expect(createAnglesOutcome({ success: false, error: 'No camera contracts in scene spec' })).toEqual({ tone: 'error', text: 'No camera contracts in scene spec' });
    // The old shape still reads.
    expect(createAnglesOutcome({ success: true, data: { angles_created: 3, total: 3 } }).text).toBe('3 camera angles created — ready to generate images');
  });
});
