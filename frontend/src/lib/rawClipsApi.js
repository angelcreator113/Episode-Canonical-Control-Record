/**
 * The episode's raw clips (Assets → Files; Evoni, 2026-10-17):
 * /api/v1/episode-clips/:episodeId. Upload sends one clip as multipart
 * (field "video") with who is on camera and whether it was filmed on a
 * green screen; the server keeps the original and, for green screen, makes
 * a cut-out in the background.
 */
import api from '../services/api';

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

export const rawClipsApi = {
  list: (episodeId) => api.get(base(episodeId)).then((r) => (Array.isArray(r.data?.data) ? r.data.data : [])),
  // label: the clip's name in Files (the teleprompter names each take; Evoni, 2026-10-20).
  upload: (episodeId, file, { performer, greenScreen = false, guestName, strength, label } = {}, onProgress) => {
    const form = new FormData();
    form.append('video', file);
    form.append('performer', performer);
    form.append('green_screen', greenScreen ? 'true' : 'false');
    if (guestName) form.append('guest_name', guestName);
    if (strength) form.append('strength', strength);
    if (label) form.append('label', label);
    return api.post(base(episodeId), form, {
      timeout: 0, // a big clip can take longer than the client's usual 3 minutes
      onUploadProgress: (e) => { if (onProgress && e.total) onProgress(Math.round((e.loaded / e.total) * 100)); },
    }).then((r) => r.data?.data);
  },
  /**
   * A teleprompter take (Teleprompter audit 5, 8, 14; 2026-10-24): the beat,
   * start line, beat markers and the take's own length go with the upload,
   * one request. keepSession: an expired sign-in never leaves the page (the
   * take exists only here) and the file is never sent twice by itself.
   * Resolves { clip, stored }: stored is the set of start_line / beat_marks
   * the server kept, or null from a server that does not take them yet (then
   * the caller links them with update(), as before).
   */
  uploadTake: (episodeId, file, { performer, guestName, label, beatNumber, startLine, beatMarks, seconds } = {}, onProgress) => {
    const form = new FormData();
    form.append('video', file);
    form.append('performer', performer);
    form.append('green_screen', 'false');
    if (guestName) form.append('guest_name', guestName);
    if (label) form.append('label', label);
    if (Number.isInteger(beatNumber) && beatNumber >= 1 && beatNumber <= 14) form.append('beat_number', String(beatNumber));
    if (Number.isInteger(startLine) && startLine >= 0) form.append('start_line', String(startLine));
    if (Array.isArray(beatMarks)) form.append('beat_marks', JSON.stringify(beatMarks));
    if (Number(seconds) > 0 && Number(seconds) <= 36000) form.append('seconds', String(Math.round(Number(seconds) * 100) / 100));
    return api.post(base(episodeId), form, {
      timeout: 0,
      keepSession: true,
      onUploadProgress: (e) => { if (onProgress && e.total) onProgress(Math.round((e.loaded / e.total) * 100)); },
    }).then((r) => ({ clip: r.data?.data, stored: Array.isArray(r.data?.stored) ? new Set(r.data.stored) : null }));
  },
  // A cheap signed-in request before a big upload, so the sign-in is fresh
  // (refreshed here if it had expired) and never wiped while a take is unsaved.
  checkSession: (episodeId) => api.get(base(episodeId), { keepSession: true }).then((r) => (Array.isArray(r.data?.data) ? r.data.data : [])),
  update: (episodeId, clipId, changes, { keepSession = false } = {}) => api.patch(`${base(episodeId)}/${clipId}`, changes, keepSession ? { keepSession: true } : undefined).then((r) => r.data?.data),
  // Stars a take for its beat; the server un-stars the beat's other takes.
  favorite: (episodeId, clipId, on) => api.patch(`${base(episodeId)}/${clipId}`, { is_favorite: !!on }).then((r) => r.data?.data),
  removeGreen: (episodeId, clipId, strength) => api.post(`${base(episodeId)}/${clipId}/remove-green`, { strength }).then((r) => r.data?.data),
  remove: (episodeId, clipId) => api.delete(`${base(episodeId)}/${clipId}`).then(() => true),
  // The episode's scenes (canonical beats) a clip can be linked to.
  beats: (episodeId) => api.get(`/api/v1/episode-brief/${episodeId}/plan`)
    .then((r) => (Array.isArray(r.data?.data) ? r.data.data : []).map((b) => ({ beat_number: b.beat_number, beat_name: b.beat_name || null }))),
};

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

/**
 * Whether the server sends a clip's favourite and start line (Teleprompter
 * batch 2): only once migration 20261020090000 has run, so the ★ hides
 * until then.
 */
export const hasTakeFields = (clip) => !!clip && typeof clip === 'object' && 'is_favorite' in clip;

/**
 * A failed upload or link in plain words, the take kept (Teleprompter audit 5).
 * Null when the error is not about the sign-in.
 */
export function signInMessage(err) {
  if (err?.authRefreshed) return 'Your sign-in had expired and is renewed now. Press Retry to upload the take.';
  if (err?.sessionExpired) return 'Your sign-in expired. Sign in in another tab, then press Retry here. The take is kept.';
  return null;
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
