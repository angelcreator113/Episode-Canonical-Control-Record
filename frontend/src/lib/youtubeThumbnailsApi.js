/**
 * YouTube thumbnails (Templates › YouTube thumbnails; Evoni, 2026-10-17):
 * /api/v1/youtube-thumbnails. An episode's 1280x720 thumbnail from its
 * show's style; the server renders it, so the preview is the saved file.
 * The one place an episode's thumbnail is edited (Evoni, 2026-10-20): every
 * other page links here with thumbnailStudioHref.
 */
import api from '../services/api';
import { fetchAllEpisodes } from './fetchAllPages';

const base = '/api/v1/youtube-thumbnails';

export { thumbnailStudioHref } from './thumbnailStudioHref';

export const LAYOUTS = [
  { key: 'lala-left', label: 'Lala left' },
  { key: 'lala-right', label: 'Lala right' },
  { key: 'center', label: 'Title only' },
];

// The LalaVerse palette for the accent (the show's name, the badge, the
// bottom stripe) and the title's colour.
export const ACCENTS = ['#E0689F', '#C2407F', '#B8962E', '#E6C98F', '#A46EE0', '#2BB5AD'];
export const TEXT_COLORS = [
  { value: '#FFFFFF', label: 'White' },
  { value: '#FDF4E3', label: 'Cream' },
  { value: '#FFE9A8', label: 'Gold' },
];

/** The request: the spec as JSON, and the uploaded pictures when there are any. */
export function renderForm(spec, files = {}) {
  const form = new FormData();
  form.append('spec', JSON.stringify(spec));
  if (files.background) form.append('background', files.background);
  if (files.lala) form.append('lala', files.lala);
  if (files.jaw) form.append('jaw', files.jaw);
  return form;
}

/**
 * The pose a thumbnail starts from: the starred one of the first pose
 * that has one, in the order Glamour, Front, Side, Back; else the newest
 * of those. null when the character has no ready pose.
 */
export function defaultPose(poses) {
  const list = poses || [];
  for (const key of ['glamour', 'front', 'side', 'back']) {
    const starred = list.find((p) => p.pose === key && p.isDefault);
    if (starred) return starred;
  }
  for (const key of ['glamour', 'front', 'side', 'back']) {
    const any = list.find((p) => p.pose === key);
    if (any) return any;
  }
  return null;
}

/**
 * The Studio's picture folders (sources.folders; Evoni, 2026-10-21): each
 * { key, label, folders?, items? }. folderPath gives the folders from the
 * top down to the one with this key ([] when there is none), so a picker
 * can show where it is and step back.
 */
export function folderPath(tree, key) {
  if (!key) return [];
  for (const f of tree || []) {
    if (f.key === key) return [f];
    const below = folderPath(f.folders, key);
    if (below.length) return [f, ...below];
  }
  return [];
}

/** How many pictures a folder holds, its subfolders' included. */
export const folderCount = (f) => (f?.items || []).length + (f?.folders || []).reduce((n, sub) => n + folderCount(sub), 0);

/** The first picture in a folder or under it: the folder's cover. */
export function folderCover(f) {
  if (f?.items?.length) return f.items[0].url;
  for (const sub of f?.folders || []) {
    const url = folderCover(sub);
    if (url) return url;
  }
  return null;
}

/** The first of these folder keys that the tree has, else null (the top). */
export const firstFolder = (tree, keys) => (keys || []).find((k) => folderPath(tree, k).length) || null;

/** The thumbnail's words for an episode: its title, the show's name, "EP n". */
export function episodeWords(episode, show) {
  const n = episode?.episode_number;
  return {
    title: episode?.title || '',
    kicker: show?.name || '',
    badge: n || n === 0 ? `EP ${n}` : '',
  };
}

/**
 * The episode's current thumbnail, { id, url }, from the editor's saved
 * list (queries only migrated columns), or null when it has none. Pages
 * that show or count the thumbnail read this, with episodes.thumbnail_url
 * first; the older /api/v1/thumbnails reads select model-only columns and
 * fail on a database built from the migrations.
 */
export async function currentThumbnail(episodeId) {
  if (!episodeId) return null;
  const saved = await youtubeThumbnailsApi.saved(episodeId);
  const primary = saved.find((t) => t.isPrimary);
  return primary ? { id: primary.id, url: primary.url } : null;
}

export const youtubeThumbnailsApi = {
  sources: (episodeId) => api.get(`${base}/episodes/${episodeId}/sources`).then((r) => r.data?.data),
  render: (spec, files) => api.post(`${base}/render`, renderForm(spec, files), { responseType: 'blob', timeout: 60000 }).then((r) => r.data),
  save: (episodeId, spec, files) => api.post(`${base}/episodes/${episodeId}`, renderForm(spec, files), { timeout: 60000 }).then((r) => r.data?.data),
  saved: (episodeId) => api.get(`${base}/episodes/${episodeId}/saved`).then((r) => (Array.isArray(r.data?.data) ? r.data.data : [])),
  makePrimary: (episodeId, thumbnailId) => api.post(`${base}/episodes/${episodeId}/saved/${thumbnailId}/primary`).then((r) => r.data?.data),
  removeSaved: (episodeId, thumbnailId) => api.delete(`${base}/episodes/${episodeId}/saved/${thumbnailId}`).then((r) => r.data?.data),
  saveStyle: (showId, style) => api.put(`${base}/shows/${showId}/style`, style).then((r) => r.data?.data),
  shows: () => api.get('/api/v1/shows').then((r) => (Array.isArray(r.data?.data) ? r.data.data : [])),
  // Every episode, in order. A single limit=500 request was refused (the
  // server allows 100), which left the Episode list empty.
  episodes: (showId) => fetchAllEpisodes(api, showId, { sort: 'episode_number:ASC' }).then((r) => r.items),
};
