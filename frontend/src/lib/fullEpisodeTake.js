/**
 * "Record whole episode" (Evoni, 2026-10-23: "I need to be able to record
 * the script in one go"). One video for the whole script, saved to the
 * episode's Files as "Full episode · take n", with beat markers: the time,
 * in take time (paused time left out), at which each beat's heading reached
 * the reading line, [{ beat, t }] in seconds to one decimal. The server
 * keeps them in episode_raw_clips.beat_marks once migration 20261023235900
 * has run; until then the clip comes back without the field and the
 * markers can be downloaded instead. Pure: no React, no network.
 */

import { takeStamp } from './teleprompterLines';

export const FULL_LABEL = 'Full episode';
// About 19 MB a minute: an hour is a little over 1 GB.
export const FULL_BITRATE = 2_500_000;
const AUDIO_BITRATE = 128_000;
// Takes go up in 8 MB parts straight to the video storage (2026-10-27), so
// the limit is the server's 5 GB for one clip, not the old 500 MB.
export const UPLOAD_LIMIT_MB = 5 * 1024;
export const UPLOAD_LIMIT_TEXT = '5 GB';
export const WARN_BYTES = 4.5 * 1024 * 1024 * 1024;
// Teleprompter audit 1 (2026-10-24): a take stops by itself here, so it can
// still be saved (the server refuses one over 5 GB).
export const STOP_BYTES = 4.9 * 1024 * 1024 * 1024;
export const LIMIT_NOTE = 'Stopped at the 5 GB limit — saved takes must be under 5 GB.';

/** What the take's pause is about (useTakeRecorder `interrupted`), or null. */
export function interruptNote(why) {
  if (why === 'away') return 'The take paused while the phone was away — Resume or Stop & review.';
  if (why === 'muted') return 'The phone paused the camera or microphone — Resume or Stop & review.';
  if (why === 'ended') return 'The camera or microphone stopped — Stop & review to keep what was recorded.';
  return null;
}
export const MAX_MARKS = 30;
export const MARKS_NOT_KEPT = 'Saved. Beat markers will be kept once the database update runs.';

/** "Full episode · take 2" (and " · as Lala" when she reads as someone else). */
export const fullTakeName = (n, as = null) => `${FULL_LABEL} · take ${n}${as ? ` · as ${as}` : ''}`;

const FULL_NAME = /^Full episode · take \d+/;

/** A full-episode take: it has beat markers, or its name says so. */
export const isFullTake = (clip) => !!clip && (Array.isArray(clip.beat_marks) || FULL_NAME.test(String(clip.label || '')));

/** The episode's full-episode takes, oldest first (as listed). */
export const fullTakes = (clips) => (clips || []).filter(isFullTake);

/** Whether the server keeps beat markers yet (the clip row has the field). */
export const hasMarksField = (clip) => !!clip && typeof clip === 'object' && 'beat_marks' in clip;

/** Seconds to one decimal. */
export const markTime = (seconds) => Math.round(Math.max(0, Number(seconds) || 0) * 10) / 10;

/**
 * Markers as the server takes them: beats 1-14, each once (its first time),
 * times from 0 to 10 hours, sorted by time, at most 30.
 */
export function cleanMarks(marks) {
  const seen = new Set();
  return (Array.isArray(marks) ? marks : [])
    .map((m) => ({ beat: Number(m?.beat), t: markTime(m?.t) }))
    .filter((m) => Number.isInteger(m.beat) && m.beat >= 1 && m.beat <= 14 && m.t <= 36000)
    .filter((m) => (seen.has(m.beat) ? false : (seen.add(m.beat), true)))
    .sort((a, b) => a.t - b.t || a.beat - b.beat)
    .slice(0, MAX_MARKS);
}

/** "1:05.3" for a marker; "1:02:05.3" past an hour. */
export function markClock(t) {
  const s = markTime(t);
  const whole = Math.floor(s);
  const tenth = Math.round((s - whole) * 10) % 10;
  const h = Math.floor(whole / 3600);
  const m = Math.floor((whole % 3600) / 60);
  const sec = String(whole % 60).padStart(2, '0');
  return `${h ? `${h}:${String(m).padStart(2, '0')}` : m}:${sec}.${tenth}`;
}

/** The size a take has reached: what was recorded, else an estimate from its length and bit rate. */
export const takeBytes = (bytes, seconds, bitrate = FULL_BITRATE) => (bytes > 0 ? bytes : Math.max(0, Number(seconds) || 0) * ((bitrate + AUDIO_BITRATE) / 8));

/** "≈ 84 MB". */
export function sizeText(bytes) {
  const mb = (Number(bytes) || 0) / (1024 * 1024);
  if (mb >= 1024) return `≈ ${(mb / 1024).toFixed(1)} GB`;
  return `≈ ${Math.max(1, Math.round(mb))} MB`;
}

/**
 * The markers file's name: "Full episode - take 2 - 2026-10-27 14-58 - beat
 * markers.txt" (the dots kept file-safe; `at`, when the take was recorded,
 * keeps two takes' files apart).
 */
export const marksFileName = (label, at = null) => {
  const stamp = at != null ? takeStamp(at) : null;
  return `${String(label || FULL_LABEL).replace(/[\\/:*?"<>|]+/g, '-').replace(/\s*·\s*/g, ' - ')}${stamp ? ` - ${stamp}` : ''} - beat markers.txt`;
};

/** The markers as a text file she can keep: one line a beat, then the same as JSON. */
export function marksText(label, marks, episodeTitle = null) {
  const clean = cleanMarks(marks);
  return [
    `${label || FULL_LABEL}${episodeTitle ? ` · ${episodeTitle}` : ''}`,
    'Beat markers (time in the take):',
    ...clean.map((m) => `Beat ${m.beat}\t${markClock(m.t)}`),
    '',
    `beat_marks: ${JSON.stringify(clean)}`,
    '',
  ].join('\n');
}
