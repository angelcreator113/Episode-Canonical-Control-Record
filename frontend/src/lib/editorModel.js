/**
 * What the episode editor draws, worked out from the live edit (Timeline
 * Editor redesign P1, 2026-11-02; plan §3.7, §3.9). Pure: the beats, the
 * lanes and their blocks and the beat readiness all come from the edit's rows through editTimeline (the server's own clock,
 * copied byte for byte), the media lists and the server's findings. Nothing
 * here invents a clip, a time or a status.
 */
import {
  beatTimeline, placedSegments, placedDialogue, resolveAnchor, FRAME_W, FRAME_H,
} from './editTimeline';
import { beatName } from './canonicalBeats';

export { FRAME_W, FRAME_H };

/**
 * The lanes, top to bottom (plan §3.9). `pending` names what unlocks a lane
 * that has no data model yet; such a lane is drawn empty and labelled.
 */
export const LANES = [
  { key: 'scene', name: 'Scene', sub: 'Background', kind: 'video' },
  { key: 'performer', name: 'Lala & guests', sub: 'Performer · cutout', kind: 'video', pending: 'Performer layer: Gate 2 (D3)' },
  { key: 'prime', name: 'Prime PIP', sub: 'JustAWoman', kind: 'video' },
  { key: 'prime_vo', name: 'Prime VO', sub: 'Commentary · linked', kind: 'audio' },
  { key: 'dialogue', name: 'Dialogue', sub: 'Lala · guests', kind: 'audio' },
  { key: 'phone', name: 'Phone', sub: 'Screens', kind: 'video', pending: 'Phone screens: Gate 2 (C1b)' },
  { key: 'gameplay', name: 'Gameplay', sub: 'Actions · cursor · UI', kind: 'video', pending: 'Gameplay actions: Gate 2 (C1b)' },
  { key: 'overlays', name: 'Overlays', sub: 'Widgets · images', kind: 'video', pending: 'Overlays: Gate 2 (C1b)' },
  { key: 'music', name: 'Music', sub: 'Bed', kind: 'audio' },
  { key: 'sfx', name: 'SFX', sub: 'Effects', kind: 'audio' },
  { key: 'captions', name: 'Captions & titles', sub: 'Text', kind: 'video', pending: 'Captions and titles: Gate 2 (D4)' },
];

/** The media an edit names, looked up by id. */
export function mediaIndex({ rawClips = [], sceneSets = [], takes = [] } = {}) {
  const clips = new Map(rawClips.map((c) => [String(c.id), c]));
  const angles = new Map();
  for (const set of sceneSets) {
    for (const a of set.angles || []) angles.set(String(a.id), { ...a, set_name: set.name || set.title || null, set_id: set.id });
  }
  const takesById = new Map(takes.map((t) => [String(t.approval_id), t]));
  return { clips, angles, takes: takesById };
}

const clipName = (c) => (c ? c.label || c.original_filename || 'Untitled clip' : null);
const angleName = (a) => (a ? [a.set_name, a.angle_label || a.angle_name].filter(Boolean).join(' · ') || 'Angle' : null);

/** The display name and still image of a scene clip's source. */
export function sceneSource(clip, media) {
  if (clip.source_kind === 'raw_clip') {
    const c = media.clips.get(String(clip.source_id));
    return { name: clipName(c) || 'Missing raw clip', image: c?.thumbnail_url || null, missing: !c };
  }
  const a = media.angles.get(String(clip.source_id));
  const image = a ? (a.still_image_url || a.thumbnail_url || null) : null;
  return { name: angleName(a) || 'Missing angle', image, missing: !a };
}

/** The canonical beat name, else "Beat n". */
export const beatLabel = (n) => beatName(n) || `Beat ${n}`;

/**
 * Everything the timeline draws: { duration, beats, blocks: { [lane]: [...] },
 * unplaced: [...] }. Each block: { id, lane, kind, start, end, label, row,
 * image?, muted?, problem?, linked? }. Times are edit-clock ms.
 */
export function buildTimeline(edit, media = mediaIndex()) {
  const timeline = beatTimeline(edit);
  const blocks = Object.fromEntries(LANES.map((l) => [l.key, []]));
  const unplaced = [];

  const beats = timeline.beats.map((b) => ({
    beat: b.beat, name: beatLabel(b.beat), start: b.start, end: b.end, locked: b.locked, prime_mode: b.mode, clip_count: b.clips.length,
  }));

  for (const b of timeline.beats) {
    for (const span of b.clips) {
      const src = sceneSource(span.clip, media);
      blocks.scene.push({
        id: span.clip.id, lane: 'scene', kind: 'scene_clip', start: span.start, end: span.end, label: src.name, image: src.image,
        missing: src.missing, row: span.clip, beat: b.beat, cut_ms: span.cut_ms,
      });
    }
  }

  for (const p of placedSegments(edit, timeline)) {
    const c = media.clips.get(String(p.seg.raw_clip_id));
    const label = clipName(c) || 'Prime take';
    if (p.error) { unplaced.push({ id: p.seg.id, kind: 'segment', label, reason: p.error }); continue; }
    blocks.prime.push({ id: p.seg.id, lane: 'prime', kind: 'segment', start: p.start, end: p.end, label, image: c?.thumbnail_url || null, row: p.seg, missing: !c });
    if (p.audioStart != null && p.audioEnd != null) {
      blocks.prime_vo.push({
        id: `${p.seg.id}:vo`, lane: 'prime_vo', kind: 'commentary', start: p.audioStart, end: p.audioEnd, label: `${label} · commentary`,
        row: p.seg, muted: Boolean(p.seg.audio_muted), linked: p.seg.id,
      });
    }
  }

  for (const d of placedDialogue(edit, timeline)) {
    const label = `Beat ${d.item.line_beat} · line ${Number(d.item.line_index) + 1}`;
    if (d.error) { unplaced.push({ id: d.item.id, kind: 'dialogue', label, reason: d.error }); continue; }
    blocks.dialogue.push({
      id: d.item.id, lane: 'dialogue', kind: 'dialogue', start: d.start, end: d.end, label, row: d.item,
      take: d.take, problem: d.problem ? d.problem.state : (d.bad_range ? 'bad_range' : null),
      audio_url: media.takes.get(String(d.item.voice_approval_id))?.audio_url || null,
    });
  }

  for (const a of edit.audioItems || []) {
    const r = resolveAnchor(edit, timeline, a);
    const label = a.asset_ref || (a.slot ? `Slot: ${a.slot}` : (a.track === 'music' ? 'Music' : 'SFX'));
    if (r.error) { unplaced.push({ id: a.id, kind: a.track, label, reason: r.error }); continue; }
    const lane = a.track === 'sfx' ? 'sfx' : 'music';
    blocks[lane].push({ id: a.id, lane, kind: 'audio_item', start: r.t, end: r.t + (a.source_out_ms - a.source_in_ms), label, row: a });
  }

  // Transitions are stored items; they are drawn as marks on the scene lane.
  const transitions = [];
  for (const item of edit.items || []) {
    if (item.kind !== 'transition') continue;
    const r = resolveAnchor(edit, timeline, item);
    if (!r.error) transitions.push({ id: item.id, at: r.t, type: item.values?.type || 'transition', row: item });
  }

  return { duration: timeline.duration, beats, blocks, transitions, unplaced };
}

/** A finding's beat, when it names one directly or through a block it refers to. */
function findingBeat(f, blockBeat) {
  if (Number.isInteger(f.beat)) return f.beat;
  if (f.ref && blockBeat.has(String(f.ref))) return blockBeat.get(String(f.ref));
  return null;
}

/**
 * Each beat's readiness from the server's findings (P1 interim; the seven
 * statuses of design R8.6 arrive with Gate 2): 'blocked' (a blocking
 * finding), 'warning' (warnings only), 'empty' (no scene clip and nothing
 * placed in it) or 'clear'. Findings that name no beat are `episode`.
 */
export function beatReadiness(model, findings = []) {
  const blockBeat = new Map();
  for (const lane of Object.values(model.blocks)) {
    for (const b of lane) {
      const at = model.beats.find((x) => b.start >= x.start && b.start < x.end);
      if (at) blockBeat.set(String(b.row?.id ?? b.id), at.beat);
    }
  }
  const byBeat = new Map(model.beats.map((b) => [b.beat, []]));
  const episode = [];
  for (const f of findings) {
    const beat = findingBeat(f, blockBeat);
    if (beat != null && byBeat.has(beat)) byBeat.get(beat).push(f);
    else episode.push(f);
  }
  const beats = model.beats.map((b) => {
    const list = byBeat.get(b.beat);
    const blocking = list.filter((f) => f.severity === 'blocking').length;
    const warning = list.length - blocking;
    let status = 'clear';
    if (blocking) status = 'blocked';
    else if (warning) status = 'warning';
    if (!b.clip_count && !blocking && !warning) status = 'empty';
    return { beat: b.beat, status, blocking, warning, findings: list };
  });
  return { beats, episode };
}

const FINDING_TEXT = {
  scene_missing: 'No scene clip in this beat',
  scene_gap: 'The scene clips stop before the beat ends',
  scene_overruns_beat: 'The scene clips run past the beat',
  scene_clip_holds_last_frame: 'A video ends early and holds its last frame',
  scene_source_missing: "A scene clip's media is missing or not linked",
  source_performer_changed: "A clip's performer changed",
  prime_footage_missing: 'Prime is required here but has no footage',
  prime_source_missing: "A Prime segment's take is missing",
  prime_segments_overlap: 'Two Prime segments overlap',
  segment_before_edit_start: 'A Prime segment starts before the episode',
  segment_beyond_edit_end: 'A Prime segment runs past the end',
  line_audio_unapproved: 'A spoken line has no approved take',
  dialogue_unplaced: 'An approved take is not placed',
  dialogue_take_not_current: 'A placed take is no longer the approved one',
  dialogue_take_bad_range: "A placed take's trim is outside its file",
  dialogue_beyond_edit: 'A line plays past the episode',
  dialogue_outside_beat: 'A line plays outside its beat',
  dialogue_overlap: 'Two lines overlap',
  line_timing_unknown: 'Placed at a line mark that is not mapped yet',
  anchor_unresolved: 'Placed relative to something that is gone',
};
/** A finding as a sentence a producer reads, with its code kept for reference. */
export const findingText = (f) => FINDING_TEXT[f.code] || f.code.replace(/_/g, ' ');

/** mm:ss.ff at 30 fps (frames, not hundredths), as the transport shows time. */
export function timecode(ms) {
  const v = Math.max(0, Math.round(Number(ms) || 0));
  // The nearest frame, as snapToFrame rounds: 4033 ms is frame 121 (04.01), not 120.
  const totalFrames = Math.round((v * 30) / 1000);
  const ff = totalFrames % 30;
  const s = Math.floor(totalFrames / 30);
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}.${String(ff).padStart(2, '0')}`;
}

/** Every block edge and beat edge, sorted: where "previous / next edit" moves the playhead. */
export function editPoints(model) {
  const pts = new Set([0, model.duration]);
  for (const b of model.beats) { pts.add(b.start); pts.add(b.end); }
  for (const lane of Object.values(model.blocks)) for (const b of lane) { pts.add(b.start); pts.add(b.end); }
  return [...pts].filter((x) => Number.isFinite(x) && x >= 0).sort((a, b) => a - b);
}
