'use strict';

/**
 * The render manifest (Evoni, 2026-11-16), on rows built here. Pure: no
 * database. Each acceptance criterion of the manifest's brief is named in
 * the test that covers it (AC n).
 */

const fs = require('fs');
const path = require('path');
const tl = require('../../../src/utils/editTimeline');
const { stableJson, sha256 } = require('../../../src/services/episodeEditService');
const { computeCoverage } = require('../../../src/utils/productionCoverage');
const rm = require('../../../src/utils/renderManifest');

const clone = (v) => JSON.parse(JSON.stringify(v));
const still = (id, beat, ms, position = 0) => ({ id, beat_number: beat, position, source_kind: 'angle_still', source_id: `angle-${id}`, source_in_ms: null, source_out_ms: null, source_duration_ms: null, duration_ms: ms });
const video = (id, beat, { kind = 'angle_video', source = `angle-${id}`, from = 0, to, ms, position = 0 }) => ({ id, beat_number: beat, position, source_kind: kind, source_id: source, source_in_ms: from, source_out_ms: to, source_duration_ms: to, duration_ms: ms });
const segment = (over = {}) => ({
  id: 's1', raw_clip_id: 'prime', source_in_ms: 0, source_out_ms: 15000, anchor_kind: 'edit_start', anchor_beat: null, anchor_ref: null, offset_ms: 0, layout: null,
  audio_in_ms: 0, audio_out_ms: 15000, audio_gain_db: 0, audio_muted: false, audio_fade_in_ms: 0, audio_fade_out_ms: 0, status: 'approved', ...over,
});
const item = (id, kind, values, { beat = 1, offset = 0, duration = null } = {}) => ({ id, kind, anchor_kind: 'beat_start', anchor_beat: beat, anchor_ref: null, offset_ms: offset, values, duration_ms: duration });
const take = (over = {}) => ({ playable: true, state: 'current', reason: null, association_id: 'as1', beat_number: 1, line_index: 0, in_ms: 200, out_ms: 2200, source_duration_ms: 3000,
  gain_db: 0, fade_in_ms: 0, fade_out_ms: 0, normalise: false, source_asset_id: 'src1', s3_key: 'voice/src1.wav', sha256: 'a'.repeat(64), source_kind: 'uploaded', content_type: 'audio/wav',
  source_raw_clip_id: null, source_in_ms: null, source_out_ms: null, ...over });
const line = (over = {}) => ({ id: 'd1', kind: 'dialogue_placement', anchor_kind: 'edit_start', anchor_beat: null, anchor_ref: null, offset_ms: 7000,
  voice_association_id: 'as1', voice_approval_id: 'ap1', line_beat: 1, line_index: 0, ...over });
const music = (over = {}) => ({ id: 'm1', track: 'music', asset_ref: 'lib:bed', slot: null, source_in_ms: 0, source_out_ms: 4000, anchor_kind: 'edit_start', anchor_beat: null, anchor_ref: null, offset_ms: 1000, gain_db: -6, fade_in_ms: 0, fade_out_ms: 0, duck_under_dialogue_db: null, ...over });

const CLIPS = {
  prime: { id: 'prime', performer: 'justawoman', s3_key_raw: 'k/prime/original.mp4', url_raw: 'https://cdn.example/prime.mp4', s3_key_cutout: 'k/prime/cutout-1.webm', url_cutout: 'https://cdn.example/prime-cut-1.webm', key_status: 'done', file_size_bytes: '123456', duration_seconds: 140, width: 1920, height: 1080 },
  lala: { id: 'lala', performer: 'lala', s3_key_raw: 'k/lala/original.mp4', url_raw: 'https://cdn.example/lala.mp4', s3_key_cutout: 'k/lala/cutout-1.webm', url_cutout: 'https://cdn.example/lala-cut-1.webm', key_status: 'done', file_size_bytes: 999, duration_seconds: 30, width: 1280, height: 720 },
  guest: { id: 'guest', performer: 'guest', s3_key_raw: 'k/guest/original.mp4', url_raw: 'https://cdn.example/guest.mp4', s3_key_cutout: null, url_cutout: null, key_status: 'none', file_size_bytes: 5, duration_seconds: 12.5, width: 1280, height: 720 },
};
const ANGLES = {
  'angle-c2': { id: 'angle-c2', still_image_url: null, video_clip_url: 'https://cdn.example/a2.mp4' },
  'angle-c3': { id: 'angle-c3', still_image_url: 'https://cdn.example/a3.png', video_clip_url: null },
  'angle-c1': { id: 'angle-c1', still_image_url: 'https://cdn.example/a1.png', video_clip_url: null },
};
const VERSION = { id: 'v1', snapshot_sha256: 'f'.repeat(64), edit_revision: '7', script_revision: `sr1-${'0'.repeat(40)}`, script_seq: '3' };

/**
 * A full edit: beat 1 is Lala's take as the scene (4 s of source in a 6 s
 * place, so it holds its last frame from 4 s), beat 2 an angle's video, beat
 * 3 a still. Prime over all of it, as her cutout, hidden for a stretch and
 * for beat 3; a guest over the scene; a title; one line; one music item.
 */
const rich = (over = {}) => ({
  fps: 30, beatModes: {}, beatDurations: {},
  sceneClips: [
    video('c1', 1, { kind: 'raw_clip', source: 'lala', from: 0, to: 4000, ms: 6000 }),
    video('c2', 2, { from: 500, to: 5500, ms: 5000 }),
    still('c3', 3, 4000),
  ],
  segments: [segment()],
  pip: { id: 'pip', default_layout: { x: 1300, y: 700, w: 540, h: 304, opacity: 0.8 }, default_visible: true, use_cutout: true },
  visibility: [
    { id: 'r1', scope: 'range', anchor_kind: 'edit_start', anchor_beat: null, anchor_ref: null, offset_ms: 2010, end_anchor_kind: 'edit_start', end_anchor_beat: null, end_anchor_ref: null, end_offset_ms: 3005, visible: false },
    { id: 'r2', scope: 'beat', beat_number: 3, visible: false },
  ],
  items: [
    item('p1', 'performer_clip', { raw_clip_id: 'guest', source_in_ms: 1000, source_out_ms: 4000, layout: { x: 200, y: 100, w: 800, h: 900, opacity: 0.9 }, layer: 1 }, { offset: 1490, duration: 3000 }),
    item('p0', 'performer_clip', { raw_clip_id: 'lala', source_in_ms: 0, source_out_ms: 2000, layout: { x: 900, y: 100, w: 600, h: 900 }, layer: 0 }, { beat: 2, offset: 500, duration: 2000 }),
    item('t1', 'caption', { text: 'A New Alliance', style_key: 'title', layout: { x: 160, y: 80, w: 1600, h: 160 } }, { offset: 250, duration: 2755 }),
    line(),
  ],
  audioItems: [],
  lineTimes: {}, voiceTakes: { ap1: take() },
  ...over,
});
const input = (over = {}) => ({ purpose: 'preview', episodeId: 'ep1', version: VERSION, edit: rich(), clips: CLIPS, angles: ANGLES, voiceSources: {}, coverage: null, ...over });
const codes = (list) => list.map((f) => f.code);

/** Every frame's layers, read back out of the manifest's runs. */
const expand = (manifest) => {
  const out = new Map();
  for (const run of manifest.intervals) {
    for (let f = run.start_frame; f < run.end_frame; f += 1) {
      out.set(f, run.layers.map((l) => (l.source_time_ms != null && !l.held ? { ...l, source_time_ms: l.source_time_ms + tl.frameTime(f) - tl.frameTime(run.start_frame) } : l)));
    }
  }
  return out;
};
/** A manifest layer without what the manifest added: what layersAt gave. */
const bare = (l) => {
  const { asset, media, fit, ...rest } = l;
  if (l.kind === 'scene') delete rest.layout;
  else if (l.kind !== 'caption') delete rest.held;
  return rest;
};

describe('determinism and the hash (AC 1, 2, 3)', () => {
  test('AC 1 same saved version: the same manifest and manifest_sha256 on every build, whatever the key order', () => {
    const a = rm.buildManifest(input());
    const b = rm.buildManifest(input());
    const shuffled = rm.buildManifest(input({ clips: Object.fromEntries(Object.entries(CLIPS).reverse()), angles: Object.fromEntries(Object.entries(ANGLES).reverse()) }));
    expect(b).toEqual(a);
    expect(JSON.stringify(b)).toBe(JSON.stringify(a));
    expect(shuffled.manifest_sha256).toBe(a.manifest_sha256);
    const { manifest_sha256: hash, ...body } = a;
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).toBe(sha256(stableJson(body)));
    expect(a.manifest_version).toBe(1);
    expect(a.frame).toEqual({ width: 1920, height: 1080, fps: 30 });
    expect(a.edit).toEqual({ version_id: 'v1', snapshot_sha256: 'f'.repeat(64), edit_revision: '7', script_revision: VERSION.script_revision, script_seq: '3' });
  });

  test('AC 1 the builder does not change what it is given', () => {
    const given = input();
    const before = clone(given);
    rm.buildManifest(given);
    expect(given).toEqual(before);
  });

  test('AC 2 any one change to the saved edit changes the hash: a layout value, an offset, a caption, a trim, the version', () => {
    const base = rm.buildManifest(input()).manifest_sha256;
    const changed = (mutate) => { const e = rich(); mutate(e); return rm.buildManifest(input({ edit: e })).manifest_sha256; };
    const hashes = [
      changed((e) => { e.pip.default_layout.x = 1301; }),
      changed((e) => { e.items[0].values.layout.w = 801; }),
      changed((e) => { e.items[0].offset_ms = 1500; }),
      changed((e) => { e.items[2].values.text = 'A New Alliance!'; }),
      changed((e) => { e.sceneClips[1].source_in_ms = 501; }),
      changed((e) => { e.segments[0].audio_gain_db = -1; }),
      changed((e) => { e.visibility[0].end_offset_ms = 3100; }),
      rm.buildManifest(input({ version: { ...VERSION, snapshot_sha256: 'e'.repeat(64) } })).manifest_sha256,
      rm.buildManifest(input({ version: { ...VERSION, id: 'v2' } })).manifest_sha256,
    ];
    for (const h of hashes) expect(h).not.toBe(base);
    expect(new Set(hashes).size).toBe(hashes.length);
  });

  test('AC 3 a changed angle URL, a changed cutout key, and a changed approval (id, or its source\'s sha256) each change the hash', () => {
    const base = rm.buildManifest(input()).manifest_sha256;
    const angle = rm.buildManifest(input({ angles: { ...ANGLES, 'angle-c2': { ...ANGLES['angle-c2'], video_clip_url: 'https://cdn.example/a2-regenerated.mp4' } } }));
    const cutout = rm.buildManifest(input({ clips: { ...CLIPS, prime: { ...CLIPS.prime, s3_key_cutout: 'k/prime/cutout-2.webm' } } }));
    const sha = rm.buildManifest(input({ edit: rich({ voiceTakes: { ap1: take({ sha256: 'b'.repeat(64) }) } }) }));
    const e = rich({ voiceTakes: { ap2: take() } });
    e.items[3] = line({ voice_approval_id: 'ap2' });
    const approval = rm.buildManifest(input({ edit: e }));
    const revision = rm.buildManifest(input({ edit: rich({ voiceTakes: { ap1: take({ in_ms: 300 }) } }) }));
    const all = [angle, cutout, sha, approval, revision].map((m) => m.manifest_sha256);
    for (const h of all) expect(h).not.toBe(base);
    expect(new Set(all).size).toBe(all.length);
    expect(angle.assets['angle_video:angle-c2'].url).toBe('https://cdn.example/a2-regenerated.mp4');
    expect(cutout.assets['cutout:prime'].storage_key).toBe('k/prime/cutout-2.webm');
    expect(sha.audio.dialogue[0].sha256).toBe('b'.repeat(64));
    expect(approval.audio.dialogue[0].approval_id).toBe('ap2');
  });

  test('the builder is pure: no clock, no randomness, no environment, no database or network module', () => {
    const code = fs.readFileSync(path.join(__dirname, '../../../src/utils/renderManifest.js'), 'utf8');
    expect(code).not.toMatch(/Date\.now|new Date|Math\.random|process\.env|randomUUID|fetch\(|sequelize/);
    expect([...code.matchAll(/require\('([^']+)'\)/g)].map((m) => m[1])).toEqual(['./editTimeline', '../services/episodeEditService']);
  });
});

describe('the picture (AC 4, 5)', () => {
  const FIXTURES = {
    'the full edit': () => rich(),
    'no PIP, no items': () => rich({ segments: [], items: [], visibility: [] }),
    'a locked beat with a gap, and Prime hidden by default': () => rich({ beatDurations: { 1: 8000 }, pip: { default_visible: false, use_cutout: false },
      visibility: [{ id: 'r3', scope: 'range', anchor_kind: 'beat_start', anchor_beat: 2, anchor_ref: null, offset_ms: 100, end_anchor_kind: 'beat_start', end_anchor_beat: 2, end_anchor_ref: null, end_offset_ms: 1234, visible: true }] }),
    'two Prime segments, one over the other': () => rich({ segments: [segment(), segment({ id: 's2', offset_ms: 3333, source_in_ms: 20000, source_out_ms: 22000, audio_in_ms: null, audio_out_ms: null, layout: { x: 10, y: 10, w: 400, h: 225 } })] }),
  };

  test.each(Object.keys(FIXTURES))('AC 4 intervals are layersAt at every frame, sampled one by one: %s', (name) => {
    const edit = FIXTURES[name]();
    const m = rm.buildManifest(input({ edit }));
    const frames = expand(m);
    expect(m.range).toEqual({ start_frame: 0, end_frame: rm.frameCount(tl.beatTimeline(edit).duration), whole: true });
    expect(frames.size).toBe(m.range.end_frame);
    for (let f = 0; f < m.range.end_frame; f += 1) {
      const want = tl.layersAt(edit, tl.frameTime(f)).layers;
      expect([f, frames.get(f).map(bare)]).toEqual([f, want]);
    }
    // Runs are in order, touch, and no two neighbours could have been one.
    let at = 0;
    for (const run of m.intervals) {
      expect(run.start_frame).toBe(at);
      expect(run.end_frame).toBeGreaterThan(run.start_frame);
      at = run.end_frame;
    }
    expect(at).toBe(m.range.end_frame);
  });

  test('AC 4 a range\'s intervals are the same frames of the whole edit', () => {
    const edit = rich();
    const whole = expand(rm.buildManifest(input({ edit })));
    const part = rm.buildManifest(input({ edit, range: { start_ms: 1500, end_ms: 6500 } }));
    expect(part.range).toEqual({ start_frame: 45, end_frame: 195, whole: false });
    const frames = expand(part);
    expect([...frames.keys()]).toEqual(Array.from({ length: 150 }, (_, i) => 45 + i));
    for (const [f, layers] of frames) expect([f, layers]).toEqual([f, whole.get(f)]);
  });

  test('AC 4 the edges fall on the right frames: the held last frame, a visibility rule, a performer and a caption', () => {
    const m = rm.buildManifest(input());
    const frames = expand(m);
    const kinds = (f) => frames.get(f).map((l) => l.kind);
    const starts = m.intervals.map((r) => r.start_frame);
    // The scene video has 4000 ms of source: frame 120 (4000 ms) is its last moving frame, 121 holds it.
    expect(frames.get(120)[0]).toMatchObject({ kind: 'scene', source_time_ms: 4000, held: false });
    expect(frames.get(121)[0]).toMatchObject({ kind: 'scene', source_time_ms: 4000, held: true });
    expect(frames.get(179)[0]).toMatchObject({ kind: 'scene', source_time_ms: 4000, held: true });
    expect(starts).toContain(121);
    // Prime hidden from 2010 ms to 3005 ms: the first frame at or after 2010 is 61 (2033); the first at or after 3005 is 91 (3033).
    expect(kinds(60)).toContain('pip');
    expect(kinds(61)).not.toContain('pip');
    expect(kinds(90)).not.toContain('pip');
    expect(kinds(91)).toContain('pip');
    // The guest from 1490 ms for 3000 ms: frames 45 (1500) to 134 (4467); 4490 is past frame 134 and before 135 (4500).
    expect(kinds(44)).not.toContain('performer');
    expect(frames.get(45).find((l) => l.kind === 'performer')).toMatchObject({ item_id: 'p1', source_time_ms: 1010 });
    expect(kinds(134)).toContain('performer');
    expect(kinds(135)).not.toContain('performer');
    // The title from 250 ms for 2755 ms (to 3005): frames 8 (267) to 90 (3000).
    expect(kinds(7)).not.toContain('caption');
    expect(kinds(8)).toContain('caption');
    expect(kinds(90)).toContain('caption');
    expect(kinds(91)).not.toContain('caption');
    for (const f of [8, 45, 61, 91, 121, 135, 180, 330]) expect([f, starts.includes(f)]).toEqual([f, true]);
    // Beat 3 (from 11 s): the still, Prime hidden by the beat rule.
    expect(frames.get(330)).toEqual([expect.objectContaining({ kind: 'scene', source_kind: 'angle_still', source_time_ms: null, held: false, asset: 'angle_still:angle-c3' })]);
  });

  test('AC 5 layer order and fields are layersAt\'s: scene, performers by layer, PIP, captions; a caption is passed through as it is', () => {
    const edit = rich();
    edit.items.push(item('p2', 'performer_clip', { raw_clip_id: 'lala', source_in_ms: 0, source_out_ms: 3000, layout: { x: 0, y: 0, w: 500, h: 500 }, layer: 0 }, { offset: 1490, duration: 3000 }));
    edit.items.push(item('t2', 'caption', { text: 'Lower', style_key: 'lower_third', layout: { x: 100, y: 900, w: 800, h: 100, opacity: 0.5 } }, { offset: 0, duration: 3000 }));
    const m = rm.buildManifest(input({ edit }));
    const t = tl.frameTime(50);
    const want = tl.layersAt(edit, t).layers;
    const got = expand(m).get(50);
    expect(got.map((l) => [l.kind, l.item_id || l.segment_id || l.clip_id])).toEqual([['scene', 'c1'], ['performer', 'p2'], ['performer', 'p1'], ['pip', 's1'], ['caption', 't1'], ['caption', 't2']]);
    expect(got.map(bare)).toEqual(want);
    // Captions: exactly layersAt's fields, nothing added.
    expect(got.filter((l) => l.kind === 'caption')).toEqual(want.filter((l) => l.kind === 'caption'));
    expect(got[5]).toEqual({ kind: 'caption', item_id: 't2', text: 'Lower', style_key: 'lower_third', layout: { x: 100, y: 900, w: 800, h: 100 }, opacity: 0.5 });
    // What the manifest adds to a picture layer: its file, how it fits, and for the scene the full frame.
    expect(got[0]).toMatchObject({ asset: 'raw_clip:lala', media: 'original', fit: 'cover', layout: { x: 0, y: 0, w: 1920, h: 1080 }, opacity: 1 });
    expect(got[1]).toMatchObject({ asset: 'cutout:lala', media: 'cutout', fit: 'contain', held: false, layer: 0 });
    expect(got[2]).toMatchObject({ asset: 'raw_clip:guest', media: 'original', fit: 'cover', held: false, layer: 1, opacity: 0.9 });
    expect(got[3]).toMatchObject({ asset: 'cutout:prime', media: 'cutout', fit: 'contain', layout: { x: 1300, y: 700, w: 540, h: 304 }, opacity: 0.8 });
    // Every layer's file is in the manifest's assets.
    for (const run of m.intervals) for (const l of run.layers) if (l.kind !== 'caption') expect(m.assets[l.asset]).toBeDefined();
  });
});

describe('the sound (AC 7, 8, 13)', () => {
  test('AC 7 footage is always empty; commentary and dialogue are two lists; music is in neither', () => {
    const m = rm.buildManifest(input({ edit: rich({ audioItems: [music()] }) }));
    expect(m.audio.footage).toEqual([]);
    expect(rm.buildManifest(input({ edit: rich({ segments: [], items: [] }) })).audio.footage).toEqual([]);
    expect(m.audio.commentary).toEqual([expect.objectContaining({ kind: 'commentary', segment_id: 's1', raw_clip_id: 'prime', asset: 'raw_clip:prime', timeline_start_ms: 0, timeline_end_ms: 15000 })]);
    expect(m.audio.dialogue).toEqual([expect.objectContaining({
      kind: 'dialogue', item_id: 'd1', approval_id: 'ap1', association_id: 'as1', beat: 1, line_index: 0, asset: 'voice_source:src1', s3_key: 'voice/src1.wav', sha256: 'a'.repeat(64),
      source_kind: 'uploaded', lineage: null, timeline_start_ms: 7000, timeline_end_ms: 9000, source_start_ms: 200, source_end_ms: 2200, envelope_start_ms: 7000, envelope_end_ms: 9000,
    })]);
    expect(m.audio.target).toEqual({ integrated_lufs: -14, true_peak_dbtp: -1 });
    // The scene and the performers are takes with sound of their own: none of it is in the mix.
    const heard = [...m.audio.commentary, ...m.audio.dialogue].map((e) => e.asset);
    expect(heard).toEqual(['raw_clip:prime', 'voice_source:src1']);
  });

  test('AC 7 commentary over dialogue is in overlaps and a warning commentary_over_dialogue; both events are whole', () => {
    const m = rm.buildManifest(input());
    expect(m.audio.overlaps).toEqual([{ commentary: 's1', dialogue: 'd1', start_ms: 7000, end_ms: 9000 }]);
    expect(m.readiness.technical.warnings).toContainEqual({ code: 'commentary_over_dialogue', commentary: 's1', dialogue: 'd1', start_ms: 7000, end_ms: 9000 });
    expect(codes(m.readiness.technical.blocking)).not.toContain('commentary_over_dialogue');
    const quiet = rm.buildManifest(input({ edit: rich({ segments: [segment({ audio_muted: true })] }) }));
    expect(quiet.audio.overlaps).toEqual([]);
    // Neither event is cut, ducked or muted by the overlap: the same events as the plain mix plan.
    const mix = tl.mixPlan(rich());
    expect(m.audio.commentary[0]).toMatchObject(mix.commentary[0]);
    expect(m.audio.dialogue[0]).toMatchObject(mix.dialogue[0]);
  });

  test('AC 8 an approval that is no longer current plays nothing and blocks; no other take stands in', () => {
    const stale = rich({ voiceTakes: {
      ap1: take({ playable: false, state: 'superseded', reason: null }),
      ap9: take({ source_asset_id: 'src9', s3_key: 'voice/src9.wav', sha256: 'c'.repeat(64) }),
    } });
    const m = rm.buildManifest(input({ edit: stale }));
    expect(m.audio.dialogue).toEqual([]);
    expect(Object.keys(m.assets).filter((k) => k.startsWith('voice_source:'))).toEqual([]);
    expect(JSON.stringify(m.audio)).not.toContain('src9');
    expect(m.readiness.technical.blocking).toContainEqual({ code: 'dialogue_take_not_current', ref: 'd1', beat: 1, line_index: 0, approval_id: 'ap1', state: 'superseded', reason: null, current_approval_id: 'ap9' });
    expect(m.readiness.technical.ready).toBe(false);
    // An approval the edit names and Voice Studio no longer has at all.
    const gone = rm.buildManifest(input({ edit: rich({ voiceTakes: {} }) }));
    expect(gone.audio.dialogue).toEqual([]);
    expect(gone.readiness.technical.blocking).toContainEqual(expect.objectContaining({ code: 'dialogue_take_not_current', state: 'not_found' }));
  });

  describe('AC 13 a line cut from a take that is on screen sits where the take shows it (placement)', () => {
    // Lala's take is beat 1's scene from 1000 ms of its source. The line is cut from that take at 3000 ms, and trimmed 200 ms in:
    // it is on its source when it starts where the scene shows 3200 ms, which is 2200 ms on the edit.
    const lineage = { source_kind: 'extracted', source_raw_clip_id: 'lala', source_in_ms: 3000, source_out_ms: 6000 };
    const scene = [video('c1', 1, { kind: 'raw_clip', source: 'lala', from: 1000, to: 11000, ms: 10000 })];
    const placedAt = (offset, over = {}, takeOver = lineage) => rm.buildManifest(input({ edit: rich({ sceneClips: scene, items: [line({ offset_ms: offset })], visibility: [], voiceTakes: { ap1: take(takeOver) }, ...over }) }));
    const off = (m) => m.readiness.technical.blocking.filter((f) => f.code === 'dialogue_not_placed_on_source');

    test('exactly on its source, or within a frame of it: no finding', () => {
      const m = placedAt(2200);
      expect(m.audio.dialogue[0].lineage).toEqual({ raw_clip_id: 'lala', source_in_ms: 3000, source_out_ms: 6000 });
      expect(off(m)).toEqual([]);
      expect(off(placedAt(2233))).toEqual([]);
      expect(off(placedAt(2167))).toEqual([]);
    });

    test('five frames off its on-screen source: dialogue_not_placed_on_source, with how far', () => {
      const late = placedAt(2200 + 167);
      expect(off(late)).toEqual([{ code: 'dialogue_not_placed_on_source', item_id: 'd1', raw_clip_id: 'lala', at_ms: 2367, off_by_ms: 167 }]);
      expect(late.readiness.technical.ready).toBe(false);
      expect(off(placedAt(2200 - 167))).toEqual([expect.objectContaining({ off_by_ms: -167 })]);
      expect(off(placedAt(2200 + 34))).toHaveLength(1);
    });

    test('the same check when the take is a performer layer', () => {
      // The performer shows the take from 500 ms of its source at 1000 ms on the edit: the line's source (3200 ms) is on screen at 3700 ms.
      const performer = { sceneClips: [still('c1', 1, 10000)], items: [item('p1', 'performer_clip', { raw_clip_id: 'lala', source_in_ms: 500, source_out_ms: 8500, layout: { x: 0, y: 0, w: 10, h: 10 } }, { offset: 1000, duration: 8000 })] };
      const at = (offset) => placedAt(0, { ...performer, items: [...performer.items, line({ offset_ms: offset })] });
      expect(off(at(3700))).toEqual([]);
      expect(off(at(3700 + 167))).toEqual([expect.objectContaining({ item_id: 'd1', off_by_ms: 167 })]);
    });

    test('no lineage, or a source that is not on screen: nothing is checked', () => {
      expect(off(placedAt(2367, {}, {}))).toEqual([]);
      expect(placedAt(2367, {}, {}).audio.dialogue[0].lineage).toBeNull();
      expect(off(placedAt(2367, { sceneClips: [still('c1', 1, 10000)] }))).toEqual([]);
      expect(off(placedAt(2367, {}, { ...lineage, source_raw_clip_id: 'guest' }))).toEqual([]);
    });

    test('the lineage can come from the voice sources given, by approval or by source', () => {
      const sources = { src1: { source_asset_id: 'src1', s3_key: 'voice/src1.wav', sha256: 'd'.repeat(64), source_kind: 'extracted', lineage: { raw_clip_id: 'lala', source_in_ms: 3000, source_out_ms: 6000 } } };
      const edit = rich({ sceneClips: scene, items: [line({ offset_ms: 2367 })], visibility: [] });
      const m = rm.buildManifest(input({ edit, voiceSources: sources }));
      expect(m.audio.dialogue[0]).toMatchObject({ sha256: 'd'.repeat(64), source_kind: 'extracted' });
      expect(off(m)).toHaveLength(1);
      expect(off(rm.buildManifest(input({ edit, voiceSources: { ap1: { ...sources.src1, lineage: null } } })))).toEqual([]);
    });
  });
});

/**
 * A still picture's transparency (PR 1 correction; Evoni, 2026-11-27):
 * known-transparent, known-opaque and not-established, each from the row as
 * the editor read it. No file is opened and `image/png` decides nothing.
 */
describe("a picture's transparency", () => {
  const picture = (id, over = {}) => ({
    id, storage_key: `overlays/${id}.png`, url_processed: `https://cdn.example/${id}.png`, url_raw: null,
    content_type: null, width: 1920, height: 1080, size_bytes: 4242, sha256: null, metadata: null, ...over,
  });
  /** One overlay on beat 1, naming `id`, with the pictures the service read. */
  const withPicture = (row) => rm.buildManifest(input({
    edit: rich({ items: [...rich().items, item('o1', 'overlay', { asset_id: row.id, layout: { x: 0, y: 0, w: tl.FRAME_W, h: tl.FRAME_H }, fit: 'contain', layer: 0 }, { duration: 1000 })] }),
    images: { [row.id]: row },
  })).assets[`image:${row.id}`];

  test('the drawer of the picture recorded transparency: true', () => {
    // episodeTitleOverlayService draws on a fresh canvas and writes this.
    expect(withPicture(picture('drawn', { metadata: { source: 'episode-title-overlay', transparent: true } })).has_alpha).toBe(true);
  });

  test('a JPEG has no alpha channel to carry: false', () => {
    expect(withPicture(picture('flat', { content_type: 'image/jpeg' })).has_alpha).toBe(false);
    expect(withPicture(picture('flat2', { content_type: 'IMAGE/JPG' })).has_alpha).toBe(false);
  });

  test('otherwise not established: null, and a PNG is never read as transparent or as opaque', () => {
    expect(withPicture(picture('plain', { content_type: 'image/png' })).has_alpha).toBe(null);
    // Every picture the overlay tools make is stored with no content_type:
    // the answer is null, not the "opaque" a type test used to give.
    expect(withPicture(picture('generated')).has_alpha).toBe(null);
    // The upload path writes `transparent` from the file's mimetype, which
    // is the inference this avoids, so its own source is not trusted.
    expect(withPicture(picture('uploaded', { metadata: { source: 'episode-title-overlay-upload', transparent: true } })).has_alpha).toBe(null);
    // A flag without the maker that stands behind it decides nothing.
    expect(withPicture(picture('bare', { metadata: { transparent: true } })).has_alpha).toBe(null);
  });

  test('a picture that is gone is still a missing asset, reported as opaque like every other blank', () => {
    expect(withPicture(picture('lost')).has_alpha).toBe(null);
    const m = rm.buildManifest(input({
      edit: rich({ items: [...rich().items, item('o1', 'overlay', { asset_id: 'gone', layout: { x: 0, y: 0, w: 10, h: 10 }, fit: 'contain', layer: 0 }, { duration: 1000 })] }),
      images: {},
    }));
    expect(m.assets['image:gone']).toMatchObject({ has_alpha: false, url: null, identity: 'weak' });
    expect(m.readiness.technical.blocking.some((f) => f.code === 'asset_missing' && f.asset === 'image:gone')).toBe(true);
  });
});

describe('files and their identity (AC 9 in use, AC 10)', () => {
  test('AC 10 identity tiers: a voice source with its sha256 is strong, a cutout pinned, an original take and an angle weak', () => {
    const m = rm.buildManifest(input());
    expect(Object.fromEntries(Object.entries(m.assets).map(([ref, a]) => [ref, a.identity]))).toEqual({
      'raw_clip:lala': 'weak', 'cutout:lala': 'pinned', 'raw_clip:guest': 'weak', 'cutout:prime': 'pinned', 'raw_clip:prime': 'weak',
      'angle_video:angle-c2': 'weak', 'angle_still:angle-c3': 'weak', 'voice_source:src1': 'strong',
    });
    expect(m.assets['cutout:prime']).toEqual({ kind: 'cutout', record_id: 'prime', storage_key: 'k/prime/cutout-1.webm', url: 'https://cdn.example/prime-cut-1.webm', size_bytes: null, sha256: null, duration_ms: 140000, width: 1920, height: 1080, has_alpha: true, identity: 'pinned' });
    expect(m.assets['raw_clip:guest']).toEqual({ kind: 'raw_clip', record_id: 'guest', storage_key: 'k/guest/original.mp4', url: 'https://cdn.example/guest.mp4', size_bytes: 5, sha256: null, duration_ms: 12500, width: 1280, height: 720, has_alpha: false, identity: 'weak' });
    expect(m.assets['raw_clip:prime'].size_bytes).toBe(123456);
    expect(m.assets['angle_video:angle-c2']).toEqual({ kind: 'angle_video', record_id: 'angle-c2', storage_key: null, url: 'https://cdn.example/a2.mp4', size_bytes: null, sha256: null, duration_ms: null, width: null, height: null, has_alpha: false, identity: 'weak' });
    expect(m.assets['voice_source:src1']).toEqual({ kind: 'voice_source', record_id: 'src1', storage_key: 'voice/src1.wav', url: null, size_bytes: null, sha256: 'a'.repeat(64), duration_ms: 3000, width: null, height: null, has_alpha: false, identity: 'strong' });
    // A voice source with no sha256 is weak.
    expect(rm.buildManifest(input({ edit: rich({ voiceTakes: { ap1: take({ sha256: null }) } }) })).assets['voice_source:src1'].identity).toBe('weak');
  });

  test('AC 10 a preview warns of each weak file (asset_identity_weak) and is not blocked by it; a final is blocked by each (asset_identity_unverified)', () => {
    const weak = ['angle_still:angle-c3', 'angle_video:angle-c2', 'raw_clip:guest', 'raw_clip:lala', 'raw_clip:prime'];
    const preview = rm.buildManifest(input());
    expect(preview.readiness.technical.warnings.filter((f) => f.code === 'asset_identity_weak')).toEqual(weak.map((asset) => ({ code: 'asset_identity_weak', asset })));
    expect(codes(preview.readiness.technical.blocking)).not.toContain('asset_identity_unverified');
    expect(codes(preview.readiness.technical.blocking)).not.toContain('asset_identity_weak');
    const final = rm.buildManifest(input({ purpose: 'final' }));
    expect(final.purpose).toBe('final');
    expect(final.readiness.technical.blocking.filter((f) => f.code === 'asset_identity_unverified')).toEqual(weak.map((asset) => ({ code: 'asset_identity_unverified', asset })));
    expect(codes(final.readiness.technical.warnings)).not.toContain('asset_identity_weak');
    expect(final.readiness.technical.ready).toBe(false);
    // Strong and pinned files are neither.
    for (const f of [...preview.readiness.technical.warnings, ...final.readiness.technical.blocking]) expect(['cutout:prime', 'cutout:lala', 'voice_source:src1']).not.toContain(f.asset);
  });

  test('AC 9 in the manifest: a wanted cutout that is not there blocks a final (cutout_missing); a preview draws the original and warns', () => {
    const clips = { ...CLIPS, prime: { ...CLIPS.prime, key_status: 'processing', s3_key_cutout: null, url_cutout: null }, lala: { ...CLIPS.lala, key_status: 'failed', s3_key_cutout: null, url_cutout: null } };
    const want = [
      { code: 'cutout_missing', layer: 'pip', raw_clip_id: 'prime', segment_id: 's1' },
      { code: 'cutout_missing', layer: 'performer', raw_clip_id: 'lala', item_id: 'p0' },
    ];
    const preview = rm.buildManifest(input({ clips }));
    expect(preview.readiness.technical.warnings.filter((f) => f.code === 'cutout_missing')).toEqual(want);
    expect(codes(preview.readiness.technical.blocking)).not.toContain('cutout_missing');
    expect(Object.keys(preview.assets)).not.toContain('cutout:prime');
    expect(preview.intervals[0].layers.find((l) => l.kind === 'pip')).toMatchObject({ asset: 'raw_clip:prime', media: 'original', fit: 'cover' });
    const final = rm.buildManifest(input({ clips, purpose: 'final' }));
    expect(final.readiness.technical.blocking.filter((f) => f.code === 'cutout_missing')).toEqual(want);
    // The guest was never sent for green removal: drawn as it is, with nothing said.
    expect(JSON.stringify([preview.readiness, final.readiness])).not.toMatch(/"cutout_missing"[^}]*"raw_clip_id":"guest"/);
  });

  test('a take or an angle that is gone is asset_missing, blocking for a preview too', () => {
    const { lala: _gone, ...clips } = CLIPS;
    const m = rm.buildManifest(input({ clips, angles: { ...ANGLES, 'angle-c2': undefined } }));
    expect(m.readiness.technical.blocking.filter((f) => f.code === 'asset_missing')).toEqual([{ code: 'asset_missing', asset: 'angle_video:angle-c2' }, { code: 'asset_missing', asset: 'raw_clip:lala' }]);
    expect(m.assets['raw_clip:lala']).toMatchObject({ kind: 'raw_clip', record_id: 'lala', storage_key: null, url: null });
    expect(m.readiness.technical.ready).toBe(false);
  });
});

describe('ranges and readiness (AC 11, 12)', () => {
  // Beat 1 is complete (a still, Prime over all of it); beat 2 has its scene and no Prime; beats 3-14 are empty.
  const partial = (over = {}) => ({
    fps: 30, beatModes: {}, beatDurations: {}, sceneClips: [still('c1', 1, 10000), still('c3', 2, 10000)],
    segments: [segment({ source_out_ms: 10000, audio_out_ms: 10000, audio_fade_in_ms: 2000, audio_fade_out_ms: 2000 })],
    pip: null, visibility: [], items: [], audioItems: [], lineTimes: {}, voiceTakes: {}, ...over,
  });
  const build = (over = {}) => rm.buildManifest(input({ edit: partial(), ...over }));

  test('AC 11 a preview range over one complete beat is technically ready while other beats are empty', () => {
    const whole = build();
    expect(whole.range).toEqual({ start_frame: 0, end_frame: 600, whole: true });
    expect(whole.readiness.technical.ready).toBe(false);
    expect(codes(whole.readiness.technical.blocking).sort()).toEqual([...Array(12).fill('scene_missing'), 'prime_footage_missing'].sort());
    const beat1 = build({ range: { start_ms: 0, end_ms: 10000 } });
    expect(beat1.range).toEqual({ start_frame: 0, end_frame: 300, whole: false });
    expect(beat1.readiness.technical).toMatchObject({ ready: true, blocking: [], out_of_range: 13 });
    // Beat 2 has no Prime: a range over it is not ready, and says why.
    const beat2 = build({ range: { start_ms: 10000, end_ms: 20000 } });
    expect(beat2.readiness.technical.ready).toBe(false);
    expect(beat2.readiness.technical.blocking).toEqual([{ code: 'prime_footage_missing', beat: 2, from_ms: 10000, to_ms: 20000 }]);
    // A range that only touches the uncovered stretch counts it too.
    expect(build({ range: { start_ms: 9000, end_ms: 10100 } }).readiness.technical.ready).toBe(false);
    // A finding with no time and no beat (an anchor that does not resolve) counts in every range.
    const loose = build({ edit: partial({ segments: [...partial().segments, segment({ id: 's9', anchor_kind: 'item_start', anchor_ref: 'nothing' })] }), range: { start_ms: 0, end_ms: 10000 } });
    expect(loose.readiness.technical.blocking).toEqual([{ code: 'anchor_unresolved', ref: 's9', what: 'segment', reason: 'anchor_missing' }]);
  });

  test('AC 11 how a finding is placed: by its time span when it has one, else by its beat; an empty span is in no range', () => {
    const timeline = tl.beatTimeline(partial());
    expect(rm.findingInRange({ code: 'x', beat: 1, from_ms: 12000, to_ms: 13000 }, timeline, 0, 10000)).toBe(false);
    expect(rm.findingInRange({ code: 'x', beat: 2, from_ms: 9000, to_ms: 9500 }, timeline, 0, 10000)).toBe(true);
    expect(rm.findingInRange({ code: 'x', beat: 2 }, timeline, 0, 10000)).toBe(false);
    expect(rm.findingInRange({ code: 'x', beat: 2 }, timeline, 19999, 20033)).toBe(true);
    expect(rm.findingInRange({ code: 'scene_missing', beat: 3 }, timeline, 10000, 20000)).toBe(false);
    expect(rm.findingInRange({ code: 'x', ref: 'r' }, timeline, 0, 10)).toBe(true);
  });

  test('AC 11 an audio event the range cuts mid-fade keeps its envelope', () => {
    const m = build({ range: { start_ms: 1000, end_ms: 9000 } });
    expect(m.audio.commentary).toEqual([expect.objectContaining({ segment_id: 's1', timeline_start_ms: 1000, timeline_end_ms: 9000, source_start_ms: 1000, source_end_ms: 9000,
      envelope_start_ms: 0, envelope_end_ms: 10000, fade_in_ms: 2000, fade_out_ms: 2000 })]);
    // A range that starts off the frame grid is cut on it, picture and sound together.
    const off = build({ range: { start_ms: 1010, end_ms: 9010 } });
    expect(off.range).toEqual({ start_frame: 30, end_frame: 270, whole: false });
    expect(off.audio.commentary[0]).toMatchObject({ timeline_start_ms: 1000, timeline_end_ms: 9000 });
  });

  test('AC 11 a ranged final is blocked (final_requires_whole_edit), and every finding counts for it', () => {
    const m = build({ purpose: 'final', range: { start_ms: 0, end_ms: 10000 } });
    expect(m.readiness.technical.ready).toBe(false);
    expect(m.readiness.technical.blocking).toContainEqual({ code: 'final_requires_whole_edit' });
    expect(codes(m.readiness.technical.blocking)).toContain('scene_missing');
    expect(m.readiness.technical.out_of_range).toBe(0);
    expect(codes(build({ purpose: 'final' }).readiness.technical.blocking)).not.toContain('final_requires_whole_edit');
  });

  test('a range is read in ms; a bad one is refused (BAD_RANGE); no range, or one over everything, is the whole edit', () => {
    for (const range of [undefined, {}, { start_ms: undefined, end_ms: undefined }, { start_ms: '', end_ms: '' }, { start_ms: '0', end_ms: '20000' }, { start_ms: 0, end_ms: 999999 }]) {
      expect(build({ range }).range).toEqual({ start_frame: 0, end_frame: 600, whole: true });
    }
    expect(build({ range: { start_ms: '5000' } }).range).toEqual({ start_frame: 150, end_frame: 600, whole: false });
    for (const range of [{ start_ms: 'x' }, { end_ms: -1 }, { start_ms: 5000, end_ms: 5000 }, { start_ms: 6000, end_ms: 5000 }, { start_ms: 30000 }, { start_ms: 0, end_ms: 5 }]) {
      expect(() => build({ range })).toThrow(expect.objectContaining({ code: 'BAD_RANGE' }));
    }
    // An edit with nothing in it is a whole edit of no frames.
    const empty = build({ edit: partial({ sceneClips: [], segments: [] }) });
    expect(empty).toMatchObject({ range: { start_frame: 0, end_frame: 0, whole: true }, intervals: [], assets: {} });
  });

  test('AC 12 a placed music item is excluded, a warning, and missing from production; complete is false', () => {
    const m = build({ edit: partial({ audioItems: [music()] }) });
    expect(m.audio.excluded).toEqual([{ item_id: 'm1', track: 'music', asset_ref: 'lib:bed', slot: null, timeline_start_ms: 1000, timeline_end_ms: 5000, reason: 'unresolved_asset' }]);
    expect(m.readiness.technical.warnings).toContainEqual({ code: 'audio_item_excluded', item_id: 'm1', track: 'music' });
    expect(m.readiness.production.missing).toContainEqual(expect.objectContaining({ what: 'music', item_id: 'm1' }));
    expect(m.readiness.production.not_assessed.map((n) => n.what)).not.toContain('music');
    expect(m.readiness.production.not_assessed.map((n) => n.what)).toContain('sfx');
    expect(m.readiness.production.complete).toBe(false);
    expect(JSON.stringify([m.audio.commentary, m.audio.dialogue])).not.toContain('m1');
    // An SFX item the same way; one outside the range is not in this range's excluded list and is still missing.
    const sfx = build({ edit: partial({ audioItems: [music({ id: 'x1', track: 'sfx', asset_ref: null, slot: 'door', offset_ms: 15000 })] }), range: { start_ms: 0, end_ms: 10000 } });
    expect(sfx.audio.excluded).toEqual([]);
    expect(sfx.readiness.production.missing).toContainEqual(expect.objectContaining({ what: 'sfx', item_id: 'x1' }));
    expect(sfx.readiness.production.not_assessed.map((n) => n.what)).toEqual(expect.arrayContaining(['music']));
  });

  test('AC 12 no music placed: not assessed, never complete; coverage that was not read is not assessed', () => {
    const m = build();
    expect(m.audio.excluded).toEqual([]);
    expect(m.readiness.production.not_assessed).toEqual([
      { what: 'music', why: 'no record says whether this episode needs music' },
      { what: 'sfx', why: 'no record says whether this episode needs SFX' },
      { what: 'coverage', why: 'the production coverage could not be read' },
    ]);
    expect(m.readiness.production.complete).toBe(false);
  });

  test('AC 12 technically ready never means production complete', () => {
    const m = build({ range: { start_ms: 0, end_ms: 10000 } });
    expect(m.readiness.technical.ready).toBe(true);
    expect(m.readiness.production.complete).toBe(false);
    // Even with every beat's coverage met: music and SFX are still not assessed.
    const met = { beats: [{ number: 1, name: 'Opening', covered: true, indicators: { environment: { requirement: 'required', met: true, text: null }, host: { requirement: 'not_required', met: null, text: null } } }] };
    const covered = build({ range: { start_ms: 0, end_ms: 10000 }, coverage: met });
    expect(covered.readiness.technical.ready).toBe(true);
    expect(covered.readiness.production).toEqual({ complete: false, missing: [], not_assessed: [expect.objectContaining({ what: 'music' }), expect.objectContaining({ what: 'sfx' })] });
    // complete is exactly "nothing missing and nothing left unassessed".
    for (const x of [m, covered, build({ edit: partial({ audioItems: [music(), music({ id: 'x1', track: 'sfx' })] }), coverage: met })]) {
      expect(x.readiness.production.complete).toBe(x.readiness.production.missing.length === 0 && x.readiness.production.not_assessed.length === 0);
      expect(x.readiness.production.complete).toBe(false);
    }
  });

  test('AC 12 production missing: draft Prime segments, items nothing renders, lines with no approved take, coverage not met', () => {
    const kinds = rm.NOT_RENDERED;
    expect(kinds).toEqual(['object_keyframe', 'camera_keyframe', 'object_visibility', 'angle_change', 'transition', 'audio_offset', 'caption_override']);
    const items = kinds.map((kind, i) => item(`i${i}`, kind, null, { beat: i < 4 ? 1 : 2, offset: 100 }));
    const edit = partial({ items, segments: [segment({ source_out_ms: 10000, audio_out_ms: 10000, status: 'draft' })] });
    const coverage = computeCoverage({ planRows: [], readiness: null, overlays: 'off', clips: null });
    const findings = [...tl.editFindings(edit), { code: 'line_audio_unapproved', severity: 'blocking', beat: 2, line_index: 0, speaker: 'Lala', words: 'Hi' }];
    const m = rm.buildManifest(input({ edit, coverage, findings }));
    expect(m.readiness.technical.warnings.filter((f) => f.code === 'item_not_rendered')).toEqual(kinds.map((kind, i) => ({ code: 'item_not_rendered', item_id: `i${i}`, kind })));
    const missing = m.readiness.production.missing;
    expect(missing.filter((x) => x.what === 'item').map((x) => [x.item_id, x.kind])).toEqual(kinds.map((kind, i) => [`i${i}`, kind]));
    expect(missing).toContainEqual({ what: 'prime_segment', segment_id: 's1', why: 'still a draft' });
    expect(missing).toContainEqual({ what: 'line_audio', beat: 2, line_index: 0, why: 'no current approved take' });
    expect(m.readiness.technical.blocking).toContainEqual({ code: 'line_audio_unapproved', beat: 2, line_index: 0, speaker: 'Lala', words: 'Hi' });
    // Coverage, as computeCoverage answers: a required indicator that is not met is missing; one that could not be
    // checked, and one decided per episode, are not assessed.
    const required = coverage.beats.flatMap((b) => Object.entries(b.indicators).filter(([, s]) => s.requirement === 'required').map(([k, s]) => [b.number, k, s.met]));
    expect(missing.filter((x) => x.what === 'coverage').map((x) => [x.beat, x.indicator])).toEqual(required.filter(([, , met]) => met === false).map(([b, k]) => [b, k]));
    const unassessed = m.readiness.production.not_assessed.filter((x) => x.what === 'coverage');
    expect(unassessed.map((x) => [x.beat, x.indicator])).toEqual(expect.arrayContaining(required.filter(([, , met]) => met === null).map(([b, k]) => [b, k])));
    expect(unassessed).toContainEqual({ what: 'coverage', beat: 1, indicator: 'environment', why: 'decided per episode; no record says whether this episode needs it' });
    expect(missing.filter((x) => x.what === 'coverage').length).toBeGreaterThan(0);
    // In a ranged preview only the items inside the range are warned of; all of them stay missing.
    const part = rm.buildManifest(input({ edit, coverage, range: { start_ms: 0, end_ms: 10000 } }));
    expect(part.readiness.technical.warnings.filter((f) => f.code === 'item_not_rendered').map((f) => f.item_id)).toEqual(['i0', 'i1', 'i2', 'i3']);
    expect(part.readiness.production.missing.filter((x) => x.what === 'item')).toHaveLength(7);
  });
});

describe('what the manifest does not touch (AC 16)', () => {
  const ROOT = path.join(__dirname, '../../..');
  const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');

  test('AC 16 no schema of its own: no migration names the manifest, and its code holds no DDL and no write', () => {
    const migrations = fs.readdirSync(path.join(ROOT, 'src/migrations'));
    expect(migrations.filter((f) => /manifest/i.test(f) || /render_?manifest/i.test(read(`src/migrations/${f}`)))).toEqual([]);
    expect(fs.readdirSync(path.join(ROOT, 'src/models')).filter((f) => /manifest/i.test(f))).toEqual([]);
    for (const f of ['src/utils/renderManifest.js', 'src/services/renderManifestService.js']) {
      const code = read(f);
      expect(code).not.toMatch(/\b(INSERT\s+INTO|UPDATE\s+\w+\s+SET|DELETE\s+FROM|CREATE\s+TABLE|ALTER\s+TABLE|DROP\s+TABLE|TRUNCATE)\b/i);
      expect(code).not.toMatch(/\.(sync|create|update|destroy|upsert|bulkCreate)\(/);
      expect(code).not.toMatch(/child_process|client-s3|axios|fetch\(|enqueue|spawn|execFile/);
    }
    // All the service loads: the edit's service, the pure builder, Sequelize's isolation levels, and the coverage read with its models.
    expect([...read('src/services/renderManifestService.js').matchAll(/require\('([^']+)'\)/g)].map((m) => m[1]).sort())
      .toEqual(['../models', '../utils/renderManifest', './episodeEditService', './productionCoverageService', 'sequelize']);
    expect(read('src/services/renderManifestService.js')).toMatch(/SET TRANSACTION READ ONLY/);
  });

  test('AC 16 the working preview is as it was: previewPlan keeps its own snapToFrame and names nothing of the manifest; no page calls the route', () => {
    const preview = read('frontend/src/lib/previewPlan.js');
    expect(preview).toMatch(/export const snapToFrame = \(ms\) => Math\.round\(\(Math\.round\(\(Number\(ms\) \|\| 0\) \* FPS \/ 1000\) \* 1000\) \/ FPS\);/);
    expect(preview).toMatch(/import \{ layoutAt, layersAt, DEFAULT_LAYOUT \} from '\.\/editTimeline';/);
    expect(preview).not.toMatch(/manifest|mediaChoice|audioOverlaps|frameOf|frameTime/i);
    const walk = (dir) => fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? (e.name === 'node_modules' ? [] : walk(`${dir}/${e.name}`)) : [`${dir}/${e.name}`]));
    const callers = walk('frontend/src').filter((f) => /\.(jsx?|tsx?)$/.test(f) && /versions\/[^'"`]*\/manifest|renderManifest/.test(read(f)));
    expect(callers).toEqual([]);
  });
});
