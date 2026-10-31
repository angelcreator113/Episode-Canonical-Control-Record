/**
 * The episode's raw clips (Assets → Files; Evoni, 2026-10-17):
 * /api/v1/episode-clips/:episodeId. Upload sends one clip, in 8 MB parts
 * straight to the video storage (sendInParts; 2026-10-27), with who is on
 * camera and whether it was filmed on a green screen; the server keeps the
 * original and, for green screen, makes a cut-out in the background.
 */
import api from '../services/api';
import { PART_SIZE, uploadInParts, makeThumbnail } from './chunkedUpload';
import { probeVideo, lengthWritable } from './videoProbe';
import { withDuration } from './takeDuration';

const base = (episodeId) => `/api/v1/episode-clips/${episodeId}`;

export const PERFORMERS = [
  { key: 'lala', label: 'Lala', greenByDefault: true },
  { key: 'justawoman', label: 'JustAWoman', greenByDefault: false },
  { key: 'guest', label: 'Guest', greenByDefault: false },
];

export const STRENGTHS = [
  { key: 'low', label: 'Gentle' },
  { key: 'medium', label: 'Normal' },
  { key: 'high', label: 'Strong' },
];

const isBeat = (n) => Number.isInteger(n) && n >= 1 && n <= 14;
const isPixels = (n) => Number.isInteger(n) && n >= 1 && n <= 16384;

/**
 * The fields of a take or clip as the server reads them (the one-request
 * upload's names). width/height: the browser's measure (lib/videoProbe),
 * used by the server when ffprobe can't read the file. endBeatNumber: the
 * beat the clip ends on, sent only with its start beat.
 */
export function uploadFields({ performer, greenScreen = false, guestName, strength, label, beatNumber, endBeatNumber, startLine, beatMarks, seconds, width, height } = {}) {
  const out = { performer, green_screen: greenScreen ? 'true' : 'false' };
  if (guestName) out.guest_name = guestName;
  if (strength) out.strength = strength;
  if (label) out.label = label;
  if (isBeat(beatNumber)) out.beat_number = beatNumber;
  if (isBeat(beatNumber) && isBeat(endBeatNumber) && endBeatNumber >= beatNumber) out.end_beat_number = endBeatNumber;
  if (Number.isInteger(startLine) && startLine >= 0) out.start_line = startLine;
  if (Array.isArray(beatMarks)) out.beat_marks = JSON.stringify(beatMarks);
  if (Number(seconds) > 0 && Number(seconds) <= 36000) out.seconds = Math.round(Number(seconds) * 100) / 100;
  if (isPixels(width) && isPixels(height)) { out.width = width; out.height = height; }
  return out;
}

/**
 * A file ready to upload, measured in the browser (Evoni, 2026-10-28: a
 * 453 MB phone MP4 showed no length, size or picture): { file, seconds,
 * width, height, thumbnail }. An MP4 or WebM whose length is known gets it
 * written into its header (lib/takeDuration), so a phone's player can show
 * and seek it too; the name and type stay. Never throws: what could not be
 * measured is null, and the server measures it instead (or leaves it out).
 */
export async function measureForUpload(file, { knownSeconds = null, probe = probeVideo, writeLength = withDuration } = {}) {
  let m = null;
  try {
    m = await probe(file, { knownSeconds });
  } catch (err) {
    console.error('[rawClipsApi] the video was not measured; uploading it as it is:', err);
  }
  const seconds = Number(m?.seconds) > 0 ? m.seconds : (Number(knownSeconds) > 0 ? knownSeconds : null);
  let out = file;
  if (seconds && lengthWritable(file)) {
    try {
      const written = await writeLength(file, seconds);
      if (written && written !== file) {
        out = typeof File === 'function' ? new File([written], file.name || 'video.mp4', { type: file.type || written.type }) : written;
      }
    } catch (err) {
      console.error('[rawClipsApi] the length was not written into the video; uploading it as it is:', err);
    }
  }
  return { file: out, seconds, width: m?.width ?? null, height: m?.height ?? null, thumbnail: m?.thumbnail ?? null };
}

const uploadsBase = (episodeId, uploadId) => `${base(episodeId)}/uploads${uploadId ? `/${encodeURIComponent(uploadId)}` : ''}`;
const PART_TIMEOUT_MS = 5 * 60 * 1000; // one 8 MB part, even on a slow phone connection

/**
 * Sends a file in parts straight to the video storage (Evoni, 2026-10-27:
 * "ENOSPC" on a 22-minute take). fields: uploadFields(). resume: what an
 * earlier try sent ({ uploadId, clipId, partSize, size, done }), so only
 * the rest goes; onState(state) after every part (null once finished) for
 * the caller to keep. thumbnail: a JPEG data URL, or a function that makes
 * one. A server that no longer knows the upload (restarted, or older than
 * 6 hours) starts it again from the beginning, once. Resolves { clip, stored }.
 */
export async function sendInParts(episodeId, blob, fields, { resume = null, onState, onProgress, thumbnail = null, keepSession = false, sleep } = {}) {
  const cfg = keepSession ? { keepSession: true } : {};
  const usable = resume && resume.uploadId && Number(resume.size) === blob.size && Array.isArray(resume.done);
  if (resume?.uploadId && !usable) {
    console.warn('[rawClipsApi] the upload kept for this take does not fit it; starting again');
    abortUpload(episodeId, resume.uploadId);
  }
  let state = usable ? { ...resume, done: [...resume.done] } : null;
  const keep = (next) => { state = next; onState?.(next); };
  let restarted = false;
  for (let round = 0; ; round += 1) {
    try {
      if (!state) {
        const r = await api.post(uploadsBase(episodeId), {
          ...fields, filename: blob.name || fields.filename || 'take.mp4', content_type: blob.type || 'video/mp4', size: blob.size,
        }, cfg);
        keep({ uploadId: r.data.uploadId, clipId: r.data.clipId, partSize: r.data.partSize || PART_SIZE, size: blob.size, done: [] });
      }
      const st = state;
      await uploadInParts({
        blob, partSize: st.partSize, done: st.done, onProgress, sleep,
        send: (n, slice, onLoaded) => api.put(`${uploadsBase(episodeId, st.uploadId)}/parts/${n}`, slice, {
          ...cfg, timeout: PART_TIMEOUT_MS, headers: { 'Content-Type': 'application/octet-stream' },
          onUploadProgress: (e) => onLoaded?.(e.loaded),
        }),
        onPartDone: (n) => keep({ ...state, done: [...state.done, n] }),
      });
      let thumb = null;
      try { thumb = typeof thumbnail === 'function' ? await thumbnail() : thumbnail; } catch (err) {
        console.warn('[rawClipsApi] thumbnail not made; the server makes one:', err);
      }
      const r = await api.post(`${uploadsBase(episodeId, st.uploadId)}/complete`, { ...(thumb ? { thumbnail: thumb } : {}), size: blob.size, fields }, { ...cfg, timeout: PART_TIMEOUT_MS });
      keep(null);
      return { clip: r.data?.data, stored: Array.isArray(r.data?.stored) ? new Set(r.data.stored) : null };
    } catch (err) {
      const status = err?.response?.status;
      // Parts the server says it does not have: send those again (once or twice).
      if (status === 409 && Array.isArray(err.response.data?.missing) && state && round < 2) {
        console.warn('[rawClipsApi] parts missing at the end, sending them again:', err.response.data.missing);
        const missing = new Set(err.response.data.missing);
        keep({ ...state, done: state.done.filter((n) => !missing.has(n)) });
        continue;
      }
      // The server no longer knows this upload: start again from the beginning, once.
      if (status === 404 && state && !restarted) {
        console.warn('[rawClipsApi] the upload was forgotten by the server; starting it again:', err);
        restarted = true;
        keep(null);
        continue;
      }
      throw err;
    }
  }
}

/** Throws an upload in parts away on the server (best effort; logged). */
export async function abortUpload(episodeId, uploadId) {
  if (!uploadId) return false;
  try {
    await api.delete(uploadsBase(episodeId, uploadId));
    return true;
  } catch (err) {
    console.error('[rawClipsApi] upload not thrown away (the server forgets it within 6 hours):', err);
    return false;
  }
}

export const rawClipsApi = {
  list: (episodeId) => api.get(base(episodeId)).then((r) => (Array.isArray(r.data?.data) ? r.data.data : [])),
  // label: the clip's name in Files (the teleprompter names each take; Evoni, 2026-10-20).
  // Measured in the browser first (length, size, thumbnail; 2026-10-28), its
  // length written into an MP4 or WebM, then sent in parts straight to the
  // video storage; a failed upload is thrown away on the server.
  upload: async (episodeId, file, { performer, greenScreen = false, guestName, strength, label, beatNumber, endBeatNumber } = {}, onProgress, { measure = measureForUpload } = {}) => {
    let state = null;
    try {
      const m = await measure(file);
      const body = m?.file || file;
      const { clip } = await sendInParts(episodeId, body, uploadFields({
        performer, greenScreen, guestName, strength, label, beatNumber, endBeatNumber, seconds: m?.seconds, width: m?.width, height: m?.height,
      }), {
        onProgress, onState: (st) => { state = st; }, thumbnail: m?.thumbnail || (() => makeThumbnail(file)),
      });
      return clip;
    } catch (err) {
      if (state?.uploadId) abortUpload(episodeId, state.uploadId);
      throw err;
    }
  },
  /**
   * A teleprompter take (Teleprompter audit 5, 8, 14; 2026-10-24): the beat,
   * start line, beat markers and the take's own length go with the upload.
   * Sent in 8 MB parts (2026-10-27); opts: sendInParts's resume / onState /
   * thumbnail, so Retry sends only the parts not sent yet. keepSession: an
   * expired sign-in never leaves the page (the take exists only here).
   * Resolves { clip, stored }: stored is the set of start_line / beat_marks
   * the server kept, or null from a server that does not say.
   */
  uploadTake: (episodeId, file, { performer, guestName, label, beatNumber, startLine, beatMarks, seconds, width, height } = {}, onProgress, opts = {}) => sendInParts(
    episodeId, file, uploadFields({ performer, guestName, label, beatNumber, startLine, beatMarks, seconds, width, height }),
    { ...opts, onProgress, keepSession: true },
  ),
  // A cheap signed-in request before a big upload, so the sign-in is fresh
  // (refreshed here if it had expired) and never wiped while a take is unsaved.
  checkSession: (episodeId) => api.get(base(episodeId), { keepSession: true }).then((r) => (Array.isArray(r.data?.data) ? r.data.data : [])),
  update: (episodeId, clipId, changes, { keepSession = false } = {}) => api.patch(`${base(episodeId)}/${clipId}`, changes, keepSession ? { keepSession: true } : undefined).then((r) => r.data?.data),
  // Stars a take for its beat; the server un-stars the beat's other takes.
  favorite: (episodeId, clipId, on) => api.patch(`${base(episodeId)}/${clipId}`, { is_favorite: !!on }).then((r) => r.data?.data),
  removeGreen: (episodeId, clipId, strength) => api.post(`${base(episodeId)}/${clipId}/remove-green`, { strength }).then((r) => r.data?.data),
  // Stops a queued or running green removal (the clip then says "Stopped", with Retry).
  stopGreen: (episodeId, clipId) => api.post(`${base(episodeId)}/${clipId}/stop-green`).then((r) => r.data?.data),
  remove: (episodeId, clipId) => api.delete(`${base(episodeId)}/${clipId}`).then(() => true),
  // The episode's scenes (canonical beats) a clip can be linked to.
  beats: (episodeId) => api.get(`/api/v1/episode-brief/${episodeId}/plan`)
    .then((r) => (Array.isArray(r.data?.data) ? r.data.data : []).map((b) => ({ beat_number: b.beat_number, beat_name: b.beat_name || null }))),
};

/**
 * The beats an upload covers, from the lane's "Starts in" / "Ends in"
 * (each '' or a beat number): { beatNumber, endBeatNumber } for
 * rawClipsApi.upload. No start sends neither; an end that is not after the
 * start is "the same beat" and is not sent (2026-10-30, Voice plan V1).
 */
export function uploadBeats(start, end) {
  const s = start === '' || start == null ? null : Number(start);
  if (!isBeat(s)) return {};
  const e = end === '' || end == null ? null : Number(end);
  return isBeat(e) && e > s ? { beatNumber: s, endBeatNumber: e } : { beatNumber: s };
}

/** The "Ends in" choices for an upload: the scenes after the start (none until a start is chosen). */
export const uploadEndChoices = (scenes, start) => (start === '' || start == null ? [] : (scenes || []).filter((sc) => sc.value > Number(start)));

/**
 * Whether an upload asked for an end beat the server didn't keep (its
 * database update, 20261028120000, hasn't run): the clip is saved either way.
 */
export const endBeatNotKept = (clip, { endBeatNumber } = {}) => isBeat(endBeatNumber) && !!clip && Number(clip.end_beat_number) !== endBeatNumber;

/** The scene choices for a clip: the episode's beats, or Beats 1-14 when it has no plan yet. */
export function sceneChoices(beats) {
  const named = new Map((beats || []).map((b) => [Number(b.beat_number), b.beat_name]));
  return Array.from({ length: 14 }, (_, i) => {
    const n = i + 1;
    return { value: n, label: named.get(n) ? `${n}. ${named.get(n)}` : `Beat ${n}` };
  });
}

/** "1:05" from seconds; null when unknown. */
export function clipLength(seconds) {
  const s = Number(seconds);
  if (!Number.isFinite(s) || s <= 0) return null;
  const total = Math.round(s);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const sec = String(total % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`;
}

/** "84 MB" / "1.2 GB" from bytes; null when unknown. */
export function clipSize(bytes) {
  const b = Number(bytes);
  if (!Number.isFinite(b) || b <= 0) return null;
  if (b >= 1024 ** 3) return `${(b / 1024 ** 3).toFixed(1)} GB`;
  if (b >= 1024 ** 2) return `${Math.round(b / 1024 ** 2)} MB`;
  return `${Math.max(1, Math.round(b / 1024))} KB`;
}

/** Whether any clip is still waiting on green removal (the tab polls while so). */
export const anyKeying = (clips) => clips.some((c) => c.key_status === 'queued' || c.key_status === 'processing');

/** A length of time in words: "under a minute", "14 min", "1 h 5 min". */
export function minutesText(seconds) {
  const m = Math.round(Number(seconds) / 60);
  if (!Number.isFinite(m) || m < 1) return 'under a minute';
  return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60} min` : ''}`;
}

/**
 * How far a clip's green removal has got, in words (Evoni, 2026-10-30: "no
 * way of knowing how long"): { percent, text }, or null when it isn't
 * running. With the server's progress (key_progress): "42% · about 15 min
 * left", or the time so far until there is a pace to go on. Without it (the
 * server restarted, or an older server): the time since it started.
 */
export function keyingProgress(clip, now = Date.now()) {
  if (!clip || clip.key_status !== 'processing') return null;
  const p = clip.key_progress;
  if (p && p.percent != null) {
    const tail = p.eta_seconds != null ? `about ${minutesText(p.eta_seconds)} left` : `${minutesText(p.elapsed_seconds)} so far`;
    return { percent: p.percent, text: `${p.percent}% · ${tail}` };
  }
  const started = Date.parse(clip.key_started_at);
  if (!Number.isFinite(started)) return null;
  return { percent: null, text: `Started ${minutesText((now - started) / 1000)} ago` };
}

/**
 * Whether the server sends a clip's favourite and start line (Teleprompter
 * batch 2): only once migration 20261020090000 has run, so the ★ hides
 * until then.
 */
export const hasTakeFields = (clip) => !!clip && typeof clip === 'object' && 'is_favorite' in clip;

/**
 * Whether the server keeps the beat a clip ends on (2026-10-28): only once
 * migration 20261028120000 has run, so the "ends on" picker shows then.
 */
export const hasEndBeatField = (clip) => !!clip && typeof clip === 'object' && 'end_beat_number' in clip;

/**
 * A failed upload or link in plain words, the take kept (Teleprompter audit 5).
 * Null when the error is not about the sign-in.
 */
export function signInMessage(err) {
  if (err?.authRefreshed) return 'Your sign-in had expired and is renewed now. Press Retry to upload the take.';
  if (err?.sessionExpired) return 'Your sign-in expired. Sign in in another tab, then press Retry here. The take is kept.';
  return null;
}

const KEPT_NOTE = {
  phone: 'Your take is still safe on this phone — tap Retry.',
  page: 'Your take is still here — keep this page open and tap Retry.',
};
// Looks like a system code or a programmer's message, not words for Evoni.
const RAW_CODE = /\b(E[A-Z]{3,}|errno|ECONN\w*|syscall|undefined|TypeError|AccessDenied|NoSuch\w+|\d{3} \w+Error)\b|^[A-Z_]{4,}$|[{}<>]/;

/**
 * A failed upload in plain words, never a raw code (2026-10-27). kept:
 * 'phone' (the take is kept on this phone: say so), 'page' (only while the
 * page stays open), or null (nothing to add: a file on her computer). The
 * server's own message is used when it is plain; the 507 one already says
 * the take is safe.
 */
export function uploadErrorMessage(err, { kept = null } = {}) {
  const note = kept ? KEPT_NOTE[kept] : null;
  const withNote = (text) => (note && !/still (safe|here)/.test(text) ? `${text} ${note}` : text);
  const auth = signInMessage(err);
  if (auth) return auth;
  const status = err?.response?.status;
  const server = err?.response?.data?.error;
  // Too big: Retry would not help, so no Retry note.
  if (status === 413) return typeof server === 'string' && !RAW_CODE.test(server) ? server : `The ${kept ? 'take' : 'video'} is too big to upload.`;
  if (typeof server === 'string' && server.trim() && !RAW_CODE.test(server)) return withNote(server.trim());
  if (status === 507) return 'The server ran out of room while saving this take. Your take is still safe on this phone — tap Retry later.';
  if (!status) return withNote('The connection dropped while saving.');
  if (status >= 500) return withNote('The server had a problem saving it.');
  return withNote(kept ? 'The take was not saved.' : 'The upload did not go through. Try again.');
}

/** The episode's takes for one beat (any raw clip linked to it), oldest first. */
export const beatTakes = (clips, beatNumber) => (beatNumber == null ? [] : (clips || []).filter((c) => Number(c.beat_number) === Number(beatNumber)));

/**
 * The clips after starring (on) or un-starring one: one favourite per beat,
 * as the server keeps it. Clips without the field are left alone.
 */
export function withFavorite(clips, clipId, on, row = null) {
  const target = (clips || []).find((c) => c.id === clipId);
  const beat = target ? Number(target.beat_number) : null;
  return (clips || []).map((c) => {
    if (c.id === clipId) return { ...c, ...(row || {}), is_favorite: !!on };
    if (on && hasTakeFields(c) && beat != null && Number(c.beat_number) === beat) return { ...c, is_favorite: false };
    return c;
  });
}
