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
const edit = (over = {}) => ({ fps: 30, beatModes: {}, sceneClips: scenes(), segments: [], pip: null, visibility: [], items: [], audioItems: [], lineTimes: {}, voiceTakes: {}, ...over });
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
    expect(unplaced.find((f) => f.code === 'line_timing_unknown')).toMatchObject({ severity: 'blocking', what: 'segment' });
    // Any unmapped line mark blocks, wherever it anchors: an item, music, a visibility range.
    const lineAnchor = { anchor_kind: 'line_start', anchor_beat: null, anchor_ref: id(61), offset_ms: 0 };
    const everywhere = tl.editFindings(edit({
      items: [{ id: id(54), kind: 'transition', ...lineAnchor }],
      audioItems: [{ id: id(55), track: 'sfx', slot: 'x', source_in_ms: 0, source_out_ms: 500, ...lineAnchor }],
      visibility: [{ id: id(56), scope: 'range', ...lineAnchor, end_anchor_kind: 'beat_start', end_anchor_beat: 3, end_anchor_ref: null, end_offset_ms: 0, visible: false }],
    })).filter((f) => f.code === 'line_timing_unknown');
    expect(everywhere.map((f) => [f.what, f.severity])).toEqual([['item', 'blocking'], ['audio_item', 'blocking'], ['visibility', 'blocking']]);
    // edit_start: an absolute time.
    expect(tl.resolveAnchor(e, t, { anchor_kind: 'edit_start', offset_ms: 61234 })).toEqual({ t: 61234 });
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
    expect(f.find((x) => x.code === 'segment_before_edit_start')).toMatchObject({ severity: 'blocking', from_ms: -5000, to_ms: 0 });
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
    expect(tl.editFindings(e).find((f) => f.code === 'segment_beyond_edit_end')).toMatchObject({ severity: 'blocking', from_ms: 20000, to_ms: 25000 });
  });

  test('overlapping segments: the later one is drawn, both are heard, and it is a warning', () => {
    const e = edit({ segments: [segment({ id: id(1), source_out_ms: 20000, audio_out_ms: 20000 }), segment({ id: id(2), raw_clip_id: id(8), offset_ms: 10000, source_out_ms: 20000, audio_out_ms: 20000 })] });
    expect(tl.layoutAt(e, 15000).pip.segment_id).toBe(id(2));
    expect(tl.mixPlan(e).commentary).toHaveLength(2);
    expect(tl.editFindings(e).find((f) => f.code === 'prime_segments_overlap')).toMatchObject({ severity: 'warning', from_ms: 10000, to_ms: 20000 });
  });
});

// ── Stable beat timing (Evoni, 2026-10-28) ──────────────────────────────────
const LOCKED = Object.fromEntries(tl.BEATS.map((b) => [b, 10000]));
// The measured drift case: a whole-episode Prime take from beat 1, music from beat 5 (+1 s), an SFX at 43 s
// from beat 1; then beat 3's clip is replaced by one of 6 s.
const driftCase = (beatDurations) => {
  const music = { id: id(81), track: 'music', asset_ref: 'lib:bed', slot: null, source_in_ms: 0, source_out_ms: 30000, anchor_kind: 'beat_start', anchor_beat: 5, anchor_ref: null, offset_ms: 1000, gain_db: -12, fade_in_ms: 0, fade_out_ms: 0, duck_under_dialogue_db: null };
  const sfx = { id: id(82), track: 'sfx', asset_ref: null, slot: 'door', source_in_ms: 0, source_out_ms: 800, anchor_kind: 'beat_start', anchor_beat: 1, anchor_ref: null, offset_ms: 43000, gain_db: 0, fade_in_ms: 0, fade_out_ms: 0, duck_under_dialogue_db: null };
  const before = edit({ beatDurations, segments: [segment()], audioItems: [music, sfx] });
  const clips = scenes().map((c) => (c.beat_number === 3 ? { ...c, id: id(399), duration_ms: 6000 } : c));
  const after = { ...before, sceneClips: clips };
  const measure = (e) => {
    const t = tl.beatTimeline(e);
    const b5 = t.beats[4].start;
    const m = tl.mixPlan(e);
    const sfxAt = m.audio.find((a) => a.kind === 'sfx').timeline_start_ms;
    return {
      beat3_ms: t.beats[2].end - t.beats[2].start, beat5_start: b5, prime_source_at_beat5_start: tl.layoutAt(e, b5).pip.source_time_ms,
      music_at: m.audio.find((a) => a.kind === 'music').timeline_start_ms, sfx_at: sfxAt, sfx_into_beat5: sfxAt - b5,
      edit_ms: t.duration,
    };
  };
  return { before, after, measure };
};

describe('stable beat timing: a stored beat length is the clock', () => {
  test('draft timing (no stored length): the measured drift, reproduced', () => {
    const { before, after, measure } = driftCase({});
    expect(measure(before)).toEqual({ beat3_ms: 10000, beat5_start: 40000, prime_source_at_beat5_start: 40000, music_at: 41000, sfx_at: 43000, sfx_into_beat5: 3000, edit_ms: 140000 });
    expect(measure(after)).toEqual({ beat3_ms: 6000, beat5_start: 36000, prime_source_at_beat5_start: 36000, music_at: 37000, sfx_at: 43000, sfx_into_beat5: 7000, edit_ms: 136000 });
  });

  test('locked: replacing beat 3 with a shorter clip moves nothing; the gap is a blocking scene_gap', () => {
    const { before, after, measure } = driftCase(LOCKED);
    const same = { beat3_ms: 10000, beat5_start: 40000, prime_source_at_beat5_start: 40000, music_at: 41000, sfx_at: 43000, sfx_into_beat5: 3000, edit_ms: 140000 };
    expect(measure(before)).toEqual(same);
    expect(measure(after)).toEqual(same);
    expect(tl.timingChanges(tl.timingOf(before), tl.timingOf(after))).toEqual([]);
    const f = tl.editFindings(after);
    expect(f.filter((x) => x.severity === 'blocking')).toEqual([{ code: 'scene_gap', severity: 'blocking', beat: 3, from_ms: 26000, to_ms: 30000, gap_ms: 4000 }]);
    // The working preview still answers: no scene drawn in the gap, Prime still there.
    expect(tl.layoutAt(after, 27000)).toMatchObject({ beat: 3, scene: null, scene_gap: true, pip: { source_time_ms: 27000 } });
  });

  test('locked: a longer clip is cut at the beat end (scene_overruns_beat, blocking); removing every clip keeps the length', () => {
    const long = scenes().map((c) => (c.beat_number === 3 ? { ...c, duration_ms: 13000 } : c));
    long.push({ ...long[2], id: id(398), position: 1, duration_ms: 2000 });
    const e = edit({ beatDurations: LOCKED, sceneClips: long });
    const t = tl.beatTimeline(e);
    expect(t.beats[2]).toMatchObject({ start: 20000, end: 30000, content_ms: 15000, locked: true });
    expect(t.beats[2].clips.map((c) => [c.start, c.end, c.cut_ms])).toEqual([[20000, 30000, 3000], [30000, 30000, 2000]]);
    expect(t.beats[3].start).toBe(30000);
    expect(tl.layoutAt(e, 29999).scene).toMatchObject({ clip_id: long[2].id });
    expect(tl.layoutAt(e, 30000)).toMatchObject({ beat: 4 });
    expect(tl.editFindings(e).find((x) => x.code === 'scene_overruns_beat')).toEqual({ code: 'scene_overruns_beat', severity: 'blocking', beat: 3, overrun_ms: 5000, refs: [long[2].id, id(398)] });
    const none = edit({ beatDurations: LOCKED, sceneClips: scenes().filter((c) => c.beat_number !== 3) });
    expect(tl.beatTimeline(none).beats[2]).toMatchObject({ start: 20000, end: 30000 });
    expect(tl.beatTimeline(none).beats[4].start).toBe(40000);
    expect(codes(tl.editFindings(none).filter((x) => x.beat === 3 && x.code.startsWith('scene')))).toEqual(['scene_missing']);
    // Exactly filled: no finding.
    expect(codes(tl.editFindings(edit({ beatDurations: LOCKED, segments: [segment()] })))).toEqual([]);
  });

  test('timingChanges: an explicit length change says what moves downstream', () => {
    const { before } = driftCase(LOCKED);
    const after = { ...before, beatDurations: { ...LOCKED, 3: 12000 } };
    const ch = tl.timingChanges(tl.timingOf(before), tl.timingOf(after));
    const keys = ch.map((c) => c.key);
    expect(keys).toEqual(expect.arrayContaining(['beat:3', 'beat:4', 'beat:14', `music:${id(81)}`]));
    expect(keys).not.toContain('beat:2');
    expect(keys).not.toContain(`sfx:${id(82)}`);
    expect(keys).not.toContain(`segment:${id(1)}`);
    expect(ch.find((c) => c.key === 'beat:5')).toEqual({ key: 'beat:5', from: [40000, 50000], to: [42000, 52000], delta_ms: 2000 });
    expect(ch.find((c) => c.key === 'beat:3')).toEqual({ key: 'beat:3', from: [20000, 30000], to: [20000, 32000], delta_ms: 0 });
  });
});

// ── Dialogue placements (Evoni, 2026-10-28) ─────────────────────────────────
const take = (over = {}) => ({
  playable: true, state: 'current', reason: null, association_id: id(70), beat_number: 2, line_index: 0,
  in_ms: 500, out_ms: 2500, source_duration_ms: 3000, gain_db: -1, fade_in_ms: 10, fade_out_ms: 20, normalise: false, source_asset_id: id(71), s3_key: 'v/a.wav', ...over,
});
const placement = (over = {}) => ({
  id: id(90), kind: 'dialogue_placement', voice_association_id: id(70), voice_approval_id: id(72), line_beat: 2, line_index: 0,
  anchor_kind: 'beat_start', anchor_beat: 2, anchor_ref: null, offset_ms: 1500, values: { timing: 'manual' }, ...over,
});

describe('dialogue placements', () => {
  test('beat-relative and absolute placements play the approved revision\'s trim, on the edit clock', () => {
    const rel = edit({ items: [placement()], voiceTakes: { [id(72)]: take() } });
    expect(tl.mixPlan(rel).dialogue).toEqual([{
      kind: 'dialogue', item_id: id(90), approval_id: id(72), association_id: id(70), beat: 2, line_index: 0, source_asset_id: id(71), s3_key: 'v/a.wav',
      timeline_start_ms: 11500, timeline_end_ms: 13500, source_start_ms: 500, source_end_ms: 2500, gain_db: -1, fade_in_ms: 10, fade_out_ms: 20, normalise: false,
    }]);
    const abs = edit({ items: [placement({ anchor_kind: 'edit_start', anchor_beat: null, offset_ms: 11500 })], voiceTakes: { [id(72)]: take() } });
    expect(tl.mixPlan(abs).dialogue).toEqual(tl.mixPlan(rel).dialogue);
    expect(tl.editFindings(rel).filter((x) => x.code.startsWith('dialogue'))).toEqual([]);
    // A locked clock: the beat-relative one stays with its beat when beat 1 changes; the absolute one stays at 11.5 s.
    const shorter = scenes().map((c) => (c.beat_number === 1 ? { ...c, duration_ms: 8000 } : c));
    expect(tl.mixPlan({ ...rel, sceneClips: shorter }).dialogue[0].timeline_start_ms).toBe(9500);
    expect(tl.mixPlan({ ...rel, sceneClips: shorter, beatDurations: LOCKED }).dialogue[0].timeline_start_ms).toBe(11500);
    expect(tl.mixPlan({ ...abs, sceneClips: shorter }).dialogue[0].timeline_start_ms).toBe(11500);
  });

  test('a take that is not current plays nothing and blocks; no other take stands in', () => {
    const states = [
      [take({ playable: false, state: 'needs_review', reason: 'script_saved' }), 'needs_review'],
      [take({ playable: false, state: 'superseded' }), 'superseded'],
      [take({ playable: false, state: 'invalid', reason: 'take_reassigned' }), 'invalid'],
      [take({ association_id: id(73) }), 'association_changed'],
    ];
    for (const [k, state] of states) {
      // A newer playable approval for the same line exists: it is named, never used.
      const e = edit({ items: [placement()], voiceTakes: { [id(72)]: k, [id(74)]: take({ association_id: id(75) }) } });
      expect(tl.mixPlan(e).dialogue).toEqual([]);
      const f = tl.editFindings(e).filter((x) => x.code.startsWith('dialogue'));
      expect(f).toEqual([expect.objectContaining({ code: 'dialogue_take_not_current', severity: 'blocking', ref: id(90), state, current_approval_id: id(74) })]);
    }
    const missing = edit({ items: [placement()], voiceTakes: {} });
    expect(tl.editFindings(missing).find((x) => x.code === 'dialogue_take_not_current')).toMatchObject({ state: 'not_found', current_approval_id: null });
  });

  test('an approved line with no placement blocks; a placed one does not', () => {
    const e = edit({ voiceTakes: { [id(72)]: take(), [id(76)]: take({ association_id: id(77), beat_number: 4, line_index: 2 }) }, items: [placement()] });
    expect(tl.editFindings(e).filter((x) => x.code === 'dialogue_unplaced')).toEqual([{ code: 'dialogue_unplaced', severity: 'blocking', beat: 4, line_index: 2, approval_id: id(76) }]);
  });

  test('duration boundaries: beyond the edit blocks; outside its beat warns; a trim past the measured source blocks', () => {
    const k = { [id(72)]: take() };
    const at = (over) => tl.editFindings(edit({ items: [placement(over)], voiceTakes: k })).filter((x) => x.code.startsWith('dialogue'));
    // 8.5 s into beat 2 (10 s long): 2 s of take runs 500 ms into beat 3.
    expect(at({ offset_ms: 8500 })).toEqual([expect.objectContaining({ code: 'dialogue_outside_beat', severity: 'warning', from_ms: 18500, to_ms: 20500 })]);
    expect(at({ offset_ms: 8000 })).toEqual([]);
    expect(at({ anchor_kind: 'edit_start', anchor_beat: null, offset_ms: 138001 }).map((x) => [x.code, x.severity])).toEqual([['dialogue_beyond_edit', 'blocking'], ['dialogue_outside_beat', 'warning']]);
    expect(at({ anchor_kind: 'edit_start', anchor_beat: null, offset_ms: -1 }).map((x) => x.code)).toContain('dialogue_beyond_edit');
    const past = tl.editFindings(edit({ items: [placement()], voiceTakes: { [id(72)]: take({ out_ms: 3200 }) } }));
    expect(past.find((x) => x.code === 'dialogue_take_bad_range')).toMatchObject({ severity: 'blocking' });
    expect(tl.mixPlan(edit({ items: [placement()], voiceTakes: { [id(72)]: take({ out_ms: 3200 }) } })).dialogue).toEqual([]);
  });

  test('overlapping dialogue is reported, not refused: both still play', () => {
    const second = placement({ id: id(91), voice_association_id: id(77), voice_approval_id: id(76), line_index: 1, offset_ms: 2500 });
    const e = edit({ items: [placement(), second], voiceTakes: { [id(72)]: take(), [id(76)]: take({ association_id: id(77), line_index: 1 }) } });
    expect(tl.mixPlan(e).dialogue.map((d) => d.item_id)).toEqual([id(90), id(91)]);
    expect(tl.editFindings(e).filter((x) => x.code.startsWith('dialogue'))).toEqual([{ code: 'dialogue_overlap', severity: 'warning', ref: id(91), with: id(90), from_ms: 12500, to_ms: 13500 }]);
  });
});
