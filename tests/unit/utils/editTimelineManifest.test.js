'use strict';

/**
 * The edit clock's additions for the render manifest (Evoni, 2026-11-16):
 * the frame grid, a mix plan cut to a range, which file a layer is drawn
 * from, and commentary heard over dialogue. Pure: rows built here.
 */

const tl = require('../../../src/utils/editTimeline');

const still = (id, beat, ms) => ({ id, beat_number: beat, position: 0, source_kind: 'angle_still', source_id: `a-${id}`, source_in_ms: null, source_out_ms: null, source_duration_ms: null, duration_ms: ms });
const segment = (over = {}) => ({
  id: 's1', raw_clip_id: 'prime', source_in_ms: 0, source_out_ms: 20000, anchor_kind: 'edit_start', anchor_beat: null, anchor_ref: null, offset_ms: 0, layout: null,
  audio_in_ms: 0, audio_out_ms: 20000, audio_gain_db: -3, audio_muted: false, audio_fade_in_ms: 2000, audio_fade_out_ms: 2000, ...over,
});
const take = (over = {}) => ({ playable: true, state: 'current', reason: null, association_id: 'as1', beat_number: 1, line_index: 0, in_ms: 500, out_ms: 3500, source_duration_ms: 4000,
  gain_db: 0, fade_in_ms: 100, fade_out_ms: 100, normalise: false, source_asset_id: 'src1', s3_key: 'voice/src1.wav', ...over });
const line = (over = {}) => ({ id: 'd1', kind: 'dialogue_placement', anchor_kind: 'edit_start', anchor_beat: null, anchor_ref: null, offset_ms: 4000,
  voice_association_id: 'as1', voice_approval_id: 'ap1', line_beat: 1, line_index: 0, ...over });
const base = (over = {}) => ({
  fps: 30, beatModes: {}, beatDurations: {}, sceneClips: [still('c1', 1, 10000), still('c2', 2, 10000)],
  segments: [segment()], pip: null, visibility: [], items: [line()],
  audioItems: [{ id: 'm1', track: 'music', asset_ref: 'bed', slot: null, source_in_ms: 0, source_out_ms: 30000, anchor_kind: 'edit_start', anchor_beat: null, anchor_ref: null, offset_ms: 0, gain_db: -6, fade_in_ms: 0, fade_out_ms: 0, duck_under_dialogue_db: null }],
  lineTimes: {}, voiceTakes: { ap1: take() }, ...over,
});

describe('the frame grid', () => {
  // previewPlan's formula, written out again here (criterion 6).
  const previewSnap = (ms) => Math.round((Math.round((Number(ms) || 0) * 30 / 1000) * 1000) / 30);
  const TABLE = [0, 1, 16, 17, 33, 34, 49, 50, 51, 66, 67, 100, 333, 1000, 1016, 1017, 9999, 10000, 123456, 1799999, 0.4, 16.6, 16.7, 33.33, -1, -17, -40, '250', '33.4', null, undefined, NaN, 'x'];

  test('frame grid: FPS is 30; frameOf and frameTime are the two halves of the preview\'s snapToFrame', () => {
    expect(tl.FPS).toBe(30);
    for (const ms of TABLE) {
      const frame = Math.round((Number(ms) || 0) * 30 / 1000);
      expect([ms, tl.frameOf(ms)]).toEqual([ms, frame]);
      expect([ms, tl.frameTime(frame)]).toEqual([ms, Math.round(frame * 1000 / 30)]);
      expect([ms, tl.snapToFrame(ms)]).toEqual([ms, previewSnap(ms)]);
    }
  });

  test('frame grid: snapToFrame matches previewPlan\'s formula for every ms of a minute', () => {
    for (let ms = 0; ms <= 60000; ms += 1) {
      if (tl.snapToFrame(ms) !== previewSnap(ms)) throw new Error(`differs at ${ms}`);
    }
    expect(tl.snapToFrame(60000)).toBe(60000);
  });

  test('frame grid: a frame\'s time is whole ms and names that frame again', () => {
    expect([0, 1, 2, 3, 29, 30, 31].map(tl.frameTime)).toEqual([0, 33, 67, 100, 967, 1000, 1033]);
    for (let f = 0; f < 5000; f += 1) expect(tl.frameOf(tl.frameTime(f))).toBe(f);
  });
});

describe('mixPlan with a range', () => {
  test('mixPlan range: without a range the plan is what it was (no envelope, no range)', () => {
    const edit = base();
    const plain = tl.mixPlan(edit);
    expect(Object.keys(plain)).toEqual(['duration_ms', 'commentary', 'audio', 'dialogue']);
    for (const ev of [...plain.commentary, ...plain.audio, ...plain.dialogue]) {
      expect(ev).not.toHaveProperty('envelope_start_ms');
      expect(ev).not.toHaveProperty('envelope_end_ms');
    }
    expect(tl.mixPlan(edit, tl.beatTimeline(edit), tl.placedSegments(edit), null)).toEqual(plain);
    // The music runs past the edit's end and is cut there, as before.
    expect(plain.audio[0]).toMatchObject({ timeline_start_ms: 0, timeline_end_ms: 20000, source_end_ms: 20000 });
  });

  test('mixPlan range: events wholly outside are dropped; events crossing an edge are cut, source and timeline together', () => {
    const edit = base();
    const mix = tl.mixPlan(edit, undefined, undefined, { start_ms: 5000, end_ms: 6000 });
    expect(mix.range).toEqual({ start_ms: 5000, end_ms: 6000 });
    expect(mix.commentary).toEqual([expect.objectContaining({ segment_id: 's1', timeline_start_ms: 5000, timeline_end_ms: 6000, source_start_ms: 5000, source_end_ms: 6000 })]);
    // The line plays 4000-7000 from 500 in its file: at 5000 it is 1500 in.
    expect(mix.dialogue).toEqual([expect.objectContaining({ item_id: 'd1', timeline_start_ms: 5000, timeline_end_ms: 6000, source_start_ms: 1500, source_end_ms: 2500 })]);
    const before = tl.mixPlan(edit, undefined, undefined, { start_ms: 1000, end_ms: 4000 });
    expect(before.dialogue).toEqual([]);
    const after = tl.mixPlan(edit, undefined, undefined, { start_ms: 7000, end_ms: 9000 });
    expect(after.dialogue).toEqual([]);
    expect(tl.mixPlan(edit, undefined, undefined, { start_ms: 9000, end_ms: 9000 })).toMatchObject({ commentary: [], audio: [], dialogue: [] });
  });

  test('mixPlan range: a cut event keeps its envelope, so a fade goes on mid-fade (the volume matches the whole plan\'s)', () => {
    const edit = base();
    const whole = tl.mixPlan(edit);
    // The range starts 1 s into the commentary's 2 s fade in and ends 1 s into its fade out.
    const mix = tl.mixPlan(edit, undefined, undefined, { start_ms: 1000, end_ms: 19000 });
    const ev = mix.commentary[0];
    expect(ev).toMatchObject({ timeline_start_ms: 1000, timeline_end_ms: 19000, source_start_ms: 1000, source_end_ms: 19000, envelope_start_ms: 0, envelope_end_ms: 20000, fade_in_ms: 2000, fade_out_ms: 2000 });
    // The fade's shape at t, from the envelope (the preview's eventVolume shape, on the uncut span).
    const shape = (e, start, end, t) => Math.max(0, Math.min(1, e.fade_in_ms > 0 ? (t - start) / e.fade_in_ms : 1, e.fade_out_ms > 0 ? (end - t) / e.fade_out_ms : 1));
    const full = whole.commentary[0];
    for (const t of [1000, 1500, 2000, 10000, 18000, 18500, 18999]) {
      expect([t, shape(ev, ev.envelope_start_ms, ev.envelope_end_ms, t)]).toEqual([t, shape(full, full.timeline_start_ms, full.timeline_end_ms, t)]);
    }
    expect(shape(ev, ev.envelope_start_ms, ev.envelope_end_ms, 1000)).toBe(0.5);
    // An event the range does not cut has its own span as its envelope.
    expect(mix.dialogue[0]).toMatchObject({ timeline_start_ms: 4000, timeline_end_ms: 7000, envelope_start_ms: 4000, envelope_end_ms: 7000 });
    // The envelope is the span the whole plan plays: the music is still cut at the edit's end.
    expect(mix.audio[0]).toMatchObject({ envelope_start_ms: 0, envelope_end_ms: 20000 });
  });

  test('mixPlan range: a range over everything holds the whole plan\'s events', () => {
    const edit = base();
    const whole = tl.mixPlan(edit);
    const all = tl.mixPlan(edit, undefined, undefined, { start_ms: 0, end_ms: 20000 });
    const strip = (list) => list.map(({ envelope_start_ms: s, envelope_end_ms: e, ...rest }) => rest);
    expect(strip(all.commentary)).toEqual(whole.commentary);
    expect(strip(all.audio)).toEqual(whole.audio);
    expect(strip(all.dialogue)).toEqual(whole.dialogue);
    expect(tl.mixPlan(edit, undefined, undefined, {}).range).toEqual({ start_ms: 0, end_ms: 20000 });
  });
});

describe('mediaChoice', () => {
  const done = { key_status: 'done', url_cutout: 'https://cdn.example/cut.webm', s3_key_cutout: 'k/cutout-1.webm' };
  const original = { use: 'original', blocked: false, reason: null };
  const cutout = { use: 'cutout', blocked: false, reason: null };
  const choose = (purpose, layer, clip, useCutout) => tl.mediaChoice({ purpose, layer, useCutout, clip });

  test.each(['final', 'preview'])('mediaChoice (%s): a scene is always the original', (purpose) => {
    expect(choose(purpose, 'scene', done, true)).toEqual(original);
    expect(choose(purpose, 'scene', { key_status: 'failed' })).toEqual(original);
  });

  test.each(['final', 'preview'])('mediaChoice (%s): the PIP without use_cutout is the original, even with a cutout', (purpose) => {
    expect(choose(purpose, 'pip', done, false)).toEqual(original);
  });

  test.each(['final', 'preview'])('mediaChoice (%s): the PIP with use_cutout and a done cutout is the cutout', (purpose) => {
    expect(choose(purpose, 'pip', done, true)).toEqual(cutout);
    expect(choose(purpose, 'pip', { key_status: 'done', s3_key_cutout: 'k/cutout-1.webm' }, true)).toEqual(cutout);
  });

  test('mediaChoice: the PIP with use_cutout and no cutout blocks a final; a preview draws the original and says so', () => {
    for (const clip of [{ key_status: 'none' }, { key_status: 'processing' }, { key_status: 'failed' }, { key_status: 'done' }, null]) {
      expect(choose('final', 'pip', clip, true)).toEqual({ use: 'original', blocked: true, reason: 'cutout_missing' });
      expect(choose('preview', 'pip', clip, true)).toEqual({ use: 'original', blocked: false, reason: 'cutout_missing' });
    }
  });

  test.each(['final', 'preview'])('mediaChoice (%s): a performer with a done cutout is the cutout', (purpose) => {
    expect(choose(purpose, 'performer', done)).toEqual(cutout);
  });

  test('mediaChoice: a performer whose cutout is queued, processing or failed blocks a final; a preview draws the original and says so', () => {
    for (const status of ['queued', 'processing', 'failed']) {
      expect(choose('final', 'performer', { key_status: status })).toEqual({ use: 'original', blocked: true, reason: 'cutout_missing' });
      expect(choose('preview', 'performer', { key_status: status })).toEqual({ use: 'original', blocked: false, reason: 'cutout_missing' });
    }
  });

  test.each(['final', 'preview'])('mediaChoice (%s): a performer never sent for green removal is the original, with no reason', (purpose) => {
    expect(choose(purpose, 'performer', { key_status: 'none' })).toEqual(original);
    expect(choose(purpose, 'performer', {})).toEqual(original);
    expect(choose(purpose, 'performer', null)).toEqual(original);
  });
});

describe('audioOverlaps', () => {
  test('audioOverlaps: each stretch where commentary and a line are heard at once; the plan is not changed', () => {
    const edit = base({ segments: [segment(), segment({ id: 's2', offset_ms: 6500, source_out_ms: 1000, audio_out_ms: 1000, audio_fade_in_ms: 0, audio_fade_out_ms: 0 })] });
    const mix = tl.mixPlan(edit);
    const copy = JSON.parse(JSON.stringify(mix));
    expect(tl.audioOverlaps(mix)).toEqual([
      { commentary: 's1', dialogue: 'd1', start_ms: 4000, end_ms: 7000 },
      { commentary: 's2', dialogue: 'd1', start_ms: 6500, end_ms: 7000 },
    ]);
    expect(mix).toEqual(copy);
  });

  test('audioOverlaps: touching is not overlapping; a muted commentary overlaps nothing; music is not looked at', () => {
    const after = base({ segments: [segment({ offset_ms: 7000, source_out_ms: 5000, audio_out_ms: 5000 })] });
    expect(tl.audioOverlaps(tl.mixPlan(after))).toEqual([]);
    expect(tl.audioOverlaps(tl.mixPlan(base({ segments: [segment({ audio_muted: true })] })))).toEqual([]);
    expect(tl.audioOverlaps({ commentary: [], dialogue: [] })).toEqual([]);
    expect(tl.audioOverlaps(null)).toEqual([]);
  });
});
