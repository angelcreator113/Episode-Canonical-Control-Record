/**
 * Where a video starts and ends, in beats (Evoni, 2026-10-28: "show where a
 * video starts and ends"). Three kinds of clip:
 *   a full-episode take with beat markers (lib/fullEpisodeTake): from the
 *     first beat with a real marker to the last ("Beats 10 → 14 · ended in
 *     beat 14 · Cliffhanger");
 *   an uploaded clip with a start beat and an end beat she picked
 *     (beat_number → end_beat_number): "Beat 1 → Beat 11";
 *   a clip with one beat: "Beat 3".
 *
 * A real marker is one the reading actually reached. When several beats
 * share one time, the reader was moved past them without reading them: at
 * the very start of a take (beats 1-9 all at 0:00, then beat 10 at 0:09.4)
 * none of them was read; later in a take, only the last of them was. A
 * beat with no marker at all is simply not in the take.
 *
 * Overlaps: two clips of the same performer that cover some of the same
 * beats, each told about the other ("Overlaps Full episode · take 1 on
 * beats 10–11"), so she can pick between them in ★ Takes to use.
 * Pure: no React, no network.
 */
import { cleanMarks, isFullTake } from './fullEpisodeTake';
import { beatName } from './canonicalBeats';

export const LAST_BEAT = 14;
// Markers within this many seconds of each other are at the same time.
const SAME_TIME = 0.05;
// A marker this close to the take's start is "at the start".
const AT_START = 0.5;

/** A clip's markers, cleaned (the server sends an array; an old row may send text). */
export function marksOf(clip) {
  let m = clip?.beat_marks;
  if (typeof m === 'string') {
    try { m = JSON.parse(m); } catch (err) { console.error('[clipRange] beat_marks unreadable:', err); m = null; }
  }
  return cleanMarks(m);
}

/**
 * The markers the reading reached, in time order: of several beats at one
 * time only the last (none, when they are at the take's start and there is
 * more than one).
 */
export function realMarks(marks) {
  const list = cleanMarks(marks);
  const out = [];
  for (let i = 0; i < list.length; i += 1) {
    const m = list[i];
    const next = list[i + 1];
    if (next && Math.abs(next.t - m.t) < SAME_TIME) continue; // skipped past: the next one shares its time
    const prev = list[i - 1];
    const tied = prev && Math.abs(prev.t - m.t) < SAME_TIME;
    if (tied && m.t < AT_START) continue; // the last of a jump at the very start: not read either
    out.push(m);
  }
  return out;
}

/** The names of the beats: the episode's plan where it has them, else the standard names. */
export function beatNames(beats) {
  const named = new Map((beats || []).filter((b) => b && b.beat_name).map((b) => [Number(b.beat_number), b.beat_name]));
  return (n) => named.get(Number(n)) || beatName(n);
}

const asBeat = (v) => {
  const n = Number(v);
  return v != null && v !== '' && Number.isInteger(n) && n >= 1 && n <= LAST_BEAT ? n : null;
};

/**
 * The beats a clip covers: { from, to, source } where source is 'marks' (a
 * full-episode take's markers), 'picked' (its start and end beats) or
 * 'beat' (one beat); null when it is linked to no beat.
 */
export function clipRange(clip) {
  if (!clip) return null;
  if (isFullTake(clip)) {
    const real = realMarks(marksOf(clip));
    if (real.length) {
      const beats = real.map((m) => m.beat);
      return { from: Math.min(...beats), to: Math.max(...beats), source: 'marks', last: real[real.length - 1].beat };
    }
  }
  const from = asBeat(clip.beat_number);
  if (from == null) return null;
  const end = asBeat(clip.end_beat_number);
  if (end != null && end > from) return { from, to: end, source: 'picked' };
  return { from, to: from, source: 'beat' };
}

/** The beats in a range, in order. */
export const rangeBeats = (r) => (r ? Array.from({ length: r.to - r.from + 1 }, (_, i) => r.from + i) : []);

/**
 * The card's line for a clip's beats: "Beats 10 → 14 · ended in beat 14 ·
 * Cliffhanger" (markers), "Beat 1 → Beat 11" (picked), or null (one beat or
 * none: the beat picker already says so). names: beatNames().
 */
export function rangeText(clip, names = beatNames()) {
  const r = clipRange(clip);
  if (!r) return null;
  if (r.source === 'marks') {
    const span = r.from === r.to ? `Beat ${r.from}` : `Beats ${r.from} → ${r.to}`;
    return `${span} · ended in beat ${r.last} · ${names(r.last)}`;
  }
  if (r.source === 'picked') return `Beat ${r.from} → Beat ${r.to}`;
  return null;
}

/** "beat 11", "beats 10–11", "beats 3, 5–6". */
export function beatsText(list) {
  const sorted = [...new Set(list)].sort((a, b) => a - b);
  if (!sorted.length) return '';
  const runs = [];
  sorted.forEach((n) => {
    const run = runs[runs.length - 1];
    if (run && n === run[1] + 1) run[1] = n; else runs.push([n, n]);
  });
  const text = runs.map(([a, b]) => (a === b ? `${a}` : `${a}–${b}`)).join(', ');
  return `${sorted.length === 1 ? 'beat' : 'beats'} ${text}`;
}

const sameSide = (a, b) => a.performer === b.performer && (a.performer !== 'guest' || (a.guest_name || '') === (b.guest_name || ''));

/**
 * Each clip's overlaps with the other clips covering more than one beat
 * (full-episode takes with markers, or a picked start and end), same
 * performer only: Map(clipId → [{ clip, beats }]). One-beat clips are
 * ordinary takes of their beat and are left out.
 */
export function rangeOverlaps(clips) {
  const spans = (clips || [])
    .map((c) => ({ c, r: clipRange(c) }))
    .filter(({ r }) => r && (r.source === 'marks' || r.source === 'picked'));
  const out = new Map();
  spans.forEach((a, i) => {
    spans.forEach((b, j) => {
      if (i === j || !sameSide(a.c, b.c)) return;
      const lo = Math.max(a.r.from, b.r.from);
      const hi = Math.min(a.r.to, b.r.to);
      if (lo > hi) return;
      const beats = rangeBeats({ from: lo, to: hi });
      if (!out.has(a.c.id)) out.set(a.c.id, []);
      out.get(a.c.id).push({ clip: b.c, beats });
    });
  });
  return out;
}

/** "Overlaps Full episode · take 1 on beats 10–11". */
export const overlapText = (o) => `Overlaps ${o.clip.label || o.clip.original_filename || 'another clip'} on ${beatsText(o.beats)}`;

/**
 * The beat a performer's latest full-episode take stopped at, to carry on
 * from ("Continue from beat 12 · Fashion Challenge"): { take, ended, next }
 * when the latest of `takes` (oldest first, as listed) ended before
 * lastBeat; else null.
 */
export function continueFrom(takes, lastBeat = LAST_BEAT) {
  const withMarks = (takes || []).filter((t) => clipRange(t)?.source === 'marks');
  const time = (t) => {
    const d = Date.parse(t?.created_at || '');
    return Number.isFinite(d) ? d : -Infinity;
  };
  // Newest by when it was made; the list order breaks a tie (later = newer).
  let take = null;
  withMarks.forEach((t) => { if (!take || time(t) >= time(take)) take = t; });
  if (!take) return null;
  const r = clipRange(take);
  if (r.last >= lastBeat) return null;
  return { take, ended: r.last, next: r.last + 1 };
}
