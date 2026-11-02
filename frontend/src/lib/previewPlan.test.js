/** The working preview's plan (Timeline Editor redesign P2): pictures and sounds at t, from the edit. */
import { describe, test, expect } from 'vitest';
import { mixPlan, DEFAULT_LAYOUT } from './editTimeline';
import { mediaIndex } from './editorModel';
import {
  snapToFrame, dbToLinear, isSafari, primeVideo, framePlan, eventVolume, mixAt,
} from './previewPlan';

const media = mediaIndex({
  rawClips: [
    { id: 'r1', performer: 'justawoman', label: 'Prime take', url_raw: 'https://cdn/r1.mp4', url_cutout: 'https://cdn/r1-cutout.webm', thumbnail_url: 'https://cdn/r1.jpg' },
    { id: 'r2', performer: 'lala', label: 'Lala walk', url_raw: 'https://cdn/r2.mp4', thumbnail_url: 'https://cdn/r2.jpg' },
  ],
  sceneSets: [{ id: 'set1', name: 'Closet', angles: [
    { id: 'a1', angle_label: 'Wide', still_image_url: 'https://cdn/a1.jpg' },
    { id: 'a2', angle_label: 'Window', still_image_url: 'https://cdn/a2.jpg', video_clip_url: 'https://cdn/a2.mp4' },
  ] }],
  takes: [{ approval_id: 'ap1', audio_url: 'https://cdn/ap1.webm' }],
});

const EDIT = {
  fps: 30, beatModes: {}, beatDurations: {},
  sceneClips: [
    { id: 'c1', beat_number: 1, position: 0, source_kind: 'angle_still', source_id: 'a1', source_in_ms: 0, source_out_ms: 4000, source_duration_ms: null, duration_ms: 4000 },
    { id: 'c2', beat_number: 1, position: 1, source_kind: 'angle_video', source_id: 'a2', source_in_ms: 1000, source_out_ms: 3000, source_duration_ms: 5000, duration_ms: 4000 },
    { id: 'c3', beat_number: 2, position: 0, source_kind: 'raw_clip', source_id: 'r2', source_in_ms: 500, source_out_ms: 5500, source_duration_ms: 6000, duration_ms: 5000 },
  ],
  segments: [{ id: 's1', raw_clip_id: 'r1', source_in_ms: 10000, source_out_ms: 22000, anchor_kind: 'edit_start', anchor_beat: null, anchor_ref: null, offset_ms: 1000,
    layout: null, audio_in_ms: 11000, audio_out_ms: 20000, audio_gain_db: -6, audio_muted: false, audio_fade_in_ms: 1000, audio_fade_out_ms: 0, status: 'draft' }],
  pip: { id: 'p', default_layout: null, default_visible: true, use_cutout: true },
  visibility: [],
  items: [{ id: 'd1', kind: 'dialogue_placement', anchor_kind: 'beat_start', anchor_beat: 1, anchor_ref: null, offset_ms: 2000,
    voice_association_id: 'as1', voice_approval_id: 'ap1', line_beat: 1, line_index: 2, values: {} }],
  audioItems: [{ id: 'm1', track: 'music', asset_ref: 'Bed', slot: null, source_in_ms: 0, source_out_ms: 13000, anchor_kind: 'edit_start', anchor_beat: null, anchor_ref: null, offset_ms: 0, gain_db: 6, fade_in_ms: 0, fade_out_ms: 0, duck_under_dialogue_db: null }],
  lineTimes: {},
  voiceTakes: { ap1: { playable: true, state: 'current', association_id: 'as1', beat_number: 1, line_index: 2, in_ms: 200, out_ms: 1700, source_duration_ms: 2000, gain_db: 0, fade_in_ms: 0, fade_out_ms: 0, normalise: true } },
};

describe('the clock and levels', () => {
  test('times snap to whole frames at 30 fps', () => {
    expect(snapToFrame(0)).toBe(0);
    expect(snapToFrame(16)).toBe(0);
    expect(snapToFrame(17)).toBe(33);
    expect(snapToFrame(1000)).toBe(1000);
    expect(snapToFrame(1020)).toBe(1033);
  });
  test('dB to linear', () => {
    expect(dbToLinear(0)).toBe(1);
    expect(dbToLinear(-6)).toBeCloseTo(0.501, 3);
  });
  test('fades shape the level; a boost above 0 dB plays at 0 dB and says so', () => {
    const ev = { gain_db: 0, fade_in_ms: 1000, fade_out_ms: 1000, timeline_start_ms: 0, timeline_end_ms: 4000 };
    expect(eventVolume(ev, 0).volume).toBe(0);
    expect(eventVolume(ev, 500).volume).toBeCloseTo(0.5);
    expect(eventVolume(ev, 2000).volume).toBe(1);
    expect(eventVolume(ev, 3500).volume).toBeCloseTo(0.5);
    expect(eventVolume({ ...ev, gain_db: 6, fade_in_ms: 0, fade_out_ms: 0 }, 2000)).toEqual({ volume: 1, clipped: true });
  });
});

describe('Prime’s video file', () => {
  const clip = { url_raw: 'raw.mp4', url_cutout: 'cut.webm' };
  test('her cutout when the edit asks for it; her original in Safari, saying why', () => {
    expect(primeVideo(clip, true, false)).toEqual({ url: 'cut.webm', cutout: true, note: null });
    expect(primeVideo(clip, true, true)).toMatchObject({ url: 'raw.mp4', cutout: false, note: expect.stringMatching(/can't show transparent video/) });
    expect(primeVideo({ url_raw: 'raw.mp4' }, true, false)).toMatchObject({ url: 'raw.mp4', note: expect.stringMatching(/cutout isn't ready/) });
    expect(primeVideo(clip, false, false)).toEqual({ url: 'raw.mp4', cutout: false, note: null });
    expect(primeVideo(null, true, false)).toEqual({ url: null, cutout: false, note: null });
  });
  test('Safari is told apart from Chrome, Edge and Firefox', () => {
    expect(isSafari('Mozilla/5.0 (Macintosh) AppleWebKit/605 (KHTML, like Gecko) Version/17.0 Safari/605.1.15')).toBe(true);
    expect(isSafari('Mozilla/5.0 (Macintosh) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36')).toBe(false);
    expect(isSafari('Mozilla/5.0 (Windows) AppleWebKit/537.36 Chrome/130 Safari/537.36 Edg/130')).toBe(false);
    expect(isSafari('Mozilla/5.0 (X11; Linux) Gecko/20100101 Firefox/131')).toBe(false);
  });
});

describe('framePlan', () => {
  test('a still scene, and Prime in her cutout where the edit places her, at her source time', () => {
    const f = framePlan(EDIT, 2000, media, { safari: false });
    expect(f.scene).toMatchObject({ clip_id: 'c1', kind: 'image', url: 'https://cdn/a1.jpg', name: 'Closet · Wide' });
    expect(f.pip).toMatchObject({ segment_id: 's1', url: 'https://cdn/r1-cutout.webm', cutout: true, source_time_ms: 11000 });
    expect(f.pip.layout).toEqual(DEFAULT_LAYOUT);
  });
  test('an angle video plays from its in point and holds its last frame past its out point', () => {
    expect(framePlan(EDIT, 4500, media, { safari: false }).scene).toMatchObject({ clip_id: 'c2', kind: 'video', url: 'https://cdn/a2.mp4', source_time_ms: 1500, held: false });
    expect(framePlan(EDIT, 7500, media, { safari: false }).scene).toMatchObject({ source_time_ms: 3000, held: true });
  });
  test('a performer clip as the scene plays its original file', () => {
    expect(framePlan(EDIT, 9000, media, { safari: false }).scene).toMatchObject({ clip_id: 'c3', kind: 'video', url: 'https://cdn/r2.mp4', source_time_ms: 1500 });
  });
  test('in Safari, Prime shows from her original file', () => {
    expect(framePlan(EDIT, 2000, media, { safari: true }).pip).toMatchObject({ url: 'https://cdn/r1.mp4', cutout: false });
  });
});

describe('mixAt', () => {
  const mix = mixPlan(EDIT);
  const at = (t, opts) => Object.fromEntries(mixAt(mix, t, media, opts).map((s) => [s.kind, s]));

  test("Prime's commentary plays from her original file on her take's clock, faded in", () => {
    const s = at(2500).commentary;
    expect(s).toMatchObject({ url: 'https://cdn/r1.mp4', active: true, source_time_ms: 11500, lane: 'prime_vo' });
    expect(s.volume).toBeCloseTo(dbToLinear(-6) * 0.5, 3);
  });
  test('approved dialogue plays its take from its trim; normalise is noted for the render', () => {
    const s = at(2500).dialogue;
    expect(s).toMatchObject({ url: 'https://cdn/ap1.webm', active: true, source_time_ms: 700, volume: 1, label: 'Beat 1 · line 3', normalise: true });
    expect(at(4000).dialogue).toMatchObject({ active: false, volume: 0, source_time_ms: null });
  });
  test('music has no file until the library exists, and nothing plays in its place', () => {
    expect(at(1000).music).toMatchObject({ url: null, missing: expect.stringMatching(/library is pending/), clipped: true });
  });
  test('a lane muted in the preview is muted; nothing else changes', () => {
    const muted = at(2500, { mutedLanes: { dialogue: true } });
    expect(muted.dialogue.muted).toBe(true);
    expect(muted.commentary.muted).toBe(false);
  });
});
