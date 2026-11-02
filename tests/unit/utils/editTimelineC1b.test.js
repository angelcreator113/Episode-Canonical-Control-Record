/**
 * The edit clock's C1b additions (Timeline Editor redesign Gate 2a,
 * 2026-11-02; design R8.2, R8.3.1; rulings D3, D4, D5): the visual mode at
 * a time, and the picture as ordered layers with Lala over the scene and
 * under Prime, captions on top, and each layer's opacity.
 */
const tl = require('../../../src/utils/editTimeline');

const still = (id, beat, ms) => ({ id, beat_number: beat, position: 0, source_kind: 'angle_still', source_id: `a-${id}`, source_in_ms: null, source_out_ms: null, source_duration_ms: null, duration_ms: ms });
const base = (over = {}) => ({
  fps: 30, beatModes: {}, beatDurations: {},
  sceneClips: [still('c1', 1, 10000), still('c2', 2, 10000)],
  segments: [{ id: 's1', raw_clip_id: 'prime', source_in_ms: 0, source_out_ms: 20000, anchor_kind: 'edit_start', anchor_beat: null, anchor_ref: null, offset_ms: 0,
    layout: { x: 1300, y: 700, w: 540, h: 304, opacity: 0.8 }, audio_in_ms: 0, audio_out_ms: 20000, audio_gain_db: 0, audio_muted: false, audio_fade_in_ms: 0, audio_fade_out_ms: 0 }],
  pip: null, visibility: [], items: [], audioItems: [], lineTimes: {}, voiceTakes: {},
  ...over,
});
const item = (id, kind, values, { beat = 1, offset = 0, duration = null } = {}) => ({ id, kind, anchor_kind: 'beat_start', anchor_beat: beat, anchor_ref: null, offset_ms: offset, values, duration_ms: duration });

describe('modeAt', () => {
  test("a beat with no mode is gameplay; a beat's own default holds until a change inside it", () => {
    const edit = base({ beatVisualModes: { 2: 'cinematic' } });
    expect(tl.modeAt(edit, 5000)).toBe('gameplay');
    expect(tl.modeAt(edit, 15000)).toBe('cinematic');
    expect(tl.modeAt(edit, 25000)).toBeNull();
  });
  test('a timed change switches the mode at its instant, holds to the beat end, and the next beat starts in its own default', () => {
    const edit = base({ items: [item('m1', 'visual_mode', { mode: 'cinematic' }, { beat: 1, offset: 4000 })] });
    expect(tl.modeAt(edit, 3999)).toBe('gameplay');
    expect(tl.modeAt(edit, 4000)).toBe('cinematic');
    expect(tl.modeAt(edit, 9999)).toBe('cinematic');
    expect(tl.modeAt(edit, 10000)).toBe('gameplay');
  });
  test('the latest change at or before t wins; a mode change moves no time', () => {
    const edit = base({ items: [
      item('m1', 'visual_mode', { mode: 'cinematic' }, { offset: 2000 }),
      item('m2', 'visual_mode', { mode: 'gameplay' }, { offset: 6000 }),
    ] });
    expect([1000, 3000, 7000].map((t) => tl.modeAt(edit, t))).toEqual(['gameplay', 'cinematic', 'gameplay']);
    expect(tl.timingChanges(tl.timingOf(base()), tl.timingOf(edit)).filter((c) => !c.key.startsWith('item:'))).toEqual([]);
  });
});

describe('layersAt', () => {
  const lala = (over = {}) => item('p1', 'performer_clip', { raw_clip_id: 'lala', source_in_ms: 1000, source_out_ms: 7000, layout: { x: 200, y: 100, w: 800, h: 900, opacity: 0.9 }, layer: 0, ...over }, { offset: 2000, duration: 6000 });

  test('Lala is drawn over the scene and under Prime, at her own source time; captions on top', () => {
    const edit = base({ items: [lala(), item('t1', 'caption', { text: 'A New Alliance', style_key: 'title', layout: { x: 160, y: 80, w: 1600, h: 160 } }, { offset: 0, duration: 3000 })] });
    const f = tl.layersAt(edit, 2500);
    expect(f.layers.map((l) => l.kind)).toEqual(['scene', 'performer', 'pip', 'caption']);
    expect(f.layers[1]).toEqual({ kind: 'performer', item_id: 'p1', raw_clip_id: 'lala', source_time_ms: 1500, layout: { x: 200, y: 100, w: 800, h: 900 }, opacity: 0.9, layer: 0 });
    expect(f.layers[2]).toMatchObject({ kind: 'pip', segment_id: 's1', layout: { x: 1300, y: 700, w: 540, h: 304 }, opacity: 0.8 });
    expect(f.layers[3]).toEqual({ kind: 'caption', item_id: 't1', text: 'A New Alliance', style_key: 'title', layout: { x: 160, y: 80, w: 1600, h: 160 }, opacity: 1 });
    expect(f.mode).toBe('gameplay');
  });

  test('a performer clip and a caption are on screen only for their length', () => {
    const edit = base({ items: [lala(), item('t1', 'caption', { text: 'x', style_key: 'caption', layout: { x: 0, y: 0, w: 10, h: 10 } }, { offset: 0, duration: 3000 })] });
    expect(tl.layersAt(edit, 1999).layers.map((l) => l.kind)).toEqual(['scene', 'pip', 'caption']);
    expect(tl.layersAt(edit, 7999).layers.map((l) => l.kind)).toEqual(['scene', 'performer', 'pip']);
    expect(tl.layersAt(edit, 8000).layers.map((l) => l.kind)).toEqual(['scene', 'pip']);
  });

  test('two performers stack by their layer, then by the order they were placed', () => {
    const guest = item('p2', 'performer_clip', { raw_clip_id: 'guest', source_in_ms: 0, source_out_ms: 6000, layout: { x: 1000, y: 100, w: 600, h: 900 }, layer: 0 }, { offset: 2000, duration: 6000 });
    const front = { ...lala({ layer: 1 }) };
    expect(tl.layersAt(base({ items: [front, guest] }), 3000).layers.filter((l) => l.kind === 'performer').map((l) => l.item_id)).toEqual(['p2', 'p1']);
    expect(tl.layersAt(base({ items: [guest, lala()] }), 3000).layers.filter((l) => l.kind === 'performer').map((l) => l.item_id)).toEqual(['p2', 'p1']);
  });

  test('layoutAt is unchanged by C1b items', () => {
    const plain = base();
    expect(tl.layoutAt(base({ items: [lala()] }), 3000)).toEqual(tl.layoutAt(plain, 3000));
  });
});

describe('editFindings', () => {
  test('a performer clip or caption past the end of the edit is a warning; an anchor that is gone is the usual warning', () => {
    const edit = base({ items: [item('p1', 'performer_clip', { raw_clip_id: 'lala', source_in_ms: 0, source_out_ms: 9000, layout: { x: 0, y: 0, w: 10, h: 10 } }, { beat: 2, offset: 8000, duration: 9000 })] });
    expect(tl.editFindings(edit)).toContainEqual({ code: 'item_beyond_edit_end', severity: 'warning', ref: 'p1', what: 'performer_clip', from_ms: 20000, to_ms: 27000 });
  });
});
