/**
 * The working preview's plan at edit time t (Timeline Editor redesign P2,
 * 2026-11-02; design R8.4, R8.11). Pure: from the edit's own layout
 * (layoutAt) and mix (mixPlan), and the media lists, it says which picture
 * each layer shows and where in its source, and which sounds play, from
 * where, how loud. The preview player only carries it out.
 *
 * What the working preview does not do, and says so:
 * - Gain above 0 dB plays at 0 dB (a browser element cannot amplify without
 *   reading the file's samples across origins); the render applies it.
 * - "Normalise" on a take is not applied; the render applies it.
 * - Music and SFX have no files until the library exists (R8.8): they are
 *   listed as unavailable, never replaced by another sound (spec G-2).
 * - Safari cannot draw VP9 transparency: Prime is shown from her original
 *   video, with its background, and the preview says so.
 */
import { layoutAt, layersAt, DEFAULT_LAYOUT } from './editTimeline';

export const FPS = 30;

/** An edit time snapped to the nearest frame at 30 fps, in whole ms (R8.4.5). */
export const snapToFrame = (ms) => Math.round((Math.round((Number(ms) || 0) * FPS / 1000) * 1000) / FPS);

/** dB as a linear gain. */
export const dbToLinear = (db) => 10 ** ((Number(db) || 0) / 20);

/** Whether this browser is Safari (no VP9 alpha). */
export const isSafari = (ua = (typeof navigator !== 'undefined' ? navigator.userAgent : '')) =>
  /safari/i.test(ua) && !/chrome|chromium|crios|fxios|android|edg\//i.test(ua);

/** Which file shows Prime: her cutout when the edit asks for it and this browser can draw it. */
export function primeVideo(clip, useCutout, safari) {
  if (!clip) return { url: null, cutout: false, note: null };
  if (useCutout && clip.url_cutout && !safari) return { url: clip.url_cutout, cutout: true, note: null };
  if (useCutout && clip.url_cutout && safari) {
    return { url: clip.url_raw || null, cutout: false, note: "This browser can't show transparent video: Prime is shown with her background. Use Chrome or Edge." };
  }
  if (useCutout && !clip.url_cutout) return { url: clip.url_raw || null, cutout: false, note: "Prime's cutout isn't ready yet: she is shown with her background." };
  return { url: clip.url_raw || null, cutout: false, note: null };
}

/**
 * Which file shows Lala or a guest over the scene (D3): their cutout once its
 * green removal is done, else their original (with its background, and a note).
 */
export function performerVideo(clip, safari) {
  if (!clip) return { url: null, cutout: false, note: null };
  if (clip.url_cutout && clip.key_status === 'done' && !safari) return { url: clip.url_cutout, cutout: true, note: null };
  const who = clip.performer === 'guest' ? (clip.guest_name || 'The guest') : 'Lala';
  if (clip.url_cutout && safari) return { url: clip.url_raw || null, cutout: false, note: `This browser can't show transparent video: ${who} is shown with her background. Use Chrome or Edge.` };
  return { url: clip.url_raw || null, cutout: false, note: `${who}'s cutout isn't ready yet: she is shown with her background.` };
}

/**
 * The picture at t: { beat, scene, performers, pip, captions, mode, prime_missing, scene_gap }.
 * scene: { clip_id, kind: 'image' | 'video', url, source_time_ms, held, name }.
 * pip:   { segment_id, url, cutout, note, source_time_ms, layout, name }.
 */
export function framePlan(edit, t, media, { safari = isSafari() } = {}) {
  const at = layoutAt(edit, t);
  let scene = null;
  if (at.scene) {
    const clip = (edit.sceneClips || []).find((c) => c.id === at.scene.clip_id);
    if (clip) {
      if (clip.source_kind === 'raw_clip') {
        const c = media.clips.get(String(clip.source_id));
        scene = { clip_id: clip.id, kind: 'video', url: c?.url_raw || null, poster: c?.thumbnail_url || null, name: c ? (c.label || c.original_filename || 'Clip') : 'Missing raw clip' };
      } else {
        const a = media.angles.get(String(clip.source_id));
        const name = a ? [a.set_name, a.angle_label || a.angle_name].filter(Boolean).join(' · ') : 'Missing angle';
        scene = clip.source_kind === 'angle_video'
          ? { clip_id: clip.id, kind: 'video', url: a?.video_clip_url || null, poster: a?.still_image_url || a?.thumbnail_url || null, name }
          : { clip_id: clip.id, kind: 'image', url: a ? (a.still_image_url || a.thumbnail_url || null) : null, name };
      }
      scene.source_time_ms = at.scene.source_time_ms;
      scene.held = Boolean(at.scene.held);
    }
  }
  let pip = null;
  if (at.pip) {
    const c = media.clips.get(String(at.pip.raw_clip_id));
    const video = primeVideo(c, at.pip.cutout, safari);
    pip = {
      segment_id: at.pip.segment_id, ...video, poster: c?.thumbnail_url || null,
      source_time_ms: at.pip.source_time_ms, layout: at.pip.layout || DEFAULT_LAYOUT,
      name: c ? (c.label || c.original_filename || 'Prime take') : 'Missing Prime take',
    };
  }
  // C1b (D3, D4, D5): Lala and guests over the scene, Prime's opacity, captions on top, the visual mode.
  const layered = layersAt(edit, t);
  const performers = layered.layers.filter((l) => l.kind === 'performer').map((l) => {
    const c = media.clips.get(String(l.raw_clip_id));
    return {
      item_id: l.item_id, ...performerVideo(c, safari), poster: c?.thumbnail_url || null, source_time_ms: l.source_time_ms,
      layout: l.layout, opacity: l.opacity, layer: l.layer, name: c ? (c.label || c.original_filename || 'Performer take') : 'Missing take',
    };
  });
  const pipLayer = layered.layers.find((l) => l.kind === 'pip');
  if (pip && pipLayer) { pip.opacity = pipLayer.opacity; pip.layout = pipLayer.layout; }
  const captions = layered.layers.filter((l) => l.kind === 'caption').map((l) => ({ item_id: l.item_id, text: l.text, style_key: l.style_key, layout: l.layout, opacity: l.opacity }));
  return { t, beat: at.beat, scene, performers, pip, captions, mode: layered.mode, prime_missing: at.prime_missing, scene_gap: at.scene_gap };
}

/** The lane a mix event plays on (the track-header mute keys). */
const laneOf = (ev) => (ev.kind === 'commentary' ? 'prime_vo' : ev.kind);

/**
 * The volume of a mix event at t (0..1): its gain, shaped by its fades.
 * { volume, clipped } where clipped means the stored gain is above 0 dB.
 */
export function eventVolume(ev, t) {
  const gain = dbToLinear(ev.gain_db);
  let shape = 1;
  if (ev.fade_in_ms > 0) shape = Math.min(shape, (t - ev.timeline_start_ms) / ev.fade_in_ms);
  if (ev.fade_out_ms > 0) shape = Math.min(shape, (ev.timeline_end_ms - t) / ev.fade_out_ms);
  shape = Math.max(0, Math.min(1, shape));
  return { volume: Math.max(0, Math.min(1, gain * shape)), clipped: gain > 1.0001 };
}

/** The file a mix event plays, or why it has none. */
function eventSource(ev, media) {
  if (ev.kind === 'commentary') {
    const c = media.clips.get(String(ev.raw_clip_id));
    return c?.url_raw ? { url: c.url_raw } : { url: null, missing: "Prime's take is missing" };
  }
  if (ev.kind === 'dialogue') {
    const take = media.takes.get(String(ev.approval_id));
    return take?.audio_url ? { url: take.audio_url } : { url: null, missing: "The approved take's file is missing" };
  }
  return { url: null, missing: 'No file yet: the music and SFX library is pending (R8.8)' };
}

/**
 * Every sound of the mix with its state at t: [{ key, lane, kind, label,
 * url, active, source_time_ms, volume, clipped, missing, muted }]. A sound is
 * active while t is inside it; muted when its lane is muted in the preview.
 */
export function mixAt(mix, t, media, { mutedLanes = {} } = {}) {
  const events = [...(mix?.commentary || []), ...(mix?.dialogue || []), ...(mix?.audio || [])];
  return events.map((ev) => {
    const lane = laneOf(ev);
    const src = eventSource(ev, media);
    const active = t >= ev.timeline_start_ms && t < ev.timeline_end_ms;
    const { volume, clipped } = eventVolume(ev, t);
    return {
      key: `${ev.kind}:${ev.segment_id || ev.item_id}`,
      lane, kind: ev.kind,
      label: ev.kind === 'dialogue' ? `Beat ${ev.beat} · line ${Number(ev.line_index) + 1}` : (ev.asset_ref || ev.slot || ev.kind),
      url: src.url, missing: src.missing || null,
      active, muted: Boolean(mutedLanes[lane]),
      source_time_ms: active ? ev.source_start_ms + (t - ev.timeline_start_ms) : null,
      volume: active ? volume : 0, clipped,
      normalise: Boolean(ev.normalise),
    };
  });
}
