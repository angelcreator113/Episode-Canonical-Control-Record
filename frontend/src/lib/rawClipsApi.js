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
  upload: (episodeId, file, { performer, greenScreen = false, guestName, strength } = {}, onProgress) => {
    const form = new FormData();
    form.append('video', file);
    form.append('performer', performer);
    form.append('green_screen', greenScreen ? 'true' : 'false');
    if (guestName) form.append('guest_name', guestName);
    if (strength) form.append('strength', strength);
    return api.post(base(episodeId), form, {
      timeout: 0, // a big clip can take longer than the client's usual 3 minutes
      onUploadProgress: (e) => { if (onProgress && e.total) onProgress(Math.round((e.loaded / e.total) * 100)); },
    }).then((r) => r.data?.data);
  },
  update: (episodeId, clipId, changes) => api.patch(`${base(episodeId)}/${clipId}`, changes).then((r) => r.data?.data),
  removeGreen: (episodeId, clipId, strength) => api.post(`${base(episodeId)}/${clipId}/remove-green`, { strength }).then((r) => r.data?.data),
  remove: (episodeId, clipId) => api.delete(`${base(episodeId)}/${clipId}`).then(() => true),
};

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
