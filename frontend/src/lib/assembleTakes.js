/**
 * Edit & Assemble: which take to use for each beat. The takes are the
 * episode's raw clips (lib/rawClipsApi): a clip linked to a beat
 * (beat_number) is one of that beat's takes, and its ★ (is_favorite, one per
 * beat, kept by the server) is her pick. A beat she only has in a
 * whole-episode take (lib/fullEpisodeTake) can use that take's stretch, from
 * its beat marker to the next one.
 *
 *   beatOptions(clips, beatNumber) → [option], the ★ first
 *   option: { key, clip, favorite, full, start, end }   start/end in seconds for a stretch
 *   assembly(clips, beats, picks) → [{ number, name, options, pick }] in beat order
 *   favouritePicks(clips, beats) → { [beat]: key } the ★ (or first) take of each beat
 *
 * The pick itself is the viewer's own (kept on this device): the episode
 * has no field for "the take to use" beyond the ★. Pure: no React, no network.
 */
import { cleanMarks, isFullTake } from './fullEpisodeTake';
import { beatName } from './canonicalBeats';

export const BEAT_COUNT = 14;
export const PICKS_KEY = (episodeId) => `assemble.picks.${episodeId}`;

/** A clip's beat markers, cleaned (the server sends an array; an old row may send text). */
export const clipMarks = (clip) => {
  let m = clip?.beat_marks;
  if (typeof m === 'string') {
    try { m = JSON.parse(m); } catch (err) { console.error('[assembleTakes] beat_marks unreadable:', err); m = null; }
  }
  return cleanMarks(m);
};

/** A clip's option key: its id, and the beat for a whole-episode stretch. */
export const optionKey = (clip, beat = null) => (beat != null ? `${clip.id}@${beat}` : String(clip.id));

/**
 * A beat's takes: its own clips, the ★ first then newest first, then the
 * whole-episode takes that marked the beat (the ★ one first, then newest).
 */
export function beatOptions(clips, beatNumber) {
  const n = Number(beatNumber);
  const list = Array.isArray(clips) ? clips : [];
  const order = (a, b) => (b.favorite - a.favorite) || (b.i - a.i);
  const own = list
    .map((c, i) => ({ c, i }))
    .filter(({ c }) => Number(c.beat_number) === n && !isFullTake(c))
    .map(({ c, i }) => ({ key: optionKey(c), clip: c, favorite: c.is_favorite === true ? 1 : 0, full: false, start: null, end: null, i }))
    .sort(order);
  const stretches = [];
  list.forEach((c, i) => {
    if (!isFullTake(c)) return;
    const marks = clipMarks(c);
    const at = marks.findIndex((m) => m.beat === n);
    if (at < 0) return;
    const next = marks[at + 1];
    const len = Number(c.duration_seconds);
    stretches.push({
      key: optionKey(c, n), clip: c, favorite: c.is_favorite === true ? 1 : 0, full: true,
      start: marks[at].t, end: next ? next.t : (Number.isFinite(len) && len > 0 ? len : null), i,
    });
  });
  stretches.sort(order);
  return [...own, ...stretches].map((o) => ({ key: o.key, clip: o.clip, favorite: !!o.favorite, full: o.full, start: o.start, end: o.end }));
}

/** The beats to assemble: the plan's when it has them, else Beats 1-14. */
export function assemblyBeats(beats) {
  const named = new Map((beats || []).map((b) => [Number(b.beat_number), b.beat_name]));
  return Array.from({ length: BEAT_COUNT }, (_, i) => ({ number: i + 1, name: named.get(i + 1) || beatName(i + 1) }));
}

/** Each beat's ★ take (its first take when none is starred): "Use favourites". */
export function favouritePicks(clips, beats) {
  const out = {};
  for (const b of assemblyBeats(beats)) {
    const opts = beatOptions(clips, b.number);
    if (opts.length) out[b.number] = opts[0].key;
  }
  return out;
}

/**
 * The beats in order with their takes and the one to use: the viewer's pick
 * while it is still one of the beat's takes, else the ★ (or first) take.
 */
export function assembly(clips, beats, picks = {}) {
  return assemblyBeats(beats).map((b) => {
    const options = beatOptions(clips, b.number);
    const chosen = picks?.[b.number];
    const pick = options.find((o) => o.key === chosen) || options[0] || null;
    return { ...b, options, pick };
  });
}

/** "11 of 14 beats have a take to use". */
export function assemblyStat(rows) {
  const n = (rows || []).filter((r) => r.pick).length;
  return `${n} of ${BEAT_COUNT} beats have a take to use`;
}

/** The lined-up order as text: one line a beat, its take and, for a stretch, from-to. */
export function assemblyText(rows, clock) {
  return (rows || []).map((r) => {
    if (!r.pick) return `${r.number}. ${r.name}: no take yet`;
    const name = r.pick.clip.label || r.pick.clip.original_filename || 'Take';
    const span = r.pick.full ? ` (${clock(r.pick.start)}${r.pick.end != null ? `–${clock(r.pick.end)}` : ' on'})` : '';
    return `${r.number}. ${r.name}: ${name}${span}${r.pick.favorite ? ' ★' : ''}`;
  }).join('\n');
}

/** The picks kept on this device, or {}. */
export function readPicks(episodeId) {
  try {
    const raw = JSON.parse(window.localStorage.getItem(PICKS_KEY(episodeId)) || '{}');
    return raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  } catch (err) {
    console.error('[assembleTakes] picks not read:', err);
    return {};
  }
}

/** Keeps the picks on this device; false when the browser would not. */
export function writePicks(episodeId, picks) {
  try {
    window.localStorage.setItem(PICKS_KEY(episodeId), JSON.stringify(picks || {}));
    return true;
  } catch (err) {
    console.error('[assembleTakes] picks not kept:', err);
    return false;
  }
}
