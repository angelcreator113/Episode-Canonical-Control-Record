'use strict';

/**
 * The episode edit's clock, layout and mix, worked out from its rows (Timeline
 * C1, Evoni, 2026-10-28; design Revision 6, R2.2, R4.2, R5.1, R5.6). Pure: no
 * database, no clock, no randomness, so the server, the C2 editor and the D1
 * render read the same answer from the same rows.
 *
 * The clock: beats 1-14 in order. A beat lasts as long as its scene clips
 * (each clip's own duration_ms, in position order); a beat with no clip has
 * no length and is the finding scene_missing. Everything else is placed by an
 * anchor plus an offset:
 *   beat_start  the beat's start (anchor_beat)
 *   line_start  a line's time, from edit.lineTimes[anchor_ref] (teleprompter
 *               marks; until those are mapped, unresolved: anchor_unresolved)
 *   item_start  a timeline item's own resolved time (anchor_ref)
 *
 * Prime: one take, one clock (R2.2). A segment plays its source from
 * source_in_ms, placed at its anchor; the commentary is a sub-range of the
 * same source, so at edit time t both read source_in_ms + (t - placement).
 * Hiding the PIP (visibility rules) draws no picture but never touches the
 * commentary; muting never hides the picture (R5.1 E). Coverage of a
 * required beat counts placed video, whatever the visibility or the mute.
 *
 * Shapes (what episodeEditService.loadEdit builds; tests build them directly):
 *   edit = { fps, beatModes: { [beat]: 'required' | 'gameplay_only' },
 *            sceneClips, segments (current only), pip, visibility (in order),
 *            items, audioItems, lineTimes }
 * Times are integer milliseconds; layout is pixels at 1920x1080.
 */

const FRAME_W = 1920;
const FRAME_H = 1080;
const BEATS = Array.from({ length: 14 }, (_, i) => i + 1);
const PIP_WIDTH = Math.round(FRAME_W * 0.28);
const PIP_HEIGHT = Math.round((PIP_WIDTH * 9) / 16);
const PIP_MARGIN = 40;
/** The PIP's default place: bottom right, 28 % of the frame's width (design R4.3). */
const DEFAULT_LAYOUT = Object.freeze({ x: FRAME_W - PIP_WIDTH - PIP_MARGIN, y: FRAME_H - PIP_HEIGHT - PIP_MARGIN, w: PIP_WIDTH, h: PIP_HEIGHT });
/** A gap longer than one frame at 30 fps is a coverage finding (R5.1). */
const GAP_TOLERANCE_MS = 33;

const modeOf = (edit, beat) => (edit.beatModes && edit.beatModes[beat] === 'gameplay_only' ? 'gameplay_only' : 'required');

/** Each beat's span on the edit clock, and each scene clip's. */
function beatTimeline(edit) {
  const byBeat = new Map(BEATS.map((b) => [b, []]));
  for (const c of edit.sceneClips || []) if (byBeat.has(c.beat_number)) byBeat.get(c.beat_number).push(c);
  let t = 0;
  const beats = [];
  for (const b of BEATS) {
    const clips = byBeat.get(b).slice().sort((x, y) => x.position - y.position);
    const start = t;
    const placed = clips.map((clip) => {
      const span = { clip, start: t, end: t + clip.duration_ms };
      t = span.end;
      return span;
    });
    beats.push({ beat: b, start, end: t, clips: placed, mode: modeOf(edit, b) });
  }
  return { beats, duration: t };
}

/** { t } for an anchor plus offset, or { error } (anchor_unresolved reasons). */
function resolveAnchor(edit, timeline, a, seen = new Set()) {
  const offset = Number(a.offset_ms) || 0;
  if (a.anchor_kind === 'beat_start') {
    const beat = timeline.beats.find((b) => b.beat === a.anchor_beat);
    if (!beat) return { error: 'no_such_beat' };
    return { t: beat.start + offset };
  }
  if (a.anchor_kind === 'line_start') {
    const at = edit.lineTimes ? edit.lineTimes[a.anchor_ref] : undefined;
    return Number.isFinite(at) ? { t: at + offset } : { error: 'line_timing_unknown' };
  }
  if (a.anchor_kind === 'item_start') {
    if (seen.has(a.anchor_ref)) return { error: 'anchor_cycle' };
    const item = (edit.items || []).find((i) => i.id === a.anchor_ref);
    if (!item) return { error: 'anchor_missing' };
    const next = new Set(seen).add(a.anchor_ref);
    const r = resolveAnchor(edit, timeline, item, next);
    return r.error ? r : { t: r.t + offset };
  }
  return { error: 'unknown_anchor' };
}

/** Each current segment where it is placed: video and commentary spans on the edit clock. */
function placedSegments(edit, timeline = beatTimeline(edit)) {
  return (edit.segments || []).map((seg, order) => {
    const r = resolveAnchor(edit, timeline, seg);
    if (r.error) return { seg, order, error: r.error };
    const start = r.t;
    return {
      seg,
      order,
      start,
      end: start + (seg.source_out_ms - seg.source_in_ms),
      audioStart: start + (seg.audio_in_ms - seg.source_in_ms),
      audioEnd: start + (seg.audio_out_ms - seg.source_in_ms),
    };
  });
}

/** Whether the PIP is shown at t: the default, then each applying rule in order (the last wins). */
function visibleAt(edit, timeline, t) {
  let visible = !(edit.pip && edit.pip.default_visible === false);
  for (const rule of edit.visibility || []) {
    let from;
    let to;
    if (rule.scope === 'beat') {
      const beat = timeline.beats.find((b) => b.beat === rule.beat_number);
      if (!beat) continue;
      from = beat.start;
      to = beat.end;
    } else {
      const s = resolveAnchor(edit, timeline, rule);
      const e = resolveAnchor(edit, timeline, { anchor_kind: rule.end_anchor_kind, anchor_beat: rule.end_anchor_beat, anchor_ref: rule.end_anchor_ref, offset_ms: rule.end_offset_ms });
      if (s.error || e.error) continue;
      from = s.t;
      to = e.t;
    }
    if (t >= from && t < to) visible = rule.visible !== false;
  }
  return visible;
}

const covering = (placed, t) => placed.filter((p) => !p.error && t >= p.start && t < p.end);
// Of overlapping segments, the one placed latest (then the one listed last) is drawn.
const topmost = (list) => list.slice().sort((a, b) => (a.start - b.start) || (a.order - b.order)).pop() || null;

/**
 * What the frame shows at edit time t: the beat, the scene clip and its source
 * time (a video held on its last frame past its source), and the PIP (null when
 * hidden or not covered). `prime_missing` marks a required beat with no
 * footage at t (the working preview's banner; nothing is drawn in its place).
 */
function layoutAt(edit, t, timeline = beatTimeline(edit), placed = placedSegments(edit, timeline)) {
  const beat = timeline.beats.find((b) => t >= b.start && t < b.end) || null;
  let scene = null;
  if (beat) {
    const span = beat.clips.find((c) => t >= c.start && t < c.end);
    if (span) {
      const { clip } = span;
      if (clip.source_kind === 'angle_still') {
        scene = { clip_id: clip.id, source_kind: clip.source_kind, source_id: clip.source_id, source_time_ms: null, held: false };
      } else {
        const want = clip.source_in_ms + (t - span.start);
        scene = { clip_id: clip.id, source_kind: clip.source_kind, source_id: clip.source_id, source_time_ms: Math.min(want, clip.source_out_ms), held: want > clip.source_out_ms };
      }
    }
  }
  const top = topmost(covering(placed, t));
  let pip = null;
  if (top && visibleAt(edit, timeline, t)) {
    pip = {
      segment_id: top.seg.id,
      raw_clip_id: top.seg.raw_clip_id,
      source_time_ms: top.seg.source_in_ms + (t - top.start),
      layout: { ...DEFAULT_LAYOUT, ...((edit.pip && edit.pip.default_layout) || {}), ...(top.seg.layout || {}) },
      cutout: Boolean(edit.pip && edit.pip.use_cutout),
    };
  }
  return {
    t,
    beat: beat ? beat.beat : null,
    scene,
    pip,
    prime_missing: Boolean(beat && beat.mode === 'required' && !top),
  };
}

/** The source time a mix event plays at edit time t (one clock: no offset field). */
const sourceTimeAt = (event, t) => event.source_start_ms + (t - event.timeline_start_ms);

/**
 * What is heard: Prime's commentary (each placed, unmuted segment's audio
 * sub-range from its own take, on the take's clock), music and SFX, and
 * dialogue placements given in edit.dialogue (approved takes at their lines;
 * none until line timing is mapped). Visibility is not read: hiding the PIP
 * changes nothing here. Events are cut at the edit's end, source and
 * timeline together.
 */
function mixPlan(edit, timeline = beatTimeline(edit), placed = placedSegments(edit, timeline)) {
  const end = timeline.duration;
  const cut = (ev) => {
    if (ev.timeline_start_ms >= end || ev.timeline_end_ms <= 0) return null;
    const lead = Math.max(0, -ev.timeline_start_ms);
    const tail = Math.max(0, ev.timeline_end_ms - end);
    return { ...ev, timeline_start_ms: ev.timeline_start_ms + lead, source_start_ms: ev.source_start_ms + lead, timeline_end_ms: ev.timeline_end_ms - tail, source_end_ms: ev.source_end_ms - tail };
  };
  const commentary = [];
  for (const p of placed) {
    if (p.error || p.seg.audio_muted) continue;
    const ev = cut({
      kind: 'commentary', segment_id: p.seg.id, raw_clip_id: p.seg.raw_clip_id,
      timeline_start_ms: p.audioStart, timeline_end_ms: p.audioEnd,
      source_start_ms: p.seg.audio_in_ms, source_end_ms: p.seg.audio_out_ms,
      gain_db: Number(p.seg.audio_gain_db) || 0, fade_in_ms: p.seg.audio_fade_in_ms || 0, fade_out_ms: p.seg.audio_fade_out_ms || 0,
    });
    if (ev) commentary.push(ev);
  }
  const audio = [];
  for (const a of edit.audioItems || []) {
    const r = resolveAnchor(edit, timeline, a);
    if (r.error) continue;
    const ev = cut({
      kind: a.track, item_id: a.id, asset_ref: a.asset_ref || null, slot: a.slot || null,
      timeline_start_ms: r.t, timeline_end_ms: r.t + (a.source_out_ms - a.source_in_ms),
      source_start_ms: a.source_in_ms, source_end_ms: a.source_out_ms,
      gain_db: Number(a.gain_db) || 0, fade_in_ms: a.fade_in_ms || 0, fade_out_ms: a.fade_out_ms || 0,
      duck_under_dialogue_db: a.duck_under_dialogue_db == null ? null : Number(a.duck_under_dialogue_db),
    });
    if (ev) audio.push(ev);
  }
  const dialogue = (edit.dialogue || []).map((d) => cut({ kind: 'dialogue', ...d })).filter(Boolean);
  return { duration_ms: end, commentary, audio, dialogue };
}

/** Uncovered stretches of each required beat: prime_footage_missing (R5.1). */
function coverageFindings(edit, timeline = beatTimeline(edit), placed = placedSegments(edit, timeline)) {
  const findings = [];
  const spans = placed.filter((p) => !p.error).map((p) => [p.start, p.end]).sort((a, b) => a[0] - b[0]);
  for (const beat of timeline.beats) {
    if (beat.mode !== 'required' || beat.end <= beat.start) continue;
    let at = beat.start;
    const gaps = [];
    for (const [s, e] of spans) {
      if (e <= at || s >= beat.end) continue;
      if (s > at) gaps.push([at, Math.min(s, beat.end)]);
      at = Math.max(at, e);
      if (at >= beat.end) break;
    }
    if (at < beat.end) gaps.push([at, beat.end]);
    for (const [from, to] of gaps) {
      if (to - from > GAP_TOLERANCE_MS) findings.push({ code: 'prime_footage_missing', severity: 'blocking', beat: beat.beat, from_ms: from, to_ms: to });
    }
  }
  return findings;
}

/**
 * Every finding the rows alone can show. Blocking ones stop a review-ready
 * preview; warnings are shown. The service adds what needs other tables
 * (sources deleted or changed, dialogue approvals).
 */
function editFindings(edit) {
  const timeline = beatTimeline(edit);
  const placed = placedSegments(edit, timeline);
  const findings = [];
  for (const beat of timeline.beats) {
    if (!beat.clips.length) findings.push({ code: 'scene_missing', severity: 'blocking', beat: beat.beat });
    for (const span of beat.clips) {
      const c = span.clip;
      if (c.source_kind !== 'angle_still' && c.duration_ms > c.source_out_ms - c.source_in_ms) {
        findings.push({ code: 'scene_clip_holds_last_frame', severity: 'warning', beat: beat.beat, ref: c.id, from_ms: span.start + (c.source_out_ms - c.source_in_ms), to_ms: span.end });
      }
    }
  }
  for (const p of placed) {
    if (p.error) findings.push({ code: 'anchor_unresolved', severity: 'blocking', ref: p.seg.id, reason: p.error });
    else if (p.end > timeline.duration) findings.push({ code: 'segment_beyond_edit_end', severity: 'warning', ref: p.seg.id, from_ms: timeline.duration, to_ms: p.end });
  }
  const ok = placed.filter((p) => !p.error).sort((a, b) => a.start - b.start);
  for (let i = 1; i < ok.length; i += 1) {
    if (ok[i].start < ok[i - 1].end) findings.push({ code: 'prime_segments_overlap', severity: 'warning', ref: ok[i].seg.id, from_ms: ok[i].start, to_ms: Math.min(ok[i].end, ok[i - 1].end) });
  }
  for (const item of edit.items || []) {
    const r = resolveAnchor(edit, timeline, item);
    if (r.error) findings.push({ code: 'anchor_unresolved', severity: 'warning', ref: item.id, reason: r.error });
  }
  findings.push(...coverageFindings(edit, timeline, placed));
  return findings;
}

module.exports = {
  FRAME_W, FRAME_H, DEFAULT_LAYOUT, GAP_TOLERANCE_MS, BEATS,
  beatTimeline, resolveAnchor, placedSegments, visibleAt, layoutAt, mixPlan, sourceTimeAt, coverageFindings, editFindings,
};
