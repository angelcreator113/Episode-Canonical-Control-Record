/**
 * YouTube thumbnails (Templates › YouTube thumbnails; Evoni, 2026-10-17):
 * /api/v1/youtube-thumbnails. An episode's 1280x720 thumbnail, as layers
 * (2026-10-21; lib/thumbnailLayers) that start from the show's template;
 * the server draws the saved file from the same layers.
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
  // Evoni's collage (2026-10-21): checklist, Lala, the script headline, the pieces.
  { key: 'come-style-me', label: 'Come Style Me' },
];

// The LalaVerse palette for the accent (the show's name, the badge, the
// bottom stripe) and the title's colour.
export const ACCENTS = ['#E0689F', '#C2407F', '#B8962E', '#E6C98F', '#A46EE0', '#2BB5AD'];
export const TEXT_COLORS = [
  { value: '#FFFFFF', label: 'White' },
  { value: '#FDF4E3', label: 'Cream' },
  { value: '#FFE9A8', label: 'Gold' },
];

// The colours last picked with the free colour picker, on this browser
// (Evoni, 2026-10-21: any colour, not only the swatches), newest first.
const RECENT_KEY = 'yts-recent-colours';
const RECENT_MAX = 6;
const isHex = (c) => /^#[0-9a-f]{6}$/i.test(String(c || ''));

export function readRecentColours() {
  try {
    const list = JSON.parse(window.localStorage.getItem(RECENT_KEY) || '[]');
    return Array.isArray(list) ? list.filter(isHex).slice(0, RECENT_MAX) : [];
  } catch (err) {
    console.error('[youtubeThumbnailsApi] recent colours unreadable:', err?.message || err);
    return [];
  }
}

/** Puts a colour first in the recent ones (kept on this browser); returns the list. */
export function rememberColour(colour) {
  const c = String(colour || '').toUpperCase();
  const list = isHex(c) ? [c, ...readRecentColours().filter((x) => x.toUpperCase() !== c)].slice(0, RECENT_MAX) : readRecentColours();
  try {
    window.localStorage.setItem(RECENT_KEY, JSON.stringify(list));
  } catch (err) {
    console.error('[youtubeThumbnailsApi] recent colours not kept:', err?.message || err);
  }
  return list;
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

/** A head-to-toe pose for Come Style Me's full outfit: her back pose, else her front; not the main one. */
export function outfitPose(poses, mainUrl) {
  for (const pose of ['back', 'front', 'side']) {
    const list = (poses || []).filter((p) => p.pose === pose && p.url !== mainUrl);
    const pick = list.find((p) => p.isDefault) || list[0];
    if (pick) return pick.url;
  }
  return null;
}

/**
 * An episode's words and pictures (its sources), as a template or a layout
 * fills them: the Studio when an episode opens, and a whole season at once.
 */
export function episodeContent(src) {
  // This episode's starred Lala pose first (her look changes each
  // episode), then the show's saved Lala, then the Asset Library's.
  const lalaUrl = defaultPose(src.poses?.lala)?.url || src.style?.lalaUrl || src.cutouts?.[0]?.url || null;
  return {
    ...episodeWords(src.episode, src.show),
    backgroundUrl: src.backgrounds?.[0]?.url || null,
    lalaUrl,
    // JustAWoman joins only when picked.
    jawUrl: null,
    // Come Style Me: the full outfit is another of Lala's poses (her back
    // or front), the checklist, edition and pieces come from the episode.
    outfitUrl: outfitPose(src.poses?.lala, lalaUrl),
    checklist: src.suggest?.checklist || [],
    edition: src.suggest?.edition || null,
    pieces: src.suggest?.pieces || [],
    logoUrl: src.suggest?.logoUrl || null,
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
  render: (spec) => api.post(`${base}/render`, spec, { responseType: 'blob', timeout: 60000 }).then((r) => r.data),
  // A whole season at once (Evoni, 2026-10-21): a small JPEG of the layers, and the show's episodes with their thumbnails.
  renderSmall: (spec) => api.post(`${base}/render/small`, spec, { responseType: 'blob', timeout: 60000 }).then((r) => r.data),
  season: (showId) => api.get(`${base}/shows/${showId}/season`).then((r) => (Array.isArray(r.data?.data) ? r.data.data : [])),
  save: (episodeId, spec) => api.post(`${base}/episodes/${episodeId}`, spec, { timeout: 60000 }).then((r) => r.data?.data),
  draft: (episodeId) => api.get(`${base}/episodes/${episodeId}/draft`).then((r) => r.data?.data || null),
  saveDraft: (episodeId, spec) => api.put(`${base}/episodes/${episodeId}/draft`, spec).then((r) => r.data?.data),
  uploadPicture: (episodeId, file) => {
    const form = new FormData();
    form.append('image', file);
    return api.post(`${base}/episodes/${episodeId}/pictures`, form, { timeout: 0 }).then((r) => r.data?.data);
  },
  saved: (episodeId) => api.get(`${base}/episodes/${episodeId}/saved`).then((r) => (Array.isArray(r.data?.data) ? r.data.data : [])),
  makePrimary: (episodeId, thumbnailId) => api.post(`${base}/episodes/${episodeId}/saved/${thumbnailId}/primary`).then((r) => r.data?.data),
  removeSaved: (episodeId, thumbnailId) => api.delete(`${base}/episodes/${episodeId}/saved/${thumbnailId}`).then((r) => r.data?.data),
  saveStyle: (showId, style) => api.put(`${base}/shows/${showId}/style`, style).then((r) => r.data?.data),
  // A show's named templates (Evoni, 2026-10-21); "legacy" is the one kept before them.
  templates: (showId) => api.get(`${base}/shows/${showId}/templates`).then((r) => (Array.isArray(r.data?.data) ? r.data.data : [])),
  allTemplates: () => api.get(`${base}/templates`).then((r) => (Array.isArray(r.data?.data) ? r.data.data : [])),
  createTemplate: (showId, body) => api.post(`${base}/shows/${showId}/templates`, body, { timeout: 60000 }).then((r) => r.data?.data),
  updateTemplate: (showId, templateId, body) => api.patch(`${base}/shows/${showId}/templates/${templateId}`, body, { timeout: 60000 }).then((r) => r.data?.data),
  deleteTemplate: (showId, templateId) => api.delete(`${base}/shows/${showId}/templates/${templateId}`).then((r) => r.data?.data),
  // An episode's versions to compare (Evoni, 2026-10-21).
  versions: (episodeId) => api.get(`${base}/episodes/${episodeId}/versions`).then((r) => (Array.isArray(r.data?.data) ? r.data.data : [])),
  createVersion: (episodeId, body) => api.post(`${base}/episodes/${episodeId}/versions`, body, { timeout: 60000 }).then((r) => r.data?.data),
  updateVersion: (episodeId, versionId, body) => api.patch(`${base}/episodes/${episodeId}/versions/${versionId}`, body, { timeout: 60000 }).then((r) => r.data?.data),
  deleteVersion: (episodeId, versionId) => api.delete(`${base}/episodes/${episodeId}/versions/${versionId}`).then((r) => r.data?.data),
  shows: () => api.get('/api/v1/shows').then((r) => (Array.isArray(r.data?.data) ? r.data.data : [])),
  // Every episode, in order. A single limit=500 request was refused (the
  // server allows 100), which left the Episode list empty.
  episodes: (showId) => fetchAllEpisodes(api, showId, { sort: 'episode_number:ASC' }).then((r) => r.items),
};
