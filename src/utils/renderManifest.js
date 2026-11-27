'use strict';

/**
 * The render manifest of a saved edit version (Evoni, 2026-11-16; the first
 * step of the render): one JSON document that says what to draw and what to
 * play for a range of frames. Pure: no database, no network, no clock, no
 * randomness. The same input gives the same manifest and the same
 * manifest_sha256; a change to the saved edit or to a file it resolves to
 * (an angle's URL, a cutout's key, an approval or its source's sha256) gives
 * another. Nothing here renders, stores or queues anything.
 *
 * The picture: layersAt sampled at every frame's time (30 fps), kept as runs
 * of frames with the same layers. Inside a run a layer with a source time
 * that is not held plays on with the clock: at frame f it shows
 * source_time_ms + frameTime(f) - frameTime(start_frame). A held layer and a
 * still stay where they are.
 *
 * The sound: Prime's commentary and the dialogue, as two lists, from mixPlan
 * cut to the range. Footage sound is never mixed (footage is always empty).
 * Music and SFX have no files yet, so each placed one is listed as excluded,
 * never replaced. Commentary over dialogue is reported, never changed.
 *
 * Readiness is two answers, never one. Technical: can this range be drawn and
 * played from what is saved. Production: is the episode's material all there
 * (missing, not_assessed, complete). A technically ready manifest says
 * nothing about production: complete is true only when nothing is missing
 * and nothing is left unassessed.
 *
 * Which findings count for a ranged preview: a finding with a time span
 * (from_ms and to_ms) counts when that span overlaps the range; one with
 * only a beat counts when the beat's span (beatTimeline) overlaps the range;
 * one with neither (an anchor that does not resolve) always counts, since it
 * cannot be placed outside it. A span of no length (an empty beat) has no
 * frame, so it is in no range. A whole-edit manifest and a final count every
 * finding.
 */

const tl = require('./editTimeline');
const { stableJson, sha256 } = require('../services/episodeEditService');

const MANIFEST_VERSION = 1;
const TARGET = Object.freeze({ integrated_lufs: -14, true_peak_dbtp: -1 });
// Item kinds that are stored and that nothing draws or plays yet.
const NOT_RENDERED = ['object_keyframe', 'camera_keyframe', 'object_visibility', 'angle_change', 'transition', 'audio_offset', 'caption_override'];
const TRACKS = ['music', 'sfx'];

const bad = (message) => Object.assign(new Error(message), { code: 'BAD_RANGE' });
const num = (v) => (v == null || !Number.isFinite(Number(v)) ? null : Number(v));

/** How many frames have their time inside an edit of this length. */
function frameCount(durationMs) {
  let f = tl.frameOf(durationMs);
  while (tl.frameTime(f) < durationMs) f += 1;
  while (f > 0 && tl.frameTime(f - 1) >= durationMs) f -= 1;
  return f;
}

/** The asked range in frames: { start_frame, end_frame, whole }. No range is the whole edit. */
function rangeOf(range, durationMs) {
  const total = frameCount(durationMs);
  const read = (v, what) => {
    if (v === undefined || v === null || v === '') return null;
    const n = Number(v);
    if (!Number.isFinite(n) || n < 0) throw bad(`${what} must be a time in milliseconds, 0 or more`);
    return n;
  };
  const from = read(range && range.start_ms, 'from');
  const to = read(range && range.end_ms, 'to');
  if (from != null && to != null && to <= from) throw bad('to must be after from');
  const start = Math.min(from == null ? 0 : tl.frameOf(from), total);
  const end = Math.max(start, Math.min(to == null ? total : tl.frameOf(to), total));
  const whole = start === 0 && end === total;
  if (!whole && end === start) throw bad('The range holds no frame of this edit');
  return { start_frame: start, end_frame: end, whole };
}

/**
 * The files the manifest names, each once, by a ref of its kind and record.
 * Identity: a voice source with its sha256 is strong; a cutout is pinned (its
 * key is one green-removal run's own); an original take and a scene angle
 * are weak (nothing stored says the file is still the one that was placed).
 */
function assetBook({ clips = {}, angles = {}, images = {} }) {
  const assets = {};
  const missing = new Set();
  const put = (ref, entry, found) => {
    if (!assets[ref]) {
      assets[ref] = entry;
      if (!found) missing.add(ref);
    }
    return ref;
  };
  const blank = { storage_key: null, url: null, size_bytes: null, sha256: null, duration_ms: null, width: null, height: null, has_alpha: false };
  return {
    assets,
    missing,
    rawClip(id, use) {
      const c = clips[id] || null;
      const shared = { record_id: id, duration_ms: c && c.duration_seconds != null ? Math.round(Number(c.duration_seconds) * 1000) : null, width: num(c && c.width), height: num(c && c.height) };
      if (use === 'cutout') {
        return put(`cutout:${id}`, { ...blank, kind: 'cutout', ...shared, storage_key: (c && c.s3_key_cutout) || null, url: (c && c.url_cutout) || null, has_alpha: true, identity: 'pinned' },
          Boolean(c && (c.s3_key_cutout || c.url_cutout)));
      }
      return put(`raw_clip:${id}`, { ...blank, kind: 'raw_clip', ...shared, storage_key: (c && c.s3_key_raw) || null, url: (c && c.url_raw) || null, size_bytes: num(c && c.file_size_bytes), identity: 'weak' },
        Boolean(c && (c.s3_key_raw || c.url_raw)));
    },
    angle(kind, id) {
      const a = angles[id] || null;
      const url = (a && (kind === 'angle_video' ? a.video_clip_url : a.still_image_url)) || null;
      return put(`${kind}:${id}`, { ...blank, kind, record_id: id, url, identity: 'weak' }, Boolean(url));
    },
    /**
     * A still picture (PR 1): the episode's title overlay, an invitation, a
     * rendered phone screen. Pinned, as a cutout is: the row carries the
     * file's hash, so a replaced file gives another manifest rather than
     * passing silently. A picture that is gone resolves to nothing and is
     * reported as a missing asset, the same way a take is.
     */
    image(id) {
      const a = images[id] || null;
      const url = (a && (a.url_processed || a.url_raw)) || null;
      return put(`image:${id}`, {
        ...blank,
        kind: 'image',
        record_id: id,
        storage_key: (a && a.storage_key) || null,
        url,
        sha256: (a && a.sha256) || null,
        size_bytes: num(a && a.size_bytes),
        width: num(a && a.width),
        height: num(a && a.height),
        has_alpha: Boolean(a && a.content_type === 'image/png'),
        identity: a && a.sha256 ? 'pinned' : 'weak',
      }, Boolean(url || (a && a.storage_key)));
    },
    voice(source) {
      const id = source.source_asset_id || null;
      return put(`voice_source:${id}`, { ...blank, kind: 'voice_source', record_id: id, storage_key: source.s3_key || null, sha256: source.sha256 || null, duration_ms: num(source.duration_ms),
        identity: source.sha256 ? 'strong' : 'weak' }, Boolean(source.s3_key));
    },
  };
}

/** Whether a finding counts for [from, to) (the rule is in the header). */
function findingInRange(f, timeline, from, to) {
  const overlaps = (a, b) => a < to && b > from;
  if (Number.isFinite(f.from_ms) && Number.isFinite(f.to_ms)) return overlaps(f.from_ms, f.to_ms);
  const beat = f.beat == null ? null : timeline.beats.find((b) => b.beat === f.beat);
  if (beat) return overlaps(beat.start, beat.end);
  return true;
}

/** What the coverage answer (productionCoverageService) says is not met, and what it could not check. */
function coverageStates(coverage) {
  const missing = [];
  const notAssessed = [];
  if (!coverage || !Array.isArray(coverage.beats)) return { missing, notAssessed: [{ what: 'coverage', why: 'the production coverage could not be read' }] };
  for (const beat of coverage.beats) {
    for (const [indicator, state] of Object.entries(beat.indicators || {})) {
      const entry = { what: 'coverage', beat: beat.number, indicator, why: state.text || null };
      if (state.requirement === 'required' && state.met === false) missing.push(entry);
      else if (state.requirement === 'required' && state.met !== true) notAssessed.push(entry);
      // per_episode: the beat may need it, and no record says whether this episode does.
      else if (state.requirement === 'per_episode') notAssessed.push({ ...entry, why: 'decided per episode; no record says whether this episode needs it' });
    }
  }
  return { missing, notAssessed };
}

function buildManifest(input) {
  const purpose = input.purpose === 'final' ? 'final' : 'preview';
  const { edit } = input;
  const clips = input.clips || {};
  const voiceSources = input.voiceSources || {};
  const version = input.version || {};
  const timeline = tl.beatTimeline(edit);
  const placed = tl.placedSegments(edit, timeline);
  const range = rangeOf(input.range, timeline.duration);
  const fromMs = tl.frameTime(range.start_frame);
  const toMs = range.whole ? timeline.duration : Math.min(timeline.duration, tl.frameTime(range.end_frame));
  const book = assetBook({ clips, angles: input.angles || {}, images: input.images || {} });
  const blocking = [];
  const warnings = [];

  // ── The picture ──
  const choices = new Map();
  const layerOf = (l) => {
    if (l.kind === 'caption') return { ...l };
    // A still picture keeps the box, opacity and fit the edit gave it; the
    // only thing added is the file it resolves to. No media choice is made:
    // a picture has one file, unlike a take with its cutout.
    if (l.kind === 'overlay') return { ...l, asset: book.image(l.asset_id), media: 'original' };
    if (l.kind === 'scene') {
      const asset = l.source_kind === 'raw_clip' ? book.rawClip(l.source_id, 'original') : book.angle(l.source_kind, l.source_id);
      return { ...l, asset, media: 'original', layout: { x: 0, y: 0, w: tl.FRAME_W, h: tl.FRAME_H }, fit: 'cover' };
    }
    const choice = tl.mediaChoice({ purpose, layer: l.kind, useCutout: l.kind === 'pip' ? l.cutout : undefined, clip: clips[l.raw_clip_id] || null });
    const key = `${l.kind}:${l.kind === 'pip' ? l.segment_id : l.item_id}`;
    if (choice.reason && !choices.has(key)) {
      choices.set(key, { blocked: choice.blocked, finding: { code: choice.reason, layer: l.kind, raw_clip_id: l.raw_clip_id, ...(l.kind === 'pip' ? { segment_id: l.segment_id } : { item_id: l.item_id }) } });
    }
    return { ...l, asset: book.rawClip(l.raw_clip_id, choice.use), media: choice.use, held: false, fit: choice.use === 'cutout' ? 'contain' : 'cover' };
  };
  const running = (l) => l.source_time_ms != null && !l.held;
  const intervals = [];
  let last = null;
  for (let f = range.start_frame; f < range.end_frame; f += 1) {
    const t = tl.frameTime(f);
    const layers = tl.layersAt(edit, t, timeline, placed).layers.map(layerOf);
    // Two frames belong to one run when their layers match and each running source keeps step with the clock.
    const shape = stableJson(layers.map((l) => (running(l) ? { ...l, source_time_ms: l.source_time_ms - t } : l)));
    if (shape === last) intervals[intervals.length - 1].end_frame = f + 1;
    else intervals.push({ start_frame: f, end_frame: f + 1, layers });
    last = shape;
  }
  for (const c of choices.values()) (c.blocked ? blocking : warnings).push(c.finding);

  // ── The sound ──
  const mix = tl.mixPlan(edit, timeline, placed, { start_ms: fromMs, end_ms: toMs });
  const commentary = mix.commentary.map((ev) => ({ ...ev, asset: book.rawClip(ev.raw_clip_id, 'original') }));
  const dialogue = mix.dialogue.map((ev) => {
    const take = (edit.voiceTakes && edit.voiceTakes[ev.approval_id]) || {};
    const row = voiceSources[ev.approval_id] || voiceSources[ev.source_asset_id] || take;
    const source = {
      source_asset_id: row.source_asset_id || ev.source_asset_id, s3_key: row.s3_key || ev.s3_key || null, sha256: row.sha256 || null,
      duration_ms: row.duration_ms != null ? row.duration_ms : row.source_duration_ms,
    };
    let lineage = row.lineage === undefined ? null : row.lineage;
    if (row.lineage === undefined && row.source_raw_clip_id) lineage = { raw_clip_id: row.source_raw_clip_id, source_in_ms: row.source_in_ms, source_out_ms: row.source_out_ms };
    return { ...ev, asset: book.voice(source), s3_key: source.s3_key, sha256: source.sha256, source_kind: row.source_kind || null, lineage: lineage || null };
  });
  const excluded = mix.audio.map((ev) => ({ item_id: ev.item_id, track: ev.kind, asset_ref: ev.asset_ref, slot: ev.slot, timeline_start_ms: ev.timeline_start_ms, timeline_end_ms: ev.timeline_end_ms, reason: 'unresolved_asset' }));
  for (const x of excluded) warnings.push({ code: 'audio_item_excluded', item_id: x.item_id, track: x.track });
  const overlaps = tl.audioOverlaps(mix);
  for (const o of overlaps) warnings.push({ code: 'commentary_over_dialogue', ...o });

  // Placement on the source: a line cut from a take that is on screen while the line plays must sit
  // where the take shows it, within one frame. A line with no such source is not checked.
  for (const ev of dialogue) {
    if (!ev.lineage) continue;
    const shows = (l) => (l.kind === 'scene' && l.source_kind === 'raw_clip' && String(l.source_id) === String(ev.lineage.raw_clip_id))
      || (l.kind === 'performer' && String(l.raw_clip_id) === String(ev.lineage.raw_clip_id));
    const times = [ev.timeline_start_ms];
    for (let f = tl.frameOf(ev.timeline_start_ms); tl.frameTime(f) < ev.timeline_end_ms; f += 1) if (tl.frameTime(f) > ev.timeline_start_ms) times.push(tl.frameTime(f));
    for (const t of times) {
      const layer = tl.layersAt(edit, t, timeline, placed).layers.find(shows);
      if (!layer) continue;
      const off = layer.source_time_ms - (ev.lineage.source_in_ms + tl.sourceTimeAt(ev, t));
      if (Math.abs(off) > tl.GAP_TOLERANCE_MS) blocking.push({ code: 'dialogue_not_placed_on_source', item_id: ev.item_id, raw_clip_id: ev.lineage.raw_clip_id, at_ms: t, off_by_ms: off });
      break;
    }
  }

  // ── Items nothing renders ──
  const unrendered = (edit.items || []).filter((i) => NOT_RENDERED.includes(i.kind));
  for (const item of unrendered) {
    const r = tl.resolveAnchor(edit, timeline, item);
    if (range.whole || r.error || (r.t >= fromMs && r.t < toMs)) warnings.push({ code: 'item_not_rendered', item_id: item.id, kind: item.kind });
  }

  // ── The edit's own findings, for this range ──
  const findings = Array.isArray(input.findings) ? input.findings : tl.editFindings(edit);
  const scoped = purpose === 'preview' && !range.whole;
  let outOfRange = 0;
  for (const f of findings) {
    if (scoped && !findingInRange(f, timeline, fromMs, toMs)) { outOfRange += 1; continue; }
    const { severity, ...rest } = f;
    (severity === 'blocking' ? blocking : warnings).push(rest);
  }

  // ── The files ──
  for (const ref of Object.keys(book.assets).sort()) {
    if (book.missing.has(ref)) blocking.push({ code: 'asset_missing', asset: ref });
    else if (book.assets[ref].identity === 'weak') (purpose === 'final' ? blocking : warnings).push({ code: purpose === 'final' ? 'asset_identity_unverified' : 'asset_identity_weak', asset: ref });
  }
  if (purpose === 'final' && !range.whole) blocking.push({ code: 'final_requires_whole_edit' });

  // ── Production: the whole episode, whatever the range ──
  const missing = [];
  const notAssessed = [];
  for (const a of edit.audioItems || []) missing.push({ what: a.track, item_id: a.id, why: 'placed, with no file to play: it is not rendered' });
  for (const item of unrendered) missing.push({ what: 'item', item_id: item.id, kind: item.kind, why: 'nothing renders this kind yet' });
  for (const seg of edit.segments || []) if (seg.status === 'draft') missing.push({ what: 'prime_segment', segment_id: seg.id, why: 'still a draft' });
  for (const f of findings) if (f.code === 'line_audio_unapproved') missing.push({ what: 'line_audio', beat: f.beat, line_index: f.line_index, why: 'no current approved take' });
  for (const track of TRACKS) {
    if (!(edit.audioItems || []).some((a) => a.track === track)) notAssessed.push({ what: track, why: `no record says whether this episode needs ${track === 'sfx' ? 'SFX' : track}` });
  }
  const covered = coverageStates(input.coverage);
  missing.push(...covered.missing);
  notAssessed.push(...covered.notAssessed);

  const manifest = {
    manifest_version: MANIFEST_VERSION,
    purpose,
    episode_id: input.episodeId || null,
    edit: {
      version_id: version.id || null, snapshot_sha256: version.snapshot_sha256 || null, edit_revision: version.edit_revision == null ? null : String(version.edit_revision),
      script_revision: version.script_revision || null, script_seq: version.script_seq == null ? null : String(version.script_seq),
    },
    frame: { width: tl.FRAME_W, height: tl.FRAME_H, fps: tl.FPS },
    range,
    assets: book.assets,
    intervals,
    audio: { commentary, dialogue, footage: [], excluded, overlaps, target: { ...TARGET } },
    readiness: {
      technical: { ready: blocking.length === 0, blocking, warnings, out_of_range: outOfRange },
      production: { complete: missing.length === 0 && notAssessed.length === 0, missing, not_assessed: notAssessed },
    },
  };
  return { ...manifest, manifest_sha256: sha256(stableJson(manifest)) };
}

module.exports = { MANIFEST_VERSION, NOT_RENDERED, TARGET, frameCount, rangeOf, findingInRange, coverageStates, buildManifest };
