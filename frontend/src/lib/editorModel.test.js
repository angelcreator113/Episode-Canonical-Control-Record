/** What the episode editor draws, from an edit in the server's shape (Timeline Editor redesign P1). */
import { describe, test, expect } from 'vitest';
import {
  LANES, buildTimeline, beatReadiness, mediaIndex, timecode, editPoints, findingText,
} from './editorModel';

const media = mediaIndex({
  rawClips: [
    { id: 'r1', performer: 'justawoman', label: 'Prime take 1', thumbnail_url: 'https://cdn/r1.jpg' },
    { id: 'r2', performer: 'lala', label: 'Lala walk', thumbnail_url: 'https://cdn/r2.jpg' },
  ],
  sceneSets: [{ id: 'set1', name: 'Closet', angles: [{ id: 'a1', angle_label: 'Wide', still_image_url: 'https://cdn/a1.jpg' }, { id: 'a2', angle_label: 'Mirror', video_clip_url: 'https://cdn/a2.mp4', thumbnail_url: 'https://cdn/a2.jpg' }] }],
  takes: [{ approval_id: 'ap1', audio_url: 'https://cdn/ap1.webm' }],
});

const EDIT = {
  fps: 30,
  beatModes: { 2: 'gameplay_only' },
  beatDurations: { 1: 8000 },
  sceneClips: [
    { id: 'c1', beat_number: 1, position: 0, source_kind: 'angle_still', source_id: 'a1', source_in_ms: 0, source_out_ms: 6000, source_duration_ms: null, duration_ms: 6000 },
    { id: 'c2', beat_number: 2, position: 0, source_kind: 'angle_video', source_id: 'a2', source_in_ms: 0, source_out_ms: 5000, source_duration_ms: 5000, duration_ms: 5000 },
  ],
  segments: [{ id: 's1', raw_clip_id: 'r1', source_in_ms: 1000, source_out_ms: 9000, anchor_kind: 'beat_start', anchor_beat: 1, anchor_ref: null, offset_ms: 0,
    layout: { x: 100, y: 80, w: 480, h: 270 }, audio_in_ms: 2000, audio_out_ms: 9000, audio_gain_db: -3, audio_muted: true, audio_fade_in_ms: 0, audio_fade_out_ms: 0, status: 'draft' }],
  pip: null,
  visibility: [],
  items: [
    { id: 'd1', kind: 'dialogue_placement', anchor_kind: 'beat_start', anchor_beat: 1, anchor_ref: null, offset_ms: 1000,
      voice_association_id: 'as1', voice_approval_id: 'ap1', line_beat: 1, line_index: 0, values: {} },
    { id: 't1', kind: 'transition', anchor_kind: 'beat_start', anchor_beat: 2, anchor_ref: null, offset_ms: 0, values: { type: 'crossfade', duration_ms: 500 } },
  ],
  audioItems: [
    { id: 'm1', track: 'music', asset_ref: 'Morning bed', slot: null, source_in_ms: 0, source_out_ms: 4000, anchor_kind: 'edit_start', anchor_beat: null, anchor_ref: null, offset_ms: 500, gain_db: -6, fade_in_ms: 0, fade_out_ms: 0, duck_under_dialogue_db: null },
    { id: 'x1', track: 'sfx', asset_ref: null, slot: 'click', source_in_ms: 0, source_out_ms: 300, anchor_kind: 'item_start', anchor_beat: null, anchor_ref: 'gone', offset_ms: 0, gain_db: 0, fade_in_ms: 0, fade_out_ms: 0, duck_under_dialogue_db: null },
  ],
  lineTimes: {},
  voiceTakes: { ap1: { playable: true, state: 'current', association_id: 'as1', beat_number: 1, line_index: 0, in_ms: 0, out_ms: 1500, source_duration_ms: 2000, gain_db: 0, fade_in_ms: 0, fade_out_ms: 0, normalise: false } },
};

describe('buildTimeline', () => {
  const model = buildTimeline(EDIT, media);

  test('14 beats on the edit clock, with their canonical names; a locked beat keeps its length', () => {
    expect(model.beats).toHaveLength(14);
    expect(model.beats[0]).toMatchObject({ beat: 1, name: 'Opening Ritual', start: 0, end: 8000, locked: true });
    expect(model.beats[1]).toMatchObject({ beat: 2, start: 8000, end: 13000, prime_mode: 'gameplay_only' });
    expect(model.duration).toBe(13000);
  });

  test('every lane is drawn; lanes without a data model say what unlocks them', () => {
    expect(LANES.map((l) => l.key)).toEqual(['scene', 'performer', 'prime', 'prime_vo', 'dialogue', 'phone', 'gameplay', 'overlays', 'music', 'sfx', 'captions']);
    for (const key of ['phone', 'gameplay', 'overlays']) {
      expect(LANES.find((l) => l.key === key).pending).toMatch(/Gate 2b/);
      expect(model.blocks[key]).toEqual([]);
    }
    for (const key of ['performer', 'captions']) expect(LANES.find((l) => l.key === key).pending).toBeUndefined();
  });

  test('C1b: a Lala take, a caption and a mode change sit where the clock puts them; a lost anchor is unplaced', () => {
    const c1b = buildTimeline({ ...EDIT, items: [
      ...EDIT.items,
      { id: 'p1', kind: 'performer_clip', anchor_kind: 'beat_start', anchor_beat: 1, anchor_ref: null, offset_ms: 2000, duration_ms: 3000,
        values: { raw_clip_id: 'r2', source_in_ms: 0, source_out_ms: 3000, layout: { x: 0, y: 0, w: 1920, h: 1080 }, layer: 0 } },
      { id: 'k1', kind: 'caption', anchor_kind: 'beat_start', anchor_beat: 2, anchor_ref: null, offset_ms: 0, duration_ms: 1500,
        values: { text: 'A New Alliance', style_key: 'title', layout: { x: 160, y: 80, w: 1600, h: 160 } } },
      { id: 'v1', kind: 'visual_mode', anchor_kind: 'beat_start', anchor_beat: 1, anchor_ref: null, offset_ms: 4000, duration_ms: null, values: { mode: 'cinematic' } },
      { id: 'k2', kind: 'caption', anchor_kind: 'item_start', anchor_beat: null, anchor_ref: 'gone', offset_ms: 0, duration_ms: 1000, values: { text: 'Lost', style_key: 'caption', layout: { x: 0, y: 0, w: 10, h: 10 } } },
    ] }, media);
    expect(c1b.blocks.performer).toEqual([expect.objectContaining({ id: 'p1', start: 2000, end: 5000, label: 'Lala walk', kind: 'performer_clip' })]);
    expect(c1b.blocks.captions).toEqual([expect.objectContaining({ id: 'k1', start: 8000, end: 9500, label: 'A New Alliance', style_key: 'title' })]);
    expect(c1b.modeMarks).toEqual([expect.objectContaining({ id: 'v1', at: 4000, mode: 'cinematic' })]);
    expect(c1b.unplaced).toContainEqual(expect.objectContaining({ id: 'k2', kind: 'caption', label: 'Lost' }));
  });

  test("a beat's visual mode: what plays, and what is stored (not chosen is null and plays as gameplay)", () => {
    const m = buildTimeline({ ...EDIT, beatVisualModes: { 2: 'cinematic' } }, media);
    expect(m.beats.slice(0, 2).map((b) => [b.visual_mode, b.visual_mode_set])).toEqual([['gameplay', null], ['cinematic', 'cinematic']]);
  });

  test('scene clips, the Prime segment and its linked commentary, dialogue and music sit where the clock puts them', () => {
    expect(model.blocks.scene.map((b) => [b.id, b.start, b.end, b.label])).toEqual([['c1', 0, 6000, 'Closet · Wide'], ['c2', 8000, 13000, 'Closet · Mirror']]);
    expect(model.blocks.prime).toEqual([expect.objectContaining({ id: 's1', start: 0, end: 8000, label: 'Prime take 1', image: 'https://cdn/r1.jpg' })]);
    expect(model.blocks.prime_vo).toEqual([expect.objectContaining({ id: 's1:vo', start: 1000, end: 8000, muted: true, linked: 's1' })]);
    expect(model.blocks.dialogue).toEqual([expect.objectContaining({ id: 'd1', start: 1000, end: 2500, problem: null, audio_url: 'https://cdn/ap1.webm' })]);
    expect(model.blocks.music).toEqual([expect.objectContaining({ id: 'm1', start: 500, end: 4500, label: 'Morning bed' })]);
    expect(model.transitions).toEqual([expect.objectContaining({ id: 't1', at: 8000, type: 'crossfade' })]);
  });

  test('something placed relative to a missing anchor is listed as unplaced, never drawn at a guessed time', () => {
    expect(model.blocks.sfx).toEqual([]);
    expect(model.unplaced).toEqual([expect.objectContaining({ id: 'x1', reason: 'anchor_missing' })]);
  });

  test('an empty edit has 14 zero-length beats and no blocks', () => {
    const empty = buildTimeline({ sceneClips: [], segments: [], items: [], audioItems: [], visibility: [], voiceTakes: {}, lineTimes: {} });
    expect(empty.duration).toBe(0);
    expect(empty.beats.every((b) => b.start === 0 && b.end === 0)).toBe(true);
    expect(Object.values(empty.blocks).flat()).toEqual([]);
  });
});

describe('beatReadiness', () => {
  const model = buildTimeline(EDIT, media);
  test('findings go to their beat, directly or through the block they name; the rest are episode-wide', () => {
    const r = beatReadiness(model, [
      { code: 'scene_missing', severity: 'blocking', beat: 3 },
      { code: 'scene_clip_holds_last_frame', severity: 'warning', beat: 1, ref: 'c1' },
      { code: 'prime_source_missing', severity: 'blocking', ref: 's1' },
      { code: 'something', severity: 'warning' },
    ]);
    expect(r.beats.find((b) => b.beat === 1)).toMatchObject({ status: 'blocked', blocking: 1, warning: 1 });
    expect(r.beats.find((b) => b.beat === 2)).toMatchObject({ status: 'clear' });
    expect(r.beats.find((b) => b.beat === 3)).toMatchObject({ status: 'blocked' });
    expect(r.beats.find((b) => b.beat === 4)).toMatchObject({ status: 'empty' });
    expect(r.episode).toEqual([{ code: 'something', severity: 'warning' }]);
  });
});

describe('helpers', () => {
  test('timecode is mm:ss.ff at 30 fps', () => {
    expect(timecode(0)).toBe('00:00.00');
    expect(timecode(14767)).toBe('00:14.23');
    expect(timecode(158400)).toBe('02:38.12');
    expect(timecode(4033)).toBe('00:04.01'); // the frame the clock snaps to, not the one before it
  });
  test('edit points are every beat and block edge, sorted', () => {
    expect(editPoints(buildTimeline(EDIT, media))).toEqual([0, 500, 1000, 2500, 4500, 6000, 8000, 13000]);
  });
  test('findings read as sentences; unknown codes fall back to their words', () => {
    expect(findingText({ code: 'scene_missing' })).toBe('No scene clip in this beat');
    expect(findingText({ code: 'brand_new_code' })).toBe('brand new code');
  });
});
