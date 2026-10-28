'use strict';

/**
 * The edit's clock, layout, mix and coverage (Timeline C1, design R2.2,
 * R5.1, R5.6 C1-5..C1-8), on rows built here. Pure: no database.
 */

const tl = require('../../../src/utils/editTimeline');

const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
// Beats 1-14, each one still scene clip of `ms` (beat n starts at (n - 1) * ms).
const scenes = (ms = 10000) => tl.BEATS.map((b) => ({ id: id(100 + b), beat_number: b, position: 0, source_kind: 'angle_still', source_id: id(200 + b), source_in_ms: null, source_out_ms: null, source_duration_ms: null, duration_ms: ms }));
const segment = (over = {}) => ({
  id: id(1), raw_clip_id: id(9), source_in_ms: 0, source_out_ms: 140000, anchor_kind: 'beat_start', anchor_beat: 1, anchor_ref: null, offset_ms: 0, layout: null,
  audio_in_ms: 0, audio_out_ms: 140000, audio_gain_db: 0, audio_muted: false, audio_fade_in_ms: 0, audio_fade_out_ms: 0, ...over,
});
const edit = (over = {}) => ({ fps: 30, beatModes: {}, sceneClips: scenes(), segments: [], pip: null, visibility: [], items: [], audioItems: [], lineTimes: {}, dialogue: [], ...over });
const codes = (fs) => fs.map((f) => f.code);

describe('the clock', () => {
  test('beats follow their scene clips in order; a beat with no clip has no length and is scene_missing', () => {
    const clips = scenes().filter((c) => c.beat_number !== 3);
    clips.push({ ...clips[0], id: id(300), position: 1, duration_ms: 2500 });
    const t = tl.beatTimeline(edit({ sceneClips: clips }));
    expect(t.beats[0]).toMatchObject({ beat: 1, start: 0, end: 12500 });
    expect(t.beats[2]).toMatchObject({ beat: 3, start: 22500, end: 22500 });
    expect(t.beats[3]).toMatchObject({ beat: 4, start: 22500, end: 32500 });
    expect(t.duration).toBe(12500 + 12 * 10000);
    expect(tl.editFindings(edit({ sceneClips: clips })).filter((f) => f.code === 'scene_missing').map((f) => f.beat)).toEqual([3]);
  });

  test('anchors: a beat start plus offset; an item chain; a cycle and an unknown line are unresolved, never guessed', () => {
    const items = [
      { id: id(50), kind: 'transition', anchor_kind: 'beat_start', anchor_beat: 4, anchor_ref: null, offset_ms: 250 },
      { id: id(51), kind: 'transition', anchor_kind: 'item_start', anchor_beat: null, anchor_ref: id(50), offset_ms: 100 },
      { id: id(52), kind: 'transition', anchor_kind: 'item_start', anchor_beat: null, anchor_ref: id(53), offset_ms: 0 },
      { id: id(53), kind: 'transition', anchor_kind: 'item_start', anchor_beat: null, anchor_ref: id(52), offset_ms: 0 },
    ];
    const e = edit({ items, lineTimes: { [id(60)]: 4321 } });
    const t = tl.beatTimeline(e);
    expect(tl.resolveAnchor(e, t, items[1])).toEqual({ t: 30350 });
    expect(tl.resolveAnchor(e, t, items[2])).toEqual({ error: 'anchor_cycle' });
    expect(tl.resolveAnchor(e, t, { anchor_kind: 'line_start', anchor_ref: id(60), offset_ms: 9 })).toEqual({ t: 4330 });
    expect(tl.resolveAnchor(e, t, { anchor_kind: 'line_start', anchor_ref: id(61), offset_ms: 0 })).toEqual({ error: 'line_timing_unknown' });
    const unplaced = tl.editFindings(edit({ segments: [segment({ anchor_kind: 'line_start', anchor_beat: null, anchor_ref: id(61) })] }));
    expect(unplaced.find((f) => f.code === 'anchor_unresolved')).toMatchObject({ severity: 'blocking', reason: 'line_timing_unknown' });
  });
});

describe('C1-5 sync: picture and commentary read one source clock', () => {
  // A clap at source 7000 ms of the take.
  const CLAP = 7000;
  const clapAt = (e) => {
    const placed = tl.placedSegments(e).filter((p) => !p.error);
    const p = placed.find((x) => x.seg.source_in_ms <= CLAP && CLAP < x.seg.source_out_ms);
    return p.start + (CLAP - p.seg.source_in_ms);
  };
  const check = (e) => {
    const t = clapAt(e);
    expect(tl.layoutAt(e, t).pip.source_time_ms).toBe(CLAP);
    const ev = tl.mixPlan(e).commentary.find((c) => c.timeline_start_ms <= t && t < c.timeline_end_ms);
    // The sample heard at the clap's frame is the clap: within one frame at 30 fps (here, exact).
    expect(Math.abs(tl.sourceTimeAt(ev, t) - CLAP)).toBeLessThanOrEqual(1000 / 30);
    return t;
  };
  test('placed, moved, trimmed (video and commentary), split, gained and muted', () => {
    let s = segment({ source_in_ms: 5000, source_out_ms: 20000, audio_in_ms: 5000, audio_out_ms: 20000, anchor_beat: 2, offset_ms: 1000 });
    expect(check(edit({ segments: [s] }))).toBe(10000 + 1000 + 2000);
    s = { ...s, offset_ms: 1500 }; // moved
    expect(check(edit({ segments: [s] }))).toBe(13500);
    s = { ...s, source_in_ms: 6000, offset_ms: 2500, audio_in_ms: 6000 }; // head trim keeps the frames where they were
    expect(check(edit({ segments: [s] }))).toBe(13500);
    s = { ...s, audio_in_ms: 6500, audio_out_ms: 18000, audio_gain_db: -3.5 }; // commentary trimmed and gained
    expect(check(edit({ segments: [s] }))).toBe(13500);
    const a = { ...s, id: id(2), source_out_ms: 6800, audio_out_ms: 6800 };
    const b = { ...s, id: id(3), source_in_ms: 6800, offset_ms: 2500 + 800, audio_in_ms: 6800, audio_fade_in_ms: 0 };
    expect(check(edit({ segments: [a, b] }))).toBe(13500); // split at 6800
    const muted = edit({ segments: [{ ...b, audio_muted: true }] });
    expect(tl.layoutAt(muted, 13500).pip.source_time_ms).toBe(CLAP); // muting never hides
    expect(tl.mixPlan(muted).commentary).toEqual([]);
  });
});

describe('C1-6 hiding the PIP never touches the commentary', () => {
  test('hidden over a covered range: no PIP drawn; the mix plan is identical to the visible case', () => {
    const base = edit({ segments: [segment()] });
    const hidden = edit({
      segments: [segment()],
      visibility: [
        { id: id(70), scope: 'beat', beat_number: 3, visible: false },
        { id: id(71), scope: 'range', beat_number: null, anchor_kind: 'beat_start', anchor_beat: 5, anchor_ref: null, offset_ms: 2000, end_anchor_kind: 'beat_start', end_anchor_beat: 5, end_anchor_ref: null, end_offset_ms: 6000, visible: false },
      ],
    });
    expect(tl.layoutAt(base, 25000).pip).not.toBeNull();
    expect(tl.layoutAt(hidden, 25000).pip).toBeNull(); // beat 3 hidden
    expect(tl.layoutAt(hidden, 43000).pip).toBeNull(); // beat 5, 2-6 s hidden
    expect(tl.layoutAt(hidden, 47000).pip).not.toBeNull();
    expect(tl.mixPlan(hidden)).toEqual(tl.mixPlan(base));
    expect(codes(tl.coverageFindings(hidden))).toEqual([]);
  });

  test('a segment wholly inside hidden stretches is still heard, sample for sample', () => {
    const segs = [segment({ id: id(1), anchor_beat: 3, offset_ms: 2000, source_in_ms: 500, source_out_ms: 6500, audio_in_ms: 1000, audio_out_ms: 6000 })];
    const shown = edit({ segments: segs });
    const hidden = edit({ segments: segs, pip: { default_visible: false }, visibility: [{ id: id(73), scope: 'beat', beat_number: 3, visible: false }] });
    expect(tl.layoutAt(hidden, 23000).pip).toBeNull();
    expect(tl.mixPlan(hidden).commentary).toEqual([expect.objectContaining({ segment_id: id(1), timeline_start_ms: 22500, timeline_end_ms: 27500, source_start_ms: 1000, source_end_ms: 6000 })]);
    expect(tl.mixPlan(hidden)).toEqual(tl.mixPlan(shown));
  });

  test('the last rule that applies wins; the default can start hidden', () => {
    const e = edit({ segments: [segment()], pip: { default_visible: false }, visibility: [{ id: id(72), scope: 'beat', beat_number: 2, visible: true }] });
    expect(tl.layoutAt(e, 5000).pip).toBeNull();
    expect(tl.layoutAt(e, 15000).pip).not.toBeNull();
  });
});

describe('C1-7 coverage of required beats, whatever the visibility', () => {
  test('required + full cover: none; required + hidden + full cover: none; muted commentary still covers', () => {
    expect(tl.coverageFindings(edit({ segments: [segment()] }))).toEqual([]);
    const hidden = edit({ segments: [segment({ audio_muted: true })], pip: { default_visible: false } });
    expect(tl.coverageFindings(hidden)).toEqual([]);
  });

  test('required + gap: prime_footage_missing with the span; gameplay-only + gap: none', () => {
    // Covers 0..35 s: beat 4 from 35 s, and beats 5-14, are uncovered.
    const e = edit({ segments: [segment({ source_out_ms: 35000, audio_out_ms: 35000 })] });
    const found = tl.coverageFindings(e);
    expect(found[0]).toEqual({ code: 'prime_footage_missing', severity: 'blocking', beat: 4, from_ms: 35000, to_ms: 40000 });
    expect(found.map((f) => f.beat)).toEqual([4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]);
    const modes = Object.fromEntries([4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14].map((b) => [b, 'gameplay_only']));
    expect(tl.coverageFindings(edit({ segments: e.segments, beatModes: modes }))).toEqual([]);
  });

  test('a gap of one frame or less is not a finding; just over is', () => {
    const two = (gap) => edit({ sceneClips: scenes().slice(0, 1), segments: [
      segment({ id: id(1), source_out_ms: 5000, audio_out_ms: 5000 }),
      segment({ id: id(2), offset_ms: 5000 + gap, source_out_ms: 10000, audio_out_ms: 10000 }),
    ] });
    expect(tl.coverageFindings(two(33)).filter((f) => f.beat === 1)).toEqual([]);
    expect(tl.coverageFindings(two(34)).filter((f) => f.beat === 1)).toHaveLength(1);
  });
});

describe('C1-8 layout defaults and gameplay-only footage', () => {
  test('PIP bottom right, 28 % of 1920 wide; an override replaces only what it names', () => {
    const l = tl.layoutAt(edit({ segments: [segment()] }), 1000).pip.layout;
    expect(l).toEqual(tl.DEFAULT_LAYOUT);
    expect(l.w).toBe(Math.round(1920 * 0.28));
    expect(l.x + l.w).toBeLessThan(1920);
    expect(l.y + l.h).toBeLessThan(1080);
    expect(l.x).toBeGreaterThan(1920 / 2);
    expect(l.y).toBeGreaterThan(1080 / 2);
    const moved = tl.layoutAt(edit({ segments: [segment({ layout: { x: 100 } })] }), 1000).pip.layout;
    expect(moved).toEqual({ ...tl.DEFAULT_LAYOUT, x: 100 });
  });

  test('a gameplay-only beat with footage still shows it (Q21); without, no banner', () => {
    const e = edit({ segments: [segment({ source_out_ms: 10000, audio_out_ms: 10000 })], beatModes: { 1: 'gameplay_only', 2: 'gameplay_only' } });
    expect(tl.layoutAt(e, 5000).pip).not.toBeNull();
    expect(tl.layoutAt(e, 15000)).toMatchObject({ pip: null, prime_missing: false });
    expect(tl.layoutAt(e, 25000)).toMatchObject({ pip: null, prime_missing: true }); // beat 3, required
  });

  test('a video scene clip longer than its source holds its last frame (a warning, never stretched)', () => {
    const clips = scenes();
    clips[0] = { ...clips[0], source_kind: 'angle_video', source_in_ms: 1000, source_out_ms: 4000, source_duration_ms: 5000, duration_ms: 10000 };
    const e = edit({ sceneClips: clips });
    expect(tl.layoutAt(e, 2000).scene).toMatchObject({ source_time_ms: 3000, held: false });
    expect(tl.layoutAt(e, 8000).scene).toMatchObject({ source_time_ms: 4000, held: true });
    expect(tl.editFindings(e).find((f) => f.code === 'scene_clip_holds_last_frame')).toMatchObject({ severity: 'warning', from_ms: 3000, to_ms: 10000 });
  });
});

describe('takes across beats: the placed interval is what is checked', () => {
  test('one take spanning every beat: no overrun finding, every required beat covered', () => {
    const e = edit({ segments: [segment()] });
    expect(tl.editFindings(e).filter((f) => f.code !== 'scene_missing')).toEqual([]);
  });

  test('a take from beat 3 through beat 9: covered there, gaps only where it is not placed', () => {
    const e = edit({ segments: [segment({ anchor_beat: 3, source_out_ms: 70000, audio_out_ms: 70000 })] });
    const f = tl.editFindings(e);
    expect(f.filter((x) => x.code === 'prime_footage_missing').map((x) => x.beat)).toEqual([1, 2, 10, 11, 12, 13, 14]);
    expect(f.filter((x) => /overrun|beyond|before/.test(x.code))).toEqual([]);
  });

  test('a take placed before the edit starts: a warning, and only its placed part inside the edit covers', () => {
    const e = edit({ segments: [segment({ offset_ms: -5000, source_out_ms: 25000, audio_out_ms: 25000 })] });
    const f = tl.editFindings(e);
    expect(f.find((x) => x.code === 'segment_before_edit_start')).toMatchObject({ severity: 'warning', from_ms: -5000, to_ms: 0 });
    // 25 s of take placed at -5 s: on the edit, 0-20 s; beat 3 (20-30 s) is not covered.
    expect(f.find((x) => x.code === 'prime_footage_missing')).toMatchObject({ beat: 3, from_ms: 20000, to_ms: 30000 });
    expect(tl.mixPlan(e).commentary[0]).toMatchObject({ timeline_start_ms: 0, source_start_ms: 5000 });
  });

  test('the more-than-one-frame rule holds between two takes that each span beats', () => {
    const a = segment({ id: id(1), source_out_ms: 45000, audio_out_ms: 45000 });
    const b = segment({ id: id(2), raw_clip_id: id(8), offset_ms: 45034, source_out_ms: 100000, audio_out_ms: 100000 });
    expect(tl.coverageFindings(edit({ segments: [a, b] })).find((x) => x.beat === 5)).toMatchObject({ from_ms: 45000, to_ms: 45034 });
    expect(tl.coverageFindings(edit({ segments: [a, { ...b, offset_ms: 45033 }] })).find((x) => x.beat === 5)).toBeUndefined();
  });
});

describe('a segment with no commentary (a split half the commentary was not in)', () => {
  test('no event in the mix, whatever its mute; other segments and tracks unchanged', () => {
    const music = { id: id(81), track: 'music', asset_ref: 'lib:bed', slot: null, source_in_ms: 0, source_out_ms: 30000, anchor_kind: 'beat_start', anchor_beat: 1, anchor_ref: null, offset_ms: 0, gain_db: -12, fade_in_ms: 0, fade_out_ms: 0, duck_under_dialogue_db: null };
    const none = segment({ id: id(1), source_out_ms: 6000, audio_in_ms: null, audio_out_ms: null, audio_muted: false });
    const other = segment({ id: id(2), raw_clip_id: id(8), offset_ms: 6000, source_in_ms: 6000, source_out_ms: 20000, audio_in_ms: 9000, audio_out_ms: 20000 });
    const e = edit({ segments: [none, other], audioItems: [music] });
    const m = tl.mixPlan(e);
    expect(m.commentary.map((c) => c.segment_id)).toEqual([id(2)]);
    expect(m.audio).toEqual(tl.mixPlan(edit({ audioItems: [music] })).audio);
    expect(tl.mixPlan(edit({ segments: [{ ...none, audio_muted: true }, other], audioItems: [music] }))).toEqual(m);
    // Its picture still shows and covers.
    expect(tl.layoutAt(e, 3000).pip.segment_id).toBe(id(1));
    expect(tl.coverageFindings(edit({ sceneClips: scenes().slice(0, 2), segments: [none, other] }))).toEqual([]);
  });
});

describe('the mix plan', () => {
  test('events past the edit end are cut, source and timeline together; music and SFX are placed by anchor', () => {
    const e = edit({
      sceneClips: scenes().slice(0, 2), // 20 s
      segments: [segment({ offset_ms: 15000, source_out_ms: 10000, audio_out_ms: 10000 })],
      audioItems: [{ id: id(80), track: 'music', asset_ref: 'lib:theme', slot: null, source_in_ms: 2000, source_out_ms: 8000, anchor_kind: 'beat_start', anchor_beat: 2, anchor_ref: null, offset_ms: 0, gain_db: -6, fade_in_ms: 500, fade_out_ms: 500, duck_under_dialogue_db: -9 }],
    });
    const m = tl.mixPlan(e);
    expect(m.commentary).toEqual([expect.objectContaining({ timeline_start_ms: 15000, timeline_end_ms: 20000, source_start_ms: 0, source_end_ms: 5000 })]);
    expect(m.audio).toEqual([expect.objectContaining({ kind: 'music', timeline_start_ms: 10000, timeline_end_ms: 16000, source_start_ms: 2000, gain_db: -6, duck_under_dialogue_db: -9 })]);
    expect(tl.editFindings(e).find((f) => f.code === 'segment_beyond_edit_end')).toMatchObject({ from_ms: 20000, to_ms: 25000 });
  });

  test('overlapping segments: the later one is drawn, both are heard, and it is a warning', () => {
    const e = edit({ segments: [segment({ id: id(1), source_out_ms: 20000, audio_out_ms: 20000 }), segment({ id: id(2), raw_clip_id: id(8), offset_ms: 10000, source_out_ms: 20000, audio_out_ms: 20000 })] });
    expect(tl.layoutAt(e, 15000).pip.segment_id).toBe(id(2));
    expect(tl.mixPlan(e).commentary).toHaveLength(2);
    expect(tl.editFindings(e).find((f) => f.code === 'prime_segments_overlap')).toMatchObject({ severity: 'warning', from_ms: 10000, to_ms: 20000 });
  });
});
