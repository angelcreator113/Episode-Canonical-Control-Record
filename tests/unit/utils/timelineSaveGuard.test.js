/**
 * The legacy Timeline Editor's save guards (Timeline Editor redesign P0,
 * 2026-11-02): scenes are removed only by name, and the timeline is written
 * only from the row the editor loaded.
 */
const {
  timelineBasis, timelineHasContent, checkTimelineWrite, scenesToRemove, SaveConflict,
} = require('../../../src/utils/timelineSaveGuard');

const row = (over = {}) => ({ beats: [], markers: [], audio_clips: [], character_clips: [], keyframes: [], ...over });

describe('timelineBasis', () => {
  test('is a sha256 of the content; null for no row', () => {
    expect(timelineBasis(row())).toMatch(/^[0-9a-f]{64}$/);
    expect(timelineBasis(null)).toBeNull();
  });
  test('ignores object key order and null lists, and changes with any content', () => {
    const a = row({ beats: [{ id: 'b1', time: 1 }] });
    const b = row({ beats: [{ time: 1, id: 'b1' }] });
    expect(timelineBasis(a)).toBe(timelineBasis(b));
    expect(timelineBasis(row({ keyframes: null }))).toBe(timelineBasis(row()));
    for (const field of ['beats', 'markers', 'audio_clips', 'character_clips', 'keyframes']) {
      expect(timelineBasis(row({ [field]: [{ id: 'x' }] }))).not.toBe(timelineBasis(row()));
    }
  });
});

describe('checkTimelineWrite', () => {
  const stored = row({ beats: [{ id: 'b1' }], markers: [{ id: 'm1' }] });
  test('a row with content needs its own basis', () => {
    expect(() => checkTimelineWrite(stored, timelineBasis(stored))).not.toThrow();
    expect(() => checkTimelineWrite(stored, undefined)).toThrow(expect.objectContaining({ status: 409, code: 'TIMELINE_BASIS_MISSING' }));
    expect(() => checkTimelineWrite(stored, '')).toThrow(expect.objectContaining({ code: 'TIMELINE_BASIS_MISSING' }));
    expect(() => checkTimelineWrite(stored, timelineBasis(row()))).toThrow(expect.objectContaining({ code: 'TIMELINE_CHANGED' }));
  });
  test('no row, or an empty one, has nothing to lose', () => {
    expect(() => checkTimelineWrite(null, undefined)).not.toThrow();
    expect(() => checkTimelineWrite(row(), undefined)).not.toThrow();
    expect(timelineHasContent(row())).toBe(false);
    expect(timelineHasContent(stored)).toBe(true);
  });
  test('the refusal is a SaveConflict carrying the current basis', () => {
    try { checkTimelineWrite(stored, 'old'); } catch (e) {
      expect(e).toBeInstanceOf(SaveConflict);
      expect(e.extra.timeline_basis).toBe(timelineBasis(stored));
    }
  });
});

describe('scenesToRemove', () => {
  const existing = [{ id: 's1' }, { id: 's2' }, { id: 'beat-scene', scene_plan_id: 'p1' }];
  test('removes only named scenes that the save does not keep', () => {
    expect(scenesToRemove(existing, new Set(['s1']), ['s2'], 1).map((r) => r.id)).toEqual(['s2']);
    expect(scenesToRemove(existing, new Set(['s1', 's2']), ['s2'], 2)).toEqual([]);
  });
  test('removes nothing it is not told to (a failed load names nothing)', () => {
    expect(scenesToRemove(existing, new Set(), [], 0)).toEqual([]);
    expect(scenesToRemove(existing, new Set(), undefined, 0)).toEqual([]);
    expect(scenesToRemove(existing, new Set(), 'not-a-list', 0)).toEqual([]);
  });
  test("never removes a beat's scene, or an id that is not one of the episode's", () => {
    expect(scenesToRemove(existing, new Set(['s1']), ['beat-scene', 'elsewhere'], 1)).toEqual([]);
  });
  test('removing every scene with none sent needs confirm_remove_all', () => {
    expect(() => scenesToRemove(existing, new Set(), ['s1', 's2'], 0))
      .toThrow(expect.objectContaining({ status: 409, code: 'SAVE_WOULD_REMOVE_ALL_SCENES' }));
    expect(scenesToRemove(existing, new Set(), ['s1', 's2'], 0, true).map((r) => r.id)).toEqual(['s1', 's2']);
  });
});
