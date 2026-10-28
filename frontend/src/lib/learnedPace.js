/**
 * Her real reading pace, learned from her takes (Evoni, 2026-10-28: the
 * estimate's 150 words a minute is not how fast she reads).
 *
 * Each take tells how long the beats it covers really took:
 *   a full-episode take with beat markers (lib/fullEpisodeTake): a beat runs
 *     from its marker to the next one, the last to the end of the take;
 *   a take of one beat: its length (one started from a later line is left
 *     out: it did not read the whole beat).
 * A beat is left out when its marker is at 0:00 (the countdown, or a jump
 * at the start), when the reading never reached it (lib/clipRange
 * realMarks), or when the take only went past it (under 2 seconds, or far
 * shorter than the estimate).
 *
 * For each beat left in: the time minus what the teleprompter showed that
 * is not her reading (on-screen moments and sounds, others' lines as cues,
 * at their standard estimate; scene notes are hidden in the teleprompter and
 * count nothing), against her own words at the standard 150. That ratio,
 * clamped, per beat; the median of them is the factor, and her words a
 * minute are 150 divided by it.
 *
 * Pure: no React, no network.
 */
import { WORDS_PER_MINUTE, beatSeconds } from './scriptRuntime';
import { teleprompterLines } from './teleprompterLines';
import { realMarks, marksOf, clipRange } from './clipRange';
import { isFullTake } from './fullEpisodeTake';
import { HER, isHerSpeaker } from './scriptSpeaker';

// A marker this close to the start is at 0:00 (lib/clipRange AT_START).
const AT_START = 0.5;
// A beat shorter than this was gone past, not read.
const MIN_SECONDS = 2;
// ...and so was one shorter than this share of its estimate.
const SKIPPED_SHARE = 0.35;
// Her words in a beat below this many seconds at 150 (10 words) say too
// little about her speed.
const MIN_HER_SECONDS = 4;
// One beat's ratio is kept between these (a pause mid-beat, a fumble).
export const RATIO_MIN = 0.5;
export const RATIO_MAX = 2;
// Beats needed before the pace is used.
export const CONFIDENT_BEATS = 3;
// Show-wide: the newest episodes kept.
export const MAX_EPISODES = 12;

export const PERFORMER = 'justawoman';
export const NOT_ENOUGH = "Record a full-episode take with beat markers and I'll learn your pace.";

const r2 = (n) => Math.round(n * 100) / 100;

export function median(list) {
  const xs = (list || []).filter((n) => Number.isFinite(n)).sort((a, b) => a - b);
  if (!xs.length) return null;
  const mid = Math.floor(xs.length / 2);
  return xs.length % 2 ? xs[mid] : (xs[mid - 1] + xs[mid]) / 2;
}

const clampRatio = (r) => Math.min(RATIO_MAX, Math.max(RATIO_MIN, r));

/** Whose lines the take read: "· as Lala" in its name, Lala's clips, else hers. Null for a guest. */
export function takeReader(clip) {
  const as = String(clip?.label || '').match(/·\s*as\s+(.+?)\s*$/i);
  if (as) return as[1];
  if (clip?.performer === 'guest') return null;
  if (clip?.performer === 'lala') return 'Lala';
  return HER;
}

const isReader = (who, reader) => (isHerSpeaker(reader) ? isHerSpeaker(who) || who === HER
  : String(who || '').trim().toLowerCase() === String(reader || '').trim().toLowerCase());

/**
 * A beat's lines as the teleprompter showed them: { herSeconds, otherSeconds,
 * words } (seconds at the standard 150; scene notes count nothing).
 */
export function beatParts(lines = [], reader = HER) {
  let herSeconds = 0;
  let otherSeconds = 0;
  for (const l of teleprompterLines(Array.isArray(lines) ? lines : [], { screen: true })) {
    const s = Number(l.seconds) || 0;
    if (l.kind === 'mine' || l.kind === 'cue') {
      if (isReader(l.who, reader)) herSeconds += s;
      else otherSeconds += s;
    } else if (l.kind === 'screen') {
      otherSeconds += s;
    }
    // 'direction' and 'breath': hidden scene notes, no time.
  }
  return { herSeconds, otherSeconds, words: Math.round((herSeconds * WORDS_PER_MINUTE) / 60) };
}

/**
 * The real time of each beat a take read: [{ beat, seconds }]. Beats at
 * 0:00 and beats not reached are left out here; beats only gone past are
 * left out by learnedPace (it knows the estimate).
 */
export function takeBeatTimes(clip) {
  if (!clip) return [];
  const length = Number(clip.duration_seconds);
  if (isFullTake(clip)) {
    const real = realMarks(marksOf(clip));
    if (!real.length) return [];
    const out = [];
    real.forEach((m, i) => {
      if (m.t < AT_START) return;
      const next = real[i + 1];
      const end = next ? next.t : length;
      if (!(Number.isFinite(end) && end > m.t)) return;
      out.push({ beat: m.beat, seconds: Math.round((end - m.t) * 10) / 10 });
    });
    return out;
  }
  const r = clipRange(clip);
  if (!r || r.source !== 'beat') return [];
  if (Number(clip.start_line) > 0) return [];
  if (!(length > 0)) return [];
  return [{ beat: r.from, seconds: Math.round(length * 10) / 10 }];
}

// The script's own lines: `raw` on a teleprompter beat (its `lines` are the prompter's), else `lines`.
const linesOf = (b) => (Array.isArray(b?.raw) ? b.raw : Array.isArray(b?.lines) ? b.lines : []).filter((l) => typeof l === 'string');

/** The figures from a list of per-beat ratios. */
export function paceFromRatios(ratios, takesUsed = 0) {
  const kept = (ratios || []).filter((r) => Number.isFinite(r) && r > 0).map(clampRatio);
  const factor = median(kept);
  if (factor == null) return { wpm: null, factor: null, beatsUsed: 0, takesUsed: 0, confident: false };
  return {
    wpm: Math.round(WORDS_PER_MINUTE / factor),
    factor: r2(factor),
    beatsUsed: kept.length,
    takesUsed,
    confident: kept.length >= CONFIDENT_BEATS,
  };
}

/**
 * Her pace from one episode's takes. beats: [{ number, lines }] (or `raw`,
 * the teleprompter's). clips: the episode's raw clips. performer: whose
 * takes ('justawoman' by default).
 * { wpm, factor, beatsUsed, takesUsed, confident, ratios, beatTimes }:
 * beatTimes, { [beat]: seconds } (the median of her takes of it), is every
 * beat a take really read, whether or not it told her speed.
 */
export function learnedPace(beats = [], clips = [], { performer = PERFORMER } = {}) {
  const byNumber = new Map((beats || []).filter((b) => b && b.number != null).map((b) => [Number(b.number), linesOf(b)]));
  const ratios = [];
  const takes = new Set();
  const times = new Map();
  for (const clip of clips || []) {
    if (!clip || (clip.performer || PERFORMER) !== performer) continue;
    const reader = takeReader(clip);
    if (!reader) continue;
    for (const { beat, seconds } of takeBeatTimes(clip)) {
      const lines = byNumber.get(beat);
      if (!lines) continue;
      const estimate = beatSeconds(lines);
      if (seconds < MIN_SECONDS || (estimate > 0 && seconds < estimate * SKIPPED_SHARE)) continue;
      if (!times.has(beat)) times.set(beat, []);
      times.get(beat).push(seconds);
      const { herSeconds, otherSeconds } = beatParts(lines, reader);
      if (herSeconds < MIN_HER_SECONDS) continue;
      const left = seconds - otherSeconds;
      if (!(left > 0)) continue;
      ratios.push(left / herSeconds);
      takes.add(clip.id ?? clip);
    }
  }
  const beatTimes = Object.fromEntries([...times].map(([b, list]) => [b, Math.round(median(list))]));
  return { ...paceFromRatios(ratios, takes.size), ratios: ratios.map(r2), beatTimes };
}

/**
 * Show-wide: every episode's ratios together. entries: { [episodeId]:
 * { ratios, takes } } (as kept on the show, lib/readingPaceApi).
 */
export function combinePace(entries = {}) {
  const list = Object.values(entries || {}).filter((e) => e && Array.isArray(e.ratios));
  const takes = list.reduce((n, e) => n + (Number(e.takes) || 0), 0);
  return paceFromRatios(list.flatMap((e) => e.ratios), takes);
}

/** The show-wide entries with this episode's newest figures in (the newest MAX_EPISODES kept). */
export function withEpisode(entries = {}, episodeId, pace, at = new Date().toISOString()) {
  const next = { ...(entries || {}) };
  if (!episodeId) return next;
  if (!pace || !pace.ratios?.length) delete next[episodeId];
  else next[episodeId] = { ratios: pace.ratios, takes: pace.takesUsed, at };
  const ids = Object.keys(next).sort((a, b) => String(next[b].at || '').localeCompare(String(next[a].at || '')));
  ids.slice(MAX_EPISODES).forEach((id) => { delete next[id]; });
  return next;
}

/** The pace the estimates use: { wpm, reader } when learned and on, else null (the standard). */
export const activePace = (pace, use = 'mine') => (use !== 'standard' && pace?.confident && pace.wpm > 0 ? { wpm: pace.wpm, reader: HER } : null);

/** "Your pace: 172 words/min (from 2 takes)". */
export function paceText(pace) {
  if (!pace?.confident) return NOT_ENOUGH;
  const n = pace.takesUsed;
  return `Your pace: ${pace.wpm} words/min (from ${n} take${n === 1 ? '' : 's'})`;
}

/** "1:05" for a beat's time. */
export function beatClock(seconds) {
  const s = Math.max(0, Math.round(Number(seconds) || 0));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/**
 * A teleprompter line's time at her pace (lib/teleprompterLines `seconds`
 * are at the standard 150): spoken lines, hers and the cues she waits
 * through, scaled; moments and notes as they are. `pace`: { wpm } or null.
 */
export function promptSeconds(line, pace = null) {
  const s = Number(line?.seconds) || 0;
  const wpm = Number(pace?.wpm);
  if (!(wpm > 0) || (line?.kind !== 'mine' && line?.kind !== 'cue')) return s;
  return (s * WORDS_PER_MINUTE) / wpm;
}
