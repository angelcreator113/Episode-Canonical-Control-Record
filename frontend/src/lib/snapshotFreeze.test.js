import { describe, expect, it } from 'vitest';
import { FREEZE_CODES, isFreezeRefusal, skippedNote, withSkippedNote } from './snapshotFreeze';

describe('snapshotFreeze (A1.2a)', () => {
  it('knows the four refusal codes', () => {
    expect(FREEZE_CODES).toEqual(['EPISODE_SNAPSHOT_FROZEN', 'START_RECORD_FROZEN', 'INTENT_EDIT_PENDING_AUDIT', 'LATE_CONTEXT_NOT_AVAILABLE']);
    expect(isFreezeRefusal({ response: { data: { code: 'START_RECORD_FROZEN' } } })).toBe(true);
    expect(isFreezeRefusal({ response: { data: { code: 'SEASON_SLOT_LOCKED' } } })).toBe(false);
    expect(isFreezeRefusal(new Error('network'))).toBe(false);
  });
  it('says nothing when nothing was skipped', () => {
    expect(skippedNote([])).toBe('');
    expect(skippedNote(undefined)).toBe('');
    expect(withSkippedNote('Saved.', [])).toBe('Saved.');
  });
  it('names one filmed episode', () => {
    expect(skippedNote([{ label: 'S1 · E1' }])).toBe('S1 · E1 has been filmed: it keeps its Start snapshot; this change applies to the slot.');
  });
  it('names several, and what the change applies to', () => {
    expect(skippedNote([{ label: 'S1 · E1' }, { label: 'S1 · E2' }, {}], { applies: 'the season' }))
      .toBe('S1 · E1, S1 · E2 and An episode have been filmed: they keep their Start snapshots; this change applies to the season.');
    expect(withSkippedNote('Season saved.', [{ label: 'S1 · E1' }], { applies: 'the season' }))
      .toBe('Season saved. S1 · E1 has been filmed: it keeps its Start snapshot; this change applies to the season.');
  });
});
