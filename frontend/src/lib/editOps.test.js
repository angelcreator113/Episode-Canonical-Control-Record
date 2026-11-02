/** The editor's commands and their exact inverses (Timeline Editor redesign P3). */
import { describe, test, expect } from 'vitest';
import * as ops from './editOps';

const seg = {
  id: 's1', raw_clip_id: 'r1', source_in_ms: 1000, source_out_ms: 9000, anchor_kind: 'beat_start', anchor_beat: 2, anchor_ref: null, offset_ms: 500,
  layout: null, audio_in_ms: 2000, audio_out_ms: 8000, audio_gain_db: -3, audio_muted: false, audio_fade_in_ms: 200, audio_fade_out_ms: 300, status: 'draft',
};
const clip = { id: 'c1', beat_number: 3, position: 1, source_kind: 'angle_video', source_id: 'a2', source_in_ms: 0, source_out_ms: 4000, duration_ms: 4000 };
const beats = Array.from({ length: 14 }, (_, i) => ({ beat: i + 1, start: i * 10000, end: (i + 1) * 10000 }));

describe('commands and their inverses', () => {
  test('placing then undoing a scene clip deletes the row the server made; undoing that places it back', () => {
    const place = ops.placeSceneClip({ beat_number: 3, source_kind: 'angle_still', source_id: 'a1', duration_ms: 5000 });
    expect(place.requests).toEqual([{ method: 'post', path: '/scene-clips', body: { beat_number: 3, source_kind: 'angle_still', source_id: 'a1', duration_ms: 5000 } }]);
    const undo = place.undo([{ scene_clip_id: 'c9' }]);
    expect(undo.requests).toEqual([{ method: 'delete', path: '/scene-clips/c9' }]);
    expect(undo.undo().requests[0]).toEqual({ method: 'post', path: '/scene-clips', body: { beat_number: 3, source_kind: 'angle_still', source_id: 'a1', duration_ms: 5000 } });
  });

  test('deleting a scene clip is undone by placing it at its own position with its own trim', () => {
    expect(ops.removeSceneClip(clip).undo().requests[0].body).toEqual({ beat_number: 3, source_kind: 'angle_video', source_id: 'a2', duration_ms: 4000, source_in_ms: 0, source_out_ms: 4000, position: 1 });
  });

  test('a trim is undone with the stored values, only the fields it changed', () => {
    const c = ops.updateSceneClip(clip, { duration_ms: 2500 });
    expect(c.requests[0]).toEqual({ method: 'patch', path: '/scene-clips/c1', body: { duration_ms: 2500 } });
    expect(c.undo().requests[0].body).toEqual({ duration_ms: 4000 });
  });

  test("trimming Prime's video is undone in one batch: the video range, then the commentary range and fades the server clamped", () => {
    const c = ops.trimSegment(seg, { source_out_ms: 5000 });
    expect(c.requests).toEqual([{ method: 'post', path: '/segments/s1/trim-video', body: { source_in_ms: 1000, source_out_ms: 5000 } }]);
    expect(c.undo().requests).toEqual([{ method: 'post', path: '/ops', body: { steps: [
      { op: 'segment.trim-video', id: 's1', body: { source_in_ms: 1000, source_out_ms: 9000 } },
      { op: 'segment.trim-audio', id: 's1', body: { audio_in_ms: 2000, audio_out_ms: 8000 } },
      { op: 'segment.audio', id: 's1', body: { audio_fade_in_ms: 200, audio_fade_out_ms: 300 } },
    ] } }]);
  });

  test('P4: a scene clip split is undone in one batch: the new part removed, the first part given back its length and trim', () => {
    const c = ops.splitSceneClip(clip, 1500);
    expect(c.requests).toEqual([{ method: 'post', path: '/scene-clips/c1/split', body: { at_ms: 1500 } }]);
    const undo = c.undo([{ scene_clip_id: 'c1', new_scene_clip_id: 'c2' }]);
    expect(undo.requests).toEqual([{ method: 'post', path: '/ops', body: { steps: [
      { op: 'remove', id: 'c2', body: { what: 'scene_clip' } },
      { op: 'scene-clip.update', id: 'c1', body: { duration_ms: 4000, source_in_ms: 0, source_out_ms: 4000 } },
    ] } }]);
    expect(undo.undo().requests[0].path).toBe('/scene-clips/c1/split');
  });

  test('P4: a reorder is undone by moving the clip back to where it was', () => {
    const c = ops.reorderSceneClip(clip, 0, 2);
    expect(c.requests[0]).toEqual({ method: 'post', path: '/scene-clips/c1/reorder', body: { index: 0 } });
    expect(c.undo().requests[0].body).toEqual({ index: 2 });
  });

  test('P4: a sound moved, trimmed or re-levelled in place is undone with the stored values of the fields it changed', () => {
    const item = { id: 'm1', track: 'music', source_in_ms: 0, source_out_ms: 9000, anchor_kind: 'edit_start', anchor_beat: null, anchor_ref: null, offset_ms: 500, gain_db: -6, fade_in_ms: 0, fade_out_ms: 0 };
    const move = ops.updateAudioItem(item, { anchor_kind: 'beat_start', anchor_beat: 2, offset_ms: 100 });
    expect(move.requests[0]).toEqual({ method: 'patch', path: '/audio-items/m1', body: { anchor_kind: 'beat_start', anchor_beat: 2, offset_ms: 100 } });
    expect(move.undo().requests[0].body).toEqual({ anchor_kind: 'edit_start', anchor_beat: null, anchor_ref: null, offset_ms: 500 });
    expect(ops.updateAudioItem(item, { gain_db: -3 }).undo().requests[0].body).toEqual({ gain_db: -6 });
  });

  test("moving, Prime's place and her commentary are undone with what was stored", () => {
    expect(ops.moveSegment(seg, { anchor_kind: 'edit_start', offset_ms: 3000 }).undo().requests[0].body)
      .toEqual({ anchor_kind: 'beat_start', anchor_beat: 2, anchor_ref: null, offset_ms: 500 });
    expect(ops.setSegmentLayout(seg, { x: 1, y: 2, w: 300, h: 200 }).undo().requests[0].body).toEqual({ layout: null });
    expect(ops.setSegmentAudio(seg, { audio_muted: true }).undo().requests[0].body).toEqual({ audio_muted: false });
  });

  test('deleting a segment is undone by placing the same take, range, place, commentary and level', () => {
    const back = ops.removeSegment(seg).undo().requests[0];
    expect(back).toEqual({ method: 'post', path: '/segments', body: {
      raw_clip_id: 'r1', source_in_ms: 1000, source_out_ms: 9000, anchor_kind: 'beat_start', anchor_beat: 2, anchor_ref: null, offset_ms: 500,
      layout: null, audio_in_ms: 2000, audio_out_ms: 8000, audio_gain_db: -3, audio_muted: false, audio_fade_in_ms: 200, audio_fade_out_ms: 300,
    } });
  });

  test('dialogue is placed and put back with its approval and line association', () => {
    const item = { id: 'd1', voice_approval_id: 'ap1', voice_association_id: 'as1', anchor_kind: 'beat_start', anchor_beat: 1, anchor_ref: null, offset_ms: 700 };
    expect(ops.removeDialogue(item).undo().requests[0]).toEqual({ method: 'post', path: '/dialogue', body: {
      approval_id: 'ap1', association_id: 'as1', anchor_kind: 'beat_start', anchor_beat: 1, anchor_ref: null, offset_ms: 700,
    } });
  });

  test("a split, a timing lock and a restore can't be undone through the API: their inverse is a barrier with the reason", () => {
    for (const c of [ops.splitSegment(seg, 4000), ops.lockTiming(), ops.restoreVersion({ id: 'v1', name: 'A' })]) {
      expect(c.undo([{}])).toMatchObject({ barrier: true, why: expect.stringMatching(/can't be undone/) });
    }
    expect(ops.splitSegment(seg, 4000).requests[0]).toEqual({ method: 'post', path: '/segments/s1/split', body: { at_source_ms: 4000 } });
  });

  test("beat settings are undone to their stored state; a visibility rule is removed by its id", () => {
    expect(ops.setBeatMode(4, 'gameplay_only', 'required').undo().requests[0].body).toEqual({ prime_mode: 'required' });
    expect(ops.setBeatDuration(4, 9000, null).undo().requests[0].body).toEqual({ duration_ms: null });
    expect(ops.setBeatPipVisible(4, false).undo([{ rule_id: 'v9' }]).requests[0]).toEqual({ method: 'delete', path: '/visibility/v9' });
  });
});

describe('anchors and drops', () => {
  test('a drag keeps a beat-relative anchor relative to its beat, and makes anything else absolute', () => {
    expect(ops.anchorAt(seg, 13000, beats)).toEqual({ anchor_kind: 'beat_start', anchor_beat: 2, offset_ms: 3000 });
    expect(ops.anchorAt({ anchor_kind: 'edit_start' }, 4321, beats)).toEqual({ anchor_kind: 'edit_start', offset_ms: 4321 });
    expect(ops.anchorAt({ anchor_kind: 'item_start', anchor_ref: 'x' }, 50, beats)).toEqual({ anchor_kind: 'edit_start', offset_ms: 50 });
  });
  test('a drop lands in the beat at its time, or after the last beat that has a length', () => {
    expect(ops.beatForDrop(beats, 25000, 140000)).toBe(3);
    const draft = beats.map((b, i) => (i < 2 ? b : { ...b, start: 20000, end: 20000 }));
    expect(ops.beatForDrop(draft, 30000, 20000)).toBe(3);
    expect(ops.beatForDrop(beats.map((b) => ({ ...b, start: 0, end: 0 })), 0, 0)).toBe(1);
  });
});

describe('writeFailure', () => {
  const err = (status, code, error) => ({ response: { status, data: { code, error } } });
  test('says what happened, and marks a stale page', () => {
    expect(ops.writeFailure(err(409, 'EDIT_CHANGED'))).toMatchObject({ stale: true });
    expect(ops.writeFailure(err(403, 'AUTH_GROUP_REQUIRED')).message).toMatch(/admin account/);
    expect(ops.writeFailure(err(409, 'LINE_ALREADY_PLACED', 'This line is already placed.')).message).toBe('This line is already placed.');
    expect(ops.writeFailure(new Error('Network Error')).message).toMatch(/could not be reached/);
  });
});
