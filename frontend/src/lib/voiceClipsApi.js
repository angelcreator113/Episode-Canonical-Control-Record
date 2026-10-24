/**
 * Voice clips (Teleprompter batch 3; Evoni, 2026-10-20): lines of the script
 * she records in Lala's voice (or anyone's), for the teleprompter to play
 * when she reads opposite them. /api/v1/script-voice-clips/:episodeId.
 * A clip names its line by beat_number and line_index, the line's place
 * among the beat's teleprompter lines (lib/teleprompterLines), and keeps
 * line_text, the words when it was recorded.
 *
 * Until the database update (migration 20261020120000) has run, the server
 * answers 409 with code MIGRATION_PENDING; the pages then hide recording and
 * say so plainly (VOICE_NOT_READY).
 */
import api from '../services/api';

const base = (episodeId) => `/api/v1/script-voice-clips/${episodeId}`;

export const VOICE_NOT_READY = "Voice clips aren't switched on yet: the database update that adds them hasn't run.";

/** Whether a request failed because the database update has not run. */
export const isNotReady = (err) => err?.response?.status === 409 && err?.response?.data?.code === 'MIGRATION_PENDING';

/** The first audio type this browser records (MP4 first: Safari and iPhone play it). */
export const VOICE_TYPES = ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus'];
export function pickVoiceType(Recorder = typeof window !== 'undefined' ? window.MediaRecorder : undefined) {
  if (!Recorder || typeof Recorder.isTypeSupported !== 'function') return '';
  return VOICE_TYPES.find((t) => {
    try { return Recorder.isTypeSupported(t); } catch (err) { console.error('[voiceClips] isTypeSupported failed:', err); return false; }
  }) || '';
}

/** The clip's file extension from its type. */
export const voiceExtension = (type) => {
  const t = String(type || '');
  if (/mp4|m4a|aac/i.test(t)) return '.m4a';
  if (/ogg/i.test(t)) return '.ogg';
  return '.webm';
};

export const voiceClipsApi = {
  list: (episodeId) => api.get(base(episodeId)).then((r) => (Array.isArray(r.data?.data) ? r.data.data : [])),
  /**
   * Saves a take as the line's clip (the line's earlier clip is replaced).
   * take: { blob, type, seconds }; line: { beatNumber, lineIndex, speaker, text }.
   */
  upload: (episodeId, take, line) => {
    const form = new FormData();
    const type = take.type || take.blob?.type || 'audio/webm';
    form.append('audio', take.blob, `voice-beat-${line.beatNumber}-line-${line.lineIndex + 1}${voiceExtension(type)}`);
    form.append('beat_number', String(line.beatNumber));
    form.append('line_index', String(line.lineIndex));
    form.append('speaker', line.speaker);
    form.append('line_text', line.text);
    if (Number(take.seconds) > 0) form.append('duration_seconds', String(Math.round(take.seconds * 100) / 100));
    return api.post(base(episodeId), form, { timeout: 0 }).then((r) => r.data?.data);
  },
  remove: (episodeId, clipId) => api.delete(`${base(episodeId)}/${clipId}`).then(() => true),
};

/** "8:3", a line's key in clipsByLine. */
export const lineKey = (beatNumber, lineIndex) => `${Number(beatNumber)}:${Number(lineIndex)}`;

/** The clips by line (lineKey), one each. */
export function clipsByLine(clips) {
  const m = new Map();
  (clips || []).forEach((c) => m.set(lineKey(c.beat_number, c.line_index), c));
  return m;
}

/** The clips after saving `clip` as its line's one (the line's old clip goes). */
export const withClip = (clips, clip) => [
  ...(clips || []).filter((c) => lineKey(c.beat_number, c.line_index) !== lineKey(clip.beat_number, clip.line_index)),
  clip,
];

const words = (t) => String(t || '').replace(/\s+/g, ' ').trim();

/** Whether the line's words changed since the clip was recorded. */
export const isStale = (clip, text) => !!clip && words(clip.line_text) !== words(text);

/**
 * The clip to play for a line (Script tab audit 6, 2026-10-24): the one
 * recorded at its place when its words are still the line's; else one in
 * the same beat recorded with these words (the line moved); else null, so a
 * changed line never plays the old recording. `byLine`: clipsByLine's map.
 */
export function clipForLine(byLine, beatNumber, lineIndex, text) {
  const at = byLine?.get?.(lineKey(beatNumber, lineIndex)) || null;
  if (at && !isStale(at, text)) return at;
  for (const c of byLine?.values?.() || []) {
    if (Number(c.beat_number) === Number(beatNumber) && !isStale(c, text)) return c;
  }
  return null;
}

/** The clip's length in seconds, or null when unknown. */
export const clipSeconds = (clip) => {
  const s = Number(clip?.duration_seconds);
  return Number.isFinite(s) && s > 0 ? s : null;
};

/** A microphone or recording problem in plain words, or null when recording can start. */
export function voiceProblem(win = typeof window !== 'undefined' ? window : {}) {
  if (win.isSecureContext === false) return 'Recording needs a secure page (https).';
  if (!win.navigator?.mediaDevices?.getUserMedia) return "This browser can't use the microphone here.";
  if (typeof win.MediaRecorder === 'undefined') return "This browser can't record audio.";
  return null;
}

/** getUserMedia's error in plain words, for the microphone. */
export function micErrorMessage(err) {
  switch (err?.name) {
    case 'NotAllowedError':
    case 'PermissionDeniedError':
    case 'SecurityError':
      return 'The microphone is blocked. Allow it for this site in the browser, then try again.';
    case 'NotFoundError':
    case 'DevicesNotFoundError':
      return 'No microphone was found.';
    case 'NotReadableError':
    case 'TrackStartError':
    case 'AbortError':
      return 'The microphone is in use by another app. Close it and try again.';
    default:
      return "The microphone couldn't start.";
  }
}
