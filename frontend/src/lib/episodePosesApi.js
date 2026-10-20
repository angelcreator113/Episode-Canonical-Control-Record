/**
 * The episode's character poses (Files › Character poses; Evoni,
 * 2026-10-20): /api/v1/episode-poses/:episodeId. Photos of Lala and
 * JustAWoman labelled Front, Back, Side or Glamour. Upload sends one photo
 * as multipart (field "image") with the character and the pose; the server
 * keeps the original and, in the background, makes the enhanced photo and
 * the cut-out (background removed, edges cleaned).
 */
import api from '../services/api';

const base = (episodeId) => `/api/v1/episode-poses/${episodeId}`;

export const CHARACTERS = [
  { key: 'lala', label: 'Lala' },
  { key: 'justawoman', label: 'JustAWoman' },
];

export const POSES = [
  { key: 'front', label: 'Front' },
  { key: 'back', label: 'Back' },
  { key: 'side', label: 'Side' },
  { key: 'glamour', label: 'Glamour' },
];

// What the server reads: JPG, PNG, WebP, AVIF (no HEIC).
export const PHOTO_ACCEPT = 'image/jpeg,image/png,image/webp,image/avif';
export const isPhoto = (file) => /^image\/(jpeg|png|webp|avif)$/.test(file?.type || '') || /\.(jpe?g|png|webp|avif)$/i.test(file?.name || '');

export const episodePosesApi = {
  list: (episodeId) => api.get(base(episodeId)).then((r) => (Array.isArray(r.data?.data) ? r.data.data : [])),
  upload: (episodeId, file, { characterKey, pose }, onProgress) => {
    const form = new FormData();
    form.append('image', file);
    form.append('character_key', characterKey);
    form.append('pose', pose);
    return api.post(base(episodeId), form, {
      timeout: 0,
      onUploadProgress: (e) => { if (onProgress && e.total) onProgress(Math.round((e.loaded / e.total) * 100)); },
    }).then((r) => r.data?.data);
  },
  update: (episodeId, poseId, changes) => api.patch(`${base(episodeId)}/${poseId}`, changes).then((r) => r.data?.data),
  reprocess: (episodeId, poseId) => api.post(`${base(episodeId)}/${poseId}/reprocess`).then((r) => r.data?.data),
  remove: (episodeId, poseId) => api.delete(`${base(episodeId)}/${poseId}`).then(() => true),
};

/** Whether any photo is still being processed (the panel polls while so). */
export const anyProcessing = (rows) => (rows || []).some((p) => p.status === 'queued' || p.status === 'processing');

/** The photos of one character and pose: the default first, then newest. */
export function photosFor(rows, characterKey, pose) {
  return (rows || [])
    .filter((p) => p.character_key === characterKey && p.pose === pose)
    .sort((a, b) => (Number(b.is_default) - Number(a.is_default)) || String(b.created_at || '').localeCompare(String(a.created_at || '')));
}

/**
 * What processing did, in a few words: "Upscaled x2", or why it did not
 * upscale ("upscaling is not set up on the server"). null when there is
 * nothing to say.
 */
export function stepsNote(steps) {
  const up = steps?.upscale;
  if (!up || up === 'not needed') return null;
  if (/^x\d$/.test(up)) return `Upscaled ${up}`;
  return `Not upscaled: ${String(up).replace(/^skipped:\s*/, '')}`;
}
