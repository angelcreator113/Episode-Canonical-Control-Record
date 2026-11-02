/** The Timeline Editor's load readers, on the API's real shapes (P0, 2026-11-02). */
import { describe, test, expect } from 'vitest';
import { unwrapEpisode, unwrapScenes, unwrapTimeline } from './timelineLoad';

describe('unwrapEpisode', () => {
  test('GET /episodes/:id answers { data: episode, script_revision }', () => {
    expect(unwrapEpisode({ data: { id: 'ep-1', title: 'A' }, script_revision: 2 })).toEqual({ id: 'ep-1', title: 'A' });
  });
  test('anything without an episode id is null', () => {
    expect(unwrapEpisode({ script_revision: 2 })).toBeNull();
    expect(unwrapEpisode({ data: { title: 'no id' } })).toBeNull();
    expect(unwrapEpisode({ data: [] })).toBeNull();
    expect(unwrapEpisode(null)).toBeNull();
    expect(unwrapEpisode('<html>')).toBeNull();
  });
});

describe('unwrapScenes', () => {
  test('GET /episodes/:id/scenes answers { success, data: [scene] }', () => {
    expect(unwrapScenes({ success: true, data: [{ id: 's1' }], count: 1 })).toEqual([{ id: 's1' }]);
    expect(unwrapScenes({ success: true, data: [], count: 0 })).toEqual([]);
  });
  test('an unknown shape is null, never an empty list', () => {
    expect(unwrapScenes({ success: true })).toBeNull();
    expect(unwrapScenes({ data: { scenes: [] } })).toBeNull();
    expect(unwrapScenes(undefined)).toBeNull();
    expect(unwrapScenes('<html>')).toBeNull();
  });
});

describe('unwrapTimeline', () => {
  test('GET /timeline-data answers the row', () => {
    const row = { id: 't', episode_id: 'ep-1', beats: [], markers: [], audio_clips: [], character_clips: [], keyframes: null, basis: 'x' };
    expect(unwrapTimeline(row)).toBe(row);
  });
  test('an unknown shape is null', () => {
    expect(unwrapTimeline({})).toBeNull();
    expect(unwrapTimeline({ episode_id: 'ep-1', beats: 'x' })).toBeNull();
    expect(unwrapTimeline([])).toBeNull();
    expect(unwrapTimeline(null)).toBeNull();
  });
});
